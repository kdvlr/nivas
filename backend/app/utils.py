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
