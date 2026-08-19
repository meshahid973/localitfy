const LOCALTIFY_RENDERER_PROTOCOL = "localtify-renderer";
const MEDIA_PROTOCOL = "localtify-media";

const PRIVILEGED_SCHEMES = Object.freeze([
  Object.freeze({
    scheme: LOCALTIFY_RENDERER_PROTOCOL,
    privileges: Object.freeze({
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    })
  }),
  Object.freeze({
    scheme: MEDIA_PROTOCOL,
    privileges: Object.freeze({
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
      bypassCSP: true
    })
  })
]);

function registerPrivilegedSchemes(protocol) {
  if (!protocol || typeof protocol.registerSchemesAsPrivileged !== "function") {
    throw new TypeError("Electron protocol registrar is required");
  }

  try {
    protocol.registerSchemesAsPrivileged(PRIVILEGED_SCHEMES.map((entry) => ({
      scheme: entry.scheme,
      privileges: { ...entry.privileges }
    })));
    return true;
  } catch (error) {
    console.log("[localtify protocol scheme error]", error?.message || error);
    return false;
  }
}

module.exports = {
  LOCALTIFY_RENDERER_PROTOCOL,
  MEDIA_PROTOCOL,
  PRIVILEGED_SCHEMES,
  registerPrivilegedSchemes
};
