// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { SerializedEvent, FossicEventPayload } from '../types/fossic';

interface Options {
  onError?: (err: unknown) => void;
}

export function useFossicSubscription(
  streamPattern: string,
  onEvent: (event: SerializedEvent) => void,
  options?: Options,
): void {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const onErrorRef = useRef(options?.onError);
  onErrorRef.current = options?.onError;
  const subIdRef = useRef<string | null>(null);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    let cancelled = false;

    async function setup() {
      const subId = await invoke<string>('fossic_subscribe', {
        streamPattern,
        branch: null,
        includeSystem: false,
        queueSize: null,
      });
      if (cancelled) {
        invoke('fossic_unsubscribe', { subscriptionId: subId }).catch(() => {});
        return;
      }
      subIdRef.current = subId;

      unlisten = await listen<FossicEventPayload>('fossic:event', e => {
        if (e.payload.subscription_id !== subId) return;
        onEventRef.current(e.payload.event);
      });
    }

    setup().catch(err => {
      if (!cancelled) onErrorRef.current?.(err);
    });

    return () => {
      cancelled = true;
      unlisten?.();
      if (subIdRef.current) {
        invoke('fossic_unsubscribe', { subscriptionId: subIdRef.current }).catch(() => {});
        subIdRef.current = null;
      }
    };
  }, [streamPattern]);
}
