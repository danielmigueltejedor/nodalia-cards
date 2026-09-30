const STREAM_MODES = new Set(["auto", "webrtc", "mse", "hls", "mjpeg"]);
const normalizeMode = (value: unknown) => String(value ?? "").trim().toLowerCase();

export function buildGo2rtcViewerUrl(baseUrl: unknown, streamName: unknown, mode: unknown = "auto") {
  const base = String(baseUrl || "").trim();
  const stream = String(streamName || "").trim();
  if (!base || !stream || !/^https?:\/\//i.test(base)) return "";
  try {
    const url = new URL(base);
    if (!/\.html?$/i.test(url.pathname)) {
      url.pathname = `${url.pathname.replace(/\/$/, "")}/stream.html`;
    }
    url.searchParams.set("src", stream);
    const normalizedMode = STREAM_MODES.has(normalizeMode(mode)) ? normalizeMode(mode) : "auto";
    if (normalizedMode === "webrtc") url.searchParams.set("mode", "webrtc,webrtc/tcp");
    else if (normalizedMode !== "auto") url.searchParams.set("mode", normalizedMode);
    else url.searchParams.delete("mode");
    return url.toString();
  } catch (_error) {
    return "";
  }
}

export function sanitizeIframeUrl(rawValue: unknown) {
  const value = String(rawValue || "").trim();
  return /^(?:https?:\/\/|\/(?!\/))/i.test(value) ? value : "";
}

export function buildGo2rtcWebSocketEndpoint(baseUrl: unknown, streamName: unknown) {
  const base = String(baseUrl || "").trim();
  const stream = String(streamName || "").trim();
  if (!base || !stream || !/^https?:\/\//i.test(base)) return "";
  try {
    const url = new URL(base);
    if (!/\/api\/ws\/?$/i.test(url.pathname)) {
      url.pathname = `${url.pathname.replace(/\/$/, "")}/api/ws`;
    }
    url.searchParams.set("src", stream);
    return url.toString();
  } catch (_error) {
    return "";
  }
}

export function buildFrigateGo2rtcPath(clientId: unknown, streamName: unknown) {
  const instance = String(clientId || "frigate").trim() || "frigate";
  const stream = String(streamName || "").trim();
  return stream
    ? `/api/frigate/${encodeURIComponent(instance)}/mse/api/ws?src=${encodeURIComponent(stream)}`
    : "";
}

export function isMixedContentUrl(rawValue: unknown, pageLocation: Pick<Location, "protocol" | "href"> = window.location) {
  if (pageLocation?.protocol !== "https:") return false;
  try {
    return new URL(String(rawValue || ""), pageLocation.href).protocol === "http:";
  } catch (_error) {
    return false;
  }
}


export const cameraStreamModel = Object.freeze({ buildGo2rtcViewerUrl, sanitizeIframeUrl, buildGo2rtcWebSocketEndpoint, buildFrigateGo2rtcPath, isMixedContentUrl });
