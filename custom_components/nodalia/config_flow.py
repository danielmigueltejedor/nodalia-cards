"""Config flow for Nodalia."""

from __future__ import annotations

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.data_entry_flow import ConfigFlowResult

from .const import DOMAIN, INTEGRATION_NAME


class NodaliaConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Create the single local Nodalia runtime."""

    VERSION = 1

    async def async_step_user(self, user_input: dict | None = None) -> ConfigFlowResult:
        """Handle setup from Settings."""
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        if user_input is not None:
            return self.async_create_entry(title=INTEGRATION_NAME, data={})
        return self.async_show_form(step_id="user", data_schema=vol.Schema({}))

    async def async_step_reconfigure(self, user_input: dict | None = None) -> ConfigFlowResult:
        """Offer a no-settings reconfigure flow for a native UI experience."""
        if user_input is not None:
            return self.async_update_reload_and_abort(self._get_reconfigure_entry(), data={})
        return self.async_show_form(step_id="reconfigure", data_schema=vol.Schema({}))
