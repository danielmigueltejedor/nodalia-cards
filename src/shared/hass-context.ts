import type { HomeAssistant } from "../core/types/home-assistant";

/** Snapshot scalar identity: HA can mutate its user on an existing hass object. */
export interface HassContext {
  present: boolean;
  connection: HomeAssistant["connection"];
  auth: HomeAssistant["auth"];
  user: string;
  admin: boolean;
}
export const captureHassContext = (hass: { connection?: HomeAssistant["connection"]; auth?: HomeAssistant["auth"]; user?: HomeAssistant["user"] } | null | undefined): HassContext => ({
  present: Boolean(hass), connection: hass?.connection, auth: hass?.auth,
  user: hass?.user?.id || "", admin: hass?.user?.is_admin === true,
});
export const sameHassContext = (a: HassContext, b: HassContext): boolean => a.present === b.present
  && a.connection === b.connection && a.auth === b.auth && a.user === b.user && a.admin === b.admin;
