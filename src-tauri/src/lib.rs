use fossic::{Append, OpenOptions, Store};
use std::process::Command;
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

// ── Policy Scout CLI commands ─────────────────────────────────────────────────

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct CliJsonResponse {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    active: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    already_active: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    already_inactive: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

fn run_cli_json(args: &[&str]) -> CliJsonResponse {
    let output = match Command::new(args[0]).args(&args[1..]).output() {
        Ok(o) => o,
        Err(e) => {
            return CliJsonResponse {
                ok: false,
                error: Some(format!("subprocess failed to start: {}", e)),
                active: None,
                reason: None,
                already_active: None,
                already_inactive: None,
            }
        }
    };
    let stdout = String::from_utf8_lossy(&output.stdout);
    match serde_json::from_str::<CliJsonResponse>(&stdout) {
        Ok(parsed) => parsed,
        Err(e) => CliJsonResponse {
            ok: false,
            error: Some(format!(
                "could not parse CLI JSON: {} — stdout: {}",
                e, stdout
            )),
            active: None,
            reason: None,
            already_active: None,
            already_inactive: None,
        },
    }
}

fn validate_reason(reason: &str) -> Result<(), CliJsonResponse> {
    if reason.len() > 500 {
        return Err(CliJsonResponse {
            ok: false,
            error: Some("reason exceeds 500 characters".into()),
            active: None,
            reason: None,
            already_active: None,
            already_inactive: None,
        });
    }
    if reason.contains('\0') {
        return Err(CliJsonResponse {
            ok: false,
            error: Some("reason contains NUL byte".into()),
            active: None,
            reason: None,
            already_active: None,
            already_inactive: None,
        });
    }
    Ok(())
}

#[tauri::command]
fn activate_lockdown(reason: Option<String>) -> CliJsonResponse {
    let reason_str = reason.unwrap_or_default();
    if let Err(e) = validate_reason(&reason_str) {
        return e;
    }
    if reason_str.is_empty() {
        run_cli_json(&["policy-scout", "lockdown", "on", "--json"])
    } else {
        run_cli_json(&[
            "policy-scout",
            "lockdown",
            "on",
            "--reason",
            &reason_str,
            "--json",
        ])
    }
}

#[tauri::command]
fn deactivate_lockdown() -> CliJsonResponse {
    run_cli_json(&["policy-scout", "lockdown", "off", "--json"])
}

#[tauri::command]
fn restart_watch() -> CliJsonResponse {
    // best-effort stop; result ignored
    let _ = Command::new("policy-scout").args(["watch", "stop"]).output();
    run_cli_json(&["policy-scout", "watch", "start", "--json"])
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
            activate_lockdown,
            deactivate_lockdown,
            restart_watch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
