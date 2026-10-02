import {ROW_LANGS,ROWS_JSON,EDITOR_CATALOG_JSON} from "./editor-i18n-data";
(() => {
  const api=window.NodaliaI18n;
  if(!api?.resolveLanguage) return;
  const i18n:NonNullable<Window["NodaliaI18n"]>=api;
  type Labels=Record<string,string>;
  type Maps=Record<string,Labels>&{es:Labels;en:Labels};
  const isRecord=(value:unknown):value is Record<string,unknown>=>value!==null && typeof value==="object" && !Array.isArray(value);



  let ROWS_CACHE:Labels[]|null = null;
  let MAP_CACHE:Maps|null = null;
  let EDITOR_CATALOG_CACHE:Record<string,Labels>|null = null;
  let FOLD_TO_CANONICAL_ES_CACHE:Map<string,string>|null = null;

  function invalidData():never {throw new Error("Invalid editor translation data");}
  function stringList(value:unknown):string[] {
    if(!Array.isArray(value)) return invalidData();
    const list:unknown[]=value;
    if(!list.every((item):item is string=>typeof item==="string")) return invalidData();
    return list;
  }
  function labelRow(keys:readonly string[],raw:unknown):Labels {
    if(!Array.isArray(raw)) return invalidData();
    const values:unknown[]=raw;
    return Object.fromEntries(keys.map((key,index)=>{
      const value=values[index];
      if(value!==undefined && typeof value!=="string") return invalidData();
      return [key,value??""];
    }));
  }
  function getRows() {
    if (!ROWS_CACHE) {
      const raw:unknown=JSON.parse(ROWS_JSON);
      if(!Array.isArray(raw)) return invalidData();
      ROWS_CACHE=raw.map((values:unknown)=>labelRow(ROW_LANGS,values));
    }
    return ROWS_CACHE;
  }

  function buildMap(lang:string) {
    const m:Labels = {};
    for (const r of getRows()) {
      if(r.es!==undefined) m[r.es] = r[lang]??"";
    }
    return m;
  }

  const EDITOR_LANGS = ["de", "fr", "it", "nl", "no", "pt", "ru", "el", "zh", "ro"];
  function getEditorUiMaps() {
    if (MAP_CACHE) {
      return MAP_CACHE;
    }
    const map:Maps = { es:buildMap("es"), en:buildMap("en") };
    for (const L of EDITOR_LANGS) {
      map[L] = buildMap(L);
    }
    MAP_CACHE = map;
    i18n.editorUiMaps = map;
    return map;
  }

  function foldEditorUiKey(s:unknown) {
    try {
      return String(s || "")
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .trim()
        .toLowerCase();
    } catch (_e) {
      return String(s || "")
        .toLowerCase()
        .trim();
    }
  }

  function getEditorUiFoldToCanonicalEs() {
    if (FOLD_TO_CANONICAL_ES_CACHE) {
      return FOLD_TO_CANONICAL_ES_CACHE;
    }
    const map = new Map<string,string>();
    for (const r of getRows()) {
      const canon = r.es;
      if (typeof canon !== "string" || !canon) {
        continue;
      }
      const f = foldEditorUiKey(canon);
      if (!map.has(f)) {
        map.set(f, canon);
      }
    }
    FOLD_TO_CANONICAL_ES_CACHE = map;
    return map;
  }

  function getEditorCatalog() {
    if (!EDITOR_CATALOG_CACHE) {
      const compact:unknown = JSON.parse(EDITOR_CATALOG_JSON);
      if(!isRecord(compact) || !Array.isArray(compact.values)) return invalidData();
      const langs=stringList(compact.langs),keys=stringList(compact.keys),rows:unknown[]=compact.values;
      EDITOR_CATALOG_CACHE=Object.fromEntries(langs.map((lang,index)=>[lang,labelRow(keys,rows[index]??[])]));
      i18n.editorCatalog = EDITOR_CATALOG_CACHE;
    }
    return EDITOR_CATALOG_CACHE;
  }

  i18n.editorUiMaps = null;
  i18n.editorCatalog = null;

  function normalizeSpanishEditorLabel(text:unknown) {
    let out = String(text || "");
    if (!out) {
      return out;
    }

    const withMatchCase = (match:string, replacement:string) => {
      if (match === match.toUpperCase()) {
        return replacement.toUpperCase();
      }
      if (match[0] === match[0]?.toUpperCase()) {
        return (replacement[0]??"").toUpperCase() + replacement.slice(1);
      }
      return replacement;
    };

    const substitutions:readonly (readonly [RegExp,string])[] = [
      [/\banimaciones\b/gi, "animaciones"],
      [/\banimacion\b/gi, "animación"],
      [/\bconfiguraciones\b/gi, "configuraciones"],
      [/\bconfiguracion\b/gi, "configuración"],
      [/\bgraficas\b/gi, "gráficas"],
      [/\bgrafica\b/gi, "gráfica"],
      [/\blogica\b/gi, "lógica"],
      [/\bmaximo(s)?\b/gi, "máximo$1"],
      [/\bminimo(s)?\b/gi, "mínimo$1"],
      [/\bmusica\b/gi, "música"],
      [/\bnavegacion\b/gi, "navegación"],
      [/\bnumero(s)?\b/gi, "número$1"],
      [/\bpanel(es)?\b/gi, "panel$1"],
      [/\bpequeno\b/gi, "pequeño"],
      [/\bpulsacion\b/gi, "pulsación"],
      [/\bsecciones\b/gi, "secciones"],
      [/\bseccion\b/gi, "sección"],
      [/\btamano(s)?\b/gi, "tamaño$1"],
      [/\btecnica\b/gi, "técnica"],
      [/\btecnicas\b/gi, "técnicas"],
      [/\bversiones\b/gi, "versiones"],
      [/\bversion\b/gi, "versión"],
      [/\banadir\b/gi, "añadir"],
      [/\banade\b/gi, "añade"],
      [/\bano(s)?\b/gi, "año$1"],
      [/\btitulos\b/gi, "títulos"],
      [/\btitulo\b/gi, "título"],
      [/\benergias\b/gi, "energías"],
      [/\benergia\b/gi, "energía"],
      [/\bcodigos\b/gi, "códigos"],
      [/\bcodigo\b/gi, "código"],
      [/\btactil\b/gi, "táctil"],
      [/\bhaptica\b/gi, "háptica"],
      [/\binformacion\b/gi, "información"],
      [/\btransicion\b/gi, "transición"],
      [/\bubicacion\b/gi, "ubicación"],
      [/\bfuncion\b/gi, "función"],
      [/\bopcion\b/gi, "opción"],
      [/\bseleccion\b/gi, "selección"],
      [/\breaccion\b/gi, "reacción"],
      [/\baccion\b/gi, "acción"],
      [/\bmetodos\b/gi, "métodos"],
      [/\bmetodo\b/gi, "método"],
      [/\bautomaticos\b/gi, "automáticos"],
      [/\bautomatico\b/gi, "automático"],
      [/\bautomaticas\b/gi, "automáticas"],
      [/\bautomatica\b/gi, "automática"],
      [/\bduracion\b/gi, "duración"],
      [/\bposicion\b/gi, "posición"],
      [/\bbasicos\b/gi, "básicos"],
      [/\bbasico\b/gi, "básico"],
      [/\bbasicas\b/gi, "básicas"],
      [/\bbasica\b/gi, "básica"],
      [/\bgenericos\b/gi, "genéricos"],
      [/\bgenerico\b/gi, "genérico"],
      [/\bgenericas\b/gi, "genéricas"],
      [/\bgenerica\b/gi, "genérica"],
    ];

    substitutions.forEach(([pattern, replacement]) => {
      out = out.replace(pattern, (match:string, ...rest:unknown[]) => {
        const groups = rest.slice(0, -2);
        const expanded = String(replacement).replace(/\$(\d+)/g, (_:string, groupIndexRaw:string) => {
          const groupIndex = Number(groupIndexRaw) - 1;
          const group=groups[groupIndex];
          return typeof group==="string"?group:"";
        });
        return withMatchCase(match, expanded);
      });
    });

    // Clean up legacy literal replacement artifacts left by earlier generator versions.
    out = out.replace(/\$(\d+)/g, "");

    return out;
  }

  i18n.editorStr = function editorStr(hass:unknown, configLang:string, spanishText:unknown) {
    if (spanishText == null || spanishText === "") {
      return "";
    }
    const rawInput = String(spanishText);
    const lang = i18n.resolveLanguage?.(hass, configLang)??"en";
    if (rawInput.startsWith("ed.")) {
      const cat = getEditorCatalog();
      if (cat && typeof cat === "object") {
        const order = [lang, "en", "es"];
        const seen = new Set<string>();
        for (const L of order) {
          if (!L || seen.has(L)) {
            continue;
          }
          seen.add(L);
          const pack = cat[L];
          const v = pack && pack[rawInput];
          if (typeof v === "string" && v !== "") {
            return v;
          }
        }
      }
      return rawInput;
    }
    const maps = getEditorUiMaps();
    const resolveEditorUiKey = () => {
      const candidates = [rawInput, normalizeSpanishEditorLabel(rawInput)];
      for (const c of candidates) {
        if (maps.es[c] !== undefined || maps.en[c] !== undefined) {
          return c;
        }
      }
      for (const c of candidates) {
        const canon = getEditorUiFoldToCanonicalEs().get(foldEditorUiKey(c));
        if (canon && (maps.es[canon] !== undefined || maps.en[canon] !== undefined)) {
          return canon;
        }
      }
      return rawInput;
    };
    const key = resolveEditorUiKey();
    if (maps.es[key] === undefined && maps.en[key] === undefined) {
      return lang === "es" ? normalizeSpanishEditorLabel(rawInput) : rawInput;
    }
    const primary = maps[lang]?.[key];
    if (primary !== undefined && primary !== "") {
      return lang === "es" ? normalizeSpanishEditorLabel(primary) : primary;
    }
    if (lang !== "es") {
      const enVal = maps.en?.[key];
      if (enVal !== undefined && enVal !== "") {
        return enVal;
      }
    }
    const esVal = maps.es?.[key];
    if (esVal !== undefined && esVal !== "") {
      return normalizeSpanishEditorLabel(esVal);
    }
    return lang === "es" ? normalizeSpanishEditorLabel(rawInput) : rawInput;
  };
})();
