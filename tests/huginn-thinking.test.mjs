import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const thinking = read("components/ui/huginn-thinking.tsx");
const consoleSource = read("components/ui/huginn-console.tsx");
const notices = read("THIRD_PARTY_NOTICES.md");

test("Huginn thinking is a single fixed-height accessible status row", () => {
  assert.match(thinking, /data-testid="huginn-thinking"/);
  assert.match(thinking, /role="status"/);
  assert.match(thinking, /aria-live="polite"/);
  assert.match(thinking, /Huginn is working\./);
  assert.match(thinking, /aria-hidden="true"[\s\S]*huginn-thinking-phase/);
  assert.equal((thinking.match(/role="status"/g) ?? []).length, 1);
  assert.match(thinking, /h-11 min-h-11/);
  assert.match(thinking, /HuginnIcon/);
  assert.match(thinking, /fill="currentColor"/);
  assert.match(consoleSource, /import \{ HuginnThinking \}/);
  assert.match(consoleSource, /<HuginnThinking(?: locale=\{locale\})? \/>/);
});

test("thinking phases are cautious and rotate without asserting completion", () => {
  assert.match(thinking, /Preparing analysis/);
  assert.match(thinking, /Tracing evidence/);
  assert.match(thinking, /Checking support/);
  assert.match(thinking, /setInterval/);
  assert.match(thinking, /clearInterval/);
});

test("motion is opacity-only and respects reduced-motion preferences", () => {
  assert.match(thinking, /prefers-reduced-motion: reduce/);
  assert.match(thinking, /window\.matchMedia\(REDUCED_MOTION_QUERY\)/);
  assert.match(thinking, /if \(reducedMotion\)[\s\S]*setPhaseIndex\(0\)/);
  assert.match(thinking, /animation: none/);
  assert.match(thinking, /@keyframes huginn-thinking-dots[\s\S]*opacity/);
  assert.match(thinking, /@keyframes huginn-thinking-phase-enter[\s\S]*opacity/);
  assert.match(thinking, /\.huginn-thinking-phase \{ animation: none; \}/);
  assert.doesNotMatch(thinking, /linear-gradient|bounce|sparkle|transform\s*:/i);
});

test("the copied spinner keeps its MIT attribution", () => {
  assert.match(notices, /svg-spinners/i);
  assert.match(notices, /3-dots-fade\.svg/);
  assert.match(notices, /Utkarsh Verma/);
  assert.match(notices, /The MIT License \(MIT\)/);
  assert.match(notices, /copyright notice and this permission notice/i);
});
