import copy
import json
import pytest
from datetime import date, datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.models import Base, KidsConceptLedger, KidsDailyEdition
from app.services.kids_curriculum import (
    CURRICULUM_PILLARS,
    compute_word_stem,
    draw_daily_curriculum,
    pack_embedding,
    sanitize_and_validate_word,
)
from app.services.kids_daily_service import (
    FALLBACK_CATALOG,
    KIDS_DAILY_DISPLAY_LIMITS,
    KIDS_DAILY_SCHEMA,
    content_fits_display_limits,
    kids_daily_service,
)


@pytest.fixture(autouse=True)
def isolate_kids_daily_state(tmp_path, monkeypatch):
    test_file = tmp_path / "kids_daily.json"
    monkeypatch.setattr("app.services.kids_daily_service._get_kids_daily_file", lambda: test_file)
    monkeypatch.setattr(kids_daily_service, "_generate_with_gemini", lambda *args, **kwargs: None)
    monkeypatch.setattr(kids_daily_service, "_maybe_start_embedding_backfill", lambda: None)

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    test_session_factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    orig_factory = kids_daily_service._session_factory
    orig_cache = dict(kids_daily_service._cache)
    orig_settings = dict(kids_daily_service._settings)
    orig_init = kids_daily_service._initialized

    kids_daily_service.set_session_factory(test_session_factory)
    kids_daily_service._cache = {}
    kids_daily_service._ephemeral_fallback = {}
    kids_daily_service._settings = kids_daily_service._default_settings()
    yield
    kids_daily_service.set_session_factory(orig_factory)
    kids_daily_service._cache = orig_cache
    kids_daily_service._settings = orig_settings
    kids_daily_service._initialized = orig_init
    engine.dispose()


@pytest.fixture
def client():
    return TestClient(app)

def test_kids_daily_time_window():
    # Weekday 7:00 AM -> Active morning
    weekday_morning = datetime(2026, 8, 14, 7, 0) # Friday
    assert kids_daily_service.is_active_morning_window(weekday_morning) is True
    assert kids_daily_service.get_active_window_name(weekday_morning) == "morning"

    # Weekday 8:30 AM -> Inactive
    weekday_late = datetime(2026, 8, 14, 8, 30)
    assert kids_daily_service.is_active_morning_window(weekday_late) is False
    assert kids_daily_service.get_active_window_name(weekday_late) == ""

    # Weekday 3:14 PM -> Inactive (just before afternoon window)
    weekday_before_afternoon = datetime(2026, 8, 14, 15, 14)
    assert kids_daily_service.is_active_morning_window(weekday_before_afternoon) is False
    assert kids_daily_service.get_active_window_name(weekday_before_afternoon) == ""

    # Weekday 3:15 PM -> Active afternoon
    weekday_start_afternoon = datetime(2026, 8, 14, 15, 15)
    assert kids_daily_service.is_active_morning_window(weekday_start_afternoon) is True
    assert kids_daily_service.get_active_window_name(weekday_start_afternoon) == "afternoon"

    # Weekday 5:00 PM -> Active afternoon
    weekday_mid_afternoon = datetime(2026, 8, 14, 17, 0)
    assert kids_daily_service.is_active_morning_window(weekday_mid_afternoon) is True
    assert kids_daily_service.get_active_window_name(weekday_mid_afternoon) == "afternoon"

    # Weekday 6:59 PM -> Active afternoon
    weekday_end_afternoon = datetime(2026, 8, 14, 18, 59)
    assert kids_daily_service.is_active_morning_window(weekday_end_afternoon) is True
    assert kids_daily_service.get_active_window_name(weekday_end_afternoon) == "afternoon"

    # Weekday 7:00 PM -> Inactive
    weekday_past_afternoon = datetime(2026, 8, 14, 19, 0)
    assert kids_daily_service.is_active_morning_window(weekday_past_afternoon) is False
    assert kids_daily_service.get_active_window_name(weekday_past_afternoon) == ""

    # Weekend 10:00 AM -> Active morning
    weekend_morning = datetime(2026, 8, 15, 10, 0) # Saturday
    assert kids_daily_service.is_active_morning_window(weekend_morning) is True
    assert kids_daily_service.get_active_window_name(weekend_morning) == "morning"

    # Weekend 7:00 AM -> Inactive
    weekend_early = datetime(2026, 8, 15, 7, 0)
    assert kids_daily_service.is_active_morning_window(weekend_early) is False
    assert kids_daily_service.get_active_window_name(weekend_early) == ""

    # Weekend 4:30 PM -> Active afternoon
    weekend_afternoon = datetime(2026, 8, 15, 16, 30)
    assert kids_daily_service.is_active_morning_window(weekend_afternoon) is True
    assert kids_daily_service.get_active_window_name(weekend_afternoon) == "afternoon"


