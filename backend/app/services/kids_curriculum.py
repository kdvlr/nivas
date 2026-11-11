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
# 8 Pillars × 20 Spoiler-Free Micro-Domains = 160 Distinct Subdomains
# Zero specific trivia spoilers are embedded in labels so the LLM explores the
# genuine domain rather than anchoring on hardcoded examples.
# ---------------------------------------------------------------------------
CURRICULUM_PILLARS: dict[str, list[str]] = {
    "history_civilizations": [
        "Ancient Maritime Navigation & Star Charts",
        "Medieval Craft Guilds, Workshops & Apprentices",
        "Pre-Columbian Roads, Terraces & Suspension Bridges",
        "Historical Postal Relays, Signal Towers & Couriers",
        "Sundials, Water Clocks & Mechanical Escapements",
        "Early Papermaking, Bookbinding & Movable Type",
        "Lighthouse Optics, Fog Signals & Coastal Safety",
        "Ancient Irrigation, Canals & Gravity Waterworks",
        "Archaeological Stratigraphy & Preserved Settlements",
        "Historical Mapmaking, Globes & Sea Explorers",
        "Nomadic Shelters, Caravans & Desert Trade Routes",
        "Ancient Observatories, Solstices & Stone Alignments",
        "Castles, Fortifications & Timber Framing",
        "Steam Locomotives, Tunnels & Railway Signaling",
        "Early Submersibles, Diving Bells & Harbor Engineering",
        "Historical Libraries, Scrolls & Wax Tablets",
        "Windmills, Waterwheels & Grain Milling",
        "Ice Houses, Salt Curing & Pre-Electric Food Preservation",
        "Early Aviation Gliders, Balloons & Control Surfaces",
        "Ancient Games of Strategy, Counting Boards & Tallies",
    ],
    "everyday_mechanics": [
        "Pin-Tumbler Locks, Keys & Mechanical Safes",
        "Kitchen Heat Transfer, Boiling & Convection",
        "Truss, Arch & Cable-Stayed Bridge Mechanics",
        "Looms, Weaving Patterns & Knitted Textiles",
        "Municipal Water Towers, Traps & Siphons",
        "Eyeglasses, Magnifiers & Curved Mirrors",
        "Room Acoustics, Soundproofing & Echoes",
        "Gears, Ratchets, Freewheels & Bicycle Drivetrains",
        "Thermostats, Bimetallic Strips & Home Sensors",
        "Zippers, Clasps, Buckles & Threaded Fasteners",
        "Elevators, Counterweights & Safety Brakes",
        "Touchscreens, Capacitors & Everyday Circuits",
        "Ball Bearings, Lubrication & Rolling Friction",
        "Vacuum Cleaners, Fans & Pressure Differences",
        "Pendulums, Metronomes & Harmonic Motion",
        "Fountain Pens, Capillary Action & Ink Flow",
        "Pneumatic Tires, Shock Absorbers & Traction",
        "Barcodes, QR Grids & Optical Scanners",
        "Sewing Machines, Bobbins & Lockstitches",
        "Solar Panels, Photons & Rooftop Energy",
    ],
    "arts_animation_games": [
        "Theatrical Stagecraft, Trapdoors & Pepper's Ghost",
        "Stop-Motion Armatures, Miniature Sets & Lighting",
        "Bowed Strings, Soundboards & Wood Resonance",
        "Brass & Woodwind Air Columns & Valves",
        "Percussion Membranes, Chimes & Pitch",
        "Perspective Drawing, Vanishing Points & Foreshortening",
        "Historical Mineral Pigments, Frescoes & Natural Dyes",
        "Typography, Serif Shapes & Printing Plates",
        "Masonry Domes, Flying Buttresses & Vaults",
        "Origami Geometry, Crease Patterns & Folding Structures",
        "Optical Toys, Phenakistoscopes & Frame Persistence",
        "Puppetry Joints, Rod Controls & Shadow Theater",
        "Mosaic Tessellations, Symmetry & Tile Geometry",
        "Acoustic Amphitheaters & Concert Hall Geometry",
        "Cinematography Lenses, Shutter Angles & Depth of Field",
        "Sculpture Casting, Lost-Wax Molds & Patinas",
        "Board Game Probability, Polyhedral Dice & Fair Balance",
        "Calligraphy Nibs, Brushstrokes & Handmade Parchment",
        "Stained Glass Leading, Kiln Firing & Colored Light",
        "Sound Effects Craft, Acoustic Props & Room Tone",
    ],
    "living_world_biology": [
        "Seed Dispersal Aerodynamics, Hooks & Pods",
        "Termite Mounds, Hive Ventilation & Insect Architecture",
        "Bird Wing Slots, Thermal Soaring & Feather Structure",
        "Deep-Sea Pressure Adaptations & Bioluminescence",
        "Mutualism, Cleaner Fish & Fungal Root Networks",
        "Microscopic Pond Life, Cilia & Single-Celled Motion",
        "Echolocation, Lateral Lines & Animal Bio-Sensors",
        "Tree Rings, Bark Armor & Sap Transport",
        "Hibernation, Torpor & Cold-Weather Animal Physiology",
        "Camouflage Countershading, Disruptive Patterns & Mimicry",
        "Coral Polyps, Calcium Reefs & Tidepool Survival",
        "Spider Silk Chemistry, Orb Geometry & Vibrations",
        "Amphibian Skin Breathing, Metamorphosis & Wetlands",
        "Desert Water Harvesting in Beetles, Lizards & Cacti",
        "Migratory Navigation by Sun Angles, Stars & Magnetism",
        "Beaks, Teeth & Specialized Animal Feeding Tools",
        "Animal Locomotion on Water Surfaces, Mud & Vertical Walls",
        "Plant Tropisms, Sun Tracking & Rapid Leaf Movements",
        "Vertebrate Skeletons, Hollow Bones & Joint Leverage",
        "Pollinator Ultraviolet Vision, Nectar Guides & Scents",
    ],
    "earth_weather_oceans": [
        "Snowflake Dendrites, Supercooled Droplets & Frost",
        "Ocean Gyres, Thermohaline Circulation & Upwelling",
        "Alpine Glaciers, Moraines & Ancient Ice Cores",
        "Limestone Karst Caves, Stalactites & Underground Streams",
        "Seismic Waves, Fault Lines & Earth's Layered Core",
        "Jet Streams, Trade Winds & Rain Shadows",
        "River Meanders, Oxbow Lakes & Delta Sediment",
        "Tidal Bores, Spring Tides & Coastal Estuaries",
        "Atmospheric Scattering, Twilight Colors & Halos",
        "Sand Dunes, Wind Ripples & Singing Sands",
        "Volcanic Basalt Columns, Calderas & Geothermal Vents",
        "Monsoons, Sea Breezes & Land-Ocean Heating",
        "Soil Horizons, Decomposers & Mineral Weathering",
        "Continental Drift, Mid-Ocean Ridges & Fossils",
        "Thunderhead Updrafts, Hailstone Layers & Static Charge",
        "Fjords, Sea Stacks & Wave Refraction on Coastlines",
        "Permafrost, Tundra Polygons & Polar Daylight Cycles",
        "Natural Springs, Artesian Wells & Aquifers",
        "Kelp Forests, Continental Shelves & Marine Snow",
        "Barometric Pressure, Isobars & Weather Fronts",
    ],
    "space_physics": [
        "Gravity Assists, Orbital Slingshots & Escape Velocity",
        "Subsurface Oceans on Icy Moons of Jupiter & Saturn",
        "Starlight Absorption Lines, Star Colors & Temperature",
        "Planetary Magnetospheres, Solar Wind & Auroras",
        "Speed of Sound Across Air, Water & Solid Steel",
        "Archimedes Buoyancy, Ballast Tanks & Submarines",
        "Block-and-Tackle Pulleys, Winches & Mechanical Advantage",
        "Gyroscopes, Angular Momentum & Spinning Tops",
        "Comet Tails, Asteroid Belts & Meteor Showers",
        "Refraction, Total Internal Reflection & Fiber Optics",
        "Static Electricity, Insulators & Conductors",
        "Spacecraft Heat Shields, Parachutes & Retro-Rockets",
        "Solar & Lunar Eclipses, Umbra Shadows & Orbit Tilt",
        "Center of Mass, Tightrope Poles & Cantilever Balance",
        "Doppler Pitch Shifts in Sirens, Radar & Starlight",
        "Space Telescopes, Segmented Mirrors & Infrared Light",
        "Surface Tension, Meniscus Curves & Capillary Tubes",
        "Air Pressure, Suction Cups & Barometers",
        "Planetary Rings, Shepherd Moons & Roche Limits",
        "Thermal Expansion Joints in Rails, Bridges & Jars",
    ],
    "materials_food_chemistry": [
        "Molten Silica, Glassblowing & Tempered Glass",
        "Yeast Fermentation, Gluten Networks & Rising Dough",
        "Crystal Lattices, Cleavage Planes & Gemstones",
        "Bronze, Steel Alloys, Forging & Protective Patinas",
        "Cellulose Fibers, Papermaking & Waterproof Coatings",
        "Emulsions, Whipped Foams & Immiscible Liquids",
        "Natural Latex, Cross-Linked Polymers & Elasticity",
        "Caramelization, Maillard Browning & Cooking Aromas",
        "Acids, Bases & Natural Plant Color Indicators",
        "Pottery Clays, Ceramic Glazes & Kiln Vitrification",
        "Phase Changes, Sublimation & Dry Ice Fog",
        "Activated Charcoal, Porous Filters & Water Purification",
        "Crystallization in Rock Candy, Salt Flats & Igneous Rock",
        "Adhesives, Van der Waals Forces & Sticky Surfaces",
        "Oxidation, Tarnish, Apples Browning & Antioxidants",
        "Cheese Curds, Enzymes & Milk Proteins",
        "Composite Materials, Plywood Grain & Carbon Fiber",
        "Evaporative Cooling in Sweat, Clay Pots & Breezes",
        "Soap Micelles, Grease Trapping & Hard Water",
        "Candle Wicks, Wax Vapor & Flame Zones",
    ],
    "world_cultures_language": [
        "Surprising Word Etymologies & Borrowed Loanwords",
        "Cuneiform Wedges, Hieroglyphs & Syllabic Scripts",
        "Lunar, Solar & Lunisolar Calendars Around the World",
        "Map Projections, Compass Roses & Surveying Chains",
        "Outrigger Canoes, Kayaks & Reed Boats",
        "Early Trade Weights, Balance Scales & Coin Milling",
        "Maritime Signal Flags, Semaphore Arms & Morse Pulses",
        "Stepwells, Courtyards & Climate-Smart Vernacular Homes",
        "Abacuses, Knotted Quipus & Counting Systems",
        "World Percussion, Pentatonic Scales & Folk Instruments",
        "Idioms, Proverbs & How Everyday Phrases Began",
        "Braille Cells, Tactile Reading & Sign Languages",
        "Traditional Kite Engineering & Wind Festivals",
        "Terraced Farming, Floating Gardens & Oasis Agriculture",
        "Wayfinding by Ocean Swells, Cloud Reflections & Birds",
        "Natural Fiber Rope-Making, Knots & Rigging",
        "Public Clocks, Bell Towers & Town Time Signals",
        "Place Names, Toponyms & Geographic Clues",
        "Storytelling Oral Traditions, Rhyme & Memory Tricks",
        "Snowshoes, Skis & Cold-Climate Travel Inventions",
    ],
}

