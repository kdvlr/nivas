import json
import logging
import os
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from ..config import get_settings

logger = logging.getLogger(__name__)

DATA_DIR = Path("data")
KIDS_DAILY_FILE = DATA_DIR / "kids_daily.json"

KIDS_DAILY_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "word_of_the_day": {
            "type": "OBJECT",
            "properties": {
                "word": {"type": "STRING"},
                "pronunciation": {"type": "STRING"},
                "part_of_speech": {"type": "STRING"},
                "definition": {"type": "STRING"},
                "example": {"type": "STRING"},
            },
            "required": ["word", "pronunciation", "definition", "example"],
        },
        "fun_fact": {
            "type": "OBJECT",
            "properties": {
                "fact": {"type": "STRING"},
                "category": {"type": "STRING"},
                "emoji": {"type": "STRING"},
                "did_you_know": {"type": "STRING"},
            },
            "required": ["fact", "emoji", "did_you_know"],
        },
        "stem_5yo": {
            "type": "OBJECT",
            "properties": {
                "topic": {"type": "STRING"},
                "question": {"type": "STRING"},
                "hint": {"type": "STRING"},
                "answer": {"type": "STRING"},
                "parent_explanation": {"type": "STRING"},
            },
            "required": ["topic", "question", "answer", "parent_explanation"],
        },
        "stem_9yo": {
            "type": "OBJECT",
            "properties": {
                "topic": {"type": "STRING"},
                "question": {"type": "STRING"},
                "hint": {"type": "STRING"},
                "answer": {"type": "STRING"},
                "parent_explanation": {"type": "STRING"},
            },
            "required": ["topic", "question", "answer", "parent_explanation"],
        },
    },
    "required": ["word_of_the_day", "fun_fact", "stem_5yo", "stem_9yo"],
}

# Rich built-in fallback catalog for offline or unconfigured Gemini usage
FALLBACK_CATALOG: List[Dict[str, Any]] = [
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
            "parent_explanation": "Explain that feathers are lightweight, trap warm air next to their skin, and have natural oils that repel water droplets."
        },
        "stem_9yo": {
            "topic": "Space & Gravity",
            "question": "Why does the Moon look like it has bright and dark spots when you look up at night?",
            "hint": "Some spots are giant flat plains made of ancient lava, while others are rough mountains.",
            "answer": "The dark areas (maria) are smooth plains formed by ancient volcanic lava, while the bright areas are rugged highlands covered with craters.",
            "parent_explanation": "The dark regions were once thought to be seas (hence 'maria', Latin for seas). The lighter areas are anorthosite rock mountains heavily cratered by meteorites billions of years ago."
        }
    },
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
            "did_you_know": "Honey has very little water and high acidity, making it impossible for bacteria or microbes to grow."
        },
        "stem_5yo": {
            "topic": "Physics & Shadows",
            "question": "Where does your shadow go when the sun goes behind a cloud?",
            "hint": "A shadow is made when something blocks light!",
            "answer": "Your shadow disappears because the cloud scatters the sunlight in all directions, so there's no strong direct light to block.",
            "parent_explanation": "Shadows form when an opaque object blocks straight beams of light. When clouds diffuse light from everywhere, sharp shadows fade away."
        },
        "stem_9yo": {
            "topic": "Electricity & Energy",
            "question": "Why doesn't a bird get electrocuted when it sits on a high-voltage power line?",
            "hint": "Electricity only flows when there is a complete path (circuit) between two different points of voltage.",
            "answer": "Because both of the bird's feet are on the same wire at the same electrical potential, no current flows through the bird's body.",
            "parent_explanation": "Electricity needs a closed loop and a voltage difference to flow. If the bird touched the wire AND a metal pole (ground) or a second wire at the same time, current would flow dangerously."
        }
    },
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
            "did_you_know": "Clouds float because the tiny water droplets are spread out across a massive volume of warm air."
        },
        "stem_5yo": {
            "topic": "Plant Biology",
            "question": "How do plants drink water if they don't have a mouth?",
            "hint": "Look down at the soil under the stem!",
            "answer": "Plants drink water using their roots like tiny straws hidden underground in the soil.",
            "parent_explanation": "Roots absorb moisture and minerals from the dirt and send it up the stem through microscopic tubes called xylem."
        },
        "stem_9yo": {
            "topic": "Computer Science & Logic",
            "question": "How can a computer store whole pictures and videos using only 1s and 0s (binary code)?",
            "hint": "Think about breaking an image down into millions of tiny colored dots.",
            "answer": "Images are broken down into tiny pixels, and each pixel's red, green, and blue color numbers are written as patterns of 1s and 0s (bits).",
            "parent_explanation": "Every color is represented by RGB numbers (e.g. 0 to 255). Computers convert numbers into binary on/off electric signals (1 and 0), creating high-resolution digital media."
        }
    },
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
            "parent_explanation": "All sound is made of physical vibrations traveling through air. Vocal cords vibrate air as it passes through the larynx."
        },
        "stem_9yo": {
            "topic": "Chemistry & States of Matter",
            "question": "Why does ice float on top of liquid water when most solid objects sink in their liquid form?",
            "hint": "Water molecules form a special hexagonal crystal structure as they freeze.",
            "answer": "When water freezes, hydrogen bonds push the molecules into an open hexagonal lattice, making ice less dense than liquid water.",
            "parent_explanation": "Most liquids contract and become denser as they solidify. Water has a unique anomaly where it expands upon freezing below 4°C, creating pockets that allow ice to float and insulate lakes in winter."
        }
    }
]