def test_kids_daily_public_endpoint(client):
    res = client.get("/api/kids-daily/today")
    assert res.status_code == 200
    data = res.json()
    assert "word_of_the_day" in data
    assert "fun_fact" in data
    assert "stem_5yo" in data
    assert "stem_9yo" in data
    assert "active_window" in data
    # The kiosk's Answers board is driven by the same daily payload.
    assert "answer" in data["stem_5yo"]
    assert "parent_explanation" in data["stem_5yo"]
    assert "answer" in data["stem_9yo"]
    assert "parent_explanation" in data["stem_9yo"]

def test_kids_daily_admin_endpoint(client):
    res = client.get("/api/kids-daily/admin")
    assert res.status_code == 200
    data = res.json()
    content = data.get("content", {})
    assert "answer" in content["stem_5yo"]
    assert "parent_explanation" in content["stem_5yo"]
    assert "answer" in content["stem_9yo"]
    assert "parent_explanation" in content["stem_9yo"]

def test_kids_daily_settings_toggle(client):
    # Set force_banner_active to True
    res = client.post("/api/kids-daily/settings", json={"force_banner_active": True})
    assert res.status_code == 200
    assert res.json().get("force_banner_active") is True

    # Now verify is_active_morning_window returns True regardless of time
    midnight = datetime(2026, 8, 14, 1, 0)
    assert kids_daily_service.is_active_morning_window(midnight) is True

    # Reset back to False
    res2 = client.post("/api/kids-daily/settings", json={"force_banner_active": False})
    assert res2.status_code == 200
    assert res2.json().get("force_banner_active") is False

def test_kids_daily_fallback_catalog_length_and_rotation(client):
    assert len(FALLBACK_CATALOG) >= 30

    # Ensure consecutive days produce different content
    p1 = kids_daily_service.get_today_payload("2026-08-01", force_regenerate=True)
    p2 = kids_daily_service.get_today_payload("2026-08-02", force_regenerate=True)
    p3 = kids_daily_service.get_today_payload("2026-08-03", force_regenerate=True)

    w1 = p1["content"]["word_of_the_day"]["word"]
    w2 = p2["content"]["word_of_the_day"]["word"]
    w3 = p3["content"]["word_of_the_day"]["word"]
    assert w1 != w2
    assert w2 != w3
    assert w1 != w3


def test_kids_daily_catalog_fits_wall_display_limits():
    assert all(content_fits_display_limits(content) for content in FALLBACK_CATALOG)


def test_kids_daily_schema_enforces_wall_display_limits():
    for section_name, fields in KIDS_DAILY_DISPLAY_LIMITS.items():
        schema_fields = KIDS_DAILY_SCHEMA["properties"][section_name]["properties"]
        for field_name, expected_limit in fields.items():
            assert schema_fields[field_name]["maxLength"] == expected_limit


