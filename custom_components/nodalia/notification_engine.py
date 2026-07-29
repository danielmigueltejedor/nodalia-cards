"""Pure notification policy helpers used by the Nodalia backend."""

from __future__ import annotations

from datetime import datetime
from typing import Any

SEVERITY_SCORE = {"info": 1, "success": 2, "warning": 3, "critical": 4}
INACTIVE_ERROR_STATES = {"", "0", "none", "ok", "unknown", "unavailable"}

DEFAULT_THRESHOLDS = {
    "hot_temperature": 27.0,
    "cold_temperature": 17.0,
    "humidity_high": 70.0,
    "humidity_low": 30.0,
    "battery_low": 20.0,
    "humidifier_fill_low": 20.0,
    "humidifier_fill_full": 90.0,
    "ink_low": 15.0,
}

DEFAULT_COPY = {
    "door": ("Door open", "{name} has been opened.", "warning"),
    "window": ("Window open", "{name} has been opened.", "warning"),
    "motion": ("Motion detected", "Motion detected by {name}.", "info"),
    "vacuum": ("Vacuum needs attention", "{name}: {value}", "critical"),
    "hot": ("High temperature", "{name} is at {value}{unit}.", "warning"),
    "cold": ("Low temperature", "{name} is at {value}{unit}.", "info"),
    "humidity_high": ("High humidity", "{name} is at {value}{unit}.", "warning"),
    "humidity_low": ("Low humidity", "{name} is at {value}{unit}.", "warning"),
    "battery_low": ("Low battery", "{name} is at {value}{unit}.", "warning"),
    "humidifier_fill_low": ("Humidifier needs water", "{name} is at {value}{unit}.", "warning"),
    "humidifier_fill_full": ("Humidifier tank full", "{name} is at {value}{unit}.", "warning"),
    "ink_low": ("Low ink", "{name} is at {value}{unit}.", "warning"),
}

ENTITY_GROUP_KINDS = {
    "vacuum": "vacuum",
    "vacuum_error": "vacuum",
    "door": "door",
    "window": "window",
    "motion": "motion",
    "temperature": "temperature",
    "humidity": "humidity",
    "battery": "battery",
    "humidifier_fill": "humidifier_fill",
    "humidifier_full": "humidifier_full",
    "ink": "ink",
}