CURRICULUM_LENSES: list[str] = [
    "Focus on a hidden internal mechanism or clever physical part most people never see.",
    "Focus on the practical real-world problem an inventor, builder, or culture needed to solve.",
    "Focus on a counter-intuitive scale, speed, force, or size comparison kids can picture vividly.",
    "Focus on a hands-on observation kids can test or spot at home, outside, or in the kitchen.",
    "Focus on what happens at the tiny microscopic, grain, fiber, or molecular level.",
    "Focus on a surprising engineering trade-off (why making something stronger, lighter, or curved matters).",
    "Focus on how shape and geometry (arches, spirals, ridges, triangles, grooves) do the work without motors.",
    "Focus on how energy changes form (motion, heat, sound, pressure, light, or stored springiness).",
    "Focus on an unexpected connection between nature and human tools.",
    "Focus on how people figured it out using clever clues before modern computers existed.",
    "Focus on an extreme condition (deep water, winter frost, desert heat, high wind, pitch darkness) and how it is handled.",
    "Focus on a small everyday detail people walk past daily without realizing its purpose.",
]

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
        lens_idx = (lens_cursor + slot_idx * 3 + pass_offset) % len(CURRICULUM_LENSES)
        cards.append(
            {
                "pillar": pillar,
                "subdomain": subdomains[sub_idx],
                "lens": CURRICULUM_LENSES[lens_idx],
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
