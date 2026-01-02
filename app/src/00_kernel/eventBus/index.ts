/**
 * @module EventBus
 * @exposes [emit, on, broadcast, useAppEvent, useAppEvents]
 * @triggers [image:*, upload:*, network:*, data:*]
 * @listens None (consumers listen to events)
 *
 * Type-safe event bus for cross-component communication.
 * Uses browser CustomEvent API for decoupled messaging.
 */

export { emit, on, broadcast } from './eventBus';
export { useAppEvent, useAppEvents } from './useAppEvent';
export type {
  AppEvents,
  AppEventKey,
  UploadErrorType,
  ImageSource,
  ImageStage,
} from './types';
