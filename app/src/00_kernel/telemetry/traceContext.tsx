// Pillar N: Context Ubiquity - TraceID available everywhere
// Frontend React Context for trace propagation

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createTraceId, type TraceId } from '../types';

// Re-export for backwards compatibility
export type { TraceId };
export { createTraceId };

/**
 * Frontend trace context
 */
interface TraceContextValue {
  traceId: TraceId;
  userId: string | null;
}

const TraceContext = createContext<TraceContextValue | null>(null);

interface TraceProviderProps {
  children: ReactNode;
  userId: string | null;
}

/**
 * Provides trace context to the application.
 * Creates a new traceId on mount.
 */
export function TraceProvider({ children, userId }: TraceProviderProps) {
  const context = useMemo<TraceContextValue>(
    () => ({
      traceId: createTraceId(),
      userId,
    }),
    [userId]
  );

  return (
    <TraceContext.Provider value={context}>{children}</TraceContext.Provider>
  );
}

/**
 * Get current trace context.
 * Returns null if not within TraceProvider (safe for SSR/testing).
 */
export function useTraceContext(): TraceContextValue | null {
  return useContext(TraceContext);
}

/**
 * Get trace context or throw.
 * Use when context is required.
 */
export function useRequiredTraceContext(): TraceContextValue {
  const ctx = useContext(TraceContext);
  if (!ctx) {
    throw new Error('useRequiredTraceContext must be used within TraceProvider');
  }
  return ctx;
}

/**
 * Context provider interface for logger integration.
 * Allows logger to access trace context.
 */
export interface ContextProvider {
  getOptional(): { traceId: string; userId?: string } | null;
}

/**
 * Create context provider for logger.
 * Call this in a component that has access to trace context.
 */
export function createContextProvider(ctx: TraceContextValue | null): ContextProvider {
  return {
    getOptional: () =>
      ctx
        ? {
            traceId: ctx.traceId,
            userId: ctx.userId ?? undefined,
          }
        : null,
  };
}
