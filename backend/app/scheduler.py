import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from .services import sync

log = logging.getLogger(__name__)


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
    scheduler.start()
    # kick off an initial pull shortly after boot (staggered)
    for i, job_id in enumerate(("calendar", "icloud", "alexa")):
        scheduler.modify_job(job_id, next_run_time=datetime.now() + timedelta(seconds=5 + i * 10))
    log.info("scheduler started")


def stop() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
