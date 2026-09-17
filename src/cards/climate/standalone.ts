import { EDITOR_TAG } from "./climate-constants";
import { NodaliaClimateCardEditorLegacy } from "./climate-editor";
import "./index";

// Keep the historical unused editor class in the standalone artifact.
const _legacyEditorKept =
  customElements.get(`${EDITOR_TAG}-legacy`) === NodaliaClimateCardEditorLegacy;
