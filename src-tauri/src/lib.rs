use fossic::{Append, OpenOptions, Store};
use tauri::Manager;

// ── Store status command ──────────────────────────────────────────────────────

#[derive(serde::Serialize)]
struct StoreStatus {
    ok: bool,
    stream_count: usize,
}

#[tauri::command]
fn lattica_store_status(store: tauri::State<'_, Store>) -> Result<StoreStatus, String> {
    let streams = store.streams().map_err(|e| e.to_string())?;
    Ok(StoreStatus {
        ok: true,
        stream_count: streams.len(),
    })
}

// ── Entry point ───────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let home = app.path().home_dir()?;
            let store_path = home.join(".lattica/fossic/store.db");

            if let Some(parent) = store_path.parent() {
                std::fs::create_dir_all(parent)?;
            }

            let store = Store::open(&store_path, OpenOptions::default())?;

            store.declare_stream("lattica/canary", "lattica", Some("Startup health ping — proves write path is alive"))?;

            // Canary: prove the write path is alive on startup (ADR-014)
            store.append(Append {
                stream_id: "lattica/canary".to_string(),
                event_type: "startup_ping".to_string(),
                payload: serde_json::json!({ "version": "0.2.0" }),
                ..Append::default()
            })?;

            app.manage(store);
            fossic_tauri::register_commands(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            fossic_tauri::commands::fossic_list_streams,
            fossic_tauri::commands::fossic_list_branches,
            fossic_tauri::commands::fossic_read_range,
            fossic_tauri::commands::fossic_read_one,
            fossic_tauri::commands::fossic_read_by_external_id,
            fossic_tauri::commands::fossic_read_state_at_version,
            fossic_tauri::commands::fossic_subscribe,
            fossic_tauri::commands::fossic_unsubscribe,
            fossic_tauri::commands::fossic_read_by_correlation,
            fossic_tauri::commands::fossic_walk_causation,
            lattica_store_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
