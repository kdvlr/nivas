import copy
import json
import logging
import os
import re
import threading
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set
from zoneinfo import ZoneInfo

import httpx

from ..config import get_settings
from ..db import SessionLocal
from ..models import Base, KidsConceptLedger, KidsDailyEdition, Setting
from ..ws import manager
from .kids_curriculum import (
    CLICHE_BLOCKLIST_PROMPT,
    CURRICULUM_PILLARS,
    MYTH_BLOCKER_PROMPT,
    age_to_grade_label,
    build_idf_weights,
    compute_word_stem,
    cosine_packed,
    draw_daily_curriculum,
    extract_entity_tokens,
    lexical_concept_similarity,
    normalize_subject_key,
    pack_embedding,
    sanitize_and_validate_word,
    unpack_embedding,
)

logger = logging.getLogger(__name__)

DOMAINS = tuple(CURRICULUM_PILLARS.keys())


def _tokens(value: str) -> set[str]:
    return {token for token in re.findall(r"[a-z0-9]+", value.lower()) if len(token) > 2}


def _similarity(left: str, right: str) -> float:
    a, b = _tokens(left), _tokens(right)
    return len(a & b) / len(a | b) if a and b else 0.0


def _get_kids_daily_file() -> Path:
    return Path(get_settings().data_dir) / "kids_daily.json"


# These limits are part of the 1920x1080 wall-display contract. They keep the
# generated copy concise enough to remain readable without scrolling, clipping,
# ellipses, or shrinking the type below its across-the-room size.
KIDS_DAILY_DISPLAY_LIMITS: Dict[str, Dict[str, int]] = {
    "word_of_the_day": {
        "word": 24,
        "pronunciation": 32,
        "part_of_speech": 16,
        "definition": 140,
        "example": 140,
    },
    "fun_fact": {
        "fact": 180,
        "category": 32,
        "emoji": 8,
        "did_you_know": 180,
    },
    "stem_5yo": {
        "topic": 40,
        "question": 160,
        "hint": 140,
        "answer": 200,
        "parent_explanation": 220,
    },
    "stem_9yo": {
        "topic": 40,
        "question": 160,
        "hint": 140,
        "answer": 200,
        "parent_explanation": 220,
    },
}


def content_fits_display_limits(content: Dict[str, Any]) -> bool:
    """Return True when every supplied display field fits the kiosk budget."""
    for section_name, field_limits in KIDS_DAILY_DISPLAY_LIMITS.items():
        section = content.get(section_name)
        if not isinstance(section, dict):
            return False
        for field_name, max_length in field_limits.items():
            value = section.get(field_name)
            if value is None:
                continue
            if not isinstance(value, str) or len(value.strip()) > max_length:
                return False
    return True


KIDS_DAILY_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "word_of_the_day": {
            "type": "OBJECT",
            "properties": {
                "word": {"type": "STRING", "maxLength": KIDS_DAILY_DISPLAY_LIMITS["word_of_the_day"]["word"]},
                "pronunciation": {"type": "STRING", "maxLength": KIDS_DAILY_DISPLAY_LIMITS["word_of_the_day"]["pronunciation"]},
                "part_of_speech": {"type": "STRING", "maxLength": KIDS_DAILY_DISPLAY_LIMITS["word_of_the_day"]["part_of_speech"]},
                "definition": {"type": "STRING", "maxLength": KIDS_DAILY_DISPLAY_LIMITS["word_of_the_day"]["definition"]},
                "example": {"type": "STRING", "maxLength": KIDS_DAILY_DISPLAY_LIMITS["word_of_the_day"]["example"]},
            },
            "required": ["word", "pronunciation", "part_of_speech", "definition", "example"],
        },
        "fun_fact": {
            "type": "OBJECT",
            "properties": {
                "fact": {"type": "STRING", "maxLength": KIDS_DAILY_DISPLAY_LIMITS["fun_fact"]["fact"]},
                "category": {"type": "STRING", "maxLength": KIDS_DAILY_DISPLAY_LIMITS["fun_fact"]["category"]},
                "emoji": {"type": "STRING", "maxLength": KIDS_DAILY_DISPLAY_LIMITS["fun_fact"]["emoji"]},
                "did_you_know": {"type": "STRING", "maxLength": KIDS_DAILY_DISPLAY_LIMITS["fun_fact"]["did_you_know"]},
            },
            "required": ["fact", "category", "emoji", "did_you_know"],
        },
        "stem_5yo": {
            "type": "OBJECT",
            "properties": {
                "topic": {"type": "STRING", "maxLength": KIDS_DAILY_DISPLAY_LIMITS["stem_5yo"]["topic"]},
                "question": {"type": "STRING", "maxLength": KIDS_DAILY_DISPLAY_LIMITS["stem_5yo"]["question"]},
                "hint": {"type": "STRING", "maxLength": KIDS_DAILY_DISPLAY_LIMITS["stem_5yo"]["hint"]},
                "answer": {"type": "STRING", "maxLength": KIDS_DAILY_DISPLAY_LIMITS["stem_5yo"]["answer"]},
                "parent_explanation": {"type": "STRING", "maxLength": KIDS_DAILY_DISPLAY_LIMITS["stem_5yo"]["parent_explanation"]},
            },
            "required": ["topic", "question", "hint", "answer", "parent_explanation"],
        },
        "stem_9yo": {
            "type": "OBJECT",
            "properties": {
                "topic": {"type": "STRING", "maxLength": KIDS_DAILY_DISPLAY_LIMITS["stem_9yo"]["topic"]},
                "question": {"type": "STRING", "maxLength": KIDS_DAILY_DISPLAY_LIMITS["stem_9yo"]["question"]},
                "hint": {"type": "STRING", "maxLength": KIDS_DAILY_DISPLAY_LIMITS["stem_9yo"]["hint"]},
                "answer": {"type": "STRING", "maxLength": KIDS_DAILY_DISPLAY_LIMITS["stem_9yo"]["answer"]},
                "parent_explanation": {"type": "STRING", "maxLength": KIDS_DAILY_DISPLAY_LIMITS["stem_9yo"]["parent_explanation"]},
            },
            "required": ["topic", "question", "hint", "answer", "parent_explanation"],
        },
    },
    "required": ["word_of_the_day", "fun_fact", "stem_5yo", "stem_9yo"],
}


def _build_generation_schema(section_names: Optional[List[str]] = None) -> Dict[str, Any]:
    """Build Gemini JSON schema including canonical `subject_key` slugs for concept deduplication."""
    wanted = section_names or ["word_of_the_day", "fun_fact", "stem_5yo", "stem_9yo"]
    props: Dict[str, Any] = {}
    for name in wanted:
        sec_schema = copy.deepcopy(KIDS_DAILY_SCHEMA["properties"][name])
        if name in ("fun_fact", "stem_5yo", "stem_9yo"):
            sec_schema["properties"]["subject_key"] = {
                "type": "STRING",
                "maxLength": 48,
                "description": "Canonical 2-4 word snake_case identifier of the specific object, species, or mechanism (e.g. 'fresnel_lighthouse_lens')",
            }
            if "subject_key" not in sec_schema["required"]:
                sec_schema["required"].append("subject_key")
        props[name] = sec_schema
    return {
        "type": "OBJECT",
        "properties": props,
        "required": list(wanted),
    }


KIDS_GENERATION_SCHEMA = _build_generation_schema()

