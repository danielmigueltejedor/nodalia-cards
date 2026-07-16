import test from "node:test";
import assert from "node:assert/strict";
import { restoreProtectedTranslationValues } from "../scripts/translation-token-utils.mjs";

test("translation token restoration tolerates casing and inserted whitespace", () => {
  const protectedValues = [
    { token: "__NODALIA_TOKEN_0__", value: "`service_data`" },
    { token: "__NODALIA_TOKEN_1__", value: "{entity}" },
  ];

  assert.equal(
    restoreProtectedTranslationValues(
      "Editar __nodalia_token_0__ para __ NODALIA _ TOKEN _ 1 __",
      protectedValues,
    ),
    "Editar `service_data` para {entity}",
  );
});

test("translation token restoration rejects missing or malformed tokens", () => {
  assert.equal(
    restoreProtectedTranslationValues("Translated without token", [
      { token: "__NODALIA_TOKEN_0__", value: "`service_data`" },
    ]),
    null,
  );
  assert.equal(
    restoreProtectedTranslationValues("__NODALIA_TOKEN__", [
      { token: "__NODALIA_TOKEN__", value: "`service_data`" },
    ]),
    null,
  );
});
