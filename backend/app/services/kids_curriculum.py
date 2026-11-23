"""Curriculum deck, morphological stemming, anti-cliché rules, and vector/lexical similarity helpers for Kids' Brain Nuggets."""

from __future__ import annotations

from array import array
import hashlib
import math
import operator
import random
import re
from typing import Any

# ---------------------------------------------------------------------------
# 8 Pillars × 20 Kid-Grounded Everyday Micro-Domains = 160 Distinct Subdomains
# Every subdomain is anchored in familiar things kids already see, touch, eat,
# play with, or learn about in elementary school—never obscure adult trivia or
# graduate-level jargon—so challenges deepen concepts they already know.
# ---------------------------------------------------------------------------
CURRICULUM_PILLARS: dict[str, list[str]] = {
    "history_civilizations": [
        "Sailing Ships, Maps & Finding Your Way",
        "Castles, Drawbridges & Stone Towers",
        "Sundials, Sand Timers & Telling Time",
        "How Paper, Pencils & Books Were Made",
        "Lighthouses, Foghorns & Guiding Boats",
        "Old-Fashioned Trains, Tracks & Tunnels",
        "Hot Air Balloons & Early Flying Machines",
        "Sending Letters, Messengers & Signal Flags",
        "Keeping Food Cold Before Refrigerators",
        "Windmills, Waterwheels & Grinding Grain",
        "Farms, Watering Crops & Growing Food",
        "Ancient Board Games & Counting Beads",
        "Bridges, Roads & Crossing Big Rivers",
        "Tents, Igloos & Homes Built for Tough Weather",
        "Coins, Scales & Trading at a Market",
        "Digging Up Fossils & Ancient Everyday Tools",
        "Canoes, Rafts & Boats Made from Nature",
        "Town Bells, Clocks & Knowing When to Meet",
        "Early Globes, Compasses & Exploring New Places",
        "Libraries, Scrolls & Saving Stories",
    ],
    "everyday_mechanics": [
        "Bicycles, Wheels, Gears & Brakes",
        "Cooking Heat, Boiling Water & Steam in the Kitchen",
        "Bridges, Triangles & Strong Building Shapes",
        "Keys, Door Locks & Hinges at Home",
        "Faucets, Pipes, Drains & Running Water",
        "Eyeglasses, Magnifying Glasses & Mirrors",
        "Echoes, Loud Rooms & Soft Carpets",
        "Swings, Slides & Seesaws on the Playground",
        "Zippers, Buttons, Velcro & Shoelaces",
        "Elevators, Pulleys & Lifting Heavy Things",
        "Flashlights, Switches & Simple Circuits",
        "Wheels, Rollers & Why Sliding Gets Sticky",
        "Vacuum Cleaners, Fans & Moving Air",
        "Springs, Trampolines & Bouncing Toys",
        "Markers, Paintbrushes & Soaking Up Ink",
        "Car Tires, Seatbelts & Stopping Safely",
        "Barcodes, Scanners & Beeping at Checkout",
        "Scissors, Can Openers & Kitchen Levers",
        "Solar Lights, Batteries & Storing Energy",
        "Thermometers & Telling Hot from Cold",
    ],
    "arts_animation_games": [
        "Flipbooks, Cartoons & Making Pictures Move",
        "Guitars, Pianos & How Strings Make Notes",
        "Flutes, Whistles & Blowing Air to Make Music",
        "Drums, Shakers & High vs. Low Sounds",
        "Mixing Paint Colors & Making New Shades",
        "Folding Paper Airplanes & Origami Shapes",
        "Shadows, Flashlights & Puppet Shows",
        "Building Blocks, LEGO Towers & Balance",
        "Dice, Spinners & Fair Board Games",
        "Patterns, Tiles & Matching Symmetry",
        "Drawing Far-Away vs. Up-Close Things",
        "Movie Sound Effects Made with Everyday Items",
        "Clay Sculpting, Playdough & Baking Pottery",
        "Stained Glass, Prisms & Colored Light",
        "Weaving, Knitting & Patterns in Clothes",
        "Singing, Humming & How Your Voice Works",
        "Kaleidoscopes, Mirrors & Repeating Shapes",
        "Puzzles, Mazes & Finding Hidden Clues",
        "Crayons, Chalk & Why They Leave Marks",
        "Outdoor Stages, Megaphones & Carrying Sound",
    ],
    "living_world_biology": [
        "How Seeds Travel by Wind, Water & Animals",
        "Ants, Bees & How Insects Build Homes",
        "Birds, Feathers, Wings & Building Nests",
        "Ocean Animals, Fins, Gills & Swimming",
        "How Plants Drink Water Through Roots & Stems",
        "Frogs, Tadpoles, Caterpillars & Growing Up",
        "How Dogs, Cats & Owls Use Super Senses",
        "Trees, Bark, Rings & Leaves Changing Color",
        "Bears, Squirrels & Getting Ready for Winter",
        "Animal Camouflage, Stripes & Hiding in Nature",
        "Tidepools, Crabs, Shells & Beach Creatures",
        "Spiders, Sticky Webs & Feeling Vibrations",
        "Cacti, Camels & Saving Water in the Desert",
        "How Birds & Butterflies Find Their Way Home",
        "Animal Teeth, Beaks & What They Eat",
        "Geckos, Ducks & Walking on Water or Walls",
        "Flowers, Bees & Why Plants Need Sunlight",
        "Bones, Muscles & How Your Body Moves",
        "Your Heart, Lungs & Breathing When You Run",
        "Taste, Smell & Your Five Senses",
    ],
    "earth_weather_oceans": [
        "Rain, Clouds & Where Puddles Go",
        "Snowflakes, Ice, Frost & Melting",
        "Wind, Breezes & Flying a Kite",
        "Thunder, Lightning & Rainbows After Storms",
        "Rivers, Streams & Smooth Round Pebbles",
        "Ocean Waves, Sandy Beaches & Tides",
        "Caves, Underground Water & Dripping Rocks",
        "Earthquakes, Shaking Ground & Earth's Layers",
        "Mountains, Hills & Why Mountaintops Are Cold",
        "Sand Dunes, Deserts & Wind-Shaped Land",
        "Volcanoes, Lava & Hot Springs",
        "Soil, Earthworms & Helping Gardens Grow",
        "Fossils, Dinosaur Tracks & Old Rocks",
        "Day, Night & Why Seasons Change",
        "Shade, Sunbeams & Why Pavement Gets Hot",
        "Fog, Dewdrops & Morning Mist on Grass",
        "Glaciers, Icebergs & Floating Ice",
        "Ponds, Lakes & Why Water Freezes on Top",
        "Forests, Rain & How Trees Cool the Air",
        "Weather Forecasts, Clouds & Warm vs. Cold Air",
    ],
    "space_physics": [
        "The Sun, Shadows & Why Shadows Change Size",
        "The Moon, Craters & Its Changing Shapes",
        "Stars, Constellations & Why Stars Twinkle",
        "Planets, Moons & Our Solar System",
        "Gravity & Why Everything Falls Down",
        "Floating, Sinking & Why Heavy Boats Float",
        "Pulleys, Ramps & Moving Heavy Loads",
        "Spinning Tops, Yo-Yos & Staying Upright",
        "Comets, Shooting Stars & Space Rocks",
        "Light, Mirrors, Reflections & Bending Beams",
        "Static Electricity, Balloons & Hair Standing Up",
        "Rockets, Parachutes & Landing Safely",
        "Solar & Lunar Eclipses & Space Shadows",
        "Balance, Tightropes & Not Tipping Over",
        "Sound Traveling Through Air, Water & Solids",
        "Telescopes, Binoculars & Seeing Far Away",
        "Water Drops, Soap Bubbles & Surface Skin",
        "Air Pressure, Straws & Suction Cups",
        "Magnets, Poles & Invisible Pulling Forces",
        "Heat Making Things Expand, Rise & Shrink",
    ],
    "materials_food_chemistry": [
        "Ice, Liquid Water & Steam Changing States",
        "Yeast, Bubbles & Why Bread Dough Rises",
        "Salt, Sugar & Crystals You Can Grow",
        "Metals, Wood & Plastic Around the House",
        "Paper, Cardboard & Why Folded Paper Is Strong",
        "Oil, Water & Why Salad Dressing Separates",
        "Rubber Bands, Bouncy Balls & Stretching Back",
        "Toasting Bread, Cooking & Tasty Smells",
        "Lemons, Baking Soda & Fizzy Kitchen Reactions",
        "Mud, Clay & Hardening Bricks in Heat",
        "Sponges, Paper Towels & Soaking Up Spills",
        "Filtering Dirty Water with Sand & Cloth",
        "Rock Candy, Popsicles & Freezing Treats",
        "Glue, Tape & Why Sticky Things Hold On",
        "Why Cut Apples Turn Brown & Metal Rusts",
        "Milk, Butter, Cheese & Turning Liquids Solid",
        "Coats, Blankets & Trapping Warm Air",
        "Sweating, Wet Skin & How Breezes Cool You",
        "Soap, Suds & Washing Greasy Hands Clean",
        "Candles, Melting Wax & Flame Light",
    ],
    "world_cultures_language": [
        "Fun Origins of Everyday Words & Phrases",
        "Alphabets, Picture Writing & Secret Codes",
        "Calendars, Months, Leap Years & Holidays",
        "Maps, North-South-East-West & Reading Legends",
        "Boats, Kayaks & Getting Across Water",
        "Measuring Length, Weight & Cooking Cups",
        "Road Signs, Traffic Lights & Visual Symbols",
        "Homes Around the World for Hot & Cold Climates",
        "Counting Systems, Abacuses & Number Tricks",
        "Musical Instruments from Around the World",
        "Everyday Sayings & What They Really Mean",
        "Braille, Sign Language & Ways People Communicate",
        "Kites, Pinwheels & Wind Toys Around the World",
        "Foods, Spices & Crops Grown Around the World",
        "Snowshoes, Skis & Walking on Deep Snow",
        "Braiding, Knots & Making Strong Rope",
        "Clocks, Time Zones & Morning Across the Earth",
        "Why Cities, Rivers & Places Get Their Names",
        "Rhymes, Songs & Tricks for Remembering Things",
        "Raincoats, Boots & Clothes for Different Weather",
    ],
}

