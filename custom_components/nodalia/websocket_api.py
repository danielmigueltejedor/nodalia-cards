"""Authenticated WebSocket bridge for Nodalia Cards."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant

from .const import API_VERSION, CAPABILITIES, DATA_RUNTIME, DOMAIN, INTEGRATION_VERSION
from .runtime import NodaliaRuntime

API_VERSION_FIELD = vol.Optional("api_version", default=API_VERSION)


def _runtime(hass: HomeAssistant) -> NodaliaRuntime | None:
    domain_data = hass.data.get(DOMAIN)
    if not isinstance(domain_data, dict):
        return None
    runtime = domain_data.get(DATA_RUNTIME)
    return runtime if isinstance(runtime, NodaliaRuntime) else None


def _send_runtime_missing(connection, msg: dict[str, Any]) -> None:
    connection.send_error(msg["id"], "not_loaded", "Nodalia is installed but its config entry is not loaded")


@websocket_api.websocket_command(
    {vol.Required("type"): "nodalia/status", API_VERSION_FIELD: vol.Coerce(int)}
)
@websocket_api.async_response
async def websocket_status(hass, connection, msg) -> None:
    runtime = _runtime(hass)
    connection.send_result(
        msg["id"],
        {
            "available": runtime is not None and runtime.started,
            "api_version": API_VERSION,
            "version": INTEGRATION_VERSION,
            "capabilities": [name for name, enabled in CAPABILITIES.items() if enabled],
        },
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): "nodalia/notifications/get",
        API_VERSION_FIELD: vol.Coerce(int),
        vol.Optional("profile_id", default="default"): str,
    }
)
@websocket_api.async_response
async def websocket_notifications_get(hass, connection, msg) -> None:
    runtime = _runtime(hass)
    if runtime is None:
        _send_runtime_missing(connection, msg)
        return
    profile_id = msg.get("profile_id", "default")
    connection.send_result(
        msg["id"],
        {
            "profile_id": profile_id,
            "profile": runtime.notifications.get_profile(profile_id),
            "dismissed": runtime.notifications.dismissed(profile_id),
        },
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): "nodalia/notifications/set",
        API_VERSION_FIELD: vol.Coerce(int),
        vol.Optional("profile_id", default="default"): str,
        vol.Required("profile"): dict,
    }
)
@websocket_api.async_response
async def websocket_notifications_set(hass, connection, msg) -> None:
    connection.require_admin()
    runtime = _runtime(hass)
    if runtime is None:
        _send_runtime_missing(connection, msg)
        return
    try:
        profile = await runtime.notifications.async_set_profile(msg.get("profile_id", "default"), msg["profile"])
    except ValueError as err:
        connection.send_error(msg["id"], "invalid_format", str(err))
        return
    profile_id = msg.get("profile_id", "default")
    connection.send_result(
        msg["id"],
        {"profile": profile, "dismissed": runtime.notifications.dismissed(profile_id)},
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): "nodalia/notifications/delete",
        API_VERSION_FIELD: vol.Coerce(int),
        vol.Optional("profile_id", default="default"): str,
    }
)
@websocket_api.async_response
async def websocket_notifications_delete(hass, connection, msg) -> None:
    connection.require_admin()
    runtime = _runtime(hass)
    if runtime is None:
        _send_runtime_missing(connection, msg)
        return
    deleted = await runtime.notifications.async_delete_profile(msg.get("profile_id", "default"))
    connection.send_result(msg["id"], {"deleted": deleted})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "nodalia/notifications/dismiss",
        API_VERSION_FIELD: vol.Coerce(int),
        vol.Optional("profile_id", default="default"): str,
        vol.Required("alert_id"): str,
    }
)
@websocket_api.async_response
async def websocket_notifications_dismiss(hass, connection, msg) -> None:
    runtime = _runtime(hass)
    if runtime is None:
        _send_runtime_missing(connection, msg)
        return
    try:
        await runtime.notifications.async_dismiss(msg.get("profile_id", "default"), msg["alert_id"])
    except ValueError as err:
        connection.send_error(msg["id"], "invalid_format", str(err))
        return
    connection.send_result(msg["id"], {"dismissed": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "nodalia/notifications/test",
        API_VERSION_FIELD: vol.Coerce(int),
        vol.Optional("profile_id", default="default"): str,
        vol.Optional("title", default="Nodalia"): str,
        vol.Optional("message", default="Background notifications are ready."): str,
    }
)
@websocket_api.async_response
async def websocket_notifications_test(hass, connection, msg) -> None:
    connection.require_admin()
    runtime = _runtime(hass)
    if runtime is None:
        _send_runtime_missing(connection, msg)
        return
    try:
        delivered = await runtime.notifications.async_send_test(
            msg.get("profile_id", "default"), msg.get("title"), msg.get("message")
        )
    except ValueError as err:
        connection.send_error(msg["id"], "invalid_format", str(err))
        return
    connection.send_result(msg["id"], {"delivered": delivered})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "nodalia/climate/schedule/get",
        API_VERSION_FIELD: vol.Coerce(int),
        vol.Required("entity_id"): str,
    }
)
@websocket_api.async_response
async def websocket_climate_schedule_get(hass, connection, msg) -> None:
    runtime = _runtime(hass)
    if runtime is None:
        _send_runtime_missing(connection, msg)
        return
    connection.send_result(
        msg["id"],
        {"schedule": runtime.climate.get_schedule(msg["entity_id"])},
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): "nodalia/climate/schedule/set",
        API_VERSION_FIELD: vol.Coerce(int),
        vol.Required("entity_id"): str,
        vol.Required("schedule"): dict,
    }
)
@websocket_api.async_response
async def websocket_climate_schedule_set(hass, connection, msg) -> None:
    connection.require_admin()
    runtime = _runtime(hass)
    if runtime is None:
        _send_runtime_missing(connection, msg)
        return
    try:
        schedule = await runtime.climate.async_set_schedule(msg["entity_id"], msg["schedule"])
    except ValueError as err:
        connection.send_error(msg["id"], "invalid_format", str(err))
        return
    connection.send_result(msg["id"], {"schedule": schedule})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "nodalia/climate/schedule/delete",
        API_VERSION_FIELD: vol.Coerce(int),
        vol.Required("entity_id"): str,
    }
)
@websocket_api.async_response
async def websocket_climate_schedule_delete(hass, connection, msg) -> None:
    connection.require_admin()
    runtime = _runtime(hass)
    if runtime is None:
        _send_runtime_missing(connection, msg)
        return
    deleted = await runtime.climate.async_delete_schedule(msg["entity_id"])
    connection.send_result(msg["id"], {"deleted": deleted})


@websocket_api.websocket_command(
    {vol.Required("type"): "nodalia/diagnostics", API_VERSION_FIELD: vol.Coerce(int)}
)
@websocket_api.async_response
async def websocket_diagnostics(hass, connection, msg) -> None:
    connection.require_admin()
    runtime = _runtime(hass)
    if runtime is None:
        _send_runtime_missing(connection, msg)
        return
    connection.send_result(msg["id"], runtime.diagnostics())


def async_register(hass: HomeAssistant) -> None:
    """Register the stable v1 frontend protocol exactly once."""
    for command in (
        websocket_status,
        websocket_notifications_get,
        websocket_notifications_set,
        websocket_notifications_delete,
        websocket_notifications_dismiss,
        websocket_notifications_test,
        websocket_climate_schedule_get,
        websocket_climate_schedule_set,
        websocket_climate_schedule_delete,
        websocket_diagnostics,
    ):
        websocket_api.async_register_command(hass, command)
