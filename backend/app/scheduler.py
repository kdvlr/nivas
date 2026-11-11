import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from .services import sync

log = logging.getLogger(__name__)


def _kick_derivatives() -> None:
    """Backfill video posters + playback copies, one at a time in a worker."""
    from .config import get_settings
    from .routers.photos import VIDEO_EXTENSIONS
    from .services import derivatives

    derivatives.start_backfill(get_settings().photos_dir, VIDEO_EXTENSIONS)


def _check_missed_chores() -> None:
    from .routers.rewards import check_missed_chores

    check_missed_chores()


def _scan_photos() -> None:
    """Controlled, coalesced library scan; photo requests never walk disk."""
    from .routers.photos import sync_photos_dir_background
    from .db import SessionLocal

    sync_photos_dir_background(SessionLocal)


def _heal_kids_daily() -> None:
    """Ensure today's (and post-8 PM tomorrow's) Kids' Brain Nuggets edition is pre-generated in SQLite."""
    from .services.kids_daily_service import kids_daily_service

    kids_daily_service.ensure_upcoming_editions(include_tomorrow=False)


def _prewarm_kids_daily_tomorrow() -> None:
    """Overnight T+1 lookahead pre-generation at 8:30 PM for zero-latency morning rollovers."""
    from .services.kids_daily_service import kids_daily_service

    kids_daily_service.ensure_upcoming_editions(include_tomorrow=True)


def check_and_trigger_school_timer() -> None:
    """Every school day at 6:15 AM, automatically start a 45-minute timer (ends at 7:00 AM)."""
    from zoneinfo import ZoneInfo
    from .config import get_settings
    from .db import SessionLocal
    from .services.school_calendar import is_school_day
    from .services.timer_service import timer_service

    try:
        tz = ZoneInfo(get_settings().tz)
    except Exception:
        tz = ZoneInfo("America/Chicago")
    today = datetime.now(tz).date()

    with SessionLocal() as db:
        school_day, reason = is_school_day(db, today)
        if school_day:
            log.info("Triggering 45-minute school morning timer for %s (reason: %s)", today, reason)
            timer_service.start_timer(
                total_seconds=2700,  # 45 mins (6:15 AM -> 7:00 AM)
                label="School Morning Timer",
                source="school_schedule",
            )
        else:
            log.info("6:15 AM school timer skipped for %s: %s", today, reason)


scheduler = AsyncIOScheduler()


def start() -> None:
    from zoneinfo import ZoneInfo
    from .config import get_settings

    try:
        app_tz = ZoneInfo(get_settings().tz)
    except Exception:
        app_tz = ZoneInfo("America/Chicago")

    scheduler.add_job(sync.job_calendar, "interval", minutes=2, id="calendar", coalesce=True, replace_existing=True)
    scheduler.add_job(sync.job_icloud, "interval", minutes=5, id="icloud", coalesce=True, replace_existing=True)
    scheduler.add_job(sync.job_alexa, "interval", minutes=5, id="alexa", coalesce=True, replace_existing=True)
    scheduler.add_job(
        _check_missed_chores,
        "cron",
        hour=23,
        minute=59,
        timezone=app_tz,
        id="missed_chores",
        coalesce=True,
        replace_existing=True,
    )
    scheduler.add_job(
        sync.cleanup_old_completed,
        "cron",
        hour=3,
        minute=30,
        timezone=app_tz,
        id="cleanup",
        coalesce=True,
        replace_existing=True,
    )
    # Re-scan hourly so clips icloudpd adds later get converted too. The worker
    # skips anything already cached, so a repeat pass is cheap.
    scheduler.add_job(_kick_derivatives, "interval", hours=1, id="derivatives", coalesce=True, replace_existing=True)
    scheduler.add_job(_scan_photos, "interval", minutes=30, id="photo_index", coalesce=True, replace_existing=True)
    scheduler.add_job(
        check_and_trigger_school_timer,
        "cron",
        hour=6,
        minute=15,
        timezone=app_tz,
        id="school_timer",
        coalesce=True,
        replace_existing=True,
    )
    scheduler.add_job(
        _heal_kids_daily,
        "cron",
        hour=5,
        minute=30,
        timezone=app_tz,
        id="kids_daily_morning",
        coalesce=True,
        replace_existing=True,
    )
    scheduler.add_job(
        _prewarm_kids_daily_tomorrow,
        "cron",
        hour=20,
        minute=30,
        timezone=app_tz,
        id="kids_daily_tomorrow",
        coalesce=True,
        replace_existing=True,
    )
    scheduler.add_job(
        _heal_kids_daily,
        "interval",
        minutes=15,
        id="kids_daily_heal",
        coalesce=True,
        replace_existing=True,
    )
    if not scheduler.running:
        scheduler.start()
    now_tz = datetime.now(app_tz)
    # kick off an initial pull shortly after boot (staggered)
    for i, job_id in enumerate(("calendar", "icloud", "alexa")):
        scheduler.modify_job(job_id, next_run_time=now_tz + timedelta(seconds=5 + i * 10))
    # Start the transcode backfill after the syncs, so first paint isn't slowed.
    scheduler.modify_job("derivatives", next_run_time=now_tz + timedelta(seconds=45))
    scheduler.modify_job("photo_index", next_run_time=now_tz + timedelta(seconds=5))
    scheduler.modify_job("kids_daily_heal", next_run_time=now_tz + timedelta(seconds=12))
    log.info("scheduler started")


def stop() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