def _mapping(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _rows(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _strings(value: Any, limit: int = 512) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in _rows(value):
        text = str(item or "").strip()
        if not text or text in seen:
            continue
        seen.add(text)
        result.append(text)
        if len(result) >= limit:
            break
    return result


def _number(value: Any, fallback: float) -> float:
    try:
        text = str(value).strip().replace("%", "")
        return float(text)
    except (TypeError, ValueError):
        return fallback


def optional_number(value: Any) -> float | None:
    """Parse common Home Assistant numeric state strings."""
    try:
        text = str(value).strip().replace("%", "")
        if text.lower() in {"", "none", "unknown", "unavailable"}:
            return None
        return float(text)
    except (TypeError, ValueError):
        return None


def normalize_profile(raw: Any) -> dict[str, Any]:
    """Normalize an untrusted profile before persistence or evaluation."""
    source = _mapping(raw)
    notify_source = _mapping(source.get("notify"))
    context_source = _mapping(source.get("context"))
    quiet_source = _mapping(context_source.get("quiet_hours"))
    entities_source = _mapping(source.get("entities"))
    threshold_source = _mapping(source.get("thresholds"))

    thresholds = {
        key: _number(threshold_source.get(key), fallback)
        for key, fallback in DEFAULT_THRESHOLDS.items()
    }
    entities = {
        key: _strings(entities_source.get(key))
        for key in ENTITY_GROUP_KINDS
    }
    entities["outdoor_temperature"] = _strings(entities_source.get("outdoor_temperature"))
    entities["outdoor_humidity"] = _strings(entities_source.get("outdoor_humidity"))

    smart: dict[str, dict[str, str]] = {}
    for key, value in _mapping(source.get("smart")).items():
        row = _mapping(value)
        smart[str(key)] = {
            "title": str(row.get("title") or "").strip(),
            "message": str(row.get("message") or "").strip(),
            "mobile": normalize_mobile_policy(row.get("mobile")),
        }

    overrides: dict[str, dict[str, str]] = {}
    for entity_id, value in _mapping(source.get("overrides")).items():
        entity = str(entity_id or "").strip()
        if not entity:
            continue
        row = _mapping(value)
        overrides[entity] = {
            "title": str(row.get("title") or "").strip(),
            "message": str(row.get("message") or "").strip(),
            "mobile": normalize_mobile_policy(row.get("mobile"), allow_inherit=True),
        }

    custom: list[dict[str, Any]] = []
    for index, value in enumerate(_rows(source.get("custom"))[:100]):
        row = _mapping(value)
        entity = str(row.get("entity") or "").strip()
        if not entity:
            continue
        custom.append(
            {
                "id": str(row.get("id") or f"custom-{index}").strip(),
                "entity": entity,
                "attribute": str(row.get("attribute") or "").strip(),
                "condition": str(row.get("condition") or "changed").strip().lower(),
                "value": str(row.get("value") or "").strip(),
                "title": str(row.get("title") or "Notification").strip(),
                "message": str(row.get("message") or "{name}: {value}").strip(),
                "severity": normalize_severity(row.get("severity")),
                "mobile": normalize_mobile_policy(row.get("mobile")),
            }
        )

    return {
        "version": 1,
        "enabled": source.get("enabled") is True,
        "notify": {
            "enabled": notify_source.get("enabled") is True,
            "entities": _strings(notify_source.get("entities"), 32),
            "services": _strings(notify_source.get("services"), 32),
            "min_severity": normalize_severity(notify_source.get("min_severity"), "warning"),
            "critical_alerts": notify_source.get("critical_alerts") is True,
            "default_policy": normalize_mobile_policy(notify_source.get("default_policy")),
            "cooldown_minutes": max(0.0, min(1440.0, _number(notify_source.get("cooldown_minutes"), 30.0))),
            "group_similar": notify_source.get("group_similar") is not False,
        },
        "context": {
            "presence_entity": str(context_source.get("presence_entity") or "").strip(),
            "only_when_away": context_source.get("only_when_away") is True,
            "only_when_home": context_source.get("only_when_home") is True,
            "quiet_hours": {
                "enabled": quiet_source.get("enabled") is True,
                "start": normalize_clock(quiet_source.get("start"), "22:00"),
                "end": normalize_clock(quiet_source.get("end"), "07:00"),
                "allow_critical": quiet_source.get("allow_critical") is not False,
            },
        },
        "smart": smart,
        "custom": custom,
        "thresholds": thresholds,
        "entities": entities,
        "overrides": overrides,
    }


def normalize_mobile_policy(value: Any, allow_inherit: bool = False) -> str:
    """Normalize mobile delivery policy names shared with the card."""
    if allow_inherit and (value is None or not str(value).strip()):
        return "inherit"
    policy = str(value or "auto").strip().lower().replace("-", "_")
    if allow_inherit and policy in {"", "inherit"}:
        return "inherit"
    aliases = {"on": "push", "enabled": "push", "card": "card_only", "false": "off"}
    policy = aliases.get(policy, policy)
    return policy if policy in {"auto", "push", "card_only", "off"} else "auto"


def normalize_severity(value: Any, fallback: str = "info") -> str:
    severity = str(value or fallback).strip().lower()
    return severity if severity in SEVERITY_SCORE else fallback


def normalize_clock(value: Any, fallback: str) -> str:
    text = str(value or "").strip()
    parts = text.split(":")
    if len(parts) != 2:
        return fallback
    try:
        hour, minute = int(parts[0]), int(parts[1])
    except ValueError:
        return fallback
    if not 0 <= hour <= 23 or not 0 <= minute <= 59:
        return fallback
    return f"{hour:02d}:{minute:02d}"


def watched_entities(profile: dict[str, Any]) -> set[str]:
    """Return the exact entities that need indexed state listeners."""
    watched: set[str] = set()
    for rows in _mapping(profile.get("entities")).values():
        watched.update(_strings(rows))
    for row in _rows(profile.get("custom")):
        entity = str(_mapping(row).get("entity") or "").strip()
        if entity:
            watched.add(entity)
    presence = str(_mapping(profile.get("context")).get("presence_entity") or "").strip()
    if presence:
        watched.add(presence)
    return watched


def is_within_quiet_hours(profile: dict[str, Any], now: datetime) -> bool:
    quiet = _mapping(_mapping(profile.get("context")).get("quiet_hours"))
    if quiet.get("enabled") is not True:
        return False
    start = clock_minutes(quiet.get("start"), 22 * 60)
    end = clock_minutes(quiet.get("end"), 7 * 60)
    current = now.hour * 60 + now.minute
    if start == end:
        return False
    return start <= current < end if start < end else current >= start or current < end


def clock_minutes(value: Any, fallback: int = 0) -> int:
    normalized = normalize_clock(value, "")
    if not normalized:
        return fallback
    hour, minute = normalized.split(":")
    return int(hour) * 60 + int(minute)


def passes_presence_context(profile: dict[str, Any], presence_state: str | None) -> bool:
    context = _mapping(profile.get("context"))
    if context.get("only_when_away") is not True and context.get("only_when_home") is not True:
        return True
    normalized = str(presence_state or "").strip().lower()
    if normalized in {"", "unknown", "unavailable", "none"}:
        return False
    is_home = normalized in {"home", "on", "occupied", "present", "detected"}
    if context.get("only_when_away") is True and is_home:
        return False
    if context.get("only_when_home") is True and not is_home:
        return False
    return True


def evaluate_transition(
    profile: dict[str, Any],
    entity_id: str,
    old_value: Any,
    new_value: Any,
    attributes: dict[str, Any] | None = None,
    old_attributes: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Build zero or more backend alerts for one state transition."""
    attrs = _mapping(attributes)
    old_attrs = _mapping(old_attributes)
    friendly = str(attrs.get("friendly_name") or entity_id)
    unit = str(attrs.get("unit_of_measurement") or "")
    old_text = str(old_value if old_value is not None else "").strip()
    new_text = str(new_value if new_value is not None else "").strip()
    if old_text == new_text and attrs == old_attrs:
        return []

    alerts: list[dict[str, Any]] = []
    for row in _rows(profile.get("custom")):
        custom = _mapping(row)
        if custom.get("entity") != entity_id:
            continue
        attribute = str(custom.get("attribute") or "").strip()
        current = attrs.get(attribute) if attribute else new_value
        previous = old_attrs.get(attribute) if attribute else old_value
        if custom_condition_matches(custom.get("condition"), previous, current, custom.get("value")):
            alerts.append(
                build_alert(
                    profile,
                    kind="custom",
                    entity_id=entity_id,
                    value=current,
                    friendly=friendly,
                    unit=unit,
                    custom=custom,
                )
            )

    entities = _mapping(profile.get("entities"))
    thresholds = _mapping(profile.get("thresholds"))
    kind = ""
    new_lower = new_text.lower()
    old_lower = old_text.lower()
    new_number = optional_number(new_value)
    old_number = optional_number(old_value)

    if entity_id in _strings(entities.get("door")) and new_lower == "on" and old_lower != "on":
        kind = "door"
    elif entity_id in _strings(entities.get("window")) and new_lower == "on" and old_lower != "on":
        kind = "window"
    elif entity_id in _strings(entities.get("motion")) and new_lower == "on" and old_lower != "on":
        kind = "motion"
    elif entity_id in _strings(entities.get("vacuum")) and new_lower in {"error", "unavailable"} and old_lower != new_lower:
        kind = "vacuum"
    elif entity_id in _strings(entities.get("vacuum_error")) and new_lower not in INACTIVE_ERROR_STATES and old_lower != new_lower:
        kind = "vacuum"
    elif crossed_high(entity_id, entities.get("temperature"), new_number, old_number, thresholds.get("hot_temperature")):
        kind = "hot"
    elif crossed_low(entity_id, entities.get("temperature"), new_number, old_number, thresholds.get("cold_temperature")):
        kind = "cold"
    elif crossed_high(entity_id, entities.get("humidity"), new_number, old_number, thresholds.get("humidity_high")):
        kind = "humidity_high"
    elif crossed_low(entity_id, entities.get("humidity"), new_number, old_number, thresholds.get("humidity_low")):
        kind = "humidity_low"
    elif crossed_low(entity_id, entities.get("battery"), new_number, old_number, thresholds.get("battery_low")):
        kind = "battery_low"
    elif crossed_low(entity_id, entities.get("humidifier_fill"), new_number, old_number, thresholds.get("humidifier_fill_low")):
        kind = "humidifier_fill_low"
    elif crossed_high(entity_id, entities.get("humidifier_full"), new_number, old_number, thresholds.get("humidifier_fill_full")):
        kind = "humidifier_fill_full"
    elif crossed_low(entity_id, entities.get("ink"), new_number, old_number, thresholds.get("ink_low")):
        kind = "ink_low"

    if kind:
        alerts.append(
            build_alert(
                profile,
                kind=kind,
                entity_id=entity_id,
                value=new_value,
                friendly=friendly,
                unit=unit,
            )
        )
    return [alert for alert in alerts if alert_passes_minimum(profile, alert)]


def crossed_high(entity_id: str, rows: Any, new: float | None, old: float | None, threshold: Any) -> bool:
    limit = optional_number(threshold)
    return entity_id in _strings(rows) and new is not None and limit is not None and new >= limit and (old is None or old < limit)


def crossed_low(entity_id: str, rows: Any, new: float | None, old: float | None, threshold: Any) -> bool:
    limit = optional_number(threshold)
    return entity_id in _strings(rows) and new is not None and limit is not None and new <= limit and (old is None or old > limit)


def custom_condition_matches(condition: Any, old_value: Any, new_value: Any, expected: Any) -> bool:
    condition_key = str(condition or "changed").strip().lower()
    old_text = str(old_value if old_value is not None else "").strip().lower()
    new_text = str(new_value if new_value is not None else "").strip().lower()
    expected_text = str(expected if expected is not None else "").strip().lower()
    if condition_key in {"always", "changed"}:
        return old_text != new_text
    if condition_key in {"equals", "eq", "is"}:
        return new_text == expected_text and old_text != new_text
    if condition_key in {"not_equals", "neq", "is_not"}:
        return new_text != expected_text and old_text != new_text
    if condition_key in {"on", "active"}:
        return new_text == "on" and old_text != "on"
    if condition_key in {"off", "inactive"}:
        return new_text == "off" and old_text != "off"
    if condition_key == "unavailable":
        return new_text in {"unknown", "unavailable"} and old_text != new_text
    if condition_key == "missing":
        return new_value is None and old_value is not None
    new_number = optional_number(new_value)
    old_number = optional_number(old_value)
    expected_number = optional_number(expected)
    if new_number is None or expected_number is None:
        return False
    if condition_key in {"above", "greater_than", "gt"}:
        return new_number > expected_number and (old_number is None or old_number <= expected_number)
    if condition_key in {"below", "less_than", "lt"}:
        return new_number < expected_number and (old_number is None or old_number >= expected_number)
    return False


def build_alert(
    profile: dict[str, Any],
    *,
    kind: str,
    entity_id: str,
    value: Any,
    friendly: str,
    unit: str,
    custom: dict[str, Any] | None = None,
) -> dict[str, Any]:
    custom_row = _mapping(custom)
    default_title, default_message, default_severity = DEFAULT_COPY.get(
        kind, ("Notification", "{name}: {value}", "info")
    )
    smart = _mapping(_mapping(profile.get("smart")).get(kind))
    override = _mapping(_mapping(profile.get("overrides")).get(entity_id))
    title = str(custom_row.get("title") or override.get("title") or smart.get("title") or default_title)
    message = str(custom_row.get("message") or override.get("message") or smart.get("message") or default_message)
    severity = normalize_severity(custom_row.get("severity"), default_severity)
    notify = _mapping(profile.get("notify"))
    policy = normalize_mobile_policy(custom_row.get("mobile") or smart.get("mobile") or notify.get("default_policy"))
    override_policy = normalize_mobile_policy(override.get("mobile"), allow_inherit=True)
    if override_policy != "inherit":
        policy = override_policy
    values = {
        "entity": entity_id,
        "entity_id": entity_id,
        "name": friendly,
        "friendly": friendly,
        "value": str(value if value is not None else ""),
        "state": str(value if value is not None else ""),
        "unit": unit,
        "kind": kind,
    }
    identity_suffix = str(custom_row.get("id") or entity_id)
    return {
        "id": f"{kind}:{identity_suffix}",
        "kind": kind,
        "entity_id": entity_id,
        "title": render_template(title, values),
        "message": render_template(message, values),
        "severity": severity,
        "mobile": policy,
    }


def render_template(template: str, values: dict[str, str]) -> str:
    """Replace the small, non-executable placeholder language used by cards."""
    rendered = str(template or "")
    for key, value in values.items():
        rendered = rendered.replace("{" + key + "}", str(value))
    return rendered


def alert_passes_minimum(profile: dict[str, Any], alert: dict[str, Any]) -> bool:
    notify = _mapping(profile.get("notify"))
    if normalize_mobile_policy(alert.get("mobile")) == "push":
        return True
    minimum = normalize_severity(notify.get("min_severity"), "warning")
    severity = normalize_severity(alert.get("severity"))
    return SEVERITY_SCORE[severity] >= SEVERITY_SCORE[minimum]


def delivery_allowed(profile: dict[str, Any], alert: dict[str, Any]) -> bool:
    """Resolve static delivery flags; runtime context is checked separately."""
    notify = _mapping(profile.get("notify"))
    if profile.get("enabled") is not True:
        return False
    policy = normalize_mobile_policy(alert.get("mobile"))
    if policy not in {"auto", "push"}:
        return False
    return notify.get("enabled") is True or policy == "push"


def cooldown_identity(profile: dict[str, Any], alert: dict[str, Any]) -> str:
    notify = _mapping(profile.get("notify"))
    if notify.get("group_similar") is False:
        return str(alert.get("id") or "")
    return str(alert.get("kind") or alert.get("id") or "")
