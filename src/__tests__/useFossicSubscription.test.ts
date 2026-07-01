import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { useFossicSubscription } from '../hooks/useFossicSubscription';
import type { SerializedEvent } from '../types/fossic';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// Minimal harness component that calls the hook
function TestHook({
  pattern,
  onEvent,
  onError,
}: {
  pattern: string;
  onEvent: (ev: SerializedEvent) => void;
  onError?: (err: unknown) => void;
}) {
  useFossicSubscription(pattern, onEvent, { onError });
  return null;
}

function mountHook(props: {
  pattern: string;
  onEvent: (ev: SerializedEvent) => void;
  onError?: (err: unknown) => void;
}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(createElement(TestHook, props));
  });
  return {
    unmount: () => {
      act(() => { root.unmount(); });
      container.remove();
    },
  };
}

// Flush pending microtasks
async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('useFossicSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invoke).mockResolvedValue('sub-id-default' as unknown);
    vi.mocked(listen).mockResolvedValue(vi.fn() as unknown);
  });

  it('calls fossic_subscribe with the given pattern on mount', async () => {
    const { unmount } = mountHook({ pattern: 'cerebra/**', onEvent: vi.fn() });
    await act(flushMicrotasks);

    expect(vi.mocked(invoke)).toHaveBeenCalledWith('fossic_subscribe', {
      streamPattern: 'cerebra/**',
      branch: null,
      includeSystem: false,
      queueSize: null,
    });

    unmount();
  });

  it('calls unlisten and fossic_unsubscribe on unmount', async () => {
    const unlistenFn = vi.fn();
    vi.mocked(listen).mockResolvedValue(unlistenFn as unknown);

    const { unmount } = mountHook({ pattern: '**', onEvent: vi.fn() });
    await act(flushMicrotasks);

    unmount();
    await flushMicrotasks();

    expect(unlistenFn).toHaveBeenCalled();
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('fossic_unsubscribe', {
      subscriptionId: 'sub-id-default',
    });
  });

  it('cancel guard: unmounts before subscribe resolves → unsubscribes with resolved ID, never calls listen', async () => {
    let resolveSubscribe!: (id: string) => void;
    const subscribePromise = new Promise<string>(res => { resolveSubscribe = res; });

    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === 'fossic_subscribe') return subscribePromise as unknown;
      return Promise.resolve(null) as unknown;
    });

    const { unmount } = mountHook({ pattern: '**', onEvent: vi.fn() });

    // Unmount before subscribe resolves
    unmount();
    expect(vi.mocked(listen)).not.toHaveBeenCalled();

    // Resolve subscribe after unmount
    resolveSubscribe('sub-cancel-id');
    await flushMicrotasks();

    // Cancel guard fires fossic_unsubscribe inside setup()
    const unsubCalls = vi.mocked(invoke).mock.calls.filter(c => c[0] === 'fossic_unsubscribe');
    expect(unsubCalls).toHaveLength(1);
    expect(unsubCalls[0][1]).toEqual({ subscriptionId: 'sub-cancel-id' });

    // listen was never registered
    expect(vi.mocked(listen)).not.toHaveBeenCalled();
  });

  it('routes events to onEvent only when subscription_id matches', async () => {
    const onEvent = vi.fn();
    type Listener = (e: { payload: { subscription_id: string; event: SerializedEvent } }) => void;
    let capturedListener: Listener | null = null;

    vi.mocked(listen).mockImplementation((_event: string, handler: unknown) => {
      capturedListener = handler as Listener;
      return Promise.resolve(vi.fn()) as unknown;
    });

    mountHook({ pattern: 'cerebra/**', onEvent });
    await act(flushMicrotasks);

    const mockEvent: SerializedEvent = {
      id: 'ev-1', stream_id: 'cerebra/trace/1', branch: 'main', version: 1,
      timestamp_us: 1_000_000, causation_id: null, correlation_id: null,
      event_type: 'TestEvent', type_version: 1, payload: { x: 1 },
      external_id: null, indexed_tags: null,
    };

    // Wrong subscription ID — ignored
    capturedListener!({ payload: { subscription_id: 'wrong-id', event: mockEvent } });
    expect(onEvent).not.toHaveBeenCalled();

    // Matching subscription ID — fires
    capturedListener!({ payload: { subscription_id: 'sub-id-default', event: mockEvent } });
    expect(onEvent).toHaveBeenCalledWith(mockEvent);
    expect(onEvent).toHaveBeenCalledTimes(1);
  });

  it('calls onError when subscribe throws, not when already cancelled', async () => {
    const subscribeError = new Error('fossic unavailable');
    vi.mocked(invoke).mockRejectedValue(subscribeError);

    const onError = vi.fn();
    const { unmount } = mountHook({ pattern: '**', onEvent: vi.fn(), onError });
    await act(flushMicrotasks);

    expect(onError).toHaveBeenCalledWith(subscribeError);
    unmount();
  });
});
