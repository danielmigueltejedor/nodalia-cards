const FALLBACK_MANIFEST = {
  "pkgVersion": "1.0.0-alpha.51",
  "contentSha256_12": "856210e983e3",
  "file": "nodalia-cards.bundle.js"
};

async function loadNodaliaCardsBundle() {
  const manifestUrl = new URL("./nodalia-cards.manifest.js", import.meta.url);
  manifestUrl.searchParams.set("t", String(Date.now()));
  let manifest = FALLBACK_MANIFEST;
  try {
    const module = await import(manifestUrl.href);
    manifest = module.default || {
      pkgVersion: module.pkgVersion,
      contentSha256_12: module.contentSha256_12,
      file: module.file,
    };
  } catch (error) {
    if (typeof console !== "undefined" && typeof console.warn === "function") {
      console.warn("nodalia-cards: no se pudo cargar el manifest cache-busting; usando fallback embebido.", error);
    }
  }

  const bundleFile = typeof manifest.file === "string" && manifest.file ? manifest.file : FALLBACK_MANIFEST.file;
  const bundleUrl = new URL(bundleFile, import.meta.url);
  bundleUrl.searchParams.set("v", manifest.contentSha256_12 || manifest.pkgVersion || String(Date.now()));
  await import(bundleUrl.href);

  if (typeof window !== "undefined") {
    window.__NODALIA_LOADER__ = {
      pkgVersion: manifest.pkgVersion || FALLBACK_MANIFEST.pkgVersion,
      contentSha256_12: manifest.contentSha256_12 || FALLBACK_MANIFEST.contentSha256_12,
      bundleUrl: bundleUrl.href,
    };
  }
}

await loadNodaliaCardsBundle();
