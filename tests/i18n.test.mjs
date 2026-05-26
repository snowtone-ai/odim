import assert from "node:assert/strict";
import test from "node:test";
import { getMessages, messages, resolveLocale } from "../lib/i18n/messages.ts";

test("i18n catalog exposes English and Japanese screen copy", () => {
  assert.equal(resolveLocale("ja"), "ja");
  assert.equal(resolveLocale("fr"), "en");
  assert.equal(messages.en.screens.alerts.title, "Signal Alerts");
  assert.equal(messages.ja.common.live, "ライブ / 出典付き");
  assert.equal(messages.ja.layers.length, 7);
  assert.equal(messages.en.layers.length, 7);
});

test("default messages resolve from environment locale", () => {
  const previous = process.env.NEXT_PUBLIC_DEFAULT_LOCALE;
  process.env.NEXT_PUBLIC_DEFAULT_LOCALE = "ja";
  try {
    assert.equal(getMessages().common.live, "ライブ / 出典付き");
    assert.equal(getMessages().screens.entity.filterAll, "全て");
    assert.equal(getMessages().screens.entity.narrativeGap, "ナラティブ乖離");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_DEFAULT_LOCALE;
    else process.env.NEXT_PUBLIC_DEFAULT_LOCALE = previous;
  }
});
