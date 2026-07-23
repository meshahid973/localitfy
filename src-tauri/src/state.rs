use rusqlite::{Connection, OpenFlags, Row};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::{
    collections::HashSet,
    env, fs,
    path::{Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

const STATE_VERSION: u32 = 2;
const STATE_FILE_NAME: &str = "localtify-state.json";
const LEGACY_DATABASE_NAME: &str = "localitfy.sqlite";

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersistedState {
    version: u32,
    initialized: bool,
    imported_at_ms: u64,
    imported_from: Option<String>,
    migration_backup: Option<String>,
    #[serde(default)]
    source_song_count: usize,
    #[serde(default)]
    source_playlist_count: usize,
    songs: Vec<Value>,
    settings: Map<String, Value>,
    playlists: Vec<Value>,
}

#[derive(Clone)]
struct LegacyDatabaseCandidate {
    path: PathBuf,
    song_count: usize,
    playlist_count: usize,
    settings_count: usize,
    modified_ms: u64,
}

fn empty_state() -> PersistedState {
    PersistedState {
        version: STATE_VERSION,
        initialized: false,
        imported_at_ms: 0,
        imported_from: None,
        migration_backup: None,
        source_song_count: 0,
        source_playlist_count: 0,
        songs: Vec::new(),
        settings: Map::new(),
        playlists: Vec::new(),
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn system_time_ms(value: SystemTime) -> u64 {
    value
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| format!("Could not resolve Tauri app data: {error}"))
}

fn state_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join(STATE_FILE_NAME))
}

fn read_state(app: &AppHandle) -> Result<Option<PersistedState>, String> {
    let path = state_path(app)?;
    if !path.is_file() {
        return Ok(None);
    }

    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("Could not read Tauri migration state: {error}"))?;

    match serde_json::from_str::<PersistedState>(&raw) {
        Ok(state) => Ok(Some(state)),
        Err(_) => {
            let backup = path.with_file_name(format!("localtify-state.corrupt-{}.json", now_ms()));
            let _ = fs::copy(&path, backup);
            Ok(None)
        }
    }
}

fn write_state(app: &AppHandle, state: &PersistedState) -> Result<PathBuf, String> {
    let path = state_path(app)?;
    let directory = path
        .parent()
        .ok_or_else(|| "Tauri migration state has no parent directory".to_string())?;
    fs::create_dir_all(directory)
        .map_err(|error| format!("Could not create Tauri app data directory: {error}"))?;

    let temp_path = directory.join(format!("{STATE_FILE_NAME}.tmp"));
    let bytes = serde_json::to_vec_pretty(state)
        .map_err(|error| format!("Could not serialize Tauri migration state: {error}"))?;
    fs::write(&temp_path, bytes)
        .map_err(|error| format!("Could not write temporary Tauri migration state: {error}"))?;

    if path.is_file() {
        let previous = directory.join("localtify-state.previous.json");
        let _ = fs::copy(&path, previous);
        fs::remove_file(&path)
            .map_err(|error| format!("Could not rotate Tauri migration state: {error}"))?;
    }

    if let Err(rename_error) = fs::rename(&temp_path, &path) {
        fs::copy(&temp_path, &path).map_err(|copy_error| {
            format!(
                "Could not commit Tauri migration state ({rename_error}); fallback copy failed: {copy_error}"
            )
        })?;
        let _ = fs::remove_file(&temp_path);
    }

    Ok(path)
}

fn push_unique_path(paths: &mut Vec<PathBuf>, seen: &mut HashSet<String>, path: PathBuf) {
    if !path.is_file() {
        return;
    }

    let key = path.to_string_lossy().replace('\\', "/").to_lowercase();
    if seen.insert(key) {
        paths.push(path);
    }
}

