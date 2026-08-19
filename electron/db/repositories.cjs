function requireFunction(source, name) {
  const value = source?.[name];
  if (typeof value !== "function") throw new TypeError(`database function is required: ${name}`);
  return value;
}

function createDatabaseRepositories(databaseModule) {
  return Object.freeze({
    songs: Object.freeze({
      list: requireFunction(databaseModule, "getSongs"),
      insertMany: requireFunction(databaseModule, "insertSongs"),
      patch: requireFunction(databaseModule, "patchSong"),
      remove: requireFunction(databaseModule, "deleteSong"),
      clear: requireFunction(databaseModule, "clearLibrary")
    }),
    settings: Object.freeze({
      get: requireFunction(databaseModule, "getSettings"),
      save: requireFunction(databaseModule, "saveSettings")
    }),
    playlists: Object.freeze({
      get: requireFunction(databaseModule, "getPlaylists"),
      save: requireFunction(databaseModule, "savePlaylists")
    }),
    database: Object.freeze({
      init: requireFunction(databaseModule, "initDatabase"),
      backup: requireFunction(databaseModule, "backupDatabase"),
      repair: requireFunction(databaseModule, "repairDatabaseNow"),
      status: requireFunction(databaseModule, "getDatabaseStatus")
    })
  });
}

module.exports = { createDatabaseRepositories };
