export const CARD_TAG = "nodalia-room-summary-card";
export const EDITOR_TAG = "nodalia-room-summary-card-editor";
export const CARD_VERSION = "2.3.0-alpha.33";

export const HUB_PANELS = new Set(["home", "lights", "covers", "climate", "vacuum", "fans", "humidifiers", "media", "camera", "security", "others"]);
export const COMFORT = { hot: 27, cold: 17, humid: 70, dry: 30 };
export const CUSTOMIZABLE_EMBED_LISTS = new Set(["lights", "vacuums", "fans", "humidifiers", "others"]);
export const NORMALIZED_ROOM_CONFIG = Symbol("nodalia-room-summary-normalized");