fn collect_sqlite_files(
    root: &Path,
    depth: usize,
    paths: &mut Vec<PathBuf>,
    seen: &mut HashSet<String>,
) {
    if depth == 0 || !root.is_dir() {
        return;
    }

    let Ok(entries) = fs::read_dir(root) else {
        return;
    };

    for entry in entries.filter_map(Result::ok) {
        let path = entry.path();
        if path.is_dir() {
            collect_sqlite_files(&path, depth - 1, paths, seen);
            continue;
        }

        let file_name = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("")
            .to_lowercase();

        if file_name == LEGACY_DATABASE_NAME
            || (file_name.starts_with("localitfy.sqlite.backup-")
                && file_name.ends_with(".sqlite"))
        {
            push_unique_path(paths, seen, path);
        }
    }
}

fn legacy_database_paths(app: &AppHandle) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    let mut seen = HashSet::new();

    if let Some(app_data) = env::var_os("APPDATA").map(PathBuf::from) {
        for directory in ["localitfy", "localtify", "Electron"] {
            let root = app_data.join(directory);
            push_unique_path(
                &mut paths,
                &mut seen,
                root.join(LEGACY_DATABASE_NAME),
            );
            collect_sqlite_files(&root, 2, &mut paths, &mut seen);
        }
    }

    if let Some(local_app_data) = env::var_os("LOCALAPPDATA").map(PathBuf::from) {
        collect_sqlite_files(
            &local_app_data.join("localtify").join("migration-safety"),
            5,
            &mut paths,
            &mut seen,
        );
    }

    if let Ok(tauri_data) = app_data_dir(app) {
        collect_sqlite_files(
            &tauri_data.join("migration-backups"),
            5,
            &mut paths,
            &mut seen,
        );
    }

    if let Some(user_profile) = env::var_os("USERPROFILE").map(PathBuf::from) {
        let desktop = user_profile.join("Desktop");
        if let Ok(entries) = fs::read_dir(&desktop) {
            for entry in entries.filter_map(Result::ok) {
                let path = entry.path();
                let file_name = path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("");
                if path.is_dir() && file_name.starts_with("localitfy-data-safety-") {
                    collect_sqlite_files(&path, 4, &mut paths, &mut seen);
                }
            }
        }
    }

    paths
}

fn table_exists(connection: &Connection, table_name: &str) -> bool {
    connection
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
            [table_name],
            |row| row.get::<_, i64>(0),
        )
        .map(|count| count > 0)
        .unwrap_or(false)
}

fn table_count(connection: &Connection, table_name: &str) -> usize {
    if !table_exists(connection, table_name) {
        return 0;
    }

    let sql = match table_name {
        "songs" => "SELECT COUNT(*) FROM songs",
        "settings" => "SELECT COUNT(*) FROM settings",
        "playlists" => "SELECT COUNT(*) FROM playlists",
        _ => return 0,
    };

    connection
        .query_row(sql, [], |row| row.get::<_, i64>(0))
        .map(|count| count.max(0) as usize)
        .unwrap_or(0)
}

fn inspect_database(path: &Path) -> Option<LegacyDatabaseCandidate> {
    let connection = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .ok()?;

    let _ = connection.busy_timeout(Duration::from_secs(2));
    let modified_ms = fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .map(system_time_ms)
        .unwrap_or(0);

    Some(LegacyDatabaseCandidate {
        path: path.to_path_buf(),
        song_count: table_count(&connection, "songs"),
        playlist_count: table_count(&connection, "playlists"),
        settings_count: table_count(&connection, "settings"),
        modified_ms,
    })
}

fn legacy_database_candidates(app: &AppHandle) -> Vec<LegacyDatabaseCandidate> {
    let mut candidates: Vec<_> = legacy_database_paths(app)
        .into_iter()
        .filter_map(|path| inspect_database(&path))
        .collect();

    candidates.sort_by(|left, right| {
        right
            .song_count
            .cmp(&left.song_count)
            .then_with(|| right.playlist_count.cmp(&left.playlist_count))
            .then_with(|| right.settings_count.cmp(&left.settings_count))
            .then_with(|| right.modified_ms.cmp(&left.modified_ms))
    });

    candidates
}

fn find_best_legacy_database(app: &AppHandle) -> Option<LegacyDatabaseCandidate> {
    legacy_database_candidates(app).into_iter().next()
}