# Age- and role-calibrated lenses so each card matches how that child actually thinks
LENSES_FUN_FACT: list[str] = [
    "Share a 'Wait, really?!' surprise about an animal, food, body part, or everyday object both a 5-year-old and 9-year-old already know.",
    "Use a vivid size, speed, or count comparison kids can picture using familiar things (like school buses, basketballs, or heartbeats).",
    "Highlight a clever hidden detail in something kids see almost every day at home, outside, or in the sky.",
    "Connect something cool in nature to a familiar human tool, toy, or habit kids recognize right away.",
    "Reveal a surprising way an animal or plant solves an everyday problem (staying warm, finding food, moving around, staying safe).",
    "Explain a fun, true twist behind a familiar food, sound, weather event, or game kids love.",
]

LENSES_YOUNG: list[str] = [
    "Ask about something a 5-year-old has seen, touched, eaten, or done at home, outside, or at school.",
    "Use a simple 'What happens if...' or 'Why does...' puzzle comparing two familiar things (hot/cold, wet/dry, heavy/light, sunny/shady).",
    "Ask how an animal's body part (feathers, paws, whiskers, shell, fur, beak) helps it do an everyday job.",
    "Use a concrete 1-step cause-and-effect question a kindergartener can guess from their own senses (seeing, feeling, hearing).",
    "Ask about a simple thing they can test or spot right in the kitchen, bathtub, backyard, or playground.",
    "Build on a basic idea a 5-year-old already knows (ice melts, shadows need light, wind pushes things, plants need water) and ask them to apply it.",
]

