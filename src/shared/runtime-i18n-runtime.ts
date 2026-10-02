import {PACK,type RuntimeLocale} from "./runtime-i18n-data";
import type {HassEntity} from "../core/types/home-assistant";
export function createRuntimeI18n() {
  const isRecord=(value:unknown):value is Record<string,unknown>=>value!==null && typeof value==="object" && !Array.isArray(value);
  function readRootHass():unknown {
    const root=typeof document!=="undefined"?document.querySelector("home-assistant"):null;
    return root?Reflect.get(root,"hass"):null;
  }
  function baseLang(code:unknown) {
    if (!code || typeof code !== "string") {
      return null;
    }
    const trimmed = code.trim();
    const lower = trimmed.toLowerCase();
    if (lower === "auto") {
      return null;
    }
    const two = lower.slice(0, 2);
    const aliases:Record<string,string>={nb:"no",nn:"no"};
    const alias=aliases[two];
    return PACK[two] ? two : (alias && PACK[alias] ? alias : null);
  }

  /**
   * Lovelace often calls setConfig before hass is set on the editor element.
   * Use the app root hass so resolveLanguage still sees HA profile / locale.
   */
  function resolveHass(hass:unknown) {
    if (isRecord(hass)) {
      if (
        hass.states != null
        || hass.config != null
        || hass.locale != null
        || hass.user != null
        || typeof hass.callService === "function"
        || (typeof hass.language === "string" && hass.language.trim() !== "")
      ) {
        return hass;
      }
    }
    if (typeof document === "undefined") {
      return hass;
    }
    try {
      const current=readRootHass();
      if(current) return current;
    } catch (_err) {
      // ignore
    }
    return hass;
  }

  /**
   * Reads HA UI language from hass (root exposes `language`, `selectedLanguage`, `locale.language`).
   * Lovelace may pass a hass object with states but without i18n fields until a later update — fall back
   * to `document.querySelector("home-assistant")?.hass` so `language: auto` matches the profile.
   */
  /**
   * Home Assistant stores the profile language in localStorage (`selectedLanguage`, JSON string).
   * That value is more reliable than the legacy `hass.language` field, which can reflect the
   * server default (e.g. Spanish) while the user profile is English.
   */
  function profileLanguageFromStorage(storage:Pick<Storage,"getItem">|null|undefined) {
    if (!storage || typeof storage.getItem !== "function") {
      return null;
    }
    try {
      const raw = storage.getItem("selectedLanguage");
      if (!raw) {
        return null;
      }
      let parsed:unknown = raw;
      try {
        parsed = JSON.parse(raw);
      } catch (_err) {
        // HA stores a JSON-encoded string; tolerate plain values.
      }
      const code = typeof parsed === "string" ? parsed : String(parsed ?? "").trim();
      return code ? baseLang(code) : null;
    } catch (_err) {
      return null;
    }
  }

  function profileLanguageFromLocalStorage() {
    if (typeof localStorage === "undefined") {
      return null;
    }
    return profileLanguageFromStorage(localStorage);
  }

  function profileLanguageFromSessionStorage() {
    if (typeof sessionStorage === "undefined") {
      return null;
    }
    return profileLanguageFromStorage(sessionStorage);
  }

  function effectiveHaLanguageCode(hass:unknown) {
    const fromProfileObject = (h:unknown) => {
      if (!isRecord(h)) {
        return null;
      }
      const locale=isRecord(h.locale)?h.locale:{};
      const user=isRecord(h.user)?h.user:{};
      const userLocale=isRecord(user.locale)?user.locale:{};
      const raw=
        (typeof h.selectedLanguage==="string" && h.selectedLanguage.trim() && h.selectedLanguage) ||
        (typeof locale.language==="string" && locale.language.trim() && locale.language) ||
        (typeof user.language==="string" && user.language.trim() && user.language) ||
        (typeof userLocale.language==="string" && userLocale.language.trim() && userLocale.language);
      return raw ? baseLang(raw) : null;
    };
    const fromLegacyObject = (h:unknown) => {
      if (!isRecord(h)) {
        return null;
      }
      const raw = typeof h.language === "string" && h.language.trim() && h.language;
      return raw ? baseLang(raw) : null;
    };
    const rootHass =
      readRootHass();
    const inHomeAssistant =
      typeof document !== "undefined" && Boolean(document.querySelector("home-assistant"));
    /**
     * Prefer the app-root hass first: Lovelace sometimes passes a hass-shaped object that has
     * entity state but omits `language`; the canonical UI language lives on `home-assistant.hass`.
     * Within a hass object, `selectedLanguage` / `locale.language` are more reliable than the older
     * generic `language` field, which can lag behind the profile and leak Spanish labels into English UIs.
     */
    const profile =
      profileLanguageFromLocalStorage()
      || profileLanguageFromSessionStorage()
      || fromProfileObject(rootHass)
      || fromProfileObject(resolveHass(hass));
    if (profile) {
      return profile;
    }

    if (typeof document !== "undefined") {
      const docLang = baseLang(String(document.documentElement?.getAttribute("lang") || "").trim());
      if (docLang) {
        return docLang;
      }
    }

    if (!inHomeAssistant) {
      return fromLegacyObject(rootHass) || fromLegacyObject(resolveHass(hass));
    }

    return null;
  }

  function resolveLanguage(hass:unknown, configLang?:unknown) {
    const configured = baseLang(configLang);
    if (configured) {
      return configured;
    }
    const ha = effectiveHaLanguageCode(hass);
    if (ha) {
      return ha;
    }
    if (typeof document !== "undefined") {
      const docLang = baseLang(String(document.documentElement?.getAttribute("lang") || "").trim());
      if (docLang) {
        return docLang;
      }
    }
    /**
     * Inside Home Assistant, do not fall back to `navigator.language`: it often disagrees with the
     * profile (e.g. FR browser + ES HA), which produced mixed Meteoalarm UI (French labels/dates vs
     * Spanish alert text). Outside HA (tests / standalone pages), navigator is still used.
     */
    if (typeof navigator !== "undefined" && navigator.language) {
      const inHomeAssistant =
        typeof document !== "undefined" && document.querySelector("home-assistant");
      if (!inHomeAssistant) {
      const nav = baseLang(String(navigator.language));
      if (nav) {
        return nav;
        }
      }
    }
    return "en";
  }

  function localeTag(langCode:string) {
    const map:Record<string,string> = {
      es: "es",
      en: "en",
      de: "de",
      fr: "fr",
      it: "it",
      nl: "nl",
      no: "nb-NO",
      pt: "pt",
      ru: "ru",
      el: "el",
      zh: "zh",
      ro: "ro",
    };
    return map[langCode] || "en";
  }

  function normalizeTextKey(value:unknown) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/-/g, "_");
  }

  const VACUUM_CLEAR_ERROR_KEYS = new Set([
    "",
    "none",
    "no_error",
    "ok",
    "normal",
    "unknown",
    "unavailable",
  ]);

  function getEntityDomain(state:unknown) {
    const entityId = String((isRecord(state)?state.entity_id:undefined) || "").trim();
    const dot = entityId.indexOf(".");
    return dot > 0 ? entityId.slice(0, dot) : "";
  }



  function localePack(code:string):unknown {
    const entry=PACK[code];
    if(typeof entry!=="function") return entry;
    const resolved:unknown=entry();PACK[code]=resolved;return resolved;
  }
  function englishLocale():RuntimeLocale {
    const entry=PACK.en;
    if(typeof entry!=="function") return entry;
    const resolved=entry();PACK.en=resolved;return resolved;
  }
  /** Merge locale trees so partial locales inherit full card strings from English. */
  function deepMergeLocale(base:unknown,override:unknown):unknown {
    if(override===undefined || override===null) return base;
    if(!isRecord(base) || !isRecord(override)) return override;
    const out:Record<string,unknown>={...base};
    for(const key of Object.keys(override)) {
      const value=Object.prototype.hasOwnProperty.call(base,key) && isRecord(base[key]) && isRecord(override[key])?deepMergeLocale(base[key],override[key]):override[key];
      Object.defineProperty(out,key,{value,writable:true,enumerable:true,configurable:true});
    }
    return out;
  }
  function matchesLocaleShape(value:unknown,shape:unknown):boolean {
    if(typeof shape==="string") return typeof value==="string";
    if(!isRecord(shape) || !isRecord(value)) return false;
    if(Object.values(shape).every(item=>typeof item==="string") && !Object.values(value).every(item=>item===undefined || typeof item==="string")) return false;
    return Object.keys(shape).every(key=>Object.prototype.hasOwnProperty.call(value,key) && matchesLocaleShape(value[key],shape[key]));
  }
  function isRuntimeLocale(value:unknown):value is RuntimeLocale {return matchesLocaleShape(value,englishLocale());}
  const localeStringsCache=new Map<string,RuntimeLocale>();
  function strings(langCode:string):RuntimeLocale {
    const code=PACK[langCode]?langCode:"en";
    if(code==="en") return englishLocale();
    const cached=localeStringsCache.get(code);
    if(cached) return cached;
    const merged=deepMergeLocale(englishLocale(),localePack(code));
    const result=isRuntimeLocale(merged)?merged:englishLocale();
    localeStringsCache.set(code,result);return result;
  }
  function readLabelPath(root:unknown,path:string):unknown {
    return String(path||"").split(".").filter(Boolean).reduce((cursor:unknown,key)=>isRecord(cursor)?cursor[key]:undefined,root);
  }
  function translateUiPath(lang:string,card:string,path:string,fallback:string,values:Record<string,unknown>):string {
    const raw=readLabelPath(strings(lang)[card],path),english=readLabelPath(strings("en")[card],path);
    const template=typeof raw==="string"?raw:typeof english==="string"?english:String(fallback||"");
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g,(_match:string,key:string)=>String(values[key]??""));
  }

  function normalizeHumidifierModeKey(value:unknown) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function translateWeatherCondition(hass:unknown, configLang:string, value:unknown) {
    const lang = resolveLanguage(hass, configLang);
    const key = normalizeTextKey(String(value || ""));
    const cond = strings(lang).weatherCard.conditions;
    if (key && cond[key]) {
      return cond[key];
    }
    const raw = String(value || "").trim();
    if (raw) {
      return raw;
    }
    return strings(lang).weatherCard.defaultCondition;
  }

  function translateWeatherForecastUi(hass:unknown, configLang:string, uiKey:string) {
    const lang = resolveLanguage(hass, configLang);
    const f = strings(lang).weatherCard.forecast;
    if (f && f[uiKey]) {
      return f[uiKey];
    }
    return englishLocale().weatherCard.forecast[uiKey] || "";
  }

  function translateGraphEmptyHistory(hass:unknown, configLang:string) {
    const lang = resolveLanguage(hass, configLang);
    return strings(lang).graphCard.emptyHistory;
  }

  function translateNotificationsUi(hass:unknown, configLang:string, path:string, fallback = "", values:Record<string,unknown> = {}) {
    return translateUiPath(resolveLanguage(hass,configLang),"notificationsCard",path,fallback,values);
  }

  function translateCalendarUi(hass:unknown, configLang:string, path:string, fallback = "", values:Record<string,unknown> = {}) {
    return translateUiPath(resolveLanguage(hass,configLang),"calendarCard",path,fallback,values);
  }

  function translateNewsUi(hass:unknown, configLang:string, path:string, fallback = "", values:Record<string,unknown> = {}) {
    return translateUiPath(resolveLanguage(hass,configLang),"newsCard",path,fallback,values);
  }

  function translateLightUi(hass:unknown, configLang:string, path:string, fallback = "", values:Record<string,unknown> = {}) {
    return translateUiPath(resolveLanguage(hass,configLang),"lightCard",path,fallback,values);
  }

  function translateHumidifierMode(hass:unknown, configLang:string, value:unknown) {
    const lang = resolveLanguage(hass, configLang);
    const key = normalizeHumidifierModeKey(value);
    const modes = strings(lang).humidifierCard.modes;
    if (key && modes[key]) {
      return modes[key];
    }
    return String(value ?? "").trim();
  }

  function translateEntityStateChip(hass:unknown, configLang:string, rawKey:unknown) {
    const lang = resolveLanguage(hass, configLang);
    const k = normalizeTextKey(rawKey);
    if (!k) {
      return null;
    }
    const en = strings("en").entityCard?.states || {};
    const loc = strings(lang).entityCard?.states;
    const label = loc?.[k] ?? en[k];
    return label ?? null;
  }

  function translateMediaPlayerState(hass:unknown, configLang:string, stateValue:unknown) {
    const lang = resolveLanguage(hass, configLang);
    const k = normalizeTextKey(stateValue);
    const en = strings("en").entityCard?.states || {};
    const loc = strings(lang).entityCard?.states;
    if (k) {
      const label = loc?.[k] ?? en[k];
      if (label) {
        return label;
      }
    }
    const raw = String(stateValue ?? "").trim();
    return raw || en.unknown || "Unknown";
  }

  function translateClimateHvacLabel(hass:unknown, configLang:string, rawValue:unknown, fromAction:boolean) {
    const lang = resolveLanguage(hass, configLang);
    const k = normalizeTextKey(rawValue);
    const ccLoc = strings(lang).climateCard;
    const ccEn = strings("en").climateCard || {};
    const modes = { ...(ccEn.modes || {}), ...(ccLoc?.modes || {}) };
    const actions = { ...(ccEn.actions || {}), ...(ccLoc?.actions || {}) };
    const modeAlias:Record<string,string> = { heating: "heat", cooling: "cool", drying: "dry" };
    const humanize = (val:unknown) => String(val ?? "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (ch:string) => ch.toUpperCase());
    if (!k) {
      return "";
    }
    if (fromAction) {
      if (actions[k]) {
        return actions[k];
      }
      if (modes[k]) {
        return modes[k];
      }
      const mapped = modeAlias[k];
      if (mapped && modes[mapped]) {
        return modes[mapped];
      }
      return humanize(rawValue);
    }
    if (modes[k]) {
      return modes[k];
    }
    const mapped = modeAlias[k];
    if (mapped && modes[mapped]) {
      return modes[mapped];
    }
    if (actions[k]) {
      return actions[k];
    }
    return humanize(rawValue);
  }

  function translateClimateDialAria(hass:unknown, configLang:string, variant:string) {
    const lang = resolveLanguage(hass, configLang);
    let key = "dialTargetSlider";
    if (variant === "rangeGroup") {
      key = "dialRangeGroup";
    } else if (variant === "noSetpoint") {
      key = "dialNoSetpoint";
    }
    const ccLoc = strings(lang).climateCard?.aria || {};
    const ccEn = strings("en").climateCard?.aria || {};
    const fallback =
      variant === "rangeGroup"
        ? "Comfort range and indoor temperature"
        : variant === "noSetpoint"
          ? "Indoor temperature; thermostat has no active target yet"
          : "Target temperature";
    return ccLoc[key] ?? ccEn[key] ?? fallback;
  }

  function translateClimateAria(hass:unknown, configLang:string, key:string, fallback = "") {
    const lang = resolveLanguage(hass, configLang);
    const ccLoc = strings(lang).climateCard?.aria || {};
    const ccEn = strings("en").climateCard?.aria || {};
    return ccLoc[key] ?? ccEn[key] ?? fallback;
  }

  function translateCommonAria(hass:unknown, configLang:string, key:string, fallback = "") {
    const lang = resolveLanguage(hass, configLang);
    const commonLoc = strings(lang).common?.aria || {};
    const commonEn = strings("en").common?.aria || {};
    return commonLoc[key] ?? commonEn[key] ?? fallback;
  }

  function applyRuntimeUiTemplate(raw:unknown, values:Record<string,unknown> = {}) {
    let text = String(raw ?? "");
    Object.entries(values).forEach(([token, value]) => {
      text = text.split(`{${token}}`).join(String(value ?? ""));
    });
    return text;
  }

  function translateFanAria(hass:unknown, configLang:string, key:string, fallback = "") {
    const lang = resolveLanguage(hass, configLang);
    const loc = strings(lang).fan?.aria || {};
    const en = strings("en").fan?.aria || {};
    return loc[key] ?? en[key] ?? fallback;
  }

  function translateHumidifierAria(hass:unknown, configLang:string, key:string, fallback = "") {
    const lang = resolveLanguage(hass, configLang);
    const loc = strings(lang).humidifierCard?.aria || {};
    const en = strings("en").humidifierCard?.aria || {};
    return loc[key] ?? en[key] ?? fallback;
  }

  function translateMediaBrowserUi(hass:unknown, configLang:string, key:string, fallback = "", values:Record<string,unknown> = {}) {
    const lang = resolveLanguage(hass, configLang);
    const loc = strings(lang).mediaBrowser || {};
    const en = strings("en").mediaBrowser || {};
    return applyRuntimeUiTemplate(loc[key] ?? en[key] ?? fallback, values);
  }

  function translateMediaPlayerAria(hass:unknown, configLang:string, key:string, fallback = "", values:Record<string,unknown> = {}) {
    const lang = resolveLanguage(hass, configLang);
    const loc = strings(lang).mediaPlayerCard?.aria || {};
    const en = strings("en").mediaPlayerCard?.aria || {};
    return applyRuntimeUiTemplate(loc[key] ?? en[key] ?? fallback, values);
  }

  function translateClimateDialNoSetpointHint(hass:unknown, configLang:string) {
    const lang = resolveLanguage(hass, configLang);
    const ccLoc = strings(lang).climateCard || {};
    const ccEn = strings("en").climateCard || {};
    return ccLoc.dialNoSetpointHint ?? ccEn.dialNoSetpointHint ?? "No active setpoint";
  }

  function translateClimateSchedule(hass:unknown, configLang:string, key:string, fallback = "") {
    const lang = resolveLanguage(hass, configLang);
    const parts = String(key || "").split(".").filter(Boolean);
    const read = (root:unknown) => {
      let cursor = root;
      for (const part of parts) {
        if (!isRecord(cursor) || !(part in cursor)) {
          return null;
        }
        cursor = cursor[part];
      }
      return typeof cursor === "string" ? cursor : null;
    };
    const localized = read(strings(lang).climateCard?.schedule);
    if (localized) {
      return localized;
    }
    const english = read(strings("en").climateCard?.schedule);
    if (english) {
      return english;
    }
    return fallback;
  }

  function translateHumidifierDeviceState(hass:unknown, configLang:string, rawValue:unknown) {
    const lang = resolveLanguage(hass, configLang);
    const k = normalizeTextKey(rawValue);
    const dict = {
      ...(strings("en").humidifierCard?.deviceStates || {}),
      ...(strings(lang).humidifierCard?.deviceStates || {}),
    };
    if (k && dict[k]) {
      return dict[k];
    }
    return String(rawValue ?? "").trim();
  }

  /** Same normalization as `nodalia-weather-card.js` for CAP / Meteoalarm attribute strings. */
  function meteoalarmApiKey(value:unknown) {
    return String(value ?? "")
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  /**
   * Maps API text (EN/ES/FR/DE/IT/NL variants) to canonical keys under `weatherCard.meteoalarm.terms`.
   */
  const METEOALARM_CANONICAL_BY_API_KEY:Record<string,string> = {
    moderate: "moderate",
    severe: "severe",
    high: "high",
    extreme: "extreme",
    minor: "minor",
    yellow: "yellow",
    orange: "orange",
    red: "red",
    green: "green",
    future: "future",
    immediate: "immediate",
    expected: "expected",
    past: "past",
    likely: "likely",
    observed: "observed",
    possible: "possible",
    unlikely: "unlikely",
    unknown: "unknown",
    met: "met",
    monitor: "monitor",
    moderado: "moderate",
    severo: "severe",
    alto: "high",
    extremo: "extreme",
    menor: "minor",
    amarillo: "yellow",
    naranja: "orange",
    rojo: "red",
    verde: "green",
    futuro: "future",
    inmediato: "immediate",
    immediato: "immediate",
    sofort: "immediate",
    unmittelbar: "immediate",
    esperado: "expected",
    pasado: "past",
    probable: "likely",
    observado: "observed",
    posible: "possible",
    improbable: "unlikely",
    desconocido: "unknown",
    meteorologico: "met",
    monitorizar: "monitor",
    modere: "moderate",
    eleve: "high",
    elevee: "high",
    futur: "future",
    immediat: "immediate",
    prevu: "expected",
    passe: "past",
    observe: "observed",
    maessig: "moderate",
    messig: "moderate",
    gering: "minor",
    moderato: "moderate",
    elevato: "high",
    matig: "moderate",
    hoog: "high",
    laag: "minor",
    onbekend: "unknown",
  };

  function translateMeteoalarmTerm(hass:unknown, configLang:string, raw:unknown) {
    const text = String(raw ?? "").trim();
    if (!text) {
      return "";
    }
    const lang = resolveLanguage(hass, configLang);
    const apiKey = meteoalarmApiKey(text);
    const canonical = METEOALARM_CANONICAL_BY_API_KEY[apiKey] || apiKey;
    const terms = strings(lang).weatherCard?.meteoalarm?.terms;
    if (terms?.[canonical]) {
      return terms[canonical];
    }
    const enTerms = strings("en").weatherCard?.meteoalarm?.terms;
    if (enTerms?.[canonical]) {
      return enTerms[canonical];
    }
    return text;
  }

  function translateAdvanceVacuumReportedState(hass:unknown, configLang:string, stateKey:unknown, rawFallback:unknown) {
    const lang = resolveLanguage(hass, configLang);
    const k = normalizeTextKey(stateKey);
    const rs = strings(lang).advanceVacuum.reportedStates;
    if (rs[k]) {
      return rs[k];
    }
    const es = strings("es").advanceVacuum.reportedStates;
    if (es[k]) {
      return rs[k] || strings("en").advanceVacuum.reportedStates[k] || es[k];
    }
    if (rawFallback != null && rawFallback !== "") {
      return String(rawFallback);
    }
    return rs.unknown || es.unknown;
  }

  function isVacuumErrorState(rawValue:unknown) {
    const key = normalizeTextKey(rawValue);
    return !VACUUM_CLEAR_ERROR_KEYS.has(key);
  }

  function translateVacuumErrorState(hass:unknown, configLang:string, rawValue:unknown, rawFallback:unknown) {
    const raw = String(rawValue ?? rawFallback ?? "").trim();
    const key = normalizeTextKey(raw);
    if (!key || VACUUM_CLEAR_ERROR_KEYS.has(key)) {
      return "";
    }
    const lang = resolveLanguage(hass, configLang);
    const labels = strings(lang).vacuumErrorLabels || {};
    const english = strings("en").vacuumErrorLabels || {};
    return labels[key] || english[key] || raw
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (match:string) => match.toUpperCase());
  }

  function translateAdvanceVacuumVacuumMode(hass:unknown, configLang:string, rawValue:unknown, kind = "generic") {
    const raw = String(rawValue || "").trim();
    if (!raw) {
      return "";
    }
    const lang = resolveLanguage(hass, configLang);
    const key = normalizeTextKey(raw);
    const av = strings(lang).advanceVacuum;
    if (key === "off" && kind === "suction") {
      return av.offSuction;
    }
    if (av.vacuumModes[key]) {
      return av.vacuumModes[key];
    }
    const esm = strings("es").advanceVacuum.vacuumModes;
    if (esm[key]) {
      return av.vacuumModes[key] || strings("en").advanceVacuum.vacuumModes[key] || esm[key];
    }
    return raw
      .replaceAll("_", " ")
      .replace(/\bplus\b/gi, "+")
      .replace(/\b\w/g, (match:string) => match.toUpperCase());
  }

  function translateEntityState(langCode:string, state:HassEntity|null|undefined, numberDecimals:number, formatNumericValueWithUnit:(value:string,unit:string,decimals:number)=>string, formatNumericValue:(value:string,decimals:number)=>string, parseNumericValue:(value:unknown)=>number|null) {
    const code = PACK[langCode] ? langCode : "en";
    const dict = strings(code).entityCard || strings("en").entityCard || {};
    if (!state) {
      return null;
    }

    const rawState = String(state.state ?? "").trim();
    const unit = String(
      state.attributes?.unit_of_measurement || state.attributes?.native_unit_of_measurement || "",
    ).trim();
    const key = normalizeTextKey(rawState);
    const domain = getEntityDomain(state);
    const deviceClass = normalizeTextKey(state.attributes?.device_class);

    if (parseNumericValue(rawState) !== null) {
      return unit
        ? formatNumericValueWithUnit(rawState, unit, numberDecimals)
        : formatNumericValue(rawState, numberDecimals);
    }

    if (domain === "binary_sensor") {
      const isOpenState = ["on", "open", "opening"].includes(key);
      const isClosedState = ["off", "closed", "closing"].includes(key);

      if (["door", "opening", "window", "garage_door"].includes(deviceClass)) {
        if (isOpenState) {
          return dict.binarySensor.doorOpen;
        }
        if (isClosedState) {
          return dict.binarySensor.doorClosed;
        }
      }

      if (["motion", "occupancy", "presence", "moving"].includes(deviceClass)) {
        if (isOpenState) {
          return dict.binarySensor.motionOn;
        }
        if (isClosedState) {
          return dict.binarySensor.motionOff;
        }
      }
    }

    if (domain === "lock") {
      if (key === "locking") {
        return dict.states.locking;
      }
      if (key === "unlocking") {
        return dict.states.unlocking;
      }
    }

    const st = dict.states;

    if (domain === "person") {
      const personDict = strings(code).person || strings("en").person || {};
      if (key === "casa" || key === "en_casa" || key === "home") {
        return personDict.home || st.home;
      }
      if (key === "fuera" || key === "not_home" || key === "away") {
        return personDict.notHome || st.not_home;
      }
    }
    switch (key) {
      case "on":
        return st.on;
      case "off":
        return st.off;
      case "open":
        return st.open;
      case "opening":
        return st.opening;
      case "closed":
        return st.closed;
      case "closing":
        return st.closing;
      case "playing":
        return st.playing;
      case "paused":
        return st.paused;
      case "buffering":
        return st.buffering;
      case "idle":
        return st.idle;
      case "standby":
        return st.standby;
      case "home":
        return st.home;
      case "not_home":
        return st.not_home;
      case "detected":
        return st.detected;
      case "clear":
        return st.clear;
      case "unavailable":
        return st.unavailable;
      case "unknown":
        return st.unknown;
      case "locked":
        return st.locked;
      case "unlocked":
        return st.unlocked;
      case "locking_failed":
        return st.locking_failed;
      case "unlocking_failed":
        return st.unlocking_failed;
      case "jammed":
        return st.jammed;
      case "pending":
        return st.pending;
      case "stopped":
        return st.stopped;
      case "armed_away":
        return st.armed_away;
      case "armed_home":
        return st.armed_home;
      case "disarmed":
        return st.disarmed;
      case "triggered":
        return st.triggered;
      case "comfortable":
        return st.comfortable;
      case "very_comfortable":
        return st.very_comfortable;
      case "slightly_uncomfortable":
        return st.slightly_uncomfortable;
      case "somewhat_uncomfortable":
        return st.somewhat_uncomfortable;
      case "quite_uncomfortable":
        return st.quite_uncomfortable;
      case "extremely_uncomfortable":
        return st.extremely_uncomfortable;
      case "ok_but_humid":
        return st.ok_but_humid;
      case "little_or_no_discomfort":
        return st.little_or_no_discomfort;
      case "some_discomfort":
        return st.some_discomfort;
      case "great_discomfort_avoid_exertion":
        return st.great_discomfort_avoid_exertion;
      case "dangerous_discomfort":
        return st.dangerous_discomfort;
      case "heat_stroke_imminent":
        return st.heat_stroke_imminent;
      case "dry":
        return st.dry;
      case "very_dry":
        return st.very_dry;
      case "too_dry":
        return st.too_dry;
      case "humid":
        return st.humid;
      case "very_humid":
        return st.very_humid;
      case "too_humid":
        return st.too_humid;
      case "wet":
        return st.wet;
      case "low":
        return st.low;
      case "medium":
        return st.medium;
      case "moderate":
        return st.moderate;
      case "high":
        return st.high;
      case "very_high":
        return st.very_high;
      case "severely_high":
        return st.severely_high;
      case "critical":
        return st.critical;
      case "excellent":
        return st.excellent;
      case "good":
        return st.good;
      case "fair":
        return st.fair;
      case "poor":
        return st.poor;
      default:
        return rawState || null;
    }
  }

  return {
    PACK,
    resolveHass,
    resolveLanguage,
    effectiveHaLanguageCode,
    localeTag,
    normalizeTextKey,
    normalizeHumidifierModeKey,
    strings,
    translateEntityState,
    translateWeatherCondition,
    translateWeatherForecastUi,
    translateGraphEmptyHistory,
    translateNotificationsUi,
    translateCalendarUi,
    translateNewsUi,
    translateLightUi,
    translateHumidifierMode,
    translateEntityStateChip,
    translateMediaPlayerState,
    translateClimateHvacLabel,
    translateClimateAria,
    translateCommonAria,
    translateFanAria,
    translateHumidifierAria,
    translateMediaBrowserUi,
    translateMediaPlayerAria,
    translateClimateDialAria,
    translateClimateDialNoSetpointHint,
    translateClimateSchedule,
    translateHumidifierDeviceState,
    translateMeteoalarmTerm,
    translateAdvanceVacuumReportedState,
    translateAdvanceVacuumVacuumMode,
    translateVacuumErrorState,
    isVacuumErrorState,
    translateFavState(langCode:string, key:string) {
      const raw = normalizeTextKey(key);
      const fd = strings(langCode).favCard || strings("en").favCard || {};
      const ed = {
        ...(strings("en").entityCard?.states || {}),
        ...(strings(langCode).entityCard?.states || {}),
      };
      switch (raw) {
        case "on":
          return ed.on;
        case "off":
          return ed.off;
        case "open":
          return ed.open;
        case "closed":
          return ed.closed;
        case "playing":
          return ed.playing;
        case "paused":
          return ed.paused;
        case "buffering":
          return ed.buffering;
        case "idle":
          return ed.idle;
        case "standby":
          return ed.standby;
        case "home":
          return ed.home;
        case "not_home":
          return ed.not_home;
        case "disarmed":
          return fd.disarmedF;
        case "armed_home":
          return fd.armed_home;
        case "armed_away":
          return fd.armed_away;
        case "armed_night":
          return fd.armed_night;
        case "armed_vacation":
          return fd.armed_vacation;
        case "armed_custom_bypass":
          return fd.armed_custom_bypass;
        case "arming":
          return fd.arming;
        case "disarming":
          return fd.disarming;
        case "pending":
          return fd.pending;
        case "triggered":
          return fd.triggered;
        case "detected":
          return ed.detected;
        case "clear":
          return ed.clear;
        case "locked":
          return ed.locked;
        case "unlocked":
          return ed.unlocked;
        case "unavailable":
          return ed.unavailable;
        case "unknown":
          return ed.unknown;
        default:
          return null;
      }
    },
  };

}

if(typeof window!=="undefined") {
  window.NodaliaI18n=createRuntimeI18n();
  try {if(typeof CustomEvent==="function") window.dispatchEvent(new CustomEvent("nodalia-i18n-ready",{bubbles:false}));}catch(_error){/* Readiness feedback must not block registration. */}
}
