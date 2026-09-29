import { CARD_TAG, EDITOR_TAG } from "./lock-config";
import { loadNodaliaLockCard } from "./lock-card";
import { loadNodaliaLockCardEditor } from "./lock-editor";
window.NodaliaUtils.defineLazyCustomElement(CARD_TAG, loadNodaliaLockCard, { editorTag: EDITOR_TAG });
window.NodaliaUtils.defineLazyCustomElement(EDITOR_TAG, loadNodaliaLockCardEditor);
window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Lock Card",
  description: "Lock controls with deliberate slide-to-unlock confirmation.",
  preview: true,
});
