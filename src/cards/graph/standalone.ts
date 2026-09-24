import { EDITOR_TAG } from "./graph-constants";
import { loadNodaliaGraphCardEditorLegacy } from "./graph-editor";
import "./index";

// Keep the historical unused editor class in the standalone artifact.
const _legacyEditorKept =
  customElements.get(`${EDITOR_TAG}-legacy`) === loadNodaliaGraphCardEditorLegacy();