fn copy_legacy_backup(app: &AppHandle, database_path: &Path) -> Result<PathBuf, String> {
    let backup_dir = app_data_dir(app)?
        .join("migration-backups")
        .join(format!("electron-{}", now_ms()));
    fs::create_dir_all(&backup_dir)
        .map_err(|error| format!("Could not create migration backup directory: {error}"))?;

    let base_name = database_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(LEGACY_DATABASE_NAME);

    for suffix in ["", "-wal", "-shm"] {
        let source = if suffix.is_empty() {
            database_path.to_path_buf()
        } else {
            PathBuf::from(format!("{}{}", database_path.to_string_lossy(), suffix))
        };

        if !source.is_file() {
            continue;
        }

        let target = backup_dir.join(format!("{base_name}{suffix}"));
        fs::copy(&source, &target).map_err(|error| {
            format!(
                "Could not back up legacy database file {}: {error}",
                source.display()
            )
        })?;
    }

    Ok(backup_dir)
}

fn row_optional_text(row: &Row<'_>, column: &str) -> Option<String> {
    row.get::<_, Option<String>>(column).ok().flatten()
}

fn row_text(row: &Row<'_>, column: &str, fallback: &str) -> String {
    row_optional_text(row, column)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| fallback.to_string())
}

fn row_number(row: &Row<'_>, column: &str, fallback: f64) -> f64 {
    row.get::<_, Option<f64>>(column)
        .ok()
        .flatten()
        .unwrap_or(fallback)
}

fn row_integer(row: &Row<'_>, column: &str, fallback: i64) -> i64 {
    row.get::<_, Option<i64>>(column)
        .ok()
        .flatten()
        .unwrap_or(fallback)
}

fn read_legacy_songs(connection: &Connection) -> Vec<Value> {
    let Ok(mut statement) = connection.prepare("SELECT * FROM songs ORDER BY rowid DESC") else {
        return Vec::new();
    };

    let Ok(rows) = statement.query_map([], |row| {
        let file_path = row_text(row, "filePath", "");
        let duration = row_number(row, "duration", 0.0).max(0.0);
        let duration_ms = row_number(row, "durationMs", duration * 1000.0).max(0.0);

        Ok(json!({
            "id": row_text(row, "id", &file_path),
            "title": row_text(row, "title", "untitled"),
            "artist": row_text(row, "artist", "unknown artist"),
            "album": row_text(row, "album", "local files"),
            "filePath": file_path,
            "url": "",
            "coverPath": row_optional_text(row, "coverPath"),
            "coverSource": row_text(row, "coverSource", "none"),
            "coverUpdatedAt": row_optional_text(row, "coverUpdatedAt"),
            "liked": row_integer(row, "liked", 0) != 0,
            "playCount": row_integer(row, "playCount", 0).max(0),
            "duration": duration,
            "durationMs": duration_ms,
            "dateAdded": row_text(row, "dateAdded", ""),
            "lastPlayed": row_optional_text(row, "lastPlayed"),
            "volumeGain": row_number(row, "volumeGain", 1.0),
            "playbackPosition": row_number(row, "playbackPosition", 0.0).max(0.0),
            "customVolume": row_number(row, "customVolume", 1.0),
            "sourceType": row_text(row, "sourceType", "local"),
            "sourceTrackId": row_optional_text(row, "sourceTrackId"),
            "sourceUrl": row_optional_text(row, "sourceUrl"),
            "sourceProvider": row_optional_text(row, "sourceProvider"),
            "sourceProviderUrl": row_optional_text(row, "sourceProviderUrl"),
            "sourceMatchScore": row_number(row, "sourceMatchScore", 0.0).max(0.0)
        }))
    }) else {
        return Vec::new();
    };

    rows.filter_map(Result::ok)
        .filter(|song| {
            song.get("filePath")
                .and_then(Value::as_str)
                .map(|path| !path.trim().is_empty())
                .unwrap_or(false)
        })
        .collect()
}