class KidsDailyService:
    def __init__(self):
        self._cache: Dict[str, Any] = {}
        self._settings: Dict[str, Any] = {
            "force_banner_active": False,
        }
        self._load_cache()

    def _load_cache(self):
        try:
            if KIDS_DAILY_FILE.exists():
                with open(KIDS_DAILY_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._cache = data.get("days", {})
                    self._settings = {**self._settings, **data.get("settings", {})}
        except Exception as e:
            logger.warning(f"Failed to load kids daily cache: {e}")

    def _save_cache(self):
        try:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            with open(KIDS_DAILY_FILE, "w", encoding="utf-8") as f:
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
            # 9:00 AM to 11:00 AM (540 min to 660 min)
            return 9 * 60 <= minute_of_day < 11 * 60
        else:
            # 6:00 AM to 8:00 AM (360 min to 480 min)
            return 6 * 60 <= minute_of_day < 8 * 60

    def get_settings(self) -> Dict[str, Any]:
        return dict(self._settings)

    def update_settings(self, new_settings: Dict[str, Any]) -> Dict[str, Any]:
        self._settings.update(new_settings)
        self._save_cache()
        return self.get_settings()

    def get_today_payload(self, date_str: Optional[str] = None, force_regenerate: bool = False) -> Dict[str, Any]:
        today_key = date_str or date.today().isoformat()
        if not force_regenerate and today_key in self._cache:
            content = self._cache[today_key]
        else:
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

    def _generate_daily_content(self, date_str: str) -> Dict[str, Any]:
        s = get_settings()
        if s.gemini_api_key:
            try:
                ai_content = self._generate_with_gemini(date_str, s.gemini_api_key, s.gemini_model)
                if ai_content:
                    return ai_content
            except Exception as e:
                logger.error(f"Gemini generation failed for kids daily ({date_str}): {e}")

        # Deterministic fallback selection based on date hash
        day_index = hash(date_str) % len(FALLBACK_CATALOG)
        fallback = FALLBACK_CATALOG[day_index].copy()
        fallback["generated_by"] = "offline_catalog"
        return fallback

    def _generate_with_gemini(self, date_str: str, api_key: str, model_name: str) -> Optional[Dict[str, Any]]:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        prompt = (
            f"Generate a daily morning educational kids bundle for {date_str}.\n"
            "Requirements:\n"
            "1. word_of_the_day: A rich, inspiring vocabulary word suitable for elementary school kids (not too simplistic, e.g., 'Persevere', 'Bioluminescent', 'Momentum', 'Ecosystem'). Include phonetic pronunciation, part of speech, kid-friendly definition, and an engaging example sentence.\n"
            "2. fun_fact: An astonishing, true fact from science, animals, space, nature, or ocean life. Include an emoji, category, and a short 1-sentence 'did_you_know' extension.\n"
            "3. stem_5yo: A curious STEM riddle/question for a 5-year-old (kindergarten level) about something they observe daily (e.g. magnets, shadows, ice melting, rainbow colors, insects). Include a helpful hint, a simple answer, and a clear 'parent_explanation' for parents to discuss.\n"
            "4. stem_9yo: A thought-provoking STEM question for a 9-year-old (4th grade level) involving logic, physics, astronomy, engineering, or computing. Include a hint, clear answer, and a deeper 'parent_explanation'.\n"
            "Make all questions positive, curious, and fun. Ensure answers and parent explanations are accurate."
        )

        resp = client.models.generate_content(
            model=model_name or "gemini-flash-latest",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_json_schema=KIDS_DAILY_SCHEMA,
            ),
        )

        data = json.loads(resp.text)
        if (
            data.get("word_of_the_day")
            and data.get("fun_fact")
            and data.get("stem_5yo")
            and data.get("stem_9yo")
        ):
            data["generated_by"] = "gemini_ai"
            return data
        return None

kids_daily_service = KidsDailyService()
