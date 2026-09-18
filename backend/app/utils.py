import calendar
from datetime import date, timedelta

def is_due_on(check_date: date, ref_date: date, recurrence: str) -> bool:
    """
    Check if a recurring item is due on `check_date` given a `ref_date` (the starting reference point)
    and a `recurrence` pattern string.
    
    Supported formats:
    - "": One-off / does not repeat
    - "daily": Every day
    - "weekly:0,2,4": Every week on specific weekdays (0=Mon, 6=Sun)
    - "biweekly:0,2,4": Every 2 weeks on specific weekdays (0=Mon, 6=Sun)
    - "monthly:day": Monthly on the same calendar day (e.g. 14th of every month)
    - "monthly:weekday": Monthly on the same weekday pattern (e.g. 2nd Tuesday of every month)
    """
    if not recurrence:
        return False
        
    if recurrence == "daily":
        return True
        
    if recurrence.startswith("weekly:"):
        parts = recurrence.split(":")
        if len(parts) < 2:
            return False
        weekdays = parts[1].split(",")
        return str(check_date.weekday()) in weekdays
        
    if recurrence.startswith("biweekly:"):
        parts = recurrence.split(":")
        if len(parts) < 2:
            return False
        # Calculate weeks elapsed since the reference date's Monday
        ref_monday = ref_date - timedelta(days=ref_date.weekday())
        check_monday = check_date - timedelta(days=check_date.weekday())
        weeks_diff = (check_monday - ref_monday).days // 7
        if weeks_diff % 2 != 0:
            return False
        # Check weekday
        weekdays = parts[1].split(",")
        return str(check_date.weekday()) in weekdays
        
    if recurrence == "monthly:day":
        # Monthly on the same calendar day of the month
        last_day = calendar.monthrange(check_date.year, check_date.month)[1]
        if ref_date.day >= last_day:
            return check_date.day == last_day
        else:
            return check_date.day == ref_date.day
            
    if recurrence == "monthly:weekday":
        # Monthly on the same weekday pattern (e.g. 2nd Tuesday)
        ref_occurrence = (ref_date.day - 1) // 7 + 1
        check_occurrence = (check_date.day - 1) // 7 + 1
        return check_date.weekday() == ref_date.weekday() and check_occurrence == ref_occurrence

    return False


def next_due_date(today: date, recurrence: str, ref_date: date | None = None) -> date:
    """
    Calculate the next occurrence date on or after `today` (>= today) for an item
    with the given recurrence rule and optional starting ref_date.
    """
    if not recurrence:
        if ref_date and ref_date < today:
            return today
        return ref_date or today

    if recurrence == "daily":
        return today

    if recurrence.startswith("weekly:"):
        parts = recurrence.split(":")
        if len(parts) >= 2:
            weekdays = parts[1].split(",")
            for offset in range(7):
                candidate = today + timedelta(days=offset)
                if str(candidate.weekday()) in weekdays:
                    return candidate
        return today

    if recurrence.startswith("biweekly:"):
        anchor = ref_date or today
        for offset in range(14):
            candidate = today + timedelta(days=offset)
            if is_due_on(candidate, anchor, recurrence):
                return candidate
        # Fallback if anchor parity didn't match: anchor to today
        for offset in range(14):
            candidate = today + timedelta(days=offset)
            if is_due_on(candidate, today, recurrence):
                return candidate
        return today

    if recurrence == "monthly:day":
        target_day = ref_date.day if ref_date else today.day
        # Check current month
        last_day_this_month = calendar.monthrange(today.year, today.month)[1]
        cand_this_month = date(today.year, today.month, min(target_day, last_day_this_month))
        if cand_this_month >= today:
            return cand_this_month
        # Next month
        next_month = today.month + 1
        next_year = today.year
        if next_month > 12:
            next_month = 1
            next_year += 1
        last_day_next_month = calendar.monthrange(next_year, next_month)[1]
        return date(next_year, next_month, min(target_day, last_day_next_month))

    if recurrence == "monthly:weekday":
        anchor = ref_date or today
        for offset in range(35):
            candidate = today + timedelta(days=offset)
            if is_due_on(candidate, anchor, recurrence):
                return candidate
        return today

    return today