# Rich 31-day rotating offline fallback catalog (1 unique bundle for every day of the month)
FALLBACK_CATALOG: List[Dict[str, Any]] = [
    # Day 1
    {
        "word_of_the_day": {
            "word": "Curious",
            "pronunciation": "KYUR-ee-us",
            "part_of_speech": "adjective",
            "definition": "Eager to learn, explore, or know more about something.",
            "example": "Mia was curious about why leaves change colors in the autumn."
        },
        "fun_fact": {
            "fact": "Sea otters hold hands while they sleep so they don't drift apart in the ocean currents!",
            "category": "Ocean Life",
            "emoji": "🦦",
            "did_you_know": "They sometimes wrap themselves in giant kelp seaweed like a blanket for extra safety."
        },
        "stem_5yo": {
            "topic": "Nature & Animals",
            "question": "Why do birds have feathers instead of fur?",
            "hint": "Think about what birds do in the sky and how they stay dry!",
            "answer": "Feathers help birds fly smoothly through the air and keep them warm and dry like a raincoat.",
            "parent_explanation": "Feathers are lightweight, trap warm air next to skin, and have natural water-repellent oils."
        },
        "stem_9yo": {
            "topic": "Space & Gravity",
            "question": "Why does the Moon look like it has bright and dark spots when you look up at night?",
            "hint": "Some spots are giant flat plains made of ancient lava, while others are rough mountains.",
            "answer": "The dark areas (maria) are smooth plains formed by ancient volcanic lava, while the bright areas are rugged highlands covered with craters.",
            "parent_explanation": "Dark maria are ancient basalt lava flows. The lighter highlands are anorthosite rock heavily cratered by meteorites billions of years ago."
        }
    },
    # Day 2
    {
        "word_of_the_day": {
            "word": "Luminous",
            "pronunciation": "LOO-min-us",
            "part_of_speech": "adjective",
            "definition": "Shining brightly and giving off light, especially in the dark.",
            "example": "The fireflies made the garden look magical and luminous at twilight."
        },
        "fun_fact": {
            "fact": "Honey never spoils! Archaeologists found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still edible.",
            "category": "Food Science",
            "emoji": "🍯",
            "did_you_know": "Honey has very little water and high natural acidity, making it impossible for bacteria or microbes to grow."
        },
        "stem_5yo": {
            "topic": "Physics & Shadows",
            "question": "Where does your shadow go when the sun goes behind a cloud?",
            "hint": "A shadow is made when something blocks direct light!",
            "answer": "Your shadow disappears because the cloud scatters sunlight in all directions, so there's no strong direct beam to block.",
            "parent_explanation": "Shadows form when an opaque object blocks straight rays of light. When clouds diffuse light from everywhere, sharp shadows fade away."
        },
        "stem_9yo": {
            "topic": "Electricity & Energy",
            "question": "Why doesn't a bird get electrocuted when it sits on a high-voltage power line?",
            "hint": "Electricity only flows when there is a complete path (voltage difference) between two different points.",
            "answer": "Because both of the bird's feet are on the same wire at the same voltage, no electrical current flows through the bird's body.",
            "parent_explanation": "Electricity needs a potential difference and a closed loop. If the bird touched a second wire or a grounded metal pole, dangerous current would flow."
        }
    },
    # Day 3
    {
        "word_of_the_day": {
            "word": "Whimsical",
            "pronunciation": "WIM-zih-kul",
            "part_of_speech": "adjective",
            "definition": "Playfully quaint, fanciful, or full of fun imagination.",
            "example": "The whimsical cartoon had bouncing teacups and dancing broomsticks."
        },
        "fun_fact": {
            "fact": "Sound artists called Foley artists tap metal guy-wires on radio towers with a wrench to make laser blaster sounds in movies!",
            "category": "Movie Magic",
            "emoji": "🎬",
            "did_you_know": "They also use cornstarch in leather pouches to create footsteps crunching in fresh snow."
        },
        "stem_5yo": {
            "topic": "Everyday Wonders",
            "question": "Why does popcorn go POP when you heat it in a pot or microwave?",
            "hint": "Each kernel has a tiny drop of water trapped inside!",
            "answer": "Water trapped inside turns to hot steam and builds pressure until the hard hull bursts into fluffy white popcorn!",
            "parent_explanation": "Popcorn kernels have hard hulls containing water and starch. Steam pressure builds to ~135 psi until it bursts and gelatinizes."
        },
        "stem_9yo": {
            "topic": "Animation & Film",
            "question": "How do animators make cartoon characters look like they are smoothly running across a movie screen?",
            "hint": "They display a sequence of slightly different drawings very quickly.",
            "answer": "They show 24 slightly different drawings every second. Our brains blend these discrete images into fluid continuous motion.",
            "parent_explanation": "This relies on persistence of vision and the phi phenomenon: the human visual cortex bridges rapid sequential frames into motion."
        }
    },
    # Day 4
    {
        "word_of_the_day": {
            "word": "Telescopic",
            "pronunciation": "tel-uh-SKOP-ik",
            "part_of_speech": "adjective",
            "definition": "Able to see distant things or slide into sections to become longer or shorter.",
            "example": "Leo used his telescopic lens to watch a robin feeding its chicks high in the tree."
        },
        "fun_fact": {
            "fact": "Venus is the only planet in our Solar System that spins clockwise (backwards compared to Earth)!",
            "category": "Astronomy",
            "emoji": "🪐",
            "did_you_know": "A single day on Venus (one rotation) lasts longer than a full Venusian year around the Sun."
        },
        "stem_5yo": {
            "topic": "Sound & Vibrations",
            "question": "If you touch your throat while humming, what do you feel buzzing?",
            "hint": "Put two fingers gently on your neck and say 'Mmmmmm'!",
            "answer": "You feel vibrations! Your vocal cords are shaking back and forth very fast to make sound waves.",
            "parent_explanation": "All sound is made of physical vibrations traveling through air. Vocal cords vibrate air as it passes from your lungs."
        },
        "stem_9yo": {
            "topic": "Chemistry & States of Matter",
            "question": "Why does ice float on top of liquid water when most solid objects sink in their liquid form?",
            "hint": "Water molecules form a special hexagonal crystal structure as they freeze.",
            "answer": "When water freezes, hydrogen bonds lock molecules into an open hexagonal crystal lattice, making ice less dense than liquid water.",
            "parent_explanation": "Most substances shrink and get denser when freezing. Water uniquely expands below 4°C, allowing ice to float and insulate marine life below."
        }
    },
    # Day 5
    {
        "word_of_the_day": {
            "word": "Ingenious",
            "pronunciation": "in-JEEN-yus",
            "part_of_speech": "adjective",
            "definition": "Clever, original, and brilliantly inventive at solving problems.",
            "example": "Maya had an ingenious idea to turn an old cardboard box into a solar oven."
        },
        "fun_fact": {
            "fact": "The popsicle was invented by an 11-year-old kid in 1905 who accidentally left soda with a stirring stick outside on a freezing night!",
            "category": "Accidental Inventions",
            "emoji": "🍧",
            "did_you_know": "Frank Epperson originally called it the 'Epsicle', but his kids convinced him to call it a Pop's-sicle!"
        },
        "stem_5yo": {
            "topic": "Everyday Objects",
            "question": "Why do pencils have soft pink erasers, and how do they rub away pencil marks?",
            "hint": "The rubber is stickier than paper and picks up graphite dust!",
            "answer": "The rubber eraser is stickier than the paper, so it grabs the loose pencil graphite particles off the page as you rub.",
            "parent_explanation": "Pencils write by leaving layers of graphite on paper fibers. Rubber erasers create friction that lifts graphite and rolls away in crumbs."
        },
        "stem_9yo": {
            "topic": "Invention History",
            "question": "How did an engineer taking a walk with his dog in the woods lead to the invention of Velcro fasteners on sneakers?",
            "hint": "He noticed tiny burrs sticking stubbornly to his socks and his dog's fur.",
            "answer": "George de Mestral saw under a microscope that cocklebur seeds have hundreds of tiny hooks that grab fabric loops, inspiring hook-and-loop Velcro.",
            "parent_explanation": "This is a classic example of biomimicry. Nature's hook-and-loop seed dispersal mechanism inspired synthetic nylon fastening tape."
        }
    },
    # Day 6
    {
        "word_of_the_day": {
            "word": "Prehistoric",
            "pronunciation": "pree-hih-STOR-ik",
            "part_of_speech": "adjective",
            "definition": "Belonging to the very ancient time before people started writing down history.",
            "example": "The museum had a giant prehistoric fossil of a Woolly Mammoth with curved tusks."
        },
        "fun_fact": {
            "fact": "Tyrannosaurus Rex had teeth as long as bananas (up to 12 inches including the root) and the strongest bite of any land animal!",
            "category": "Paleontology",
            "emoji": "🦖",
            "did_you_know": "Scientists discovered that birds are the direct living descendants of small feathered theropod dinosaurs."
        },
        "stem_5yo": {
            "topic": "Fossils & Earth",
            "question": "How did dinosaur bones turn into rock fossils underground?",
            "hint": "Mud and water filled with minerals soaked into the buried bones over millions of years!",
            "answer": "Mineral-rich water seeped into the buried bones and slowly replaced the bone with hard stone over millions of years.",
            "parent_explanation": "This process is called permineralization. Mud layers protect the bones from decay while minerals harden into an exact stone replica."
        },
        "stem_9yo": {
            "topic": "Geological Time & Dating",
            "question": "How can scientists know a dinosaur fossil is 68 million years old without a written timestamp?",
            "hint": "They measure radioactive isotopes that decay at a precise clock rate in volcanic rock layers.",
            "answer": "They use radiometric dating by measuring the decay ratio of radioactive elements (like Potassium-Argon or Uranium-Lead) in surrounding volcanic ash layers.",
            "parent_explanation": "Radioactive isotopes decay into stable daughter elements at fixed half-lives, acting like built-in atomic clocks inside igneous rocks."
        }
    },
    # Day 7
    {
        "word_of_the_day": {
            "word": "Epic",
            "pronunciation": "EP-ik",
            "part_of_speech": "adjective",
            "definition": "Grand, heroic, or impressively magnificent in scale.",
            "example": "The video game hero went on an epic quest across floating islands to find the golden star."
        },
        "fun_fact": {
            "fact": "Pac-Man creator Toru Iwatani got the idea for the iconic round yellow character after ordering a whole pizza and taking out a single slice!",
            "category": "Video Game Lore",
            "emoji": "🕹️",
            "did_you_know": "Pac-Man was designed to appeal to everyone by focusing on eating colorful fruit rather than spaceship shooting."
        },
        "stem_5yo": {
            "topic": "Toys & Building",
            "question": "Why do LEGO bricks snap together and hold tight without any glue?",
            "hint": "The round studs on top fit snugly inside the tubes underneath!",
            "answer": "Round studs on top squeeze tightly into tubes underneath, holding with friction until you pull them apart!",
            "parent_explanation": "LEGO bricks use 'clutch power'. High-precision manufacturing creates an interference fit with micro-flexibility in ABS plastic."
        },
        "stem_9yo": {
            "topic": "Computer Graphics",
            "question": "Why did early video games like Super Mario look like they were made of square blocks (pixels)?",
            "hint": "Early game console chips had tiny memory and could only draw small grids of colored squares.",
            "answer": "Early game consoles had limited memory that could only store 8-bit color grids, so artists designed characters using small palettes of pixel squares.",
            "parent_explanation": "The NES GPU could only display 64 colors and 64 sprites. Artists used clever pixel art silhouettes to convey personality in just 16x16 squares."
        }
    },
    # Day 8
    {
        "word_of_the_day": {
            "word": "Atmospheric",
            "pronunciation": "at-mus-FEER-ik",
            "part_of_speech": "adjective",
            "definition": "Relating to the envelope of gases that surrounds the Earth or another planet.",
            "example": "High atmospheric pressure usually brings bright sunny skies and gentle breezes."
        },
        "fun_fact": {
            "fact": "Lightning is five times hotter than the surface of the Sun, reaching temperatures of 50,000° Fahrenheit!",
            "category": "Weather & Energy",
            "emoji": "⚡",
            "did_you_know": "Thunder is the sonic shockwave caused by the air instantly expanding from that intense heat."
        },
        "stem_5yo": {
            "topic": "Weather Science",
            "question": "Why do we always see the lightning flash before we hear the thunder boom?",
            "hint": "One travels as fast as light, while the other travels as fast as sound!",
            "answer": "Light travels almost instantly to your eyes, while sound waves travel much slower through the air to your ears.",
            "parent_explanation": "Light travels at 186,000 miles per second, while sound moves at about 1 mile every 5 seconds in air."
        },
        "stem_9yo": {
            "topic": "Optics & Meteorology",
            "question": "Why do rainbows always appear in the opposite direction from the Sun in the sky?",
            "hint": "Sunlight enters raindrops, reflects off the back inside surface, and bends as it exits.",
            "answer": "Because sunlight enters raindrops, undergoes internal refraction and reflection at a 42-degree angle back toward your eyes, placing the sun behind you.",
            "parent_explanation": "Each raindrop acts as a tiny prism that disperses white light into its spectral colors through double refraction and internal reflection."
        }
    },
    # Day 9
    {
        "word_of_the_day": {
            "word": "Volcanic",
            "pronunciation": "vol-KAN-ik",
            "part_of_speech": "adjective",
            "definition": "Produced by or relating to volcanoes and melted rock from inside the Earth.",
            "example": "The Hawaiian islands were formed over millions of years by volcanic eruptions under the sea."
        },
        "fun_fact": {
            "fact": "The largest volcano in our entire Solar System is Olympus Mons on Mars—it is three times taller than Mount Everest!",
            "category": "Earth & Planetary",
            "emoji": "🌋",
            "did_you_know": "Olympus Mons is so wide that if you stood at its base, the peak would be over the horizon."
        },
        "stem_5yo": {
            "topic": "Earth Science",
            "question": "What is the difference between magma and lava?",
            "hint": "One is hidden deep under the ground, while the other flows outside on the surface!",
            "answer": "Magma is melted rock trapped underground; once it erupts out onto Earth's surface, it is called lava.",
            "parent_explanation": "Deep under Earth's crust, intense heat melts rock into magma. When it bursts through volcanoes, we call it lava."
        },
        "stem_9yo": {
            "topic": "Plate Tectonics",
            "question": "What causes Earth's continents to slowly move a few centimeters every year?",
            "hint": "Think of giant crust slabs floating on top of slowly churning hot mantle convection currents.",
            "answer": "Convection currents in the hot, semi-fluid mantle circulate heat, slowly drifting the rigid tectonic plates above them.",
            "parent_explanation": "Heat from Earth's core drives mantle convection cells. Where plates pull apart, new crust forms; where they collide, mountains and trenches arise."
        }
    },
    # Day 10
    {
        "word_of_the_day": {
            "word": "Artifact",
            "pronunciation": "AR-tih-fakt",
            "part_of_speech": "noun",
            "definition": "An object made or shaped by humans long ago, often of historical interest.",
            "example": "Archaeologists discovered an ancient bronze artifact buried in the courtyard."
        },
        "fun_fact": {
            "fact": "Ancient Egyptian kids played with board games, spinning tops, and wooden toys with moving jaws over 3,000 years ago!",
            "category": "Ancient Civilizations",
            "emoji": "🏺",
            "did_you_know": "One of the most popular ancient games was Senet, where players rolled carved sticks to race pieces across a 30-square grid."
        },
        "stem_5yo": {
            "topic": "Ancient Wonders",
            "question": "Why did ancient Egyptians build the Great Pyramids out of giant stone blocks?",
            "hint": "They wanted them to stand strong and last forever for their pharaohs!",
            "answer": "They built them with heavy limestone blocks so the royal monuments would stand tall against wind and desert sands forever.",
            "parent_explanation": "The Great Pyramid of Giza was built from over 2 million limestone blocks and stood as the tallest human-made structure for 3,800 years."
        },
        "stem_9yo": {
            "topic": "Ancient Engineering",
            "question": "How did ancient Roman aqueducts carry fresh mountain water for dozens of miles into cities without water pumps?",
            "hint": "They used a very slight, constant downward slope powered purely by gravity.",
            "answer": "Roman engineers built aqueducts with a precise, gentle downhill slope, letting gravity pull water smoothly across arched bridges into city fountains.",
            "parent_explanation": "Engineers used chorobates levels to maintain slopes as gentle as 1 foot drop per 1,000 feet length, delivering millions of gallons of water daily."
        }
    },
    # Day 11
    {
        "word_of_the_day": {
            "word": "Adaptable",
            "pronunciation": "uh-DAP-tuh-bul",
            "part_of_speech": "adjective",
            "definition": "Able to adjust easily to new conditions, environments, or changes.",
            "example": "Arctic foxes are adaptable animals with thick white coats in winter and brown fur in summer."
        },
        "fun_fact": {
            "fact": "Chameleons don't just change color to hide; they also change colors to control their body temperature and show how they are feeling!",
            "category": "Animal Wonders",
            "emoji": "🦎",
            "did_you_know": "Chameleons can move each of their eyes completely independently to watch two directions at once."
        },
        "stem_5yo": {
            "topic": "Animal Superpowers",
            "question": "How do bats fly and find food in total darkness without bumping into trees?",
            "hint": "They use their ears and sound like a built-in submarine sonar!",
            "answer": "Bats make high-pitched clicking sounds that bounce off objects so their ears can map out everything around them.",
            "parent_explanation": "This is called echolocation. Bats emit ultrasonic calls and calculate the distance, size, and speed of objects from the returning echoes."
        },
        "stem_9yo": {
            "topic": "Evolution & Camouflage",
            "question": "How do chameleon skin cells physically change color so quickly?",
            "hint": "Special cells contain tiny nanocrystals that reflect different wavelengths of light when stretched or relaxed.",
            "answer": "Iridophore cells contain guanine nanocrystals. By adjusting the microscopic spacing between these crystals, the skin reflects different colors of light.",
            "parent_explanation": "When relaxed, the crystals reflect blue light (mixing with yellow pigment for green). When excited, the lattice expands to reflect red/yellow light."
        }
    },
    # Day 12
    {
        "word_of_the_day": {
            "word": "Mechanical",
            "pronunciation": "muh-KAN-ih-kul",
            "part_of_speech": "adjective",
            "definition": "Operated by a machine or involving the physical laws of force and motion.",
            "example": "Gears, pulleys, and levers are mechanical parts that make bicycles work smoothly."
        },
        "fun_fact": {
            "fact": "The wheel is considered one of humanity's greatest inventions, created over 5,500 years ago in ancient Mesopotamia!",
            "category": "Inventions & Physics",
            "emoji": "⚙️",
            "did_you_know": "The first wheels were actually used for making pottery before anyone thought to put them on carts!"
        },
        "stem_5yo": {
            "topic": "Simple Machines",
            "question": "Why is it much easier to roll a heavy box on a wagon with wheels than to drag it across the floor?",
            "hint": "Think about friction rubbing against the ground!",
            "answer": "Wheels reduce friction by rolling over the ground instead of scraping and rubbing against it.",
            "parent_explanation": "Rolling friction is much smaller than sliding friction. Wheels allow the box to roll forward with very little resistance."
        },
        "stem_9yo": {
            "topic": "Physics & Levers",
            "question": "Why does a seesaw allow a child to easily lift a grown-up if the grown-up sits closer to the middle?",
            "hint": "Torque is equal to the force applied multiplied by the distance from the pivot point (fulcrum).",
            "answer": "By increasing distance from the fulcrum, the child multiplies their mechanical advantage (torque = force × distance).",
            "parent_explanation": "Levers trade distance for force. A smaller force over a longer distance creates equal turning torque to lift a larger mass."
        }
    },
    # Day 13
    {
        "word_of_the_day": {
            "word": "Industrious",
            "pronunciation": "in-DUS-tree-us",
            "part_of_speech": "adjective",
            "definition": "Hardworking, busy, and always putting effort into completing tasks.",
            "example": "The industrious honeybees worked all morning visiting thousands of blossoms."
        },
        "fun_fact": {
            "fact": "A leafcutter ant can lift objects up to 50 times its own body weight with its jaws—that is like a human lifting a pickup truck!",
            "category": "Insect Wonders",
            "emoji": "🐜",
            "did_you_know": "Ants don't eat the leaves they cut; they use them to farm edible fungus gardens deep inside underground colonies."
        },
        "stem_5yo": {
            "topic": "Insects & Nature",
            "question": "How do honeybees tell other bees in their hive where to find delicious flower nectar?",
            "hint": "They do a special dancing routine on the honeycomb!",
            "answer": "They perform a 'waggle dance' that shows the exact direction and distance to the flowers relative to the Sun.",
            "parent_explanation": "Bees dance in a figure-eight pattern. The angle of the waggle indicates the direction, and the duration of the dance shows the distance."
        },
        "stem_9yo": {
            "topic": "Materials Science & Biomimicry",
            "question": "Why is spider silk stronger by weight than high-grade steel?",
            "hint": "The silk protein combines stiff crystalline blocks with flexible elastic chains.",
            "answer": "Spider dragline silk is composed of spidroin proteins containing tight beta-sheet crystals embedded in elastic amorphous peptide chains.",
            "parent_explanation": "The crystals provide immense tensile strength while the flexible loops absorb kinetic energy without snapping, inspiring bulletproof vests."
        }
    },
    # Day 14
    {
        "word_of_the_day": {
            "word": "Resonant",
            "pronunciation": "REZ-uh-nunt",
            "part_of_speech": "adjective",
            "definition": "Deep, clear, and continuing to ring or echo cleanly.",
            "example": "The resonant sound of the big cathedral bell echoed across the entire valley."
        },
        "fun_fact": {
            "fact": "Sound travels more than four times faster through ocean water than it does through air!",
            "category": "Acoustics & Physics",
            "emoji": "🔔",
            "did_you_know": "Sound travels even faster through solid steel—about 15 times faster than through air."
        },
        "stem_5yo": {
            "topic": "Sound & Echoes",
            "question": "Why do you hear an echo when you shout inside a big empty gym or canyon?",
            "hint": "Sound waves bounce off hard walls like a bouncy ball!",
            "answer": "Your voice travels through the air, hits a hard flat wall, and bounces right back into your ears.",
            "parent_explanation": "Sound is a wave of moving air. When it hits a solid obstacle without absorbing material, it reflects back as an echo."
        },
        "stem_9yo": {
            "topic": "Physics & Waves",
            "question": "Why can an opera singer shatter a crystal glass just by singing a single sustained high note?",
            "hint": "Every object has a natural resonance frequency where vibrations build up exponentially.",
            "answer": "When the singer matches the glass's natural resonant frequency, constructive wave interference causes vibrations to amplify until the glass fractures.",
            "parent_explanation": "This is acoustic resonance. Each vibration adds energy to the crystal structure until the mechanical strain exceeds the glass's elastic limit."
        }
    },
    # Day 15
    {
        "word_of_the_day": {
            "word": "Magnetic",
            "pronunciation": "mag-NET-ik",
            "part_of_speech": "adjective",
            "definition": "Having the power to attract iron or steel, or having a powerfully charming quality.",
            "example": "Earth has a giant magnetic field that makes compass needles always point North."
        },
        "fun_fact": {
            "fact": "Earth is basically a giant magnet because its molten outer core is made of churning liquid iron and nickel!",
            "category": "Geophysics",
            "emoji": "🧲",
            "did_you_know": "Earth's magnetic shield (magnetosphere) protects all living things from harmful solar radiation particles."
        },
        "stem_5yo": {
            "topic": "Magnets & Electricity",
            "question": "Why do magnets have two ends that push apart when you put them together?",
            "hint": "Every magnet has a North pole and a South pole!",
            "answer": "Opposite poles attract each other (North and South pull together), but matching poles push each other away (North pushes North).",
            "parent_explanation": "Magnetic field lines flow from North to South. Putting identical poles together forces magnetic field lines to collide and repel."
        },
        "stem_9yo": {
            "topic": "Electromagnetism",
            "question": "How can you turn a simple iron nail into a powerful magnet using only copper wire and a battery?",
            "hint": "Electric current flowing through a coil creates an invisible magnetic field.",
            "answer": "Coiling wire around the nail and connecting it to a battery creates an electromagnet because moving electric current generates a magnetic field.",
            "parent_explanation": "According to Ampère's law, electric current creates magnetic flux. The iron core concentrates the field, magnetizing until current stops."
        }
    },
    # Day 16
    {
        "word_of_the_day": {
            "word": "Effervescent",
            "pronunciation": "ef-er-VES-unt",
            "part_of_speech": "adjective",
            "definition": "Giving off bubbles of gas (fizzing), or full of lively energy and enthusiasm.",
            "example": "When Noah added baking soda to vinegar, the volcano model erupted with effervescent foam."
        },
        "fun_fact": {
            "fact": "The bubbles in fizzy soda are made of carbon dioxide gas trapped under high pressure inside the bottle!",
            "category": "Chemistry",
            "emoji": "🫧",
            "did_you_know": "When you open the bottle cap, the pressure drops instantly, letting the dissolved gas escape as thousands of tiny bubbles."
        },
        "stem_5yo": {
            "topic": "Kitchen Chemistry",
            "question": "Why does a sliced apple turn brown if you leave it on the counter for a few hours?",
            "hint": "Think about oxygen in the air touching the apple slices!",
            "answer": "Enzymes in the apple react with oxygen in the air in a process called oxidation.",
            "parent_explanation": "When cell walls are cut, polyphenol oxidase enzymes meet oxygen and form brown melanin pigments. A squeeze of lemon juice (vitamin C) prevents this."
        },
        "stem_9yo": {
            "topic": "Molecules & Surface Tension",
            "question": "How does simple dish soap wash away greasy oil when pure water cannot?",
            "hint": "Soap molecules have two distinct ends: one loves water (hydrophilic) and one loves grease (hydrophobic).",
            "answer": "Soap molecules form tiny spheres called micelles, trapping oil inside their hydrophobic tails while their hydrophilic heads dissolve in water.",
            "parent_explanation": "Soap is a surfactant. The hydrophobic tails bond to grease while hydrophilic heads face outward, letting water rinse the suspended oil away."
        }
    },
    # Day 17
    {
        "word_of_the_day": {
            "word": "Courageous",
            "pronunciation": "kuh-RAY-jus",
            "part_of_speech": "adjective",
            "definition": "Brave and determined when facing difficulty or challenges.",
            "example": "The courageous explorer climbed into the dark cavern to map the hidden underground lake."
        },
        "fun_fact": {
            "fact": "Medieval castle spiral staircases were built winding clockwise going up, so defending knights could freely swing their swords with their right hands!",
            "category": "Medieval History",
            "emoji": "🏰",
            "did_you_know": "Attackers coming up the stairs had their sword arms cramped against the central stone pillar, giving defenders a big advantage."
        },
        "stem_5yo": {
            "topic": "Castles & History",
            "question": "Why did castles have deep water moats all the way around their stone walls?",
            "hint": "It stopped attackers from digging tunnels under the walls or walking up with ladders!",
            "answer": "Moats kept castles safe by stopping attackers from digging tunnels under walls or wheeling up battering rams.",
            "parent_explanation": "Moats prevented undermining (mining under walls to collapse them) and forced attackers to cross exposed water under defensive towers."
        },
        "stem_9yo": {
            "topic": "Medieval Engineering",
            "question": "How did a medieval trebuchet catapult fling giant 200-pound stones across hundreds of yards without gunpowder?",
            "hint": "It used a heavy falling counterweight on the short end of a long lever arm.",
            "answer": "A massive counterweight on the short arm fell rapidly, swinging the much longer arm through an arc to release the stone at high velocity.",
            "parent_explanation": "Trebuchets trade heavy force over a short distance for high speed over a long distance, transferring potential energy into kinetic energy."
        }
    },
    # Day 18
    {
        "word_of_the_day": {
            "word": "Aerodynamic",
            "pronunciation": "air-oh-dy-NAM-ik",
            "part_of_speech": "adjective",
            "definition": "Shaped smoothly so that air flows easily around it with very little drag or resistance.",
            "example": "High-speed bullet trains have sleek aerodynamic noses shaped like kingfisher bird beaks."
        },
        "fun_fact": {
            "fact": "Peregrine falcons are the fastest animals on Earth, reaching diving speeds over 240 miles per hour!",
            "category": "Physics of Flight",
            "emoji": "🦅",
            "did_you_know": "They have special cone-shaped baffles in their nostrils that prevent their lungs from bursting in high-speed air pressure dives."
        },
        "stem_5yo": {
            "topic": "Flight & Air",
            "question": "How does a giant heavy airplane stay up in the sky without falling?",
            "hint": "Look at the special curved shape of the airplane wings!",
            "answer": "The curved wings push air downward, creating an upward force called lift that supports the airplane in the sky.",
            "parent_explanation": "As the jet engines push the plane forward, air flows over the curved wings, creating high pressure underneath and low pressure above to generate lift."
        },
        "stem_9yo": {
            "topic": "Fluid Dynamics & Lift",
            "question": "How do Newton's Third Law and Bernoulli's Principle combine to generate lift on an airplane airfoil?",
            "hint": "Wings deflect moving air downward and create a pressure differential across upper and lower surfaces.",
            "answer": "Airfoil curvature accelerates airflow above creating low pressure (Bernoulli), while the wing's angle of attack deflects air downward, reacting upward (Newton).",
            "parent_explanation": "Lift requires both circulation/pressure difference and downward momentum transfer. Pushing air down creates an equal and opposite upward lift force."
        }
    },
    # Day 19
    {
        "word_of_the_day": {
            "word": "Arid",
            "pronunciation": "AIR-id",
            "part_of_speech": "adjective",
            "definition": "Having very little rain or moisture; extremely dry and desert-like.",
            "example": "Cactus plants thrive in arid desert environments where rain only falls a few times a year."
        },
        "fun_fact": {
            "fact": "A camel's hump does not store water—it stores fat, which gives the camel energy when food is scarce in the desert!",
            "category": "Desert Adaptations",
            "emoji": "🐫",
            "did_you_know": "When a camel finally finds water, it can drink up to 30 gallons in less than 10 minutes."
        },
        "stem_5yo": {
            "topic": "Plant Science",
            "question": "Why do cactus plants have sharp prickly needles instead of wide flat leaves?",
            "hint": "Think about saving water and stopping thirsty animals from eating them!",
            "answer": "Needles protect the cactus from thirsty animals and have almost no surface area, stopping water from evaporating in the hot sun.",
            "parent_explanation": "Cactus needles are modified leaves that minimize water loss. The green stem carries out photosynthesis and stores gallons of water."
        },
        "stem_9yo": {
            "topic": "Thermodynamics & Biology",
            "question": "Why do desert animals like fennec foxes and jackrabbits have unusually enormous ears?",
            "hint": "Large surface areas filled with blood vessels help radiate excess body heat into the air.",
            "answer": "Their large, thin ears contain dense networks of blood vessels that act like biological radiators to shed heat without losing precious water sweating.",
            "parent_explanation": "This follows Allen's Rule of thermoregulation. High surface-area-to-volume extremities promote evaporative and radiant cooling in extreme heat."
        }
    },
    # Day 20
    {
        "word_of_the_day": {
            "word": "Serendipity",
            "pronunciation": "sair-un-DIP-ih-tee",
            "part_of_speech": "noun",
            "definition": "Finding delightful, unexpected good luck or discoveries by happy chance.",
            "example": "Finding a shiny lucky coin inside the pocket of an old jacket was pure serendipity."
        },
        "fun_fact": {
            "fact": "Play-Doh was originally invented in the 1930s as wallpaper cleaner before a nursery school teacher realized kids loved shaping it into art!",
            "category": "Toy Inventions",
            "emoji": "🎨",
            "did_you_know": "Over 3 billion cans of Play-Doh have been squished since it was introduced to classrooms in 1956."
        },
        "stem_5yo": {
            "topic": "Everyday Mysteries",
            "question": "Why do we yawn, and why does seeing someone else yawn make you want to yawn too?",
            "hint": "Yawns bring in a big cool breath of air to wake up your brain!",
            "answer": "Yawning takes in a big gulp of air to help cool your brain and keep you alert, and our brains mimic others to show empathy!",
            "parent_explanation": "Yawning ventilates the lungs and increases blood flow to cool the brain. Contagious yawning is linked to mirror neurons and social empathy."
        },
        "stem_9yo": {
            "topic": "Everyday Science",
            "question": "Why does hot water freeze faster than cold water under certain freezer conditions (the Mpemba effect)?",
            "hint": "Evaporation and rapid convection currents help heat escape faster from hot water.",
            "answer": "Hot water evaporates faster (reducing total mass) and develops stronger convection currents, allowing heat to escape rapidly in the freezer.",
            "parent_explanation": "Named after Tanzanian student Erasto Mpemba, this phenomenon involves rapid evaporation and temperature gradients accelerating heat loss."
        }
    },
    # Day 21
    {
        "word_of_the_day": {
            "word": "Renewable",
            "pronunciation": "ree-NOO-uh-bul",
            "part_of_speech": "adjective",
            "definition": "Capable of being replenished naturally over time, like energy from the sun, wind, or flowing water.",
            "example": "Solar panels and modern wind turbines produce clean renewable electricity every day."
        },
        "fun_fact": {
            "fact": "In just one single hour, the Sun shines enough energy onto Earth to power the entire world's electricity needs for a whole year!",
            "category": "Green Energy",
            "emoji": "☀️",
            "did_you_know": "Wind power is actually another form of solar energy, because the Sun's uneven heating of Earth creates wind currents."
        },
        "stem_5yo": {
            "topic": "Sun & Energy",
            "question": "How do black shiny solar panels make electricity when placed on a sunny roof?",
            "hint": "They catch sunlight photons and convert them into electrical power!",
            "answer": "Light particles from the Sun knock tiny electrons loose inside the silicon panels, creating an electric current.",
            "parent_explanation": "This is the photovoltaic effect. Silicon semiconductors absorb sunlight energy, freeing electrons to flow through wires as electricity."
        },
        "stem_9yo": {
            "topic": "Semiconductors & Physics",
            "question": "What happens inside a photovoltaic silicon cell at the atomic level when a photon strikes it?",
            "hint": "Think about P-N semiconductor junctions creating a built-in electric field.",
            "answer": "Photons with energy greater than the silicon bandgap excite electrons from the valence to conduction band, where a P-N junction directs their flow.",
            "parent_explanation": "Doping silicon with phosphorus (N-type) and boron (P-type) creates a depletion zone electric field that separates electron-hole pairs into usable current."
        }
    },
    # Day 22
    {
        "word_of_the_day": {
            "word": "Chronological",
            "pronunciation": "kron-oh-LOJ-ih-kul",
            "part_of_speech": "adjective",
            "definition": "Arranged in the exact order of time that events happened, from earliest to latest.",
            "example": "The family photo album was organized in chronological order from baby photos to 4th grade."
        },
        "fun_fact": {
            "fact": "It takes Earth 365.2422 days to orbit the Sun, which is why we add a Leap Day (February 29) every four years to keep our calendar in sync!",
            "category": "Time & Astronomy",
            "emoji": "⏱️",
            "did_you_know": "If we did not have leap years, our seasons would drift by about 24 days every 100 years."
        },
        "stem_5yo": {
            "topic": "Sun & Time",
            "question": "How did people tell the time of day thousands of years ago before clocks and batteries were invented?",
            "hint": "They watched the position of shadows cast by the Sun on the ground!",
            "answer": "They used sundials! As the Sun moved across the sky, a stick cast a shadow that pointed to different hour marks.",
            "parent_explanation": "Earth's daily rotation causes shadows to move in a predictable clockwise circle throughout daylight hours."
        },
        "stem_9yo": {
            "topic": "Piezoelectricity & Clocks",
            "question": "Why do modern battery watches have a tiny quartz crystal inside, and how does it keep precise time?",
            "hint": "When you apply electricity to quartz, it vibrates at a fixed frequency of exactly 32,768 times per second.",
            "answer": "Quartz exhibits the piezoelectric effect. A battery causes it to oscillate at exactly 32,768 Hz, which an electronic circuit divides by 2 fifteen times for 1-second pulses.",
            "parent_explanation": "Because 2¹⁵ = 32,768, simple binary frequency divider flip-flops count 32,768 oscillations into an accurate 1.0-second tick."
        }
    },
    # Day 23
    {
        "word_of_the_day": {
            "word": "Monumental",
            "pronunciation": "mon-yuh-MEN-tul",
            "part_of_speech": "adjective",
            "definition": "Great in importance, size, or historical significance.",
            "example": "The invention of the printing press was a monumental moment that helped people everywhere learn to read."
        },
        "fun_fact": {
            "fact": "Before the printing press was invented, every single book had to be written by hand, which could take a scribe a whole year for one book!",
            "category": "History of Books",
            "emoji": "📚",
            "did_you_know": "Johannes Gutenberg's movable metal type in the 1440s allowed hundreds of book pages to be printed in a single afternoon."
        },
        "stem_5yo": {
            "topic": "Everyday Inventions",
            "question": "Why are school buses painted bright yellowish-orange instead of red or blue?",
            "hint": "Our eyes notice this color faster than almost any other in our side vision!",
            "answer": "Human eyes spot that special yellow color in their peripheral vision faster than any other color, keeping kids safe in traffic!",
            "parent_explanation": "Formulated in 1939 as 'National School Bus Glossy Yellow', this hue stimulates both red and green photoreceptors, making it instantly noticeable."
        },
        "stem_9yo": {
            "topic": "Optics & Vision",
            "question": "Why can you see your reflection clearly in a smooth mirror, but not in a sheet of white paper even though paper reflects light?",
            "hint": "Smooth surfaces bounce light rays in parallel, while rough surfaces scatter them in all directions.",
            "answer": "A mirror creates specular reflection (parallel rays bounce in unison), while rough paper fibers create diffuse reflection (rays scatter in all directions).",
            "parent_explanation": "Specular reflection preserves wavefront angles so an image forms. Diffuse scattering scrambles angle information into uniform white glare."
        }
    },
    # Day 24
    {
        "word_of_the_day": {
            "word": "Perennial",
            "pronunciation": "puh-REN-ee-ul",
            "part_of_speech": "adjective",
            "definition": "Lasting for a long time or continually recurring year after year (like plants that bloom every spring).",
            "example": "Tulips and apple trees are perennial plants that come back to life every spring without replanting."
        },
        "fun_fact": {
            "fact": "The oldest living tree on Earth is a Bristlecone Pine named Methuselah in California, estimated to be over 4,850 years old!",
            "category": "Botany & Nature",
            "emoji": "🌲",
            "did_you_know": "Methuselah was already hundreds of years old when the ancient Egyptian pyramids were being constructed."
        },
        "stem_5yo": {
            "topic": "Trees & Nature",
            "question": "How can you tell how many years old a tree is just by looking at a cut stump?",
            "hint": "Look at the circles inside the wood!",
            "answer": "You count the tree rings! Every year, the tree grows one new light ring in spring and one dark ring in summer.",
            "parent_explanation": "In spring, rapid growth creates wide light wood; in late summer, slower growth makes dense dark wood, forming one complete annual ring."
        },
        "stem_9yo": {
            "topic": "Biochemistry & Photosynthesis",
            "question": "Where does a massive 10-ton oak tree get almost all of its physical wood mass as it grows from a tiny acorn?",
            "hint": "The mass does not come from soil dirt—it comes out of thin air!",
            "answer": "From carbon dioxide in the air! During photosynthesis, the tree uses sunlight to bond carbon atoms from atmospheric CO₂ into solid cellulose wood.",
            "parent_explanation": "Plants take carbon dioxide (CO₂) and water (H₂O) and synthesize glucose (C₆H₁₂O₆) and cellulose. The tree is built from air and light."
        }
    },
    # Day 25
    {
        "word_of_the_day": {
            "word": "Abyssal",
            "pronunciation": "uh-BIS-ul",
            "part_of_speech": "adjective",
            "definition": "Relating to the vast, pitch-black ocean depths thousands of feet below the surface.",
            "example": "Submersibles exploring the abyssal ocean floor discovered strange blind crabs living near thermal vents."
        },
        "fun_fact": {
            "fact": "The Mariana Trench is the deepest place on Earth at nearly 36,000 feet deep—Mount Everest could fit inside with 7,000 feet of water above it!",
            "category": "Deep Ocean",
            "emoji": "🌊",
            "did_you_know": "The water pressure at the bottom of the trench is over 1,000 times greater than at sea level, equal to having 50 jumbo jets resting on top of you."
        },
        "stem_5yo": {
            "topic": "Ocean Depths",
            "question": "Why is it completely pitch black at the bottom of the deep ocean even at noon on a sunny day?",
            "hint": "Water absorbs and scatters sunlight as it travels downward!",
            "answer": "Sunlight can only penetrate about 600 feet into clear ocean water before it is completely absorbed by the water.",
            "parent_explanation": "Water molecules absorb red, yellow, and green light in the top layers, leaving the deep ocean in permanent total darkness."
        },
        "stem_9yo": {
            "topic": "Geomicrobiology & Chemosynthesis",
            "question": "How do rich biological communities thrive around deep-sea hydrothermal vents where there is zero sunlight for photosynthesis?",
            "hint": "Bacteria convert toxic sulfur chemicals boiling out of vents into food energy without sunlight.",
            "answer": "Chemosynthetic bacteria oxidize toxic hydrogen sulfide escaping from hydrothermal vents to synthesize organic carbohydrates without sunlight.",
            "parent_explanation": "Chemosynthesis replaces sunlight with chemical energy. Giant tube worms and vent crabs depend on symbiotic bacteria living in their tissues."
        }
    },
    # Day 26
    {
        "word_of_the_day": {
            "word": "Celestial",
            "pronunciation": "suh-LES-chul",
            "part_of_speech": "adjective",
            "definition": "Belonging or relating to the sky, outer space, stars, and planets.",
            "example": "The astronomy club set up telescopes on the hill to observe celestial events like meteor showers."
        },
        "fun_fact": {
            "fact": "A 'shooting star' is not a star at all—it is a tiny speck of space dust or rock burning up as it streaks into Earth's atmosphere!",
            "category": "Astronomy",
            "emoji": "🌠",
            "did_you_know": "Most meteors that make brilliant streaks of light across the night sky are no bigger than a single grain of sand."
        },
        "stem_5yo": {
            "topic": "Night Sky",
            "question": "Why do stars seem to twinkle in the night sky while planets shine with steady light?",
            "hint": "Starlight passes through moving layers of Earth's atmosphere!",
            "answer": "Starlight travels through shifting pockets of warm and cold air in our atmosphere, bending the tiny beam back and forth.",
            "parent_explanation": "Because stars are points of light billions of miles away, moving air shifts their ray. Planets are closer discs that average out flickering."
        },
        "stem_9yo": {
            "topic": "Nuclear Physics & Stars",
            "question": "What is the nuclear reaction at the core of the Sun that has powered it for 4.6 billion years without burning up?",
            "hint": "Extreme gravitational pressure fuses light hydrogen atoms together into helium.",
            "answer": "Nuclear fusion (the proton-proton chain reaction), where high pressure and temperature fuse four hydrogen nuclei into one helium nucleus, releasing energy (E=mc²).",
            "parent_explanation": "Because a helium nucleus has slightly less mass than four separate protons, the missing mass is converted into radiant photons according to Einstein's equation."
        }
    },
    # Day 27
    {
        "word_of_the_day": {
            "word": "Enchanting",
            "pronunciation": "en-CHANT-ing",
            "part_of_speech": "adjective",
            "definition": "Delightfully charming, captivating, or full of magical wonder.",
            "example": "The animated movie had an enchanting story about friendly woodland animals."
        },
        "fun_fact": {
            "fact": "Walt Disney animators brought real deer into the studio so artists could study their gentle movements and draw Bambi realistically!",
            "category": "Animation Lore",
            "emoji": "🦌",
            "did_you_know": "Mickey Mouse was originally named 'Mortimer' until Walt's wife Lillian suggested that 'Mickey' sounded much friendlier and cuter."
        },
        "stem_5yo": {
            "topic": "Everyday Curiosities",
            "question": "Why do shoelaces suddenly untie themselves when you are running, even when you tied a double knot?",
            "hint": "Your foot hitting the ground and swinging forward creates a double force on the knot!",
            "answer": "Stamping your foot loosens the knot, and your swinging leg whips the loose ends back and forth until the knot slips open!",
            "parent_explanation": "Foot impacts create forces up to 7G that loosen the central knot, while swinging legs whip free lace ends until they slip."
        },
        "stem_9yo": {
            "topic": "Movie Technology",
            "question": "How does a movie green screen let filmmakers place actors on alien planets or floating in outer space?",
            "hint": "A computer replaces a specific pure green color hue with a different video background.",
            "answer": "Through chroma key compositing: software isolates the pure green background and makes it transparent, layering the actor over new footage.",
            "parent_explanation": "Green is chosen because human skin tones contain virtually no green pigment, and digital camera sensors have twice as many green photosites."
        }
    },
    # Day 28
    {
        "word_of_the_day": {
            "word": "Hydrological",
            "pronunciation": "hy-druh-LOJ-ih-kul",
            "part_of_speech": "adjective",
            "definition": "Relating to the movement, distribution, and properties of water across the Earth.",
            "example": "The hydrological cycle describes how water constantly moves between oceans, clouds, and rainfall."
        },
        "fun_fact": {
            "fact": "The water you drank today is the exact same water that dinosaurs drank 100 million years ago—water is continuously recycled by Earth!",
            "category": "Earth Science",
            "emoji": "💧",
            "did_you_know": "Earth's total amount of water never increases or decreases; it just endlessly transforms between liquid, ice, and vapor."
        },
        "stem_5yo": {
            "topic": "Water & Clouds",
            "question": "Where do puddles on the sidewalk go on a sunny afternoon after the rain stops?",
            "hint": "The Sun warms the puddle and turns the liquid into invisible vapor in the air!",
            "answer": "The puddle evaporates! The warm Sun turns liquid water into invisible gas (water vapor) that floats up into the sky to form clouds.",
            "parent_explanation": "Thermal energy from sunlight accelerates water molecules until they escape liquid bonds and become atmospheric water vapor."
        },
        "stem_9yo": {
            "topic": "Thermodynamics & Dew Point",
            "question": "Why do tiny water droplets condense on the outside of a cold glass of lemonade on a warm humid summer day?",
            "hint": "Cold air holds less water vapor than warm air.",
            "answer": "Warm humid air touching the cold glass drops below its dew point temperature, causing excess water vapor to condense into liquid droplets.",
            "parent_explanation": "Cold surfaces cool adjacent air. Because saturation vapor pressure decreases with temperature, excess humidity precipitates out as condensation."
        }
    },
    # Day 29
    {
        "word_of_the_day": {
            "word": "Architectural",
            "pronunciation": "ar-kih-TEK-chur-ul",
            "part_of_speech": "adjective",
            "definition": "Relating to the design, engineering, and construction of buildings and complex structures.",
            "example": "Beavers demonstrate amazing architectural skills when building sturdy wood dams across rushing streams."
        },
        "fun_fact": {
            "fact": "Beavers are nature's master engineers—the largest beaver dam on Earth in northern Alberta is over half a mile long and visible from space!",
            "category": "Animal Builders",
            "emoji": "🦫",
            "did_you_know": "Beaver teeth are orange because they contain iron minerals, making them strong enough to chop down full-grown trees."
        },
        "stem_5yo": {
            "topic": "Animal Homes",
            "question": "Why do beavers build dams and lodges in the middle of ponds with underwater entrances?",
            "hint": "Predators like wolves and bears cannot dive underwater into their warm wood houses!",
            "answer": "Underwater entrances keep beavers safe inside their lodges because dangerous predators cannot swim underwater into their living room.",
            "parent_explanation": "Beavers create deep, quiet ponds that do not freeze solid to the bottom in winter, providing safe food storage and shelter."
        },
        "stem_9yo": {
            "topic": "Structural Engineering & Arches",
            "question": "Why are curved stone arches able to span wide bridges without using steel beams or cement glue?",
            "hint": "The arch distributes all gravitational weight into pure compressive force pushing outward against supporting abutments.",
            "answer": "An arch converts vertical gravitational loads into lateral compressive forces, locking wedge-shaped stones (voussoirs) tighter against the central keystone.",
            "parent_explanation": "Stone has immense compressive strength but weak tensile strength. Arches eliminate tension by keeping every stone in continuous compression."
        }
    },
    # Day 30
    {
        "word_of_the_day": {
            "word": "Spectrum",
            "pronunciation": "SPEK-trum",
            "part_of_speech": "noun",
            "definition": "A continuous band of colors or waves produced when white light is separated, or a broad range of related qualities.",
            "example": "Passing sunlight through a glass triangular prism projected a vivid rainbow spectrum on the classroom wall."
        },
        "fun_fact": {
            "fact": "Visible light is just a tiny fraction of the electromagnetic spectrum—other waves include radio waves, microwaves, X-rays, and infrared heat!",
            "category": "Optics & Physics",
            "emoji": "🌈",
            "did_you_know": "Reindeer and bees can see ultraviolet light that is completely invisible to human eyes."
        },
        "stem_5yo": {
            "topic": "Light & Colors",
            "question": "Why does a red apple look red when white sunlight shines on it?",
            "hint": "The apple absorbs all the other rainbow colors and bounces only red light back into your eyes!",
            "answer": "The skin of the apple absorbs blue, green, and yellow light, reflecting only red light rays into your eyes.",
            "parent_explanation": "Objects appear colored because pigments absorb specific wavelengths of white light and reflect the rest."
        },
        "stem_9yo": {
            "topic": "Spectroscopy & Astronomy",
            "question": "How can astronomers determine the exact chemical elements inside a star trillions of miles away just by looking at its light?",
            "hint": "Every chemical element absorbs and emits light at unique barcode-like dark spectral lines (Fraunhofer lines).",
            "answer": "Through stellar spectroscopy: atoms in the star's outer atmosphere absorb specific photon wavelengths, creating a unique absorption line 'barcode'.",
            "parent_explanation": "Electrons transition between discrete quantum energy levels. Each element (hydrogen, helium, iron) has a unique spectral fingerprint."
        }
    },
    # Day 31
    {
        "word_of_the_day": {
            "word": "Gravitational",
            "pronunciation": "grav-ih-TAY-shun-ul",
            "part_of_speech": "adjective",
            "definition": "Relating to the invisible universal force of attraction that pulls objects with mass toward one another.",
            "example": "The Moon's gravitational pull on Earth's oceans causes the rising and falling tides every day."
        },
        "fun_fact": {
            "fact": "If you could stand on the giant surface of Jupiter, you would weigh more than twice as much as you do on Earth because of Jupiter's immense gravity!",
            "category": "Physics & Space",
            "emoji": "🌍",
            "did_you_know": "On the Moon, gravity is only one-sixth as strong as Earth, allowing astronauts in heavy spacesuits to leap high into the air."
        },
        "stem_5yo": {
            "topic": "Gravity & Oceans",
            "question": "Why does ocean water rise up high on beaches twice every day (high tide)?",
            "hint": "The Moon in the sky is pulling on Earth's water like an invisible magnet!",
            "answer": "The Moon's gravity pulls on Earth's ocean water, creating a bulge of water that rises as a high tide as Earth spins.",
            "parent_explanation": "Gravitational tidal forces from the Moon and Sun stretch Earth's oceans into two opposing bulges, creating two high tides daily."
        },
        "stem_9yo": {
            "topic": "General Relativity & Spacetime",
            "question": "How did Albert Einstein change our understanding of gravity from a mysterious pulling force to a curvature of space and time?",
            "hint": "Imagine placing a heavy bowling ball onto a stretched rubber trampoline sheet.",
            "answer": "Einstein's General Relativity showed that mass and energy warp the fabric of 4D spacetime; planets follow straight lines through this curved spacetime.",
            "parent_explanation": "Mass tells spacetime how to curve, and curved spacetime tells mass how to move. What we feel as gravity is inertia moving through warped geometry."
        }
    },
]

