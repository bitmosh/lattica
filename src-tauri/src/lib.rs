// SPDX-License-Identifier: Apache-2.0
use fossic::{Append, OpenOptions, Store};
use std::process::Command;
use tauri::Manager;

// ── Helpers ───────────────────────────────────────────────────────────────────

fn oa(args: &[&str]) -> Vec<String> {
    args.iter().map(|s| (*s).to_string()).collect()
}

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
struct WatchStatusResponse {
    running: bool,
    pid: Option<u32>,
    stale: Option<bool>,
    pid_file: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct ApprovalItem {
    approval_id: String,
    request_id: String,
    decision_id: String,
    created_at: String,
    expires_at: String,
    status: String,
    actor: Option<String>,
    command: String,
    cwd: String,
    risk_score: f64,
    decision: String,
    reasons: Vec<String>,
    recommended_action: String,
    scope: String,
    schema_version: u32,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct ApprovalsListResponse {
    approvals: Vec<ApprovalItem>,
}

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

async fn run_cli_json(args: Vec<String>) -> CliJsonResponse {
    tauri::async_runtime::spawn_blocking(move || {
        let output = match Command::new(&args[0]).args(&args[1..]).output() {
            Ok(o) => o,
            Err(e) => return CliJsonResponse {
                ok: false,
                error: Some(format!("subprocess failed to start: {}", e)),
                active: None,
                reason: None,
                already_active: None,
                already_inactive: None,
            },
        };
        let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
        match serde_json::from_str::<CliJsonResponse>(&stdout) {
            Ok(parsed) => parsed,
            Err(e) => CliJsonResponse {
                ok: false,
                error: Some(format!("could not parse CLI JSON: {} — stdout: {}", e, stdout)),
                active: None,
                reason: None,
                already_active: None,
                already_inactive: None,
            },
        }
    }).await.unwrap_or_else(|e| CliJsonResponse {
        ok: false,
        error: Some(format!("task panicked: {}", e)),
        active: None,
        reason: None,
        already_active: None,
        already_inactive: None,
    })
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
async fn activate_lockdown(reason: Option<String>) -> CliJsonResponse {
    let reason_str = reason.unwrap_or_default();
    if let Err(e) = validate_reason(&reason_str) {
        return e;
    }
    if reason_str.is_empty() {
        run_cli_json(oa(&["policy-scout", "lockdown", "on", "--json"])).await
    } else {
        let mut args = oa(&["policy-scout", "lockdown", "on", "--reason"]);
        args.push(reason_str);
        args.push("--json".into());
        run_cli_json(args).await
    }
}

#[tauri::command]
async fn deactivate_lockdown() -> CliJsonResponse {
    run_cli_json(oa(&["policy-scout", "lockdown", "off", "--json"])).await
}

#[tauri::command]
async fn restart_watch() -> CliJsonResponse {
    // watch stop takes ~1.6s; run it in its own blocking task so it doesn't
    // block the IPC thread, then start fresh.
    let _ = tauri::async_runtime::spawn_blocking(|| {
        Command::new("policy-scout").args(["watch", "stop"]).output()
    }).await;
    run_cli_json(oa(&["policy-scout", "watch", "start", "--json"])).await
}

#[tauri::command]
async fn ps_watch_status() -> Result<WatchStatusResponse, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let output = Command::new("policy-scout")
            .args(["watch", "status", "--json"])
            .output()
            .map_err(|e| format!("subprocess failed to start: {}", e))?;
        let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
        serde_json::from_str::<WatchStatusResponse>(&stdout)
            .map_err(|e| format!("could not parse watch status JSON: {} — stdout: {}", e, stdout))
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn ps_approvals_list() -> Result<ApprovalsListResponse, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let output = Command::new("policy-scout")
            .args(["approvals", "list", "--json"])
            .output()
            .map_err(|e| format!("subprocess failed to start: {}", e))?;
        let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
        serde_json::from_str::<ApprovalsListResponse>(&stdout)
            .map_err(|e| format!("could not parse approvals list JSON: {} — stdout: {}", e, stdout))
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn ps_approve_once(approval_id: String) -> CliJsonResponse {
    let mut args = oa(&["policy-scout", "approvals", "approve"]);
    args.push(approval_id);
    args.push("--json".into());
    run_cli_json(args).await
}

#[tauri::command]
async fn ps_deny(approval_id: String) -> CliJsonResponse {
    let mut args = oa(&["policy-scout", "approvals", "deny"]);
    args.push(approval_id);
    args.push("--json".into());
    run_cli_json(args).await
}

// ── AI Stack topology polling ─────────────────────────────────────────────────

#[derive(serde::Serialize)]
#[serde(rename_all = "lowercase")]
enum AiNodeStatus { Up, Down }

#[derive(serde::Serialize)]
struct AiRunningModel { name: String, size_vram: u64 }

#[derive(serde::Serialize)]
struct AiLocalModel { name: String, size: u64 }

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AiTopologySnapshot {
    ollama: AiNodeStatus,
    litellm: AiNodeStatus,
    openwebui: AiNodeStatus,
    cerebra: AiNodeStatus,
    running_models: Vec<AiRunningModel>,
    local_models: Vec<AiLocalModel>,
    total_vram_bytes: u64,
    aliases: Vec<String>,
    last_polled: u64,
}

#[derive(serde::Deserialize)] struct OllamaPsResp   { models: Option<Vec<OllamaPsModel>>   }
#[derive(serde::Deserialize)] struct OllamaPsModel  { name: String, size_vram: Option<u64>  }
#[derive(serde::Deserialize)] struct OllamaTagsResp { models: Option<Vec<OllamaTagsModel>> }
#[derive(serde::Deserialize)] struct OllamaTagsModel{ name: String, size: Option<u64>       }
#[derive(serde::Deserialize)] struct LiteLlmResp    { data: Option<Vec<LiteLlmModel>>       }
#[derive(serde::Deserialize)] struct LiteLlmModel   { id: String                            }

fn validate_model_name(model: &str) -> Result<(), String> {
    if model.is_empty() || model.len() > 200 {
        return Err("invalid model name".into());
    }
    Ok(())
}

fn ai_client(timeout_secs: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn poll_ai_stack() -> Result<AiTopologySnapshot, String> {
    let c = ai_client(4)?;
    let (ps, tags, models, webui, cerebra) = tokio::join!(
        c.get("http://localhost:11434/api/ps").send(),
        c.get("http://localhost:11434/api/tags").send(),
        c.get("http://localhost:4000/v1/models").send(),
        c.head("http://localhost:3000").send(),
        c.get("http://localhost:7432/status").send(),
    );

    let ps_json: Option<OllamaPsResp> = match ps {
        Ok(r) if r.status().is_success() => r.json().await.ok(),
        _ => None,
    };
    let tags_json: Option<OllamaTagsResp> = match tags {
        Ok(r) if r.status().is_success() => r.json().await.ok(),
        _ => None,
    };
    let models_json: Option<LiteLlmResp> = match models {
        Ok(r) if r.status().is_success() => r.json().await.ok(),
        _ => None,
    };

    let running_models: Vec<AiRunningModel> = ps_json.as_ref()
        .and_then(|r| r.models.as_ref())
        .map(|ms| ms.iter().map(|m| AiRunningModel { name: m.name.clone(), size_vram: m.size_vram.unwrap_or(0) }).collect())
        .unwrap_or_default();
    let local_models: Vec<AiLocalModel> = tags_json.as_ref()
        .and_then(|r| r.models.as_ref())
        .map(|ms| ms.iter().map(|m| AiLocalModel { name: m.name.clone(), size: m.size.unwrap_or(0) }).collect())
        .unwrap_or_default();
    let aliases: Vec<String> = models_json.as_ref()
        .and_then(|r| r.data.as_ref())
        .map(|data| data.iter().map(|m| m.id.clone()).collect())
        .unwrap_or_default();
    let total_vram_bytes: u64 = running_models.iter().map(|m| m.size_vram).sum();
    let last_polled = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64;

    Ok(AiTopologySnapshot {
        ollama:    if ps_json.is_some()     { AiNodeStatus::Up } else { AiNodeStatus::Down },
        litellm:   if models_json.is_some() { AiNodeStatus::Up } else { AiNodeStatus::Down },
        openwebui: if webui.is_ok()         { AiNodeStatus::Up } else { AiNodeStatus::Down },
        cerebra:   if cerebra.is_ok()       { AiNodeStatus::Up } else { AiNodeStatus::Down },
        running_models, local_models, aliases, total_vram_bytes, last_polled,
    })
}

#[tauri::command]
async fn ollama_load_model(model: String) -> Result<(), String> {
    validate_model_name(&model)?;
    let body = serde_json::json!({ "model": model, "prompt": "", "keep_alive": "10m" });
    let r = ai_client(30)?.post("http://localhost:11434/api/generate").json(&body).send().await.map_err(|e| e.to_string())?;
    if !r.status().is_success() { return Err(format!("Ollama load failed: {}", r.status())); }
    Ok(())
}

#[tauri::command]
async fn ollama_unload_model(model: String) -> Result<(), String> {
    validate_model_name(&model)?;
    let body = serde_json::json!({ "model": model, "prompt": "", "keep_alive": 0 });
    let r = ai_client(10)?.post("http://localhost:11434/api/generate").json(&body).send().await.map_err(|e| e.to_string())?;
    if !r.status().is_success() { return Err(format!("Ollama unload failed: {}", r.status())); }
    Ok(())
}

// ── Entry point ───────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let home = app.path().home_dir()?;
            // LATTICA_FOSSIC_STORE overrides the default for federation consumers
            // (Cerebra, LumaWeave, Policy Scout) that open the store directly.
            let store_path = std::env::var_os("LATTICA_FOSSIC_STORE")
                .map(std::path::PathBuf::from)
                .unwrap_or_else(|| home.join(".lattica/fossic/store.db"));

            if let Some(parent) = store_path.parent() {
                std::fs::create_dir_all(parent)?;
            }

            let store = Store::open(&store_path, OpenOptions::default())?;

            store.declare_stream("lattica/canary", "lattica", Some("Startup health ping — proves write path is alive"))?;

            // Canary: prove the write path is alive on startup (ADR-014)
            store.append(Append {
                stream_id: "lattica/canary".to_string(),
                event_type: "startup_ping".to_string(),
                payload: serde_json::json!({ "version": env!("CARGO_PKG_VERSION") }),
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
            ps_watch_status,
            ps_approvals_list,
            ps_approve_once,
            ps_deny,
            poll_ai_stack,
            ollama_load_model,
            ollama_unload_model,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // validate_reason

    #[test]
    fn reason_empty_is_ok() {
        assert!(validate_reason("").is_ok());
    }

    #[test]
    fn reason_normal_is_ok() {
        assert!(validate_reason("routine maintenance window").is_ok());
    }

    #[test]
    fn reason_exactly_500_chars_is_ok() {
        assert!(validate_reason(&"x".repeat(500)).is_ok());
    }

    #[test]
    fn reason_501_chars_is_err() {
        assert!(validate_reason(&"x".repeat(501)).is_err());
    }

    #[test]
    fn reason_nul_byte_is_err() {
        let r = validate_reason("bad\0value");
        assert!(r.is_err());
    }

    // validate_model_name

    #[test]
    fn model_name_valid_is_ok() {
        assert!(validate_model_name("qwen2.5:7b").is_ok());
    }

    #[test]
    fn model_name_empty_is_err() {
        assert!(validate_model_name("").is_err());
    }

    #[test]
    fn model_name_exactly_200_chars_is_ok() {
        assert!(validate_model_name(&"a".repeat(200)).is_ok());
    }

    #[test]
    fn model_name_201_chars_is_err() {
        assert!(validate_model_name(&"a".repeat(201)).is_err());
    }
}
