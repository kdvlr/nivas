import re
from typing import Dict

_NON_LATIN_INDIC_RE = re.compile(r"[\u0900-\u0D7F]")
_TAMIL_RE = re.compile(r"[\u0B80-\u0BFF]")
_DEVA_RE = re.compile(r"[\u0900-\u097F]")
_TELUGU_RE = re.compile(r"[\u0C00-\u0C7F]")
_MALAYALAM_RE = re.compile(r"[\u0D00-\u0D7F]")
_KANNADA_RE = re.compile(r"[\u0C80-\u0CFF]")


def is_mostly_latin(text: str) -> bool:
    """Return True if text has no Indic script characters (e.g. already English/Romanized)."""
    return bool(text) and not _NON_LATIN_INDIC_RE.search(text)


# --- Tamil (phonetic sing-along style, no academic diacritics) ---
_TAMIL_VOWELS: Dict[str, str] = {
    "அ": "a", "ஆ": "aa", "இ": "i", "ஈ": "ee", "உ": "u", "ஊ": "oo",
    "எ": "e", "ஏ": "ae", "ஐ": "ai", "ஒ": "o", "ஓ": "o", "ஔ": "au",
    "ஃ": "h",
}
_TAMIL_CONSONANTS: Dict[str, str] = {
    "க": "k", "ங": "ng", "ச": "ch", "ஜ": "j", "ஞ": "nj",
    "ட": "t", "ண": "n", "த": "th", "ந": "n", "ன": "n",
    "ப": "p", "ம": "m", "ய": "y", "ர": "r", "ற": "r",
    "ல": "l", "ள": "l", "ழ": "zh", "வ": "v",
    "ஶ": "sh", "ஷ": "sh", "ஸ": "s", "ஹ": "h",
}
_TAMIL_MATRAS: Dict[str, str] = {
    "ா": "aa", "ி": "i", "ீ": "ee", "ு": "u", "ூ": "oo",
    "ெ": "e", "ே": "ae", "ை": "ai", "ொ": "o", "ோ": "o", "ௌ": "au",
}
_TAMIL_PULLI = "்"
_TAMIL_VOICED_AFTER_NASAL: Dict[str, str] = {
    "க": "g", "ச": "j", "ட": "d", "த": "dh", "ப": "b",
}
_TAMIL_NASALS = {"ங", "ஞ", "ண", "ந", "ன", "ம"}


def _transliterate_tamil(text: str) -> str:
    out = []
    n = len(text)
    i = 0
    while i < n:
        ch = text[i]
        if ch in _TAMIL_VOWELS:
            out.append(_TAMIL_VOWELS[ch])
            i += 1
            continue
        if ch in _TAMIL_CONSONANTS:
            # Determine consonant sound with natural Tamil voicing rules
            prev_ch = text[i - 1] if i > 0 else ""
            prev2_ch = text[i - 2] if i > 1 else ""
            next_ch = text[i + 1] if i + 1 < n else ""
            next2_ch = text[i + 2] if i + 2 < n else ""

            base = _TAMIL_CONSONANTS[ch]
            is_geminate = (next_ch == _TAMIL_PULLI and next2_ch == ch) or (prev_ch == _TAMIL_PULLI and prev2_ch == ch)
            after_nasal = prev_ch == _TAMIL_PULLI and prev2_ch in _TAMIL_NASALS
            word_initial = i == 0 or not _TAMIL_RE.match(prev_ch)

            if ch == "ற" and prev_ch == _TAMIL_PULLI and prev2_ch == "ன":
                base = "dr"
            elif ch == "ற" and is_geminate:
                base = "t"
            elif after_nasal and ch in _TAMIL_VOICED_AFTER_NASAL:
                base = _TAMIL_VOICED_AFTER_NASAL[ch]
            elif not word_initial and not is_geminate and next_ch != _TAMIL_PULLI:
                if ch == "க":
                    base = "g"
                elif ch == "ட":
                    base = "d"
                elif ch == "ப":
                    base = "b"
                elif ch == "த":
                    base = "dh"
                elif ch == "ச":
                    base = "s"

            if next_ch == _TAMIL_PULLI:
                out.append(base)
                i += 2
            elif next_ch in _TAMIL_MATRAS:
                out.append(base + _TAMIL_MATRAS[next_ch])
                i += 2
            else:
                out.append(base + "a")
                i += 1
            continue
        if ch in _TAMIL_MATRAS or ch == _TAMIL_PULLI:
            i += 1
            continue
        out.append(ch)
        i += 1
    return "".join(out)


# --- Devanagari (Hindi) ---
_DEVA_VOWELS: Dict[str, str] = {
    "अ": "a", "आ": "aa", "इ": "i", "ई": "ee", "उ": "u", "ऊ": "oo",
    "ऋ": "ri", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au",
    "ऑ": "o", "ऍ": "e",
}
_DEVA_CONSONANTS: Dict[str, str] = {
    "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "ng",
    "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "ny",
    "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
    "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
    "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
    "य": "y", "र": "r", "ल": "l", "व": "v",
    "श": "sh", "ष": "sh", "स": "s", "ह": "h",
    "ळ": "l", "क़": "q", "ख़": "kh", "ग़": "gh", "ज़": "z", "ड़": "r", "ढ़": "rh", "फ़": "f",
}
_DEVA_MATRAS: Dict[str, str] = {
    "ा": "aa", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo",
    "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
    "ॉ": "o", "ॅ": "e",
}
_DEVA_HALANT = "्"
_DEVA_NUKTA = "़"
_DEVA_NUKTA_MAP = {"क": "q", "ख": "kh", "ग": "gh", "ज": "z", "ड": "r", "ढ": "rh", "फ": "f"}


