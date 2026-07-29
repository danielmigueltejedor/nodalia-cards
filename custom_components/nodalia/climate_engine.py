"""Pure weekly climate schedule helpers for Nodalia."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Any

DAY_KEYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


def _mapping(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def parse_clock(value: Any) -> int | None:
    text = str(value or "").strip()
    parts = text.split(":")
    if len(parts) != 2:
        return None
    try:
        hour, minute = int(parts[0]), int(parts[1])
    except ValueError:
        return None
    if not 0 <= hour <= 23 or not 0 <= minute <= 59:
        return None
    return hour * 60 + minute


def format_clock(minutes: int) -> str:
    value = max(0, min(1439, int(minutes)))
    return f"{value // 60:02d}:{value % 60:02d}"


def normalize_day(value: Any, fallback_index: int = 0) -> str:
    key = str(value or "").strip().lower()[:3]
    if key in DAY_KEYS:
        return key
    try:
        numeric = int(value)
    except (TypeError, ValueError):
        numeric = fallback_index
    return DAY_KEYS[max(0, min(6, numeric))]


def normalize_schedule(entity_id: str, raw: Any, max_slots: int = 256) -> dict[str, Any]:
    """Validate the full, non-compressed schedule stored by the integration."""
    source = _mapping(raw)
    slots: list[dict[str, Any]] = []
    raw_slots = source.get("slots") if isinstance(source.get("slots"), list) else []
    for index, value in enumerate(raw_slots[:max_slots]):
        row = _mapping(value)
        start = parse_clock(row.get("start"))
        end = parse_clock(row.get("end"))
        try:
            temperature = float(row.get("temperature"))
        except (TypeError, ValueError):
            temperature = 21.0
        if start is None or end is None or not 5 <= temperature <= 40:
            continue
        slot_id = str(row.get("id") or f"slot-{index}").strip()[:100]
        slots.append(
            {
                "id": slot_id,
                "day": normalize_day(row.get("day"), index % 7),
                "start": format_clock(start),
                "end": format_clock(end),
                "temperature": round(temperature, 2),
                "enabled": row.get("enabled") is not False,
            }
        )
    return {
        "version": 1,
        "entity_id": str(entity_id or "").strip(),
        "enabled": source.get("enabled") is not False,
        "week_starts_on": "sunday" if source.get("week_starts_on") == "sunday" else "monday",
        "slots": slots,
    }


def active_slot(schedule: dict[str, Any], now: datetime) -> dict[str, Any] | None:
    """Return the active slot whose start is latest, including overnight slots."""
    if schedule.get("enabled") is False:
        return None
    winner: dict[str, Any] | None = None
    winner_start: datetime | None = None
    for slot in schedule.get("slots", []):
        if not isinstance(slot, dict) or slot.get("enabled") is False:
            continue
        start_minutes = parse_clock(slot.get("start"))
        end_minutes = parse_clock(slot.get("end"))
        if start_minutes is None or end_minutes is None:
            continue
        for offset in (-1, 0):
            candidate_date = now.date() + timedelta(days=offset)
            if DAY_KEYS[candidate_date.weekday()] != slot.get("day"):
                continue
            start_at = local_datetime(candidate_date, start_minutes, now)
            end_date = candidate_date + timedelta(days=1 if end_minutes <= start_minutes else 0)
            end_at = local_datetime(end_date, end_minutes, now)
            if start_at <= now < end_at and (winner_start is None or start_at > winner_start):
                winner = slot
                winner_start = start_at
    return dict(winner) if winner is not None else None


def next_slot_start(schedule: dict[str, Any], now: datetime) -> datetime | None:
    """Return the next enabled slot start in local Home Assistant time."""
    if schedule.get("enabled") is False:
        return None
    candidates: list[datetime] = []
    for slot in schedule.get("slots", []):
        if not isinstance(slot, dict) or slot.get("enabled") is False:
            continue
        start_minutes = parse_clock(slot.get("start"))
        if start_minutes is None:
            continue
        for offset in range(0, 8):
            candidate_date = now.date() + timedelta(days=offset)
            if DAY_KEYS[candidate_date.weekday()] != slot.get("day"):
                continue
            candidate = local_datetime(candidate_date, start_minutes, now)
            if candidate > now:
                candidates.append(candidate)
                break
    return min(candidates) if candidates else None


def local_datetime(day: date, minutes: int, reference: datetime) -> datetime:
    """Build an aware local datetime using Home Assistant's current timezone."""
    hour, minute = divmod(minutes, 60)
    return datetime.combine(day, time(hour=hour, minute=minute), tzinfo=reference.tzinfo)
