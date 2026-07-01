// Mock @tauri-apps/api/core for browser-based Playwright tests.
// invoke returns the canned offline/down response for each known command
// so the app renders in its "services unavailable" state rather than crashing.

const MOCK_RESPONSES: Record<string, unknown> = {
  fossic_subscribe: 'mock-sub-id',
  fossic_unsubscribe: null,
  fossic_list_streams: [],
  fossic_list_branches: [],
  lattica_store_status: { ok: true, stream_count: 0 },
  ps_watch_status: { running: false, pid: null, stale: null, pid_file: '/tmp/mock.pid' },
  ps_approvals_list: { approvals: [] },
  activate_lockdown: { ok: false, error: 'mock env' },
  deactivate_lockdown: { ok: false, error: 'mock env' },
  restart_watch: { ok: false, error: 'mock env' },
  poll_ai_stack: {
    ollama: 'down', litellm: 'down', openwebui: 'down', cerebra: 'down',
    runningModels: [], localModels: [], totalVramBytes: 0, aliases: [], lastPolled: 0,
  },
  ollama_load_model: null,
  ollama_unload_model: null,
};

export async function invoke<T>(cmd: string, _args?: Record<string, unknown>): Promise<T> {
  return (Object.prototype.hasOwnProperty.call(MOCK_RESPONSES, cmd)
    ? MOCK_RESPONSES[cmd]
    : null) as T;
}