LENSES_OLDER: list[str] = [
    "Take a familiar everyday object or natural event and ask WHY it works that way, deepening a 3rd/4th-grade science idea.",
    "Ask them to compare two familiar designs or materials (e.g., metal vs. wood, triangle vs. square, wide vs. narrow) and reason out why one works better.",
    "Use a 2-step cause-and-effect puzzle (e.g., change A causes B, which makes C happen) using plain, relatable words.",
    "Focus on a hands-on thought experiment they could test at home, outside, or in the kitchen to prove the answer.",
    "Focus on how shape, balance, air, heat, light, or sound does the work in something they actually see or use.",
    "Connect a concept they've seen in school (gravity, magnets, shadows, weather, habitats, simple machines) to a surprising real-world situation.",
]

# Backwards-compatible combined list
CURRICULUM_LENSES: list[str] = [*LENSES_FUN_FACT, *LENSES_OLDER]

VOCABULARY_ARCHETYPES: list[str] = [
    "an expressive Tier-2 VERB of lively movement, craft, or discovery kids can act out and use in stories",
    "a vivid Tier-2 ADJECTIVE describing mood, texture, weather, or atmosphere in storytelling",
    "a warm Tier-2 character-strength or mindset word kids can use in everyday family conversations",
    "a crisp Tier-2 NOUN naming a clever pattern, clue, obstacle, or turning point in stories and life",
    "a sensory Tier-2 word capturing sound, rhythm, shimmer, echo, or motion",
    "a resourceful Tier-2 word about problem-solving, improvising, or careful observation",
    "a playful Tier-2 word for commotion, surprise, curiosity, or lively conversation",
    "a precise Tier-2 word describing balance, sturdiness, gradual change, or transformation",
    "a classic children's-literature Tier-2 word (Roald Dahl / E.B. White / Kate DiCamillo reading level)",
    "an adventurous Tier-2 word about journeys, teamwork, perseverance, or charting a path",
]

