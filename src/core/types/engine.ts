/** Runtime declarations derive from the checked client rather than parallel method signatures. */
export type NodaliaBackendApi = typeof import("../engine-client").nodaliaBackend;
export type NodaliaEngineStatus = Awaited<ReturnType<NodaliaBackendApi["getEditorEngineStatus"]>>;