KIDS_CATEGORIES: List[str] = [
    subdomain
    for subdomains in CURRICULUM_PILLARS.values()
    for subdomain in subdomains
]

SETTINGS_DB_KEY = "kids_daily_settings"
DECK_DB_KEY = "kids_nugget_deck_state"
MIGRATED_DB_KEY = "kids_daily_json_migrated_v2"

# Models actually served by the local LiteLLM gateway (in priority order; flash-lite is absolute last resort)
LITELLM_MODELS_PRIORITY = [
    "gemini-3.8-flash",
    "gemini-flash",
    "gemini-2.5-flash",
    "gemini-3.5-flash-lite",
]

DIRECT_GEMINI_MODELS_PRIORITY = [
    "gemini-2.5-flash",
    "gemini-flash-latest",
]

EPHEMERAL_FALLBACK_TTL_SECONDS = 300.0
SEMANTIC_SIMILARITY_THRESHOLD = 0.78
LEXICAL_SIMILARITY_THRESHOLD = 0.34
SAME_DAY_LEXICAL_THRESHOLD = 0.30
SAME_DAY_SEMANTIC_THRESHOLD = 0.72


def _section_summary(section_name: str, sec: Dict[str, Any]) -> str:
    if section_name == "word_of_the_day":
        return " ".join(str(sec.get(k, "")).strip() for k in ("word", "definition", "example") if sec.get(k))
    if section_name == "fun_fact":
        return " ".join(str(sec.get(k, "")).strip() for k in ("category", "fact", "did_you_know") if sec.get(k))
    return " ".join(str(sec.get(k, "")).strip() for k in ("topic", "question", "answer") if sec.get(k))


