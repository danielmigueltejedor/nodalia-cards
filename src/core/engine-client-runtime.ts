import { nodaliaBackend } from "./engine-client";
if (typeof window !== "undefined" && !window.NodaliaBackend) {
  window.NodaliaBackend = nodaliaBackend;
}
