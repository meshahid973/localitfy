import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { validatePromptSoundRequest, scorePromptSound, GENERIC_PROMPTS } = require("../../electron/analysis/prompt-sound.cjs");
const { createSimilarityService } = require("../../electron/analysis/similarity-service.cjs");
const { createAnalysisService } = require("../../electron/analysis/service.cjs");
const { MODEL, TEXT_MODEL, ANALYZER_VERSION } = require("../../electron/analysis/model.cjs");

const padded = (values) => { const array = new Float32Array(512); array.set(values); return array; };
const vector = (values) => Buffer.from(padded(values).buffer);
const database = (rows) => ({ prepare: (sql) => {
  assert.match(sql, /a\.filePath = s\.filePath/, "only profiles of the current file are compared");
  return { all: (modelId, analyzerVersion) => { assert.equal(modelId, MODEL.id); assert.equal(analyzerVersion, ANALYZER_VERSION); return rows; } };
} });

test("prompt text is required and bounded", () => {
  assert.deepEqual(validatePromptSoundRequest({ text: "  sad \n piano  " }), { text: "sad piano" });
  for (const payload of [null, {}, { text: "" }, { text: "   " }, { text: 4 }, { text: "x".repeat(301) }]) assert.throws(() => validatePromptSoundRequest(payload));
});

test("prompt scores rank library-centered profiles against the prompt minus generic music captions", async () => {
  // Every song shares the "music" direction (dimension 0); they differ along 1 (piano) and 2 (drums).
  const rows = [
    { songId: "piano", vector: vector([1, .8, 0]) },
    { songId: "drums", vector: vector([1, 0, .8]) },
    { songId: "plain", vector: vector([1, .1, .1]) },
    { songId: "broken", vector: Buffer.alloc(8) }
  ];
  const seen = [];
  const embed = async (texts) => { seen.push(...texts); return texts.map((text) => padded(text === "soft piano" ? [1, 1, 0] : [1, 0, 0])); };
  const result = await scorePromptSound(database(rows), { text: "soft piano" }, { embed });
  assert.deepEqual(seen, ["soft piano", ...GENERIC_PROMPTS], "prompt and neutral captions are embedded together");
  assert.equal(result.status, "ready");
  assert.deepEqual(result.scores.map(([id]) => id), ["piano", "drums", "plain"], "malformed vectors are skipped");
  const scores = new Map(result.scores);
  assert.ok(scores.get("piano") > 0 && scores.get("piano") > Math.max(scores.get("plain"), scores.get("drums")), "the piano song matches best");
  assert.deepEqual(await scorePromptSound(database([]), { text: "anything" }, { embed: () => assert.fail("no model needed") }),
    { status: "no-profiles", scores: [] });
  await assert.rejects(scorePromptSound(database(rows), { text: "x" }, { embed: async (texts) => texts.map(() => [1, 0]) }), /embedding size/);
});

test("prompt scoring runs in the shared bounded worker pool with the installed model path", async () => {
  let options;
  const service = createSimilarityService({ getDatabasePath: () => "/library.sqlite", workerFactory: (file, workerOptions) => {
    assert.match(file, /prompt-sound-worker\.cjs$/);
    options = workerOptions;
    const worker = new EventEmitter();
    worker.terminate = async () => {};
    queueMicrotask(() => worker.emit("message", { result: { status: "ready", scores: [] } }));
    return worker;
  } });
  assert.throws(() => service.promptSound({ text: "" }, "/models/text"));
  assert.deepEqual(await service.promptSound({ text: "rainy day" }, "/models/text"), { status: "ready", scores: [] });
  assert.deepEqual(options.workerData, { modelPath: "/models/text", databasePath: "/library.sqlite", request: { text: "rainy day" } });
  service.dispose();
});

test("the prompt model is a separate opt-in download within the size limit", async (t) => {
  assert.ok(TEXT_MODEL.files.reduce((sum, file) => sum + file.bytes, 0) < 150_000_000);
  assert.ok(TEXT_MODEL.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)));
  assert.equal(TEXT_MODEL.revision, MODEL.revision);
  const settings = { experimentalMusicAnalysis: false };
  const calls = [];
  const manager = (name, state) => ({ initialized: Promise.resolve(), metadata: { name }, installedPath: `/models/${name}`,
    status: () => ({ state }), download: async () => calls.push(`download ${name}`), cancel: async () => calls.push(`cancel ${name}`),
    remove: async () => calls.push(`remove ${name}`) });
  const service = createAnalysisService({ root: "/unused", ffmpegPath: "/unused",
    repositories: { settings: { get: () => settings, save: (patch) => Object.assign(settings, patch) }, songs: { list: () => [] },
      analysis: { list: () => [] }, listening: { clear: () => {} } },
    modelManager: manager("audio", "ready"), textModelManager: manager("text", "ready") });
  t.after(() => service.dispose());
  assert.equal((await service.status()).promptModel.name, "text");
  assert.equal(await service.promptModelPath(), null, "unused while analysis is disabled");
  await assert.rejects(service.download("prompt"), /Enable/);
  settings.experimentalMusicAnalysis = true;
  if (process.platform === "darwin" && process.arch === "x64") return;
  assert.equal(await service.promptModelPath(), "/models/text");
  await service.download("prompt");
  await service.removeModel("prompt");
  await assert.rejects(service.download("other"), /Unknown model/);
  assert.deepEqual(calls, ["download text", "remove text"], "the audio model is untouched");
});