CLICHE_BLOCKLIST_PROMPT = (
    "OVERUSED TRIVIA CLICHÉS — STRICTLY BANNED (never generate any of these):\n"
    "- Sea otters holding hands or wrapping in kelp\n"
    "- Honey never spoiling in Egyptian tombs\n"
    "- Tardigrades (water bears) surviving outer space\n"
    "- Naica Cave of the Crystals / giant Mexican gypsum crystals\n"
    "- Velcro invented from burrs on a dog walk\n"
    "- Popsicles accidentally left outside with a stirring stick\n"
    "- Popcorn popping from trapped water steam\n"
    "- Shoelaces untying from foot stomp + leg swing\n"
    "- Mariana snailfish or Mariana Trench pressure clichés\n"
    "- Mantis shrimp punch or octopus having three hearts\n"
    "- Bananas being berries / strawberries not being berries\n"
    "- Venus spinning clockwise / day longer than its year\n"
    "- Flamingo pink diet, wombat cube poop, or sloth moss\n"
    "- Eiffel Tower growing taller in summer heat\n"
    "- Early 8-bit Mario pixel memory limits or Pac-Man pizza slice\n"
    "- Why yawns are contagious or birds sitting safely on power lines"
)

MYTH_BLOCKER_PROMPT = (
    "SCIENTIFIC & HISTORICAL ACCURACY GUARDRAILS:\n"
    "- Never repeat debunked schoolyard myths (e.g., ostriches burying heads, medieval window glass flowing like liquid, "
    "tongue taste-map zones, goldfish 3-second memory, bulls angered by red color, Coriolis effect spinning sink drains, "
    "Great Wall of China visible to the naked eye from the Moon, chameleons changing color primarily for camouflage, "
    "or airplanes flying solely because air must meet at the trailing edge at the same time).\n"
    "- Both STEM challenges MUST be deducible 'Why / How / What happens when' reasoning puzzles—never obscure date/name lookup trivia—and each hint must give a concrete physical clue kids can reason from."
)

# Graduate-level taxonomy / medical / chemical suffixes & obscure jargon unsuitable as a kid's daily usable word
_JARGON_SUFFIXES = (
    "toxin",
    "troph",
    "trophy",
    "nasty",
    "phyte",
    "phile",
    "morph",
    "cide",
    "ectomy",
    "itis",
    "osis",
    "pathy",
    "plasia",
    "lysis",
)

