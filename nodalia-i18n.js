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
    return "en";
  }

  function localeTag(langCode) {
    const map = {
      es: "es",
      en: "en",
      de: "de",
      fr: "fr",
      it: "it",
      nl: "nl",
      pt: "pt",
      ru: "ru",
      el: "el",
      zh: "zh",
      ro: "ro",
    };
    return map[langCode] || "en";
  }

  function normalizeTextKey(value) {
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

  const VACUUM_ERROR_LABELS = {
    es: {
      lidar_blocked: "LiDAR bloqueado",
      bumper_stuck: "Parachoques atascado",
      wheels_suspended: "Ruedas suspendidas",
      cliff_sensor_error: "Error del sensor de desnivel",
      main_brush_jammed: "Cepillo principal bloqueado",
      side_brush_jammed: "Cepillo lateral bloqueado",
      wheels_jammed: "Ruedas bloqueadas",
      robot_trapped: "Robot atrapado",
      no_dustbin: "Depósito de polvo ausente",
      strainer_error: "Error del filtro",
      compass_error: "Error de brújula",
      low_battery: "Batería baja",
      charging_error: "Error de carga",
      battery_error: "Error de batería",
      wall_sensor_dirty: "Sensor de pared sucio",
      robot_tilted: "Robot inclinado",
      side_brush_error: "Error del cepillo lateral",
      fan_error: "Error del ventilador",
      dock: "Error de la base",
      optical_flow_sensor_dirt: "Sensor de flujo óptico sucio",
      vertical_bumper_pressed: "Parachoques vertical presionado",
      dock_locator_error: "Error localizando la base",
      return_to_dock_fail: "No pudo volver a la base",
      nogo_zone_detected: "Zona prohibida detectada",
      visual_sensor: "Error del sensor visual",
      light_touch: "Sensor táctil activado",
      vibrarise_jammed: "VibraRise bloqueado",
      robot_on_carpet: "Robot sobre alfombra",
      filter_blocked: "Filtro bloqueado",
      invisible_wall_detected: "Muro invisible detectado",
      cannot_cross_carpet: "No puede cruzar la alfombra",
      internal_error: "Error interno",
      collect_dust_error_3: "Error al recoger polvo",
      collect_dust_error_4: "Error al recoger polvo",
      mopping_roller_1: "Error del rodillo de fregado",
      mopping_roller_error_2: "Error del rodillo de fregado",
      clear_water_box_hoare: "Depósito de agua limpia anómalo",
      dirty_water_box_hoare: "Depósito de agua sucia anómalo",
      sink_strainer_hoare: "Filtro del fregadero anómalo",
      clear_water_box_exception: "Error del depósito de agua limpia",
      clear_brush_exception: "Error del cepillo de limpieza",
      clear_brush_exception_2: "Error del cepillo de limpieza",
      filter_screen_exception: "Error de la malla del filtro",
      mopping_roller_2: "Error del rodillo de fregado",
      up_water_exception: "Error al subir agua",
      drain_water_exception: "Error al drenar agua",
      temperature_protection: "Protección por temperatura",
      clean_carousel_exception: "Error del carrusel de limpieza",
      clean_carousel_water_full: "Agua llena en carrusel de limpieza",
      water_carriage_drop: "Carro de agua caído",
      check_clean_carouse: "Revisa el carrusel de limpieza",
      audio_error: "Error de audio",
    },
    en: {
      lidar_blocked: "LiDAR blocked",
      bumper_stuck: "Bumper stuck",
      wheels_suspended: "Wheels suspended",
      cliff_sensor_error: "Cliff sensor error",
      main_brush_jammed: "Main brush jammed",
      side_brush_jammed: "Side brush jammed",
      wheels_jammed: "Wheels jammed",
      robot_trapped: "Robot trapped",
      no_dustbin: "Dustbin missing",
      strainer_error: "Filter error",
      compass_error: "Compass error",
      low_battery: "Low battery",
      charging_error: "Charging error",
      battery_error: "Battery error",
      wall_sensor_dirty: "Wall sensor dirty",
      robot_tilted: "Robot tilted",
      side_brush_error: "Side brush error",
      fan_error: "Fan error",
      dock: "Dock error",
      optical_flow_sensor_dirt: "Optical flow sensor dirty",
      vertical_bumper_pressed: "Vertical bumper pressed",
      dock_locator_error: "Dock locator error",
      return_to_dock_fail: "Failed to return to dock",
      nogo_zone_detected: "No-go zone detected",
      visual_sensor: "Visual sensor error",
      light_touch: "Light touch sensor triggered",
      vibrarise_jammed: "VibraRise jammed",
      robot_on_carpet: "Robot on carpet",
      filter_blocked: "Filter blocked",
      invisible_wall_detected: "Invisible wall detected",
      cannot_cross_carpet: "Cannot cross carpet",
      internal_error: "Internal error",
      collect_dust_error_3: "Dust collection error",
      collect_dust_error_4: "Dust collection error",
      mopping_roller_1: "Mopping roller error",
      mopping_roller_error_2: "Mopping roller error",
      clear_water_box_hoare: "Clean water tank abnormal",
      dirty_water_box_hoare: "Dirty water tank abnormal",
      sink_strainer_hoare: "Sink strainer abnormal",
      clear_water_box_exception: "Clean water tank error",
      clear_brush_exception: "Cleaning brush error",
      clear_brush_exception_2: "Cleaning brush error",
      filter_screen_exception: "Filter screen error",
      mopping_roller_2: "Mopping roller error",
      up_water_exception: "Water refill error",
      drain_water_exception: "Water drain error",
      temperature_protection: "Temperature protection",
      clean_carousel_exception: "Cleaning carousel error",
      clean_carousel_water_full: "Cleaning carousel water full",
      water_carriage_drop: "Water carriage dropped",
      check_clean_carouse: "Check cleaning carousel",
      audio_error: "Audio error",
    },
  };

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
        aria: {
          modeTablist: "Modo de limpieza",
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
        locationUnknown: "Ubicación desconocida",
        emptyTitle: "Nodalia Person Card",
        emptyBody: "Configure `entity` to show the card.",
        defaultName: "Persona",
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
          buffering: "Cargando",
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
        deviceStates: {
          on: "Encendido",
          off: "Apagado",
          humidifying: "Humidificando",
          dehumidifying: "Deshumidificando",
          drying: "Secando",
          idle: "En espera",
          unavailable: "No disponible",
          unknown: "Desconocido",
        },
      },
      climateCard: {
        modes: {
          off: "Apagado",
          heat: "Calor",
          cool: "Frío",
          heat_cool: "Calor / frío",
          auto: "Automático",
          dry: "Secado",
          fan_only: "Ventilador",
        },
        actions: {
          heating: "Calentando",
          cooling: "Enfriando",
          drying: "Secando",
          fan: "Ventilando",
          fan_only: "Ventilador",
          idle: "En espera",
          off: "Apagado",
        },
      },
      graphCard: {
        emptyHistory: "Sin historial disponible",
      },
      notificationsCard: {
        fallbackEvent: "Evento",
        allDay: "Todo el día",
        titles: {
          calendarSoon: "Evento pronto",
          calendarToday: "Evento pendiente hoy",
          calendarUnavailable: "Calendario no disponible",
          vacuumAttention: "Robot necesita atencion",
          vacuumPaused: "Robot pausado",
          cleaningStarted: "Limpieza iniciada",
          returningDock: "Robot volviendo a base",
          motionDetected: "Movimiento detectado",
          doorOpen: "Puerta abierta",
          windowOpen: "Ventana abierta",
          hot: "Hace calor",
          cold: "Temperatura baja",
          rainSoon: "Lluvia proxima",
          batteryLow: "Bateria baja",
          humidifierFillLow: "Deposito bajo",
          inkLow: "Tinta baja",
          humidityHigh: "Humedad alta",
          humidityLow: "Humedad baja",
          customFallback: "Notificacion",
        },
        messages: {
          vacuumAttention: "{name} esta en estado {state}.",
          vacuumPaused: "{name} esta pausado o esperando.",
          vacuumState: "{name}: {state}.",
          hot: "{source} marca {value}. Puedes encender {fan}.",
          rainSoon: "{source} preve lluvia sobre {time}. Si tienes ropa tendida, conviene revisarla.",
          lowLevel: "{source} queda en {value}.",
          sensorValue: "{source} marca {value}.",
        },
        actions: {
          openCalendar: "Abrir calendario",
          viewRobot: "Ver robot",
          continue: "Continuar",
          viewSensor: "Ver sensor",
          turnOnFan: "Encender ventilador",
          viewWeather: "Ver tiempo",
          buyBattery: "Comprar pila",
          buyInk: "Comprar tinta",
          run: "Ejecutar",
          toggle: "Alternar",
          open: "Abrir",
          less: "Menos",
        },
        severity: {
          critical: "Critica",
          warning: "Aviso",
          success: "OK",
          info: "Info",
        },
        aria: {
          dismiss: "Borrar notificacion",
          showLess: "Mostrar menos",
          showAll: "Mostrar todas las notificaciones",
        },
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
        aria: {
          modeTablist: "Cleaning mode",
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
        emptyTitle: "Nodalia Person Card",
        emptyBody: "Configure `entity` to show the card.",
        defaultName: "Person",
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
          buffering: "Buffering",
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
        deviceStates: {
          on: "On",
          off: "Off",
          humidifying: "Humidifying",
          dehumidifying: "Dehumidifying",
          drying: "Drying",
          idle: "Idle",
          unavailable: "Unavailable",
          unknown: "Unknown",
        },
      },
      climateCard: {
        modes: {
          off: "Off",
          heat: "Heat",
          cool: "Cool",
          heat_cool: "Heat & cool",
          auto: "Auto",
          dry: "Dry",
          fan_only: "Fan only",
        },
        actions: {
          heating: "Heating",
          cooling: "Cooling",
          drying: "Drying",
          fan: "Fan",
          fan_only: "Fan only",
          idle: "Idle",
          off: "Off",
        },
      },
      graphCard: {
        emptyHistory: "No history available",
      },
      notificationsCard: {
        fallbackEvent: "Event",
        allDay: "All day",
        titles: {
          calendarSoon: "Event soon",
          calendarToday: "Event due today",
          calendarUnavailable: "Calendar unavailable",
          vacuumAttention: "Robot needs attention",
          vacuumPaused: "Robot paused",
          cleaningStarted: "Cleaning started",
          returningDock: "Robot returning to dock",
          motionDetected: "Motion detected",
          doorOpen: "Door open",
          windowOpen: "Window open",
          hot: "It is hot",
          cold: "Low temperature",
          rainSoon: "Rain soon",
          batteryLow: "Low battery",
          humidifierFillLow: "Low tank",
          inkLow: "Low ink",
          humidityHigh: "High humidity",
          humidityLow: "Low humidity",
          customFallback: "Notification",
        },
        messages: {
          vacuumAttention: "{name} is in state {state}.",
          vacuumPaused: "{name} is paused or waiting.",
          vacuumState: "{name}: {state}.",
          hot: "{source} reads {value}. You can turn on {fan}.",
          rainSoon: "{source} expects rain around {time}. If laundry is outside, it is worth checking.",
          lowLevel: "{source} is at {value}.",
          sensorValue: "{source} reads {value}.",
        },
        actions: {
          openCalendar: "Open calendar",
          viewRobot: "View robot",
          continue: "Continue",
          viewSensor: "View sensor",
          turnOnFan: "Turn on fan",
          viewWeather: "View weather",
          buyBattery: "Buy battery",
          buyInk: "Buy ink",
          run: "Run",
          toggle: "Toggle",
          open: "Open",
          less: "Less",
        },
        severity: {
          critical: "Critical",
          warning: "Warning",
          success: "OK",
          info: "Info",
        },
        empty: {
          title: "All quiet",
          message: "You have no current alerts",
        },
        aria: {
          dismiss: "Dismiss notification",
          showLess: "Show less",
          showAll: "Show all notifications",
        },
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
        aria: {
          modeTablist: "Reinigungsmodus",
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
        emptyTitle: "Nodalia Person Card",
        emptyBody: "Lege `entity` fest, um diese Karte anzuzeigen.",
        defaultName: "Person",
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
          buffering: "Puffern",
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
        deviceStates: {
          on: "Ein",
          off: "Aus",
          humidifying: "Befeuchtet",
          dehumidifying: "Entfeuchtet",
          drying: "Trocknet",
          idle: "Leerlauf",
          unavailable: "Nicht verfügbar",
          unknown: "Unbekannt",
        },
      },
      climateCard: {
        modes: {
          off: "Aus",
          heat: "Heizen",
          cool: "Kühlen",
          heat_cool: "Heizen & Kühlen",
          auto: "Auto",
          dry: "Trocknen",
          fan_only: "Nur Lüfter",
        },
        actions: {
          heating: "Heizt",
          cooling: "Kühlt",
          drying: "Trocknet",
          fan: "Lüftet",
          fan_only: "Nur Lüfter",
          idle: "Leerlauf",
          off: "Aus",
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
        aria: {
          modeTablist: "Mode de nettoyage",
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
        emptyTitle: "Nodalia Person Card",
        emptyBody: "Configurez `entity` pour afficher cette carte.",
        defaultName: "Personne",
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
          buffering: "Mise en mémoire tampon",
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
        deviceStates: {
          on: "Allumé",
          off: "Éteint",
          humidifying: "Humidification",
          dehumidifying: "Déshumidification",
          drying: "Séchage",
          idle: "Inactif",
          unavailable: "Indisponible",
          unknown: "Inconnu",
        },
      },
      climateCard: {
        modes: {
          off: "Arrêt",
          heat: "Chauffage",
          cool: "Climatisation",
          heat_cool: "Chaud / froid",
          auto: "Auto",
          dry: "Déshumidification",
          fan_only: "Ventilateur seul",
        },
        actions: {
          heating: "Chauffe",
          cooling: "Refroidit",
          drying: "Déshumidifie",
          fan: "Ventile",
          fan_only: "Ventilateur",
          idle: "Inactif",
          off: "Arrêt",
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
        aria: {
          modeTablist: "Modalità di pulizia",
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
        emptyTitle: "Nodalia Person Card",
        emptyBody: "Imposta `entity` per mostrare questa scheda.",
        defaultName: "Persona",
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
          buffering: "Buffering",
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
        deviceStates: {
          on: "Acceso",
          off: "Spento",
          humidifying: "Umidificazione",
          dehumidifying: "Deumidificazione",
          drying: "Asciugatura",
          idle: "Inattivo",
          unavailable: "Non disponibile",
          unknown: "Sconosciuto",
        },
      },
      climateCard: {
        modes: {
          off: "Spento",
          heat: "Caldo",
          cool: "Freddo",
          heat_cool: "Caldo / freddo",
          auto: "Auto",
          dry: "Deumidificazione",
          fan_only: "Solo ventilatore",
        },
        actions: {
          heating: "Riscalda",
          cooling: "Raffredda",
          drying: "Deumidifica",
          fan: "Ventila",
          fan_only: "Ventilatore",
          idle: "Inattivo",
          off: "Spento",
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
        aria: {
          modeTablist: "Schoonmaakmodus",
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
        emptyTitle: "Nodalia Person Card",
        emptyBody: "Stel `entity` in om deze kaart te tonen.",
        defaultName: "Persoon",
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
          buffering: "Bufferen",
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
        deviceStates: {
          on: "Aan",
          off: "Uit",
          humidifying: "Bevochtigen",
          dehumidifying: "Ontvochtigen",
          drying: "Drogen",
          idle: "Inactief",
          unavailable: "Niet beschikbaar",
          unknown: "Onbekend",
        },
      },
      climateCard: {
        modes: {
          off: "Uit",
          heat: "Verwarmen",
          cool: "Koelen",
          heat_cool: "Verwarmen & koelen",
          auto: "Auto",
          dry: "Ontvochtigen",
          fan_only: "Alleen ventilator",
        },
        actions: {
          heating: "Verwarmt",
          cooling: "Koelt",
          drying: "Ontvochtigt",
          fan: "Ventileert",
          fan_only: "Ventilator",
          idle: "Inactief",
          off: "Uit",
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
    pt: {
      advanceVacuum: {
        modeLabels: {
          all: "Tudo",
          rooms: "Divisões",
          zone: "Zona",
          routines: "Rotinas",
          goto: "Ir ao ponto"
        },
        aria: {
          modeTablist: "Modo de limpeza"
        },
        panelModes: {
          smart: "Inteligente",
          vacuum_mop: "Aspiração e esfregão",
          vacuum: "Aspiração",
          mop: "Esfregão",
          custom: "Personalizado"
        },
        dockSections: {
          control: "Controlo da base",
          settings: "Definições da base"
        },
        dockSettings: {
          mop_wash_frequency: "Frequência de lavagem da esfregona",
          mop_mode: "Modo de esfregão",
          auto_empty_frequency: "Frequência de esvaziamento automático",
          empty_mode: "Modo de esvaziamento",
          drying_duration: "Duração de secagem"
        },
        dockControls: {
          empty: {
            label: "Esvaziar depósito",
            active: "Parar esvaziamento"
          },
          wash: {
            label: "Lavar pano",
            active: "Parar lavagem do pano"
          },
          dry: {
            label: "Secar esfregona",
            active: "Parar secagem"
          }
        },
        vacuumModes: {
          quiet: "Silencioso",
          silent: "Silencioso",
          balanced: "Equilibrado",
          standard: "Padrão",
          normal: "Normal",
          turbo: "Turbo",
          max: "Max",
          maxplus: "Max+",
          max_plus: "Max+",
          gentle: "Suave",
          strong: "Forte",
          smart: "Inteligente",
          smartmode: "Inteligente",
          smart_mode: "Inteligente",
          intelligent: "Inteligente",
          custom: "Personalizado",
          custommode: "Personalizado",
          custom_mode: "Personalizado",
          custom_water_flow: "Caudal de água personalizado",
          custom_watter_flow: "Caudal de água personalizado",
          off: "Sem esfregão",
          low: "Baixa",
          medium: "Média",
          high: "Alta",
          intense: "Intenso",
          deep: "Profundo",
          deep_plus: "Profundo+",
          deepplus: "Profundo+",
          fast: "Rápido",
          rapido: "Rápido"
        },
        offSuction: "Desligado",
        reportedStates: {
          docked: "Na base",
          charging: "A carregar",
          charging_completed: "A carregar",
          cleaning: "A limpar",
          spot_cleaning: "A limpar",
          segment_cleaning: "A limpar",
          room_cleaning: "A limpar",
          zone_cleaning: "A limpar",
          clean_area: "A limpar",
          paused: "Em pausa",
          returning: "A regressar à base",
          return_to_base: "A regressar à base",
          returning_home: "A regressar à base",
          washing: "A lavar esfregonas",
          wash_mop: "A lavar esfregonas",
          washing_mop: "A lavar esfregonas",
          washing_pads: "A lavar esfregonas",
          drying: "A secar",
          drying_mop: "A secar",
          emptying: "Esvaziamento automático",
          self_emptying: "Esvaziamento automático",
          unavailable: "Indisponível",
          unknown: "Desconhecido",
          error: "Erro",
          fallback: "Desconhecido"
        },
        mapStatus: {
          washing_mop: "A lavar a esfregona",
          drying_mop: "A secar a esfregona",
          emptying_dust: "A esvaziar o depósito",
          charging: "A carregar"
        },
        descriptorLabels: {
          suction: "Aspiração",
          mop: "Esfregão",
          mop_mode: "Modo da esfregona"
        },
        utility: {
          cleaningMode: "Modo de limpeza",
          cleaningCounter: "Passagens de limpeza",
          dockActions: "Ações da base",
          chargingStation: "Estação de carga",
          zonesWord: "zonas",
          pointWord: "ponto",
          zoneTool: "Zona",
          routineDefault: "Rotina",
          customMenuDefault: "Base",
          modesFallbackTitle: "Modos de aspiração e esfregão"
        },
        actions: {
          returnToBase: "Regressar à base",
          locate: "Localizar",
          stop: "Parar",
          run: "Executar",
          addZoneToClean: "Adicionar zona à limpeza",
          cleanZone: "Limpar zona"
        },
        handles: {
          moveZone: "Mover zona",
          deleteZone: "Eliminar zona",
          resizeZone: "Redimensionar zona"
        },
        titles: {
          editZone: "Editar zona",
          backPanel: "Voltar ao painel principal",
          addZone: "Adicionar zona",
          gotoFallback: "Ponto"
        }
      },
      vacuumSimple: {
        quiet: "Silencioso",
        silent: "Silencioso",
        balanced: "Equilibrado",
        standard: "Padrão",
        normal: "Normal",
        turbo: "Turbo",
        max: "Max",
        maxplus: "Max+",
        max_plus: "Max+",
        gentle: "Suave",
        strong: "Forte",
        smart: "Inteligente",
        smartmode: "Inteligente",
        smart_mode: "Inteligente",
        intelligent: "Inteligente",
        custom: "Personalizado",
        custommode: "Personalizado",
        custom_mode: "Personalizado",
        custom_water_flow: "Caudal de água personalizado",
        custom_watter_flow: "Caudal de água personalizado",
        off: "Sem esfregão",
        low: "Baixa",
        medium: "Média",
        high: "Alta",
        intense: "Intenso",
        deep: "Profundo"
      },
      navigationMusicAssist: {
        artist: "Artistas",
        artists: "Artistas",
        album: "Álbuns",
        albums: "Álbuns",
        track: "Faixas",
        tracks: "Faixas",
        song: "Faixas",
        songs: "Faixas",
        playlist: "Listas de reprodução",
        playlists: "Listas de reprodução",
        "radio station": "Estações de rádio",
        "radio stations": "Estações de rádio",
        podcast: "Podcasts",
        podcasts: "Podcasts",
        audiobook: "Audiolivros",
        audiobooks: "Audiolivros",
        genre: "Géneros",
        genres: "Géneros",
        favorite: "Favoritos",
        favorites: "Favoritos",
        favourites: "Favoritos",
        search: "Pesquisar",
        "recently played": "Reproduzidos recentemente",
        "recently added": "Adicionados recentemente",
        "recently played tracks": "Faixas ouvidas recentemente",
        browseFallback: "Item",
      },
      weatherCard: {
        conditions: {
          clear_night: "Noite limpa",
          cloudy: "Nublado",
          exceptional: "Excecional",
          fog: "Nevoeiro",
          hail: "Granizo",
          lightning: "Relâmpago",
          lightning_rainy: "Relâmpago e chuva",
          partlycloudy: "Parcialmente nublado",
          pouring: "Chuva forte",
          rainy: "Chuvoso",
          snowy: "Neve",
          snowy_rainy: "Aguaneve",
          sunny: "Sol",
          windy: "Ventoso",
          windy_variant: "Vento variável"
        },
        defaultCondition: "Meteorologia",
        forecast: {
          chartAriaHourly: "Gráfico da previsão horária",
          chartAriaDaily: "Gráfico da previsão semanal",
          tabsAria: "Vista da previsão",
          tabCards: "Cartões",
          tabChart: "Gráfico",
          hoursTab: "Horas",
          weekTab: "Semana",
          emptyHourly: "Sem previsão horária disponível.",
          emptyDaily: "Sem previsão semanal disponível.",
          chartInsufficientData: "Dados insuficientes para o gráfico.",
          closeDetail: "Fechar detalhe",
          maxLabel: "Máx.",
          minLabel: "Mín.",
          temperatureLabel: "Temperatura",
          rainLabel: "Chuva",
          humidityLabel: "Humidade",
          windLabel: "Vento"
        },
        meteoalarm: {
          name: "Meteoalarm",
          alertFallback: "Alerta",
          noAlerts: "Sem alertas",
          weatherAlert: "Alerta meteorológico",
          noWeatherAlerts: "Sem alertas meteorológicos",
          level: "Nível",
          type: "Tipo",
          start: "Início",
          end: "Fim",
          severity: "Gravidade",
          urgency: "Urgência",
          certainty: "Certeza",
          close: "Fechar",
          descriptionTitle: "Descrição",
          instructionsTitle: "Instruções",
          terms: {
            moderate: "Moderado",
            severe: "Grave",
            high: "Alto",
            extreme: "Extremo",
            minor: "Menor",
            yellow: "Amarelo",
            orange: "Laranja",
            red: "Vermelho",
            green: "Verde",
            future: "Futuro",
            immediate: "Imediato",
            expected: "Esperado",
            past: "Passado",
            likely: "Provável",
            observed: "Observado",
            possible: "Possível",
            unlikely: "Improvável",
            unknown: "Desconhecido",
            met: "Meteorológico",
            monitor: "Monitorizar"
          }
        }
      },
      humidifierCard: {
        modes: {
          auto: "Automático",
          automatic: "Automático",
          smart: "Inteligente",
          smart_mode: "Inteligente",
          sleep: "Noite",
          night: "Noite",
          eco: "Eco",
          quiet: "Silencioso",
          silent: "Silencioso",
          low: "Baixa",
          medium: "Média",
          mid: "Média",
          high: "Alta",
          boost: "Boost",
          turbo: "Turbo",
          normal: "Normal",
          balanced: "Normal",
          dry: "Secagem",
          drying: "Secagem",
          continuous: "Contínuo",
          clothes_dry: "Roupa",
          laundry: "Roupa",
        },
        deviceStates: {
          on: "Ligado",
          off: "Desligado",
          humidifying: "Humidificação",
          dehumidifying: "Desumidificação",
          drying: "Secagem",
          idle: "Inativo",
          unavailable: "Indisponível",
          unknown: "Desconhecido",
        },
      },
      climateCard: {
        modes: {
          off: "Desligado",
          heat: "Aquecer",
          cool: "Arrefecer",
          heat_cool: "Aquecer / arrefecer",
          auto: "Automático",
          dry: "Secar",
          fan_only: "Só ventoinha",
        },
        actions: {
          heating: "A aquecer",
          cooling: "A arrefecer",
          drying: "A secar",
          fan: "Ventilação",
          fan_only: "Ventoinha",
          idle: "Inativo",
          off: "Desligado",
        },
      },
      graphCard: {
        emptyHistory: "Sem histórico disponível"
      },
      fan: {
        off: "Desligado",
        on: "Ligado",
        unavailable: "Indisponível",
        unknown: "Desconhecido",
        noState: "Sem estado",
        fallbackName: "Ventoinha"
      },
      alarmPanel: {
        defaultTitle: "Alarme",
        noState: "Sem estado",
        actions: {
          disarm: "Desarmar",
          arm_home: "Casa",
          arm_away: "Ausente",
          arm_night: "Noite",
          arm_vacation: "Férias",
          arm_custom_bypass: "Personalizado"
        },
        states: {
          disarmed: "Desarmado",
          armed_home: "Em casa",
          armed_away: "Ausente",
          armed_night: "Noite",
          armed_vacation: "Férias",
          armed_custom_bypass: "Personalizado",
          armed: "Armado",
          arming: "A armar",
          disarming: "A desarmar",
          pending: "Pendente",
          triggered: "Disparado",
          unavailable: "Indisponível",
          unknown: "Desconhecido"
        }
      },
      person: {
        home: "Em casa",
        notHome: "Fora",
        work: "Trabalho",
        school: "Escola",
        unavailable: "Indisponível",
        unknown: "Desconhecido",
        locationUnknown: "Localização desconhecida",
        emptyTitle: "Nodalia Person Card",
        emptyBody: "Defina `entity` para mostrar este cartão.",
        defaultName: "Pessoa",
      },
      entityCard: {
        binarySensor: {
          doorOpen: "Aberta",
          doorClosed: "Fechada",
          motionOn: "Detetado",
          motionOff: "Não detetado"
        },
        boolean: {
          yes: "Sim",
          no: "Não"
        },
        states: {
          on: "Ligado",
          off: "Desligado",
          open: "Aberto",
          opening: "A abrir",
          closed: "Fechado",
          closing: "A fechar",
          playing: "A reproduzir",
          paused: "Em pausa",
          buffering: "Em buffer",
          idle: "Em espera",
          standby: "Standby",
          home: "Em casa",
          not_home: "Fora",
          detected: "Detetado",
          clear: "Limpo",
          unavailable: "Indisponível",
          unknown: "Desconhecido",
          locked: "Trancado",
          unlocked: "Destrancado",
          locking: "A trancar",
          unlocking: "A destrancar",
          locking_failed: "Falha ao trancar",
          unlocking_failed: "Falha ao destrancar",
          jammed: "Encravado",
          pending: "Pendente",
          stopped: "Parado",
          armed_away: "Armado ausente",
          armed_home: "Armado em casa",
          disarmed: "Desarmado",
          triggered: "Disparado",
          comfortable: "Confortável",
          very_comfortable: "Muito confortável",
          slightly_uncomfortable: "Ligeiramente desconfortável",
          somewhat_uncomfortable: "Algo desconfortável",
          quite_uncomfortable: "Bastante desconfortável",
          extremely_uncomfortable: "Muito desconfortável",
          ok_but_humid: "Aceitável, mas húmido",
          little_or_no_discomfort: "Pouco ou nenhum desconforto",
          some_discomfort: "Algum desconforto",
          great_discomfort_avoid_exertion: "Grande desconforto",
          dangerous_discomfort: "Desconforto perigoso",
          heat_stroke_imminent: "Golpe de calor iminente",
          dry: "Seco",
          very_dry: "Muito seco",
          too_dry: "Demasiado seco",
          humid: "Húmido",
          very_humid: "Muito húmido",
          too_humid: "Demasiado húmido",
          wet: "Molhado",
          low: "Baixo",
          medium: "Médio",
          moderate: "Moderado",
          high: "Alto",
          very_high: "Muito alto",
          severely_high: "Extremamente alto",
          critical: "Crítico",
          excellent: "Excelente",
          good: "Bom",
          fair: "Razoável",
          poor: "Mau"
        }
      },
      favCard: {
        disarmedF: "Desarmada",
        armed_home: "Em casa",
        armed_away: "Ausente",
        armed_night: "Noite",
        armed_vacation: "Férias",
        armed_custom_bypass: "Personalizado",
        arming: "A armar",
        disarming: "A desarmar",
        pending: "Pendente",
        triggered: "Disparado"
      }
    },
    ru: {
      advanceVacuum: {
        modeLabels: {
          all: "Всё",
          rooms: "Комнаты",
          zone: "Зона",
          routines: "Сценарии",
          goto: "К точке"
        },
        aria: {
          modeTablist: "Режим уборки"
        },
        panelModes: {
          smart: "Умный",
          vacuum_mop: "Пылесос и мытьё",
          vacuum: "Пылесос",
          mop: "Мытьё",
          custom: "Свой"
        },
        dockSections: {
          control: "Управление базой",
          settings: "Настройки базы"
        },
        dockSettings: {
          mop_wash_frequency: "Частота промывки швабры",
          mop_mode: "Режим мытья",
          auto_empty_frequency: "Частота самоочистки",
          empty_mode: "Режим опорожнения",
          drying_duration: "Длительность сушки"
        },
        dockControls: {
          empty: {
            label: "Опорожнить контейнер",
            active: "Остановить опорожнение"
          },
          wash: {
            label: "Промыть швабру",
            active: "Остановить промывку"
          },
          dry: {
            label: "Сушить швабру",
            active: "Остановить сушку"
          }
        },
        vacuumModes: {
          quiet: "Тихий",
          silent: "Тихий",
          balanced: "Сбалансированный",
          standard: "Стандарт",
          normal: "Обычный",
          turbo: "Турбо",
          max: "Макс",
          maxplus: "Макс+",
          max_plus: "Макс+",
          gentle: "Мягкий",
          strong: "Сильный",
          smart: "Умный",
          smartmode: "Умный",
          smart_mode: "Умный",
          intelligent: "Умный",
          custom: "Свой",
          custommode: "Свой",
          custom_mode: "Свой",
          custom_water_flow: "Свой расход воды",
          custom_watter_flow: "Свой расход воды",
          off: "Без мытья",
          low: "Низкий",
          medium: "Средний",
          high: "Высокий",
          intense: "Интенсивный",
          deep: "Глубокий",
          deep_plus: "Глубокий+",
          deepplus: "Глубокий+",
          fast: "Быстрый",
          rapido: "Быстрый"
        },
        offSuction: "Выкл.",
        reportedStates: {
          docked: "На базе",
          charging: "Зарядка",
          charging_completed: "Зарядка",
          cleaning: "Уборка",
          spot_cleaning: "Уборка",
          segment_cleaning: "Уборка",
          room_cleaning: "Уборка",
          zone_cleaning: "Уборка",
          clean_area: "Уборка",
          paused: "Пауза",
          returning: "Возврат на базу",
          return_to_base: "Возврат на базу",
          returning_home: "Возврат на базу",
          washing: "Промывка швабры",
          wash_mop: "Промывка швабры",
          washing_mop: "Промывка швабры",
          washing_pads: "Промывка швабры",
          drying: "Сушка",
          drying_mop: "Сушка",
          emptying: "Самоочистка",
          self_emptying: "Самоочистка",
          unavailable: "Недоступно",
          unknown: "Неизвестно",
          error: "Ошибка",
          fallback: "Неизвестно"
        },
        mapStatus: {
          washing_mop: "Промывка швабры",
          drying_mop: "Сушка швабры",
          emptying_dust: "Опорожнение контейнера",
          charging: "Зарядка"
        },
        descriptorLabels: {
          suction: "Пылесос",
          mop: "Мытьё",
          mop_mode: "Режим швабры"
        },
        utility: {
          cleaningMode: "Режим уборки",
          cleaningCounter: "Проходы уборки",
          dockActions: "Действия базы",
          chargingStation: "Зарядная база",
          zonesWord: "зоны",
          pointWord: "точка",
          zoneTool: "Зона",
          routineDefault: "Сценарий",
          customMenuDefault: "База",
          modesFallbackTitle: "Режимы пылесоса и мытья"
        },
        actions: {
          returnToBase: "На базу",
          locate: "Найти",
          stop: "Стоп",
          run: "Пуск",
          addZoneToClean: "Добавить зону к уборке",
          cleanZone: "Убрать зону"
        },
        handles: {
          moveZone: "Переместить зону",
          deleteZone: "Удалить зону",
          resizeZone: "Размер зоны"
        },
        titles: {
          editZone: "Редактировать зону",
          backPanel: "К основной панели",
          addZone: "Добавить зону",
          gotoFallback: "Точка"
        }
      },
      vacuumSimple: {
        quiet: "Тихий",
        silent: "Тихий",
        balanced: "Сбалансированный",
        standard: "Стандарт",
        normal: "Обычный",
        turbo: "Турбо",
        max: "Макс",
        maxplus: "Макс+",
        max_plus: "Макс+",
        gentle: "Мягкий",
        strong: "Сильный",
        smart: "Умный",
        smartmode: "Умный",
        smart_mode: "Умный",
        intelligent: "Умный",
        custom: "Свой",
        custommode: "Свой",
        custom_mode: "Свой",
        custom_water_flow: "Свой расход воды",
        custom_watter_flow: "Свой расход воды",
        off: "Без мытья",
        low: "Низкий",
        medium: "Средний",
        high: "Высокий",
        intense: "Интенсивный",
        deep: "Глубокий"
      },
      navigationMusicAssist: {
        artist: "Артисты",
        artists: "Артисты",
        album: "Альбомы",
        albums: "Альбомы",
        track: "Треки",
        tracks: "Треки",
        song: "Треки",
        songs: "Треки",
        playlist: "Плейлисты",
        playlists: "Плейлисты",
        "radio station": "Радиостанции",
        "radio stations": "Радиостанции",
        podcast: "Подкасты",
        podcasts: "Подкасты",
        audiobook: "Аудиокниги",
        audiobooks: "Аудиокниги",
        genre: "Жанры",
        genres: "Жанры",
        favorite: "Избранное",
        favorites: "Избранное",
        favourites: "Избранное",
        search: "Поиск",
        "recently played": "Недавно воспроизведённые",
        "recently added": "Недавно добавленные",
        "recently played tracks": "Недавно воспроизведённые треки",
        browseFallback: "Элемент",
      },
      weatherCard: {
        conditions: {
          clear_night: "Ясная ночь",
          cloudy: "Облачно",
          exceptional: "Исключительно",
          fog: "Туман",
          hail: "Град",
          lightning: "Молния",
          lightning_rainy: "Гроза с дождём",
          partlycloudy: "Переменная облачность",
          pouring: "Ливень",
          rainy: "Дождь",
          snowy: "Снег",
          snowy_rainy: "Мокрый снег",
          sunny: "Солнечно",
          windy: "Ветрено",
          windy_variant: "Переменный ветер"
        },
        defaultCondition: "Погода",
        forecast: {
          chartAriaHourly: "Почасовой прогноз",
          chartAriaDaily: "Недельный прогноз",
          tabsAria: "Вид прогноза",
          tabCards: "Карточки",
          tabChart: "График",
          hoursTab: "Часы",
          weekTab: "Неделя",
          emptyHourly: "Почасовой прогноз недоступен.",
          emptyDaily: "Недельный прогноз недоступен.",
          chartInsufficientData: "Недостаточно данных для графика.",
          closeDetail: "Закрыть детали",
          maxLabel: "Макс.",
          minLabel: "Мин.",
          temperatureLabel: "Температура",
          rainLabel: "Дождь",
          humidityLabel: "Влажность",
          windLabel: "Ветер"
        },
        meteoalarm: {
          name: "Meteoalarm",
          alertFallback: "Предупреждение",
          noAlerts: "Нет предупреждений",
          weatherAlert: "Погодное предупреждение",
          noWeatherAlerts: "Нет погодных предупреждений",
          level: "Уровень",
          type: "Тип",
          start: "Начало",
          end: "Конец",
          severity: "Серьёзность",
          urgency: "Срочность",
          certainty: "Достоверность",
          close: "Закрыть",
          descriptionTitle: "Описание",
          instructionsTitle: "Инструкции",
          terms: {
            moderate: "Умеренный",
            severe: "Сильный",
            high: "Высокий",
            extreme: "Экстремальный",
            minor: "Низкий",
            yellow: "Жёлтый",
            orange: "Оранжевый",
            red: "Красный",
            green: "Зелёный",
            future: "Будущее",
            immediate: "Немедленно",
            expected: "Ожидается",
            past: "Прошлое",
            likely: "Вероятно",
            observed: "Наблюдается",
            possible: "Возможно",
            unlikely: "Маловероятно",
            unknown: "Неизвестно",
            met: "Метеорологический",
            monitor: "Мониторинг"
          }
        }
      },
      humidifierCard: {
        modes: {
          auto: "Авто",
          automatic: "Авто",
          smart: "Умный",
          smart_mode: "Умный",
          sleep: "Ночь",
          night: "Ночь",
          eco: "Эко",
          quiet: "Тихий",
          silent: "Тихий",
          low: "Низкий",
          medium: "Средний",
          mid: "Средний",
          high: "Высокий",
          boost: "Boost",
          turbo: "Турбо",
          normal: "Обычный",
          balanced: "Обычный",
          dry: "Сушка",
          drying: "Сушка",
          continuous: "Непрерывно",
          clothes_dry: "Бельё",
          laundry: "Бельё",
        },
        deviceStates: {
          on: "Вкл.",
          off: "Выкл.",
          humidifying: "Увлажнение",
          dehumidifying: "Осушение",
          drying: "Сушка",
          idle: "Ожидание",
          unavailable: "Недоступно",
          unknown: "Неизвестно",
        },
      },
      climateCard: {
        modes: {
          off: "Выкл.",
          heat: "Обогрев",
          cool: "Охлаждение",
          heat_cool: "Обогрев и охлаждение",
          auto: "Авто",
          dry: "Осушение",
          fan_only: "Только вентилятор",
        },
        actions: {
          heating: "Обогрев",
          cooling: "Охлаждение",
          drying: "Осушение",
          fan: "Вентиляция",
          fan_only: "Вентилятор",
          idle: "Ожидание",
          off: "Выкл.",
        },
      },
      graphCard: {
        emptyHistory: "История недоступна"
      },
      fan: {
        off: "Выкл.",
        on: "Вкл.",
        unavailable: "Недоступно",
        unknown: "Неизвестно",
        noState: "Нет состояния",
        fallbackName: "Вентилятор"
      },
      alarmPanel: {
        defaultTitle: "Сигнализация",
        noState: "Нет состояния",
        actions: {
          disarm: "Снять",
          arm_home: "Дома",
          arm_away: "Нет дома",
          arm_night: "Ночь",
          arm_vacation: "Отпуск",
          arm_custom_bypass: "Свой режим"
        },
        states: {
          disarmed: "Снята",
          armed_home: "Дома",
          armed_away: "Нет дома",
          armed_night: "Ночь",
          armed_vacation: "Отпуск",
          armed_custom_bypass: "Свой режим",
          armed: "Включена",
          arming: "Включение",
          disarming: "Выключение",
          pending: "Ожидание",
          triggered: "Сработала",
          unavailable: "Недоступно",
          unknown: "Неизвестно"
        }
      },
      person: {
        home: "Дома",
        notHome: "Не дома",
        work: "Работа",
        school: "Школа",
        unavailable: "Недоступно",
        unknown: "Неизвестно",
        locationUnknown: "Местоположение неизвестно",
        emptyTitle: "Nodalia Person Card",
        emptyBody: "Укажите `entity`, чтобы показать эту карточку.",
        defaultName: "Человек",
      },
      entityCard: {
        binarySensor: {
          doorOpen: "Открыта",
          doorClosed: "Закрыта",
          motionOn: "Обнаружено",
          motionOff: "Нет движения"
        },
        boolean: {
          yes: "Да",
          no: "Нет"
        },
        states: {
          on: "Вкл.",
          off: "Выкл.",
          open: "Открыто",
          opening: "Открывается",
          closed: "Закрыто",
          closing: "Закрывается",
          playing: "Воспроизведение",
          paused: "Пауза",
          buffering: "Буферизация",
          idle: "Ожидание",
          standby: "Ожидание",
          home: "Дома",
          not_home: "Не дома",
          detected: "Обнаружено",
          clear: "Норма",
          unavailable: "Недоступно",
          unknown: "Неизвестно",
          locked: "Заперто",
          unlocked: "Открыто",
          locking: "Запирание",
          unlocking: "Отпирание",
          locking_failed: "Ошибка запирания",
          unlocking_failed: "Ошибка отпирания",
          jammed: "Заклинило",
          pending: "Ожидание",
          stopped: "Остановлено",
          armed_away: "Включена (нет дома)",
          armed_home: "Включена (дома)",
          disarmed: "Снята",
          triggered: "Сработала",
          comfortable: "Комфортно",
          very_comfortable: "Очень комфортно",
          slightly_uncomfortable: "Немного некомфортно",
          somewhat_uncomfortable: "Некомфортно",
          quite_uncomfortable: "Довольно некомфортно",
          extremely_uncomfortable: "Очень некомфортно",
          ok_but_humid: "Нормально, но влажно",
          little_or_no_discomfort: "Нет дискомфорта",
          some_discomfort: "Есть дискомфорт",
          great_discomfort_avoid_exertion: "Сильный дискомфорт",
          dangerous_discomfort: "Опасный дискомфорт",
          heat_stroke_imminent: "Угроза теплового удара",
          dry: "Сухо",
          very_dry: "Очень сухо",
          too_dry: "Слишком сухо",
          humid: "Влажно",
          very_humid: "Очень влажно",
          too_humid: "Слишком влажно",
          wet: "Мокро",
          low: "Низкий",
          medium: "Средний",
          moderate: "Умеренный",
          high: "Высокий",
          very_high: "Очень высокий",
          severely_high: "Критически высокий",
          critical: "Критично",
          excellent: "Отлично",
          good: "Хорошо",
          fair: "Удовлетворительно",
          poor: "Плохо"
        }
      },
      favCard: {
        disarmedF: "Снята",
        armed_home: "Дома",
        armed_away: "Нет дома",
        armed_night: "Ночь",
        armed_vacation: "Отпуск",
        armed_custom_bypass: "Свой режим",
        arming: "Включение",
        disarming: "Выключение",
        pending: "Ожидание",
        triggered: "Сработала"
      }
    },
    el: {
      advanceVacuum: {
        modeLabels: {
          all: "Όλα",
          rooms: "Δωμάτια",
          zone: "Ζώνη",
          routines: "Ρουτίνες",
          goto: "Μετάβαση σε σημείο"
        },
        aria: {
          modeTablist: "Λειτουργία καθαρισμού"
        },
        panelModes: {
          smart: "Έξυπνο",
          vacuum_mop: "Σκούπισμα και σφουγγάρισμα",
          vacuum: "Σκούπισμα",
          mop: "Σφουγγάρισμα",
          custom: "Προσαρμοσμένο"
        },
        dockSections: {
          control: "Έλεγχος βάσης",
          settings: "Ρυθμίσεις βάσης"
        },
        dockSettings: {
          mop_wash_frequency: "Συχνότητα πλύσης πανιού",
          mop_mode: "Λειτουργία σφουγγαρίσματος",
          auto_empty_frequency: "Συχνότητα αυτόματου αδειάσματος",
          empty_mode: "Λειτουργία αδειάσματος",
          drying_duration: "Διάρκεια στεγνώματος"
        },
        dockControls: {
          empty: {
            label: "Άδειασμα δοχείου",
            active: "Διακοπή αδειάσματος"
          },
          wash: {
            label: "Πλύση πανιού",
            active: "Διακοπή πλύσης"
          },
          dry: {
            label: "Στέγνωμα πανιού",
            active: "Διακοπή στεγνώματος"
          }
        },
        vacuumModes: {
          quiet: "Ήσυχο",
          silent: "Ήσυχο",
          balanced: "Ισορροπημένο",
          standard: "Τυπικό",
          normal: "Κανονικό",
          turbo: "Turbo",
          max: "Μέγιστο",
          maxplus: "Μέγιστο+",
          max_plus: "Μέγιστο+",
          gentle: "Ήπιο",
          strong: "Δυνατό",
          smart: "Έξυπνο",
          smartmode: "Έξυπνο",
          smart_mode: "Έξυπνο",
          intelligent: "Έξυπνο",
          custom: "Προσαρμοσμένο",
          custommode: "Προσαρμοσμένο",
          custom_mode: "Προσαρμοσμένο",
          custom_water_flow: "Προσαρμοσμένη ροή νερού",
          custom_watter_flow: "Προσαρμοσμένη ροή νερού",
          off: "Χωρίς σφουγγάρισμα",
          low: "Χαμηλό",
          medium: "Μέτριο",
          high: "Υψηλό",
          intense: "Έντονο",
          deep: "Βαθύ",
          deep_plus: "Βαθύ+",
          deepplus: "Βαθύ+",
          fast: "Γρήγορο",
          rapido: "Γρήγορο"
        },
        offSuction: "Ανενεργό",
        reportedStates: {
          docked: "Στη βάση",
          charging: "Φόρτιση",
          charging_completed: "Φόρτιση",
          cleaning: "Καθαρισμός",
          spot_cleaning: "Καθαρισμός",
          segment_cleaning: "Καθαρισμός",
          room_cleaning: "Καθαρισμός",
          zone_cleaning: "Καθαρισμός",
          clean_area: "Καθαρισμός",
          paused: "Παύση",
          returning: "Επιστροφή στη βάση",
          return_to_base: "Επιστροφή στη βάση",
          returning_home: "Επιστροφή στη βάση",
          washing: "Πλύση πανιού",
          wash_mop: "Πλύση πανιού",
          washing_mop: "Πλύση πανιού",
          washing_pads: "Πλύση πανιού",
          drying: "Στέγνωμα",
          drying_mop: "Στέγνωμα",
          emptying: "Αυτόματο άδειασμα",
          self_emptying: "Αυτόματο άδειασμα",
          unavailable: "Μη διαθέσιμο",
          unknown: "Άγνωστο",
          error: "Σφάλμα",
          fallback: "Άγνωστο"
        },
        mapStatus: {
          washing_mop: "Πλύση πανιού",
          drying_mop: "Στέγνωμα πανιού",
          emptying_dust: "Άδειασμα δοχείου σκόνης",
          charging: "Φόρτιση"
        },
        descriptorLabels: {
          suction: "Σκούπισμα",
          mop: "Σφουγγάρισμα",
          mop_mode: "Λειτουργία πανιού"
        },
        utility: {
          cleaningMode: "Λειτουργία καθαρισμού",
          cleaningCounter: "Διαβάσεις καθαρισμού",
          dockActions: "Ενέργειες βάσης",
          chargingStation: "Σταθμός φόρτισης",
          zonesWord: "ζώνες",
          pointWord: "σημείο",
          zoneTool: "Ζώνη",
          routineDefault: "Ρουτίνα",
          customMenuDefault: "Βάση",
          modesFallbackTitle: "Λειτουργίες σκουπίσματος και σφουγγαρίσματος"
        },
        actions: {
          returnToBase: "Επιστροφή στη βάση",
          locate: "Εντοπισμός",
          stop: "Διακοπή",
          run: "Εκτέλεση",
          addZoneToClean: "Προσθήκη ζώνης στον καθαρισμό",
          cleanZone: "Καθαρισμός ζώνης"
        },
        handles: {
          moveZone: "Μετακίνηση ζώνης",
          deleteZone: "Διαγραφή ζώνης",
          resizeZone: "Αλλαγή μεγέθους ζώνης"
        },
        titles: {
          editZone: "Επεξεργασία ζώνης",
          backPanel: "Πίσω στο κύριο πάνελ",
          addZone: "Προσθήκη ζώνης",
          gotoFallback: "Σημείο"
        }
      },
      vacuumSimple: {
        quiet: "Ήσυχο",
        silent: "Ήσυχο",
        balanced: "Ισορροπημένο",
        standard: "Τυπικό",
        normal: "Κανονικό",
        turbo: "Turbo",
        max: "Μέγιστο",
        maxplus: "Μέγιστο+",
        max_plus: "Μέγιστο+",
        gentle: "Ήπιο",
        strong: "Δυνατό",
        smart: "Έξυπνο",
        smartmode: "Έξυπνο",
        smart_mode: "Έξυπνο",
        intelligent: "Έξυπνο",
        custom: "Προσαρμοσμένο",
        custommode: "Προσαρμοσμένο",
        custom_mode: "Προσαρμοσμένο",
        custom_water_flow: "Προσαρμοσμένη ροή νερού",
        custom_watter_flow: "Προσαρμοσμένη ροή νερού",
        off: "Χωρίς σφουγγάρισμα",
        low: "Χαμηλό",
        medium: "Μέτριο",
        high: "Υψηλό",
        intense: "Έντονο",
        deep: "Βαθύ"
      },
      navigationMusicAssist: {
        artist: "Καλλιτέχνες",
        artists: "Καλλιτέχνες",
        album: "Άλμπουμ",
        albums: "Άλμπουμ",
        track: "Κομμάτια",
        tracks: "Κομμάτια",
        song: "Κομμάτια",
        songs: "Κομμάτια",
        playlist: "Λίστες αναπαραγωγής",
        playlists: "Λίστες αναπαραγωγής",
        "radio station": "Ραδιοφωνικοί σταθμοί",
        "radio stations": "Ραδιοφωνικοί σταθμοί",
        podcast: "Podcasts",
        podcasts: "Podcasts",
        audiobook: "Ακουστικά βιβλία",
        audiobooks: "Ακουστικά βιβλία",
        genre: "Είδη",
        genres: "Είδη",
        favorite: "Αγαπημένα",
        favorites: "Αγαπημένα",
        favourites: "Αγαπημένα",
        search: "Αναζήτηση",
        "recently played": "Πρόσφατη αναπαραγωγή",
        "recently added": "Πρόσφατα προστέθηκαν",
        "recently played tracks": "Πρόσφατα κομμάτια",
        browseFallback: "Στοιχείο",
      },
      weatherCard: {
        conditions: {
          clear_night: "Καθαρή νύχτα",
          cloudy: "Νεφελώδης",
          exceptional: "Εξαιρετικές συνθήκες",
          fog: "Ομίχλη",
          hail: "Χαλάζι",
          lightning: "Κεραυνός",
          lightning_rainy: "Καταιγίδα με βροχή",
          partlycloudy: "Μερικώς νεφελώδης",
          pouring: "Ισχυρή βροχή",
          rainy: "Βροχερός",
          snowy: "Χιονισμένος",
          snowy_rainy: "Χιονόνερο",
          sunny: "Ηλιόλουστος",
          windy: "Ανεμώδης",
          windy_variant: "Μεταβλητός άνεμος"
        },
        defaultCondition: "Καιρός",
        forecast: {
          chartAriaHourly: "Ωριαίο γράφημα πρόγνωσης",
          chartAriaDaily: "Εβδομαδιαίο γράφημα πρόγνωσης",
          tabsAria: "Προβολή πρόγνωσης",
          tabCards: "Κάρτες",
          tabChart: "Γράφημα",
          hoursTab: "Ώρες",
          weekTab: "Εβδομάδα",
          emptyHourly: "Δεν υπάρχει ωριαία πρόγνωση.",
          emptyDaily: "Δεν υπάρχει εβδομαδιαία πρόγνωση.",
          chartInsufficientData: "Ανεπαρκή δεδομένα για το γράφημα.",
          closeDetail: "Κλείσιμο λεπτομερειών",
          maxLabel: "Μέγ.",
          minLabel: "Ελάχ.",
          temperatureLabel: "Θερμοκρασία",
          rainLabel: "Βροχή",
          humidityLabel: "Υγρασία",
          windLabel: "Άνεμος"
        },
        meteoalarm: {
          name: "Meteoalarm",
          alertFallback: "Ειδοποίηση",
          noAlerts: "Χωρίς ειδοποιήσεις",
          weatherAlert: "Μετεωρολογική ειδοποίηση",
          noWeatherAlerts: "Χωρίς μετεωρολογικές ειδοποιήσεις",
          level: "Επίπεδο",
          type: "Τύπος",
          start: "Έναρξη",
          end: "Λήξη",
          severity: "Σοβαρότητα",
          urgency: "Επείγον",
          certainty: "Βεβαιότητα",
          close: "Κλείσιμο",
          descriptionTitle: "Περιγραφή",
          instructionsTitle: "Οδηγίες",
          terms: {
            moderate: "Μέτριο",
            severe: "Σοβαρό",
            high: "Υψηλό",
            extreme: "Ακραίο",
            minor: "Μικρό",
            yellow: "Κίτρινο",
            orange: "Πορτοκαλί",
            red: "Κόκκινο",
            green: "Πράσινο",
            future: "Μελλοντικό",
            immediate: "Άμεσο",
            expected: "Αναμενόμενο",
            past: "Παρελθόν",
            likely: "Πιθανό",
            observed: "Παρατηρήθηκε",
            possible: "Πιθανό",
            unlikely: "Απίθανο",
            unknown: "Άγνωστο",
            met: "Μετεωρολογικό",
            monitor: "Παρακολούθηση"
          }
        }
      },
      humidifierCard: {
        modes: {
          auto: "Αυτόματο",
          automatic: "Αυτόματο",
          smart: "Έξυπνο",
          smart_mode: "Έξυπνο",
          sleep: "Νύχτα",
          night: "Νύχτα",
          eco: "Eco",
          quiet: "Ήσυχο",
          silent: "Ήσυχο",
          low: "Χαμηλό",
          medium: "Μέτριο",
          mid: "Μέτριο",
          high: "Υψηλό",
          boost: "Boost",
          turbo: "Turbo",
          normal: "Κανονικό",
          balanced: "Κανονικό",
          dry: "Στέγνωμα",
          drying: "Στέγνωμα",
          continuous: "Συνεχές",
          clothes_dry: "Ρούχα",
          laundry: "Ρούχα",
        },
        deviceStates: {
          on: "Ενεργό",
          off: "Ανενεργό",
          humidifying: "Υγρασία",
          dehumidifying: "Αφυγρανση",
          drying: "Στέγνωμα",
          idle: "Αδράνεια",
          unavailable: "Μη διαθέσιμο",
          unknown: "Άγνωστο",
        },
      },
      climateCard: {
        modes: {
          off: "Ανενεργό",
          heat: "Θέρμανση",
          cool: "Ψύξη",
          heat_cool: "Θέρμανση / ψύξη",
          auto: "Αυτόματο",
          dry: "Αφυγρανση",
          fan_only: "Μόνο ανεμιστήρας",
        },
        actions: {
          heating: "Θερμαίνει",
          cooling: "Ψύχει",
          drying: "Αφυγραίνει",
          fan: "Αερισμός",
          fan_only: "Ανεμιστήρας",
          idle: "Αδράνεια",
          off: "Ανενεργό",
        },
      },
      graphCard: {
        emptyHistory: "Δεν υπάρχει διαθέσιμο ιστορικό"
      },
      fan: {
        off: "Ανενεργό",
        on: "Ενεργό",
        unavailable: "Μη διαθέσιμο",
        unknown: "Άγνωστο",
        noState: "Χωρίς κατάσταση",
        fallbackName: "Ανεμιστήρας"
      },
      alarmPanel: {
        defaultTitle: "Συναγερμός",
        noState: "Χωρίς κατάσταση",
        actions: {
          disarm: "Αφόπλιση",
          arm_home: "Σπίτι",
          arm_away: "Εκτός",
          arm_night: "Νύχτα",
          arm_vacation: "Διακοπές",
          arm_custom_bypass: "Προσαρμοσμένο"
        },
        states: {
          disarmed: "Αφοπλισμένο",
          armed_home: "Σπίτι",
          armed_away: "Εκτός",
          armed_night: "Νύχτα",
          armed_vacation: "Διακοπές",
          armed_custom_bypass: "Προσαρμοσμένο",
          armed: "Οπλισμένο",
          arming: "Οπλισμός",
          disarming: "Αφόπλιση",
          pending: "Εκκρεμεί",
          triggered: "Ενεργοποιήθηκε",
          unavailable: "Μη διαθέσιμο",
          unknown: "Άγνωστο"
        }
      },
      person: {
        home: "Σπίτι",
        notHome: "Εκτός",
        work: "Δουλειά",
        school: "Σχολείο",
        unavailable: "Μη διαθέσιμο",
        unknown: "Άγνωστο",
        locationUnknown: "Άγνωστη τοποθεσία",
        emptyTitle: "Nodalia Person Card",
        emptyBody: "Ορίστε `entity` για να εμφανιστεί αυτή η κάρτα.",
        defaultName: "Άτομο",
      },
      entityCard: {
        binarySensor: {
          doorOpen: "Ανοιχτή",
          doorClosed: "Κλειστή",
          motionOn: "Ανιχνεύθηκε",
          motionOff: "Καθαρό"
        },
        boolean: {
          yes: "Ναι",
          no: "Όχι"
        },
        states: {
          on: "Ενεργό",
          off: "Ανενεργό",
          open: "Ανοιχτό",
          opening: "Ανοίγει",
          closed: "Κλειστό",
          closing: "Κλείνει",
          playing: "Αναπαραγωγή",
          paused: "Παύση",
          buffering: "Ροή σε ενδιάμεση μνήμη",
          idle: "Αδράνεια",
          standby: "Αναμονή",
          home: "Σπίτι",
          not_home: "Εκτός",
          detected: "Ανιχνεύθηκε",
          clear: "Καθαρό",
          unavailable: "Μη διαθέσιμο",
          unknown: "Άγνωστο",
          locked: "Κλειδωμένο",
          unlocked: "Ξεκλείδωτο",
          locking: "Κλείδωμα",
          unlocking: "Ξεκλείδωμα",
          locking_failed: "Αποτυχία κλειδώματος",
          unlocking_failed: "Αποτυχία ξεκλειδώματος",
          jammed: "Κολλημένο",
          pending: "Εκκρεμεί",
          stopped: "Σταματημένο",
          armed_away: "Οπλισμένο εκτός",
          armed_home: "Οπλισμένο σπίτι",
          disarmed: "Αφοπλισμένο",
          triggered: "Ενεργοποιήθηκε",
          comfortable: "Άνετο",
          very_comfortable: "Πολύ άνετο",
          slightly_uncomfortable: "Ελαφρώς άβολο",
          somewhat_uncomfortable: "Κάπως άβολο",
          quite_uncomfortable: "Αρκετά άβολο",
          extremely_uncomfortable: "Εξαιρετικά άβολο",
          ok_but_humid: "Εντάξει, αλλά υγρό",
          little_or_no_discomfort: "Ελάχιστη ενόχληση",
          some_discomfort: "Κάποια ενόχληση",
          great_discomfort_avoid_exertion: "Μεγάλη ενόχληση",
          dangerous_discomfort: "Επικίνδυνη ενόχληση",
          heat_stroke_imminent: "Κίνδυνος θερμοπληξίας",
          dry: "Ξηρό",
          very_dry: "Πολύ ξηρό",
          too_dry: "Πολύ ξηρό",
          humid: "Υγρό",
          very_humid: "Πολύ υγρό",
          too_humid: "Πολύ υγρό",
          wet: "Βρεγμένο",
          low: "Χαμηλό",
          medium: "Μέτριο",
          moderate: "Μέτριο",
          high: "Υψηλό",
          very_high: "Πολύ υψηλό",
          severely_high: "Εξαιρετικά υψηλό",
          critical: "Κρίσιμο",
          excellent: "Εξαιρετικό",
          good: "Καλό",
          fair: "Μέτριο",
          poor: "Κακό"
        }
      },
      favCard: {
        disarmedF: "Αφοπλισμένο",
        armed_home: "Σπίτι",
        armed_away: "Εκτός",
        armed_night: "Νύχτα",
        armed_vacation: "Διακοπές",
        armed_custom_bypass: "Προσαρμοσμένο",
        arming: "Οπλισμός",
        disarming: "Αφόπλιση",
        pending: "Εκκρεμεί",
        triggered: "Ενεργοποιήθηκε"
      }
    },
    zh: {
      advanceVacuum: {
        modeLabels: {
          all: "全部",
          rooms: "房间",
          zone: "区域",
          routines: "例行程序",
          goto: "前往点"
        },
        aria: {
          modeTablist: "清洁模式"
        },
        panelModes: {
          smart: "智能",
          vacuum_mop: "吸尘与拖地",
          vacuum: "吸尘",
          mop: "拖地",
          custom: "自定义"
        },
        dockSections: {
          control: "基站控制",
          settings: "基站设置"
        },
        dockSettings: {
          mop_wash_frequency: "拖布清洗频率",
          mop_mode: "拖地模式",
          auto_empty_frequency: "自动集尘频率",
          empty_mode: "清空模式",
          drying_duration: "烘干时长"
        },
        dockControls: {
          empty: {
            label: "清空尘盒",
            active: "停止清空"
          },
          wash: {
            label: "清洗拖布",
            active: "停止清洗"
          },
          dry: {
            label: "烘干拖布",
            active: "停止烘干"
          }
        },
        vacuumModes: {
          quiet: "安静",
          silent: "安静",
          balanced: "均衡",
          standard: "标准",
          normal: "正常",
          turbo: "Turbo",
          max: "最大",
          maxplus: "最大+",
          max_plus: "最大+",
          gentle: "轻柔",
          strong: "强力",
          smart: "智能",
          smartmode: "智能",
          smart_mode: "智能",
          intelligent: "智能",
          custom: "自定义",
          custommode: "自定义",
          custom_mode: "自定义",
          custom_water_flow: "自定义水量",
          custom_watter_flow: "自定义水量",
          off: "关闭拖地",
          low: "低",
          medium: "中",
          high: "高",
          intense: "强力",
          deep: "深度",
          deep_plus: "深度+",
          deepplus: "深度+",
          fast: "快速",
          rapido: "快速"
        },
        offSuction: "关闭",
        reportedStates: {
          docked: "在基站",
          charging: "充电中",
          charging_completed: "充电中",
          cleaning: "清扫中",
          spot_cleaning: "清扫中",
          segment_cleaning: "清扫中",
          room_cleaning: "清扫中",
          zone_cleaning: "清扫中",
          clean_area: "清扫中",
          paused: "已暂停",
          returning: "返回基站",
          return_to_base: "返回基站",
          returning_home: "返回基站",
          washing: "清洗拖布",
          wash_mop: "清洗拖布",
          washing_mop: "清洗拖布",
          washing_pads: "清洗拖布",
          drying: "烘干中",
          drying_mop: "烘干中",
          emptying: "自动集尘",
          self_emptying: "自动集尘",
          unavailable: "不可用",
          unknown: "未知",
          error: "错误",
          fallback: "未知"
        },
        mapStatus: {
          washing_mop: "清洗拖布",
          drying_mop: "烘干拖布",
          emptying_dust: "清空尘盒",
          charging: "充电中"
        },
        descriptorLabels: {
          suction: "吸尘",
          mop: "拖地",
          mop_mode: "拖布模式"
        },
        utility: {
          cleaningMode: "清洁模式",
          cleaningCounter: "清洁次数",
          dockActions: "基站操作",
          chargingStation: "充电座",
          zonesWord: "区域",
          pointWord: "点",
          zoneTool: "区域",
          routineDefault: "例行程序",
          customMenuDefault: "基站",
          modesFallbackTitle: "吸尘与拖地模式"
        },
        actions: {
          returnToBase: "返回基站",
          locate: "定位",
          stop: "停止",
          run: "开始",
          addZoneToClean: "添加清扫区域",
          cleanZone: "清扫区域"
        },
        handles: {
          moveZone: "移动区域",
          deleteZone: "删除区域",
          resizeZone: "调整区域大小"
        },
        titles: {
          editZone: "编辑区域",
          backPanel: "返回主面板",
          addZone: "添加区域",
          gotoFallback: "点"
        }
      },
      vacuumSimple: {
        quiet: "安静",
        silent: "安静",
        balanced: "均衡",
        standard: "标准",
        normal: "正常",
        turbo: "Turbo",
        max: "最大",
        maxplus: "最大+",
        max_plus: "最大+",
        gentle: "轻柔",
        strong: "强力",
        smart: "智能",
        smartmode: "智能",
        smart_mode: "智能",
        intelligent: "智能",
        custom: "自定义",
        custommode: "自定义",
        custom_mode: "自定义",
        custom_water_flow: "自定义水量",
        custom_watter_flow: "自定义水量",
        off: "关闭拖地",
        low: "低",
        medium: "中",
        high: "高",
        intense: "强力",
        deep: "深度"
      },
      navigationMusicAssist: {
        artist: "艺术家",
        artists: "艺术家",
        album: "专辑",
        albums: "专辑",
        track: "曲目",
        tracks: "曲目",
        song: "曲目",
        songs: "曲目",
        playlist: "播放列表",
        playlists: "播放列表",
        "radio station": "广播电台",
        "radio stations": "广播电台",
        podcast: "播客",
        podcasts: "播客",
        audiobook: "有声书",
        audiobooks: "有声书",
        genre: "流派",
        genres: "流派",
        favorite: "收藏",
        favorites: "收藏",
        favourites: "收藏",
        search: "搜索",
        "recently played": "最近播放",
        "recently added": "最近添加",
        "recently played tracks": "最近播放的曲目",
        browseFallback: "项目",
      },
      weatherCard: {
        conditions: {
          clear_night: "晴朗夜晚",
          cloudy: "多云",
          exceptional: "异常",
          fog: "雾",
          hail: "冰雹",
          lightning: "雷电",
          lightning_rainy: "雷雨",
          partlycloudy: "局部多云",
          pouring: "大雨",
          rainy: "雨",
          snowy: "雪",
          snowy_rainy: "雨夹雪",
          sunny: "晴",
          windy: "大风",
          windy_variant: "风力变化"
        },
        defaultCondition: "天气",
        forecast: {
          chartAriaHourly: "逐小时预报图",
          chartAriaDaily: "一周预报图",
          tabsAria: "预报视图",
          tabCards: "卡片",
          tabChart: "图表",
          hoursTab: "小时",
          weekTab: "周",
          emptyHourly: "暂无逐小时预报。",
          emptyDaily: "暂无一周预报。",
          chartInsufficientData: "数据不足，无法显示图表。",
          closeDetail: "关闭详情",
          maxLabel: "最高",
          minLabel: "最低",
          temperatureLabel: "温度",
          rainLabel: "降雨",
          humidityLabel: "湿度",
          windLabel: "风力"
        },
        meteoalarm: {
          name: "Meteoalarm",
          alertFallback: "警报",
          noAlerts: "无警报",
          weatherAlert: "天气警报",
          noWeatherAlerts: "无天气警报",
          level: "级别",
          type: "类型",
          start: "开始",
          end: "结束",
          severity: "严重程度",
          urgency: "紧急程度",
          certainty: "确定性",
          close: "关闭",
          descriptionTitle: "描述",
          instructionsTitle: "说明",
          terms: {
            moderate: "中度",
            severe: "严重",
            high: "高",
            extreme: "极端",
            minor: "轻微",
            yellow: "黄色",
            orange: "橙色",
            red: "红色",
            green: "绿色",
            future: "未来",
            immediate: "立即",
            expected: "预计",
            past: "过去",
            likely: "可能",
            observed: "已观测",
            possible: "可能",
            unlikely: "不太可能",
            unknown: "未知",
            met: "气象",
            monitor: "监测"
          }
        }
      },
      humidifierCard: {
        modes: {
          auto: "自动",
          automatic: "自动",
          smart: "智能",
          smart_mode: "智能",
          sleep: "夜间",
          night: "夜间",
          eco: "节能",
          quiet: "静音",
          silent: "静音",
          low: "低",
          medium: "中",
          mid: "中",
          high: "高",
          boost: "强力",
          turbo: "涡轮",
          normal: "正常",
          balanced: "正常",
          dry: "烘干",
          drying: "烘干",
          continuous: "连续",
          clothes_dry: "衣物",
          laundry: "衣物",
        },
        deviceStates: {
          on: "开启",
          off: "关闭",
          humidifying: "加湿",
          dehumidifying: "除湿",
          drying: "烘干",
          idle: "空闲",
          unavailable: "不可用",
          unknown: "未知",
        },
      },
      climateCard: {
        modes: {
          off: "关闭",
          heat: "制热",
          cool: "制冷",
          heat_cool: "制热 / 制冷",
          auto: "自动",
          dry: "除湿",
          fan_only: "送风",
        },
        actions: {
          heating: "制热中",
          cooling: "制冷中",
          drying: "除湿中",
          fan: "送风",
          fan_only: "送风",
          idle: "空闲",
          off: "关闭",
        },
      },
      graphCard: {
        emptyHistory: "暂无历史数据"
      },
      fan: {
        off: "关",
        on: "开",
        unavailable: "不可用",
        unknown: "未知",
        noState: "无状态",
        fallbackName: "风扇"
      },
      alarmPanel: {
        defaultTitle: "报警",
        noState: "无状态",
        actions: {
          disarm: "撤防",
          arm_home: "在家",
          arm_away: "离家",
          arm_night: "夜间",
          arm_vacation: "度假",
          arm_custom_bypass: "自定义"
        },
        states: {
          disarmed: "已撤防",
          armed_home: "在家布防",
          armed_away: "离家布防",
          armed_night: "夜间布防",
          armed_vacation: "度假布防",
          armed_custom_bypass: "自定义布防",
          armed: "已布防",
          arming: "布防中",
          disarming: "撤防中",
          pending: "等待",
          triggered: "已触发",
          unavailable: "不可用",
          unknown: "未知"
        }
      },
      person: {
        home: "在家",
        notHome: "外出",
        work: "工作",
        school: "学校",
        unavailable: "不可用",
        unknown: "未知",
        locationUnknown: "位置未知",
        emptyTitle: "Nodalia Person Card",
        emptyBody: "设置 `entity` 以显示此卡片。",
        defaultName: "人员",
      },
      entityCard: {
        binarySensor: {
          doorOpen: "开启",
          doorClosed: "关闭",
          motionOn: "检测到",
          motionOff: "未检测到"
        },
        boolean: {
          yes: "是",
          no: "否"
        },
        states: {
          on: "开",
          off: "关",
          open: "打开",
          opening: "正在打开",
          closed: "关闭",
          closing: "正在关闭",
          playing: "播放中",
          paused: "暂停",
          buffering: "缓冲中",
          idle: "空闲",
          standby: "待机",
          home: "在家",
          not_home: "外出",
          detected: "检测到",
          clear: "正常",
          unavailable: "不可用",
          unknown: "未知",
          locked: "已锁",
          unlocked: "已解锁",
          locking: "上锁中",
          unlocking: "解锁中",
          locking_failed: "上锁失败",
          unlocking_failed: "解锁失败",
          jammed: "卡住",
          pending: "等待",
          stopped: "已停止",
          armed_away: "离家布防",
          armed_home: "在家布防",
          disarmed: "已撤防",
          triggered: "已触发",
          comfortable: "舒适",
          very_comfortable: "非常舒适",
          slightly_uncomfortable: "略不适",
          somewhat_uncomfortable: "有些不适",
          quite_uncomfortable: "相当不适",
          extremely_uncomfortable: "极度不适",
          ok_but_humid: "尚可但潮湿",
          little_or_no_discomfort: "几乎无不适",
          some_discomfort: "有些不适",
          great_discomfort_avoid_exertion: "严重不适",
          dangerous_discomfort: "危险不适",
          heat_stroke_imminent: "中暑风险",
          dry: "干燥",
          very_dry: "很干燥",
          too_dry: "过于干燥",
          humid: "潮湿",
          very_humid: "很潮湿",
          too_humid: "过于潮湿",
          wet: "潮湿",
          low: "低",
          medium: "中",
          moderate: "中等",
          high: "高",
          very_high: "很高",
          severely_high: "极高",
          critical: "危急",
          excellent: "极佳",
          good: "良好",
          fair: "一般",
          poor: "差"
        }
      },
      favCard: {
        disarmedF: "已撤防",
        armed_home: "在家",
        armed_away: "离家",
        armed_night: "夜间",
        armed_vacation: "度假",
        armed_custom_bypass: "自定义",
        arming: "布防中",
        disarming: "撤防中",
        pending: "等待",
        triggered: "已触发"
      }
    },
    ro: {
      advanceVacuum: {
        modeLabels: {
          all: "Tot",
          rooms: "Camere",
          zone: "Zonă",
          routines: "Rutine",
          goto: "Mergi la punct"
        },
        aria: {
          modeTablist: "Mod de curățare"
        },
        panelModes: {
          smart: "Inteligent",
          vacuum_mop: "Aspirare și mop",
          vacuum: "Aspirare",
          mop: "Mop",
          custom: "Personalizat"
        },
        dockSections: {
          control: "Control bază",
          settings: "Setări bază"
        },
        dockSettings: {
          mop_wash_frequency: "Frecvență spălare mop",
          mop_mode: "Mod mop",
          auto_empty_frequency: "Frecvență golire automată",
          empty_mode: "Mod golire",
          drying_duration: "Durată uscare"
        },
        dockControls: {
          empty: {
            label: "Golește recipientul",
            active: "Oprește golirea"
          },
          wash: {
            label: "Spală mopul",
            active: "Oprește spălarea"
          },
          dry: {
            label: "Uscare mop",
            active: "Oprește uscarea"
          }
        },
        vacuumModes: {
          quiet: "Silențios",
          silent: "Silențios",
          balanced: "Echilibrat",
          standard: "Standard",
          normal: "Normal",
          turbo: "Turbo",
          max: "Max",
          maxplus: "Max+",
          max_plus: "Max+",
          gentle: "Ușor",
          strong: "Puternic",
          smart: "Inteligent",
          smartmode: "Inteligent",
          smart_mode: "Inteligent",
          intelligent: "Inteligent",
          custom: "Personalizat",
          custommode: "Personalizat",
          custom_mode: "Personalizat",
          custom_water_flow: "Debit apă personalizat",
          custom_watter_flow: "Debit apă personalizat",
          off: "Fără mop",
          low: "Scăzut",
          medium: "Mediu",
          high: "Ridicat",
          intense: "Intens",
          deep: "Profund",
          deep_plus: "Profund+",
          deepplus: "Profund+",
          fast: "Rapid",
          rapido: "Rapid"
        },
        offSuction: "Oprit",
        reportedStates: {
          docked: "La bază",
          charging: "Încărcare",
          charging_completed: "Încărcare",
          cleaning: "Curățare",
          spot_cleaning: "Curățare",
          segment_cleaning: "Curățare",
          room_cleaning: "Curățare",
          zone_cleaning: "Curățare",
          clean_area: "Curățare",
          paused: "Pauză",
          returning: "Întoarcere la bază",
          return_to_base: "Întoarcere la bază",
          returning_home: "Întoarcere la bază",
          washing: "Spălare mop",
          wash_mop: "Spălare mop",
          washing_mop: "Spălare mop",
          washing_pads: "Spălare mop",
          drying: "Uscare",
          drying_mop: "Uscare",
          emptying: "Golire automată",
          self_emptying: "Golire automată",
          unavailable: "Indisponibil",
          unknown: "Necunoscut",
          error: "Eroare",
          fallback: "Necunoscut"
        },
        mapStatus: {
          washing_mop: "Spălare mop",
          drying_mop: "Uscare mop",
          emptying_dust: "Golire recipient praf",
          charging: "Încărcare"
        },
        descriptorLabels: {
          suction: "Aspirare",
          mop: "Mop",
          mop_mode: "Mod mop"
        },
        utility: {
          cleaningMode: "Mod curățare",
          cleaningCounter: "Treceri curățare",
          dockActions: "Acțiuni bază",
          chargingStation: "Stație încărcare",
          zonesWord: "zone",
          pointWord: "punct",
          zoneTool: "Zonă",
          routineDefault: "Rutină",
          customMenuDefault: "Bază",
          modesFallbackTitle: "Moduri aspirare și mop"
        },
        actions: {
          returnToBase: "Înapoi la bază",
          locate: "Localizare",
          stop: "Stop",
          run: "Pornește",
          addZoneToClean: "Adaugă zonă la curățare",
          cleanZone: "Curăță zona"
        },
        handles: {
          moveZone: "Mută zona",
          deleteZone: "Șterge zona",
          resizeZone: "Redimensionează zona"
        },
        titles: {
          editZone: "Editează zona",
          backPanel: "Înapoi la panoul principal",
          addZone: "Adaugă zonă",
          gotoFallback: "Punct"
        }
      },
      vacuumSimple: {
        quiet: "Silențios",
        silent: "Silențios",
        balanced: "Echilibrat",
        standard: "Standard",
        normal: "Normal",
        turbo: "Turbo",
        max: "Max",
        maxplus: "Max+",
        max_plus: "Max+",
        gentle: "Ușor",
        strong: "Puternic",
        smart: "Inteligent",
        smartmode: "Inteligent",
        smart_mode: "Inteligent",
        intelligent: "Inteligent",
        custom: "Personalizat",
        custommode: "Personalizat",
        custom_mode: "Personalizat",
        custom_water_flow: "Debit apă personalizat",
        custom_watter_flow: "Debit apă personalizat",
        off: "Fără mop",
        low: "Scăzut",
        medium: "Mediu",
        high: "Ridicat",
        intense: "Intens",
        deep: "Profund"
      },
      navigationMusicAssist: {
        artist: "Artiști",
        artists: "Artiști",
        album: "Albume",
        albums: "Albume",
        track: "Piese",
        tracks: "Piese",
        song: "Piese",
        songs: "Piese",
        playlist: "Liste de redare",
        playlists: "Liste de redare",
        "radio station": "Stații radio",
        "radio stations": "Stații radio",
        podcast: "Podcasturi",
        podcasts: "Podcasturi",
        audiobook: "Cărți audio",
        audiobooks: "Cărți audio",
        genre: "Genuri",
        genres: "Genuri",
        favorite: "Favorite",
        favorites: "Favorite",
        favourites: "Favorite",
        search: "Căutare",
        "recently played": "Redări recente",
        "recently added": "Adăugate recent",
        "recently played tracks": "Piese redate recent",
        browseFallback: "Element",
      },
      weatherCard: {
        conditions: {
          clear_night: "Noapte senină",
          cloudy: "Înnorat",
          exceptional: "Excepțional",
          fog: "Ceață",
          hail: "Grindină",
          lightning: "Fulger",
          lightning_rainy: "Furtună cu ploaie",
          partlycloudy: "Parțial înnorat",
          pouring: "Ploaie torențială",
          rainy: "Ploios",
          snowy: "Ninsoare",
          snowy_rainy: "Lapoviță",
          sunny: "Însorit",
          windy: "Vânt puternic",
          windy_variant: "Vânt variabil"
        },
        defaultCondition: "Vreme",
        forecast: {
          chartAriaHourly: "Grafic prognoză orară",
          chartAriaDaily: "Grafic prognoză săptămânală",
          tabsAria: "Vizualizare prognoză",
          tabCards: "Carduri",
          tabChart: "Grafic",
          hoursTab: "Ore",
          weekTab: "Săptămână",
          emptyHourly: "Nu există prognoză orară.",
          emptyDaily: "Nu există prognoză săptămânală.",
          chartInsufficientData: "Date insuficiente pentru grafic.",
          closeDetail: "Închide detaliu",
          maxLabel: "Max.",
          minLabel: "Min.",
          temperatureLabel: "Temperatură",
          rainLabel: "Ploaie",
          humidityLabel: "Umiditate",
          windLabel: "Vânt"
        },
        meteoalarm: {
          name: "Meteoalarm",
          alertFallback: "Alertă",
          noAlerts: "Fără alerte",
          weatherAlert: "Alertă meteorologică",
          noWeatherAlerts: "Fără alerte meteorologice",
          level: "Nivel",
          type: "Tip",
          start: "Început",
          end: "Sfârșit",
          severity: "Severitate",
          urgency: "Urgență",
          certainty: "Certitudine",
          close: "Închide",
          descriptionTitle: "Descriere",
          instructionsTitle: "Instrucțiuni",
          terms: {
            moderate: "Moderat",
            severe: "Sever",
            high: "Ridicat",
            extreme: "Extrem",
            minor: "Minor",
            yellow: "Galben",
            orange: "Portocaliu",
            red: "Roșu",
            green: "Verde",
            future: "Viitor",
            immediate: "Imediat",
            expected: "Așteptat",
            past: "Trecut",
            likely: "Probabil",
            observed: "Observat",
            possible: "Posibil",
            unlikely: "Improbabil",
            unknown: "Necunoscut",
            met: "Meteorologic",
            monitor: "Monitorizare"
          }
        }
      },
      humidifierCard: {
        modes: {
          auto: "Automat",
          automatic: "Automat",
          smart: "Inteligent",
          smart_mode: "Inteligent",
          sleep: "Noapte",
          night: "Noapte",
          eco: "Eco",
          quiet: "Silențios",
          silent: "Silențios",
          low: "Scăzut",
          medium: "Mediu",
          mid: "Mediu",
          high: "Ridicat",
          boost: "Boost",
          turbo: "Turbo",
          normal: "Normal",
          balanced: "Normal",
          dry: "Uscare",
          drying: "Uscare",
          continuous: "Continuu",
          clothes_dry: "Rufe",
          laundry: "Rufe",
        },
        deviceStates: {
          on: "Pornit",
          off: "Oprit",
          humidifying: "Umidificare",
          dehumidifying: "Dezumidificare",
          drying: "Uscare",
          idle: "Inactiv",
          unavailable: "Indisponibil",
          unknown: "Necunoscut",
        },
      },
      climateCard: {
        modes: {
          off: "Oprit",
          heat: "Încălzire",
          cool: "Răcire",
          heat_cool: "Încălzire / răcire",
          auto: "Auto",
          dry: "Dezumidificare",
          fan_only: "Doar ventilator",
        },
        actions: {
          heating: "Încălzește",
          cooling: "Răcește",
          drying: "Dezumidifică",
          fan: "Ventilație",
          fan_only: "Ventilator",
          idle: "Inactiv",
          off: "Oprit",
        },
      },
      graphCard: {
        emptyHistory: "Nu există istoric disponibil"
      },
      fan: {
        off: "Oprit",
        on: "Pornit",
        unavailable: "Indisponibil",
        unknown: "Necunoscut",
        noState: "Fără stare",
        fallbackName: "Ventilator"
      },
      alarmPanel: {
        defaultTitle: "Alarmă",
        noState: "Fără stare",
        actions: {
          disarm: "Dezarmare",
          arm_home: "Acasă",
          arm_away: "Plecat",
          arm_night: "Noapte",
          arm_vacation: "Vacanță",
          arm_custom_bypass: "Personalizat"
        },
        states: {
          disarmed: "Dezarmat",
          armed_home: "Acasă",
          armed_away: "Plecat",
          armed_night: "Noapte",
          armed_vacation: "Vacanță",
          armed_custom_bypass: "Personalizat",
          armed: "Armat",
          arming: "Armare",
          disarming: "Dezarmare",
          pending: "În așteptare",
          triggered: "Declanșat",
          unavailable: "Indisponibil",
          unknown: "Necunoscut"
        }
      },
      person: {
        home: "Acasă",
        notHome: "Plecat",
        work: "Serviciu",
        school: "Școală",
        unavailable: "Indisponibil",
        unknown: "Necunoscut",
        locationUnknown: "Locație necunoscută",
        emptyTitle: "Nodalia Person Card",
        emptyBody: "Setați `entity` pentru a afișa acest card.",
        defaultName: "Persoană",
      },
      entityCard: {
        binarySensor: {
          doorOpen: "Deschisă",
          doorClosed: "Închisă",
          motionOn: "Detectat",
          motionOff: "Nu este detectat"
        },
        boolean: {
          yes: "Da",
          no: "Nu"
        },
        states: {
          on: "Pornit",
          off: "Oprit",
          open: "Deschis",
          opening: "Se deschide",
          closed: "Închis",
          closing: "Se închide",
          playing: "Redare",
          paused: "Pauză",
          buffering: "În buffer",
          idle: "Inactiv",
          standby: "Standby",
          home: "Acasă",
          not_home: "Plecat",
          detected: "Detectat",
          clear: "Liber",
          unavailable: "Indisponibil",
          unknown: "Necunoscut",
          locked: "Blocat",
          unlocked: "Deblocat",
          locking: "Se blochează",
          unlocking: "Se deblochează",
          locking_failed: "Blocare eșuată",
          unlocking_failed: "Deblocare eșuată",
          jammed: "Blocat",
          pending: "În așteptare",
          stopped: "Oprit",
          armed_away: "Armat plecat",
          armed_home: "Armat acasă",
          disarmed: "Dezarmat",
          triggered: "Declanșat",
          comfortable: "Confortabil",
          very_comfortable: "Foarte confortabil",
          slightly_uncomfortable: "Ușor inconfortabil",
          somewhat_uncomfortable: "Oarecum inconfortabil",
          quite_uncomfortable: "Destul de inconfortabil",
          extremely_uncomfortable: "Extrem de inconfortabil",
          ok_but_humid: "Ok, dar umed",
          little_or_no_discomfort: "Disconfort mic sau deloc",
          some_discomfort: "Oarecare disconfort",
          great_discomfort_avoid_exertion: "Disconfort mare",
          dangerous_discomfort: "Disconfort periculos",
          heat_stroke_imminent: "Risc de insolație",
          dry: "Uscat",
          very_dry: "Foarte uscat",
          too_dry: "Prea uscat",
          humid: "Umed",
          very_humid: "Foarte umed",
          too_humid: "Prea umed",
          wet: "Ud",
          low: "Scăzut",
          medium: "Mediu",
          moderate: "Moderat",
          high: "Ridicat",
          very_high: "Foarte ridicat",
          severely_high: "Extrem de ridicat",
          critical: "Critic",
          excellent: "Excelent",
          good: "Bun",
          fair: "Acceptabil",
          poor: "Slab"
        }
      },
      favCard: {
        disarmedF: "Dezarmat",
        armed_home: "Acasă",
        armed_away: "Plecat",
        armed_night: "Noapte",
        armed_vacation: "Vacanță",
        armed_custom_bypass: "Personalizat",
        arming: "Armare",
        disarming: "Dezarmare",
        pending: "În așteptare",
        triggered: "Declanșat"
      }
    },
  };

  const CALENDAR_CARD_TRANSLATIONS = {
    es: {
      allDay: "Todo el día",
      timeRange: {
        threeDays: "3 días",
        oneWeek: "1 semana",
        twoWeeks: "2 semanas",
        oneMonth: "1 mes",
      },
      buttons: {
        month: "Mes",
        back: "Volver",
        delete: "Eliminar",
        cancel: "Cancelar",
        create: "Crear",
      },
      fields: {
        calendar: "Calendario",
        title: "Título",
        description: "Descripción",
        location: "Ubicación",
        date: "Fecha",
        start: "Inicio",
        end: "Fin",
        repeat: "Repetición",
        repeatFrequency: "Frecuencia",
        repeatInterval: "Cada cuántas unidades",
        customColor: "Color propio",
        customColorTitle: "Color personalizado",
        color: "Color",
      },
      placeholders: {
        title: "Ej. Cita médica",
        optional: "Opcional",
      },
      repeat: {
        none: "No se repite",
        yearly: "Anualmente",
        monthly: "Mensualmente",
        weekly: "Semanalmente",
        daily: "Diariamente",
        custom: "Personalizado",
      },
      composer: {
        newEvent: "Nuevo evento",
      },
      event: {
        untitled: "Evento sin título",
      },
      states: {
        loading: "Cargando eventos...",
      },
      empty: {
        range: "No hay eventos en este rango.",
        day: "Sin eventos este día.",
        eventDetails: "Este evento no tiene descripción ni ubicación.",
      },
      errors: {
        loadEvents: "No se pudieron cargar eventos del calendario.",
        selectCalendar: "Selecciona un calendario.",
        enterTitle: "Escribe un título.",
        selectDate: "Selecciona una fecha.",
        selectDateTime: "Selecciona fecha, inicio y fin.",
        selectRepeatFrequency: "Selecciona la frecuencia para la repetición personalizada.",
        invalidRepeatInterval: "El intervalo debe ser un número mayor o igual que 1.",
        pastDate: "La fecha no puede ser anterior a hoy.",
        createEvent: "No se pudo crear el evento.",
        createEventWithMessage: "No se pudo crear el evento: {message}",
      },
      deleteRecurrence: {
        title: "Eliminar evento recurrente",
        message: "Este evento forma parte de una serie. ¿Qué deseas eliminar?",
        thisOnly: "Solo este evento",
        thisAndFuture: "Este y todos los posteriores",
      },
      aria: {
        newEventDialog: "Nuevo evento de calendario",
        deleteEvent: "Eliminar evento",
        deleteRecurringDialog: "Elegir cómo eliminar el evento recurrente",
        createHaEvent: "Crear evento HA",
        close: "Cerrar",
      },
    },
    en: {
      allDay: "All day",
      timeRange: {
        threeDays: "3 days",
        oneWeek: "1 week",
        twoWeeks: "2 weeks",
        oneMonth: "1 month",
      },
      buttons: {
        month: "Month",
        back: "Back",
        delete: "Delete",
        cancel: "Cancel",
        create: "Create",
      },
      fields: {
        calendar: "Calendar",
        title: "Title",
        description: "Description",
        location: "Location",
        date: "Date",
        start: "Start",
        end: "End",
        repeat: "Repeat",
        repeatFrequency: "Frequency",
        repeatInterval: "Every how many units",
        customColor: "Custom color",
        customColorTitle: "Custom color",
        color: "Color",
      },
      placeholders: {
        title: "E.g. Medical appointment",
        optional: "Optional",
      },
      repeat: {
        none: "Does not repeat",
        yearly: "Yearly",
        monthly: "Monthly",
        weekly: "Weekly",
        daily: "Daily",
        custom: "Custom",
      },
      composer: {
        newEvent: "New event",
      },
      event: {
        untitled: "Untitled event",
      },
      states: {
        loading: "Loading events...",
      },
      empty: {
        range: "No events in this range.",
        day: "No events this day.",
        eventDetails: "This event has no description or location.",
      },
      errors: {
        loadEvents: "Could not load calendar events.",
        selectCalendar: "Select a calendar.",
        enterTitle: "Enter a title.",
        selectDate: "Select a date.",
        selectDateTime: "Select date, start and end.",
        selectRepeatFrequency: "Select a frequency for custom repeat.",
        invalidRepeatInterval: "Interval must be a number greater than or equal to 1.",
        pastDate: "The date cannot be earlier than today.",
        createEvent: "Could not create the event.",
        createEventWithMessage: "Could not create the event: {message}",
      },
      deleteRecurrence: {
        title: "Delete recurring event",
        message: "This event is part of a series. What would you like to delete?",
        thisOnly: "This occurrence only",
        thisAndFuture: "This and all following occurrences",
      },
      aria: {
        newEventDialog: "New calendar event",
        deleteEvent: "Delete event",
        deleteRecurringDialog: "Choose how to delete the recurring event",
        createHaEvent: "Create HA event",
        close: "Close",
      },
    },
    de: {
      allDay: "Ganztägig",
      timeRange: { threeDays: "3 Tage", oneWeek: "1 Woche", twoWeeks: "2 Wochen", oneMonth: "1 Monat" },
      buttons: { month: "Monat", back: "Zurück", delete: "Löschen", cancel: "Abbrechen", create: "Erstellen" },
      fields: { calendar: "Kalender", title: "Titel", description: "Beschreibung", location: "Ort", date: "Datum", start: "Start", end: "Ende", repeat: "Wiederholung", repeatFrequency: "Frequenz", repeatInterval: "Alle wie viele Einheiten", customColor: "Eigene Farbe", customColorTitle: "Eigene Farbe", color: "Farbe" },
      placeholders: { title: "z. B. Arzttermin", optional: "Optional" },
      repeat: { none: "Wiederholt sich nicht", yearly: "Jährlich", monthly: "Monatlich", weekly: "Wöchentlich", daily: "Täglich", custom: "Benutzerdefiniert" },
      composer: { newEvent: "Neues Ereignis" },
      event: { untitled: "Ereignis ohne Titel" },
      states: { loading: "Ereignisse werden geladen..." },
      empty: { range: "Keine Ereignisse in diesem Zeitraum.", day: "Keine Ereignisse an diesem Tag.", eventDetails: "Dieses Ereignis hat keine Beschreibung und keinen Ort." },
      errors: { loadEvents: "Kalenderereignisse konnten nicht geladen werden.", selectCalendar: "Wähle einen Kalender aus.", enterTitle: "Gib einen Titel ein.", selectDate: "Wähle ein Datum aus.", selectDateTime: "Wähle Datum, Start und Ende aus.", selectRepeatFrequency: "Wähle eine Frequenz für die benutzerdefinierte Wiederholung aus.", invalidRepeatInterval: "Das Intervall muss eine Zahl größer oder gleich 1 sein.", pastDate: "Das Datum darf nicht vor heute liegen.", createEvent: "Das Ereignis konnte nicht erstellt werden.", createEventWithMessage: "Das Ereignis konnte nicht erstellt werden: {message}" },
      aria: { newEventDialog: "Neues Kalenderereignis", deleteEvent: "Ereignis löschen", createHaEvent: "HA-Ereignis erstellen", close: "Schließen" },
    },
    fr: {
      allDay: "Toute la journée",
      timeRange: { threeDays: "3 jours", oneWeek: "1 semaine", twoWeeks: "2 semaines", oneMonth: "1 mois" },
      buttons: { month: "Mois", back: "Retour", delete: "Supprimer", cancel: "Annuler", create: "Créer" },
      fields: { calendar: "Calendrier", title: "Titre", description: "Description", location: "Lieu", date: "Date", start: "Début", end: "Fin", repeat: "Répétition", repeatFrequency: "Fréquence", repeatInterval: "Toutes les combien d’unités", customColor: "Couleur propre", customColorTitle: "Couleur personnalisée", color: "Couleur" },
      placeholders: { title: "Ex. rendez-vous médical", optional: "Optionnel" },
      repeat: { none: "Ne se répète pas", yearly: "Chaque année", monthly: "Chaque mois", weekly: "Chaque semaine", daily: "Chaque jour", custom: "Personnalisé" },
      composer: { newEvent: "Nouvel événement" },
      event: { untitled: "Événement sans titre" },
      states: { loading: "Chargement des événements..." },
      empty: { range: "Aucun événement dans cette plage.", day: "Aucun événement ce jour.", eventDetails: "Cet événement n'a ni description ni lieu." },
      errors: { loadEvents: "Impossible de charger les événements du calendrier.", selectCalendar: "Sélectionnez un calendrier.", enterTitle: "Saisissez un titre.", selectDate: "Sélectionnez une date.", selectDateTime: "Sélectionnez la date, le début et la fin.", selectRepeatFrequency: "Sélectionnez une fréquence pour la répétition personnalisée.", invalidRepeatInterval: "L’intervalle doit être un nombre supérieur ou égal à 1.", pastDate: "La date ne peut pas être antérieure à aujourd'hui.", createEvent: "Impossible de créer l'événement.", createEventWithMessage: "Impossible de créer l'événement : {message}" },
      aria: { newEventDialog: "Nouvel événement de calendrier", deleteEvent: "Supprimer l'événement", createHaEvent: "Créer un événement HA", close: "Fermer" },
    },
    it: {
      allDay: "Tutto il giorno",
      timeRange: { threeDays: "3 giorni", oneWeek: "1 settimana", twoWeeks: "2 settimane", oneMonth: "1 mese" },
      buttons: { month: "Mese", back: "Indietro", delete: "Elimina", cancel: "Annulla", create: "Crea" },
      fields: { calendar: "Calendario", title: "Titolo", description: "Descrizione", location: "Luogo", date: "Data", start: "Inizio", end: "Fine", repeat: "Ripetizione", repeatFrequency: "Frequenza", repeatInterval: "Ogni quante unità", customColor: "Colore proprio", customColorTitle: "Colore personalizzato", color: "Colore" },
      placeholders: { title: "Es. visita medica", optional: "Opzionale" },
      repeat: { none: "Non si ripete", yearly: "Annualmente", monthly: "Mensilmente", weekly: "Settimanalmente", daily: "Ogni giorno", custom: "Personalizzato" },
      composer: { newEvent: "Nuovo evento" },
      event: { untitled: "Evento senza titolo" },
      states: { loading: "Caricamento eventi..." },
      empty: { range: "Nessun evento in questo intervallo.", day: "Nessun evento oggi.", eventDetails: "Questo evento non ha descrizione né luogo." },
      errors: { loadEvents: "Impossibile caricare gli eventi del calendario.", selectCalendar: "Seleziona un calendario.", enterTitle: "Inserisci un titolo.", selectDate: "Seleziona una data.", selectDateTime: "Seleziona data, inizio e fine.", selectRepeatFrequency: "Seleziona una frequenza per la ripetizione personalizzata.", invalidRepeatInterval: "L’intervallo deve essere un numero maggiore o uguale a 1.", pastDate: "La data non può essere precedente a oggi.", createEvent: "Impossibile creare l'evento.", createEventWithMessage: "Impossibile creare l'evento: {message}" },
      aria: { newEventDialog: "Nuovo evento calendario", deleteEvent: "Elimina evento", createHaEvent: "Crea evento HA", close: "Chiudi" },
    },
    nl: {
      allDay: "Hele dag",
      timeRange: { threeDays: "3 dagen", oneWeek: "1 week", twoWeeks: "2 weken", oneMonth: "1 maand" },
      buttons: { month: "Maand", back: "Terug", delete: "Verwijderen", cancel: "Annuleren", create: "Maken" },
      fields: { calendar: "Agenda", title: "Titel", description: "Beschrijving", location: "Locatie", date: "Datum", start: "Start", end: "Einde", repeat: "Herhaling", repeatFrequency: "Frequentie", repeatInterval: "Elke hoeveel eenheden", customColor: "Eigen kleur", customColorTitle: "Aangepaste kleur", color: "Kleur" },
      placeholders: { title: "Bijv. doktersafspraak", optional: "Optioneel" },
      repeat: { none: "Herhaalt niet", yearly: "Jaarlijks", monthly: "Maandelijks", weekly: "Wekelijks", daily: "Dagelijks", custom: "Aangepast" },
      composer: { newEvent: "Nieuwe afspraak" },
      event: { untitled: "Afspraak zonder titel" },
      states: { loading: "Afspraken laden..." },
      empty: { range: "Geen afspraken in dit bereik.", day: "Geen afspraken op deze dag.", eventDetails: "Deze afspraak heeft geen beschrijving of locatie." },
      errors: { loadEvents: "Kon agenda-afspraken niet laden.", selectCalendar: "Selecteer een agenda.", enterTitle: "Voer een titel in.", selectDate: "Selecteer een datum.", selectDateTime: "Selecteer datum, start en einde.", selectRepeatFrequency: "Selecteer een frequentie voor aangepaste herhaling.", invalidRepeatInterval: "Interval moet een getal zijn groter dan of gelijk aan 1.", pastDate: "De datum mag niet vóór vandaag liggen.", createEvent: "Kon de afspraak niet maken.", createEventWithMessage: "Kon de afspraak niet maken: {message}" },
      aria: { newEventDialog: "Nieuwe agenda-afspraak", deleteEvent: "Afspraak verwijderen", createHaEvent: "HA-afspraak maken", close: "Sluiten" },
    },
    pt: {
      allDay: "Dia inteiro",
      timeRange: { threeDays: "3 dias", oneWeek: "1 semana", twoWeeks: "2 semanas", oneMonth: "1 mês" },
      buttons: { month: "Mês", back: "Voltar", delete: "Eliminar", cancel: "Cancelar", create: "Criar" },
      fields: { calendar: "Calendário", title: "Título", description: "Descrição", location: "Localização", date: "Data", start: "Início", end: "Fim", repeat: "Repetição", repeatFrequency: "Frequência", repeatInterval: "A cada quantas unidades", customColor: "Cor própria", customColorTitle: "Cor personalizada", color: "Cor" },
      placeholders: { title: "Ex. consulta médica", optional: "Opcional" },
      repeat: { none: "Não se repete", yearly: "Anualmente", monthly: "Mensalmente", weekly: "Semanalmente", daily: "Diariamente", custom: "Personalizado" },
      composer: { newEvent: "Novo evento" },
      event: { untitled: "Evento sem título" },
      states: { loading: "A carregar eventos..." },
      empty: { range: "Não há eventos neste intervalo.", day: "Sem eventos neste dia.", eventDetails: "Este evento não tem descrição nem localização." },
      errors: { loadEvents: "Não foi possível carregar os eventos do calendário.", selectCalendar: "Seleciona um calendário.", enterTitle: "Escreve um título.", selectDate: "Seleciona uma data.", selectDateTime: "Seleciona data, início e fim.", selectRepeatFrequency: "Seleciona uma frequência para a repetição personalizada.", invalidRepeatInterval: "O intervalo deve ser um número maior ou igual a 1.", pastDate: "A data não pode ser anterior a hoje.", createEvent: "Não foi possível criar o evento.", createEventWithMessage: "Não foi possível criar o evento: {message}" },
      aria: { newEventDialog: "Novo evento de calendário", deleteEvent: "Eliminar evento", createHaEvent: "Criar evento HA", close: "Fechar" },
    },
    ru: {
      allDay: "Весь день",
      timeRange: { threeDays: "3 дня", oneWeek: "1 неделя", twoWeeks: "2 недели", oneMonth: "1 месяц" },
      buttons: { month: "Месяц", back: "Назад", delete: "Удалить", cancel: "Отмена", create: "Создать" },
      fields: { calendar: "Календарь", title: "Заголовок", description: "Описание", location: "Место", date: "Дата", start: "Начало", end: "Конец", repeat: "Повтор", repeatFrequency: "Частота", repeatInterval: "Каждые сколько единиц", customColor: "Свой цвет", customColorTitle: "Пользовательский цвет", color: "Цвет" },
      placeholders: { title: "Напр. визит к врачу", optional: "Необязательно" },
      repeat: { none: "Не повторяется", yearly: "Ежегодно", monthly: "Ежемесячно", weekly: "Еженедельно", daily: "Ежедневно", custom: "Пользовательский" },
      composer: { newEvent: "Новое событие" },
      event: { untitled: "Событие без названия" },
      states: { loading: "Загрузка событий..." },
      empty: { range: "В этом диапазоне нет событий.", day: "В этот день нет событий.", eventDetails: "У этого события нет описания и места." },
      errors: { loadEvents: "Не удалось загрузить события календаря.", selectCalendar: "Выберите календарь.", enterTitle: "Введите заголовок.", selectDate: "Выберите дату.", selectDateTime: "Выберите дату, начало и конец.", selectRepeatFrequency: "Выберите частоту для пользовательского повтора.", invalidRepeatInterval: "Интервал должен быть числом больше или равным 1.", pastDate: "Дата не может быть раньше сегодняшнего дня.", createEvent: "Не удалось создать событие.", createEventWithMessage: "Не удалось создать событие: {message}" },
      aria: { newEventDialog: "Новое событие календаря", deleteEvent: "Удалить событие", createHaEvent: "Создать событие HA", close: "Закрыть" },
    },
    el: {
      allDay: "Όλη μέρα",
      timeRange: { threeDays: "3 ημέρες", oneWeek: "1 εβδομάδα", twoWeeks: "2 εβδομάδες", oneMonth: "1 μήνας" },
      buttons: { month: "Μήνας", back: "Πίσω", delete: "Διαγραφή", cancel: "Ακύρωση", create: "Δημιουργία" },
      fields: { calendar: "Ημερολόγιο", title: "Τίτλος", description: "Περιγραφή", location: "Τοποθεσία", date: "Ημερομηνία", start: "Έναρξη", end: "Λήξη", repeat: "Επανάληψη", repeatFrequency: "Συχνότητα", repeatInterval: "Κάθε πόσες μονάδες", customColor: "Δικό μου χρώμα", customColorTitle: "Προσαρμοσμένο χρώμα", color: "Χρώμα" },
      placeholders: { title: "π.χ. ιατρικό ραντεβού", optional: "Προαιρετικό" },
      repeat: { none: "Δεν επαναλαμβάνεται", yearly: "Ετησίως", monthly: "Μηνιαίως", weekly: "Εβδομαδιαίως", daily: "Καθημερινά", custom: "Προσαρμοσμένο" },
      composer: { newEvent: "Νέο συμβάν" },
      event: { untitled: "Συμβάν χωρίς τίτλο" },
      states: { loading: "Φόρτωση συμβάντων..." },
      empty: { range: "Δεν υπάρχουν συμβάντα σε αυτό το εύρος.", day: "Δεν υπάρχουν συμβάντα αυτή την ημέρα.", eventDetails: "Αυτό το συμβάν δεν έχει περιγραφή ή τοποθεσία." },
      errors: { loadEvents: "Δεν ήταν δυνατή η φόρτωση συμβάντων ημερολογίου.", selectCalendar: "Επιλέξτε ημερολόγιο.", enterTitle: "Γράψτε τίτλο.", selectDate: "Επιλέξτε ημερομηνία.", selectDateTime: "Επιλέξτε ημερομηνία, έναρξη και λήξη.", selectRepeatFrequency: "Επιλέξτε συχνότητα για την προσαρμοσμένη επανάληψη.", invalidRepeatInterval: "Το διάστημα πρέπει να είναι αριθμός μεγαλύτερος ή ίσος με 1.", pastDate: "Η ημερομηνία δεν μπορεί να είναι πριν από σήμερα.", createEvent: "Δεν ήταν δυνατή η δημιουργία του συμβάντος.", createEventWithMessage: "Δεν ήταν δυνατή η δημιουργία του συμβάντος: {message}" },
      aria: { newEventDialog: "Νέο συμβάν ημερολογίου", deleteEvent: "Διαγραφή συμβάντος", createHaEvent: "Δημιουργία συμβάντος HA", close: "Κλείσιμο" },
    },
    zh: {
      allDay: "全天",
      timeRange: { threeDays: "3 天", oneWeek: "1 周", twoWeeks: "2 周", oneMonth: "1 个月" },
      buttons: { month: "月", back: "返回", delete: "删除", cancel: "取消", create: "创建" },
      fields: { calendar: "日历", title: "标题", description: "描述", location: "地点", date: "日期", start: "开始", end: "结束", repeat: "重复", repeatFrequency: "频率", repeatInterval: "每多少个单位", customColor: "自定义颜色", customColorTitle: "自定义颜色", color: "颜色" },
      placeholders: { title: "例如：就医预约", optional: "可选" },
      repeat: { none: "不重复", yearly: "每年", monthly: "每月", weekly: "每周", daily: "每天", custom: "自定义" },
      composer: { newEvent: "新事件" },
      event: { untitled: "无标题事件" },
      states: { loading: "正在加载事件..." },
      empty: { range: "此范围内没有事件。", day: "这一天没有事件。", eventDetails: "此事件没有描述或地点。" },
      errors: { loadEvents: "无法加载日历事件。", selectCalendar: "请选择日历。", enterTitle: "请输入标题。", selectDate: "请选择日期。", selectDateTime: "请选择日期、开始和结束时间。", selectRepeatFrequency: "请选择自定义重复的频率。", invalidRepeatInterval: "间隔必须是大于或等于 1 的数字。", pastDate: "日期不能早于今天。", createEvent: "无法创建事件。", createEventWithMessage: "无法创建事件：{message}" },
      aria: { newEventDialog: "新建日历事件", deleteEvent: "删除事件", createHaEvent: "创建 HA 事件", close: "关闭" },
    },
    ro: {
      allDay: "Toată ziua",
      timeRange: { threeDays: "3 zile", oneWeek: "1 săptămână", twoWeeks: "2 săptămâni", oneMonth: "1 lună" },
      buttons: { month: "Lună", back: "Înapoi", delete: "Șterge", cancel: "Anulează", create: "Creează" },
      fields: { calendar: "Calendar", title: "Titlu", description: "Descriere", location: "Locație", date: "Dată", start: "Început", end: "Sfârșit", repeat: "Repetare", repeatFrequency: "Frecvență", repeatInterval: "La fiecare câte unități", customColor: "Culoare proprie", customColorTitle: "Culoare personalizată", color: "Culoare" },
      placeholders: { title: "Ex. programare medicală", optional: "Opțional" },
      repeat: { none: "Nu se repetă", yearly: "Anual", monthly: "Lunar", weekly: "Săptămânal", daily: "Zilnic", custom: "Personalizat" },
      composer: { newEvent: "Eveniment nou" },
      event: { untitled: "Eveniment fără titlu" },
      states: { loading: "Se încarcă evenimentele..." },
      empty: { range: "Nu există evenimente în acest interval.", day: "Nu există evenimente în această zi.", eventDetails: "Acest eveniment nu are descriere sau locație." },
      errors: { loadEvents: "Nu s-au putut încărca evenimentele din calendar.", selectCalendar: "Selectează un calendar.", enterTitle: "Introdu un titlu.", selectDate: "Selectează o dată.", selectDateTime: "Selectează data, începutul și sfârșitul.", selectRepeatFrequency: "Selectează frecvența pentru repetarea personalizată.", invalidRepeatInterval: "Intervalul trebuie să fie un număr mai mare sau egal cu 1.", pastDate: "Data nu poate fi anterioară zilei de azi.", createEvent: "Nu s-a putut crea evenimentul.", createEventWithMessage: "Nu s-a putut crea evenimentul: {message}" },
      aria: { newEventDialog: "Eveniment nou de calendar", deleteEvent: "Șterge evenimentul", createHaEvent: "Creează eveniment HA", close: "Închide" },
    },
  };

  const NOTIFICATIONS_CARD_TRANSLATIONS = {
    es: {
      fallbackEvent: "Evento",
      allDay: "Todo el día",
      titles: {
        calendarSoon: "Evento pronto",
        calendarToday: "Evento pendiente hoy",
        calendarUnavailable: "Calendario no disponible",
        vacuumAttention: "Robot necesita atención",
        vacuumPaused: "Robot pausado",
        cleaningStarted: "Limpieza iniciada",
        returningDock: "Robot volviendo a base",
        mediaLeftOn: "Multimedia encendido sin presencia",
        motionDetected: "Movimiento detectado",
        doorOpen: "Puerta abierta",
        windowOpen: "Ventana abierta",
        hot: "Hace calor",
        cold: "Temperatura baja",
        rainSoon: "Lluvia próxima",
        batteryLow: "Batería baja",
        humidifierFillLow: "Depósito bajo",
        inkLow: "Tinta baja",
        humidityHigh: "Humedad alta",
        humidityLow: "Humedad baja",
        customFallback: "Notificación",
      },
      messages: {
        vacuumAttention: "{name} está en estado {state}.",
        vacuumPaused: "{name} está pausado o esperando.",
        vacuumState: "{name}: {state}.",
        hot: "{source} marca {value}. Puedes encender {fan}.",
        hotClimate: "{source} marca {value}. Puedes activar frío en {climate}.",
        mediaLeftOn: "{media} sigue encendido y {source} no detecta presencia.",
        rainSoon: "{source} prevé lluvia sobre {time}. Si tienes ropa tendida, conviene revisarla.",
        lowLevel: "{source} queda en {value}.",
        sensorValue: "{source} marca {value}.",
      },
      actions: {
        openCalendar: "Abrir calendario",
        viewRobot: "Ver robot",
        continue: "Continuar",
        viewSensor: "Ver sensor",
        turnOnFan: "Encender ventilador",
        turnOnCooling: "Activar frío",
        turnOnHeat: "Activar calor",
        turnOnDehumidifier: "Encender deshumidificador",
        turnOff: "Apagar",
        viewWeather: "Ver tiempo",
        buyBattery: "Comprar pila",
        buyInk: "Comprar tinta",
        run: "Ejecutar",
        toggle: "Alternar",
        open: "Abrir",
        less: "Menos",
      },
      severity: { critical: "Crítica", warning: "Aviso", success: "OK", info: "Info" },
      aria: {
        dismiss: "Borrar notificación",
        showLess: "Mostrar menos",
        showAll: "Mostrar todas las notificaciones",
      },
      empty: {
        title: "Todo en calma",
        message: "No tienes alertas pendientes",
      },
    },
    en: {
      ...PACK.en.notificationsCard,
      titles: {
        ...PACK.en.notificationsCard.titles,
        mediaLeftOn: "Media player left on without presence",
      },
      messages: {
        ...PACK.en.notificationsCard.messages,
        hotClimate: "{source} reads {value}. You can turn on cooling on {climate}.",
        mediaLeftOn: "{media} is still on and {source} detects no presence.",
      },
      actions: {
        ...PACK.en.notificationsCard.actions,
        turnOnCooling: "Turn on cooling",
        turnOnHeat: "Turn on heat",
        turnOnDehumidifier: "Turn on dehumidifier",
        turnOff: "Turn off",
      },
    },
    de: {
      fallbackEvent: "Termin",
      allDay: "Ganztägig",
      titles: {
        calendarSoon: "Termin bald",
        calendarToday: "Termin heute fällig",
        calendarUnavailable: "Kalender nicht verfügbar",
        vacuumAttention: "Roboter braucht Aufmerksamkeit",
        vacuumPaused: "Roboter pausiert",
        cleaningStarted: "Reinigung gestartet",
        returningDock: "Roboter kehrt zur Station zurück",
        mediaLeftOn: "Multimedia ohne Anwesenheit eingeschaltet",
        motionDetected: "Bewegung erkannt",
        doorOpen: "Tür offen",
        windowOpen: "Fenster offen",
        hot: "Es ist warm",
        cold: "Niedrige Temperatur",
        rainSoon: "Bald Regen",
        batteryLow: "Niedriger Batteriestand",
        humidifierFillLow: "Tank niedrig",
        inkLow: "Tinte niedrig",
        humidityHigh: "Hohe Luftfeuchtigkeit",
        humidityLow: "Niedrige Luftfeuchtigkeit",
        customFallback: "Benachrichtigung",
      },
      messages: {
        vacuumAttention: "{name} ist im Zustand {state}.",
        vacuumPaused: "{name} ist pausiert oder wartet.",
        vacuumState: "{name}: {state}.",
        hot: "{source} zeigt {value}. Du kannst {fan} einschalten.",
        hotClimate: "{source} zeigt {value}. Du kannst Kühlung auf {climate} einschalten.",
        mediaLeftOn: "{media} ist noch eingeschaltet und {source} erkennt keine Anwesenheit.",
        rainSoon: "{source} erwartet Regen gegen {time}. Falls Wäsche draußen hängt, lohnt ein Blick.",
        lowLevel: "{source} liegt bei {value}.",
        sensorValue: "{source} zeigt {value}.",
      },
      actions: {
        openCalendar: "Kalender öffnen",
        viewRobot: "Roboter ansehen",
        continue: "Fortsetzen",
        viewSensor: "Sensor ansehen",
        turnOnFan: "Ventilator einschalten",
        turnOnCooling: "Kühlung einschalten",
        turnOnHeat: "Heizung einschalten",
        turnOnDehumidifier: "Entfeuchter einschalten",
        turnOff: "Ausschalten",
        viewWeather: "Wetter ansehen",
        buyBattery: "Batterie kaufen",
        buyInk: "Tinte kaufen",
        run: "Ausführen",
        toggle: "Umschalten",
        open: "Öffnen",
        less: "Weniger",
      },
      severity: { critical: "Kritisch", warning: "Warnung", success: "OK", info: "Info" },
      aria: { dismiss: "Benachrichtigung löschen", showLess: "Weniger anzeigen", showAll: "Alle Benachrichtigungen anzeigen" },
    },
    fr: {
      fallbackEvent: "Événement",
      allDay: "Toute la journée",
      titles: {
        calendarSoon: "Événement bientôt",
        calendarToday: "Événement prévu aujourd'hui",
        calendarUnavailable: "Calendrier indisponible",
        vacuumAttention: "Robot à vérifier",
        vacuumPaused: "Robot en pause",
        cleaningStarted: "Nettoyage démarré",
        returningDock: "Robot retourne à la base",
        mediaLeftOn: "Multimédia allumé sans présence",
        motionDetected: "Mouvement détecté",
        doorOpen: "Porte ouverte",
        windowOpen: "Fenêtre ouverte",
        hot: "Il fait chaud",
        cold: "Température basse",
        rainSoon: "Pluie bientôt",
        batteryLow: "Batterie faible",
        humidifierFillLow: "Réservoir bas",
        inkLow: "Encre faible",
        humidityHigh: "Humidité élevée",
        humidityLow: "Humidité basse",
        customFallback: "Notification",
      },
      messages: {
        vacuumAttention: "{name} est dans l'état {state}.",
        vacuumPaused: "{name} est en pause ou en attente.",
        vacuumState: "{name}: {state}.",
        hot: "{source} indique {value}. Vous pouvez allumer {fan}.",
        hotClimate: "{source} indique {value}. Vous pouvez activer le froid sur {climate}.",
        mediaLeftOn: "{media} est toujours allumé et {source} ne détecte aucune présence.",
        rainSoon: "{source} prévoit de la pluie vers {time}. Si du linge est dehors, mieux vaut vérifier.",
        lowLevel: "{source} est à {value}.",
        sensorValue: "{source} indique {value}.",
      },
      actions: {
        openCalendar: "Ouvrir le calendrier",
        viewRobot: "Voir le robot",
        continue: "Continuer",
        viewSensor: "Voir le capteur",
        turnOnFan: "Allumer le ventilateur",
        turnOnCooling: "Activer le froid",
        turnOnHeat: "Activer le chauffage",
        turnOnDehumidifier: "Allumer le déshumidificateur",
        turnOff: "Éteindre",
        viewWeather: "Voir la météo",
        buyBattery: "Acheter une pile",
        buyInk: "Acheter de l'encre",
        run: "Exécuter",
        toggle: "Basculer",
        open: "Ouvrir",
        less: "Moins",
      },
      severity: { critical: "Critique", warning: "Avertissement", success: "OK", info: "Info" },
      aria: { dismiss: "Ignorer la notification", showLess: "Afficher moins", showAll: "Afficher toutes les notifications" },
    },
    it: {
      fallbackEvent: "Evento",
      allDay: "Tutto il giorno",
      titles: {
        calendarSoon: "Evento tra poco",
        calendarToday: "Evento previsto oggi",
        calendarUnavailable: "Calendario non disponibile",
        vacuumAttention: "Robot da controllare",
        vacuumPaused: "Robot in pausa",
        cleaningStarted: "Pulizia avviata",
        returningDock: "Robot verso la base",
        mediaLeftOn: "Multimedia acceso senza presenza",
        motionDetected: "Movimento rilevato",
        doorOpen: "Porta aperta",
        windowOpen: "Finestra aperta",
        hot: "Fa caldo",
        cold: "Temperatura bassa",
        rainSoon: "Pioggia in arrivo",
        batteryLow: "Batteria scarica",
        humidifierFillLow: "Serbatoio basso",
        inkLow: "Inchiostro basso",
        humidityHigh: "Umidità alta",
        humidityLow: "Umidità bassa",
        customFallback: "Notifica",
      },
      messages: {
        vacuumAttention: "{name} è nello stato {state}.",
        vacuumPaused: "{name} è in pausa o in attesa.",
        vacuumState: "{name}: {state}.",
        hot: "{source} segna {value}. Puoi accendere {fan}.",
        hotClimate: "{source} segna {value}. Puoi attivare il freddo su {climate}.",
        mediaLeftOn: "{media} è ancora acceso e {source} non rileva presenza.",
        rainSoon: "{source} prevede pioggia verso {time}. Se hai panni fuori, conviene controllare.",
        lowLevel: "{source} è a {value}.",
        sensorValue: "{source} segna {value}.",
      },
      actions: {
        openCalendar: "Apri calendario",
        viewRobot: "Vedi robot",
        continue: "Continua",
        viewSensor: "Vedi sensore",
        turnOnFan: "Accendi ventilatore",
        turnOnCooling: "Attiva raffrescamento",
        turnOnHeat: "Attiva riscaldamento",
        turnOnDehumidifier: "Accendi deumidificatore",
        turnOff: "Spegni",
        viewWeather: "Vedi meteo",
        buyBattery: "Compra batteria",
        buyInk: "Compra inchiostro",
        run: "Esegui",
        toggle: "Alterna",
        open: "Apri",
        less: "Meno",
      },
      severity: { critical: "Critica", warning: "Avviso", success: "OK", info: "Info" },
      aria: { dismiss: "Elimina notifica", showLess: "Mostra meno", showAll: "Mostra tutte le notifiche" },
    },
    nl: {
      fallbackEvent: "Afspraak",
      allDay: "Hele dag",
      titles: {
        calendarSoon: "Afspraak binnenkort",
        calendarToday: "Afspraak vandaag",
        calendarUnavailable: "Kalender niet beschikbaar",
        vacuumAttention: "Robot vraagt aandacht",
        vacuumPaused: "Robot gepauzeerd",
        cleaningStarted: "Schoonmaak gestart",
        returningDock: "Robot keert terug naar dock",
        mediaLeftOn: "Multimedia aan zonder aanwezigheid",
        motionDetected: "Beweging gedetecteerd",
        doorOpen: "Deur open",
        windowOpen: "Raam open",
        hot: "Het is warm",
        cold: "Lage temperatuur",
        rainSoon: "Binnenkort regen",
        batteryLow: "Batterij bijna leeg",
        humidifierFillLow: "Tank bijna leeg",
        inkLow: "Inkt bijna op",
        humidityHigh: "Hoge luchtvochtigheid",
        humidityLow: "Lage luchtvochtigheid",
        customFallback: "Melding",
      },
      messages: {
        vacuumAttention: "{name} heeft status {state}.",
        vacuumPaused: "{name} is gepauzeerd of wacht.",
        vacuumState: "{name}: {state}.",
        hot: "{source} geeft {value} aan. Je kunt {fan} inschakelen.",
        hotClimate: "{source} geeft {value} aan. Je kunt koeling op {climate} inschakelen.",
        mediaLeftOn: "{media} staat nog aan en {source} detecteert geen aanwezigheid.",
        rainSoon: "{source} verwacht regen rond {time}. Als er was buiten hangt, controleer die even.",
        lowLevel: "{source} staat op {value}.",
        sensorValue: "{source} geeft {value} aan.",
      },
      actions: {
        openCalendar: "Kalender openen",
        viewRobot: "Robot bekijken",
        continue: "Doorgaan",
        viewSensor: "Sensor bekijken",
        turnOnFan: "Ventilator inschakelen",
        turnOnCooling: "Koeling inschakelen",
        turnOnHeat: "Verwarming inschakelen",
        turnOnDehumidifier: "Luchtontvochtiger inschakelen",
        turnOff: "Uitschakelen",
        viewWeather: "Weer bekijken",
        buyBattery: "Batterij kopen",
        buyInk: "Inkt kopen",
        run: "Uitvoeren",
        toggle: "Schakelen",
        open: "Openen",
        less: "Minder",
      },
      severity: { critical: "Kritiek", warning: "Waarschuwing", success: "OK", info: "Info" },
      aria: { dismiss: "Melding verwijderen", showLess: "Minder tonen", showAll: "Alle meldingen tonen" },
    },
    pt: {
      fallbackEvent: "Evento",
      allDay: "Dia inteiro",
      titles: {
        calendarSoon: "Evento em breve",
        calendarToday: "Evento pendente hoje",
        calendarUnavailable: "Calendário indisponível",
        vacuumAttention: "Robô precisa de atenção",
        vacuumPaused: "Robô pausado",
        cleaningStarted: "Limpeza iniciada",
        returningDock: "Robô voltando à base",
        mediaLeftOn: "Multimédia ligado sem presença",
        motionDetected: "Movimento detectado",
        doorOpen: "Porta aberta",
        windowOpen: "Janela aberta",
        hot: "Está calor",
        cold: "Temperatura baixa",
        rainSoon: "Chuva em breve",
        batteryLow: "Bateria fraca",
        humidifierFillLow: "Depósito baixo",
        inkLow: "Tinta baixa",
        humidityHigh: "Humidade alta",
        humidityLow: "Humidade baixa",
        customFallback: "Notificação",
      },
      messages: {
        vacuumAttention: "{name} está no estado {state}.",
        vacuumPaused: "{name} está pausado ou em espera.",
        vacuumState: "{name}: {state}.",
        hot: "{source} marca {value}. Podes ligar {fan}.",
        hotClimate: "{source} marca {value}. Podes ativar frio em {climate}.",
        mediaLeftOn: "{media} continua ligado e {source} não deteta presença.",
        rainSoon: "{source} prevê chuva por volta de {time}. Se tens roupa estendida, convém verificar.",
        lowLevel: "{source} está em {value}.",
        sensorValue: "{source} marca {value}.",
      },
      actions: {
        openCalendar: "Abrir calendário",
        viewRobot: "Ver robô",
        continue: "Continuar",
        viewSensor: "Ver sensor",
        turnOnFan: "Ligar ventilador",
        turnOnCooling: "Ativar frio",
        turnOnHeat: "Ativar aquecimento",
        turnOnDehumidifier: "Ligar desumidificador",
        turnOff: "Desligar",
        viewWeather: "Ver meteorologia",
        buyBattery: "Comprar pilha",
        buyInk: "Comprar tinta",
        run: "Executar",
        toggle: "Alternar",
        open: "Abrir",
        less: "Menos",
      },
      severity: { critical: "Crítica", warning: "Aviso", success: "OK", info: "Info" },
      aria: { dismiss: "Apagar notificação", showLess: "Mostrar menos", showAll: "Mostrar todas as notificações" },
    },
    ru: {
      fallbackEvent: "Событие",
      allDay: "Весь день",
      titles: {
        calendarSoon: "Скоро событие",
        calendarToday: "Событие сегодня",
        calendarUnavailable: "Календарь недоступен",
        vacuumAttention: "Робот требует внимания",
        vacuumPaused: "Робот на паузе",
        cleaningStarted: "Уборка начата",
        returningDock: "Робот возвращается на базу",
        mediaLeftOn: "Мультимедиа включено без присутствия",
        motionDetected: "Обнаружено движение",
        doorOpen: "Дверь открыта",
        windowOpen: "Окно открыто",
        hot: "Жарко",
        cold: "Низкая температура",
        rainSoon: "Скоро дождь",
        batteryLow: "Низкий заряд батареи",
        humidifierFillLow: "Низкий уровень бака",
        inkLow: "Мало чернил",
        humidityHigh: "Высокая влажность",
        humidityLow: "Низкая влажность",
        customFallback: "Уведомление",
      },
      messages: {
        vacuumAttention: "{name} в состоянии {state}.",
        vacuumPaused: "{name} на паузе или ожидает.",
        vacuumState: "{name}: {state}.",
        hot: "{source} показывает {value}. Можно включить {fan}.",
        hotClimate: "{source} показывает {value}. Можно включить охлаждение на {climate}.",
        mediaLeftOn: "{media} всё ещё включено, а {source} не обнаруживает присутствие.",
        rainSoon: "{source} ожидает дождь около {time}. Если бельё снаружи, стоит проверить.",
        lowLevel: "{source}: {value}.",
        sensorValue: "{source} показывает {value}.",
      },
      actions: {
        openCalendar: "Открыть календарь",
        viewRobot: "Показать робота",
        continue: "Продолжить",
        viewSensor: "Показать датчик",
        turnOnFan: "Включить вентилятор",
        turnOnCooling: "Включить охлаждение",
        turnOnHeat: "Включить обогрев",
        turnOnDehumidifier: "Включить осушитель",
        turnOff: "Выключить",
        viewWeather: "Показать погоду",
        buyBattery: "Купить батарейку",
        buyInk: "Купить чернила",
        run: "Выполнить",
        toggle: "Переключить",
        open: "Открыть",
        less: "Меньше",
      },
      severity: { critical: "Критично", warning: "Предупреждение", success: "OK", info: "Инфо" },
      aria: { dismiss: "Удалить уведомление", showLess: "Показать меньше", showAll: "Показать все уведомления" },
    },
    el: {
      fallbackEvent: "Συμβάν",
      allDay: "Όλη μέρα",
      titles: {
        calendarSoon: "Συμβάν σύντομα",
        calendarToday: "Συμβάν σήμερα",
        calendarUnavailable: "Το ημερολόγιο δεν είναι διαθέσιμο",
        vacuumAttention: "Το ρομπότ χρειάζεται προσοχή",
        vacuumPaused: "Το ρομπότ είναι σε παύση",
        cleaningStarted: "Ο καθαρισμός ξεκίνησε",
        returningDock: "Το ρομπότ επιστρέφει στη βάση",
        mediaLeftOn: "Πολυμέσα ενεργά χωρίς παρουσία",
        motionDetected: "Ανιχνεύτηκε κίνηση",
        doorOpen: "Η πόρτα είναι ανοιχτή",
        windowOpen: "Το παράθυρο είναι ανοιχτό",
        hot: "Έχει ζέστη",
        cold: "Χαμηλή θερμοκρασία",
        rainSoon: "Βροχή σύντομα",
        batteryLow: "Χαμηλή μπαταρία",
        humidifierFillLow: "Χαμηλή στάθμη δοχείου",
        inkLow: "Χαμηλή στάθμη μελανιού",
        humidityHigh: "Υψηλή υγρασία",
        humidityLow: "Χαμηλή υγρασία",
        customFallback: "Ειδοποίηση",
      },
      messages: {
        vacuumAttention: "Το {name} είναι σε κατάσταση {state}.",
        vacuumPaused: "Το {name} είναι σε παύση ή αναμονή.",
        vacuumState: "{name}: {state}.",
        hot: "Το {source} δείχνει {value}. Μπορείς να ενεργοποιήσεις το {fan}.",
        hotClimate: "Το {source} δείχνει {value}. Μπορείς να ενεργοποιήσεις ψύξη στο {climate}.",
        mediaLeftOn: "Το {media} παραμένει ενεργό και το {source} δεν ανιχνεύει παρουσία.",
        rainSoon: "Το {source} προβλέπει βροχή γύρω στις {time}. Αν έχεις ρούχα έξω, έλεγξέ τα.",
        lowLevel: "Το {source} είναι στο {value}.",
        sensorValue: "Το {source} δείχνει {value}.",
      },
      actions: {
        openCalendar: "Άνοιγμα ημερολογίου",
        viewRobot: "Προβολή ρομπότ",
        continue: "Συνέχεια",
        viewSensor: "Προβολή αισθητήρα",
        turnOnFan: "Ενεργοποίηση ανεμιστήρα",
        turnOnCooling: "Ενεργοποίηση ψύξης",
        turnOnHeat: "Ενεργοποίηση θέρμανσης",
        turnOnDehumidifier: "Ενεργοποίηση αφυγραντήρα",
        turnOff: "Απενεργοποίηση",
        viewWeather: "Προβολή καιρού",
        buyBattery: "Αγορά μπαταρίας",
        buyInk: "Αγορά μελανιού",
        run: "Εκτέλεση",
        toggle: "Εναλλαγή",
        open: "Άνοιγμα",
        less: "Λιγότερα",
      },
      severity: { critical: "Κρίσιμο", warning: "Προειδοποίηση", success: "OK", info: "Info" },
      aria: { dismiss: "Διαγραφή ειδοποίησης", showLess: "Εμφάνιση λιγότερων", showAll: "Εμφάνιση όλων των ειδοποιήσεων" },
    },
    zh: {
      fallbackEvent: "事件",
      allDay: "全天",
      titles: {
        calendarSoon: "即将开始的事件",
        calendarToday: "今天的事件",
        calendarUnavailable: "日历不可用",
        vacuumAttention: "扫地机器人需要注意",
        vacuumPaused: "扫地机器人已暂停",
        cleaningStarted: "清扫已开始",
        returningDock: "扫地机器人正在返回基座",
        mediaLeftOn: "无人时多媒体仍开启",
        motionDetected: "检测到运动",
        doorOpen: "门已打开",
        windowOpen: "窗户已打开",
        hot: "温度偏高",
        cold: "温度偏低",
        rainSoon: "即将下雨",
        batteryLow: "电池电量低",
        humidifierFillLow: "水箱水位低",
        inkLow: "墨水不足",
        humidityHigh: "湿度偏高",
        humidityLow: "湿度偏低",
        customFallback: "通知",
      },
      messages: {
        vacuumAttention: "{name} 当前状态为 {state}。",
        vacuumPaused: "{name} 已暂停或等待中。",
        vacuumState: "{name}: {state}。",
        hot: "{source} 显示 {value}。你可以打开 {fan}。",
        hotClimate: "{source} 显示 {value}。可以在 {climate} 上开启制冷。",
        mediaLeftOn: "{media} 仍处于开启状态，{source} 未检测到有人。",
        rainSoon: "{source} 预计 {time} 左右有雨。如果外面晾着衣物，建议检查一下。",
        lowLevel: "{source} 剩余 {value}。",
        sensorValue: "{source} 显示 {value}。",
      },
      actions: {
        openCalendar: "打开日历",
        viewRobot: "查看机器人",
        continue: "继续",
        viewSensor: "查看传感器",
        turnOnFan: "打开风扇",
        turnOnCooling: "开启制冷",
        turnOnHeat: "开启制热",
        turnOnDehumidifier: "打开除湿机",
        turnOff: "关闭",
        viewWeather: "查看天气",
        buyBattery: "购买电池",
        buyInk: "购买墨水",
        run: "执行",
        toggle: "切换",
        open: "打开",
        less: "更少",
      },
      severity: { critical: "严重", warning: "警告", success: "OK", info: "信息" },
      aria: { dismiss: "删除通知", showLess: "显示更少", showAll: "显示所有通知" },
    },
    ro: {
      fallbackEvent: "Eveniment",
      allDay: "Toată ziua",
      titles: {
        calendarSoon: "Eveniment în curând",
        calendarToday: "Eveniment astăzi",
        calendarUnavailable: "Calendar indisponibil",
        vacuumAttention: "Robotul necesită atenție",
        vacuumPaused: "Robot în pauză",
        cleaningStarted: "Curățare pornită",
        returningDock: "Robotul revine la bază",
        mediaLeftOn: "Multimedia pornită fără prezență",
        motionDetected: "Mișcare detectată",
        doorOpen: "Ușă deschisă",
        windowOpen: "Fereastră deschisă",
        hot: "Este cald",
        cold: "Temperatură scăzută",
        rainSoon: "Ploaie în curând",
        batteryLow: "Baterie descărcată",
        humidifierFillLow: "Rezervor scăzut",
        inkLow: "Cerneală puțină",
        humidityHigh: "Umiditate ridicată",
        humidityLow: "Umiditate scăzută",
        customFallback: "Notificare",
      },
      messages: {
        vacuumAttention: "{name} este în starea {state}.",
        vacuumPaused: "{name} este în pauză sau așteaptă.",
        vacuumState: "{name}: {state}.",
        hot: "{source} indică {value}. Poți porni {fan}.",
        hotClimate: "{source} indică {value}. Poți porni răcirea pe {climate}.",
        mediaLeftOn: "{media} este încă pornit, iar {source} nu detectează prezență.",
        rainSoon: "{source} estimează ploaie în jurul {time}. Dacă ai rufe afară, merită verificat.",
        lowLevel: "{source} este la {value}.",
        sensorValue: "{source} indică {value}.",
      },
      actions: {
        openCalendar: "Deschide calendarul",
        viewRobot: "Vezi robotul",
        continue: "Continuă",
        viewSensor: "Vezi senzorul",
        turnOnFan: "Pornește ventilatorul",
        turnOnCooling: "Pornește răcirea",
        turnOnHeat: "Pornește încălzirea",
        turnOnDehumidifier: "Pornește dezumidificatorul",
        turnOff: "Oprește",
        viewWeather: "Vezi vremea",
        buyBattery: "Cumpără baterie",
        buyInk: "Cumpără cerneală",
        run: "Rulează",
        toggle: "Comută",
        open: "Deschide",
        less: "Mai puțin",
      },
      severity: { critical: "Critic", warning: "Avertizare", success: "OK", info: "Info" },
      aria: { dismiss: "Șterge notificarea", showLess: "Afișează mai puțin", showAll: "Afișează toate notificările" },
    },
  };

  Object.entries(NOTIFICATIONS_CARD_TRANSLATIONS).forEach(([lang, notificationsCard]) => {
    if (PACK[lang]) {
      PACK[lang].notificationsCard = notificationsCard;
    }
  });

  Object.entries(CALENDAR_CARD_TRANSLATIONS).forEach(([lang, calendarCard]) => {
    if (PACK[lang]) {
      PACK[lang].calendarCard = calendarCard;
    }
  });

  /** Merge locale PACK trees so partial locales (pt/ru/…) inherit full card strings from English. */
  function deepMergeLocale(base, override) {
    if (override === undefined || override === null) {
      return base;
    }
    if (typeof base !== "object" || base === null || Array.isArray(base)) {
      return override !== undefined ? override : base;
    }
    if (typeof override !== "object" || override === null || Array.isArray(override)) {
      return override;
    }
    const out = { ...base };
    for (const k of Object.keys(override)) {
      if (
        Object.prototype.hasOwnProperty.call(base, k) &&
        typeof base[k] === "object" &&
        base[k] !== null &&
        !Array.isArray(base[k]) &&
        typeof override[k] === "object" &&
        override[k] !== null &&
        !Array.isArray(override[k])
      ) {
        out[k] = deepMergeLocale(base[k], override[k]);
      } else {
        out[k] = override[k];
      }
    }
    return out;
  }

  const localeStringsCache = new Map();

  function strings(langCode) {
    const code = PACK[langCode] ? langCode : "en";
    if (code === "en") {
      return PACK.en;
    }
    if (localeStringsCache.has(code)) {
      return localeStringsCache.get(code);
    }
    const merged = deepMergeLocale(PACK.en, PACK[code]);
    localeStringsCache.set(code, merged);
    return merged;
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

  function translateNotificationsUi(hass, configLang, path, fallback = "", values = {}) {
    const lang = resolveLanguage(hass, configLang);
    const dict = strings(lang).notificationsCard || strings("en").notificationsCard || {};
    const raw = String(path || "")
      .split(".")
      .filter(Boolean)
      .reduce((cursor, key) => cursor?.[key], dict);
    const enRaw = String(path || "")
      .split(".")
      .filter(Boolean)
      .reduce((cursor, key) => cursor?.[key], strings("en").notificationsCard || {});
    const template = typeof raw === "string" ? raw : typeof enRaw === "string" ? enRaw : String(fallback || "");
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
      const value = values?.[key];
      return value === undefined || value === null ? "" : String(value);
    });
  }

  function translateCalendarUi(hass, configLang, path, fallback = "", values = {}) {
    const lang = resolveLanguage(hass, configLang);
    const dict = strings(lang).calendarCard || strings("en").calendarCard || {};
    const raw = String(path || "")
      .split(".")
      .filter(Boolean)
      .reduce((cursor, key) => cursor?.[key], dict);
    const enRaw = String(path || "")
      .split(".")
      .filter(Boolean)
      .reduce((cursor, key) => cursor?.[key], strings("en").calendarCard || {});
    const template = typeof raw === "string" ? raw : typeof enRaw === "string" ? enRaw : String(fallback || "");
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
      const value = values?.[key];
      return value === undefined || value === null ? "" : String(value);
    });
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

  function translateEntityStateChip(hass, configLang, rawKey) {
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

  function translateMediaPlayerState(hass, configLang, stateValue) {
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

  function translateClimateHvacLabel(hass, configLang, rawValue, fromAction) {
    const lang = resolveLanguage(hass, configLang);
    const k = normalizeTextKey(rawValue);
    const ccLoc = strings(lang).climateCard;
    const ccEn = strings("en").climateCard || {};
    const modes = { ...(ccEn.modes || {}), ...(ccLoc?.modes || {}) };
    const actions = { ...(ccEn.actions || {}), ...(ccLoc?.actions || {}) };
    const modeAlias = { heating: "heat", cooling: "cool", drying: "dry" };
    const humanize = val => String(val ?? "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, ch => ch.toUpperCase());
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

  function translateHumidifierDeviceState(hass, configLang, rawValue) {
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

  function isVacuumErrorState(rawValue) {
    const key = normalizeTextKey(rawValue);
    return !VACUUM_CLEAR_ERROR_KEYS.has(key);
  }

  function translateVacuumErrorState(hass, configLang, rawValue, rawFallback) {
    const raw = String(rawValue ?? rawFallback ?? "").trim();
    const key = normalizeTextKey(raw);
    if (!key || VACUUM_CLEAR_ERROR_KEYS.has(key)) {
      return "";
    }
    const lang = resolveLanguage(hass, configLang);
    const labels = VACUUM_ERROR_LABELS[lang] || {};
    const english = VACUUM_ERROR_LABELS.en;
    return labels[key] || english[key] || raw
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, match => match.toUpperCase());
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
    translateNotificationsUi,
    translateCalendarUi,
    translateHumidifierMode,
    translateEntityStateChip,
    translateMediaPlayerState,
    translateClimateHvacLabel,
    translateHumidifierDeviceState,
    translateMeteoalarmTerm,
    translateAdvanceVacuumReportedState,
    translateAdvanceVacuumVacuumMode,
    translateVacuumErrorState,
    isVacuumErrorState,
    translateFavState(langCode, key) {
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

  try {
    if (typeof window !== "undefined" && typeof CustomEvent === "function") {
      window.dispatchEvent(new CustomEvent("nodalia-i18n-ready", { bubbles: false }));
    }
  } catch (_e) {
    // ignore
  }
})();