def test_kids_daily_display_limits_reject_overlong_copy():
    content = {
        section_name: {field_name: "ok" for field_name in fields}
        for section_name, fields in KIDS_DAILY_DISPLAY_LIMITS.items()
    }
    content["stem_9yo"]["question"] = "x" * (
        KIDS_DAILY_DISPLAY_LIMITS["stem_9yo"]["question"] + 1
    )
    assert content_fits_display_limits(content) is False

def test_kids_daily_regenerate_endpoint(client):
    res = client.post("/api/kids-daily/regenerate")
    assert res.status_code == 200
    data = res.json()
    assert "content" in data
    assert "word_of_the_day" in data["content"]
    assert "fun_fact" in data["content"]
    assert "stem_5yo" in data["content"]
    assert "stem_9yo" in data["content"]

def test_kids_daily_category_pool_and_recent_history():
    from app.services.kids_daily_service import KIDS_CATEGORIES
    # Category pool should be expansive to prevent early repetition
    assert len(KIDS_CATEGORIES) >= 60

    # Test recent history extraction
    service = kids_daily_service
    service._cache["2026-08-20"] = {
        "word_of_the_day": {"word": "Barycenter"},
        "fun_fact": {"category": "Astronomy", "fact": "Planets orbit a barycenter."},
        "stem_5yo": {"topic": "Gravity"},
        "stem_9yo": {"topic": "Orbital Mechanics"},
    }
    service._cache["2026-08-24"] = {
        "word_of_the_day": {"word": "Keystone"},
        "fun_fact": {"category": "Architecture", "fact": "Arches need a keystone."},
        "stem_5yo": {"topic": "Arches"},
        "stem_9yo": {"topic": "Trusses"},
    }

    history = service._get_recent_history("2026-08-25", days_back=30)
    assert "barycenter" in history["used_words"]
    assert "keystone" in history["used_words"]
    assert "Barycenter" in history["used_word_list"]
    assert "Keystone" in history["used_word_list"]
    assert "astronomy" in history["recent_categories"]
    assert "architecture" in history["recent_categories"]


def test_candidate_validation_rejects_recent_word_and_concept():
    service = kids_daily_service
    candidate = copy.deepcopy(FALLBACK_CATALOG[0])
    service._cache["2026-01-01"] = FALLBACK_CATALOG[0]

    valid, reasons = service._validate_candidate(candidate, "2026-01-02")

    assert valid is False
    assert any("vocabulary word" in reason for reason in reasons)


