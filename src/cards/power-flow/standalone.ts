import { EDITOR_TAG } from "./power-flow-constants";
import { loadNodaliaPowerFlowCardEditor } from "./power-flow-editor";
import "./index";

// Keep the historical unused editor class in the standalone artifact.
const _legacyEditorKept =
  customElements.get(`${EDITOR_TAG}-legacy`) === loadNodaliaPowerFlowCardEditor();
