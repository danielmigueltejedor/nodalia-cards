"""Top-level Nodalia runtime."""

from __future__ import annotations

from homeassistant.core import HomeAssistant

from .climate import NodaliaClimateManager
from .notifications import NodaliaNotificationManager
from .storage import NodaliaStorage


class NodaliaRuntime:
    """Coordinate storage and optional card capabilities."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.storage = NodaliaStorage(hass)
        self.notifications = NodaliaNotificationManager(hass, self.storage)
        self.climate = NodaliaClimateManager(hass, self.storage)
        self.started = False

    async def async_start(self) -> None:
        await self.storage.async_load()
        await self.notifications.async_start()
        await self.climate.async_start()
        self.started = True

    async def async_stop(self) -> None:
        self.started = False
        await self.climate.async_stop()
        await self.notifications.async_stop()

    def diagnostics(self) -> dict:
        return {
            "started": self.started,
            "notifications": self.notifications.diagnostics(),
            "climate": self.climate.diagnostics(),
        }