fn read_legacy_settings(connection: &Connection) -> Map<String, Value> {
    let Ok(mut statement) = connection.prepare("SELECT key, value FROM settings") else {
        return Map::new();
    };

    let Ok(rows) = statement.query_map([], |row| {
        let key: String = row.get(0)?;
        let raw: String = row.get(1)?;
        let value = serde_json::from_str::<Value>(&raw).unwrap_or(Value::String(raw));
        Ok((key, value))
    }) else {
        return Map::new();
    };

    rows.filter_map(Result::ok).collect()
}

fn read_legacy_playlists(connection: &Connection) -> Vec<Value> {
    let playlist_rows: Vec<(String, String, i64)> = {
        let Ok(mut statement) = connection.prepare(
            "SELECT id, name, createdAt FROM playlists ORDER BY sortOrder ASC, createdAt DESC",
        ) else {
            return Vec::new();
        };

        let Ok(rows) = statement.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2).unwrap_or(0),
            ))
        }) else {
            return Vec::new();
        };

        rows.filter_map(Result::ok).collect()
    };

    let mut song_statement = connection
        .prepare(
            "SELECT songId FROM playlist_songs WHERE playlistId = ? ORDER BY position ASC, addedAt ASC",
        )
        .ok();

    playlist_rows
        .into_iter()
        .map(|(id, name, created_at)| {
            let song_ids = song_statement
                .as_mut()
                .and_then(|statement| {
                    statement
                        .query_map([id.as_str()], |row| row.get::<_, String>(0))
                        .ok()
                        .map(|rows| rows.filter_map(Result::ok).collect::<Vec<_>>())
                })
                .unwrap_or_default();

            json!({
                "id": id,
                "name": name,
                "songIds": song_ids,
                "createdAt": created_at
            })
        })
        .collect()
}

fn import_legacy_state(
    app: &AppHandle,
    candidate: &LegacyDatabaseCandidate,
) -> Result<PersistedState, String> {
    let backup_dir = copy_legacy_backup(app, &candidate.path)?;
    let snapshot_path = backup_dir.join(
        candidate
            .path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or(LEGACY_DATABASE_NAME),
    );

    let connection = Connection::open(&snapshot_path)
        .map_err(|error| format!("Could not open protected Localtify database snapshot: {error}"))?;
    let _ = connection.execute_batch("PRAGMA busy_timeout = 3000; PRAGMA query_only = ON;");

    let songs = read_legacy_songs(&connection);
    let settings = read_legacy_settings(&connection);
    let playlists = read_legacy_playlists(&connection);

    Ok(PersistedState {
        version: STATE_VERSION,
        initialized: true,
        imported_at_ms: now_ms(),
        imported_from: Some(candidate.path.to_string_lossy().to_string()),
        migration_backup: Some(backup_dir.to_string_lossy().to_string()),
        source_song_count: candidate.song_count.max(songs.len()),
        source_playlist_count: candidate.playlist_count.max(playlists.len()),
        songs,
        settings,
        playlists,
    })
}

fn should_upgrade_state(
    state: &PersistedState,
    best_candidate: Option<&LegacyDatabaseCandidate>,
) -> bool {
    let Some(candidate) = best_candidate else {
        return false;
    };

    if state.version < STATE_VERSION {
        return candidate.song_count > state.songs.len()
            || candidate.playlist_count > state.playlists.len();
    }

    if state.imported_from.is_some() && state.source_song_count == 0 && state.songs.is_empty() {
        return candidate.song_count > 0;
    }

    false
}

fn ensure_state(app: &AppHandle) -> Result<PersistedState, String> {
    let existing = read_state(app)?;
    let candidates = legacy_database_candidates(app);
    let best_candidate = candidates.first();

    if let Some(state) = existing {
        if should_upgrade_state(&state, best_candidate) {
            if let Some(candidate) = best_candidate {
                let upgraded = import_legacy_state(app, candidate)?;
                write_state(app, &upgraded)?;
                return Ok(upgraded);
            }
        }

        if state.initialized {
            return Ok(state);
        }
    }

    if let Some(candidate) = best_candidate {
        let state = import_legacy_state(app, candidate)?;
        write_state(app, &state)?;
        return Ok(state);
    }

    let mut state = empty_state();
    state.initialized = true;
    write_state(app, &state)?;
    Ok(state)
}

