function requireFunction(source, name) {
  const value = source?.[name];
  if (typeof value !== "function") throw new TypeError(`database function is required: ${name}`);
  return value;
}

function createDatabaseRepositories(databaseModule) {
  return Object.freeze({
    songs: Object.freeze({
      list: requireFunction(databaseModule, "getSongs"),
      get: requireFunction(databaseModule, "getSong"),
      insertMany: requireFunction(databaseModule, "insertSongs"),
      patch: requireFunction(databaseModule, "patchSong"),
      relinkPaths: requireFunction(databaseModule, "relinkSongPaths"),
      remove: requireFunction(databaseModule, "deleteSong"),
      clear: requireFunction(databaseModule, "clearLibrary")
    }),
    lyrics: Object.freeze({
      get: requireFunction(databaseModule, "getLyricsSelection"),
      save: requireFunction(databaseModule, "saveLyricsSelection"),
      setOffset: requireFunction(databaseModule, "saveLyricsOffset"),
      clear: requireFunction(databaseModule, "clearLyricsSelection")
    }),
    listening: Object.freeze({
      record: requireFunction(databaseModule, "recordPlayEvent"),
      clear: requireFunction(databaseModule, "clearListeningHistory")
    }),
    analysis: Object.freeze({
      list: requireFunction(databaseModule, "getSongAnalysis"),
      save: requireFunction(databaseModule, "saveSongAnalysis"),
      clear: requireFunction(databaseModule, "clearSongAnalysis")
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
