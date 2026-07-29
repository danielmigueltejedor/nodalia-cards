"""Privacy-preserving diagnostics for Nodalia."""

from __future__ import annotations

from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import API_VERSION, CAPABILITIES, DATA_RUNTIME, DOMAIN, INTEGRATION_VERSION


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant, entry: ConfigEntry
) -> dict[str, Any]:
    """Return counts and versions without entity ids, messages or notify targets."""
    runtime = hass.data.get(DOMAIN, {}).get(DATA_RUNTIME)
    runtime_data = runtime.diagnostics() if runtime is not None else {"started": False}
    notifications = runtime_data.get("notifications", {})
    climate = runtime_data.get("climate", {})
    return {
        "entry_id": entry.entry_id,
        "version": INTEGRATION_VERSION,
        "api_version": API_VERSION,
        "capabilities": CAPABILITIES,
        "started": runtime_data.get("started", False),
        "notification_profile_count": notifications.get("profile_count", 0),
        "notification_watched_entity_count": notifications.get("watched_entity_count", 0),
        "climate_schedule_count": climate.get("schedule_count", 0),
    }
