/**
 * One-shot patch: fill known missing runtime i18n keys (alpha.7 gap audit).
 * Run: node scripts/patch-runtime-i18n-gaps.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME_DIR = path.join(__dirname, "..", "i18n", "runtime");

function setDeep(obj, dotted, value) {
  const parts = dotted.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!cur[k] || typeof cur[k] !== "object") {
      cur[k] = {};
    }
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}

function deepMerge(base, overlay) {
  if (overlay == null) {
    return base;
  }
  if (typeof overlay !== "object" || Array.isArray(overlay)) {
    return overlay;
  }
  const out = { ...base };
  for (const [k, v] of Object.entries(overlay)) {
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      out[k] &&
      typeof out[k] === "object" &&
      !Array.isArray(out[k])
    ) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

const PATCHES = {
  es: {
    "coverCard.toggleShowButtons": "Mostrar abrir, parar y cerrar",
    "coverCard.toggleShowSliders": "Mostrar deslizadores",
    "person.emptyBody": "Configura `entity` para mostrar la tarjeta.",
  },
  de: {
    "lightCard.controlModes.brightness": "Helligkeit anzeigen",
    "lightCard.controlModes.temperature": "Farbtemperatur anzeigen",
    "lightCard.controlModes.color": "Farbe anzeigen",
    "lightCard.sections.temperature": "Farbtemperatur",
    "lightCard.sections.color": "Farbe",
    "lightCard.sections.presets": "Voreinstellungen",
    "lightCard.temperaturePresets.warm": "Warm",
    "lightCard.temperaturePresets.neutral": "Neutral",
    "lightCard.temperaturePresets.cool": "Kühl",
    "common.aria.togglePower": "Ein- oder ausschalten",
    "coverCard.toggleShowButtons": "Öffnen, Stopp und Schließen anzeigen",
    "coverCard.toggleShowSliders": "Schieberegler anzeigen",
    "scenes.emptyTitle": "Nodalia Scenes Card",
    "scenes.emptyBody": "Füge Szenen-Entitäten im Karten-Editor hinzu.",
    "scenes.defaultName": "Szenen",
    "scenes.unavailable": "Nicht verfügbar",
    "scenes.subtitle": "Tippe auf eine Stimmung zum Starten",
    "scenes.moods": "Stimmungen",
    "climateCard.aria.togglePower": "Ein- oder ausschalten",
    "notificationsCard.titles.humidifierFillFull": "Tank voll",
    "notificationsCard.messages.highLevel": "{source} liegt bei {value}.",
    "notificationsCard.empty.title": "Alles ruhig",
    "notificationsCard.empty.message": "Du hast keine aktuellen Warnungen",
    "calendarCard.deleteRecurrence.title": "Wiederkehrendes Ereignis löschen",
    "calendarCard.deleteRecurrence.message":
      "Dieses Ereignis ist Teil einer Serie. Was möchtest du löschen?",
    "calendarCard.deleteRecurrence.thisOnly": "Nur dieses Ereignis",
    "calendarCard.deleteRecurrence.thisAndFuture": "Dieses und alle folgenden",
    "calendarCard.deleteRecurrence.deleteFailed":
      "Ereignis konnte nicht gelöscht werden. Bitte versuche es erneut.",
    "calendarCard.deleteRecurrence.deleteFailedWithMessage":
      "Ereignis konnte nicht gelöscht werden: {message}",
    "calendarCard.aria.deleteRecurringDialog":
      "Wähle, wie das wiederkehrende Ereignis gelöscht werden soll",
    "vacuumErrorLabels.water_empty": "Wassertank leer",
  },
  fr: {
    "lightCard.controlModes.brightness": "Afficher la luminosité",
    "lightCard.controlModes.temperature": "Afficher la température",
    "lightCard.controlModes.color": "Afficher la couleur",
    "lightCard.sections.temperature": "Température",
    "lightCard.sections.color": "Couleur",
    "lightCard.sections.presets": "Préréglages",
    "lightCard.temperaturePresets.warm": "Chaude",
    "lightCard.temperaturePresets.neutral": "Neutre",
    "lightCard.temperaturePresets.cool": "Froide",
    "common.aria.togglePower": "Allumer ou éteindre",
    "coverCard.toggleShowButtons": "Afficher ouvrir, arrêt et fermer",
    "coverCard.toggleShowSliders": "Afficher les curseurs",
    "scenes.emptyTitle": "Nodalia Scenes Card",
    "scenes.emptyBody": "Ajoutez des entités scène dans l’éditeur de carte.",
    "scenes.defaultName": "Scènes",
    "scenes.unavailable": "Indisponible",
    "scenes.subtitle": "Touchez une ambiance pour la lancer",
    "scenes.moods": "ambiances",
    "climateCard.aria.togglePower": "Allumer ou éteindre",
    "notificationsCard.titles.humidifierFillFull": "Réservoir plein",
    "notificationsCard.messages.highLevel": "{source} est à {value}.",
    "notificationsCard.empty.title": "Tout est calme",
    "notificationsCard.empty.message": "Vous n’avez aucune alerte en cours",
    "calendarCard.deleteRecurrence.title": "Supprimer l’événement récurrent",
    "calendarCard.deleteRecurrence.message":
      "Cet événement fait partie d’une série. Que souhaitez-vous supprimer ?",
    "calendarCard.deleteRecurrence.thisOnly": "Cette occurrence seulement",
    "calendarCard.deleteRecurrence.thisAndFuture": "Celle-ci et toutes les suivantes",
    "calendarCard.deleteRecurrence.deleteFailed":
      "Impossible de supprimer l’événement. Réessayez.",
    "calendarCard.deleteRecurrence.deleteFailedWithMessage":
      "Impossible de supprimer l’événement : {message}",
    "calendarCard.aria.deleteRecurringDialog":
      "Choisir comment supprimer l’événement récurrent",
    "vacuumErrorLabels.water_empty": "Réservoir d’eau vide",
  },
  it: {
    "lightCard.controlModes.brightness": "Mostra luminosità",
    "lightCard.controlModes.temperature": "Mostra temperatura",
    "lightCard.controlModes.color": "Mostra colore",
    "lightCard.sections.temperature": "Temperatura",
    "lightCard.sections.color": "Colore",
    "lightCard.sections.presets": "Preset",
    "lightCard.temperaturePresets.warm": "Calda",
    "lightCard.temperaturePresets.neutral": "Neutra",
    "lightCard.temperaturePresets.cool": "Fredda",
    "common.aria.togglePower": "Accendi o spegni",
    "coverCard.toggleShowButtons": "Mostra apri, stop e chiudi",
    "coverCard.toggleShowSliders": "Mostra cursori",
    "scenes.emptyTitle": "Nodalia Scenes Card",
    "scenes.emptyBody": "Aggiungi entità scena nell’editor della scheda.",
    "scenes.defaultName": "Scene",
    "scenes.unavailable": "Non disponibile",
    "scenes.subtitle": "Tocca un’atmosfera per avviarla",
    "scenes.moods": "atmosfere",
    "climateCard.aria.togglePower": "Accendi o spegni",
    "notificationsCard.titles.humidifierFillFull": "Serbatoio pieno",
    "notificationsCard.messages.highLevel": "{source} è a {value}.",
    "notificationsCard.empty.title": "Tutto tranquillo",
    "notificationsCard.empty.message": "Non hai avvisi attivi",
    "calendarCard.deleteRecurrence.title": "Elimina evento ricorrente",
    "calendarCard.deleteRecurrence.message":
      "Questo evento fa parte di una serie. Cosa vuoi eliminare?",
    "calendarCard.deleteRecurrence.thisOnly": "Solo questo evento",
    "calendarCard.deleteRecurrence.thisAndFuture": "Questo e tutti i successivi",
    "calendarCard.deleteRecurrence.deleteFailed":
      "Impossibile eliminare l’evento. Riprova.",
    "calendarCard.deleteRecurrence.deleteFailedWithMessage":
      "Impossibile eliminare l’evento: {message}",
    "calendarCard.aria.deleteRecurringDialog":
      "Scegli come eliminare l’evento ricorrente",
    "vacuumErrorLabels.water_empty": "Serbatoio dell’acqua vuoto",
  },
  nl: {
    "lightCard.controlModes.brightness": "Helderheid tonen",
    "lightCard.controlModes.temperature": "Temperatuur tonen",
    "lightCard.controlModes.color": "Kleur tonen",
    "lightCard.sections.temperature": "Temperatuur",
    "lightCard.sections.color": "Kleur",
    "lightCard.sections.presets": "Voorinstellingen",
    "lightCard.temperaturePresets.warm": "Warm",
    "lightCard.temperaturePresets.neutral": "Neutraal",
    "lightCard.temperaturePresets.cool": "Koel",
    "common.aria.togglePower": "In- of uitschakelen",
    "coverCard.toggleShowButtons": "Openen, stop en sluiten tonen",
    "coverCard.toggleShowSliders": "Schuifregelaars tonen",
    "scenes.emptyTitle": "Nodalia Scenes Card",
    "scenes.emptyBody": "Voeg scène-entiteiten toe in de kaarteditor.",
    "scenes.defaultName": "Scènes",
    "scenes.unavailable": "Niet beschikbaar",
    "scenes.subtitle": "Tik op een sfeer om te starten",
    "scenes.moods": "sferen",
    "climateCard.aria.togglePower": "In- of uitschakelen",
    "notificationsCard.titles.humidifierFillFull": "Tank vol",
    "notificationsCard.messages.highLevel": "{source} staat op {value}.",
    "notificationsCard.empty.title": "Alles rustig",
    "notificationsCard.empty.message": "Je hebt geen actieve meldingen",
    "calendarCard.deleteRecurrence.title": "Terugkerende afspraak verwijderen",
    "calendarCard.deleteRecurrence.message":
      "Deze afspraak maakt deel uit van een reeks. Wat wil je verwijderen?",
    "calendarCard.deleteRecurrence.thisOnly": "Alleen deze afspraak",
    "calendarCard.deleteRecurrence.thisAndFuture": "Deze en alle volgende",
    "calendarCard.deleteRecurrence.deleteFailed":
      "Afspraak kon niet worden verwijderd. Probeer het opnieuw.",
    "calendarCard.deleteRecurrence.deleteFailedWithMessage":
      "Afspraak kon niet worden verwijderd: {message}",
    "calendarCard.aria.deleteRecurringDialog":
      "Kies hoe de terugkerende afspraak wordt verwijderd",
    "vacuumErrorLabels.water_empty": "Watertank leeg",
  },
  pt: {
    "lightCard.controlModes.brightness": "Mostrar brilho",
    "lightCard.controlModes.temperature": "Mostrar temperatura",
    "lightCard.controlModes.color": "Mostrar cor",
    "lightCard.sections.temperature": "Temperatura",
    "lightCard.sections.color": "Cor",
    "lightCard.sections.presets": "Predefinições",
    "lightCard.temperaturePresets.warm": "Quente",
    "lightCard.temperaturePresets.neutral": "Neutra",
    "lightCard.temperaturePresets.cool": "Fria",
    "common.aria.togglePower": "Ligar ou desligar",
    "coverCard.toggleShowButtons": "Mostrar abrir, parar e fechar",
    "coverCard.toggleShowSliders": "Mostrar controlos deslizantes",
    "scenes.emptyTitle": "Nodalia Scenes Card",
    "scenes.emptyBody": "Adicione entidades de cena no editor do cartão.",
    "scenes.defaultName": "Cenas",
    "scenes.unavailable": "Indisponível",
    "scenes.subtitle": "Toque num ambiente para iniciar",
    "scenes.moods": "ambientes",
    "climateCard.aria.togglePower": "Ligar ou desligar",
    "notificationsCard.titles.humidifierFillFull": "Depósito cheio",
    "notificationsCard.messages.highLevel": "{source} está em {value}.",
    "notificationsCard.empty.title": "Tudo calmo",
    "notificationsCard.empty.message": "Não tem alertas ativos",
    "calendarCard.deleteRecurrence.title": "Eliminar evento recorrente",
    "calendarCard.deleteRecurrence.message":
      "Este evento faz parte de uma série. O que pretende eliminar?",
    "calendarCard.deleteRecurrence.thisOnly": "Apenas este evento",
    "calendarCard.deleteRecurrence.thisAndFuture": "Este e todos os seguintes",
    "calendarCard.deleteRecurrence.deleteFailed":
      "Não foi possível eliminar o evento. Tente novamente.",
    "calendarCard.deleteRecurrence.deleteFailedWithMessage":
      "Não foi possível eliminar o evento: {message}",
    "calendarCard.aria.deleteRecurringDialog":
      "Escolha como eliminar o evento recorrente",
    "vacuumErrorLabels.water_empty": "Depósito de água vazio",
  },
  ro: {
    "lightCard.controlModes.brightness": "Afișează luminozitatea",
    "lightCard.controlModes.temperature": "Afișează temperatura",
    "lightCard.controlModes.color": "Afișează culoarea",
    "lightCard.sections.temperature": "Temperatură",
    "lightCard.sections.color": "Culoare",
    "lightCard.sections.presets": "Presetări",
    "lightCard.temperaturePresets.warm": "Caldă",
    "lightCard.temperaturePresets.neutral": "Neutră",
    "lightCard.temperaturePresets.cool": "Rece",
    "common.aria.togglePower": "Pornește sau oprește",
    "coverCard.toggleShowButtons": "Afișează deschide, stop și închide",
    "coverCard.toggleShowSliders": "Afișează glisoarele",
    "scenes.emptyTitle": "Nodalia Scenes Card",
    "scenes.emptyBody": "Adaugă entități scenă în editorul cardului.",
    "scenes.defaultName": "Scene",
    "scenes.unavailable": "Indisponibil",
    "scenes.subtitle": "Atinge o atmosferă pentru a o lansa",
    "scenes.moods": "atmosfere",
    "climateCard.aria.togglePower": "Pornește sau oprește",
    "notificationsCard.titles.humidifierFillFull": "Rezervor plin",
    "notificationsCard.messages.highLevel": "{source} este la {value}.",
    "notificationsCard.empty.title": "Totul e liniște",
    "notificationsCard.empty.message": "Nu ai alerte active",
    "calendarCard.deleteRecurrence.title": "Șterge evenimentul recurent",
    "calendarCard.deleteRecurrence.message":
      "Acest eveniment face parte dintr-o serie. Ce dorești să ștergi?",
    "calendarCard.deleteRecurrence.thisOnly": "Doar acest eveniment",
    "calendarCard.deleteRecurrence.thisAndFuture": "Acesta și toate următoarele",
    "calendarCard.deleteRecurrence.deleteFailed":
      "Evenimentul nu a putut fi șters. Încearcă din nou.",
    "calendarCard.deleteRecurrence.deleteFailedWithMessage":
      "Evenimentul nu a putut fi șters: {message}",
    "calendarCard.aria.deleteRecurringDialog":
      "Alege cum să ștergi evenimentul recurent",
    "vacuumErrorLabels.water_empty": "Rezervorul de apă este gol",
  },
  ru: {
    "lightCard.controlModes.brightness": "Показать яркость",
    "lightCard.controlModes.temperature": "Показать температуру",
    "lightCard.controlModes.color": "Показать цвет",
    "lightCard.sections.temperature": "Температура",
    "lightCard.sections.color": "Цвет",
    "lightCard.sections.presets": "Пресеты",
    "lightCard.temperaturePresets.warm": "Тёплый",
    "lightCard.temperaturePresets.neutral": "Нейтральный",
    "lightCard.temperaturePresets.cool": "Холодный",
    "common.aria.togglePower": "Включить или выключить",
    "coverCard.toggleShowButtons": "Показать открыть, стоп и закрыть",
    "coverCard.toggleShowSliders": "Показать ползунки",
    "scenes.emptyTitle": "Nodalia Scenes Card",
    "scenes.emptyBody": "Добавьте сцены в редакторе карточки.",
    "scenes.defaultName": "Сцены",
    "scenes.unavailable": "Недоступно",
    "scenes.subtitle": "Нажмите на сцену для запуска",
    "scenes.moods": "сцены",
    "climateCard.aria.togglePower": "Включить или выключить",
    "notificationsCard.titles.humidifierFillFull": "Бак полон",
    "notificationsCard.messages.highLevel": "{source}: {value}.",
    "notificationsCard.empty.title": "Всё спокойно",
    "notificationsCard.empty.message": "У вас нет активных оповещений",
    "calendarCard.deleteRecurrence.title": "Удалить повторяющееся событие",
    "calendarCard.deleteRecurrence.message":
      "Это событие входит в серию. Что удалить?",
    "calendarCard.deleteRecurrence.thisOnly": "Только это событие",
    "calendarCard.deleteRecurrence.thisAndFuture": "Это и все последующие",
    "calendarCard.deleteRecurrence.deleteFailed":
      "Не удалось удалить событие. Попробуйте снова.",
    "calendarCard.deleteRecurrence.deleteFailedWithMessage":
      "Не удалось удалить событие: {message}",
    "calendarCard.aria.deleteRecurringDialog":
      "Выберите, как удалить повторяющееся событие",
    "vacuumErrorLabels.water_empty": "Бак для воды пуст",
  },
  zh: {
    "lightCard.controlModes.brightness": "显示亮度",
    "lightCard.controlModes.temperature": "显示色温",
    "lightCard.controlModes.color": "显示颜色",
    "lightCard.sections.temperature": "色温",
    "lightCard.sections.color": "颜色",
    "lightCard.sections.presets": "预设",
    "lightCard.temperaturePresets.warm": "暖色",
    "lightCard.temperaturePresets.neutral": "中性",
    "lightCard.temperaturePresets.cool": "冷色",
    "common.aria.togglePower": "开或关",
    "coverCard.toggleShowButtons": "显示打开、停止和关闭",
    "coverCard.toggleShowSliders": "显示滑块",
    "scenes.emptyTitle": "Nodalia Scenes Card",
    "scenes.emptyBody": "在卡片编辑器中添加场景实体。",
    "scenes.defaultName": "场景",
    "scenes.unavailable": "不可用",
    "scenes.subtitle": "点按氛围以启动",
    "scenes.moods": "氛围",
    "climateCard.aria.togglePower": "开或关",
    "notificationsCard.titles.humidifierFillFull": "水箱已满",
    "notificationsCard.messages.highLevel": "{source} 为 {value}。",
    "notificationsCard.empty.title": "一切平静",
    "notificationsCard.empty.message": "当前没有警报",
    "calendarCard.deleteRecurrence.title": "删除重复事件",
    "calendarCard.deleteRecurrence.message": "此事件属于系列。要删除什么？",
    "calendarCard.deleteRecurrence.thisOnly": "仅此次",
    "calendarCard.deleteRecurrence.thisAndFuture": "此次及之后所有",
    "calendarCard.deleteRecurrence.deleteFailed": "无法删除事件，请重试。",
    "calendarCard.deleteRecurrence.deleteFailedWithMessage": "无法删除事件：{message}",
    "calendarCard.aria.deleteRecurringDialog": "选择如何删除重复事件",
    "vacuumErrorLabels.water_empty": "水箱为空",
  },
  el: {
    "lightCard.controlModes.brightness": "Εμφάνιση φωτεινότητας",
    "lightCard.controlModes.temperature": "Εμφάνιση θερμοκρασίας",
    "lightCard.controlModes.color": "Εμφάνιση χρώματος",
    "lightCard.sections.temperature": "Θερμοκρασία",
    "lightCard.sections.color": "Χρώμα",
    "lightCard.sections.presets": "Προεπιλογές",
    "lightCard.temperaturePresets.warm": "Ζεστό",
    "lightCard.temperaturePresets.neutral": "Ουδέτερο",
    "lightCard.temperaturePresets.cool": "Ψυχρό",
    "common.aria.togglePower": "Ενεργοποίηση ή απενεργοποίηση",
    "coverCard.toggleShowButtons": "Εμφάνιση άνοιγμα, στάση και κλείσιμο",
    "coverCard.toggleShowSliders": "Εμφάνιση ρυθμιστικών",
    "scenes.emptyTitle": "Nodalia Scenes Card",
    "scenes.emptyBody": "Προσθέστε οντότητες σκηνής στον επεξεργαστή κάρτας.",
    "scenes.defaultName": "Σκηνές",
    "scenes.unavailable": "Μη διαθέσιμο",
    "scenes.subtitle": "Πατήστε μια διάθεση για εκκίνηση",
    "scenes.moods": "διαθέσεις",
    "climateCard.aria.togglePower": "Ενεργοποίηση ή απενεργοποίηση",
    "notificationsCard.titles.humidifierFillFull": "Γεμάτη δεξαμενή",
    "notificationsCard.messages.highLevel": "Το {source} είναι στο {value}.",
    "notificationsCard.empty.title": "Όλα ήσυχα",
    "notificationsCard.empty.message": "Δεν έχετε ενεργές ειδοποιήσεις",
    "calendarCard.deleteRecurrence.title": "Διαγραφή επαναλαμβανόμενου συμβάντος",
    "calendarCard.deleteRecurrence.message":
      "Αυτό το συμβάν ανήκει σε σειρά. Τι θέλετε να διαγράψετε;",
    "calendarCard.deleteRecurrence.thisOnly": "Μόνο αυτό το συμβάν",
    "calendarCard.deleteRecurrence.thisAndFuture": "Αυτό και όλα τα επόμενα",
    "calendarCard.deleteRecurrence.deleteFailed":
      "Δεν ήταν δυνατή η διαγραφή του συμβάντος. Δοκιμάστε ξανά.",
    "calendarCard.deleteRecurrence.deleteFailedWithMessage":
      "Δεν ήταν δυνατή η διαγραφή του συμβάντος: {message}",
    "calendarCard.aria.deleteRecurringDialog":
      "Επιλέξτε πώς να διαγράψετε το επαναλαμβανόμενο συμβάν",
    "vacuumErrorLabels.water_empty": "Άδειο δοχείο νερού",
  },
};

const EMPTY_STATE_PATCHES = {
  de: {
    "fan.emptyTitle": "Nodalia Fan Card",
    "fan.emptyBody": "Lege `entity` auf eine `fan.*`-Entität fest, um diese Karte anzuzeigen.",
    "lightCard.emptyTitle": "Nodalia Light Card",
    "lightCard.emptyBody": "Lege `entity` auf eine `light.*`-Entität fest, um diese Karte anzuzeigen.",
    "entityCard.emptyTitle": "Nodalia Entity Card",
    "entityCard.emptyBody": "Lege `entity` fest, um diese Karte anzuzeigen.",
    "weatherCard.emptyTitle": "Nodalia Weather Card",
    "weatherCard.emptyBody": "Lege `entity` fest, um das Wetter anzuzeigen.",
    "humidifierCard.emptyTitle": "Nodalia Humidifier Card",
    "humidifierCard.emptyBody": "Lege `entity` auf eine `humidifier.*`-Entität fest, um diese Karte anzuzeigen.",
    "climateCard.emptyTitle": "Nodalia Climate Card",
    "climateCard.emptyBody": "Lege `entity` auf eine `climate.*`-Entität fest, um diese Karte anzuzeigen.",
    "graphCard.emptyTitle": "Nodalia Graph Card",
    "graphCard.emptyBody": "Lege `entities` auf eine oder mehrere numerische Entitäten fest, um das Diagramm anzuzeigen.",
    "circularGaugeCard.emptyTitle": "Nodalia Circular Gauge Card",
    "circularGaugeCard.emptyBody": "Lege `entity` auf eine numerische Entität fest, um das Zifferblatt anzuzeigen.",
    "vacuumCard.emptyTitle": "Nodalia Vacuum Card",
    "vacuumCard.emptyBody": "Lege `entity` auf eine `vacuum.*`-Entität fest, um diese Karte anzuzeigen.",
    "insigniaCard.emptyTitle": "Nodalia Insignia Card",
    "insigniaCard.emptyBody": "Konfiguriere `entity` oder Basisinhalt, um das Abzeichen anzuzeigen.",
    "mediaPlayerCard.emptyTitle": "Nodalia Media Player",
    "mediaPlayerCard.emptyBody": "Lege `entity` oder `players` fest, um einen Player anzuzeigen.",
    "favCard.emptyTitle": "Nodalia Fav Card",
    "favCard.emptyBody": "Lege `entity` fest, um den Favoriten anzuzeigen.",
  },
  fr: {
    "fan.emptyTitle": "Nodalia Fan Card",
    "fan.emptyBody": "Définissez `entity` sur une entité `fan.*` pour afficher cette carte.",
    "lightCard.emptyTitle": "Nodalia Light Card",
    "lightCard.emptyBody": "Définissez `entity` sur une entité `light.*` pour afficher cette carte.",
    "entityCard.emptyTitle": "Nodalia Entity Card",
    "entityCard.emptyBody": "Configurez `entity` pour afficher cette carte.",
    "weatherCard.emptyTitle": "Nodalia Weather Card",
    "weatherCard.emptyBody": "Configurez `entity` pour afficher la météo.",
    "humidifierCard.emptyTitle": "Nodalia Humidifier Card",
    "humidifierCard.emptyBody": "Définissez `entity` sur une entité `humidifier.*` pour afficher cette carte.",
    "climateCard.emptyTitle": "Nodalia Climate Card",
    "climateCard.emptyBody": "Définissez `entity` sur une entité `climate.*` pour afficher cette carte.",
    "graphCard.emptyTitle": "Nodalia Graph Card",
    "graphCard.emptyBody": "Définissez `entities` sur une ou plusieurs entités numériques pour afficher le graphique.",
    "circularGaugeCard.emptyTitle": "Nodalia Circular Gauge Card",
    "circularGaugeCard.emptyBody": "Définissez `entity` sur une entité numérique pour afficher le cadran.",
    "vacuumCard.emptyTitle": "Nodalia Vacuum Card",
    "vacuumCard.emptyBody": "Définissez `entity` sur une entité `vacuum.*` pour afficher cette carte.",
    "insigniaCard.emptyTitle": "Nodalia Insignia Card",
    "insigniaCard.emptyBody": "Configurez `entity` ou un contenu de base pour afficher le badge.",
    "mediaPlayerCard.emptyTitle": "Nodalia Media Player",
    "mediaPlayerCard.emptyBody": "Définissez `entity` ou `players` pour afficher un lecteur.",
    "favCard.emptyTitle": "Nodalia Fav Card",
    "favCard.emptyBody": "Configurez `entity` pour afficher le favori.",
  },
  it: {
    "fan.emptyTitle": "Nodalia Fan Card",
    "fan.emptyBody": "Imposta `entity` su un'entità `fan.*` per mostrare questa scheda.",
    "lightCard.emptyTitle": "Nodalia Light Card",
    "lightCard.emptyBody": "Imposta `entity` su un'entità `light.*` per mostrare questa scheda.",
    "entityCard.emptyTitle": "Nodalia Entity Card",
    "entityCard.emptyBody": "Configura `entity` per mostrare la scheda.",
    "weatherCard.emptyTitle": "Nodalia Weather Card",
    "weatherCard.emptyBody": "Configura `entity` per mostrare il meteo.",
    "humidifierCard.emptyTitle": "Nodalia Humidifier Card",
    "humidifierCard.emptyBody": "Imposta `entity` su un'entità `humidifier.*` per mostrare questa scheda.",
    "climateCard.emptyTitle": "Nodalia Climate Card",
    "climateCard.emptyBody": "Imposta `entity` su un'entità `climate.*` per mostrare questa scheda.",
    "graphCard.emptyTitle": "Nodalia Graph Card",
    "graphCard.emptyBody": "Imposta `entities` su una o più entità numeriche per mostrare il grafico.",
    "circularGaugeCard.emptyTitle": "Nodalia Circular Gauge Card",
    "circularGaugeCard.emptyBody": "Imposta `entity` su un'entità numerica per mostrare il quadrante.",
    "vacuumCard.emptyTitle": "Nodalia Vacuum Card",
    "vacuumCard.emptyBody": "Imposta `entity` su un'entità `vacuum.*` per mostrare questa scheda.",
    "insigniaCard.emptyTitle": "Nodalia Insignia Card",
    "insigniaCard.emptyBody": "Configura `entity` o contenuto di base per mostrare il badge.",
    "mediaPlayerCard.emptyTitle": "Nodalia Media Player",
    "mediaPlayerCard.emptyBody": "Imposta `entity` o `players` per mostrare un lettore.",
    "favCard.emptyTitle": "Nodalia Fav Card",
    "favCard.emptyBody": "Configura `entity` per mostrare il preferito.",
  },
  nl: {
    "fan.emptyTitle": "Nodalia Fan Card",
    "fan.emptyBody": "Stel `entity` in op een `fan.*`-entiteit om deze kaart te tonen.",
    "lightCard.emptyTitle": "Nodalia Light Card",
    "lightCard.emptyBody": "Stel `entity` in op een `light.*`-entiteit om deze kaart te tonen.",
    "entityCard.emptyTitle": "Nodalia Entity Card",
    "entityCard.emptyBody": "Stel `entity` in om deze kaart te tonen.",
    "weatherCard.emptyTitle": "Nodalia Weather Card",
    "weatherCard.emptyBody": "Stel `entity` in om het weer te tonen.",
    "humidifierCard.emptyTitle": "Nodalia Humidifier Card",
    "humidifierCard.emptyBody": "Stel `entity` in op een `humidifier.*`-entiteit om deze kaart te tonen.",
    "climateCard.emptyTitle": "Nodalia Climate Card",
    "climateCard.emptyBody": "Stel `entity` in op een `climate.*`-entiteit om deze kaart te tonen.",
    "graphCard.emptyTitle": "Nodalia Graph Card",
    "graphCard.emptyBody": "Stel `entities` in op een of meer numerieke entiteiten om de grafiek te tonen.",
    "circularGaugeCard.emptyTitle": "Nodalia Circular Gauge Card",
    "circularGaugeCard.emptyBody": "Stel `entity` in op een numerieke entiteit om de wijzerplaat te tonen.",
    "vacuumCard.emptyTitle": "Nodalia Vacuum Card",
    "vacuumCard.emptyBody": "Stel `entity` in op een `vacuum.*`-entiteit om deze kaart te tonen.",
    "insigniaCard.emptyTitle": "Nodalia Insignia Card",
    "insigniaCard.emptyBody": "Configureer `entity` of basisinhoud om de badge te tonen.",
    "mediaPlayerCard.emptyTitle": "Nodalia Media Player",
    "mediaPlayerCard.emptyBody": "Stel `entity` of `players` in om een speler te tonen.",
    "favCard.emptyTitle": "Nodalia Fav Card",
    "favCard.emptyBody": "Stel `entity` in om de favoriet te tonen.",
  },
  pt: {
    "fan.emptyTitle": "Nodalia Fan Card",
    "fan.emptyBody": "Defina `entity` como uma entidade `fan.*` para mostrar este cartão.",
    "lightCard.emptyTitle": "Nodalia Light Card",
    "lightCard.emptyBody": "Defina `entity` como uma entidade `light.*` para mostrar este cartão.",
    "entityCard.emptyTitle": "Nodalia Entity Card",
    "entityCard.emptyBody": "Configure `entity` para mostrar o cartão.",
    "weatherCard.emptyTitle": "Nodalia Weather Card",
    "weatherCard.emptyBody": "Configure `entity` para mostrar o tempo.",
    "humidifierCard.emptyTitle": "Nodalia Humidifier Card",
    "humidifierCard.emptyBody": "Defina `entity` como uma entidade `humidifier.*` para mostrar este cartão.",
    "climateCard.emptyTitle": "Nodalia Climate Card",
    "climateCard.emptyBody": "Defina `entity` como uma entidade `climate.*` para mostrar este cartão.",
    "graphCard.emptyTitle": "Nodalia Graph Card",
    "graphCard.emptyBody": "Defina `entities` com uma ou mais entidades numéricas para mostrar o gráfico.",
    "circularGaugeCard.emptyTitle": "Nodalia Circular Gauge Card",
    "circularGaugeCard.emptyBody": "Defina `entity` como uma entidade numérica para mostrar o mostrador.",
    "vacuumCard.emptyTitle": "Nodalia Vacuum Card",
    "vacuumCard.emptyBody": "Defina `entity` como uma entidade `vacuum.*` para mostrar este cartão.",
    "insigniaCard.emptyTitle": "Nodalia Insignia Card",
    "insigniaCard.emptyBody": "Configure `entity` ou conteúdo básico para mostrar o distintivo.",
    "mediaPlayerCard.emptyTitle": "Nodalia Media Player",
    "mediaPlayerCard.emptyBody": "Defina `entity` ou `players` para mostrar um leitor.",
    "favCard.emptyTitle": "Nodalia Fav Card",
    "favCard.emptyBody": "Configure `entity` para mostrar o favorito.",
  },
  ro: {
    "fan.emptyTitle": "Nodalia Fan Card",
    "fan.emptyBody": "Setează `entity` la o entitate `fan.*` pentru a afișa cardul.",
    "lightCard.emptyTitle": "Nodalia Light Card",
    "lightCard.emptyBody": "Setează `entity` la o entitate `light.*` pentru a afișa cardul.",
    "entityCard.emptyTitle": "Nodalia Entity Card",
    "entityCard.emptyBody": "Configurează `entity` pentru a afișa cardul.",
    "weatherCard.emptyTitle": "Nodalia Weather Card",
    "weatherCard.emptyBody": "Configurează `entity` pentru a afișa vremea.",
    "humidifierCard.emptyTitle": "Nodalia Humidifier Card",
    "humidifierCard.emptyBody": "Setează `entity` la o entitate `humidifier.*` pentru a afișa cardul.",
    "climateCard.emptyTitle": "Nodalia Climate Card",
    "climateCard.emptyBody": "Setează `entity` la o entitate `climate.*` pentru a afișa cardul.",
    "graphCard.emptyTitle": "Nodalia Graph Card",
    "graphCard.emptyBody": "Setează `entities` la una sau mai multe entități numerice pentru a afișa graficul.",
    "circularGaugeCard.emptyTitle": "Nodalia Circular Gauge Card",
    "circularGaugeCard.emptyBody": "Setează `entity` la o entitate numerică pentru a afișa cadranul.",
    "vacuumCard.emptyTitle": "Nodalia Vacuum Card",
    "vacuumCard.emptyBody": "Setează `entity` la o entitate `vacuum.*` pentru a afișa cardul.",
    "insigniaCard.emptyTitle": "Nodalia Insignia Card",
    "insigniaCard.emptyBody": "Configurează `entity` sau conținut de bază pentru a afișa insigna.",
    "mediaPlayerCard.emptyTitle": "Nodalia Media Player",
    "mediaPlayerCard.emptyBody": "Setează `entity` sau `players` pentru a afișa un player.",
    "favCard.emptyTitle": "Nodalia Fav Card",
    "favCard.emptyBody": "Configurează `entity` pentru a afișa favoritul.",
  },
  ru: {
    "fan.emptyTitle": "Nodalia Fan Card",
    "fan.emptyBody": "Укажите `entity` как сущность `fan.*`, чтобы показать карточку.",
    "lightCard.emptyTitle": "Nodalia Light Card",
    "lightCard.emptyBody": "Укажите `entity` как сущность `light.*`, чтобы показать карточку.",
    "entityCard.emptyTitle": "Nodalia Entity Card",
    "entityCard.emptyBody": "Настройте `entity`, чтобы показать карточку.",
    "weatherCard.emptyTitle": "Nodalia Weather Card",
    "weatherCard.emptyBody": "Настройте `entity`, чтобы показать погоду.",
    "humidifierCard.emptyTitle": "Nodalia Humidifier Card",
    "humidifierCard.emptyBody": "Укажите `entity` как сущность `humidifier.*`, чтобы показать карточку.",
    "climateCard.emptyTitle": "Nodalia Climate Card",
    "climateCard.emptyBody": "Укажите `entity` как сущность `climate.*`, чтобы показать карточку.",
    "graphCard.emptyTitle": "Nodalia Graph Card",
    "graphCard.emptyBody": "Укажите `entities` как одну или несколько числовых сущностей для графика.",
    "circularGaugeCard.emptyTitle": "Nodalia Circular Gauge Card",
    "circularGaugeCard.emptyBody": "Укажите `entity` как числовую сущность для отображения шкалы.",
    "vacuumCard.emptyTitle": "Nodalia Vacuum Card",
    "vacuumCard.emptyBody": "Укажите `entity` как сущность `vacuum.*`, чтобы показать карточку.",
    "insigniaCard.emptyTitle": "Nodalia Insignia Card",
    "insigniaCard.emptyBody": "Настройте `entity` или базовое содержимое для отображения значка.",
    "mediaPlayerCard.emptyTitle": "Nodalia Media Player",
    "mediaPlayerCard.emptyBody": "Укажите `entity` или `players`, чтобы показать плеер.",
    "favCard.emptyTitle": "Nodalia Fav Card",
    "favCard.emptyBody": "Настройте `entity`, чтобы показать избранное.",
  },
  zh: {
    "fan.emptyTitle": "Nodalia Fan Card",
    "fan.emptyBody": "将 `entity` 设置为 `fan.*` 实体以显示此卡片。",
    "lightCard.emptyTitle": "Nodalia Light Card",
    "lightCard.emptyBody": "将 `entity` 设置为 `light.*` 实体以显示此卡片。",
    "entityCard.emptyTitle": "Nodalia Entity Card",
    "entityCard.emptyBody": "配置 `entity` 以显示卡片。",
    "weatherCard.emptyTitle": "Nodalia Weather Card",
    "weatherCard.emptyBody": "配置 `entity` 以显示天气。",
    "humidifierCard.emptyTitle": "Nodalia Humidifier Card",
    "humidifierCard.emptyBody": "将 `entity` 设置为 `humidifier.*` 实体以显示此卡片。",
    "climateCard.emptyTitle": "Nodalia Climate Card",
    "climateCard.emptyBody": "将 `entity` 设置为 `climate.*` 实体以显示此卡片。",
    "graphCard.emptyTitle": "Nodalia Graph Card",
    "graphCard.emptyBody": "将 `entities` 设置为一个或多个数值实体以显示图表。",
    "circularGaugeCard.emptyTitle": "Nodalia Circular Gauge Card",
    "circularGaugeCard.emptyBody": "将 `entity` 设置为数值实体以显示表盘。",
    "vacuumCard.emptyTitle": "Nodalia Vacuum Card",
    "vacuumCard.emptyBody": "将 `entity` 设置为 `vacuum.*` 实体以显示此卡片。",
    "insigniaCard.emptyTitle": "Nodalia Insignia Card",
    "insigniaCard.emptyBody": "配置 `entity` 或基本内容以显示徽章。",
    "mediaPlayerCard.emptyTitle": "Nodalia Media Player",
    "mediaPlayerCard.emptyBody": "设置 `entity` 或 `players` 以显示播放器。",
    "favCard.emptyTitle": "Nodalia Fav Card",
    "favCard.emptyBody": "配置 `entity` 以显示收藏。",
  },
  el: {
    "fan.emptyTitle": "Nodalia Fan Card",
    "fan.emptyBody": "Ορίστε το `entity` σε οντότητα `fan.*` για να εμφανιστεί η κάρτα.",
    "lightCard.emptyTitle": "Nodalia Light Card",
    "lightCard.emptyBody": "Ορίστε το `entity` σε οντότητα `light.*` για να εμφανιστεί η κάρτα.",
    "entityCard.emptyTitle": "Nodalia Entity Card",
    "entityCard.emptyBody": "Ρυθμίστε το `entity` για να εμφανιστεί η κάρτα.",
    "weatherCard.emptyTitle": "Nodalia Weather Card",
    "weatherCard.emptyBody": "Ρυθμίστε το `entity` για να εμφανιστεί ο καιρός.",
    "humidifierCard.emptyTitle": "Nodalia Humidifier Card",
    "humidifierCard.emptyBody": "Ορίστε το `entity` σε οντότητα `humidifier.*` για να εμφανιστεί η κάρτα.",
    "climateCard.emptyTitle": "Nodalia Climate Card",
    "climateCard.emptyBody": "Ορίστε το `entity` σε οντότητα `climate.*` για να εμφανιστεί η κάρτα.",
    "graphCard.emptyTitle": "Nodalia Graph Card",
    "graphCard.emptyBody": "Ορίστε `entities` σε μία ή περισσότερες αριθμητικές οντότητες για το γράφημα.",
    "circularGaugeCard.emptyTitle": "Nodalia Circular Gauge Card",
    "circularGaugeCard.emptyBody": "Ορίστε το `entity` σε αριθμητική οντότητα για τον δείκτη.",
    "vacuumCard.emptyTitle": "Nodalia Vacuum Card",
    "vacuumCard.emptyBody": "Ορίστε το `entity` σε οντότητα `vacuum.*` για να εμφανιστεί η κάρτα.",
    "insigniaCard.emptyTitle": "Nodalia Insignia Card",
    "insigniaCard.emptyBody": "Ρυθμίστε `entity` ή βασικό περιεχόμενο για να εμφανιστεί το σήμα.",
    "mediaPlayerCard.emptyTitle": "Nodalia Media Player",
    "mediaPlayerCard.emptyBody": "Ορίστε `entity` ή `players` για να εμφανιστεί αναπαραγωγέας.",
    "favCard.emptyTitle": "Nodalia Fav Card",
    "favCard.emptyBody": "Ρυθμίστε το `entity` για να εμφανιστεί το αγαπημένο.",
  },
  no: {
    "fan.emptyTitle": "Nodalia Fan Card",
    "fan.emptyBody": "Sett `entity` til en `fan.*`-entitet for å vise kortet.",
    "lightCard.emptyTitle": "Nodalia Light Card",
    "lightCard.emptyBody": "Sett `entity` til en `light.*`-entitet for å vise kortet.",
    "entityCard.emptyTitle": "Nodalia Entity Card",
    "entityCard.emptyBody": "Konfigurer `entity` for å vise kortet.",
    "weatherCard.emptyTitle": "Nodalia Weather Card",
    "weatherCard.emptyBody": "Konfigurer `entity` for å vise været.",
    "humidifierCard.emptyTitle": "Nodalia Humidifier Card",
    "humidifierCard.emptyBody": "Sett `entity` til en `humidifier.*`-entitet for å vise kortet.",
    "climateCard.emptyTitle": "Nodalia Climate Card",
    "climateCard.emptyBody": "Sett `entity` til en `climate.*`-entitet for å vise kortet.",
    "graphCard.emptyTitle": "Nodalia Graph Card",
    "graphCard.emptyBody": "Sett `entities` til én eller flere numeriske entiteter for å vise grafen.",
    "circularGaugeCard.emptyTitle": "Nodalia Circular Gauge Card",
    "circularGaugeCard.emptyBody": "Sett `entity` til en numerisk entitet for å vise urskiven.",
    "vacuumCard.emptyTitle": "Nodalia Vacuum Card",
    "vacuumCard.emptyBody": "Sett `entity` til en `vacuum.*`-entitet for å vise kortet.",
    "insigniaCard.emptyTitle": "Nodalia Insignia Card",
    "insigniaCard.emptyBody": "Konfigurer `entity` eller grunninnhold for å vise merket.",
    "mediaPlayerCard.emptyTitle": "Nodalia Media Player",
    "mediaPlayerCard.emptyBody": "Sett `entity` eller `players` for å vise en spiller.",
    "favCard.emptyTitle": "Nodalia Fav Card",
    "favCard.emptyBody": "Konfigurer `entity` for å vise favoritten.",
  },
};

for (const [lang, patch] of Object.entries(PATCHES)) {
  const filePath = path.join(RUNTIME_DIR, `${lang}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  for (const [key, value] of Object.entries(patch)) {
    setDeep(data, key, value);
  }
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`patched ${lang}.json (${Object.keys(patch).length} keys)`);
}

// Bootstrap no.json from nl.json with Norwegian climate schedule preserved.
const en = JSON.parse(fs.readFileSync(path.join(RUNTIME_DIR, "en.json"), "utf8"));
const nl = JSON.parse(fs.readFileSync(path.join(RUNTIME_DIR, "nl.json"), "utf8"));
const noExisting = JSON.parse(fs.readFileSync(path.join(RUNTIME_DIR, "no.json"), "utf8"));

const NL_TO_NO = {
  "Niet beschikbaar": "Ikke tilgjengelig",
  "Onbekend": "Ukjent",
  "Geen status": "Ingen status",
  "Thuis": "Hjemme",
  "Afwezig": "Borte",
  "Werk": "Arbeid",
  "School": "Skole",
  "Ventilator": "Vifte",
  "Verkeerde code": "Feil kode",
  "Uitschakelen": "Deaktiver",
  "Vakantie": "Ferie",
  "Aangepast": "Tilpasset",
  "Uitgeschakeld": "Deaktivert",
  "Ingeschakeld": "Aktivert",
  "Inschakelen": "Aktiverer",
  "Uitschakelen": "Deaktiverer",
  "In behandeling": "Venter",
  "Getriggerd": "Utløst",
  "Openen": "Åpne",
  "Sluiten": "Lukke",
  "Positie": "Posisjon",
  "Kantelen": "Vipp",
  "Persoon": "Person",
  "Locatie onbekend": "Ukjent plassering",
  "Geen geschiedenis beschikbaar": "Ingen historikk tilgjengelig",
  "Hele dag": "Hele dagen",
  "Kalender niet beschikbaar": "Kalender utilgjengelig",
  "Robot vraagt aandacht": "Roboten trenger oppmerksomhet",
  "Robot gepauzeerd": "Robot pauset",
  "Schoonmaak gestart": "Rengjøring startet",
  "Robot keert terug naar dock": "Roboten returnerer til dokken",
  "Beweging gedetecteerd": "Bevegelse oppdaget",
  "Deur open": "Dør åpen",
  "Raam open": "Vindu åpent",
  "Het is warm": "Det er varmt",
  "Lage temperatuur": "Lav temperatur",
  "Binnenkort regen": "Regn snart",
  "Batterij bijna leeg": "Lavt batteri",
  "Tank bijna leeg": "Lav tank",
  "Tank vol": "Full tank",
  "Inkt bijna op": "Lav blekk",
  "Hoge luchtvochtigheid": "Høy luftfuktighet",
  "Lage luchtvochtigheid": "Lav luftfuktighet",
  "Melding": "Varsel",
  "Alles rustig": "Alt rolig",
  "Je hebt geen actieve meldingen": "Du har ingen aktive varsler",
  "Watertank leeg": "Vanntank tom",
};

function translateLeaves(obj) {
  if (typeof obj === "string") {
    return NL_TO_NO[obj] ?? obj;
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return obj;
  }
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = translateLeaves(v);
  }
  return out;
}

let noData = translateLeaves(JSON.parse(JSON.stringify(nl)));
noData = deepMerge(noData, noExisting);
if (noExisting.climateCard?.schedule) {
  noData.climateCard = deepMerge(noData.climateCard || {}, {
    schedule: noExisting.climateCard.schedule,
  });
}
// Ensure water_empty in Norwegian
setDeep(noData, "vacuumErrorLabels.water_empty", "Vanntank tom");

fs.writeFileSync(
  path.join(RUNTIME_DIR, "no.json"),
  `${JSON.stringify(noData, null, 2)}\n`,
  "utf8",
);
console.log("bootstrapped no.json from nl.json + existing Norwegian schedule");

for (const [lang, patch] of Object.entries(EMPTY_STATE_PATCHES)) {
  const filePath = path.join(RUNTIME_DIR, `${lang}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  for (const [key, value] of Object.entries(patch)) {
    setDeep(data, key, value);
  }
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`patched ${lang}.json empty states (${Object.keys(patch).length} keys)`);
}
