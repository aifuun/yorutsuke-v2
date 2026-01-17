// Branded Types for Yorutsuke
// Pillar A: Nominal Typing - prevents ID mixups at compile time

declare const brand: unique symbol;
type Brand<T, B> = T & { readonly [brand]: B };

// Core Entity IDs
export type UserId = Brand<string, 'UserId'>;
export type ImageId = Brand<string, 'ImageId'>;
export type TransactionId = Brand<string, 'TransactionId'>;
export type ReportId = Brand<string, 'ReportId'>;

// DEPRECATED v11: IntentId no longer used (removed in Issue #145)
// Rationale: Backend never implemented idempotency checks, traceId provides sufficient tracking
// Kept for backward compatibility only - do not use in new code
export type IntentId = Brand<string, 'IntentId'>;

// Pillar N: Trace-ID for observability
// Tracks single receipt lifecycle from drop to confirm
export type TraceId = Brand<string, 'TraceId'>;

// Constructors - only use at system boundaries
export const UserId = (id: string): UserId => id as UserId;
export const ImageId = (id: string): ImageId => id as ImageId;
export const TransactionId = (id: string): TransactionId => id as TransactionId;
export const ReportId = (id: string): ReportId => id as ReportId;

// DEPRECATED v11: IntentId constructor and generator (Issue #145)
// Do not use in new code - use traceId instead
export const IntentId = (id: string): IntentId => id as IntentId;
export const createIntentId = (): IntentId => {
  try {
    return `intent-${crypto.randomUUID()}` as IntentId;
  } catch {
    // Fallback for environments without crypto.randomUUID
    return `intent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` as IntentId;
  }
};

// TraceId constructor - creates new trace for each receipt lifecycle
export const TraceId = (id: string): TraceId => id as TraceId;
export const createTraceId = (): TraceId => {
  try {
    return `trace-${crypto.randomUUID()}` as TraceId;
  } catch {
    // Fallback for environments without crypto.randomUUID
    return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` as TraceId;
  }
};

// Type guards
export const isUserId = (id: unknown): id is UserId =>
  typeof id === 'string' && id.length > 0;
export const isImageId = (id: unknown): id is ImageId =>
  typeof id === 'string' && id.length > 0;
export const isTransactionId = (id: unknown): id is TransactionId =>
  typeof id === 'string' && id.length > 0;
