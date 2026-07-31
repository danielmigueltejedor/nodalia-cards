"""Native climate schedule runtime for Nodalia."""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.event import async_track_point_in_time
from homeassistant.helpers.start import async_at_started
from homeassistant.util import dt as dt_util

from .climate_engine import active_slot, next_schedule_boundary, normalize_schedule
from .const import MAX_CLIMATE_SCHEDULES, MAX_CLIMATE_SLOTS
from .storage import NodaliaStorage

_LOGGER = logging.getLogger(__name__)


class NodaliaClimateManager:
    """Store and execute weekly schedules without helpers or automations."""

    def __init__(self, hass: HomeAssistant, storage: NodaliaStorage) -> None:
        self.hass = hass
        self.storage = storage
        self._schedules: dict[str, dict[str, Any]] = {}
        self._unsub_timer: Callable[[], None] | None = None
        self._unsub_start: Callable[[], None] | None = None
        self._started = False

    async def async_start(self) -> None:
        raw_schedules = self.storage.get_section("climate_schedules")
        self._schedules = {
            entity_id: normalize_schedule(entity_id, value, MAX_CLIMATE_SLOTS)
            for entity_id, value in raw_schedules.items()
            if str(entity_id).startswith("climate.")
        }
        self._unsub_start = async_at_started(self.hass, self._async_home_assistant_started)

    async def _async_home_assistant_started(self, _hass: HomeAssistant) -> None:
        self._started = True
        await self._async_apply_all()
        self._reschedule()

    async def async_stop(self) -> None:
        if self._unsub_timer is not None:
            self._unsub_timer()
            self._unsub_timer = None
        if self._unsub_start is not None:
            self._unsub_start()
            self._unsub_start = None
        self._started = False

    def schedule_ids(self) -> list[str]:
        return sorted(self._schedules)

    def get_schedule(self, entity_id: str) -> dict[str, Any] | None:
        schedule = self._schedules.get(str(entity_id or "").strip())
        return dict(schedule) if schedule is not None else None

    async def async_set_schedule(self, entity_id: str, raw_schedule: Any) -> dict[str, Any]:
        entity = str(entity_id or "").strip()
        if not entity.startswith("climate."):
            raise ValueError("A climate entity_id is required")
        if entity not in self._schedules and len(self._schedules) >= MAX_CLIMATE_SCHEDULES:
            raise ValueError(f"At most {MAX_CLIMATE_SCHEDULES} climate schedules are supported")
        schedule = normalize_schedule(entity, raw_schedule, MAX_CLIMATE_SLOTS)
        self._schedules[entity] = schedule
        await self.storage.async_set("climate_schedules", entity, schedule)
        if self._started:
            await self._async_apply_schedule(schedule)
            self._reschedule()
        return dict(schedule)

    async def async_delete_schedule(self, entity_id: str) -> bool:
        entity = str(entity_id or "").strip()
        if entity not in self._schedules:
            return False
        del self._schedules[entity]
        deleted = await self.storage.async_delete("climate_schedules", entity)
        self._reschedule()
        return deleted

    def diagnostics(self) -> dict[str, Any]:
        now = dt_util.now()
        schedules: dict[str, Any] = {}
        for entity_id, schedule in self._schedules.items():
            boundary = next_schedule_boundary(schedule, now)
            schedules[entity_id] = {
                "enabled": schedule.get("enabled") is not False,
                "slot_count": len(schedule.get("slots", [])),
                "active_slot": (active_slot(schedule, now) or {}).get("id"),
                "next_start": boundary.isoformat() if boundary is not None else None,
            }
        return {
            "schedule_count": len(self._schedules),
            "schedules": schedules,
        }

    async def _async_apply_all(self) -> None:
        for schedule in tuple(self._schedules.values()):
            await self._async_apply_schedule(schedule)

    async def _async_apply_schedule(self, schedule: dict[str, Any]) -> bool:
        slot = active_slot(schedule, dt_util.now())
        if slot is None:
            return False
        entity_id = str(schedule.get("entity_id") or "")
        state = self.hass.states.get(entity_id)
        if state is None or str(state.state).lower() in {"unavailable", "unknown"}:
            return False
        temperature = float(slot["temperature"])
        current_target = state.attributes.get("temperature")
        try:
            if current_target is not None and abs(float(current_target) - temperature) < 0.01:
                return True
        except (TypeError, ValueError):
            pass
        try:
            await self.hass.services.async_call(
                "climate",
                "set_temperature",
                {"temperature": temperature},
                blocking=True,
                target={"entity_id": [entity_id]},
            )
            return True
        except HomeAssistantError as err:
            _LOGGER.warning("Nodalia could not apply climate schedule to %s: %s", entity_id, err)
            return False

    def _reschedule(self) -> None:
        if self._unsub_timer is not None:
            self._unsub_timer()
            self._unsub_timer = None
        if not self._started:
            return
        now = dt_util.now()
        candidates = [
            candidate
            for schedule in self._schedules.values()
            if (candidate := next_schedule_boundary(schedule, now)) is not None
        ]
        if not candidates:
            return
        self._unsub_timer = async_track_point_in_time(
            self.hass,
            self._async_schedule_boundary,
            min(candidates),
        )

    async def _async_schedule_boundary(self, _now) -> None:
        self._unsub_timer = None
        await self._async_apply_all()
        self._reschedule()