def test_json_history_migration_preserves_ai_and_upgrades_offline_placeholder(tmp_path, monkeypatch):
    legacy_file = tmp_path / "legacy_kids_daily.json"
    ai_bundle = copy.deepcopy(FALLBACK_CATALOG[0])
    ai_bundle["generated_by"] = "gemini_ai (gemini-3.5-flash)"
    offline_bundle = copy.deepcopy(FALLBACK_CATALOG[4])
    offline_bundle["generated_by"] = "offline_catalog"

    legacy_file.write_text(
        json.dumps(
            {
                "days": {
                    "2026-10-19": ai_bundle,
                    "2026-11-11": offline_bundle,
                },
                "settings": {
                    "force_banner_active": False,
                    "gemini_api_key": "AQ.Ab8LegacyDirectGoogleKeyShouldNotBreakLiteLLM",
                    "gemini_model": "gemini-3.5-flash",
                    "age_groups": [5, 9],
                    "interests": ["Space"],
                },
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr("app.services.kids_daily_service._get_kids_daily_file", lambda: legacy_file)
    kids_daily_service._initialized = False
    kids_daily_service._ensure_initialized()

    with kids_daily_service._session_factory() as db:
        # Genuine AI day is persisted in KidsDailyEdition
        assert db.get(KidsDailyEdition, "2026-10-19") is not None
        # Stale offline_catalog day is NOT locked into KidsDailyEdition so AI upgrades it immediately
        assert db.get(KidsDailyEdition, "2026-11-11") is None
        # Yet BOTH days' words & concepts ARE recorded in KidsConceptLedger so neither repeats!
        words_in_ledger = {
            r.word_norm for r in db.query(KidsConceptLedger).filter(KidsConceptLedger.section == "word").all()
        }
        assert "curious" in words_in_ledger
        assert "ingenious" in words_in_ledger


def test_litellm_credential_and_model_precedence_ignores_legacy_google_key(monkeypatch):
    from app.config import Settings

    fake_settings = Settings(
        gemini_api_key="sk-d2a-litellm-proxy-key",
        gemini_base_url="http://192.168.100.219:4000",
        gemini_model="gemini-flash",
    )
    monkeypatch.setattr("app.services.kids_daily_service.get_settings", lambda: fake_settings)
    kids_daily_service._ensure_initialized()
    kids_daily_service._settings["gemini_api_key"] = "AQ.Ab8StaleDirectGoogleKey1234567890"
    kids_daily_service._settings["gemini_model"] = "gemini-3.5-flash"

    cfg = kids_daily_service._resolve_ai_config()
    assert cfg["is_litellm"] is True
    assert cfg["base_url"] == "http://192.168.100.219:4000"
    assert cfg["api_keys"] == ["sk-d2a-litellm-proxy-key"]
    assert cfg["key_source"] == "litellm_env"
    assert cfg["models"][0] == "gemini-3.8-flash"
    assert "gemini-3.5-flash" not in cfg["models"]


def test_curriculum_deck_without_replacement_across_160_subdomains():
    total_subdomains = sum(len(v) for v in CURRICULUM_PILLARS.values())
    assert total_subdomains == 160

    state = {}
    seen_per_pillar = {p: [] for p in CURRICULUM_PILLARS}
    # 54 days * 3 cards/day = 162 card draws (~20 draws per pillar across 8 pillars)
    for day_num in range(1, 55):
        d_str = f"2026-01-{(day_num % 28) + 1:02d}-{day_num}"
        state, assign = draw_daily_curriculum(state, d_str)
        # Same day must assign 3 distinct pillars
        day_pillars = {
            assign["fun_fact"]["pillar"],
            assign["stem_5yo"]["pillar"],
            assign["stem_9yo"]["pillar"],
        }
        assert len(day_pillars) == 3
        for sec in ("fun_fact", "stem_5yo", "stem_9yo"):
            p = assign[sec]["pillar"]
            sub = assign[sec]["subdomain"]
            if len(seen_per_pillar[p]) < 20:
                assert sub not in seen_per_pillar[p], f"Pillar {p} repeated {sub} before exhausting all 20!"
            seen_per_pillar[p].append(sub)


def test_word_sanitizer_and_morphological_stem_lifetime_dedup():
    # Reject obscure taxonomy jargon & auto-capitalize valid Tier-2 words
    _, err1 = sanitize_and_validate_word("Batrachotoxin")
    assert err1 is not None
    _, err2 = sanitize_and_validate_word("vellichor")
    assert err2 is not None
    _, err3 = sanitize_and_validate_word("thigmonasty")
    assert err3 is not None
    clean_w, err_ok = sanitize_and_validate_word("nimble")
    assert err_ok is None and clean_w == "Nimble"

    # Morphological root equivalence
    assert compute_word_stem("Resonance") == compute_word_stem("Resonant")
    assert compute_word_stem("Luminous") == compute_word_stem("Luminescent")
    assert compute_word_stem("Gravitational") == compute_word_stem("Gravity")

    # Lifetime stem deduplication (>500 days apart, well past old 180-day window!)
    prior = copy.deepcopy(FALLBACK_CATALOG[1])  # word = "Luminous"
    kids_daily_service._persist_ai_edition("2025-01-01", {**prior, "generated_by": "gemini_ai (gemini-3.8-flash)"})

    cand = copy.deepcopy(FALLBACK_CATALOG[8])
    cand["word_of_the_day"]["word"] = "Luminescent"
    valid, reasons = kids_daily_service._validate_candidate(cand, "2026-11-11")
    assert valid is False
    assert any("shares root" in r for r in reasons)


def test_cross_section_concept_and_semantic_embedding_deduplication():
    # Seed a Fun Fact about the Wright brothers wing-warping
    seed_bundle = copy.deepcopy(FALLBACK_CATALOG[2])
    seed_bundle["fun_fact"] = {
        "fact": "Orville and Wilbur Wright steered their 1903 Flyer by twisting the wooden wingtips with cables like soaring birds!",
        "category": "Aviation History",
        "emoji": "✈️",
        "did_you_know": "They tested over 200 miniature wing shapes inside a homemade wind tunnel in their bicycle shop.",
        "subject_key": "wright_brothers_wing_warping",
    }
    fake_vec = pack_embedding([0.5] * 512)
    seed_bundle["_computed_embeddings"] = {"fun_fact": fake_vec}
    seed_bundle["generated_by"] = "gemini_ai (gemini-3.8-flash)"
    kids_daily_service._persist_ai_edition("2026-10-15", seed_bundle)

    # 1. Cross-section subject collision: 2 days later, stem_9yo asks about Wright brothers steering
    cand_cross = copy.deepcopy(FALLBACK_CATALOG[9])
    cand_cross["stem_9yo"] = {
        "topic": "Early Flight Controls",
        "question": "How did the Wright brothers invent a way to bank and turn their early airplane left and right?",
        "hint": "They pulled wires that gently twisted the outer edges of the fabric wings.",
        "answer": "They used wing-warping pulleys that twisted the wingtips in opposite directions to roll into turns.",
        "parent_explanation": "Modern airplanes replace wing-warping with hinged ailerons on the trailing edges.",
        "subject_key": "wright_brothers_steering",
    }
    valid_cross, failed_cross, _ = kids_daily_service._validate_candidate_detailed(
        cand_cross, "2026-10-17", use_embeddings=False
    )
    assert valid_cross is False
    assert "stem_9yo" in failed_cross

    # 2. Semantic embedding cosine >= 0.78 catches completely paraphrased duplicate
    cand_sem = copy.deepcopy(FALLBACK_CATALOG[9])
    kids_daily_service._fetch_embedding = lambda txt: fake_vec if "aqueduct" in txt.lower() else pack_embedding([-0.5] * 512)
    valid_sem, failed_sem, _ = kids_daily_service._validate_candidate_detailed(
        cand_sem, "2026-11-12", use_embeddings=True
    )
    assert valid_sem is False
    assert "stem_9yo" in failed_sem
    assert any("semantic duplicate" in r for r in failed_sem["stem_9yo"])


def test_surgical_single_card_repair_retains_valid_siblings(monkeypatch):
    from app.config import Settings

    fake_settings = Settings(
        gemini_api_key="sk-litellm-test",
        gemini_base_url="http://192.168.100.219:4000",
        gemini_model="gemini-3.8-flash",
    )
    monkeypatch.setattr("app.services.kids_daily_service.get_settings", lambda: fake_settings)
    # Restore real _generate_with_gemini on this test while mocking _call_gemini_json & genai.Client
    monkeypatch.setattr(
        kids_daily_service,
        "_generate_with_gemini",
        kids_daily_service.__class__._generate_with_gemini.__get__(kids_daily_service, kids_daily_service.__class__),
    )
    monkeypatch.setattr(kids_daily_service, "_fetch_embedding", lambda txt: None)

    class DummyClient:
        def __init__(self, *a, **kw):
            pass

    import google.genai as genai_mod
    monkeypatch.setattr(genai_mod, "Client", DummyClient)

    # Persist day 1 so its stem_9yo concept (" lunar_maria_basalt ") is retired
    day1 = copy.deepcopy(FALLBACK_CATALOG[0])
    day1["generated_by"] = "gemini_ai (gemini-3.8-flash)"
    kids_daily_service._persist_ai_edition("2026-11-01", day1)

    calls = []

    def fake_call_gemini(client, model_name, prompt, schema, temperature=0.95):
        calls.append(list(schema["properties"].keys()))
        if len(calls) == 1:
            # First call: 3 fresh orthogonal cards + 1 overlong stem_9yo card (>160 char question)
            b = copy.deepcopy(FALLBACK_CATALOG[1])  # Luminous / Honey / Shadows / Power line bird
            b["fun_fact"]["subject_key"] = "ancient_egyptian_honey_acidity"
            b["stem_5yo"]["subject_key"] = "cloud_diffused_sunlight_shadow"
            b["stem_9yo"]["question"] = "X" * 185  # Violates 160-char display budget!
            b["stem_9yo"]["subject_key"] = "power_line_voltage_potential"
            return b
        # Second call MUST be surgical repair requesting ONLY ['stem_9yo']!
        assert list(schema["properties"].keys()) == ["stem_9yo"]
        repaired_s9 = copy.deepcopy(FALLBACK_CATALOG[1]["stem_9yo"])
        repaired_s9["subject_key"] = "power_line_voltage_potential"
        return {"stem_9yo": repaired_s9}

    monkeypatch.setattr(kids_daily_service, "_call_gemini_json", fake_call_gemini)

    result = kids_daily_service.get_today_payload("2026-11-12")
    assert result["content"]["generated_by"].startswith("gemini_ai")
    assert result["content"]["word_of_the_day"]["word"] == "Luminous"
    assert len(calls) == 2
    assert calls[0] == ["word_of_the_day", "fun_fact", "stem_5yo", "stem_9yo"]
    assert calls[1] == ["stem_9yo"]


def test_ephemeral_fallback_never_poisons_sqlite_and_auto_upgrades_on_recovery(monkeypatch):
    # 1. AI fails -> serves unseen fallback ephemerally, SQLite KidsDailyEdition stays empty!
    p_fallback = kids_daily_service.get_today_payload("2026-11-15")
    assert p_fallback["content"]["generated_by"] == "offline_catalog"
    assert kids_daily_service._load_persisted_edition("2026-11-15") is None

    # 2. AI recovers -> ensure_upcoming_editions / next non-cached pass upgrades today in SQLite!
    fresh_ai = copy.deepcopy(FALLBACK_CATALOG[9])
    fresh_ai["generated_by"] = "gemini_ai (gemini-3.8-flash)"
    monkeypatch.setattr(kids_daily_service, "_generate_daily_content", lambda d_str, force_advance_deck=False: copy.deepcopy(fresh_ai))
    kids_daily_service._ephemeral_fallback.clear()

    p_upgraded = kids_daily_service.get_today_payload("2026-11-15")
    assert p_upgraded["content"]["generated_by"] == "gemini_ai (gemini-3.8-flash)"
    assert kids_daily_service._load_persisted_edition("2026-11-15") is not None


def test_dynamic_kid_birthdays_auto_aging(client):
    res = client.post(
        "/api/kids-daily/settings",
        json={"age_groups": [5, 9], "kid_birthdays": ["2020-06", "2016-12"]},
    )
    assert res.status_code == 200

    # On 2026-05-15 (before June & December birthdays): ages are 5 and 9
    assert kids_daily_service.get_effective_ages(date(2026, 5, 15)) == [5, 9]
    # On 2026-07-01 (after June birthday, before December birthday): ages are 6 and 9
    assert kids_daily_service.get_effective_ages(date(2026, 7, 1)) == [6, 9]
    # On 2026-12-10 (after both birthdays): ages are 6 and 10
    assert kids_daily_service.get_effective_ages(date(2026, 12, 10)) == [6, 10]

    today_resp = client.get("/api/kids-daily/today?date=2026-12-10").json()
    assert today_resp["age_groups"] == [6, 10]
