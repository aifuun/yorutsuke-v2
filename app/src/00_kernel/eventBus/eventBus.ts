// Event Bus - Type-safe cross-component communication
// Pillar G: Traceability - AI-traceable event flow

import { logger, EVENTS } from '../telemetry';
import type { AppEvents, AppEventKey } from './types';

/**
 * Emit an event to the event bus
 *
 * @trigger Varies by eventName
 * @emits CustomEvent with typed payload
 *
 * @example
 * emit('upload:complete', { id: ImageId('xxx'), s3Key: '2025/12/26/xxx.webp' });
 */
export function emit<K extends AppEventKey>(
  eventName: K,
  data: AppEvents[K]
): void {
  if (import.meta.env.DEV) {
    logger.debug(EVENTS.EVENT_EMITTED, { event: eventName, data });
  }

  window.dispatchEvent(
    new CustomEvent(eventName, { detail: data })
  );
}

/**
 * Subscribe to an event on the event bus
 * Returns an unsubscribe function
 *
 * @listen Varies by eventName
 *
 * @example
 * const unsubscribe = on('upload:complete', (data) => {
 *   console.log('Upload completed:', data.id);
 * });
 * // Later: unsubscribe();
 */
export function on<K extends AppEventKey>(
  eventName: K,
  handler: (data: AppEvents[K]) => void
): () => void {
  const listener = (e: Event) => {
    const customEvent = e as CustomEvent<AppEvents[K]>;
    handler(customEvent.detail);
  };

  window.addEventListener(eventName, listener);

  if (import.meta.env.DEV) {
    logger.debug(EVENTS.EVENT_SUBSCRIBED, { event: eventName });
  }

  return () => {
    window.removeEventListener(eventName, listener);
    if (import.meta.env.DEV) {
      logger.debug('event_unsubscribed', { event: eventName });
    }
  };
}

/**
 * Broadcast an event to all listeners
 * Returns after microtask queue processes (does NOT wait for async handlers)
 *
 * Note: This is fire-and-forget. If you need response from handlers,
 * consider the request-response pattern (see #29).
 *
 * @example
 * await broadcast('data:refresh', { source: 'upload' });
 */
export function broadcast<K extends AppEventKey>(
  eventName: K,
  data: AppEvents[K]
): Promise<void> {
  return new Promise((resolve) => {
    emit(eventName, data);
    // Use microtask to ensure synchronous handlers complete
    queueMicrotask(resolve);
  });
}
