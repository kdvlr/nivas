import json
import logging
import os
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set
from ..config import get_settings

logger = logging.getLogger(__name__)

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
            "required": ["word", "pronunciation", "definition", "example"],
        },
        "fun_fact": {
            "type": "OBJECT",
            "properties": {
                "fact": {"type": "STRING", "maxLength": KIDS_DAILY_DISPLAY_LIMITS["fun_fact"]["fact"]},
                "category": {"type": "STRING", "maxLength": KIDS_DAILY_DISPLAY_LIMITS["fun_fact"]["category"]},
                "emoji": {"type": "STRING", "maxLength": KIDS_DAILY_DISPLAY_LIMITS["fun_fact"]["emoji"]},
                "did_you_know": {"type": "STRING", "maxLength": KIDS_DAILY_DISPLAY_LIMITS["fun_fact"]["did_you_know"]},
            },
            "required": ["fact", "emoji", "did_you_know"],
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
            "required": ["topic", "question", "answer", "parent_explanation"],
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
            "required": ["topic", "question", "answer", "parent_explanation"],
        },
    },
    "required": ["word_of_the_day", "fun_fact", "stem_5yo", "stem_9yo"],
}

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
            "word": "Resilient",
            "pronunciation": "reh-ZIL-yunt",
            "part_of_speech": "adjective",
            "definition": "Able to bounce back, recover quickly, and stay strong after difficulties.",
            "example": "Even when the Lego tower fell over, Liam was resilient and built an even taller castle."
        },
        "fun_fact": {
            "fact": "A cloud might look as light as cotton candy, but an average cumulus cloud weighs about 1.1 million pounds—as much as 100 elephants!",
            "category": "Earth & Weather",
            "emoji": "☁️",
            "did_you_know": "Clouds float because the tiny water droplets are spread out across a massive volume of warm rising air."
        },
        "stem_5yo": {
            "topic": "Plant Biology",
            "question": "How do plants drink water if they don't have a mouth?",
            "hint": "Look down at the soil under the stem!",
            "answer": "Plants drink water using their roots like tiny straws hidden underground in the soil.",
            "parent_explanation": "Roots absorb moisture and minerals from dirt and carry them up the stem through microscopic plant vessels called xylem."
        },
        "stem_9yo": {
            "topic": "Computer Science & Logic",
            "question": "How can a computer store whole pictures and videos using only 1s and 0s (binary code)?",
            "hint": "Think about breaking an image down into millions of tiny colored dots.",
            "answer": "Images are divided into millions of tiny pixels, and each pixel's color values are stored as patterns of electrical 1s and 0s (bits).",
            "parent_explanation": "Every pixel has red, green, and blue color levels (0-255). Computers store these numbers as binary electric switches (on/off)."
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
            "word": "Navigational",
            "pronunciation": "nav-ih-GAY-shuh-nul",
            "part_of_speech": "adjective",
            "definition": "Having to do with steering, directing a course, or finding your way.",
            "example": "Migrating sea turtles use natural navigational senses to return to the beach where they hatched."
        },
        "fun_fact": {
            "fact": "A blue whale's heart is as big as a small car, and its heartbeat can be heard over 2 miles away underwater!",
            "category": "Ocean Giants",
            "emoji": "🐋",
            "did_you_know": "A blue whale can weigh up to 300,000 pounds, making it the largest animal to ever live on Earth."
        },
        "stem_5yo": {
            "topic": "Ocean Science",
            "question": "Why does the ocean taste salty when rainwater tastes fresh?",
            "hint": "Rain washes over rocks and rivers on its way to the ocean!",
            "answer": "Rivers carry tiny amounts of dissolved minerals and salts from rocks into the sea over millions of years.",
            "parent_explanation": "When ocean water evaporates into clouds, salt stays behind in the ocean, slowly making the sea salty over geological time."
        },
        "stem_9yo": {
            "topic": "Marine Biology & Light",
            "question": "How do deep-sea creatures like anglerfish produce glowing light in total darkness without electricity?",
            "hint": "They use a chemical reaction inside their bodies called bioluminescence.",
            "answer": "They produce light through a chemical reaction between a molecule called luciferin and an enzyme called luciferase (or symbiotic glowing bacteria).",
            "parent_explanation": "Bioluminescence is cold light with nearly 100% energy efficiency. Creatures use it to attract prey, find mates, or startle predators."
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
            "word": "Microscopic",
            "pronunciation": "my-kruh-SKOP-ik",
            "part_of_speech": "adjective",
            "definition": "So tiny that it can only be seen clearly with the help of a powerful microscope.",
            "example": "A single drop of pond water contains a whole world of microscopic swimming creatures."
        },
        "fun_fact": {
            "fact": "No two people on Earth have the exact same fingerprints—not even identical twins!",
            "category": "Human Biology",
            "emoji": "🔍",
            "did_you_know": "Fingerprint ridges also help our fingers grip objects and improve our sense of touch texture."
        },
        "stem_5yo": {
            "topic": "Human Body",
            "question": "Why do our eyes blink automatically throughout the day?",
            "hint": "Think about what happens to a dry sponge or windshield wipers on a car!",
            "answer": "Blinking sweeps moisture and tears across your eyes to keep them clean, wet, and clear of dust.",
            "parent_explanation": "Eyelids act like gentle windshield wipers, spreading a thin tear film that delivers oxygen and washes away tiny particles."
        },
        "stem_9yo": {
            "topic": "Neuroscience & Senses",
            "question": "How does your brain understand what your eyes are seeing in less than a tenth of a second?",
            "hint": "Photoreceptor cells turn photons of light into electrical signals sent along a nerve cable.",
            "answer": "Retina cells (rods and cones) convert light photons into electrical nerve impulses that travel along the optic nerve to the brain's visual cortex.",
            "parent_explanation": "The brain's occipital lobe decodes shape, color, motion, and depth from electrical firing patterns in milliseconds."
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
            "word": "Interstellar",
            "pronunciation": "in-ter-STEL-er",
            "part_of_speech": "adjective",
            "definition": "Occurring, located, or traveling between the stars.",
            "example": "The Voyager 1 space probe has traveled so far that it entered interstellar space."
        },
        "fun_fact": {
            "fact": "Saturn's spectacular rings are not solid—they are made of billions of chunks of ice and rock ranging from tiny dust grains to house-sized boulders!",
            "category": "Space Exploration",
            "emoji": "🪐",
            "did_you_know": "Although the rings are up to 175,000 miles wide, they are remarkably thin—only about 30 feet thick in most places."
        },
        "stem_5yo": {
            "topic": "Astronomy & Gravity",
            "question": "Why does Mars look reddish-orange in the night sky?",
            "hint": "Think about what happens to iron metal when it gets left out in the rain!",
            "answer": "Mars is covered in iron-rich dust that rusted over billions of years, giving the whole planet a rusty red coat.",
            "parent_explanation": "The Martian soil contains iron oxide (rust). Windstorms blow the red dust into the atmosphere, making the sky and surface glow red."
        },
        "stem_9yo": {
            "topic": "Physics & Orbital Mechanics",
            "question": "Why do astronauts float inside the International Space Station if Earth's gravity is still 90% as strong up there?",
            "hint": "The space station and astronauts are both falling toward Earth at the exact same forward orbital speed.",
            "answer": "They are in perpetual free fall! The station is falling toward Earth while moving sideways at 17,500 mph, curving around the planet endlessly.",
            "parent_explanation": "Weightlessness in orbit is microgravity caused by free fall. The ground curves away at the same rate the spacecraft falls."
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
            "word": "Biodiversity",
            "pronunciation": "by-oh-dih-VER-sih-tee",
            "part_of_speech": "noun",
            "definition": "The amazing variety of different plants, animals, and living things in an ecosystem.",
            "example": "Tropical rainforests have more biodiversity than almost any other place on Earth."
        },
        "fun_fact": {
            "fact": "More than half of all the world's plant and animal species live in tropical rainforests, even though rainforests cover only 6% of Earth's land!",
            "category": "Ecology",
            "emoji": "🌴",
            "did_you_know": "A single rainforest tree can be home to over 1,000 different species of insects."
        },
        "stem_5yo": {
            "topic": "Life Cycles",
            "question": "How does a swimming tadpole transform into a hopping green frog?",
            "hint": "It undergoes a magical transformation called metamorphosis!",
            "answer": "Inside the pond, the tadpole grows back legs, front legs, absorbs its tail, and develops lungs to breathe air on land.",
            "parent_explanation": "This biological transformation is called metamorphosis, regulated by thyroid hormones that remodel gills, digestive system, and limbs."
        },
        "stem_9yo": {
            "topic": "Ecosystems & Energy Flow",
            "question": "Why are apex predators like wolves, lions, and sharks so essential for healthy plant and tree growth in an ecosystem?",
            "hint": "Think about what happens to herbivores (like deer) when there are no predators around.",
            "answer": "Predators keep herbivore populations balanced, preventing overgrazing of riverbanks and forests in a ripple effect called a trophic cascade.",
            "parent_explanation": "In Yellowstone, reintroducing wolves controlled elk, allowing willows and aspens to regrow, which restored songbirds, beavers, and stabilized rivers."
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
            "word": "Glacial",
            "pronunciation": "GLAY-shul",
            "part_of_speech": "adjective",
            "definition": "Extremely cold like ice, or moving very slowly like a giant frozen glacier.",
            "example": "The turquoise alpine lake was filled with pure water melted from a glacial mountain peak."
        },
        "fun_fact": {
            "fact": "Glaciers store about 69% of the entire world's fresh water in the form of ancient compacted ice!",
            "category": "Polar Science",
            "emoji": "🏔️",
            "did_you_know": "Glaciers are not frozen solid; their immense weight causes them to slowly creep and flow down mountains like frozen rivers."
        },
        "stem_5yo": {
            "topic": "Polar Animals",
            "question": "Why don't emperor penguins freeze while standing on Antarctica's ice in minus 40-degree winds?",
            "hint": "They have special waterproof feathers, blubber, and huddle together in giant groups!",
            "answer": "They have thick blubber fat, dense waterproof feathers, and take turns standing in the warm middle of giant penguin huddles.",
            "parent_explanation": "Penguins share body warmth through communal huddling, constantly rotating so outside penguins can move inside to warm up."
        },
        "stem_9yo": {
            "topic": "Space Weather & Magnetism",
            "question": "What causes the dancing green and purple lights of the Aurora Borealis (Northern Lights) near polar regions?",
            "hint": "Charged particles from solar flares collide with gas atoms in Earth's upper atmosphere.",
            "answer": "Solar wind electrons and protons funnel along Earth's magnetic field lines and excite oxygen and nitrogen atoms in the thermosphere.",
            "parent_explanation": "When excited atmospheric gas atoms drop back to ground energy states, they emit photons (green/red from oxygen, blue/purple from nitrogen)."
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
            "word": "Durable",
            "pronunciation": "DUR-uh-bul",
            "part_of_speech": "adjective",
            "definition": "Able to withstand wear, pressure, and damage for a very long time.",
            "example": "Astronaut spacesuits are made of durable multi-layer fabrics that stop micrometeoroids."
        },
        "fun_fact": {
            "fact": "Diamonds are the hardest natural substance found on Earth—the only thing that can scratch a diamond is another diamond!",
            "category": "Earth Minerals",
            "emoji": "💎",
            "did_you_know": "Both soft pencil graphite and ultra-hard diamonds are made of pure carbon atoms; only their crystal arrangements differ."
        },
        "stem_5yo": {
            "topic": "Materials Science",
            "question": "Why does a rubber bouncy ball bounce high when you drop it, while a ball of playdough just thuds flat?",
            "hint": "Rubber is elastic and springs right back to its round shape instantly!",
            "answer": "Rubber is elastic! When it hits the floor, it squishes momentarily and then snaps back, pushing off the ground.",
            "parent_explanation": "Elastic materials store impact energy as potential energy and quickly convert it back into kinetic upward bounce energy."
        },
        "stem_9yo": {
            "topic": "Molecular Chemistry & Allotropes",
            "question": "Why is diamond transparent and ultra-hard, while pencil lead (graphite) is black and slippery, if both are 100% pure carbon?",
            "hint": "Diamond has a 3D tetrahedral lattice, while graphite has loosely bonded 2D hexagonal sheets.",
            "answer": "Diamond atoms form rigid 3D tetrahedral covalent bonds (sp³), whereas graphite forms 2D sheets (sp²) with weak Van der Waals forces that slide easily.",
            "parent_explanation": "Allotropes show how atomic geometry dictates material properties. Rigid 3D networks resist deformation, while weak interlayer bonds allow graphite to slide onto paper."
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
            "word": "Autonomous",
            "pronunciation": "aw-TAHN-uh-mus",
            "part_of_speech": "adjective",
            "definition": "Able to act, navigate, and make decisions independently without human control.",
            "example": "The Mars Perseverance rover uses autonomous navigation to drive around rocks on the red planet."
        },
        "fun_fact": {
            "fact": "The Mars rover Curiosity has a built-in rock-zapping laser named ChemCam that vaporizes rocks from 20 feet away to analyze their minerals!",
            "category": "Robotics & AI",
            "emoji": "🤖",
            "did_you_know": "Radio signals from Mars take between 5 and 20 minutes to reach Earth, which is why Mars rovers must drive autonomously."
        },
        "stem_5yo": {
            "topic": "Robots & Computers",
            "question": "How does a robot vacuum know when it reaches a wall or staircase without eyes?",
            "hint": "It has invisible infrared beams and bumper sensors!",
            "answer": "It uses infrared light sensors and bumper switches to bounce light off obstacles and feel edges before turning around.",
            "parent_explanation": "Sensors send signals to the robot's microchip, which follows pre-programmed rules (e.g. 'if edge detected, stop and reverse')."
        },
        "stem_9yo": {
            "topic": "Sensors & Inertial Navigation",
            "question": "How does a drone or smartphone know its exact tilt angle and orientation in 3D space without using a camera?",
            "hint": "Microscopic vibrating tuning forks inside a silicon MEMS gyroscope detect rotational acceleration.",
            "answer": "MEMS (Micro-Electro-Mechanical Systems) gyroscopes and accelerometers measure Coriolis force and gravitational acceleration on microscopic silicon vibrating arms.",
            "parent_explanation": "Tilting the device causes microscopic silicon masses to deflect, changing electrical capacitance between sensor plates to calculate pitch, roll, and yaw."
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

KIDS_CATEGORIES = [
    "Astrophysics, Nebulae & Black Holes",
    "Deep Ocean Trenches & Abyssal Creatures",
    "Volcanoes, Magma Chambers & Geysers",
    "Aerodynamics, Supersonic Flight & Gliders",
    "Botany, Photosynthesis & Carnivorous Plants",
    "Crystallography, Gems & Mineral Formations",
    "Entomology, Insect Superpowers & Metamorphosis",
    "Paleontology, Dinosaurs & Fossilized Footprints",
    "Acoustics, Sound Waves, Echoes & Sonar",
    "Animal Biomimicry & Nature's Inventions",
    "Extreme Weather, Tornadoes, Hurricanes & Lightning",
    "Microbiology, Extremophiles & Bacteria",
    "Architecture, Suspension Bridges & Arches",
    "Optics, Prisms, Lasers & Wave-Particle Duality",
    "Glaciology, Icebergs & Ice Ages",
    "Neurobiology, The Brain & Animal Senses",
    "Rocketry, Orbital Mechanics & Mars Rovers",
    "Bioluminescence & Glow-in-the-Dark Sea Life",
    "Plate Tectonics, Earthquakes & Continental Drift",
    "Ancient Civilizations & Engineering Marvels",
    "Cryogenics, Liquid Nitrogen & Absolute Zero",
    "Fluid Dynamics, Vortices & Ocean Currents",
    "Quantum Oddities, Atoms & Subatomic Particles",
    "Renewable Energy, Solar Cells & Wind Turbines",
    "Arachnology, Spider Silk & Web Architecture",
    "Marine Mammals, Whale Songs & Echolocation",
    "Desert Ecology, Cacti & Camouflage Adaptations",
    "Caves, Stalactites & Subterranean Rivers",
    "Magnetism, Electromagnets & Earth's Magnetic Field",
    "Mycology, Mushrooms & Forest Mycelium Networks",
    "Planetary Moons, Rings & Asteroid Belts",
    "Bird Migration, Navigation & Magnetic Senses",
    "Robotics, Artificial Intelligence & Sensors",
    "Rainforest Canopies & Symbiotic Biodiversity",
    "The Solar Wind, Auroras & Northern Lights",
    "Coral Reefs, Polyps & Atoll Formations",
    "Kinetic Energy, Momentum & Rollercoasters",
    "Amber Preservation & Prehistoric Insects",
    "Atmospheric Layers, Stratosphere & Exosphere",
    "Deep Sea Hydrothermal Vents & Chemosynthesis",
    "Geothermal Energy, Hot Springs & Fumaroles",
    "Bioluminescent Fungi & Glowing Forests",
    "Materials Science, Graphene & Aerogels",
    "Tides, Moon Gravity & Coastal Estuaries",
    "Pollination, Honeybee Dances & Nectar Chemistry",
    "Meteorites, Impact Craters & Comets",
    "Biomechanics, Cheetah Speed & Muscle Levers",
    "Bridges, Cantilevers & Structural Trusses",
    "Hydraulics, Water Pressure & Submarines",
    "Thermohaline Circulation & Gulf Stream",
    "Seed Dispersal, Helicopter Samaras & Burrs",
    "Optical Illusions, Mirages & Rainbow Physics",
    "Radio Astronomy, Pulsars & Space Signals",
    "Electric Animals, Torpedo Rays & Electric Eels",
    "Ant Colonies, Superorganisms & Pheromone Trails",
    "Superconductors & Magnetic Levitation Trains",
    "Atmospheric Pressure, Barometers & Flight Lift",
    "Dendrochronology, Tree Rings & Forest History",
    "Venom, Toxins & Biochemical Defenses",
    "Geodes, Agates & Underground Crystals",
    "Seafloor Spreading, Mid-Atlantic Ridge & Trenches",
    "Gravity Slingshots, Voyager Missions & Probes",
    "Ecosystem Trophic Cascades & Apex Predators",
    "Friction, Hovercrafts & Air Bearings",
    "Plant Communication, Chemical Signals & Roots",
    "Chromatography, Color Chemistry & Pigments",
    "Bioluminescent Waves, Dinoflagellates & Red Tides",
    "Solar Eclipses, Umbra, Penumbra & Coronas",
    "Hibernation, Torpor & Freeze-Tolerant Frogs",
    "Hovering Birds, Hummingbird Wings & Aerodynamics",
    "Geological Time Scales, Strata & Sedimentary Layers",
    "Thermodynamics, Heat Conduction & Insulation",
    "Subsurface Oceans, Europa & Enceladus",
    "Static Electricity, Van de Graaff & Lightning Rods",
    "Cephalopod Camouflage, Chromatophores & Octopuses",
]

class KidsDailyService:
    def __init__(self):
        self._cache: Dict[str, Any] = {}
        self._settings: Dict[str, Any] = {
            "force_banner_active": False,
            "gemini_api_key": "",
            "gemini_model": "gemini-3.7-flash",
        }
        self._load_cache()

    def _load_cache(self):
        try:
            target_file = _get_kids_daily_file()
            if target_file.exists():
                with open(target_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._cache = data.get("days", {})
                    self._settings = {**self._settings, **data.get("settings", {})}
        except Exception as e:
            logger.warning(f"Failed to load kids daily cache: {e}")

    def _save_cache(self):
        try:
            target_file = _get_kids_daily_file()
            target_file.parent.mkdir(parents=True, exist_ok=True)
            with open(target_file, "w", encoding="utf-8") as f:
                json.dump(
                    {
                        "days": self._cache,
                        "settings": self._settings,
                    },
                    f,
                    indent=2,
                    ensure_ascii=False,
                )
        except Exception as e:
            logger.error(f"Failed to save kids daily cache: {e}")

    def is_active_morning_window(self, now: Optional[datetime] = None) -> bool:
        """
        Active hours:
        - Weekdays (Mon-Fri, weekday 0-4): 6:00 AM - 8:00 AM
        - Weekends (Sat-Sun, weekday 5-6): 9:00 AM - 11:00 AM
        """
        if self._settings.get("force_banner_active", False):
            return True

        current = now or datetime.now()
        is_weekend = current.weekday() >= 5
        minute_of_day = current.hour * 60 + current.minute

        if is_weekend:
            return 9 * 60 <= minute_of_day < 11 * 60
        else:
            return 6 * 60 <= minute_of_day < 8 * 60

    def get_settings(self) -> Dict[str, Any]:
        s = get_settings()
        effective_key = self._settings.get("gemini_api_key") or s.gemini_api_key
        return {
            "force_banner_active": bool(self._settings.get("force_banner_active", False)),
            "has_gemini_api_key": bool(effective_key),
            "gemini_api_key_masked": f"{effective_key[:6]}...{effective_key[-4:]}" if effective_key and len(effective_key) > 10 else "",
            "gemini_model": self._settings.get("gemini_model") or s.gemini_model or "gemini-3.7-flash",
        }

    def update_settings(self, new_settings: Dict[str, Any]) -> Dict[str, Any]:
        if "force_banner_active" in new_settings:
            self._settings["force_banner_active"] = bool(new_settings["force_banner_active"])
        if "gemini_api_key" in new_settings and new_settings["gemini_api_key"] is not None:
            self._settings["gemini_api_key"] = str(new_settings["gemini_api_key"]).strip()
        if "gemini_model" in new_settings and new_settings["gemini_model"]:
            self._settings["gemini_model"] = str(new_settings["gemini_model"]).strip()
        self._save_cache()
        return self.get_settings()

    def get_today_payload(self, date_str: Optional[str] = None, force_regenerate: bool = False) -> Dict[str, Any]:
        today_key = date_str or date.today().isoformat()
        cached_content = self._cache.get(today_key)
        if not force_regenerate and cached_content and content_fits_display_limits(cached_content):
            content = self._cache[today_key]
        else:
            if cached_content and not content_fits_display_limits(cached_content):
                logger.info("Regenerating kids daily content that exceeds the wall-display limits")
            content = self._generate_daily_content(today_key)
            self._cache[today_key] = content
            self._save_cache()

        is_active = self.is_active_morning_window()
        return {
            "date": today_key,
            "is_active_window": is_active,
            "force_active": bool(self._settings.get("force_banner_active", False)),
            "content": content,
        }

    def _get_recent_history(self, current_date_str: str, days_back: int = 60) -> Dict[str, Any]:
        """Collect recent words, categories, facts, and stem topics from past cache to prevent repetition."""
        used_words: Set[str] = set()
        used_word_list: List[str] = []
        recent_categories: Set[str] = set()
        recent_fact_snippets: List[str] = []
        recent_stem_topics: List[str] = []

        try:
            curr_d = date.fromisoformat(current_date_str)
        except Exception:
            curr_d = date.today()

        for d_str, day_data in self._cache.items():
            if d_str == current_date_str:
                continue
            try:
                d = date.fromisoformat(d_str)
                delta = (curr_d - d).days
                if 0 <= delta <= days_back:
                    # Word of the day
                    word_obj = day_data.get("word_of_the_day", {})
                    w = word_obj.get("word", "").strip()
                    if w:
                        used_words.add(w.lower())
                        used_word_list.append(w)

                    # Fun fact
                    fact_obj = day_data.get("fun_fact", {})
                    cat = fact_obj.get("category", "").strip()
                    fact = fact_obj.get("fact", "").strip()
                    if cat:
                        recent_categories.add(cat.lower())
                    if fact:
                        recent_fact_snippets.append(fact[:60])

                    # STEM topics
                    s5 = day_data.get("stem_5yo", {})
                    s9 = day_data.get("stem_9yo", {})
                    top5 = s5.get("topic", "").strip()
                    top9 = s9.get("topic", "").strip()
                    if top5:
                        recent_stem_topics.append(top5)
                    if top9:
                        recent_stem_topics.append(top9)
            except Exception:
                continue

        return {
            "used_words": used_words,
            "used_word_list": sorted(list(set(used_word_list))),
            "recent_categories": recent_categories,
            "recent_fact_snippets": recent_fact_snippets[-20:],
            "recent_stem_topics": list(set(recent_stem_topics))[-25:],
        }

    def _generate_daily_content(self, date_str: str) -> Dict[str, Any]:
        s = get_settings()
        api_key = self._settings.get("gemini_api_key") or s.gemini_api_key
        model_name = self._settings.get("gemini_model") or s.gemini_model or "gemini-3.7-flash"

        if api_key:
            try:
                ai_content = self._generate_with_gemini(date_str, api_key, model_name)
                if ai_content:
                    return ai_content
            except Exception as e:
                logger.error(f"Gemini generation failed for kids daily ({date_str}): {e}")

        # Sequential day-of-year rotation across all 31 comprehensive catalog items
        try:
            d = date.fromisoformat(date_str)
            day_index = (d.timetuple().tm_yday - 1) % len(FALLBACK_CATALOG)
        except Exception:
            day_index = hash(date_str) % len(FALLBACK_CATALOG)

        fallback = FALLBACK_CATALOG[day_index].copy()
        fallback["generated_by"] = "offline_catalog"
        return fallback

    def _generate_with_gemini(self, date_str: str, api_key: str, model_name: str) -> Optional[Dict[str, Any]]:
        from google import genai
        from google.genai import types
        import random
        import uuid

        client = genai.Client(api_key=api_key)
        history = self._get_recent_history(date_str, days_back=60)
        forbidden_words = history["used_words"]
        forbidden_word_list = history["used_word_list"]
        recent_cats = history["recent_categories"]
        recent_stem_topics = history["recent_stem_topics"]

        # Prioritize categories that have not been used recently
        fresh_categories = [
            c for c in KIDS_CATEGORIES
            if not any(rc in c.lower() or c.lower().startswith(rc) for rc in recent_cats)
        ]
        if len(fresh_categories) < 4:
            fresh_categories = KIDS_CATEGORIES.copy()
        sample_cats = random.sample(fresh_categories, 4)
        nonce = uuid.uuid4().hex[:8]

        forbidden_words_display = ", ".join(forbidden_word_list[-40:]) if forbidden_word_list else "None yet"
        forbidden_topics_display = ", ".join(recent_stem_topics[-20:]) if recent_stem_topics else "None yet"

        prompt = (
            f"Generate a completely fresh, creative, and inspiring daily morning educational kids bundle for {date_str} (Nonce: {nonce}).\n\n"
            f"STRICT DEDUPLICATION RULES (CRITICAL):\n"
            f"The following words and topics have ALREADY been featured recently and are STRICTLY FORBIDDEN:\n"
            f"- FORBIDDEN RECENT WORDS: {forbidden_words_display}\n"
            f"- FORBIDDEN RECENT TOPICS: {forbidden_topics_display}\n"
            f"DO NOT use any of the above forbidden words or any common variations/synonyms. You MUST select an entirely fresh, exciting vocabulary word and distinct STEM concepts.\n\n"
            f"Category inspiration themes for today:\n"
            f"- Word of the Day focus: {sample_cats[0]}\n"
            f"- Fun Fact focus: {sample_cats[1]}\n"
            f"- 5-Year-Old STEM challenge: {sample_cats[2]}\n"
            f"- 9-Year-Old STEM challenge: {sample_cats[3]}\n\n"
            "Requirements:\n"
            "1. word_of_the_day: A rich, fascinating vocabulary word related to science, exploration, nature, physics, or discovery. Include phonetic pronunciation, part of speech, kid-friendly definition, and an engaging example sentence. Pick a unique and uncommon word (do NOT default to 'Curious', 'Resilient', 'Bioluminescent', 'Barycenter', 'Keystone', or 'Resonance').\n"
            "2. fun_fact: An astonishing, true fact from science, animals, space, oceans, or planet Earth. Include a fitting emoji, specific category, and a short 1-sentence 'did_you_know' extension.\n"
            "3. stem_5yo: A curious, playful STEM question/riddle for a 5-year-old (kindergarten level) about physical observations in daily life. Include a helpful hint, a simple clear answer, and an engaging 'parent_explanation' for parents to discuss.\n"
            "4. stem_9yo: A thought-provoking STEM challenge for a 9-year-old (4th grade level) involving real physics, astronomy, engineering, chemistry, biology, or computing. Include a hint, a clear factual answer, and a deep conceptual 'parent_explanation'.\n\n"
            "Wall-display length limits (characters, including spaces): word 24, pronunciation 32, part of speech 16, definition 140, example 140; fun fact 180, category 32, did-you-know 180; each topic 40, question 160, hint 140, answer 200, and parent explanation 220. Write complete concise sentences within every limit—never use ellipses or incomplete phrases.\n\n"
            "CRITICAL: All 4 sections (Word, Fun Fact, 5yo STEM, 9yo STEM) MUST be completely fresh, unique, varied, and specific to the designated themes."
        )

        candidate_models = [model_name, "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"]
        unique_models = list(dict.fromkeys(candidate_models))

        # Up to 2 attempts across models to ensure non-repeating content
        for attempt in range(2):
            for m in unique_models:
                try:
                    gen_config = types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_json_schema=KIDS_DAILY_SCHEMA,
                        temperature=1.0 if attempt == 0 else 1.2,
                    )
                    if "3.7" in m:
                        gen_config.thinking_config = types.ThinkingConfig(thinking_budget=512)

                    resp = client.models.generate_content(
                        model=m,
                        contents=prompt,
                        config=gen_config,
                    )
                    data = json.loads(resp.text)
                    if not (
                        data.get("word_of_the_day")
                        and data.get("fun_fact")
                        and data.get("stem_5yo")
                        and data.get("stem_9yo")
                        and content_fits_display_limits(data)
                    ):
                        logger.warning("Generated kids daily content exceeded the wall-display limits")
                        continue

                    # Strict deduplication verification
                    generated_word = str(data["word_of_the_day"].get("word", "")).strip().lower()
                    if generated_word in forbidden_words:
                        logger.warning(f"Candidate word '{generated_word}' rejected because it was used recently. Retrying...")
                        continue

                    data["generated_by"] = f"gemini_ai ({m})"
                    return data
                except Exception as e:
                    logger.warning(f"Failed generation with model {m} (attempt {attempt + 1}): {e}")
                    continue

        return None

kids_daily_service = KidsDailyService()