fn candidate_payload(candidate: &LegacyDatabaseCandidate) -> Value {
    json!({
        "path": candidate.path.to_string_lossy(),
        "songCount": candidate.song_count,
        "playlistCount": candidate.playlist_count,
        "settingsCount": candidate.settings_count,
        "modifiedMs": candidate.modified_ms
    })
}

fn bootstrap_payload(app: &AppHandle, state: &PersistedState) -> Result<Value, String> {
    let state_file = state_path(app)?;
    let candidates = legacy_database_candidates(app);

    Ok(json!({
        "songs": state.songs,
        "settings": state.settings,
        "playlists": state.playlists,
        "windowsIntegration": {
            "ok": true,
            "supported": false,
            "openAtLogin": false,
            "restoreState": "tauri-migration"
        },
        "database": {
            "ok": true,
            "runtime": "tauri-state",
            "migrated": state.imported_from.is_some(),
            "legacyPreserved": true,
            "sourceDatabase": state.imported_from,
            "migrationBackup": state.migration_backup,
            "statePath": state_file.to_string_lossy(),
            "songCount": state.songs.len(),
            "playlistCount": state.playlists.len(),
            "candidateCount": candidates.len(),
            "candidates": candidates.iter().take(12).map(candidate_payload).collect::<Vec<_>>()
        },
        "discord": {
            "ok": false,
            "supported": false,
            "runtime": "tauri-migration"
        },
        "covers": {
            "ok": true,
            "count": state.songs.len(),
            "runtime": "tauri-migration"
        }
    }))
}

fn load_mutable_state(app: &AppHandle) -> Result<PersistedState, String> {
    let mut state = ensure_state(app)?;
    state.initialized = true;
    state.version = STATE_VERSION;
    Ok(state)
}

#[tauri::command]
pub fn bootstrap_localtify(app: AppHandle) -> Result<Value, String> {
    let state = ensure_state(&app)?;
    bootstrap_payload(&app, &state)
}

#[tauri::command]
pub fn get_localtify_settings(app: AppHandle) -> Result<Value, String> {
    Ok(Value::Object(ensure_state(&app)?.settings))
}

#[tauri::command]
pub fn save_localtify_settings(app: AppHandle, settings: Value) -> Result<Value, String> {
    let Value::Object(settings_map) = settings else {
        return Err("Settings payload must be an object".to_string());
    };

    let mut state = load_mutable_state(&app)?;
    state.settings = settings_map;
    write_state(&app, &state)?;
    Ok(Value::Object(state.settings))
}

#[tauri::command]
pub fn get_localtify_playlists(app: AppHandle) -> Result<Value, String> {
    Ok(Value::Array(ensure_state(&app)?.playlists))
}

#[tauri::command]
pub fn save_localtify_playlists(app: AppHandle, playlists: Value) -> Result<Value, String> {
    let Value::Array(playlist_list) = playlists else {
        return Err("Playlists payload must be an array".to_string());
    };

    let mut state = load_mutable_state(&app)?;
    state.playlists = playlist_list;
    write_state(&app, &state)?;
    Ok(Value::Array(state.playlists))
}

#[tauri::command]
pub fn patch_localtify_song(
    app: AppHandle,
    id: String,
    patch: Value,
) -> Result<Value, String> {
    let Value::Object(patch_map) = patch else {
        return Err("Song patch must be an object".to_string());
    };

    let mut state = load_mutable_state(&app)?;
    let mut updated = Value::Null;

    for song in &mut state.songs {
        let matches = song
            .get("id")
            .and_then(Value::as_str)
            .map(|song_id| song_id == id)
            .unwrap_or(false);
        if !matches {
            continue;
        }

        if let Value::Object(song_map) = song {
            for (key, value) in &patch_map {
                song_map.insert(key.clone(), value.clone());
            }
            updated = Value::Object(song_map.clone());
        }
        break;
    }

    write_state(&app, &state)?;
    Ok(updated)
}

