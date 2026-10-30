const { parentPort, workerData } = require("node:worker_threads");
const Database = require("better-sqlite3");
const { TEXT_MODEL } = require("./model.cjs");
const { scorePromptSound } = require("./prompt-sound.cjs");

async function loadEncoder(modelPath) {
  const { env, AutoTokenizer, ClapTextModelWithProjection } = await import("@huggingface/transformers");
  env.allowRemoteModels = false;
  env.useBrowserCache = false;
  env.useFSCache = false;
  const options = { local_files_only: true };
  const tokenizer = await AutoTokenizer.from_pretrained(modelPath, options);
  const model = await ClapTextModelWithProjection.from_pretrained(modelPath, {
    ...options, dtype: "q8", device: "cpu", session_options: { intraOpNumThreads: 1, interOpNumThreads: 1 }
  });
  return async (texts) => {
    const { text_embeds } = await model(tokenizer(texts, { padding: true, truncation: true }));
    if (text_embeds.dims.at(-1) !== TEXT_MODEL.dimensions) throw new Error("Unexpected embedding size");
    return texts.map((_, index) => text_embeds.data.subarray(index * TEXT_MODEL.dimensions, (index + 1) * TEXT_MODEL.dimensions));
  };
}

(async () => {
  let database;
  let response;
  try {
    database = new Database(workerData.databasePath, { readonly: true, fileMustExist: true });
    database.pragma("query_only = ON");
    database.pragma("busy_timeout = 5000");
    response = { result: await scorePromptSound(database, workerData.request, { embed: await loadEncoder(workerData.modelPath) }) };
  } catch {
    response = { error: "Could not match the prompt to your music. Please retry." };
  } finally {
    database?.close();
    parentPort.postMessage(response);
    parentPort.close();
  }
})();