_BANNED_OBSCURE_WORDS = {
    "vellichor",
    "petrichor",
    "sonder",
    "stabilimentum",
    "pulvinus",
    "ecdysis",
    "aposematic",
    "cursorial",
    "mesopredator",
    "batrachotoxin",
    "rhizomorph",
    "chemotroph",
    "thigmonasty",
    "xerophyte",
    "thermophile",
    "barycenter",
    "periapsis",
    "apoapsis",
    "chemosynthesis",
    "hadal",
    "benthic",
    "serac",
    "druse",
    "tektite",
    "hyphae",
    "xylem",
    "phloem",
    "efflorescence",
}

_STOPWORDS = {
    "about", "above", "across", "after", "again", "against", "almost", "along", "already", "also",
    "always", "among", "ancient", "animal", "animals", "another", "answer", "around", "away", "back",
    "because", "become", "becomes", "been", "before", "behind", "being", "below", "between", "both",
    "build", "built", "called", "calls", "cannot", "change", "changes", "children", "clear", "close",
    "come", "comes", "common", "could", "create", "creates", "daily", "different", "discover", "does",
    "doing", "down", "during", "each", "early", "earth", "easily", "easy", "either", "energy", "enough",
    "even", "every", "everyday", "example", "explain", "extra", "fact", "fast", "faster", "feel", "find",
    "first", "five", "found", "four", "from", "full", "giant", "give", "gives", "going", "good", "great",
    "ground", "group", "grow", "hand", "hands", "happen", "happens", "hard", "have", "having", "heavy",
    "help", "helps", "here", "high", "higher", "history", "hold", "holds", "home", "house", "huge",
    "human", "humans", "hundred", "hundreds", "idea", "important", "inside", "instead", "into", "invented",
    "invention", "inventions", "itself", "just", "keep", "keeps", "kids", "kind", "kinds", "know", "known",
    "large", "largest", "last", "later", "learn", "less", "life", "light", "like", "line", "little",
    "live", "living", "long", "longer", "look", "looks", "made", "make", "makes", "making", "many",
    "matter", "mean", "means", "might", "million", "millions", "modern", "more", "most", "move", "moves",
    "moving", "much", "must", "name", "named", "natural", "nature", "near", "need", "needs", "never",
    "next", "night", "normal", "nothing", "object", "objects", "often", "once", "only", "open", "other",
    "others", "outside", "over", "part", "parts", "past", "people", "physics", "place", "places", "point",
    "points", "power", "push", "pull", "question", "quickly", "quite", "rather", "reach", "real", "really",
    "reason", "right", "round", "same", "science", "scientist", "scientists", "second", "seem", "seems",
    "seen", "shape", "shaped", "short", "show", "shows", "side", "sides", "simple", "since", "single",
    "size", "slow", "slowly", "small", "smaller", "smooth", "soft", "some", "something", "sometimes",
    "sound", "space", "special", "start", "starts", "stay", "stays", "still", "stop", "strong", "study",
    "stuff", "such", "suddenly", "surface", "system", "take", "takes", "tall", "tell", "than", "that",
    "their", "them", "then", "there", "these", "they", "thick", "thin", "thing", "things", "think",
    "this", "those", "thousand", "thousands", "three", "through", "time", "times", "tiny", "today",
    "together", "turn", "turns", "under", "until", "used", "uses", "using", "usually", "very", "warm",
    "water", "ways", "well", "were", "what", "when", "where", "which", "while", "whole", "with", "within",
    "without", "wonder", "wonders", "word", "work", "works", "world", "would", "year", "years", "your",
}


