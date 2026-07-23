mod state;

use tauri::Manager;

#[tauri::command]
fn localtify_window_minimize(window: tauri::WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|error| error.to_string())
}

#[tauri::command]
fn localtify_window_toggle_maximize(window: tauri::WebviewWindow) -> Result<(), String> {
    let maximized = window.is_maximized().map_err(|error| error.to_string())?;
    if maximized {
        window.unmaximize().map_err(|error| error.to_string())
    } else {
        window.maximize().map_err(|error| error.to_string())
    }
}

#[tauri::command]
fn localtify_window_close(window: tauri::WebviewWindow) -> Result<(), String> {
    window.close().map_err(|error| error.to_string())
}

#[tauri::command]
fn localtify_window_start_dragging(window: tauri::WebviewWindow) -> Result<(), String> {
    window.start_dragging().map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                window.set_decorations(false)?;
                window.show()?;
                window.set_focus()?;
            }
            Ok(())
        })
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_decorations(false);
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![
            state::bootstrap_localtify,
            state::get_localtify_settings,
            state::save_localtify_settings,
            state::get_localtify_playlists,
            state::save_localtify_playlists,
            state::patch_localtify_song,
            state::patch_localtify_songs,
            state::delete_localtify_song,
            state::clear_localtify_library,
            state::backup_localtify_state,
            state::localtify_database_status,
            state::restore_localtify_legacy_data,
            localtify_window_minimize,
            localtify_window_toggle_maximize,
            localtify_window_close,
            localtify_window_start_dragging
        ])
        .run(tauri::generate_context!())
        .expect("failed to run localtify");
}