#[tauri::command]
pub fn patch_localtify_songs(
    app: AppHandle,
    ids: Vec<String>,
    patch: Value,
) -> Result<Value, String> {
    let Value::Object(patch_map) = patch else {
        return Err("Song patch must be an object".to_string());
    };
    let id_set: HashSet<String> = ids.into_iter().collect();
    let mut state = load_mutable_state(&app)?;

    for song in &mut state.songs {
        let matches = song
            .get("id")
            .and_then(Value::as_str)
            .map(|song_id| id_set.contains(song_id))
            .unwrap_or(false);
        if !matches {
            continue;
        }

        if let Value::Object(song_map) = song {
            for (key, value) in &patch_map {
                song_map.insert(key.clone(), value.clone());
            }
        }
    }

    write_state(&app, &state)?;
    Ok(Value::Array(state.songs))
}

#[tauri::command]
pub fn delete_localtify_song(app: AppHandle, id: String) -> Result<Value, String> {
    let mut state = load_mutable_state(&app)?;
    state.songs.retain(|song| {
        song.get("id")
            .and_then(Value::as_str)
            .map(|song_id| song_id != id)
            .unwrap_or(true)
    });

    for playlist in &mut state.playlists {
        if let Some(song_ids) = playlist.get_mut("songIds").and_then(Value::as_array_mut) {
            song_ids.retain(|song_id| song_id.as_str().map(|value| value != id).unwrap_or(true));
        }
    }

    write_state(&app, &state)?;
    Ok(Value::Array(state.songs))
}

#[tauri::command]
pub fn clear_localtify_library(app: AppHandle) -> Result<Value, String> {
    let mut state = load_mutable_state(&app)?;
    state.songs.clear();
    for playlist in &mut state.playlists {
        if let Some(song_ids) = playlist.get_mut("songIds").and_then(Value::as_array_mut) {
            song_ids.clear();
        }
    }
    write_state(&app, &state)?;
    Ok(Value::Array(Vec::new()))
}

#[tauri::command]
pub fn backup_localtify_state(app: AppHandle) -> Result<Value, String> {
    let state = load_mutable_state(&app)?;
    let source = write_state(&app, &state)?;
    let backup_dir = app_data_dir(&app)?.join("migration-backups");
    fs::create_dir_all(&backup_dir)
        .map_err(|error| format!("Could not create state backup directory: {error}"))?;
    let target = backup_dir.join(format!("localtify-state-{}.json", now_ms()));
    fs::copy(&source, &target)
        .map_err(|error| format!("Could not back up Tauri state: {error}"))?;
    Ok(json!({ "ok": true, "backupPath": target.to_string_lossy() }))
}

#[tauri::command]
pub fn localtify_database_status(app: AppHandle) -> Result<Value, String> {
    let state = ensure_state(&app)?;
    let candidates = legacy_database_candidates(&app);

    Ok(json!({
        "ok": true,
        "runtime": "tauri-state",
        "legacyPreserved": true,
        "migrated": state.imported_from.is_some(),
        "sourceDatabase": state.imported_from,
        "migrationBackup": state.migration_backup,
        "statePath": state_path(&app)?.to_string_lossy(),
        "songCount": state.songs.len(),
        "settingsCount": state.settings.len(),
        "playlistCount": state.playlists.len(),
        "candidateCount": candidates.len(),
        "candidates": candidates.iter().take(20).map(candidate_payload).collect::<Vec<_>>()
    }))
}

#[tauri::command]
pub fn restore_localtify_legacy_data(app: AppHandle) -> Result<Value, String> {
    if state_path(&app)?.is_file() {
        let _ = backup_localtify_state(app.clone());
    }

    let candidate = find_best_legacy_database(&app)
        .ok_or_else(|| "No existing Electron Localtify database or safety backup was found".to_string())?;
    let state = import_legacy_state(&app, &candidate)?;
    write_state(&app, &state)?;
    bootstrap_payload(&app, &state)
}