def sanitize_and_validate_word(raw_word: str) -> tuple[str, Optional_str]:
    """Return (clean_capitalized_word, error_reason_or_None)."""
    cleaned = re.sub(r"\s+", " ", (raw_word or "").strip()).strip("\"'`.,!?;:()[]{}")
    if not cleaned:
        return "", "empty vocabulary word"
    if not re.fullmatch(r"[A-Za-z]+(?:-[A-Za-z]+)?", cleaned):
        return cleaned, f"invalid word characters in '{cleaned}'"
    lower = cleaned.lower()
    if len(lower) < 4:
        return cleaned, f"word '{cleaned}' is too short"
    if lower in _BANNED_OBSCURE_WORDS:
        return cleaned, f"obscure technical jargon '{cleaned}'"
    if any(lower.endswith(suf) and len(lower) > len(suf) + 2 for suf in _JARGON_SUFFIXES):
        return cleaned, f"technical jargon suffix in '{cleaned}'"
    # Capitalize leading letter while keeping rest clean lowercase (e.g. "Nimble", "Good-natured")
    display_word = cleaned[0].upper() + cleaned[1:].lower()
    return display_word, None


Optional_str = str | None


# Ordered longest-first derivational/inflectional suffixes for lightweight English root equivalence
_STEM_SUFFIXES = (
    "ational", "fulness", "ousness", "iveness", "ization", "isation",
    "escence", "escent", "ability", "ibility", "logical", "graphic",
    "ation", "ition", "usion", "ement", "ancie", "encie", "ingly",
    "fully", "ously", "ively", "ality", "icity", "osity", "ature",
    "ance", "ence", "able", "ible", "ment", "ness", "ship", "less",
    "ious", "eous", "ical", "ular", "ward", "wise", "logy",
    "ing", "ion", "ity", "ive", "ous", "ful", "ant", "ent", "ist", "ism",
    "ate", "ize", "ise", "ify", "ic", "al", "ly", "ed", "er", "or", "es", "s",
)


def compute_word_stem(word: str) -> str:
    """Compute a normalized morphological root (>=4 chars) so 'Resonance' matches 'Resonant', 'Luminous' matches 'Luminescent', etc."""
    w = re.sub(r"[^a-z]", "", (word or "").lower())
    if len(w) <= 5:
        return w
    # Up to 2 passes for compound suffixes like "gravitation-al", "architect-ur-al", "lumin-esc-ent"
    for _ in range(2):
        changed = False
        for suf in _STEM_SUFFIXES:
            min_root = 5 if suf in ("ity", "ic", "al", "er", "or", "ed", "es", "s") else 4
            if w.endswith(suf) and len(w) - len(suf) >= min_root:
                w = w[: -len(suf)]
                changed = True
                break
        if not changed:
            break
    # Strip trailing silent 'e', '-y', or '-ur' ("gravity" -> "gravit", "architectur" -> "architect")
    if w.endswith("ur") and len(w) - 2 >= 5:
        w = w[:-2]
    if w.endswith(("e", "y", "o")) and len(w) - 1 >= 5:
        w = w[:-1]
    # Collapse doubled trailing consonants ("runn" -> "run")
    if len(w) >= 5 and w[-1] == w[-2]:
        w = w[:-1]
    return w


def normalize_subject_key(raw_key: str, fallback_text: str = "") -> str:
    """Normalize a canonical subject_key slug (2-4 content tokens joined by underscores)."""
    tokens = [
        t for t in re.findall(r"[a-z0-9]+", (raw_key or "").lower())
        if len(t) > 2 and t not in _STOPWORDS
    ]
    if not tokens and fallback_text:
        tokens = extract_entity_tokens(fallback_text)[:4]
    # Stem individual tokens lightly so "roller_coasters" == "roller_coaster"
    norm_tokens: list[str] = []
    for tok in tokens[:5]:
        t = tok[:-1] if len(tok) > 4 and tok.endswith("s") and not tok.endswith("ss") else tok
        if t not in norm_tokens:
            norm_tokens.append(t)
    return "_".join(norm_tokens[:4])


def extract_entity_tokens(text: str) -> list[str]:
    """Extract ordered distinctive content tokens (excluding generic English & science filler stopwords)."""
    raw_tokens = re.findall(r"[a-z0-9]+", (text or "").lower())
    seen: set[str] = set()
    result: list[str] = []
    for tok in raw_tokens:
        if len(tok) <= 3 or tok in _STOPWORDS or tok.isdigit():
            continue
        # Light plural singularization
        if len(tok) > 5 and tok.endswith("ies"):
            norm = tok[:-3] + "y"
        elif len(tok) > 4 and tok.endswith("es") and tok[-3] in "sxz":
            norm = tok[:-2]
        elif len(tok) > 4 and tok.endswith("s") and not tok.endswith("ss") and not tok.endswith("us"):
            norm = tok[:-1]
        else:
            norm = tok
        if norm in _STOPWORDS or len(norm) <= 3:
            continue
        if norm not in seen:
            seen.add(norm)
            result.append(norm)
    return result


