(() => {
  function baseLang(code) {
    if (!code || typeof code !== "string") {
      return null;
    }
    const trimmed = code.trim();
    const lower = trimmed.toLowerCase();
    if (lower === "auto") {
      return null;
    }
    const two = lower.slice(0, 2);
    return PACK[two] ? two : null;
  }

  /**
   * Lovelace often calls setConfig before hass is set on the editor element.
   * Use the app root hass so resolveLanguage still sees HA profile / locale.
   */
  function resolveHass(hass) {
    if (hass != null && typeof hass === "object") {
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
      const root = document.querySelector("home-assistant");
      if (root?.hass) {
        return root.hass;
      }
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
  function effectiveHaLanguageCode(hass) {
    const fromObject = h => {
      if (!h || typeof h !== "object") {
        return null;
      }
      const raw =
        (typeof h.language === "string" && h.language.trim() && h.language) ||
        (typeof h.selectedLanguage === "string" && h.selectedLanguage.trim() && h.selectedLanguage) ||
        (h.locale && typeof h.locale === "object" && typeof h.locale.language === "string" && h.locale.language.trim() && h.locale.language);
      return raw ? baseLang(raw) : null;
    };
    const rootHass =
      typeof document !== "undefined" ? document.querySelector("home-assistant")?.hass : null;
    /**
     * Prefer the app-root hass first: Lovelace sometimes passes a hass-shaped object that has
     * entity state but omits `language`; the canonical UI language lives on `home-assistant.hass`.
     */
    return fromObject(rootHass) || fromObject(resolveHass(hass));
  }

  function resolveLanguage(hass, configLang) {
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
    return "es";
  }

  function localeTag(langCode) {
    const map = {
      es: "es",
      en: "en",
      de: "de",
      fr: "fr",
      it: "it",
      nl: "nl",
    };
    return map[langCode] || "es";
  }

  function normalizeTextKey(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/-/g, "_");
  }

  function getEntityDomain(state) {
    const entityId = String(state?.entity_id || "").trim();
    const dot = entityId.indexOf(".");
    return dot > 0 ? entityId.slice(0, dot) : "";
  }

  const PACK = {
    es: {
      advanceVacuum: {
        modeLabels: {
          all: "Todo",
          rooms: "Habitaciones",
          zone: "Zona",
          routines: "Rutinas",
          goto: "Ir a punto",
        },
        panelModes: {
          smart: "Inteligente",
          vacuum_mop: "Aspirado y fregado",
          vacuum: "Aspirado",
          mop: "Fregado",
          custom: "Personalizado",
        },
        dockSections: {
          control: "Control de base",
          settings: "Ajuste de base de carga",
        },
        dockSettings: {
          mop_wash_frequency: "Frecuencia de lavado de la mopa",
          mop_mode: "Modo de fregado",
          auto_empty_frequency: "Frecuencia de vaciado automático",
          empty_mode: "Modo de vaciado",
          drying_duration: "Duración de secado",
        },
        dockControls: {
          empty: { label: "Vaciar depósito", active: "Parar vaciado" },
          wash: { label: "Lavar el paño", active: "Parar lavado de paño" },
          dry: { label: "Secar la mopa", active: "Detener el secado" },
        },
        vacuumModes: {
          quiet: "Silencioso",
          silent: "Silencioso",
          balanced: "Equilibrado",
          standard: "Estándar",
          normal: "Normal",
          turbo: "Turbo",
          max: "Max",
          maxplus: "Max+",
          max_plus: "Max+",
          gentle: "Suave",
          strong: "Fuerte",
          smart: "Inteligente",
          smartmode: "Inteligente",
          smart_mode: "Inteligente",
          intelligent: "Inteligente",
          custom: "Personalizado",
          custommode: "Personalizado",
          custom_mode: "Personalizado",
          custom_water_flow: "Caudal de agua personalizado",
          custom_watter_flow: "Caudal de agua personalizado",
          off: "Sin fregado",
          low: "Baja",
          medium: "Media",
          high: "Alta",
          intense: "Intenso",
          deep: "Profundo",
          deep_plus: "Profundo+",
          deepplus: "Profundo+",
          fast: "Rápido",
          rapido: "Rápido",
        },
        offSuction: "Off",
        reportedStates: {
          docked: "En base",
          charging: "Cargando",
          charging_completed: "Cargando",
          cleaning: "Limpiando",
          spot_cleaning: "Limpiando",
          segment_cleaning: "Limpiando",
          room_cleaning: "Limpiando",
          zone_cleaning: "Limpiando",
          clean_area: "Limpiando",
          paused: "Pausado",
          returning: "Volviendo a la base",
          return_to_base: "Volviendo a la base",
          returning_home: "Volviendo a la base",
          washing: "Lavando mopas",
          wash_mop: "Lavando mopas",
          washing_mop: "Lavando mopas",
          washing_pads: "Lavando mopas",
          drying: "Secando",
          drying_mop: "Secando",
          emptying: "Autovaciando",
          self_emptying: "Autovaciando",
          unavailable: "No disponible",
          unknown: "Desconocido",
          error: "Error",
          fallback: "Desconocido",
        },
        mapStatus: {
          washing_mop: "Lavando la mopa",
          drying_mop: "Secando la mopa",
          emptying_dust: "Vaciando el polvo",
          charging: "Cargando",
        },
        descriptorLabels: {
          suction: "Aspirado",
          mop: "Fregado",
          mop_mode: "Modo de mopa",
        },
        utility: {
          cleaningMode: "Modo de limpieza",
          cleaningCounter: "Contador de limpiezas",
          dockActions: "Acciones de base",
          chargingStation: "Base de carga",
          zonesWord: "zonas",
          pointWord: "punto",
          zoneTool: "Zona",
          routineDefault: "Rutina",
          customMenuDefault: "Base",
          modesFallbackTitle: "Modos de aspirado y fregado",
        },
        actions: {
          returnToBase: "Volver a base",
          locate: "Localizar",
          stop: "Parar",
          run: "Ejecutar",
          addZoneToClean: "Añadir zona a la limpieza",
          cleanZone: "Limpiar zona",
        },
        handles: {
          moveZone: "Mover zona",
          deleteZone: "Eliminar zona",
          resizeZone: "Redimensionar zona",
        },
        titles: {
          editZone: "Editar zona",
          backPanel: "Volver al panel principal",
          addZone: "Añadir zona",
          gotoFallback: "Punto",
        },
      },
      navigationMusicAssist: {
        artist: "Artistas",
        artists: "Artistas",
        album: "Álbumes",
        albums: "Álbumes",
        track: "Canciones",
        tracks: "Canciones",
        song: "Canciones",
        songs: "Canciones",
        playlist: "Listas de reproducción",
        playlists: "Listas de reproducción",
        "radio station": "Emisoras",
        "radio stations": "Emisoras",
        podcast: "Podcasts",
        podcasts: "Podcasts",
        audiobook: "Audiolibros",
        audiobooks: "Audiolibros",
        genre: "Géneros",
        genres: "Géneros",
        favorite: "Favoritos",
        favorites: "Favoritos",
        favourites: "Favoritos",
        search: "Buscar",
        "recently played": "Reproducido recientemente",
        "recently added": "Añadido recientemente",
        "recently played tracks": "Canciones reproducidas recientemente",
        browseFallback: "Elemento",
      },
      vacuumSimple: {
        quiet: "Silencioso",
        silent: "Silencioso",
        balanced: "Equilibrado",
        standard: "Estándar",
        normal: "Normal",
        turbo: "Turbo",
        max: "Max",
        maxplus: "Max+",
        max_plus: "Max+",
        gentle: "Suave",
        strong: "Fuerte",
        smart: "Inteligente",
        smartmode: "Inteligente",
        smart_mode: "Inteligente",
        intelligent: "Inteligente",
        custom: "Personalizado",
        custommode: "Personalizado",
        custom_mode: "Personalizado",
        custom_water_flow: "Caudal de agua personalizado",
        custom_watter_flow: "Caudal de agua personalizado",
        off: "Sin fregado",
        low: "Baja",
        medium: "Media",
        high: "Alta",
        intense: "Intenso",
        deep: "Profundo",
      },
      fan: {
        off: "Apagado",
        on: "Encendido",
        unavailable: "No disponible",
        unknown: "Desconocido",
        noState: "Sin estado",
        fallbackName: "Ventilador",
      },
      alarmPanel: {
        defaultTitle: "Alarma",
        noState: "Sin estado",
        actions: {
          disarm: "Desarmar",
          arm_home: "Casa",
          arm_away: "Ausente",
          arm_night: "Noche",
          arm_vacation: "Vacaciones",
          arm_custom_bypass: "Personalizada",
        },
        states: {
          disarmed: "Desarmada",
          armed_home: "En casa",
          armed_away: "Ausente",
          armed_night: "Noche",
          armed_vacation: "Vacaciones",
          armed_custom_bypass: "Personalizada",
          armed: "Armada",
          arming: "Armando",
          disarming: "Desarmando",
          pending: "Pendiente",
          triggered: "Disparada",
          unavailable: "No disponible",
          unknown: "Desconocida",
        },
      },
      person: {
        home: "En casa",
        notHome: "Fuera",
        work: "Trabajo",
        school: "Colegio",
        unavailable: "No disponible",
        unknown: "Desconocido",
        locationUnknown: "Ubicacion desconocida",
      },
      entityCard: {
        binarySensor: {
          doorOpen: "Abierta",
          doorClosed: "Cerrada",
          motionOn: "Detectado",
          motionOff: "No detectado",
        },
        boolean: {
          yes: "Sí",
          no: "No",
        },
        states: {
          on: "Encendido",
          off: "Apagado",
          open: "Abierto",
          opening: "Abriendo",
          closed: "Cerrado",
          closing: "Cerrando",
          playing: "Reproduciendo",
          paused: "En pausa",
          idle: "En espera",
          standby: "Standby",
          home: "En casa",
          not_home: "Fuera",
          detected: "Detectado",
          clear: "Libre",
          unavailable: "No disponible",
          unknown: "Desconocido",
          locked: "Bloqueado",
          unlocked: "Desbloqueado",
          locking: "Bloqueando",
          unlocking: "Desbloqueando",
          locking_failed: "Bloqueo fallido",
          unlocking_failed: "Desbloqueo fallido",
          jammed: "Atascado",
          pending: "Pendiente",
          stopped: "Detenido",
          armed_away: "Armado fuera",
          armed_home: "Armado en casa",
          disarmed: "Desarmado",
          triggered: "Disparado",
          comfortable: "Cómodo",
          very_comfortable: "Muy cómodo",
          slightly_uncomfortable: "Ligeramente incómodo",
          somewhat_uncomfortable: "Algo incómodo",
          quite_uncomfortable: "Bastante incómodo",
          extremely_uncomfortable: "Muy incómodo",
          ok_but_humid: "Bien, pero húmedo",
          little_or_no_discomfort: "Poco o ningún malestar",
          some_discomfort: "Algo de malestar",
          great_discomfort_avoid_exertion: "Gran malestar",
          dangerous_discomfort: "Malestar peligroso",
          heat_stroke_imminent: "Golpe de calor inminente",
          dry: "Seco",
          very_dry: "Muy seco",
          too_dry: "Demasiado seco",
          humid: "Húmedo",
          very_humid: "Muy húmedo",
          too_humid: "Demasiado húmedo",
          wet: "Mojado",
          low: "Bajo",
          medium: "Medio",
          moderate: "Moderado",
          high: "Alto",
          very_high: "Muy alto",
          severely_high: "Extremadamente alto",
          critical: "Crítico",
          excellent: "Excelente",
          good: "Bueno",
          fair: "Aceptable",
          poor: "Malo",
        },
      },
      weatherCard: {
        conditions: {
          clear_night: "Despejado",
          cloudy: "Nublado",
          exceptional: "Excepcional",
          fog: "Niebla",
          hail: "Granizo",
          lightning: "Tormenta",
          lightning_rainy: "Tormenta con lluvia",
          partlycloudy: "Parcialmente nublado",
          pouring: "Lluvia intensa",
          rainy: "Lluvia",
          snowy: "Nieve",
          snowy_rainy: "Aguanieve",
          sunny: "Soleado",
          windy: "Ventoso",
          windy_variant: "Viento variable",
        },
        defaultCondition: "Tiempo",
        forecast: {
          chartAriaHourly: "Gráfico de previsión por horas",
          chartAriaDaily: "Gráfico de previsión semanal",
          tabsAria: "Vista de la previsión",
          tabCards: "Tarjetas",
          tabChart: "Gráfico",
          hoursTab: "Horas",
          weekTab: "Semana",
          emptyHourly: "Sin previsión por horas disponible.",
          emptyDaily: "Sin previsión semanal disponible.",
          chartInsufficientData: "No hay suficientes datos para mostrar el gráfico.",
          closeDetail: "Cerrar detalle",
          maxLabel: "Máxima",
          minLabel: "Mínima",
          temperatureLabel: "Temperatura",
          rainLabel: "Lluvia",
          humidityLabel: "Humedad",
          windLabel: "Viento",
        },
        meteoalarm: {
          name: "Meteoalarm",
          alertFallback: "Alerta",
          noAlerts: "Sin alertas",
          weatherAlert: "Alerta meteorologica",
          noWeatherAlerts: "Sin alertas meteorologicas",
          level: "Nivel",
          type: "Tipo",
          start: "Inicio",
          end: "Fin",
          severity: "Severidad",
          urgency: "Urgencia",
          certainty: "Certeza",
          close: "Cerrar",
          descriptionTitle: "Descripción",
          instructionsTitle: "Instrucciones",
          terms: {
            moderate: "Moderado",
            severe: "Severo",
            high: "Alto",
            extreme: "Extremo",
            minor: "Menor",
            yellow: "Amarillo",
            orange: "Naranja",
            red: "Rojo",
            green: "Verde",
            future: "Futuro",
            immediate: "Inmediato",
            expected: "Esperado",
            past: "Pasado",
            likely: "Probable",
            observed: "Observado",
            possible: "Posible",
            unlikely: "Improbable",
            unknown: "Desconocido",
            met: "Meteorológico",
            monitor: "Monitorizar",
          },
        },
      },
      humidifierCard: {
        modes: {
          auto: "Auto",
          automatic: "Auto",
          smart: "Inteligente",
          smart_mode: "Inteligente",
          sleep: "Noche",
          night: "Noche",
          eco: "Eco",
          quiet: "Silencioso",
          silent: "Silencioso",
          low: "Baja",
          medium: "Media",
          mid: "Media",
          high: "Alta",
          boost: "Boost",
          turbo: "Turbo",
          normal: "Normal",
          balanced: "Normal",
          dry: "Secado",
          drying: "Secado",
          continuous: "Continuo",
          clothes_dry: "Ropa",
          laundry: "Ropa",
        },
      },
      graphCard: {
        emptyHistory: "Sin historial disponible",
      },
      favCard: {
        disarmedF: "Desarmada",
        armed_home: "En casa",
        armed_away: "Ausente",
        armed_night: "Noche",
        armed_vacation: "Vacaciones",
        armed_custom_bypass: "Personalizada",
        arming: "Armando",
        disarming: "Desarmando",
        pending: "Pendiente",
        triggered: "Disparada",
      },
    },
    en: {
      advanceVacuum: {
        modeLabels: {
          all: "All",
          rooms: "Rooms",
          zone: "Zone",
          routines: "Routines",
          goto: "Go to point",
        },
        panelModes: {
          smart: "Smart",
          vacuum_mop: "Vacuum & mop",
          vacuum: "Vacuum",
          mop: "Mop",
          custom: "Custom",
        },
        dockSections: {
          control: "Dock controls",
          settings: "Dock settings",
        },
        dockSettings: {
          mop_wash_frequency: "Mop wash frequency",
          mop_mode: "Mopping mode",
          auto_empty_frequency: "Auto-empty frequency",
          empty_mode: "Emptying mode",
          drying_duration: "Drying duration",
        },
        dockControls: {
          empty: { label: "Empty bin", active: "Stop emptying" },
          wash: { label: "Wash pad", active: "Stop pad wash" },
          dry: { label: "Dry mop", active: "Stop drying" },
        },
        vacuumModes: {
          quiet: "Quiet",
          silent: "Silent",
          balanced: "Balanced",
          standard: "Standard",
          normal: "Normal",
          turbo: "Turbo",
          max: "Max",
          maxplus: "Max+",
          max_plus: "Max+",
          gentle: "Gentle",
          strong: "Strong",
          smart: "Smart",
          smartmode: "Smart",
          smart_mode: "Smart",
          intelligent: "Smart",
          custom: "Custom",
          custommode: "Custom",
          custom_mode: "Custom",
          custom_water_flow: "Custom water flow",
          custom_watter_flow: "Custom water flow",
          off: "Mop off",
          low: "Low",
          medium: "Medium",
          high: "High",
          intense: "Intense",
          deep: "Deep",
          deep_plus: "Deep+",
          deepplus: "Deep+",
          fast: "Fast",
          rapido: "Fast",
        },
        offSuction: "Off",
        reportedStates: {
          docked: "Docked",
          charging: "Charging",
          charging_completed: "Charging",
          cleaning: "Cleaning",
          spot_cleaning: "Cleaning",
          segment_cleaning: "Cleaning",
          room_cleaning: "Cleaning",
          zone_cleaning: "Cleaning",
          clean_area: "Cleaning",
          paused: "Paused",
          returning: "Returning to dock",
          return_to_base: "Returning to dock",
          returning_home: "Returning to dock",
          washing: "Washing mop",
          wash_mop: "Washing mop",
          washing_mop: "Washing mop",
          washing_pads: "Washing mop",
          drying: "Drying",
          drying_mop: "Drying",
          emptying: "Auto-emptying",
          self_emptying: "Auto-emptying",
          unavailable: "Unavailable",
          unknown: "Unknown",
          error: "Error",
          fallback: "Unknown",
        },
        mapStatus: {
          washing_mop: "Washing mop",
          drying_mop: "Drying mop",
          emptying_dust: "Emptying dust bin",
          charging: "Charging",
        },
        descriptorLabels: {
          suction: "Vacuum",
          mop: "Mop",
          mop_mode: "Mop mode",
        },
        utility: {
          cleaningMode: "Cleaning mode",
          cleaningCounter: "Cleaning passes",
          dockActions: "Dock actions",
          chargingStation: "Charging dock",
          zonesWord: "zones",
          pointWord: "point",
          zoneTool: "Zone",
          routineDefault: "Routine",
          customMenuDefault: "Dock",
          modesFallbackTitle: "Vacuum & mop modes",
        },
        actions: {
          returnToBase: "Return to dock",
          locate: "Locate",
          stop: "Stop",
          run: "Run",
          addZoneToClean: "Add zone to clean",
          cleanZone: "Clean zone",
        },
        handles: {
          moveZone: "Move zone",
          deleteZone: "Delete zone",
          resizeZone: "Resize zone",
        },
        titles: {
          editZone: "Edit zone",
          backPanel: "Back to main panel",
          addZone: "Add zone",
          gotoFallback: "Point",
        },
      },
      navigationMusicAssist: {
        artist: "Artists",
        artists: "Artists",
        album: "Albums",
        albums: "Albums",
        track: "Tracks",
        tracks: "Tracks",
        song: "Tracks",
        songs: "Tracks",
        playlist: "Playlists",
        playlists: "Playlists",
        "radio station": "Radio stations",
        "radio stations": "Radio stations",
        podcast: "Podcasts",
        podcasts: "Podcasts",
        audiobook: "Audiobooks",
        audiobooks: "Audiobooks",
        genre: "Genres",
        genres: "Genres",
        favorite: "Favorites",
        favorites: "Favorites",
        favourites: "Favorites",
        search: "Search",
        "recently played": "Recently played",
        "recently added": "Recently added",
        "recently played tracks": "Recently played tracks",
        browseFallback: "Item",
      },
      vacuumSimple: {
        quiet: "Quiet",
        silent: "Silent",
        balanced: "Balanced",
        standard: "Standard",
        normal: "Normal",
        turbo: "Turbo",
        max: "Max",
        maxplus: "Max+",
        max_plus: "Max+",
        gentle: "Gentle",
        strong: "Strong",
        smart: "Smart",
        smartmode: "Smart",
        smart_mode: "Smart",
        intelligent: "Smart",
        custom: "Custom",
        custommode: "Custom",
        custom_mode: "Custom",
        custom_water_flow: "Custom water flow",
        custom_watter_flow: "Custom water flow",
        off: "Mop off",
        low: "Low",
        medium: "Medium",
        high: "High",
        intense: "Intense",
        deep: "Deep",
      },
      fan: {
        off: "Off",
        on: "On",
        unavailable: "Unavailable",
        unknown: "Unknown",
        noState: "No state",
        fallbackName: "Fan",
      },
      alarmPanel: {
        defaultTitle: "Alarm",
        noState: "No state",
        actions: {
          disarm: "Disarm",
          arm_home: "Home",
          arm_away: "Away",
          arm_night: "Night",
          arm_vacation: "Vacation",
          arm_custom_bypass: "Custom",
        },
        states: {
          disarmed: "Disarmed",
          armed_home: "Home",
          armed_away: "Away",
          armed_night: "Night",
          armed_vacation: "Vacation",
          armed_custom_bypass: "Custom",
          armed: "Armed",
          arming: "Arming",
          disarming: "Disarming",
          pending: "Pending",
          triggered: "Triggered",
          unavailable: "Unavailable",
          unknown: "Unknown",
        },
      },
      person: {
        home: "Home",
        notHome: "Away",
        work: "Work",
        school: "School",
        unavailable: "Unavailable",
        unknown: "Unknown",
        locationUnknown: "Unknown location",
      },
      entityCard: {
        binarySensor: {
          doorOpen: "Open",
          doorClosed: "Closed",
          motionOn: "Detected",
          motionOff: "Clear",
        },
        boolean: {
          yes: "Yes",
          no: "No",
        },
        states: {
          on: "On",
          off: "Off",
          open: "Open",
          opening: "Opening",
          closed: "Closed",
          closing: "Closing",
          playing: "Playing",
          paused: "Paused",
          idle: "Idle",
          standby: "Standby",
          home: "Home",
          not_home: "Away",
          detected: "Detected",
          clear: "Clear",
          unavailable: "Unavailable",
          unknown: "Unknown",
          locked: "Locked",
          unlocked: "Unlocked",
          locking: "Locking",
          unlocking: "Unlocking",
          locking_failed: "Lock failed",
          unlocking_failed: "Unlock failed",
          jammed: "Jammed",
          pending: "Pending",
          stopped: "Stopped",
          armed_away: "Armed away",
          armed_home: "Armed home",
          disarmed: "Disarmed",
          triggered: "Triggered",
          comfortable: "Comfortable",
          very_comfortable: "Very comfortable",
          slightly_uncomfortable: "Slightly uncomfortable",
          somewhat_uncomfortable: "Somewhat uncomfortable",
          quite_uncomfortable: "Quite uncomfortable",
          extremely_uncomfortable: "Extremely uncomfortable",
          ok_but_humid: "OK but humid",
          little_or_no_discomfort: "Little or no discomfort",
          some_discomfort: "Some discomfort",
          great_discomfort_avoid_exertion: "Great discomfort",
          dangerous_discomfort: "Dangerous discomfort",
          heat_stroke_imminent: "Heat stroke imminent",
          dry: "Dry",
          very_dry: "Very dry",
          too_dry: "Too dry",
          humid: "Humid",
          very_humid: "Very humid",
          too_humid: "Too humid",
          wet: "Wet",
          low: "Low",
          medium: "Medium",
          moderate: "Moderate",
          high: "High",
          very_high: "Very high",
          severely_high: "Severely high",
          critical: "Critical",
          excellent: "Excellent",
          good: "Good",
          fair: "Fair",
          poor: "Poor",
        },
      },
      weatherCard: {
        conditions: {
          clear_night: "Clear night",
          cloudy: "Cloudy",
          exceptional: "Exceptional",
          fog: "Fog",
          hail: "Hail",
          lightning: "Lightning",
          lightning_rainy: "Lightning & rain",
          partlycloudy: "Partly cloudy",
          pouring: "Heavy rain",
          rainy: "Rainy",
          snowy: "Snowy",
          snowy_rainy: "Sleet",
          sunny: "Sunny",
          windy: "Windy",
          windy_variant: "Variable wind",
        },
        defaultCondition: "Weather",
        forecast: {
          chartAriaHourly: "Hourly forecast chart",
          chartAriaDaily: "Weekly forecast chart",
          tabsAria: "Forecast view",
          tabCards: "Cards",
          tabChart: "Chart",
          hoursTab: "Hours",
          weekTab: "Week",
          emptyHourly: "No hourly forecast available.",
          emptyDaily: "No weekly forecast available.",
          chartInsufficientData: "Not enough data to display the chart.",
          closeDetail: "Close detail",
          maxLabel: "High",
          minLabel: "Low",
          temperatureLabel: "Temperature",
          rainLabel: "Rain",
          humidityLabel: "Humidity",
          windLabel: "Wind",
        },
        meteoalarm: {
          name: "Meteoalarm",
          alertFallback: "Alert",
          noAlerts: "No alerts",
          weatherAlert: "Weather alert",
          noWeatherAlerts: "No weather alerts",
          level: "Level",
          type: "Type",
          start: "Start",
          end: "End",
          severity: "Severity",
          urgency: "Urgency",
          certainty: "Certainty",
          close: "Close",
          descriptionTitle: "Description",
          instructionsTitle: "Instructions",
          terms: {
            moderate: "Moderate",
            severe: "Severe",
            high: "High",
            extreme: "Extreme",
            minor: "Minor",
            yellow: "Yellow",
            orange: "Orange",
            red: "Red",
            green: "Green",
            future: "Future",
            immediate: "Immediate",
            expected: "Expected",
            past: "Past",
            likely: "Likely",
            observed: "Observed",
            possible: "Possible",
            unlikely: "Unlikely",
            unknown: "Unknown",
            met: "Meteorological",
            monitor: "Monitor",
          },
        },
      },
      humidifierCard: {
        modes: {
          auto: "Auto",
          automatic: "Auto",
          smart: "Smart",
          smart_mode: "Smart",
          sleep: "Night",
          night: "Night",
          eco: "Eco",
          quiet: "Quiet",
          silent: "Quiet",
          low: "Low",
          medium: "Medium",
          mid: "Medium",
          high: "High",
          boost: "Boost",
          turbo: "Turbo",
          normal: "Normal",
          balanced: "Normal",
          dry: "Dry",
          drying: "Drying",
          continuous: "Continuous",
          clothes_dry: "Laundry",
          laundry: "Laundry",
        },
      },
      graphCard: {
        emptyHistory: "No history available",
      },
      favCard: {
        disarmedF: "Disarmed",
        armed_home: "Home",
        armed_away: "Away",
        armed_night: "Night",
        armed_vacation: "Vacation",
        armed_custom_bypass: "Custom",
        arming: "Arming",
        disarming: "Disarming",
        pending: "Pending",
        triggered: "Triggered",
      },
    },
    de: {
      advanceVacuum: {
        modeLabels: {
          all: "Alle",
          rooms: "Räume",
          zone: "Zone",
          routines: "Routinen",
          goto: "Punkt anfahren",
        },
        panelModes: {
          smart: "Smart",
          vacuum_mop: "Saugen & Wischen",
          vacuum: "Saugen",
          mop: "Wischen",
          custom: "Benutzerdefiniert",
        },
        dockSections: {
          control: "Dock-Steuerung",
          settings: "Dock-Einstellungen",
        },
        dockSettings: {
          mop_wash_frequency: "Wischtuch-Washintervall",
          mop_mode: "Wischmodus",
          auto_empty_frequency: "Auto-Entleerungsintervall",
          empty_mode: "Entleerungsmodus",
          drying_duration: "Trocknungsdauer",
        },
        dockControls: {
          empty: { label: "Staubbehälter leeren", active: "Entleeren stoppen" },
          wash: { label: "Wischtuch waschen", active: "Waschen stoppen" },
          dry: { label: "Wischtuch trocknen", active: "Trocknen stoppen" },
        },
        vacuumModes: {
          quiet: "Leise",
          silent: "Still",
          balanced: "Ausgewogen",
          standard: "Standard",
          normal: "Normal",
          turbo: "Turbo",
          max: "Max",
          maxplus: "Max+",
          max_plus: "Max+",
          gentle: "Sanft",
          strong: "Stark",
          smart: "Smart",
          smartmode: "Smart",
          smart_mode: "Smart",
          intelligent: "Smart",
          custom: "Benutzerdefiniert",
          custommode: "Benutzerdefiniert",
          custom_mode: "Benutzerdefiniert",
          custom_water_flow: "Benutzerdefinierte Wassermenge",
          custom_watter_flow: "Benutzerdefinierte Wassermenge",
          off: "Wischen aus",
          low: "Niedrig",
          medium: "Mittel",
          high: "Hoch",
          intense: "Intensiv",
          deep: "Tief",
          deep_plus: "Tief+",
          deepplus: "Tief+",
          fast: "Schnell",
          rapido: "Schnell",
        },
        offSuction: "Aus",
        reportedStates: {
          docked: "Angedockt",
          charging: "Lädt",
          charging_completed: "Lädt",
          cleaning: "Reinigt",
          spot_cleaning: "Reinigt",
          segment_cleaning: "Reinigt",
          room_cleaning: "Reinigt",
          zone_cleaning: "Reinigt",
          clean_area: "Reinigt",
          paused: "Pausiert",
          returning: "Zurück zur Station",
          return_to_base: "Zurück zur Station",
          returning_home: "Zurück zur Station",
          washing: "Wischtücher waschen",
          wash_mop: "Wischtücher waschen",
          washing_mop: "Wischtücher waschen",
          washing_pads: "Wischtücher waschen",
          drying: "Trocknet",
          drying_mop: "Trocknet",
          emptying: "Auto-Entleerung",
          self_emptying: "Auto-Entleerung",
          unavailable: "Nicht verfügbar",
          unknown: "Unbekannt",
          error: "Fehler",
          fallback: "Unbekannt",
        },
        mapStatus: {
          washing_mop: "Wischtuch wird gewaschen",
          drying_mop: "Wischtuch wird getrocknet",
          emptying_dust: "Staubbehälter wird geleert",
          charging: "Lädt",
        },
        descriptorLabels: {
          suction: "Saugen",
          mop: "Wischen",
          mop_mode: "Wischmodus",
        },
        utility: {
          cleaningMode: "Reinigungsmodus",
          cleaningCounter: "Durchläufe",
          dockActions: "Dock-Aktionen",
          chargingStation: "Ladestation",
          zonesWord: "Zonen",
          pointWord: "Punkt",
          zoneTool: "Zone",
          routineDefault: "Routine",
          customMenuDefault: "Dock",
          modesFallbackTitle: "Saug- und Wischmodi",
        },
        actions: {
          returnToBase: "Zur Station",
          locate: "Finden",
          stop: "Stopp",
          run: "Start",
          addZoneToClean: "Zone zur Reinigung hinzufügen",
          cleanZone: "Zone reinigen",
        },
        handles: {
          moveZone: "Zone verschieben",
          deleteZone: "Zone löschen",
          resizeZone: "Zone skalieren",
        },
        titles: {
          editZone: "Zone bearbeiten",
          backPanel: "Zurück zum Hauptpanel",
          addZone: "Zone hinzufügen",
          gotoFallback: "Punkt",
        },
      },
      navigationMusicAssist: {
        artist: "Künstler",
        artists: "Künstler",
        album: "Alben",
        albums: "Alben",
        track: "Titel",
        tracks: "Titel",
        song: "Titel",
        songs: "Titel",
        playlist: "Wiedergabelisten",
        playlists: "Wiedergabelisten",
        "radio station": "Radiosender",
        "radio stations": "Radiosender",
        podcast: "Podcasts",
        podcasts: "Podcasts",
        audiobook: "Hörbücher",
        audiobooks: "Hörbücher",
        genre: "Genres",
        genres: "Genres",
        favorite: "Favoriten",
        favorites: "Favoriten",
        favourites: "Favoriten",
        search: "Suche",
        "recently played": "Zuletzt gespielt",
        "recently added": "Zuletzt hinzugefügt",
        "recently played tracks": "Zuletzt gespielte Titel",
        browseFallback: "Eintrag",
      },
      vacuumSimple: {
        quiet: "Leise",
        silent: "Still",
        balanced: "Ausgewogen",
        standard: "Standard",
        normal: "Normal",
        turbo: "Turbo",
        max: "Max",
        maxplus: "Max+",
        max_plus: "Max+",
        gentle: "Sanft",
        strong: "Stark",
        smart: "Smart",
        smartmode: "Smart",
        smart_mode: "Smart",
        intelligent: "Smart",
        custom: "Benutzerdefiniert",
        custommode: "Benutzerdefiniert",
        custom_mode: "Benutzerdefiniert",
        custom_water_flow: "Benutzerdefinierte Wassermenge",
        custom_watter_flow: "Benutzerdefinierte Wassermenge",
        off: "Wischen aus",
        low: "Niedrig",
        medium: "Mittel",
        high: "Hoch",
        intense: "Intensiv",
        deep: "Tief",
      },
      fan: {
        off: "Aus",
        on: "Ein",
        unavailable: "Nicht verfügbar",
        unknown: "Unbekannt",
        noState: "Kein Status",
        fallbackName: "Ventilator",
      },
      alarmPanel: {
        defaultTitle: "Alarm",
        noState: "Kein Status",
        actions: {
          disarm: "Unscharf",
          arm_home: "Zuhause",
          arm_away: "Abwesend",
          arm_night: "Nacht",
          arm_vacation: "Urlaub",
          arm_custom_bypass: "Individuell",
        },
        states: {
          disarmed: "Entschärft",
          armed_home: "Zuhause",
          armed_away: "Abwesend",
          armed_night: "Nacht",
          armed_vacation: "Urlaub",
          armed_custom_bypass: "Benutzerdefiniert",
          armed: "Scharf",
          arming: "Scharfschalten",
          disarming: "Entschärfen",
          pending: "Ausstehend",
          triggered: "Ausgelöst",
          unavailable: "Nicht verfügbar",
          unknown: "Unbekannt",
        },
      },
      person: {
        home: "Zuhause",
        notHome: "Abwesend",
        work: "Arbeit",
        school: "Schule",
        unavailable: "Nicht verfügbar",
        unknown: "Unbekannt",
        locationUnknown: "Unbekannter Ort",
      },
      entityCard: {
        binarySensor: {
          doorOpen: "Offen",
          doorClosed: "Geschlossen",
          motionOn: "Erkannt",
          motionOff: "Frei",
        },
        boolean: {
          yes: "Ja",
          no: "Nein",
        },
        states: {
          on: "Ein",
          off: "Aus",
          open: "Offen",
          opening: "Öffnet",
          closed: "Geschlossen",
          closing: "Schließt",
          playing: "Wiedergabe",
          paused: "Pause",
          idle: "Leerlauf",
          standby: "Standby",
          home: "Zuhause",
          not_home: "Abwesend",
          detected: "Erkannt",
          clear: "Frei",
          unavailable: "Nicht verfügbar",
          unknown: "Unbekannt",
          locked: "Verriegelt",
          unlocked: "Entriegelt",
          locking: "Verriegelt…",
          unlocking: "Entriegelt…",
          locking_failed: "Verriegeln fehlgeschlagen",
          unlocking_failed: "Entriegeln fehlgeschlagen",
          jammed: "Blockiert",
          pending: "Ausstehend",
          stopped: "Gestoppt",
          armed_away: "Scharf (abwesend)",
          armed_home: "Scharf (zuhause)",
          disarmed: "Entschärft",
          triggered: "Ausgelöst",
          comfortable: "Angenehm",
          very_comfortable: "Sehr angenehm",
          slightly_uncomfortable: "Leicht unangenehm",
          somewhat_uncomfortable: "Etwas unangenehm",
          quite_uncomfortable: "Ziemlich unangenehm",
          extremely_uncomfortable: "Sehr unangenehm",
          ok_but_humid: "OK, aber feucht",
          little_or_no_discomfort: "Kaum Beschwerden",
          some_discomfort: "Einige Beschwerden",
          great_discomfort_avoid_exertion: "Starke Beschwerden",
          dangerous_discomfort: "Gefährliche Beschwerden",
          heat_stroke_imminent: "Hitzschlag droht",
          dry: "Trocken",
          very_dry: "Sehr trocken",
          too_dry: "Zu trocken",
          humid: "Feucht",
          very_humid: "Sehr feucht",
          too_humid: "Zu feucht",
          wet: "Nass",
          low: "Niedrig",
          medium: "Mittel",
          moderate: "Mäßig",
          high: "Hoch",
          very_high: "Sehr hoch",
          severely_high: "Extrem hoch",
          critical: "Kritisch",
          excellent: "Ausgezeichnet",
          good: "Gut",
          fair: "Mäßig",
          poor: "Schlecht",
        },
      },
      weatherCard: {
        conditions: {
          clear_night: "Klare Nacht",
          cloudy: "Bewölkt",
          exceptional: "Außergewöhnlich",
          fog: "Nebel",
          hail: "Hagel",
          lightning: "Gewitter",
          lightning_rainy: "Gewitter mit Regen",
          partlycloudy: "Teilweise bewölkt",
          pouring: "Starker Regen",
          rainy: "Regnerisch",
          snowy: "Schneefall",
          snowy_rainy: "Schneeregen",
          sunny: "Sonnig",
          windy: "Windig",
          windy_variant: "Wechselhafter Wind",
        },
        defaultCondition: "Wetter",
        forecast: {
          chartAriaHourly: "Stündliches Vorhersagediagramm",
          chartAriaDaily: "Wöchentliches Vorhersagediagramm",
          tabsAria: "Vorhersageansicht",
          tabCards: "Karten",
          tabChart: "Diagramm",
          hoursTab: "Stunden",
          weekTab: "Woche",
          emptyHourly: "Keine stündliche Vorhersage verfügbar.",
          emptyDaily: "Keine wöchentliche Vorhersage verfügbar.",
          chartInsufficientData: "Nicht genügend Daten, um das Diagramm anzuzeigen.",
          closeDetail: "Details schließen",
          maxLabel: "Hoch",
          minLabel: "Tief",
          temperatureLabel: "Temperatur",
          rainLabel: "Regen",
          humidityLabel: "Luftfeuchte",
          windLabel: "Wind",
        },
        meteoalarm: {
          name: "Meteoalarm",
          alertFallback: "Warnung",
          noAlerts: "Keine Warnungen",
          weatherAlert: "Wetterwarnung",
          noWeatherAlerts: "Keine Wetterwarnungen",
          level: "Stufe",
          type: "Typ",
          start: "Beginn",
          end: "Ende",
          severity: "Schweregrad",
          urgency: "Dringlichkeit",
          certainty: "Sicherheit",
          close: "Schließen",
          descriptionTitle: "Beschreibung",
          instructionsTitle: "Hinweise",
          terms: {
            moderate: "Mäßig",
            severe: "Schwer",
            high: "Hoch",
            extreme: "Extrem",
            minor: "Gering",
            yellow: "Gelb",
            orange: "Orange",
            red: "Rot",
            green: "Grün",
            future: "Zukünftig",
            immediate: "Sofort",
            expected: "Erwartet",
            past: "Vergangen",
            likely: "Wahrscheinlich",
            observed: "Beobachtet",
            possible: "Möglich",
            unlikely: "Unwahrscheinlich",
            unknown: "Unbekannt",
            met: "Meteorologisch",
            monitor: "Beobachten",
          },
        },
      },
      humidifierCard: {
        modes: {
          auto: "Auto",
          automatic: "Auto",
          smart: "Smart",
          smart_mode: "Smart",
          sleep: "Nacht",
          night: "Nacht",
          eco: "Eco",
          quiet: "Leise",
          silent: "Leise",
          low: "Niedrig",
          medium: "Mittel",
          mid: "Mittel",
          high: "Hoch",
          boost: "Boost",
          turbo: "Turbo",
          normal: "Normal",
          balanced: "Normal",
          dry: "Trocknen",
          drying: "Trocknen",
          continuous: "Dauerbetrieb",
          clothes_dry: "Wäsche",
          laundry: "Wäsche",
        },
      },
      graphCard: {
        emptyHistory: "Kein Verlauf verfügbar",
      },
      favCard: {
        disarmedF: "Entschärft",
        armed_home: "Zuhause",
        armed_away: "Abwesend",
        armed_night: "Nacht",
        armed_vacation: "Urlaub",
        armed_custom_bypass: "Benutzerdefiniert",
        arming: "Scharfschalten",
        disarming: "Entschärfen",
        pending: "Ausstehend",
        triggered: "Ausgelöst",
      },
    },
    fr: {
      advanceVacuum: {
        modeLabels: {
          all: "Tout",
          rooms: "Pièces",
          zone: "Zone",
          routines: "Routines",
          goto: "Aller au point",
        },
        panelModes: {
          smart: "Intelligent",
          vacuum_mop: "Aspiration et lavage",
          vacuum: "Aspiration",
          mop: "Lavage",
          custom: "Personnalisé",
        },
        dockSections: {
          control: "Commandes station",
          settings: "Réglages station",
        },
        dockSettings: {
          mop_wash_frequency: "Fréquence lavage serpillière",
          mop_mode: "Mode lavage",
          auto_empty_frequency: "Fréquence vidange auto",
          empty_mode: "Mode vidange",
          drying_duration: "Durée séchage",
        },
        dockControls: {
          empty: { label: "Vider le bac", active: "Arrêter vidange" },
          wash: { label: "Laver la serpillière", active: "Arrêter lavage" },
          dry: { label: "Sécher la serpillière", active: "Arrêter séchage" },
        },
        vacuumModes: {
          quiet: "Silencieux",
          silent: "Silencieux",
          balanced: "Équilibré",
          standard: "Standard",
          normal: "Normal",
          turbo: "Turbo",
          max: "Max",
          maxplus: "Max+",
          max_plus: "Max+",
          gentle: "Doux",
          strong: "Fort",
          smart: "Intelligent",
          smartmode: "Intelligent",
          smart_mode: "Intelligent",
          intelligent: "Intelligent",
          custom: "Personnalisé",
          custommode: "Personnalisé",
          custom_mode: "Personnalisé",
          custom_water_flow: "Débit d'eau perso.",
          custom_watter_flow: "Débit d'eau perso.",
          off: "Sans lavage",
          low: "Faible",
          medium: "Moyen",
          high: "Élevé",
          intense: "Intense",
          deep: "Profond",
          deep_plus: "Profond+",
          deepplus: "Profond+",
          fast: "Rapide",
          rapido: "Rapide",
        },
        offSuction: "Arrêt",
        reportedStates: {
          docked: "À la station",
          charging: "Charge",
          charging_completed: "Charge",
          cleaning: "Nettoyage",
          spot_cleaning: "Nettoyage",
          segment_cleaning: "Nettoyage",
          room_cleaning: "Nettoyage",
          zone_cleaning: "Nettoyage",
          clean_area: "Nettoyage",
          paused: "En pause",
          returning: "Retour station",
          return_to_base: "Retour station",
          returning_home: "Retour station",
          washing: "Lavage serpillière",
          wash_mop: "Lavage serpillière",
          washing_mop: "Lavage serpillière",
          washing_pads: "Lavage serpillière",
          drying: "Séchage",
          drying_mop: "Séchage",
          emptying: "Vidange auto",
          self_emptying: "Vidange auto",
          unavailable: "Indisponible",
          unknown: "Inconnu",
          error: "Erreur",
          fallback: "Inconnu",
        },
        mapStatus: {
          washing_mop: "Lavage serpillière",
          drying_mop: "Séchage serpillière",
          emptying_dust: "Vidange poussière",
          charging: "Charge",
        },
        descriptorLabels: {
          suction: "Aspiration",
          mop: "Lavage",
          mop_mode: "Mode serpillière",
        },
        utility: {
          cleaningMode: "Mode nettoyage",
          cleaningCounter: "Passes",
          dockActions: "Actions station",
          chargingStation: "Station de charge",
          zonesWord: "zones",
          pointWord: "point",
          zoneTool: "Zone",
          routineDefault: "Routine",
          customMenuDefault: "Station",
          modesFallbackTitle: "Modes aspiration et lavage",
        },
        actions: {
          returnToBase: "Retour station",
          locate: "Localiser",
          stop: "Arrêt",
          run: "Lancer",
          addZoneToClean: "Ajouter zone au nettoyage",
          cleanZone: "Nettoyer zone",
        },
        handles: {
          moveZone: "Déplacer zone",
          deleteZone: "Supprimer zone",
          resizeZone: "Redimensionner zone",
        },
        titles: {
          editZone: "Modifier zone",
          backPanel: "Retour au panneau",
          addZone: "Ajouter zone",
          gotoFallback: "Point",
        },
      },
      navigationMusicAssist: {
        artist: "Artistes",
        artists: "Artistes",
        album: "Albums",
        albums: "Albums",
        track: "Titres",
        tracks: "Titres",
        song: "Titres",
        songs: "Titres",
        playlist: "Playlists",
        playlists: "Playlists",
        "radio station": "Radios",
        "radio stations": "Radios",
        podcast: "Podcasts",
        podcasts: "Podcasts",
        audiobook: "Livres audio",
        audiobooks: "Livres audio",
        genre: "Genres",
        genres: "Genres",
        favorite: "Favoris",
        favorites: "Favoris",
        favourites: "Favoris",
        search: "Rechercher",
        "recently played": "Récemment écouté",
        "recently added": "Récemment ajouté",
        "recently played tracks": "Titres récents",
        browseFallback: "Élément",
      },
      vacuumSimple: {
        quiet: "Silencieux",
        silent: "Silencieux",
        balanced: "Équilibré",
        standard: "Standard",
        normal: "Normal",
        turbo: "Turbo",
        max: "Max",
        maxplus: "Max+",
        max_plus: "Max+",
        gentle: "Doux",
        strong: "Fort",
        smart: "Intelligent",
        smartmode: "Intelligent",
        smart_mode: "Intelligent",
        intelligent: "Intelligent",
        custom: "Personnalisé",
        custommode: "Personnalisé",
        custom_mode: "Personnalisé",
        custom_water_flow: "Débit d'eau perso.",
        custom_watter_flow: "Débit d'eau perso.",
        off: "Sans lavage",
        low: "Faible",
        medium: "Moyen",
        high: "Élevé",
        intense: "Intense",
        deep: "Profond",
      },
      fan: {
        off: "Éteint",
        on: "Allumé",
        unavailable: "Indisponible",
        unknown: "Inconnu",
        noState: "Pas d'état",
        fallbackName: "Ventilateur",
      },
      alarmPanel: {
        defaultTitle: "Alarme",
        noState: "Pas d'état",
        actions: {
          disarm: "Désarmer",
          arm_home: "Maison",
          arm_away: "Absent",
          arm_night: "Nuit",
          arm_vacation: "Vacances",
          arm_custom_bypass: "Perso",
        },
        states: {
          disarmed: "Désactivée",
          armed_home: "Maison",
          armed_away: "Absent",
          armed_night: "Nuit",
          armed_vacation: "Vacances",
          armed_custom_bypass: "Perso.",
          armed: "Armée",
          arming: "Armement",
          disarming: "Désarmement",
          pending: "En attente",
          triggered: "Déclenchée",
          unavailable: "Indisponible",
          unknown: "Inconnue",
        },
      },
      person: {
        home: "À la maison",
        notHome: "Absent",
        work: "Travail",
        school: "École",
        unavailable: "Indisponible",
        unknown: "Inconnu",
        locationUnknown: "Lieu inconnu",
      },
      entityCard: {
        binarySensor: {
          doorOpen: "Ouverte",
          doorClosed: "Fermée",
          motionOn: "Détecté",
          motionOff: "Libre",
        },
        boolean: {
          yes: "Oui",
          no: "Non",
        },
        states: {
          on: "Allumé",
          off: "Éteint",
          open: "Ouvert",
          opening: "Ouverture",
          closed: "Fermé",
          closing: "Fermeture",
          playing: "Lecture",
          paused: "Pause",
          idle: "Inactif",
          standby: "Veille",
          home: "À la maison",
          not_home: "Absent",
          detected: "Détecté",
          clear: "Libre",
          unavailable: "Indisponible",
          unknown: "Inconnu",
          locked: "Verrouillé",
          unlocked: "Déverrouillé",
          locking: "Verrouillage",
          unlocking: "Déverrouillage",
          locking_failed: "Verrouillage échoué",
          unlocking_failed: "Déverrouillage échoué",
          jammed: "Bloqué",
          pending: "En attente",
          stopped: "Arrêté",
          armed_away: "Armé absent",
          armed_home: "Armé maison",
          disarmed: "Désactivé",
          triggered: "Déclenché",
          comfortable: "Confortable",
          very_comfortable: "Très confortable",
          slightly_uncomfortable: "Peu inconfortable",
          somewhat_uncomfortable: "Assez inconfortable",
          quite_uncomfortable: "Plutôt inconfortable",
          extremely_uncomfortable: "Très inconfortable",
          ok_but_humid: "OK mais humide",
          little_or_no_discomfort: "Peu ou pas d'inconfort",
          some_discomfort: "Un peu d'inconfort",
          great_discomfort_avoid_exertion: "Grand inconfort",
          dangerous_discomfort: "Inconfort dangereux",
          heat_stroke_imminent: "Coup de chaleur imminent",
          dry: "Sec",
          very_dry: "Très sec",
          too_dry: "Trop sec",
          humid: "Humide",
          very_humid: "Très humide",
          too_humid: "Trop humide",
          wet: "Mouillé",
          low: "Faible",
          medium: "Moyen",
          moderate: "Modéré",
          high: "Élevé",
          very_high: "Très élevé",
          severely_high: "Extrêmement élevé",
          critical: "Critique",
          excellent: "Excellent",
          good: "Bon",
          fair: "Correct",
          poor: "Mauvais",
        },
      },
      weatherCard: {
        conditions: {
          clear_night: "Nuit claire",
          cloudy: "Nuageux",
          exceptional: "Exceptionnel",
          fog: "Brouillard",
          hail: "Grêle",
          lightning: "Orage",
          lightning_rainy: "Orage et pluie",
          partlycloudy: "Partiellement nuageux",
          pouring: "Pluie intense",
          rainy: "Pluvieux",
          snowy: "Neigeux",
          snowy_rainy: "Neige fondue",
          sunny: "Ensoleillé",
          windy: "Venteux",
          windy_variant: "Vent variable",
        },
        defaultCondition: "Météo",
        forecast: {
          chartAriaHourly: "Graphique météo horaire",
          chartAriaDaily: "Graphique météo hebdomadaire",
          tabsAria: "Vue des prévisions",
          tabCards: "Cartes",
          tabChart: "Graphique",
          hoursTab: "Heures",
          weekTab: "Semaine",
          emptyHourly: "Aucune prévision horaire disponible.",
          emptyDaily: "Aucune prévision hebdomadaire disponible.",
          chartInsufficientData: "Pas assez de données pour afficher le graphique.",
          closeDetail: "Fermer le détail",
          maxLabel: "Max",
          minLabel: "Min",
          temperatureLabel: "Température",
          rainLabel: "Pluie",
          humidityLabel: "Humidité",
          windLabel: "Vent",
        },
        meteoalarm: {
          name: "Meteoalarm",
          alertFallback: "Alerte",
          noAlerts: "Aucune alerte",
          weatherAlert: "Alerte météo",
          noWeatherAlerts: "Aucune alerte météo",
          level: "Niveau",
          type: "Type",
          start: "Début",
          end: "Fin",
          severity: "Sévérité",
          urgency: "Urgence",
          certainty: "Certitude",
          close: "Fermer",
          descriptionTitle: "Description",
          instructionsTitle: "Consignes",
          terms: {
            moderate: "Modéré",
            severe: "Grave",
            high: "Élevé",
            extreme: "Extrême",
            minor: "Mineur",
            yellow: "Jaune",
            orange: "Orange",
            red: "Rouge",
            green: "Vert",
            future: "Futur",
            immediate: "Immédiat",
            expected: "Prévu",
            past: "Passé",
            likely: "Probable",
            observed: "Observé",
            possible: "Possible",
            unlikely: "Improbable",
            unknown: "Inconnu",
            met: "Météorologique",
            monitor: "Surveillance",
          },
        },
      },
      humidifierCard: {
        modes: {
          auto: "Auto",
          automatic: "Auto",
          smart: "Intelligent",
          smart_mode: "Intelligent",
          sleep: "Nuit",
          night: "Nuit",
          eco: "Éco",
          quiet: "Silencieux",
          silent: "Silencieux",
          low: "Faible",
          medium: "Moyen",
          mid: "Moyen",
          high: "Élevé",
          boost: "Boost",
          turbo: "Turbo",
          normal: "Normal",
          balanced: "Normal",
          dry: "Séchage",
          drying: "Séchage",
          continuous: "Continu",
          clothes_dry: "Linge",
          laundry: "Linge",
        },
      },
      graphCard: {
        emptyHistory: "Aucun historique disponible",
      },
      favCard: {
        disarmedF: "Désactivée",
        armed_home: "Maison",
        armed_away: "Absent",
        armed_night: "Nuit",
        armed_vacation: "Vacances",
        armed_custom_bypass: "Perso.",
        arming: "Armement",
        disarming: "Désarmement",
        pending: "En attente",
        triggered: "Déclenchée",
      },
    },
    it: {
      advanceVacuum: {
        modeLabels: {
          all: "Tutto",
          rooms: "Stanze",
          zone: "Zona",
          routines: "Routine",
          goto: "Vai al punto",
        },
        panelModes: {
          smart: "Smart",
          vacuum_mop: "Aspira e lava",
          vacuum: "Aspirazione",
          mop: "Lavaggio",
          custom: "Personalizzato",
        },
        dockSections: {
          control: "Comandi base",
          settings: "Impostazioni base",
        },
        dockSettings: {
          mop_wash_frequency: "Frequenza lavaggio panno",
          mop_mode: "Modalità lavaggio",
          auto_empty_frequency: "Frequenza svuotamento auto",
          empty_mode: "Modalità svuotamento",
          drying_duration: "Durata asciugatura",
        },
        dockControls: {
          empty: { label: "Svuota contenitore", active: "Stop svuotamento" },
          wash: { label: "Lava panno", active: "Stop lavaggio" },
          dry: { label: "Asciuga mopa", active: "Stop asciugatura" },
        },
        vacuumModes: {
          quiet: "Silenzioso",
          silent: "Silenzioso",
          balanced: "Bilanciato",
          standard: "Standard",
          normal: "Normale",
          turbo: "Turbo",
          max: "Max",
          maxplus: "Max+",
          max_plus: "Max+",
          gentle: "Delicato",
          strong: "Forte",
          smart: "Smart",
          smartmode: "Smart",
          smart_mode: "Smart",
          intelligent: "Smart",
          custom: "Personalizzato",
          custommode: "Personalizzato",
          custom_mode: "Personalizzato",
          custom_water_flow: "Portata acqua personalizzata",
          custom_watter_flow: "Portata acqua personalizzata",
          off: "Senza lavaggio",
          low: "Bassa",
          medium: "Media",
          high: "Alta",
          intense: "Intenso",
          deep: "Profondo",
          deep_plus: "Profondo+",
          deepplus: "Profondo+",
          fast: "Veloce",
          rapido: "Veloce",
        },
        offSuction: "Off",
        reportedStates: {
          docked: "In base",
          charging: "In carica",
          charging_completed: "In carica",
          cleaning: "Pulizia",
          spot_cleaning: "Pulizia",
          segment_cleaning: "Pulizia",
          room_cleaning: "Pulizia",
          zone_cleaning: "Pulizia",
          clean_area: "Pulizia",
          paused: "In pausa",
          returning: "Ritorno alla base",
          return_to_base: "Ritorno alla base",
          returning_home: "Ritorno alla base",
          washing: "Lavaggio mop",
          wash_mop: "Lavaggio mop",
          washing_mop: "Lavaggio mop",
          washing_pads: "Lavaggio mop",
          drying: "Asciugatura",
          drying_mop: "Asciugatura",
          emptying: "Svuotamento auto",
          self_emptying: "Svuotamento auto",
          unavailable: "Non disponibile",
          unknown: "Sconosciuto",
          error: "Errore",
          fallback: "Sconosciuto",
        },
        mapStatus: {
          washing_mop: "Lavaggio mopa",
          drying_mop: "Asciugatura mopa",
          emptying_dust: "Svuotamento polvere",
          charging: "In carica",
        },
        descriptorLabels: {
          suction: "Aspirazione",
          mop: "Lavaggio",
          mop_mode: "Modalità mopa",
        },
        utility: {
          cleaningMode: "Modalità pulizia",
          cleaningCounter: "Passaggi",
          dockActions: "Azioni base",
          chargingStation: "Base di ricarica",
          zonesWord: "zone",
          pointWord: "punto",
          zoneTool: "Zona",
          routineDefault: "Routine",
          customMenuDefault: "Base",
          modesFallbackTitle: "Modalità aspirazione e lavaggio",
        },
        actions: {
          returnToBase: "Torna alla base",
          locate: "Localizza",
          stop: "Stop",
          run: "Avvia",
          addZoneToClean: "Aggiungi zona alla pulizia",
          cleanZone: "Pulisci zona",
        },
        handles: {
          moveZone: "Sposta zona",
          deleteZone: "Elimina zona",
          resizeZone: "Ridimensiona zona",
        },
        titles: {
          editZone: "Modifica zona",
          backPanel: "Torna al pannello",
          addZone: "Aggiungi zona",
          gotoFallback: "Punto",
        },
      },
      navigationMusicAssist: {
        artist: "Artisti",
        artists: "Artisti",
        album: "Album",
        albums: "Album",
        track: "Brani",
        tracks: "Brani",
        song: "Brani",
        songs: "Brani",
        playlist: "Playlist",
        playlists: "Playlist",
        "radio station": "Radio",
        "radio stations": "Radio",
        podcast: "Podcast",
        podcasts: "Podcast",
        audiobook: "Audiolibri",
        audiobooks: "Audiolibri",
        genre: "Generi",
        genres: "Generi",
        favorite: "Preferiti",
        favorites: "Preferiti",
        favourites: "Preferiti",
        search: "Cerca",
        "recently played": "Riprodotti di recente",
        "recently added": "Aggiunti di recente",
        "recently played tracks": "Brani recenti",
        browseFallback: "Elemento",
      },
      vacuumSimple: {
        quiet: "Silenzioso",
        silent: "Silenzioso",
        balanced: "Bilanciato",
        standard: "Standard",
        normal: "Normale",
        turbo: "Turbo",
        max: "Max",
        maxplus: "Max+",
        max_plus: "Max+",
        gentle: "Delicato",
        strong: "Forte",
        smart: "Smart",
        smartmode: "Smart",
        smart_mode: "Smart",
        intelligent: "Smart",
        custom: "Personalizzato",
        custommode: "Personalizzato",
        custom_mode: "Personalizzato",
        custom_water_flow: "Portata acqua personalizzata",
        custom_watter_flow: "Portata acqua personalizzata",
        off: "Senza lavaggio",
        low: "Bassa",
        medium: "Media",
        high: "Alta",
        intense: "Intenso",
        deep: "Profondo",
      },
      fan: {
        off: "Spento",
        on: "Acceso",
        unavailable: "Non disponibile",
        unknown: "Sconosciuto",
        noState: "Nessuno stato",
        fallbackName: "Ventilatore",
      },
      alarmPanel: {
        defaultTitle: "Allarme",
        noState: "Nessuno stato",
        actions: {
          disarm: "Disarma",
          arm_home: "Casa",
          arm_away: "Fuori",
          arm_night: "Notte",
          arm_vacation: "Vacanza",
          arm_custom_bypass: "Personalizzato",
        },
        states: {
          disarmed: "Disattivato",
          armed_home: "Casa",
          armed_away: "Fuori",
          armed_night: "Notte",
          armed_vacation: "Vacanza",
          armed_custom_bypass: "Personalizzato",
          armed: "Attivo",
          arming: "Attivazione",
          disarming: "Disattivazione",
          pending: "In attesa",
          triggered: "Scattato",
          unavailable: "Non disponibile",
          unknown: "Sconosciuto",
        },
      },
      person: {
        home: "A casa",
        notHome: "Fuori",
        work: "Lavoro",
        school: "Scuola",
        unavailable: "Non disponibile",
        unknown: "Sconosciuto",
        locationUnknown: "Posizione sconosciuta",
      },
      entityCard: {
        binarySensor: {
          doorOpen: "Aperta",
          doorClosed: "Chiusa",
          motionOn: "Rilevato",
          motionOff: "Libero",
        },
        boolean: {
          yes: "Sì",
          no: "No",
        },
        states: {
          on: "Acceso",
          off: "Spento",
          open: "Aperto",
          opening: "Apertura",
          closed: "Chiuso",
          closing: "Chiusura",
          playing: "In riproduzione",
          paused: "In pausa",
          idle: "Inattivo",
          standby: "Standby",
          home: "A casa",
          not_home: "Fuori",
          detected: "Rilevato",
          clear: "Libero",
          unavailable: "Non disponibile",
          unknown: "Sconosciuto",
          locked: "Bloccato",
          unlocked: "Sbloccato",
          locking: "Blocco…",
          unlocking: "Sblocco…",
          locking_failed: "Blocco fallito",
          unlocking_failed: "Sblocco fallito",
          jammed: "Inceppato",
          pending: "In attesa",
          stopped: "Fermato",
          armed_away: "Armato fuori",
          armed_home: "Armato casa",
          disarmed: "Disattivato",
          triggered: "Scattato",
          comfortable: "Comodo",
          very_comfortable: "Molto comodo",
          slightly_uncomfortable: "Leggermente scomodo",
          somewhat_uncomfortable: "Abbastanza scomodo",
          quite_uncomfortable: "Piuttosto scomodo",
          extremely_uncomfortable: "Molto scomodo",
          ok_but_humid: "OK ma umido",
          little_or_no_discomfort: "Poco o nessun disagio",
          some_discomfort: "Qualche disagio",
          great_discomfort_avoid_exertion: "Grande disagio",
          dangerous_discomfort: "Disagio pericoloso",
          heat_stroke_imminent: "Colpo di calore imminente",
          dry: "Asciutto",
          very_dry: "Molto asciutto",
          too_dry: "Troppo asciutto",
          humid: "Umido",
          very_humid: "Molto umido",
          too_humid: "Troppo umido",
          wet: "Bagnato",
          low: "Basso",
          medium: "Medio",
          moderate: "Moderato",
          high: "Alto",
          very_high: "Molto alto",
          severely_high: "Estremamente alto",
          critical: "Critico",
          excellent: "Eccellente",
          good: "Buono",
          fair: "Discreto",
          poor: "Scarso",
        },
      },
      weatherCard: {
        conditions: {
          clear_night: "Cielo sereno",
          cloudy: "Nuvoloso",
          exceptional: "Eccezionale",
          fog: "Nebbia",
          hail: "Grandine",
          lightning: "Temporale",
          lightning_rainy: "Temporale con pioggia",
          partlycloudy: "Parzialmente nuvoloso",
          pouring: "Pioggia intensa",
          rainy: "Piovoso",
          snowy: "Nevoso",
          snowy_rainy: "Nevischio",
          sunny: "Soleggiato",
          windy: "Ventoso",
          windy_variant: "Vento variabile",
        },
        defaultCondition: "Meteo",
        forecast: {
          chartAriaHourly: "Grafico previsioni orarie",
          chartAriaDaily: "Grafico previsioni settimanali",
          tabsAria: "Vista previsioni",
          tabCards: "Schede",
          tabChart: "Grafico",
          hoursTab: "Ore",
          weekTab: "Settimana",
          emptyHourly: "Nessuna previsione oraria disponibile.",
          emptyDaily: "Nessuna previsione settimanale disponibile.",
          chartInsufficientData: "Dati insufficienti per mostrare il grafico.",
          closeDetail: "Chiudi dettaglio",
          maxLabel: "Max",
          minLabel: "Min",
          temperatureLabel: "Temperatura",
          rainLabel: "Pioggia",
          humidityLabel: "Umidità",
          windLabel: "Vento",
        },
        meteoalarm: {
          name: "Meteoalarm",
          alertFallback: "Allerta",
          noAlerts: "Nessuna allerta",
          weatherAlert: "Allerta meteo",
          noWeatherAlerts: "Nessuna allerta meteo",
          level: "Livello",
          type: "Tipo",
          start: "Inizio",
          end: "Fine",
          severity: "Severità",
          urgency: "Urgenza",
          certainty: "Certezza",
          close: "Chiudi",
          descriptionTitle: "Descrizione",
          instructionsTitle: "Istruzioni",
          terms: {
            moderate: "Moderato",
            severe: "Grave",
            high: "Alto",
            extreme: "Estremo",
            minor: "Lieve",
            yellow: "Giallo",
            orange: "Arancione",
            red: "Rosso",
            green: "Verde",
            future: "Futuro",
            immediate: "Immediato",
            expected: "Previsto",
            past: "Passato",
            likely: "Probabile",
            observed: "Osservato",
            possible: "Possibile",
            unlikely: "Improbabile",
            unknown: "Sconosciuto",
            met: "Meteorologico",
            monitor: "Monitoraggio",
          },
        },
      },
      humidifierCard: {
        modes: {
          auto: "Auto",
          automatic: "Auto",
          smart: "Smart",
          smart_mode: "Smart",
          sleep: "Notte",
          night: "Notte",
          eco: "Eco",
          quiet: "Silenzioso",
          silent: "Silenzioso",
          low: "Basso",
          medium: "Medio",
          mid: "Medio",
          high: "Alto",
          boost: "Boost",
          turbo: "Turbo",
          normal: "Normale",
          balanced: "Normale",
          dry: "Asciugatura",
          drying: "Asciugatura",
          continuous: "Continuo",
          clothes_dry: "Bucato",
          laundry: "Bucato",
        },
      },
      graphCard: {
        emptyHistory: "Nessuno storico disponibile",
      },
      favCard: {
        disarmedF: "Disattivato",
        armed_home: "Casa",
        armed_away: "Fuori",
        armed_night: "Notte",
        armed_vacation: "Vacanza",
        armed_custom_bypass: "Personalizzato",
        arming: "Attivazione",
        disarming: "Disattivazione",
        pending: "In attesa",
        triggered: "Scattato",
      },
    },
    nl: {
      advanceVacuum: {
        modeLabels: {
          all: "Alles",
          rooms: "Kamers",
          zone: "Zone",
          routines: "Routes",
          goto: "Ga naar punt",
        },
        panelModes: {
          smart: "Slim",
          vacuum_mop: "Zuigen & dweilen",
          vacuum: "Zuigen",
          mop: "Dweilen",
          custom: "Aangepast",
        },
        dockSections: {
          control: "Dock-bediening",
          settings: "Dock-instellingen",
        },
        dockSettings: {
          mop_wash_frequency: "Wasfrequentie dweil",
          mop_mode: "Dweilmodus",
          auto_empty_frequency: "Automatisch legen frequentie",
          empty_mode: "Ledigmodus",
          drying_duration: "Droogduur",
        },
        dockControls: {
          empty: { label: "Reservoir legen", active: "Legen stoppen" },
          wash: { label: "Dweil wassen", active: "Wassen stoppen" },
          dry: { label: "Dweil drogen", active: "Drogen stoppen" },
        },
        vacuumModes: {
          quiet: "Stil",
          silent: "Stil",
          balanced: "Gebalanceerd",
          standard: "Standaard",
          normal: "Normaal",
          turbo: "Turbo",
          max: "Max",
          maxplus: "Max+",
          max_plus: "Max+",
          gentle: "Zacht",
          strong: "Sterk",
          smart: "Slim",
          smartmode: "Slim",
          smart_mode: "Slim",
          intelligent: "Slim",
          custom: "Aangepast",
          custommode: "Aangepast",
          custom_mode: "Aangepast",
          custom_water_flow: "Aangepast waterdebiet",
          custom_watter_flow: "Aangepast waterdebiet",
          off: "Geen dweilen",
          low: "Laag",
          medium: "Gemiddeld",
          high: "Hoog",
          intense: "Intens",
          deep: "Diep",
          deep_plus: "Diep+",
          deepplus: "Diep+",
          fast: "Snel",
          rapido: "Snel",
        },
        offSuction: "Uit",
        reportedStates: {
          docked: "In dock",
          charging: "Laden",
          charging_completed: "Laden",
          cleaning: "Schoonmaken",
          spot_cleaning: "Schoonmaken",
          segment_cleaning: "Schoonmaken",
          room_cleaning: "Schoonmaken",
          zone_cleaning: "Schoonmaken",
          clean_area: "Schoonmaken",
          paused: "Gepauzeerd",
          returning: "Terug naar dock",
          return_to_base: "Terug naar dock",
          returning_home: "Terug naar dock",
          washing: "Dweilen wassen",
          wash_mop: "Dweilen wassen",
          washing_mop: "Dweilen wassen",
          washing_pads: "Dweilen wassen",
          drying: "Drogen",
          drying_mop: "Drogen",
          emptying: "Automatisch legen",
          self_emptying: "Automatisch legen",
          unavailable: "Niet beschikbaar",
          unknown: "Onbekend",
          error: "Fout",
          fallback: "Onbekend",
        },
        mapStatus: {
          washing_mop: "Dweil wordt gewassen",
          drying_mop: "Dweil wordt gedroogd",
          emptying_dust: "Stofreservoir legen",
          charging: "Laden",
        },
        descriptorLabels: {
          suction: "Zuigen",
          mop: "Dweilen",
          mop_mode: "Dweilmodus",
        },
        utility: {
          cleaningMode: "Schoonmaakmodus",
          cleaningCounter: "Rondes",
          dockActions: "Dock-acties",
          chargingStation: "Laadstation",
          zonesWord: "zones",
          pointWord: "punt",
          zoneTool: "Zone",
          routineDefault: "Routine",
          customMenuDefault: "Dock",
          modesFallbackTitle: "Zuig- en dweilmodi",
        },
        actions: {
          returnToBase: "Terug naar dock",
          locate: "Zoeken",
          stop: "Stop",
          run: "Start",
          addZoneToClean: "Zone toevoegen aan schoonmaak",
          cleanZone: "Zone schoonmaken",
        },
        handles: {
          moveZone: "Zone verplaatsen",
          deleteZone: "Zone verwijderen",
          resizeZone: "Zone formaat",
        },
        titles: {
          editZone: "Zone bewerken",
          backPanel: "Terug naar hoofdpaneel",
          addZone: "Zone toevoegen",
          gotoFallback: "Punt",
        },
      },
      navigationMusicAssist: {
        artist: "Artiesten",
        artists: "Artiesten",
        album: "Albums",
        albums: "Albums",
        track: "Nummers",
        tracks: "Nummers",
        song: "Nummers",
        songs: "Nummers",
        playlist: "Afspeellijsten",
        playlists: "Afspeellijsten",
        "radio station": "Radiozenders",
        "radio stations": "Radiozenders",
        podcast: "Podcasts",
        podcasts: "Podcasts",
        audiobook: "Luisterboeken",
        audiobooks: "Luisterboeken",
        genre: "Genres",
        genres: "Genres",
        favorite: "Favorieten",
        favorites: "Favorieten",
        favourites: "Favorieten",
        search: "Zoeken",
        "recently played": "Onlangs afgespeeld",
        "recently added": "Onlangs toegevoegd",
        "recently played tracks": "Onlangs afgespeelde nummers",
        browseFallback: "Item",
      },
      vacuumSimple: {
        quiet: "Stil",
        silent: "Stil",
        balanced: "Gebalanceerd",
        standard: "Standaard",
        normal: "Normaal",
        turbo: "Turbo",
        max: "Max",
        maxplus: "Max+",
        max_plus: "Max+",
        gentle: "Zacht",
        strong: "Sterk",
        smart: "Slim",
        smartmode: "Slim",
        smart_mode: "Slim",
        intelligent: "Slim",
        custom: "Aangepast",
        custommode: "Aangepast",
        custom_mode: "Aangepast",
        custom_water_flow: "Aangepast waterdebiet",
        custom_watter_flow: "Aangepast waterdebiet",
        off: "Geen dweilen",
        low: "Laag",
        medium: "Gemiddeld",
        high: "Hoog",
        intense: "Intens",
        deep: "Diep",
      },
      fan: {
        off: "Uit",
        on: "Aan",
        unavailable: "Niet beschikbaar",
        unknown: "Onbekend",
        noState: "Geen status",
        fallbackName: "Ventilator",
      },
      alarmPanel: {
        defaultTitle: "Alarm",
        noState: "Geen status",
        actions: {
          disarm: "Uitschakelen",
          arm_home: "Thuis",
          arm_away: "Afwezig",
          arm_night: "Nacht",
          arm_vacation: "Vakantie",
          arm_custom_bypass: "Aangepast",
        },
        states: {
          disarmed: "Uitgeschakeld",
          armed_home: "Thuis",
          armed_away: "Afwezig",
          armed_night: "Nacht",
          armed_vacation: "Vakantie",
          armed_custom_bypass: "Aangepast",
          armed: "Ingeschakeld",
          arming: "Inschakelen",
          disarming: "Uitschakelen",
          pending: "In behandeling",
          triggered: "Getriggerd",
          unavailable: "Niet beschikbaar",
          unknown: "Onbekend",
        },
      },
      person: {
        home: "Thuis",
        notHome: "Afwezig",
        work: "Werk",
        school: "School",
        unavailable: "Niet beschikbaar",
        unknown: "Onbekend",
        locationUnknown: "Locatie onbekend",
      },
      entityCard: {
        binarySensor: {
          doorOpen: "Open",
          doorClosed: "Gesloten",
          motionOn: "Gedetecteerd",
          motionOff: "Vrij",
        },
        boolean: {
          yes: "Ja",
          no: "Nee",
        },
        states: {
          on: "Aan",
          off: "Uit",
          open: "Open",
          opening: "Openen",
          closed: "Gesloten",
          closing: "Sluiten",
          playing: "Afspelen",
          paused: "Gepauzeerd",
          idle: "Inactief",
          standby: "Stand-by",
          home: "Thuis",
          not_home: "Afwezig",
          detected: "Gedetecteerd",
          clear: "Vrij",
          unavailable: "Niet beschikbaar",
          unknown: "Onbekend",
          locked: "Vergrendeld",
          unlocked: "Ontgrendeld",
          locking: "Vergrendelen",
          unlocking: "Ontgrendelen",
          locking_failed: "Vergrendelen mislukt",
          unlocking_failed: "Ontgrendelen mislukt",
          jammed: "Vastgelopen",
          pending: "In behandeling",
          stopped: "Gestopt",
          armed_away: "Actief afwezig",
          armed_home: "Actief thuis",
          disarmed: "Uitgeschakeld",
          triggered: "Getriggerd",
          comfortable: "Comfortabel",
          very_comfortable: "Zeer comfortabel",
          slightly_uncomfortable: "Licht oncomfortabel",
          somewhat_uncomfortable: "Enigszins oncomfortabel",
          quite_uncomfortable: "Behoorlijk oncomfortabel",
          extremely_uncomfortable: "Zeer oncomfortabel",
          ok_but_humid: "OK maar vochtig",
          little_or_no_discomfort: "Weinig of geen ongemak",
          some_discomfort: "Enig ongemak",
          great_discomfort_avoid_exertion: "Groot ongemak",
          dangerous_discomfort: "Gevaarlijk ongemak",
          heat_stroke_imminent: "Hitteberoerte dreigt",
          dry: "Droog",
          very_dry: "Zeer droog",
          too_dry: "Te droog",
          humid: "Vochtig",
          very_humid: "Zeer vochtig",
          too_humid: "Te vochtig",
          wet: "Nat",
          low: "Laag",
          medium: "Gemiddeld",
          moderate: "Matig",
          high: "Hoog",
          very_high: "Zeer hoog",
          severely_high: "Extreem hoog",
          critical: "Kritiek",
          excellent: "Uitstekend",
          good: "Goed",
          fair: "Redelijk",
          poor: "Slecht",
        },
      },
      weatherCard: {
        conditions: {
          clear_night: "Heldere nacht",
          cloudy: "Bewolkt",
          exceptional: "Uitzonderlijk",
          fog: "Mist",
          hail: "Hagel",
          lightning: "Onweer",
          lightning_rainy: "Onweer met regen",
          partlycloudy: "Gedeeltelijk bewolkt",
          pouring: "Zware regen",
          rainy: "Regenachtig",
          snowy: "Sneeuw",
          snowy_rainy: "Natte sneeuw",
          sunny: "Zonnig",
          windy: "Winderig",
          windy_variant: "Wisselende wind",
        },
        defaultCondition: "Weer",
        forecast: {
          chartAriaHourly: "Uurlijkse weersgrafiek",
          chartAriaDaily: "Wekelijkse weersgrafiek",
          tabsAria: "Voorspellingsweergave",
          tabCards: "Kaarten",
          tabChart: "Grafiek",
          hoursTab: "Uren",
          weekTab: "Week",
          emptyHourly: "Geen uurlijkse voorspelling beschikbaar.",
          emptyDaily: "Geen wekelijkse voorspelling beschikbaar.",
          chartInsufficientData: "Onvoldoende gegevens om de grafiek te tonen.",
          closeDetail: "Detail sluiten",
          maxLabel: "Max",
          minLabel: "Min",
          temperatureLabel: "Temperatuur",
          rainLabel: "Regen",
          humidityLabel: "Luchtvochtigheid",
          windLabel: "Wind",
        },
        meteoalarm: {
          name: "Meteoalarm",
          alertFallback: "Waarschuwing",
          noAlerts: "Geen waarschuwingen",
          weatherAlert: "Weeralarm",
          noWeatherAlerts: "Geen weeralarmen",
          level: "Niveau",
          type: "Type",
          start: "Start",
          end: "Einde",
          severity: "Ernst",
          urgency: "Urgentie",
          certainty: "Zekerheid",
          close: "Sluiten",
          descriptionTitle: "Beschrijving",
          instructionsTitle: "Instructies",
          terms: {
            moderate: "Matig",
            severe: "Ernstig",
            high: "Hoog",
            extreme: "Extreem",
            minor: "Licht",
            yellow: "Geel",
            orange: "Oranje",
            red: "Rood",
            green: "Groen",
            future: "Toekomst",
            immediate: "Onmiddellijk",
            expected: "Verwacht",
            past: "Verleden",
            likely: "Waarschijnlijk",
            observed: "Waargenomen",
            possible: "Mogelijk",
            unlikely: "Onwaarschijnlijk",
            unknown: "Onbekend",
            met: "Meteorologisch",
            monitor: "Monitoren",
          },
        },
      },
      humidifierCard: {
        modes: {
          auto: "Auto",
          automatic: "Auto",
          smart: "Slim",
          smart_mode: "Slim",
          sleep: "Nacht",
          night: "Nacht",
          eco: "Eco",
          quiet: "Stil",
          silent: "Stil",
          low: "Laag",
          medium: "Gemiddeld",
          mid: "Gemiddeld",
          high: "Hoog",
          boost: "Boost",
          turbo: "Turbo",
          normal: "Normaal",
          balanced: "Normaal",
          dry: "Drogen",
          drying: "Drogen",
          continuous: "Continu",
          clothes_dry: "Wasgoed",
          laundry: "Wasgoed",
        },
      },
      graphCard: {
        emptyHistory: "Geen geschiedenis beschikbaar",
      },
      favCard: {
        disarmedF: "Uitgeschakeld",
        armed_home: "Thuis",
        armed_away: "Afwezig",
        armed_night: "Nacht",
        armed_vacation: "Vakantie",
        armed_custom_bypass: "Aangepast",
        arming: "Inschakelen",
        disarming: "Uitschakelen",
        pending: "In behandeling",
        triggered: "Getriggerd",
      },
    },
  };

  function strings(langCode) {
    const code = PACK[langCode] ? langCode : "es";
    const p = PACK[code];
    if (p.weatherCard && p.humidifierCard && p.graphCard && p.advanceVacuum) {
      return p;
    }
    const fb = code === "es" ? PACK.es : PACK.en;
    return {
      ...p,
      weatherCard: p.weatherCard || fb.weatherCard,
      humidifierCard: p.humidifierCard || fb.humidifierCard,
      graphCard: p.graphCard || fb.graphCard,
      advanceVacuum: p.advanceVacuum || fb.advanceVacuum,
    };
  }

  function normalizeHumidifierModeKey(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function translateWeatherCondition(hass, configLang, value) {
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

  function translateWeatherForecastUi(hass, configLang, uiKey) {
    const lang = resolveLanguage(hass, configLang);
    const f = strings(lang).weatherCard.forecast;
    if (f && f[uiKey]) {
      return f[uiKey];
    }
    return PACK.en.weatherCard.forecast[uiKey] || "";
  }

  function translateGraphEmptyHistory(hass, configLang) {
    const lang = resolveLanguage(hass, configLang);
    return strings(lang).graphCard.emptyHistory;
  }

  function translateHumidifierMode(hass, configLang, value) {
    const lang = resolveLanguage(hass, configLang);
    const key = normalizeHumidifierModeKey(value);
    const modes = strings(lang).humidifierCard.modes;
    if (key && modes[key]) {
      return modes[key];
    }
    return String(value ?? "").trim();
  }

  /** Same normalization as `nodalia-weather-card.js` for CAP / Meteoalarm attribute strings. */
  function meteoalarmApiKey(value) {
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
  const METEOALARM_CANONICAL_BY_API_KEY = {
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

  function translateMeteoalarmTerm(hass, configLang, raw) {
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

  function translateAdvanceVacuumReportedState(hass, configLang, stateKey, rawFallback) {
    const lang = resolveLanguage(hass, configLang);
    const k = normalizeTextKey(stateKey);
    const rs = strings(lang).advanceVacuum.reportedStates;
    if (rs[k]) {
      return rs[k];
    }
    const es = PACK.es.advanceVacuum.reportedStates;
    if (es[k]) {
      return rs[k] || strings("en").advanceVacuum.reportedStates[k] || es[k];
    }
    if (rawFallback != null && rawFallback !== "") {
      return String(rawFallback);
    }
    return rs.unknown || es.unknown;
  }

  function translateAdvanceVacuumVacuumMode(hass, configLang, rawValue, kind = "generic") {
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
    const esm = PACK.es.advanceVacuum.vacuumModes;
    if (esm[key]) {
      return av.vacuumModes[key] || strings("en").advanceVacuum.vacuumModes[key] || esm[key];
    }
    return raw
      .replaceAll("_", " ")
      .replace(/\bplus\b/gi, "+")
      .replace(/\b\w/g, match => match.toUpperCase());
  }

  function translateEntityState(langCode, state, numberDecimals, formatNumericValueWithUnit, formatNumericValue, parseNumericValue) {
    const dict = strings(langCode).entityCard;
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

  window.NodaliaI18n = {
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
    translateHumidifierMode,
    translateMeteoalarmTerm,
    translateAdvanceVacuumReportedState,
    translateAdvanceVacuumVacuumMode,
    translateFavState(langCode, key) {
      const raw = normalizeTextKey(key);
      const fd = strings(langCode).favCard;
      const ed = strings(langCode).entityCard.states;
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

  try {
    if (typeof window !== "undefined" && typeof CustomEvent === "function") {
      window.dispatchEvent(new CustomEvent("nodalia-i18n-ready", { bubbles: false }));
    }
  } catch (_e) {
    // ignore
  }
})();