def _transliterate_deva(text: str) -> str:
    out = []
    n = len(text)
    i = 0
    while i < n:
        ch = text[i]
        if ch in _DEVA_VOWELS:
            out.append(_DEVA_VOWELS[ch])
            i += 1
            continue
        if ch in _DEVA_CONSONANTS:
            base = _DEVA_CONSONANTS[ch]
            step = 1
            if i + 1 < n and text[i + 1] == _DEVA_NUKTA:
                base = _DEVA_NUKTA_MAP.get(ch, base)
                step = 2
            nxt = text[i + step] if i + step < n else ""
            if nxt == _DEVA_HALANT:
                out.append(base)
                i += step + 1
            elif nxt in _DEVA_MATRAS:
                out.append(base + _DEVA_MATRAS[nxt])
                i += step + 1
            else:
                # Word-final schwa deletion in Hindi (e.g. दिल -> dil, हम -> ham)
                word_end = (i + step >= n) or not _DEVA_RE.match(nxt)
                out.append(base if word_end else base + "a")
                i += step
            continue
        if ch in ("ं", "ँ"):
            out.append("n")
            i += 1
            continue
        if ch == "ः":
            out.append("h")
            i += 1
            continue
        if ch == "।":
            out.append(".")
            i += 1
            continue
        if ch in _DEVA_MATRAS or ch in (_DEVA_HALANT, _DEVA_NUKTA):
            i += 1
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def _transliterate_generic_indic(text: str, base_cp: int) -> str:
    """Phonetic transliteration for Telugu (0x0C00), Kannada (0x0C80), Malayalam (0x0D00)."""
    vowels = {
        0x05: "a", 0x06: "aa", 0x07: "i", 0x08: "ee", 0x09: "u", 0x0A: "oo",
        0x0B: "ri", 0x0E: "e", 0x0F: "ae", 0x10: "ai", 0x12: "o", 0x13: "o", 0x14: "au",
    }
    consonants = {
        0x15: "k", 0x16: "kh", 0x17: "g", 0x18: "gh", 0x19: "ng",
        0x1A: "ch", 0x1B: "chh", 0x1C: "j", 0x1D: "jh", 0x1E: "nj",
        0x1F: "t", 0x20: "th", 0x21: "d", 0x22: "dh", 0x23: "n",
        0x24: "th", 0x25: "thh", 0x26: "d", 0x27: "dh", 0x28: "n",
        0x2A: "p", 0x2B: "ph", 0x2C: "b", 0x2D: "bh", 0x2E: "m",
        0x2F: "y", 0x30: "r", 0x31: "r", 0x32: "l", 0x33: "l", 0x34: "zh",
        0x35: "v", 0x36: "sh", 0x37: "sh", 0x38: "s", 0x39: "h",
    }
    matras = {
        0x3E: "aa", 0x3F: "i", 0x40: "ee", 0x41: "u", 0x42: "oo",
        0x43: "ri", 0x46: "e", 0x47: "ae", 0x48: "ai", 0x4A: "o", 0x4B: "o", 0x4C: "au",
    }
    virama = 0x4D
    out = []
    n = len(text)
    i = 0
    while i < n:
        off = ord(text[i]) - base_cp
        if off in vowels:
            out.append(vowels[off])
            i += 1
        elif off in consonants:
            base = consonants[off]
            nxt_off = (ord(text[i + 1]) - base_cp) if i + 1 < n else -1
            if nxt_off == virama:
                out.append(base)
                i += 2
            elif nxt_off in matras:
                out.append(base + matras[nxt_off])
                i += 2
            else:
                out.append(base + "a")
                i += 1
        elif off == 0x02:
            out.append("m")
            i += 1
        elif off in matras or off == virama:
            i += 1
        else:
            out.append(text[i])
            i += 1
    return "".join(out)


def transliterate_to_latin(text: str) -> str:
    """Convert Tamil, Hindi (Devanagari), Telugu, Kannada, or Malayalam text into readable English letters."""
    if not text or not _NON_LATIN_INDIC_RE.search(text):
        return text
    res = text
    if _TAMIL_RE.search(res):
        res = _transliterate_tamil(res)
    if _DEVA_RE.search(res):
        res = _transliterate_deva(res)
    if _TELUGU_RE.search(res):
        res = _transliterate_generic_indic(res, 0x0C00)
    if _KANNADA_RE.search(res):
        res = _transliterate_generic_indic(res, 0x0C80)
    if _MALAYALAM_RE.search(res):
        res = _transliterate_generic_indic(res, 0x0D00)
    return res
