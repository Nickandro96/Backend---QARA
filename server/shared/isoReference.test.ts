import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeIsoReference } from "./isoReference";

test("reconstruit une référence ISO 13485 historique depuis le titre", () => {
  const row = normalizeIsoReference({ questionKey: "Q-13485-SM-2399", article: "", title: "4.1 — système de management qualité documenté" });
  assert.equal(row.article, "ISO 13485:2016 §4.1");
});

test("préserve une référence déjà renseignée", () => {
  const row = normalizeIsoReference({ questionKey: "Q-13485-X", article: "§7.5", title: "7.5 — production" });
  assert.equal(row.article, "§7.5");
});

test("ne transforme pas un référentiel non ISO", () => {
  const row = normalizeIsoReference({ questionKey: "Q-MDR-X", article: "", title: "4.1 — autre" });
  assert.equal(row.article, "");
});
