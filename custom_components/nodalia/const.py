"""Constants for the Nodalia integration."""

from __future__ import annotations

from typing import Final

DOMAIN: Final = "nodalia"
INTEGRATION_NAME: Final = "Nodalia"
INTEGRATION_VERSION: Final = "2.0.0-alpha.58"
API_VERSION: Final = 1

DATA_RUNTIME: Final = "runtime"
DATA_WEBSOCKET_REGISTERED: Final = "websocket_registered"
DATA_FRONTEND: Final = "frontend"

STORAGE_VERSION: Final = 1
STORAGE_KEY: Final = "nodalia"
STORAGE_SAVE_DELAY: Final = 1.0

DEFAULT_NOTIFICATION_PROFILE: Final = "default"
MAX_NOTIFICATION_PROFILES: Final = 20
MAX_NOTIFICATION_TARGETS: Final = 32
MAX_NOTIFICATION_WATCHED_ENTITIES: Final = 512
MAX_CLIMATE_SCHEDULES: Final = 128
MAX_CLIMATE_SLOTS: Final = 256

FRONTEND_URL_BASE: Final = "/nodalia"
FRONTEND_FILENAME: Final = "nodalia-cards.js"

CAPABILITIES: Final = {
    "notifications": True,
    "notifications_background": True,
    "notifications_shared_dismissals": True,
    "climate_schedules": True,
    "news_history": False,
    "vacuum_sessions": False,
    "frontend_bundle": True,
}
