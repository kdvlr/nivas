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

scheduler = AsyncIOScheduler()


def start() -> None:
    scheduler.add_job(sync.job_calendar, "interval", minutes=2, id="calendar", coalesce=True)
    scheduler.add_job(sync.job_icloud, "interval", minutes=5, id="icloud", coalesce=True)
    scheduler.add_job(sync.job_alexa, "interval", minutes=5, id="alexa", coalesce=True)
    scheduler.add_job(
        _check_missed_chores, "cron", hour=23, minute=59, id="missed_chores", coalesce=True
    )
    scheduler.add_job(
        sync.cleanup_old_completed, "cron", hour=3, minute=30, id="cleanup", coalesce=True
    )
    # Re-scan hourly so clips icloudpd adds later get converted too. The worker
    # skips anything already cached, so a repeat pass is cheap.
    scheduler.add_job(_kick_derivatives, "interval", hours=1, id="derivatives", coalesce=True)
    scheduler.start()
    # kick off an initial pull shortly after boot (staggered)
    for i, job_id in enumerate(("calendar", "icloud", "alexa")):
        scheduler.modify_job(job_id, next_run_time=datetime.now() + timedelta(seconds=5 + i * 10))
    # Start the transcode backfill after the syncs, so first paint isn't slowed.
    scheduler.modify_job("derivatives", next_run_time=datetime.now() + timedelta(seconds=45))
    log.info("scheduler started")


def stop() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
