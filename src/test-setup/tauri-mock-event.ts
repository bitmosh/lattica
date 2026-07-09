// SPDX-License-Identifier: Apache-2.0
// Mock @tauri-apps/api/event for browser-based Playwright tests.
// listen() returns a no-op unlistener; no events are ever delivered.

export type UnlistenFn = () => void;

export async function listen<_T>(
  _event: string,
  _handler: (e: { payload: _T }) => void,
): Promise<UnlistenFn> {
  return () => {};
}