# ---------------------------------------------------------------------------
# Compact 512-dim Matryoshka Embedding Packing & Pure-Python Lexical Fallback
# ---------------------------------------------------------------------------
EMBEDDING_DIM = 512


def pack_embedding(vec: list[float], dim: int = EMBEDDING_DIM) -> bytes:
    """Slice first `dim` Matryoshka dimensions, L2-normalize, and pack as float32 bytes (2 KB)."""
    sliced = vec[:dim]
    if not sliced:
        return b""
    norm = math.sqrt(sum(x * x for x in sliced))
    if norm <= 1e-12:
        return b""
    arr = array("f", (x / norm for x in sliced))
    return arr.tobytes()


def unpack_embedding(blob: bytes | None) -> array | None:
    if not blob:
        return None
    arr = array("f")
    arr.frombytes(blob)
    return arr


def cosine_packed(a: array | None, b: array | None) -> float:
    """Fast dot-product cosine similarity on pre-normalized float32 arrays."""
    if a is None or b is None or len(a) != len(b) or not a:
        return 0.0
    return float(sum(map(operator.mul, a, b)))


def build_idf_weights(documents: list[str]) -> dict[str, float]:
    """Compute smoothed IDF weights over historical concept summaries for accurate lexical fallback."""
    n_docs = len(documents) + 1
    df: dict[str, int] = {}
    for doc in documents:
        for tok in set(extract_entity_tokens(doc)):
            df[tok] = df.get(tok, 0) + 1
    return {tok: math.log(1.0 + n_docs / (1.0 + count)) for tok, count in df.items()}


def lexical_concept_similarity(left: str, right: str, idf: dict[str, float] | None = None) -> float:
    """IDF-weighted content-stem cosine similarity that catches paraphrased repeats even without embeddings."""
    toks_a = [compute_word_stem(t) for t in extract_entity_tokens(left)]
    toks_b = [compute_word_stem(t) for t in extract_entity_tokens(right)]
    if not toks_a or not toks_b:
        return 0.0
    weights_a: dict[str, float] = {}
    weights_b: dict[str, float] = {}
    default_w = 2.0
    for raw, stem in zip(extract_entity_tokens(left), toks_a):
        w = idf.get(raw, default_w) if idf else default_w
        weights_a[stem] = max(weights_a.get(stem, 0.0), w)
    for raw, stem in zip(extract_entity_tokens(right), toks_b):
        w = idf.get(raw, default_w) if idf else default_w
        weights_b[stem] = max(weights_b.get(stem, 0.0), w)

    common = set(weights_a) & set(weights_b)
    if not common:
        return 0.0
    dot = sum(weights_a[k] * weights_b[k] for k in common)
    norm_a = math.sqrt(sum(v * v for v in weights_a.values()))
    norm_b = math.sqrt(sum(v * v for v in weights_b.values()))
    return dot / (norm_a * norm_b) if norm_a and norm_b else 0.0


# ---------------------------------------------------------------------------
# Grade-level helper for dynamic kid ages
# ---------------------------------------------------------------------------
def age_to_grade_label(age: int) -> str:
    mapping = {
        3: "preschool",
        4: "pre-K",
        5: "kindergarten",
        6: "1st grade",
        7: "2nd grade",
        8: "3rd grade",
        9: "4th grade",
        10: "5th grade",
        11: "6th grade",
        12: "7th grade",
        13: "8th grade",
        14: "9th grade",
    }
    if age < 3:
        return "toddler"
    return mapping.get(age, f"age {age} / high school")