def _strip_internal_fields(bundle: Dict[str, Any]) -> Dict[str, Any]:
    """Return a clean display copy while keeping canonical `subject_key` metadata inside stored JSON."""
    cleaned: Dict[str, Any] = {}
    for sec_name, limits in KIDS_DAILY_DISPLAY_LIMITS.items():
        raw_sec = bundle.get(sec_name) or {}
        cleaned_sec: Dict[str, Any] = {}
        for k in limits:
            if k in raw_sec and raw_sec[k] is not None:
                cleaned_sec[k] = str(raw_sec[k]).strip()
        if "subject_key" in raw_sec and raw_sec["subject_key"]:
            cleaned_sec["subject_key"] = str(raw_sec["subject_key"]).strip()[:48]
        cleaned[sec_name] = cleaned_sec
    if "generated_by" in bundle:
        cleaned["generated_by"] = bundle["generated_by"]
    return cleaned


class KidsDailyService:
    def __init__(self, session_factory: Optional[Callable[[], Any]] = None):
        self._session_factory = session_factory or SessionLocal
        self._cache: Dict[str, Any] = {}
        self._ephemeral_fallback: Dict[str, tuple[float, Dict[str, Any]]] = {}
        self._settings: Dict[str, Any] = self._default_settings()
        self._lock = threading.RLock()
        self._initialized = False
        self._backfill_started = False

    @staticmethod
    def _default_settings() -> Dict[str, Any]:
        return {
            "force_banner_active": False,
            "gemini_api_key": "",
            "gemini_model": "",
            "age_groups": [5, 9],
            "kid_birthdays": ["", ""],  # Optional ["YYYY-MM", "YYYY-MM"] for automatic birthday aging
            "interests": [],
        }

    def set_session_factory(self, session_factory: Callable[[], Any]) -> None:
        with self._lock:
            self._session_factory = session_factory
            self._initialized = False
            self._ephemeral_fallback.clear()

    def _ensure_initialized(self) -> None:
        if self._initialized:
            return
        with self._lock:
            if self._initialized:
                return
            try:
                with self._session_factory() as db:
                    bind = db.get_bind()
                    Base.metadata.create_all(bind)

                    saved_settings = db.get(Setting, SETTINGS_DB_KEY)
                    if saved_settings and isinstance(saved_settings.value, dict):
                        self._settings = {**self._default_settings(), **saved_settings.value}

                    migrated_flag = db.get(Setting, MIGRATED_DB_KEY)
                    if not migrated_flag or migrated_flag.value != "1":
                        self._migrate_json_history(db)
                        db.merge(Setting(key=MIGRATED_DB_KEY, value="1"))
                        db.commit()

                self._initialized = True
                self._maybe_start_embedding_backfill()
            except Exception as e:
                logger.warning("Failed to initialize kids daily SQLite store: %s", e)
                self._initialized = True

    def _migrate_json_history(self, db: Any) -> None:
        """One-time import of legacy kids_daily.json into SQLite lifetime ledger and editions."""
        target_file = _get_kids_daily_file()
        if not target_file.exists():
            return
        try:
            raw = json.loads(target_file.read_text(encoding="utf-8"))
        except Exception as e:
            logger.warning("Could not parse legacy kids_daily.json during migration: %s", e)
            return

        legacy_settings = raw.get("settings")
        if isinstance(legacy_settings, dict):
            merged = {**self._default_settings(), **legacy_settings, **{k: v for k, v in self._settings.items() if v}}
            # Preserve explicit boolean force_banner_active from legacy file if DB settings didn't exist yet
            if db.get(Setting, SETTINGS_DB_KEY) is None:
                merged["force_banner_active"] = bool(legacy_settings.get("force_banner_active", False))
                merged["gemini_api_key"] = str(legacy_settings.get("gemini_api_key", "")).strip()
                merged["gemini_model"] = str(legacy_settings.get("gemini_model", "")).strip()
                if isinstance(legacy_settings.get("age_groups"), list) and len(legacy_settings["age_groups"]) >= 2:
                    merged["age_groups"] = [int(x) for x in legacy_settings["age_groups"][:2]]
                if isinstance(legacy_settings.get("interests"), list):
                    merged["interests"] = list(legacy_settings["interests"])
            self._settings = merged
            db.merge(Setting(key=SETTINGS_DB_KEY, value=self._settings))

        days_map = raw.get("days")
        if not isinstance(days_map, dict):
            return

        imported_editions = 0
        imported_ledger = 0
        for d_str, bundle in sorted(days_map.items()):
            if not isinstance(bundle, dict):
                continue
            try:
                date.fromisoformat(d_str)
            except ValueError:
                continue

            # Record EVERY historical day (both AI and offline_catalog) into KidsConceptLedger
            # so words/facts/questions already seen by the family are retired permanently.
            existing_ledger = (
                db.query(KidsConceptLedger.id)
                .filter(KidsConceptLedger.date_str == d_str)
                .first()
            )
            if not existing_ledger:
                self._append_ledger_rows(db, d_str, bundle, assignment=None, embeddings={})
                imported_ledger += 1

            # Only persist genuine AI bundles into KidsDailyEdition; leave `offline_catalog`
            # days out of KidsDailyEdition so today automatically upgrades to AI on startup!
            gen_by = str(bundle.get("generated_by", ""))
            if gen_by.startswith("gemini_ai") and content_fits_display_limits(bundle):
                if db.get(KidsDailyEdition, d_str) is None:
                    db.add(
                        KidsDailyEdition(
                            date_str=d_str,
                            content=_strip_internal_fields(bundle),
                            generated_by=gen_by,
                        )
                    )
                    imported_editions += 1

        if imported_editions or imported_ledger:
            logger.info(
                "Migrated kids_daily.json history into SQLite: %d AI editions, %d days indexed in concept ledger",
                imported_editions,
                imported_ledger,
            )

    def _save_settings(self) -> None:
        self._ensure_initialized()
        try:
            with self._session_factory() as db:
                db.merge(Setting(key=SETTINGS_DB_KEY, value=dict(self._settings)))
                db.commit()
        except Exception as e:
            logger.error("Failed to save kids daily settings to SQLite: %s", e)

    # ------------------------------------------------------------------
    # Active Display Windows & Dynamic Kid Ages
    # ------------------------------------------------------------------
    def get_active_window_name(self, now: Optional[datetime] = None) -> str:
        """
        Return the name of the active display window ('morning' or 'afternoon'),
        or '' if outside active hours.
        - Weekdays (Mon-Fri): 6:00 AM - 8:00 AM (morning), 3:15 PM - 7:00 PM (afternoon)
        - Weekends (Sat-Sun): 9:00 AM - 11:00 AM (morning), 3:15 PM - 7:00 PM (afternoon)
        """
        self._ensure_initialized()
        if self._settings.get("force_banner_active", False):
            return "forced"

        current = now or datetime.now(ZoneInfo(get_settings().tz))
        is_weekend = current.weekday() >= 5
        minute_of_day = current.hour * 60 + current.minute

        # Afternoon window: 3:15 PM (15:15 = 915) to 7:00 PM (19:00 = 1140)
        if 15 * 60 + 15 <= minute_of_day < 19 * 60:
            return "afternoon"

        # Morning window
        if is_weekend:
            if 9 * 60 <= minute_of_day < 11 * 60:
                return "morning"
        else:
            if 6 * 60 <= minute_of_day < 8 * 60:
                return "morning"

        return ""

    def is_active_morning_window(self, now: Optional[datetime] = None) -> bool:
        return bool(self.get_active_window_name(now))

    def get_effective_ages(self, ref_date: Optional[date] = None) -> List[int]:
        """Compute current [younger_age, older_age], auto-incrementing on birthdays when `kid_birthdays` ('YYYY-MM') is set."""
        self._ensure_initialized()
        target_d = ref_date or datetime.now(ZoneInfo(get_settings().tz)).date()
        configured = self._settings.get("age_groups") or [5, 9]
        base_ages = [
            int(configured[0]) if len(configured) >= 1 else 5,
            int(configured[1]) if len(configured) >= 2 else 9,
        ]
        birthdays = self._settings.get("kid_birthdays") or ["", ""]
        computed: List[int] = []
        for idx in range(2):
            bday = str(birthdays[idx]).strip() if idx < len(birthdays) and birthdays[idx] else ""
            m = re.fullmatch(r"(\d{4})-(0[1-9]|1[0-2])", bday)
            if m:
                byear, bmonth = int(m.group(1)), int(m.group(2))
                age = target_d.year - byear - (1 if target_d.month < bmonth else 0)
                computed.append(max(3, min(18, age)))
            else:
                computed.append(max(3, min(18, base_ages[idx])))
        return computed

    # ------------------------------------------------------------------
    # LiteLLM / Gemini Credential & Model Resolution
    # ------------------------------------------------------------------
    def _resolve_ai_config(self) -> Dict[str, Any]:
        """
        Resolve effective base_url, ordered API keys, and ordered model names.
        Prevents stale pre-LiteLLM UI keys (e.g. 'AQ.Ab8...') or unserved legacy
        model names ('gemini-3.5-flash') from breaking LiteLLM gateway calls.
        """
        s = get_settings()
        base_url = (
            s.gemini_base_url
            or os.environ.get("GEMINI_BASE_URL")
            or os.environ.get("LITELLM_BASE_URL")
            or ""
        ).strip()
        custom_key = str(self._settings.get("gemini_api_key") or "").strip()
        env_key = str(s.gemini_api_key or os.environ.get("GEMINI_API_KEY") or "").strip()
        custom_model = str(self._settings.get("gemini_model") or "").strip()
        env_model = str(s.gemini_model or os.environ.get("GEMINI_MODEL") or "").strip()

        if base_url:
            # LiteLLM virtual keys start with 'sk-'. Ignore legacy direct Google keys ('AIza...', 'AQ....').
            keys: List[str] = []
            key_source = "none"
            if custom_key and custom_key.startswith("sk-"):
                keys.append(custom_key)
                key_source = "custom_litellm"
            if env_key and env_key not in keys:
                keys.append(env_key)
                if key_source == "none":
                    key_source = "litellm_env"

            raw_models: List[str] = []
            if custom_model in LITELLM_MODELS_PRIORITY:
                raw_models.append(custom_model)
            # Always lead with gemini-3.8-flash (strongest Flash model on LiteLLM) unless overridden above
            for m in LITELLM_MODELS_PRIORITY:
                if m not in raw_models:
                    raw_models.append(m)
            if env_model and env_model in LITELLM_MODELS_PRIORITY and env_model not in raw_models:
                raw_models.insert(1, env_model)

            return {
                "base_url": base_url.rstrip("/"),
                "api_keys": keys,
                "models": raw_models,
                "key_source": key_source,
                "is_litellm": True,
            }

        keys = [k for k in dict.fromkeys([custom_key, env_key]) if k]
        key_source = "custom_key" if custom_key else ("env_key" if env_key else "none")
        models = [
            m
            for m in dict.fromkeys([custom_model, env_model, *DIRECT_GEMINI_MODELS_PRIORITY])
            if m and not m.startswith("gemini-3.7") and not m.startswith("gemini-3.6")
        ]
        return {
            "base_url": "",
            "api_keys": keys,
            "models": models or ["gemini-2.5-flash"],
            "key_source": key_source,
            "is_litellm": False,
        }

    def get_stats(self) -> Dict[str, int]:
        self._ensure_initialized()
        try:
            with self._session_factory() as db:
                total_editions = db.query(KidsDailyEdition).count()
                unique_words = (
                    db.query(KidsConceptLedger.word_norm)
                    .filter(KidsConceptLedger.word_norm != "")
                    .distinct()
                    .count()
                )
                unique_concepts = (
                    db.query(KidsConceptLedger.subject_key)
                    .filter(KidsConceptLedger.subject_key != "")
                    .distinct()
                    .count()
                )
                return {
                    "total_editions": total_editions,
                    "unique_words": unique_words,
                    "unique_concepts": unique_concepts,
                }
        except Exception:
            return {"total_editions": 0, "unique_words": 0, "unique_concepts": 0}

    def get_settings(self) -> Dict[str, Any]:
        self._ensure_initialized()
        ai_cfg = self._resolve_ai_config()
        effective_key = ai_cfg["api_keys"][0] if ai_cfg["api_keys"] else ""
        masked = (
            f"{effective_key[:5]}...{effective_key[-4:]}"
            if effective_key and len(effective_key) > 10
            else ("Configured" if effective_key else "")
        )
        return {
            "force_banner_active": bool(self._settings.get("force_banner_active", False)),
            "has_gemini_api_key": bool(effective_key),
            "gemini_api_key_masked": masked,
            "key_source": ai_cfg["key_source"],
            "is_litellm": ai_cfg["is_litellm"],
            "gemini_model": ai_cfg["models"][0] if ai_cfg["models"] else "gemini-3.8-flash",
            "age_groups": self.get_effective_ages(),
            "configured_age_groups": list(self._settings.get("age_groups") or [5, 9]),
            "kid_birthdays": list(self._settings.get("kid_birthdays") or ["", ""]),
            "interests": list(self._settings.get("interests") or []),
            "stats": self.get_stats(),
        }

    def update_settings(self, new_settings: Dict[str, Any]) -> Dict[str, Any]:
        self._ensure_initialized()
        with self._lock:
            if "force_banner_active" in new_settings and new_settings["force_banner_active"] is not None:
                self._settings["force_banner_active"] = bool(new_settings["force_banner_active"])
            if "gemini_api_key" in new_settings and new_settings["gemini_api_key"] is not None:
                self._settings["gemini_api_key"] = str(new_settings["gemini_api_key"]).strip()
            if "gemini_model" in new_settings and new_settings["gemini_model"] is not None:
                self._settings["gemini_model"] = str(new_settings["gemini_model"]).strip()
            if "age_groups" in new_settings and isinstance(new_settings["age_groups"], list):
                cleaned_ages = [max(3, min(18, int(age))) for age in new_settings["age_groups"][:2]]
                if len(cleaned_ages) == 1:
                    cleaned_ages.append(max(cleaned_ages[0] + 1, 9))
                if len(cleaned_ages) >= 2:
                    self._settings["age_groups"] = cleaned_ages[:2]
            if "kid_birthdays" in new_settings and isinstance(new_settings["kid_birthdays"], list):
                bdays: List[str] = []
                for item in (new_settings["kid_birthdays"] + ["", ""])[:2]:
                    s_val = str(item or "").strip()
                    bdays.append(s_val if re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", s_val) else "")
                self._settings["kid_birthdays"] = bdays
            if "interests" in new_settings and isinstance(new_settings["interests"], list):
                self._settings["interests"] = [
                    str(item).strip()[:40] for item in new_settings["interests"] if str(item).strip()
                ][:12]
            self._save_settings()

        manager.broadcast_threadsafe("kids_daily")
        return self.get_settings()

    # ------------------------------------------------------------------
    # Public Retrieval & Scheduled Pre-Generation
    # ------------------------------------------------------------------
    def get_today_payload(self, date_str: Optional[str] = None, force_regenerate: bool = False) -> Dict[str, Any]:
        self._ensure_initialized()
        try:
            default_today = datetime.now(ZoneInfo(get_settings().tz)).date()
            target_date = date.fromisoformat(date_str) if date_str else default_today
            today_key = target_date.isoformat()
        except (TypeError, ValueError):
            raise ValueError("date must be ISO-8601 (YYYY-MM-DD)")

        broadcast_needed = False
        with self._lock:
            content = None
            if not force_regenerate:
                # 1. Check persisted SQLite edition first
                content = self._load_persisted_edition(today_key)
                # 2. Check in-memory mirror cache (only if AI-generated)
                if not content:
                    mem = self._cache.get(today_key)
                    if mem and str(mem.get("generated_by", "")).startswith("gemini_ai") and content_fits_display_limits(mem):
                        content = mem
                # 3. Check short-lived ephemeral fallback cooldown so we don't hammer an unreachable server
                if not content:
                    eph = self._ephemeral_fallback.get(today_key)
                    if eph and time.monotonic() < eph[0]:
                        content = eph[1]

            if not content:
                content = self._generate_daily_content(today_key, force_advance_deck=force_regenerate)
                if str(content.get("generated_by", "")).startswith("gemini_ai"):
                    self._persist_ai_edition(today_key, content)
                    self._cache[today_key] = content
                    self._ephemeral_fallback.pop(today_key, None)
                    broadcast_needed = True
                else:
                    # Ephemeral fallback ONLY — never lock offline_catalog into SQLite!
                    self._ephemeral_fallback[today_key] = (
                        time.monotonic() + EPHEMERAL_FALLBACK_TTL_SECONDS,
                        content,
                    )
                    self._cache[today_key] = content

        if broadcast_needed:
            manager.broadcast_threadsafe("kids_daily")

        is_active = self.is_active_morning_window()
        active_window = self.get_active_window_name()
        return {
            "date": today_key,
            "is_active_window": is_active,
            "active_window": active_window,
            "force_active": bool(self._settings.get("force_banner_active", False)),
            "age_groups": self.get_effective_ages(target_date),
            "content": content,
        }

    def ensure_upcoming_editions(self, include_tomorrow: bool = False) -> None:
        """Background pre-warm / self-healing pass invoked by APScheduler."""
        self._ensure_initialized()
        tz = ZoneInfo(get_settings().tz)
        now_local = datetime.now(tz)
        targets = [now_local.date()]
        if include_tomorrow or now_local.hour >= 20:
            targets.append(now_local.date() + timedelta(days=1))

        for target_d in targets:
            d_key = target_d.isoformat()
            if self._load_persisted_edition(d_key) is not None:
                continue
            try:
                # Bypass ephemeral cooldown during scheduled heal if AI is configured
                with self._lock:
                    self._ephemeral_fallback.pop(d_key, None)
                payload = self.get_today_payload(date_str=d_key, force_regenerate=False)
                gen_by = payload.get("content", {}).get("generated_by", "")
                logger.info("Scheduled kids daily ensure for %s completed (%s)", d_key, gen_by)
            except Exception as e:
                logger.warning("Scheduled kids daily pre-warm failed for %s: %s", d_key, e)

    # ------------------------------------------------------------------
    # SQLite Edition & Ledger Persistence + Embeddings
    # ------------------------------------------------------------------
    def _load_persisted_edition(self, date_str: str) -> Optional[Dict[str, Any]]:
        try:
            with self._session_factory() as db:
                row = db.get(KidsDailyEdition, date_str)
                if row and isinstance(row.content, dict) and content_fits_display_limits(row.content):
                    out = dict(row.content)
                    out.setdefault("generated_by", row.generated_by or "gemini_ai")
                    return out
        except Exception as e:
            logger.warning("Failed reading KidsDailyEdition(%s): %s", date_str, e)
        return None

    def _persist_ai_edition(self, date_str: str, content: Dict[str, Any]) -> None:
        assignment = content.pop("_curriculum_assignment", None)
        embeddings: Dict[str, bytes] = content.pop("_computed_embeddings", None) or {}
        clean_content = _strip_internal_fields(content)
        gen_by = str(clean_content.get("generated_by", "gemini_ai"))
        try:
            with self._session_factory() as db:
                existing = db.get(KidsDailyEdition, date_str)
                if existing:
                    existing.content = clean_content
                    existing.generated_by = gen_by
                else:
                    db.add(
                        KidsDailyEdition(
                            date_str=date_str,
                            content=clean_content,
                            generated_by=gen_by,
                        )
                    )
                self._append_ledger_rows(db, date_str, clean_content, assignment=assignment, embeddings=embeddings)
                db.commit()
        except Exception as e:
            logger.error("Failed persisting KidsDailyEdition(%s): %s", date_str, e)

    def _append_ledger_rows(
        self,
        db: Any,
        date_str: str,
        bundle: Dict[str, Any],
        assignment: Optional[Dict[str, Any]],
        embeddings: Dict[str, bytes],
    ) -> None:
        word_sec = bundle.get("word_of_the_day") or {}
        raw_word = str(word_sec.get("word", "")).strip()
        if raw_word:
            w_norm = raw_word.lower()
            w_stem = compute_word_stem(raw_word)
            exists_word = (
                db.query(KidsConceptLedger.id)
                .filter(KidsConceptLedger.date_str == date_str, KidsConceptLedger.section == "word", KidsConceptLedger.word_norm == w_norm)
                .first()
            )
            if not exists_word:
                db.add(
                    KidsConceptLedger(
                        date_str=date_str,
                        section="word",
                        word_norm=w_norm,
                        word_stem=w_stem,
                        subject_key=w_norm,
                        entity_tokens=extract_entity_tokens(_section_summary("word_of_the_day", word_sec)),
                        pillar="vocabulary",
                        subdomain=str((assignment or {}).get("vocab_archetype", ""))[:80],
                        summary_text=_section_summary("word_of_the_day", word_sec),
                        embedding=embeddings.get("word_of_the_day"),
                    )
                )

        for sec_name, db_sec in (("fun_fact", "fact"), ("stem_5yo", "stem_5yo"), ("stem_9yo", "stem_9yo")):
            sec_obj = bundle.get(sec_name) or {}
            summary = _section_summary(sec_name, sec_obj)
            if not summary:
                continue
            subj = normalize_subject_key(str(sec_obj.get("subject_key", "")), summary)
            card_assign = (assignment or {}).get(sec_name) or {}
            exists_sec = (
                db.query(KidsConceptLedger.id)
                .filter(KidsConceptLedger.date_str == date_str, KidsConceptLedger.section == db_sec, KidsConceptLedger.subject_key == subj)
                .first()
            )
            if not exists_sec:
                db.add(
                    KidsConceptLedger(
                        date_str=date_str,
                        section=db_sec,
                        subject_key=subj,
                        entity_tokens=extract_entity_tokens(summary)[:12],
                        pillar=str(card_assign.get("pillar", "")),
                        subdomain=str(card_assign.get("subdomain", "")),
                        lens=str(card_assign.get("lens", ""))[:120],
                        summary_text=summary,
                        embedding=embeddings.get(sec_name),
                    )
                )

    def _fetch_embedding(self, text: str) -> Optional[bytes]:
        """Fetch a 512-d normalized Matryoshka float32 vector via LiteLLM /v1/embeddings (non-fatal on error)."""
        if not text.strip():
            return None
        ai_cfg = self._resolve_ai_config()
        if not ai_cfg["is_litellm"] or not ai_cfg["base_url"] or not ai_cfg["api_keys"]:
            return None
        url = f"{ai_cfg['base_url']}/v1/embeddings"
        for key in ai_cfg["api_keys"]:
            try:
                resp = httpx.post(
                    url,
                    headers={"Authorization": f"Bearer {key}"},
                    json={"model": "text-embedding", "input": text[:600]},
                    timeout=3.5,
                )
                if resp.status_code == 200:
                    data = resp.json().get("data") or []
                    if data and data[0].get("embedding"):
                        packed = pack_embedding(data[0]["embedding"])
                        return packed if packed else None
            except Exception:
                continue
        return None

    def _maybe_start_embedding_backfill(self) -> None:
        if self._backfill_started:
            return
        ai_cfg = self._resolve_ai_config()
        if not ai_cfg["is_litellm"] or not ai_cfg["api_keys"]:
            return
        self._backfill_started = True

        def _worker() -> None:
            try:
                with self._session_factory() as db:
                    missing = (
                        db.query(KidsConceptLedger)
                        .filter(KidsConceptLedger.embedding.is_(None), KidsConceptLedger.section != "word")
                        .order_by(KidsConceptLedger.id.desc())
                        .limit(300)
                        .all()
                    )
                    updated = 0
                    for row in missing:
                        blob = self._fetch_embedding(row.summary_text)
                        if blob:
                            row.embedding = blob
                            updated += 1
                            if updated % 15 == 0:
                                db.commit()
                        time.sleep(0.05)
                    if updated:
                        db.commit()
                        logger.info("Backfilled %d semantic embeddings into kids_concept_ledger", updated)
            except Exception as e:
                logger.debug("Kids ledger embedding backfill skipped: %s", e)

        threading.Thread(target=_worker, name="kids-embedding-backfill", daemon=True).start()

    # ------------------------------------------------------------------
    # History Snapshot & 4-Gate Candidate Validation
    # ------------------------------------------------------------------
    def _load_ledger_snapshot(self, exclude_date_str: str) -> Dict[str, Any]:
        """Load lifetime words, stems, subject keys, and semantic vectors from SQLite + any in-memory test overlay."""
        used_words: Set[str] = set()
        used_word_list: List[str] = []
        used_stems: Dict[str, str] = {}  # stem -> example prior word
        concept_records: List[Dict[str, Any]] = []
        subdomain_subjects: Dict[str, List[str]] = {}
        recent_categories: Set[str] = set()

        try:
            with self._session_factory() as db:
                rows = db.query(KidsConceptLedger).order_by(KidsConceptLedger.date_str.asc(), KidsConceptLedger.id.asc()).all()
                for r in rows:
                    if r.date_str == exclude_date_str:
                        continue
                    if r.word_norm:
                        used_words.add(r.word_norm)
                        used_word_list.append(r.word_norm)
                        st = r.word_stem or compute_word_stem(r.word_norm)
                        if st and len(st) >= 4:
                            used_stems.setdefault(st, r.word_norm)
                    if r.section != "word" and r.summary_text:
                        concept_records.append(
                            {
                                "date_str": r.date_str,
                                "section": r.section,
                                "subject_key": r.subject_key or normalize_subject_key("", r.summary_text),
                                "entity_tokens": set(r.entity_tokens or extract_entity_tokens(r.summary_text)),
                                "subdomain": r.subdomain or "",
                                "summary_text": r.summary_text,
                                "vec": unpack_embedding(r.embedding),
                            }
                        )
                        if r.subdomain and r.subject_key:
                            subdomain_subjects.setdefault(r.subdomain, []).append(r.subject_key)
        except Exception as e:
            logger.warning("Failed reading kids_concept_ledger snapshot: %s", e)

        # Also fold in any direct in-memory `self._cache` entries (used by unit tests)
        for d_str, day_data in sorted(self._cache.items()):
            if d_str == exclude_date_str or not isinstance(day_data, dict):
                continue
            w = str(day_data.get("word_of_the_day", {}).get("word", "")).strip()
            if w:
                wl = w.lower()
                if wl not in used_words:
                    used_words.add(wl)
                    used_word_list.append(w)
                st = compute_word_stem(wl)
                if st and len(st) >= 4:
                    used_stems.setdefault(st, wl)
            cat = str(day_data.get("fun_fact", {}).get("category", "")).strip().lower()
            if cat:
                recent_categories.add(cat)
            for sec_name, db_sec in (("fun_fact", "fact"), ("stem_5yo", "stem_5yo"), ("stem_9yo", "stem_9yo")):
                sec_obj = day_data.get(sec_name) or {}
                summary = _section_summary(sec_name, sec_obj)
                if summary:
                    subj = normalize_subject_key(str(sec_obj.get("subject_key", "")), summary)
                    concept_records.append(
                        {
                            "date_str": d_str,
                            "section": db_sec,
                            "subject_key": subj,
                            "entity_tokens": set(extract_entity_tokens(summary)),
                            "subdomain": "",
                            "summary_text": summary,
                            "vec": None,
                        }
                    )

        idf = build_idf_weights([c["summary_text"] for c in concept_records])
        return {
            "used_words": used_words,
            "used_word_list": used_word_list,
            "used_stems": used_stems,
            "concept_records": concept_records,
            "subdomain_subjects": subdomain_subjects,
            "recent_categories": recent_categories,
            "idf": idf,
        }

    def _get_recent_history(self, current_date_str: str, days_back: int = 3650) -> Dict[str, Any]:
        """Backward-compatible history helper preserving chronological ordering (never alphabetically truncated)."""
        self._ensure_initialized()
        snap = self._load_ledger_snapshot(exclude_date_str=current_date_str)
        # Preserve original casing from _cache where present for legacy callers
        cased_words: List[str] = []
        seen_lower: Set[str] = set()
        for d_str, day_data in sorted(self._cache.items()):
            if d_str == current_date_str or not isinstance(day_data, dict):
                continue
            w = str(day_data.get("word_of_the_day", {}).get("word", "")).strip()
            if w and w.lower() not in seen_lower:
                seen_lower.add(w.lower())
                cased_words.append(w)
        for w in snap["used_word_list"]:
            if w.lower() not in seen_lower:
                seen_lower.add(w.lower())
                cased_words.append(w.capitalize())

        recent_subjects = [c["subject_key"] for c in snap["concept_records"] if c["subject_key"]]
        recent_facts = [c["summary_text"][:80] for c in snap["concept_records"] if c["section"] == "fact"]
        return {
            "used_words": snap["used_words"],
            "used_word_list": cased_words,
            "recent_categories": snap["recent_categories"],
            "recent_fact_snippets": recent_facts[-60:],
            "recent_stem_topics": list(dict.fromkeys(recent_subjects))[-150:],
            "subdomain_subjects": snap["subdomain_subjects"],
        }

    def _validate_candidate_detailed(
        self,
        candidate: Dict[str, Any],
        current_date_str: str,
        snapshot: Optional[Dict[str, Any]] = None,
        use_embeddings: bool = True,
    ) -> tuple[bool, Dict[str, List[str]], Dict[str, bytes]]:
        """
        4-Gate deterministic + semantic validation across ALL historical records.
        Returns (all_valid, failed_by_section, computed_embeddings).
        """
        try:
            date.fromisoformat(current_date_str)
        except ValueError:
            return False, {"word_of_the_day": ["invalid date"]}, {}

        snap = snapshot or self._load_ledger_snapshot(exclude_date_str=current_date_str)
        failed: Dict[str, List[str]] = {}
        embeddings: Dict[str, bytes] = {}

        def _fail(sec: str, msg: str) -> None:
            failed.setdefault(sec, []).append(msg)

        # Gate 0: Section structure & 1920x1080 character limits per section
        for sec_name, limits in KIDS_DAILY_DISPLAY_LIMITS.items():
            sec_obj = candidate.get(sec_name)
            if not isinstance(sec_obj, dict):
                _fail(sec_name, f"missing section {sec_name}")
                continue
            for field_name in KIDS_DAILY_SCHEMA["properties"][sec_name]["required"]:
                val = sec_obj.get(field_name)
                if not isinstance(val, str) or not val.strip():
                    _fail(sec_name, f"missing required {sec_name}.{field_name}")
            for field_name, max_len in limits.items():
                val = sec_obj.get(field_name)
                if val is not None and (not isinstance(val, str) or len(val.strip()) > max_len):
                    actual_len = len(val.strip()) if isinstance(val, str) else -1
                    _fail(sec_name, f"{sec_name}.{field_name} length {actual_len} exceeds limit {max_len}")

        # Gate 1: Lifetime Vocabulary Word, Casing/Tier-2 Jargon, and Morphological Stem Check
        word_sec = candidate.get("word_of_the_day")
        if isinstance(word_sec, dict):
            clean_word, word_err = sanitize_and_validate_word(str(word_sec.get("word", "")))
            if word_err:
                _fail("word_of_the_day", f"vocabulary word rejected: {word_err}")
            else:
                word_sec["word"] = clean_word
                w_lower = clean_word.lower()
                w_stem = compute_word_stem(w_lower)
                if w_lower in snap["used_words"]:
                    _fail("word_of_the_day", f"vocabulary word '{w_lower}' already used")
                elif w_stem and len(w_stem) >= 4 and w_stem in snap["used_stems"]:
                    prior_w = snap["used_stems"][w_stem]
                    _fail("word_of_the_day", f"vocabulary word '{w_lower}' shares root with prior word '{prior_w}'")

        # Gate 2 & Gate 3: Lifetime Cross-Section Subject Key, Entity Overlap, IDF Lexical & Semantic Embedding Cosine
        section_summaries: Dict[str, str] = {}
        section_vecs: Dict[str, Any] = {}
        section_subjects: Dict[str, str] = {}

        for sec_name in ("fun_fact", "stem_5yo", "stem_9yo"):
            sec_obj = candidate.get(sec_name)
            if not isinstance(sec_obj, dict) or sec_name in failed:
                continue
            summary = _section_summary(sec_name, sec_obj)
            section_summaries[sec_name] = summary
            subj = normalize_subject_key(str(sec_obj.get("subject_key", "")), summary)
            sec_obj["subject_key"] = subj
            section_subjects[sec_name] = subj
            subj_tokens = {t for t in subj.split("_") if len(t) > 3}

            cand_vec = None
            if use_embeddings:
                blob = self._fetch_embedding(summary)
                if blob:
                    embeddings[sec_name] = blob
                    cand_vec = unpack_embedding(blob)
            section_vecs[sec_name] = cand_vec

            for hist in snap["concept_records"]:
                hist_subj = hist["subject_key"]
                hist_subj_tokens = {t for t in hist_subj.split("_") if len(t) > 3}
                if subj and hist_subj and subj == hist_subj:
                    _fail(sec_name, f"recent {sec_name} concept duplicate subject '{subj}' (seen {hist['date_str']})")
                    break
                if len(subj_tokens) >= 2 and len(subj_tokens & hist_subj_tokens) >= 2:
                    _fail(
                        sec_name,
                        f"recent {sec_name} concept overlaps '{hist_subj}' (seen {hist['date_str']})",
                    )
                    break
                lex_sim = lexical_concept_similarity(summary, hist["summary_text"], snap["idf"])
                if lex_sim >= LEXICAL_SIMILARITY_THRESHOLD or _similarity(summary, hist["summary_text"]) >= 0.42:
                    _fail(
                        sec_name,
                        f"recent {sec_name} concept too close to '{hist_subj or hist['summary_text'][:40]}' ({hist['date_str']})",
                    )
                    break
                if cand_vec is not None and hist["vec"] is not None:
                    sem_sim = cosine_packed(cand_vec, hist["vec"])
                    if sem_sim >= SEMANTIC_SIMILARITY_THRESHOLD:
                        _fail(
                            sec_name,
                            f"semantic duplicate ({sem_sim:.2f}) of '{hist_subj or hist['summary_text'][:40]}' ({hist['date_str']})",
                        )
                        break

        # Gate 4: Same-Day Cross-Card Independence across all 4 cards
        if isinstance(word_sec, dict) and "word_of_the_day" not in failed:
            section_summaries["word_of_the_day"] = _section_summary("word_of_the_day", word_sec)

        ordered_names = [n for n in ("word_of_the_day", "fun_fact", "stem_5yo", "stem_9yo") if n in section_summaries]
        for i, left_name in enumerate(ordered_names):
            for right_name in ordered_names[i + 1 :]:
                if right_name in failed:
                    continue
                left_s, right_s = section_summaries[left_name], section_summaries[right_name]
                if (
                    _similarity(left_s, right_s) >= 0.40
                    or lexical_concept_similarity(left_s, right_s, snap["idf"]) >= SAME_DAY_LEXICAL_THRESHOLD
                ):
                    _fail(right_name, f"same-day overlap between {left_name} and {right_name}")
                    continue
                lv, rv = section_vecs.get(left_name), section_vecs.get(right_name)
                if lv is not None and rv is not None and cosine_packed(lv, rv) >= SAME_DAY_SEMANTIC_THRESHOLD:
                    _fail(right_name, f"same-day semantic overlap between {left_name} and {right_name}")

        return (len(failed) == 0), failed, embeddings

    def _validate_candidate(self, candidate: Dict[str, Any], current_date_str: str) -> tuple[bool, list[str]]:
        """Public/test-compatible tuple wrapper around the 4-Gate validator."""
        self._ensure_initialized()
        if not content_fits_display_limits(candidate):
            return False, ["display limits"]
        valid, failed_map, _ = self._validate_candidate_detailed(
            copy.deepcopy(candidate),
            current_date_str,
            use_embeddings=False,
        )
        reasons = [msg for msgs in failed_map.values() for msg in msgs]
        return valid, reasons

    # ------------------------------------------------------------------
    # Curriculum Deck State Helpers
    # ------------------------------------------------------------------
    def _draw_curriculum_for_date(self, date_str: str, force_advance: bool = False) -> Dict[str, Any]:
        try:
            with self._session_factory() as db:
                row = db.get(Setting, DECK_DB_KEY)
                cur_state = dict(row.value) if row and isinstance(row.value, dict) else {}
                if force_advance:
                    cur_state["last_drawn_date"] = ""
                new_state, assignment = draw_daily_curriculum(cur_state, date_str)
                db.merge(Setting(key=DECK_DB_KEY, value=new_state))
                db.commit()
                return assignment
        except Exception as e:
            logger.warning("Curriculum deck fallback draw for %s: %s", date_str, e)
            _, assignment = draw_daily_curriculum({}, date_str)
            return assignment

    # ------------------------------------------------------------------
    # Generation & Surgical Single-Card Repair
    # ------------------------------------------------------------------
    def _generate_daily_content(self, date_str: str, force_advance_deck: bool = False) -> Dict[str, Any]:
        ai_cfg = self._resolve_ai_config()
        primary_key = ai_cfg["api_keys"][0] if ai_cfg["api_keys"] else ""
        primary_model = ai_cfg["models"][0] if ai_cfg["models"] else "gemini-3.8-flash"

        if primary_key:
            for key in ai_cfg["api_keys"]:
                try:
                    ai_content = self._generate_with_gemini(
                        date_str,
                        key,
                        primary_model,
                        force_advance_deck=force_advance_deck,
                    )
                    if ai_content:
                        return ai_content
                except Exception as e:
                    logger.error("Gemini generation failed for kids daily (%s): %s", date_str, e)

        return self._pick_unseen_fallback(date_str)

    def _pick_unseen_fallback(self, date_str: str) -> Dict[str, Any]:
        """Select an unseen bundle from FALLBACK_CATALOG rather than repeating recently seen words/concepts."""
        try:
            d = date.fromisoformat(date_str)
            start_idx = (d.timetuple().tm_yday - 1) % len(FALLBACK_CATALOG)
        except Exception:
            start_idx = hash(date_str) % len(FALLBACK_CATALOG)

        snap = self._load_ledger_snapshot(exclude_date_str=date_str)
        n = len(FALLBACK_CATALOG)
        for offset in range(n):
            cand = copy.deepcopy(FALLBACK_CATALOG[(start_idx + offset) % n])
            w_lower = str(cand.get("word_of_the_day", {}).get("word", "")).strip().lower()
            w_stem = compute_word_stem(w_lower)
            if w_lower in snap["used_words"] or (w_stem and w_stem in snap["used_stems"]):
                continue
            hist_subjs = {c["subject_key"] for c in snap["concept_records"] if c["subject_key"]}
            cand_subjs = {
                normalize_subject_key("", _section_summary(sec, cand.get(sec) or {}))
                for sec in ("fun_fact", "stem_5yo", "stem_9yo")
            }
            if cand_subjs & hist_subjs:
                continue
            cand["generated_by"] = "offline_catalog"
            return cand

        fallback = copy.deepcopy(FALLBACK_CATALOG[start_idx])
        fallback["generated_by"] = "offline_catalog"
        return fallback

    def _build_bundle_prompt(
        self,
        date_str: str,
        assignment: Dict[str, Any],
        snapshot: Dict[str, Any],
        ages: List[int],
        nonce: str,
    ) -> str:
        age_younger, age_older = ages[0], ages[1]
        grade_younger = age_to_grade_label(age_younger)
        grade_older = age_to_grade_label(age_older)

        all_words = snapshot["used_word_list"]
        forbidden_words_str = ", ".join(all_words[-600:]) if all_words else "None yet"

        # Combine ALL-TIME subjects from today's 3 drawn subdomains + last 150 concepts chronologically
        domain_subjects: List[str] = []
        for slot_key in ("fun_fact", "stem_5yo", "stem_9yo"):
            sub_name = assignment[slot_key]["subdomain"]
            domain_subjects.extend(snapshot["subdomain_subjects"].get(sub_name, []))
        recent_subjects = [c["subject_key"] for c in snapshot["concept_records"][-180:] if c["subject_key"]]
        combined_subjects = list(dict.fromkeys([*domain_subjects, *recent_subjects]))
        forbidden_subjects_str = ", ".join(combined_subjects[-180:]) if combined_subjects else "None yet"

        interests = self._settings.get("interests") or []
        interests_note = (
            f"Optional family curiosity threads (weave in lightly only if natural): {', '.join(interests)}.\n\n"
            if interests
            else ""
        )

        f_card = assignment["fun_fact"]
        s5_card = assignment["stem_5yo"]
        s9_card = assignment["stem_9yo"]

        return (
            f"Generate a 100% brand-new, factually rigorous, captivating daily educational bundle for {date_str} (Session: {nonce}).\n\n"
            f"TODAY'S DISTINCT CURRICULUM ASSIGNMENTS (drawn without replacement—stay faithful to each card's domain & lens):\n"
            f"1. Word of the Day style: {assignment['vocab_archetype']}\n"
            f"2. Fun Fact domain: [{f_card['subdomain']}] — {f_card['lens']}\n"
            f"3. Age {age_younger} ({grade_younger}) Challenge domain: [{s5_card['subdomain']}] — {s5_card['lens']}\n"
            f"4. Age {age_older} ({grade_older}) Challenge domain: [{s9_card['subdomain']}] — {s9_card['lens']}\n\n"
            f"{interests_note}"
            f"PERMANENT ANTI-REPETITION LEDGER (CRITICAL):\n"
            f"- RETIRED VOCABULARY WORDS (never reuse any of these or words sharing their root/stem): {forbidden_words_str}\n"
            f"- RETIRED CONCEPTS & SUBJECTS (never revisit these objects, species, people, or mechanisms in ANY card): {forbidden_subjects_str}\n\n"
            f"{CLICHE_BLOCKLIST_PROMPT}\n\n"
            f"{MYTH_BLOCKER_PROMPT}\n\n"
            f"CARD QUALITY & FORMAT REQUIREMENTS:\n"
            f"1. word_of_the_day: Choose a real, standard-dictionary Tier-2 English word that a {age_younger}-to-{age_older}-year-old can genuinely say at dinner or use in school writing. "
            f"Capitalize the first letter. NEVER choose obscure Latin/Greek scientific taxonomy, medical/chemical terms, or internet neologisms. "
            f"Provide phonetic pronunciation, lowercase part_of_speech, a crystal-clear kid-friendly definition (<=140 chars), and a vivid everyday or story example sentence (<=140 chars).\n"
            f"2. fun_fact: A true, specific, mind-expanding discovery inside [{f_card['subdomain']}]. Include a fitting single emoji, concise category (<=32 chars), "
            f"1-2 sentence fact (<=180 chars), a 1-sentence 'did_you_know' follow-up (<=180 chars), and a canonical snake_case `subject_key` naming the exact subject.\n"
            f"3. stem_5yo: A playful, deducible 'Why / How / What happens if' physical or observational puzzle for an Age {age_younger} ({grade_younger}) child inside [{s5_card['subdomain']}]. "
            f"Include topic (<=40 chars), question (<=160 chars), a concrete mechanism hint (<=140 chars) that helps them guess it, clear answer (<=200 chars), parent_explanation (<=220 chars), and `subject_key`.\n"
            f"4. stem_9yo: A deeper conceptual 'Why / How' engineering, historical, or scientific challenge for an Age {age_older} ({grade_older}) child inside [{s9_card['subdomain']}]. "
            f"Include topic (<=40 chars), question (<=160 chars), deducible hint (<=140 chars), precise answer (<=200 chars), conceptual parent_explanation (<=220 chars), and `subject_key`.\n\n"
            f"STRICT 1920x1080 WALL-DISPLAY BUDGET: Every single field MUST be a complete, natural sentence comfortably under its maxLength—never truncate or end with ellipses."
        )

    def _call_gemini_json(
        self,
        client: Any,
        model_name: str,
        prompt: str,
        schema: Dict[str, Any],
        temperature: float = 0.95,
    ) -> Dict[str, Any]:
        from google.genai import types

        gen_config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_json_schema=schema,
            temperature=temperature,
        )
        # Enable lightweight reasoning on Gemini 2.5 / 3.8 Flash for spelling & factual precision,
        # falling back cleanly if a proxy route rejects thinking_config.
        if any(tag in model_name for tag in ("3.8", "3.7", "2.5")):
            try:
                cfg_with_thinking = types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_json_schema=schema,
                    temperature=temperature,
                    thinking_config=types.ThinkingConfig(thinking_budget=512),
                )
                resp = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=cfg_with_thinking,
                )
                return json.loads(resp.text)
            except Exception as think_err:
                if "thinking" not in str(think_err).lower() and "400" not in str(think_err):
                    raise

        resp = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=gen_config,
        )
        return json.loads(resp.text)

    def _repair_failed_sections(
        self,
        client: Any,
        model_name: str,
        date_str: str,
        candidate: Dict[str, Any],
        failed_map: Dict[str, List[str]],
        assignment: Dict[str, Any],
        snapshot: Dict[str, Any],
        ages: List[int],
    ) -> Optional[Dict[str, Any]]:
        """Surgically regenerate ONLY the 1-2 failed sections while keeping valid sibling cards intact."""
        failed_keys = list(failed_map.keys())
        kept_summaries = [
            f"- {sec}: {_section_summary(sec, candidate[sec])}"
            for sec in ("word_of_the_day", "fun_fact", "stem_5yo", "stem_9yo")
            if sec not in failed_map and isinstance(candidate.get(sec), dict)
        ]
        # Draw a fresh backup curriculum assignment if a card collided on concept
        fresh_assign = self._draw_curriculum_for_date(date_str, force_advance=True)
        failure_lines = []
        for sec, reasons in failed_map.items():
            target_domain = (
                fresh_assign["vocab_archetype"]
                if sec == "word_of_the_day"
                else f"[{fresh_assign[sec]['subdomain']}] — {fresh_assign[sec]['lens']}"
            )
            failure_lines.append(
                f"- Regenerate `{sec}` using fresh focus {target_domain}. Previous attempt failed because: {'; '.join(reasons)}"
            )

        repair_prompt = (
            f"Repair ONLY the following rejected card(s) for the {date_str} Kids' Brain Nuggets bundle:\n"
            + "\n".join(failure_lines)
            + "\n\nAlready-accepted sibling cards for today (DO NOT overlap with these topics or words):\n"
            + ("\n".join(kept_summaries) if kept_summaries else "None")
            + f"\n\nTarget ages: younger = Age {ages[0]} ({age_to_grade_label(ages[0])}), older = Age {ages[1]} ({age_to_grade_label(ages[1])}).\n"
            + f"{CLICHE_BLOCKLIST_PROMPT}\n\n{MYTH_BLOCKER_PROMPT}\n"
            + "Respect all character maxLength limits strictly with complete, concise sentences (no ellipses)."
        )
        repair_schema = _build_generation_schema(failed_keys)
        patched_parts = self._call_gemini_json(
            client=client,
            model_name=model_name,
            prompt=repair_prompt,
            schema=repair_schema,
            temperature=1.05,
        )
        merged = copy.deepcopy(candidate)
        for sec in failed_keys:
            if sec in patched_parts and isinstance(patched_parts[sec], dict):
                merged[sec] = patched_parts[sec]
                if sec != "word_of_the_day":
                    assignment[sec] = fresh_assign[sec]
                else:
                    assignment["vocab_archetype"] = fresh_assign["vocab_archetype"]
        return merged

    def _generate_with_gemini(
        self,
        date_str: str,
        api_key: str,
        model_name: str,
        force_advance_deck: bool = False,
    ) -> Optional[Dict[str, Any]]:
        import uuid
        from google import genai

        ai_cfg = self._resolve_ai_config()
        http_opts: Dict[str, Any] = {"api_version": "v1beta"}
        if ai_cfg["base_url"]:
            http_opts["base_url"] = ai_cfg["base_url"]
        client = genai.Client(api_key=api_key, http_options=http_opts)

        try:
            ref_d = date.fromisoformat(date_str)
        except ValueError:
            ref_d = None
        ages = self.get_effective_ages(ref_d)
        snapshot = self._load_ledger_snapshot(exclude_date_str=date_str)
        assignment = self._draw_curriculum_for_date(date_str, force_advance=force_advance_deck)

        unique_models = list(dict.fromkeys([model_name, *ai_cfg["models"]]))
        if ai_cfg["is_litellm"]:
            unique_models = [m for m in unique_models if m in LITELLM_MODELS_PRIORITY] or list(LITELLM_MODELS_PRIORITY)

        rejected_reasons: List[str] = []
        for attempt in range(3):
            if attempt > 0:
                assignment = self._draw_curriculum_for_date(date_str, force_advance=True)
            nonce = uuid.uuid4().hex[:8]
            base_prompt = self._build_bundle_prompt(date_str, assignment, snapshot, ages, nonce)
            if rejected_reasons:
                base_prompt += "\n\nPREVIOUS REJECTED ATTEMPTS — AVOID THESE EXACT ISSUES:\n- " + "\n- ".join(
                    rejected_reasons[-12:]
                )

            for m in unique_models:
                try:
                    data = self._call_gemini_json(
                        client=client,
                        model_name=m,
                        prompt=base_prompt,
                        schema=KIDS_GENERATION_SCHEMA,
                        temperature=0.95 if attempt == 0 else 1.05,
                    )
                    valid, failed_map, embeddings = self._validate_candidate_detailed(
                        data, date_str, snapshot=snapshot, use_embeddings=True
                    )
                    if not valid and 1 <= len(failed_map) <= 2:
                        try:
                            repaired = self._repair_failed_sections(
                                client=client,
                                model_name=m,
                                date_str=date_str,
                                candidate=data,
                                failed_map=failed_map,
                                assignment=assignment,
                                snapshot=snapshot,
                                ages=ages,
                            )
                            if repaired:
                                valid, failed_map, embeddings = self._validate_candidate_detailed(
                                    repaired, date_str, snapshot=snapshot, use_embeddings=True
                                )
                                if valid:
                                    data = repaired
                        except Exception as rep_err:
                            logger.warning("Surgical kids card repair failed on %s: %s", m, rep_err)

                    if not valid:
                        flat_reasons = [msg for msgs in failed_map.values() for msg in msgs]
                        rejected_reasons.extend(flat_reasons)
                        logger.warning("Candidate rejected by 4-gate kids validation (%s): %s", m, flat_reasons)
                        continue

                    data["generated_by"] = f"gemini_ai ({m})"
                    data["_curriculum_assignment"] = assignment
                    data["_computed_embeddings"] = embeddings
                    return data
                except Exception as e:
                    logger.warning("Failed kids daily generation with model %s (attempt %d): %s", m, attempt + 1, e)
                    # If auth failed on this API key, bail out to let outer caller try fallback key immediately
                    err_s = str(e).lower()
                    if "401" in err_s or "403" in err_s or "authentication" in err_s or "invalid api key" in err_s:
                        return None
                    continue

        return None


kids_daily_service = KidsDailyService()
