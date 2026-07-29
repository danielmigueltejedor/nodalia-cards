"""Versioned persistent storage for Nodalia."""

from __future__ import annotations

import asyncio
from copy import deepcopy
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import STORAGE_KEY, STORAGE_SAVE_DELAY, STORAGE_VERSION


def _default_data() -> dict[str, Any]:
    return {
        "notifications": {},
        "notification_runtime": {"cooldowns": {}, "dismissed": {}},
        "climate_schedules": {},
        "news_history": {},
        "vacuum_sessions": {},
    }


class NodaliaStorage:
    """Small storage facade with atomic in-memory mutations."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._data: dict[str, Any] = _default_data()
        self._lock = asyncio.Lock()

    async def async_load(self) -> None:
        """Load and normalize the persisted document."""
        stored = await self._store.async_load()
        if not isinstance(stored, dict):
            return
        normalized = _default_data()
        for key, fallback in normalized.items():
            candidate = stored.get(key)
            if isinstance(candidate, type(fallback)):
                normalized[key] = candidate
        self._data = normalized

    def snapshot(self) -> dict[str, Any]:
        """Return a defensive copy for diagnostics and tests."""
        return deepcopy(self._data)

    def get_section(self, section: str) -> dict[str, Any]:
        """Return a defensive copy of one mapping section."""
        value = self._data.get(section, {})
        return deepcopy(value) if isinstance(value, dict) else {}

    def get(self, section: str, key: str, default: Any = None) -> Any:
        """Read one value defensively."""
        rows = self._data.get(section, {})
        if not isinstance(rows, dict):
            return deepcopy(default)
        return deepcopy(rows.get(key, default))

    async def async_set(self, section: str, key: str, value: Any) -> None:
        """Persist one value immediately."""
        async with self._lock:
            rows = self._data.setdefault(section, {})
            if not isinstance(rows, dict):
                rows = {}
                self._data[section] = rows
            rows[key] = deepcopy(value)
            await self._store.async_save(self._data)

    async def async_delete(self, section: str, key: str) -> bool:
        """Delete and persist one value."""
        async with self._lock:
            rows = self._data.get(section)
            if not isinstance(rows, dict) or key not in rows:
                return False
            del rows[key]
            await self._store.async_save(self._data)
            return True

    def set_delayed(self, section: str, key: str, value: Any) -> None:
        """Update runtime state and debounce its disk write."""
        rows = self._data.setdefault(section, {})
        if not isinstance(rows, dict):
            rows = {}
            self._data[section] = rows
        rows[key] = deepcopy(value)
        self._store.async_delay_save(lambda: self._data, STORAGE_SAVE_DELAY)

    async def async_flush(self) -> None:
        """Force the latest in-memory state to disk."""
        async with self._lock:
            await self._store.async_save(self._data)