# ---------------------------------------------------------------------------
# Deterministic Without-Replacement Curriculum Deck
# ---------------------------------------------------------------------------
def default_deck_state() -> dict[str, Any]:
    return {
        "pillar_queues": {},       # pillar -> remaining shuffled subdomain indices
        "pillar_passes": {},       # pillar -> integer number of completed full sweeps
        "pillar_ring": [],         # shuffled order of the 8 pillars
        "vocab_index": 0,          # monotonic counter for VOCABULARY_ARCHETYPES
        "lens_cursor": 0,          # monotonic counter for CURRICULUM_LENSES
        "last_drawn_date": "",
        "last_assignment": None,
    }


def draw_daily_curriculum(state: dict[str, Any] | None, date_str: str) -> tuple[dict[str, Any], dict[str, Any]]:
    """
    Deterministically draw 3 distinct (pillar, subdomain, lens) assignments + 1 vocabulary archetype
    without replacement. Calling again for the same `date_str` returns the same assignment idempotently;
    calling on regeneration (`force_advance=True` handled by caller clearing `last_drawn_date`) advances cleanly.
    """
    st = {**default_deck_state(), **(state or {})}
    if st.get("last_drawn_date") == date_str and st.get("last_assignment"):
        return st, st["last_assignment"]

    rng_seed = int(hashlib.sha256(f"nivas-kids-deck:{date_str}:{st.get('lens_cursor', 0)}".encode()).hexdigest()[:12], 16)
    rng = random.Random(rng_seed)

    all_pillars = list(CURRICULUM_PILLARS.keys())
    ring: list[str] = list(st.get("pillar_ring") or [])

    chosen_pillars: list[str] = []
    while len(chosen_pillars) < 3:
        if not ring:
            ring = all_pillars[:]
            rng.shuffle(ring)
            # Avoid picking a pillar already in chosen_pillars at the seam between two rings
            ring.sort(key=lambda p: 1 if p in chosen_pillars else 0)
        cand = ring.pop(0)
        if cand not in chosen_pillars:
            chosen_pillars.append(cand)

    pillar_queues: dict[str, list[int]] = {k: list(v) for k, v in (st.get("pillar_queues") or {}).items()}
    pillar_passes: dict[str, int] = {k: int(v) for k, v in (st.get("pillar_passes") or {}).items()}

    cards: list[dict[str, str]] = []
    lens_cursor = int(st.get("lens_cursor", 0))
    slot_lenses = (LENSES_FUN_FACT, LENSES_YOUNG, LENSES_OLDER)
    for slot_idx, pillar in enumerate(chosen_pillars):
        subdomains = CURRICULUM_PILLARS[pillar]
        queue = pillar_queues.get(pillar) or []
        if not queue:
            pass_num = pillar_passes.get(pillar, 0) + (1 if pillar in pillar_queues else 0)
            pillar_passes[pillar] = pass_num
            queue = list(range(len(subdomains)))
            random.Random(rng_seed ^ (pass_num + 1) * 7919 ^ hash(pillar)).shuffle(queue)
        sub_idx = queue.pop(0)
        pillar_queues[pillar] = queue

        pass_offset = pillar_passes.get(pillar, 0)
        lens_pool = slot_lenses[slot_idx]
        lens_idx = (lens_cursor + slot_idx * 2 + pass_offset) % len(lens_pool)
        cards.append(
            {
                "pillar": pillar,
                "subdomain": subdomains[sub_idx],
                "lens": lens_pool[lens_idx],
            }
        )

    vocab_idx = int(st.get("vocab_index", 0))
    vocab_archetype = VOCABULARY_ARCHETYPES[vocab_idx % len(VOCABULARY_ARCHETYPES)]

    assignment = {
        "date_str": date_str,
        "vocab_archetype": vocab_archetype,
        "fun_fact": cards[0],
        "stem_5yo": cards[1],
        "stem_9yo": cards[2],
    }

    new_state = {
        "pillar_queues": pillar_queues,
        "pillar_passes": pillar_passes,
        "pillar_ring": ring,
        "vocab_index": vocab_idx + 1,
        "lens_cursor": lens_cursor + 1,
        "last_drawn_date": date_str,
        "last_assignment": assignment,
    }
    return new_state, assignment
