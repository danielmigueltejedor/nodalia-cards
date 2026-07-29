"""Serve and register the bundled Nodalia Cards frontend."""

from __future__ import annotations

import logging
from collections.abc import Callable
from pathlib import Path
from typing import Any

from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant
from homeassistant.helpers.event import async_call_later

from .const import FRONTEND_FILENAME, FRONTEND_URL_BASE, INTEGRATION_VERSION

_LOGGER = logging.getLogger(__name__)


class NodaliaFrontendRegistration:
    """Register one cache-busted resource while respecting an existing HACS card."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._retry_unsub: Callable[[], None] | None = None
        self._attempts = 0

    async def async_register(self) -> None:
        frontend_dir = Path(__file__).parent / "frontend"
        try:
            await self.hass.http.async_register_static_paths(
                [StaticPathConfig(FRONTEND_URL_BASE, str(frontend_dir), True)]
            )
        except RuntimeError:
            # Static routes live for the HA process lifetime and survive entry reloads.
            _LOGGER.debug("Nodalia frontend path is already registered")
        await self._async_register_resource_when_ready()

    async def _async_register_resource_when_ready(self, _now: Any = None) -> None:
        self._retry_unsub = None
        lovelace = self.hass.data.get("lovelace")
        resources = getattr(lovelace, "resources", None)
        if resources is None:
            self._schedule_retry()
            return
        if not getattr(resources, "loaded", False):
            get_info = getattr(resources, "async_get_info", None)
            if callable(get_info):
                try:
                    await get_info()
                except Exception:  # Home Assistant may still be finishing Lovelace setup.
                    self._schedule_retry()
                    return
            if not getattr(resources, "loaded", False):
                self._schedule_retry()
                return
        async_items = getattr(resources, "async_items", None)
        if not callable(async_items):
            _LOGGER.debug("Lovelace resources are not managed in storage mode")
            return
        items = list(async_items())
        own_path = f"{FRONTEND_URL_BASE}/{FRONTEND_FILENAME}"
        own_url = f"{own_path}?v={INTEGRATION_VERSION}"
        existing_nodalia = []
        for item in items:
            url = str(item.get("url") or "")
            path = url.split("?", 1)[0]
            if path.endswith("/nodalia-cards.js") or "/hacsfiles/nodalia-cards/" in path:
                existing_nodalia.append(item)

        # Existing dashboard installations remain authoritative during migration.
        if any(not str(item.get("url") or "").split("?", 1)[0].startswith(FRONTEND_URL_BASE) for item in existing_nodalia):
            _LOGGER.debug("Existing Nodalia Cards dashboard resource detected; backend bundle registration skipped")
            return
        for item in existing_nodalia:
            if str(item.get("url") or "") == own_url:
                return
            update = getattr(resources, "async_update_item", None)
            if callable(update):
                await update(item["id"], {"res_type": "module", "url": own_url})
                return
        create = getattr(resources, "async_create_item", None)
        if callable(create):
            await create({"res_type": "module", "url": own_url})

    def _schedule_retry(self) -> None:
        self._attempts += 1
        if self._attempts > 30 or self._retry_unsub is not None:
            return
        self._retry_unsub = async_call_later(
            self.hass,
            2,
            self._async_register_resource_when_ready,
        )

    async def async_stop(self) -> None:
        if self._retry_unsub is not None:
            self._retry_unsub()
            self._retry_unsub = None
