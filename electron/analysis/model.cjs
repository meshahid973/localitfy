const MODEL = Object.freeze({
  id: "clap-htsat-unfused-q8-v1",
  name: "CLAP audio encoder (quantized)",
  revision: "c28f2883575e590e04d3146ff0713c2448d691ba",
  source: "https://huggingface.co/Xenova/clap-htsat-unfused",
  license: "Apache-2.0 (base model)",
  licenseUrl: "https://huggingface.co/laion/clap-htsat-unfused",
  dimensions: 512,
  sampleRate: 48000,
  files: [
    { path: "config.json", bytes: 699, sha256: "39c6d90fe29cf2cce650dd5c92c38a1e35b130d9ce0bb98585222ad687ad979b" },
    { path: "preprocessor_config.json", bytes: 541, sha256: "9739f58296aa6f9ac18008fd0150fb2649bc554985fbde86d0a4041c882ac753" },
    { path: "onnx/audio_model_quantized.onnx", bytes: 34301667, sha256: "3fcff2c8824e7bcb83a983f2a49edab3b60cbcf4872ac70efee517355173bd1f" }
  ]
});
// Optional second download: CLAP's text encoder maps a prompt into the same space as saved audio profiles.
const TEXT_MODEL = Object.freeze({
  id: "clap-htsat-unfused-text-q8-v1",
  name: "CLAP text encoder (quantized)",
  revision: MODEL.revision,
  source: MODEL.source,
  license: MODEL.license,
  licenseUrl: MODEL.licenseUrl,
  dimensions: 512,
  sampleRate: MODEL.sampleRate,
  files: [
    { path: "config.json", bytes: 699, sha256: "39c6d90fe29cf2cce650dd5c92c38a1e35b130d9ce0bb98585222ad687ad979b" },
    { path: "tokenizer.json", bytes: 2108774, sha256: "dc239041d98de27ffc3975473a1a23e3db4c937b23c138c38bbc66588bd247e5" },
    { path: "tokenizer_config.json", bytes: 1392, sha256: "2c964a338683aec3695ea37687271e75b40905233f5d2a5bbb9be8cb40c4d0a0" },
    { path: "onnx/text_model_quantized.onnx", bytes: 126603263, sha256: "1a3df8b197e249816e08415fd040434c44762b2eea7eb7bf8a48a0f0bf3c14e5" }
  ]
});
const MODEL_BYTES = MODEL.files.reduce((total, file) => total + file.bytes, 0);
module.exports = { MODEL, TEXT_MODEL, MODEL_BYTES, ANALYZER_VERSION: 1 };
