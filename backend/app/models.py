from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class CalendarAccount(Base):
    """A connected Google account."""

    __tablename__ = "calendar_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True)
    token_json: Mapped[str] = mapped_column(Text)
    picture: Mapped[str] = mapped_column(String, default="")  # Google profile photo URL
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    selections: Mapped[list["CalendarSelection"]] = relationship(
        back_populates="account", cascade="all, delete-orphan"
    )


class CalendarSelection(Base):
    """One Google calendar chosen for display, with the person's color."""

    __tablename__ = "calendar_selections"
    __table_args__ = (UniqueConstraint("account_id", "calendar_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("calendar_accounts.id"))
    calendar_id: Mapped[str] = mapped_column(String)
    name: Mapped[str] = mapped_column(String)
    person_name: Mapped[str] = mapped_column(String, default="")
    color: Mapped[str] = mapped_column(String, default="#6366f1")
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    sync_token: Mapped[str] = mapped_column(String, default="")

    account: Mapped[CalendarAccount] = relationship(back_populates="selections")
    events: Mapped[list["CalendarEvent"]] = relationship(
        back_populates="selection", cascade="all, delete-orphan"
    )


class CalendarEvent(Base):
    """Local cache of Google events so the dashboard renders instantly/offline."""

    __tablename__ = "calendar_events"
    __table_args__ = (UniqueConstraint("selection_id", "external_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    selection_id: Mapped[int] = mapped_column(ForeignKey("calendar_selections.id"))
    external_id: Mapped[str] = mapped_column(String)
    title: Mapped[str] = mapped_column(String, default="")
    start: Mapped[str] = mapped_column(String)  # ISO datetime or date
    end: Mapped[str] = mapped_column(String)
    all_day: Mapped[bool] = mapped_column(Boolean, default=False)
    location: Mapped[str] = mapped_column(String, default="")
    description: Mapped[str] = mapped_column(String, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    selection: Mapped[CalendarSelection] = relationship(back_populates="events")


class Task(Base):
    """A to-do item synced from iCloud Reminders, Alexa, or created locally."""

    __tablename__ = "tasks"
    __table_args__ = (UniqueConstraint("source", "external_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(String)  # icloud | alexa | local
    external_id: Mapped[str] = mapped_column(String)
    list_name: Mapped[str] = mapped_column(String, default="")
    title: Mapped[str] = mapped_column(String)
    notes: Mapped[str] = mapped_column(Text, default="")
    due_date: Mapped[str] = mapped_column(String, default="")  # ISO date/datetime, "" if none
    person_name: Mapped[str] = mapped_column(String, default="")
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    recurrence: Mapped[str] = mapped_column(String, default="")  # "" = one-off, "daily", "weekly:...", etc.
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class ShoppingItem(Base):
    """A shopping-list item, possibly present in multiple sources (deduped by norm_title)."""

    __tablename__ = "shopping_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String)
    norm_title: Mapped[str] = mapped_column(String, unique=True)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    # [{"source": "icloud"|"alexa"|"local", "external_id": "..."}]
    sources: Mapped[list] = mapped_column(JSON, default=list)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class Recipe(Base):
    __tablename__ = "recipes"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String)
    source_url: Mapped[str] = mapped_column(String, default="")
    image_url: Mapped[str] = mapped_column(String, default="")
    servings: Mapped[str] = mapped_column(String, default="")
    prep_time: Mapped[str] = mapped_column(String, default="")
    cook_time: Mapped[str] = mapped_column(String, default="")
    total_time: Mapped[str] = mapped_column(String, default="")
    ingredients: Mapped[list] = mapped_column(JSON, default=list)  # list[str]
    steps: Mapped[list] = mapped_column(JSON, default=list)  # list[str]
    tags: Mapped[list] = mapped_column(JSON, default=list)  # list[str]
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class MealPlanEntry(Base):
    __tablename__ = "meal_plan"
    __table_args__ = (UniqueConstraint("date", "slot"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[str] = mapped_column(String)  # YYYY-MM-DD
    slot: Mapped[str] = mapped_column(String)  # breakfast | lunch | dinner
    text: Mapped[str] = mapped_column(String, default="")
    recipe_id: Mapped[int | None] = mapped_column(ForeignKey("recipes.id"), nullable=True)


class Setting(Base):
    """Free-form key/value store (selected reminder lists, kiosk prefs, ...)."""

    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[dict | list | str | int | None] = mapped_column(JSON, nullable=True)


class Person(Base):
    """Family member shown on chores views; color used when a task is assigned to them."""

    __tablename__ = "people"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True)
    color: Mapped[str] = mapped_column(String, default="#6366f1")
    avatar_emoji: Mapped[str] = mapped_column(String, default="")  # chosen display picture


class Chore(Base):
    """An in-app chore assigned to a family member, with coin rewards."""

    __tablename__ = "chores"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String)
    assigned_to: Mapped[str] = mapped_column(String, default="")  # person_name
    coins: Mapped[int] = mapped_column(Integer, default=1)
    due_date: Mapped[str] = mapped_column(String, default="")  # ISO date or ""
    notes: Mapped[str] = mapped_column(Text, default="")
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    recurrence: Mapped[str] = mapped_column(String, default="")  # "" = one-off, "daily", "weekly:0,2,4"
    last_reset_date: Mapped[str] = mapped_column(String, default="")  # ISO date of last reset
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class RewardItem(Base):
    """A reward available in the rewards store."""

    __tablename__ = "reward_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String)
    coin_cost: Mapped[int] = mapped_column(Integer, default=1)
    emoji: Mapped[str] = mapped_column(String, default="🎁")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class CoinTransaction(Base):
    """Tracks all coin changes: earned (chore completion), lost (missed chore), spent (redemption)."""

    __tablename__ = "coin_transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    person_name: Mapped[str] = mapped_column(String)
    amount: Mapped[int] = mapped_column(Integer)  # positive = earned, negative = spent/penalty
    reason: Mapped[str] = mapped_column(String)  # "chore_completed", "chore_missed", "reward_redeemed"
    reference_id: Mapped[int | None] = mapped_column(Integer, nullable=True)  # chore_id or reward_item_id
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class PhotoMetadata(Base):
    """Cached EXIF metadata, dimensions, and reverse-geocoded location names for family photos."""

    __tablename__ = "photo_metadata"

    file_path: Mapped[str] = mapped_column(String, primary_key=True) # relative path as unique identifier
    file_type: Mapped[str] = mapped_column(String, default="image") # image or video
    width: Mapped[int] = mapped_column(Integer, default=1920)
    height: Mapped[int] = mapped_column(Integer, default=1080)
    orientation: Mapped[str] = mapped_column(String, default="landscape")
    date_taken: Mapped[str | None] = mapped_column(String, nullable=True)  # ISO string representation
    latitude: Mapped[float | None] = mapped_column(JSON, nullable=True)
    longitude: Mapped[float | None] = mapped_column(JSON, nullable=True)
    location_name: Mapped[str | None] = mapped_column(String, nullable=True)  # e.g., "San Francisco, CA"
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    last_modified: Mapped[float] = mapped_column(JSON, default=0.0)

