const { MODEL, ANALYZER_VERSION } = require("./model.cjs");
const { dot, normalize, libraryMean, centered } = require("./listening-signals.cjs");
const { readNormalizedVector } = require("./similarity.cjs");

// Neutral captions. Every text embedding shares a common "this is music" direction; removing it keeps a few
// generic-sounding tracks from topping every prompt.
const GENERIC_PROMPTS = ["music", "a song", "a piece of music", "a recording of a song", "this is a song"];

function validatePromptSoundRequest(payload) {
  const text = typeof payload?.text === "string" ? payload.text.replace(/\s+/g, " ").trim() : "";
  if (!text || text.length > 300) throw new TypeError("Describe the sound in 1 to 300 characters");
  return { text };
}

/** Prompt direction from text embeddings: the prompt minus the mean of the neutral captions. */
function promptDirection(prompt, generic) {
  const unit = (values) => normalize(Float64Array.from(values));
  const mean = libraryMean(generic.map(unit));
  const target = unit(prompt);
  for (let i = 0; i < target.length; i++) target[i] -= mean[i];
  return normalize(target);
}

/**
 * Scores every current audio profile against a prompt. `embed(texts)` returns one 512-value embedding per text.
 * Profiles are compared after removing the library mean, as for similar songs, so scores rank songs within this
 * library; they are not probabilities.
 */
async function scorePromptSound(database, payload, { embed }) {
  const { text } = validatePromptSoundRequest(payload);
  const records = database.prepare(`SELECT a.songId, a.vector FROM song_analysis a JOIN songs s ON s.id = a.songId
    WHERE a.status = 'ready' AND a.modelId = ? AND a.analyzerVersion = ? AND a.filePath = s.filePath`)
    .all(MODEL.id, ANALYZER_VERSION).flatMap((record) => {
      const vector = readNormalizedVector(record.vector);
      return vector ? [{ songId: record.songId, vector }] : [];
    });
  if (!records.length) return { status: "no-profiles", scores: [] };
  const embeddings = await embed([text, ...GENERIC_PROMPTS]);
  if (embeddings.length !== GENERIC_PROMPTS.length + 1 || embeddings.some((values) => values.length !== MODEL.dimensions)) {
    throw new Error("Unexpected text embedding size");
  }
  const [prompt, ...generic] = embeddings;
  const direction = promptDirection(prompt, generic);
  const mean = libraryMean(records.map((record) => record.vector));
  const scores = records.map((record) => [record.songId, Math.round(dot(centered(record.vector, mean), direction) * 1e4) / 1e4]);
  return { status: "ready", scores };
}

module.exports = { GENERIC_PROMPTS, validatePromptSoundRequest, promptDirection, scorePromptSound };
