/**
 * Pillar B: Evolutionary Airlock Template
 *
 * Validate and upcast all external data at system boundaries.
 * Domain layer receives clean, current-version data only.
 *
 * ⚠️ AI DEVELOPMENT NOTE:
 * Use EXPLICIT chain pattern (parseEntity function) only.
 * DO NOT use generic factories - they are too complex for reliable AI generation.
 *
 * ============================================
 * ⚠️ BOUNDARY PROCESSING ORDER (BUG-005)
 * ============================================
 *
 * External data must pass through this pipeline:
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ 1. Schema.parse()  → Validate structure & basic types      │
 * │ 2. upcast()        → Migrate to current version            │
 * │ 3. Branded Type    → Convert IDs to nominal types          │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Example:
 * ```typescript
 * function parseUser(raw: unknown): User {
 *   const v3 = UserV3Schema.parse(raw);           // Step 1: Validate
 *   const current = upcastIfNeeded(v3);            // Step 2: Upcast
 *   return {
 *     ...current,
 *     id: current.id as UserId,                    // Step 3: Brand
 *   };
 * }
 * ```
 *
 * SEE ALSO: Pillar A for Branded Types definition
 */

import { z } from 'zod';

// ============================================
// 1. ERROR TYPES
// ============================================

/**
 * Thrown when incoming data fails schema validation
 */
export class AirlockBreachError extends Error {
  constructor(
    public readonly entity: string,
    public readonly data: unknown,
    public readonly validationErrors?: z.ZodError
  ) {
    super(`Airlock Breach: Invalid ${entity} data`);
    this.name = 'AirlockBreachError';
  }
}

/**
 * Thrown when data upcasting fails
 */
export class DataCorruptionError extends Error {
  constructor(
    public readonly entity: string,
    public readonly fromVersion: number,
    public readonly toVersion: number,
    public readonly cause?: Error
  ) {
    super(`Data Corruption: Failed to upcast ${entity} from v${fromVersion} to v${toVersion}`);
    this.name = 'DataCorruptionError';
  }
}

// ============================================
// 2. SCHEMA DEFINITIONS
// ============================================

/**
 * VERSION EVOLUTION STRATEGY:
 *
 * 1. Keep all schema versions (V1, V2, V3...)
 * 2. Upcast functions only do FIELD MAPPING
 * 3. Zod schemas do TYPE CONVERSION (coerce)
 * 4. Parse function tries versions newest-to-oldest
 */

// --- V1: Legacy schema (old API) ---
const UserV1Schema = z.object({
  version: z.literal(1).optional().default(1),
  id: z.string(),
  email: z.string(),
  name: z.string(),                    // Will be renamed to displayName
  created: z.string(),                 // Will be renamed to createdAt
});
type UserV1 = z.infer<typeof UserV1Schema>;

// --- V2: Intermediate schema ---
const UserV2Schema = z.object({
  version: z.literal(2),
  id: z.string(),
  email: z.string(),
  displayName: z.string(),             // Renamed from 'name'
  createdAt: z.string(),               // Renamed from 'created'
});
type UserV2 = z.infer<typeof UserV2Schema>;

// --- V3: Current schema (Domain uses this) ---
// Note: z.coerce.date() handles both string and Date inputs
const UserV3Schema = z.object({
  version: z.literal(3),
  id: z.string(),
  email: z.string().email(),
  profile: z.object({
    displayName: z.string(),
    avatarUrl: z.string().url().optional(),
  }),
  createdAt: z.coerce.date(),          // Zod does type conversion
  updatedAt: z.coerce.date().optional(),
});
type UserV3 = z.infer<typeof UserV3Schema>;

// Current version alias for Domain
export type User = UserV3;
export const UserSchema = UserV3Schema;
export const CURRENT_USER_VERSION = 3;

// ============================================
// 3. UPCAST FUNCTIONS
// ============================================

/**
 * UPCAST RULE: Only do FIELD MAPPING, not type conversion.
 * Let Zod schema handle type coercion.
 */

/**
 * V1 → V2: Rename fields
 */
function upcastUserV1toV2(v1: UserV1): z.input<typeof UserV2Schema> {
  return {
    version: 2,
    id: v1.id,
    email: v1.email,
    displayName: v1.name,      // Rename: name → displayName
    createdAt: v1.created,     // Rename: created → createdAt
  };
}

/**
 * V2 → V3: Restructure to nested object
 */
function upcastUserV2toV3(v2: UserV2): z.input<typeof UserV3Schema> {
  return {
    version: 3,
    id: v2.id,
    email: v2.email,
    profile: {
      displayName: v2.displayName,   // Move to nested object
      avatarUrl: undefined,          // New optional field
    },
    createdAt: v2.createdAt,         // Keep as string, Zod will coerce
    updatedAt: undefined,            // New optional field
  };
}

// ============================================
// 4. PARSE FUNCTION (EXPLICIT CHAIN)
// ============================================

/**
 * Parse and upcast user data to current version.
 *
 * THIS IS THE ONLY ENTRY POINT for external user data.
 *
 * Pattern:
 * 1. Try current version first (fast path)
 * 2. Try each older version, upcast through chain
 * 3. Throw AirlockBreachError if no match
 *
 * ⚠️ AI NOTE: Copy this pattern for each entity.
 * DO NOT try to abstract into a generic factory.
 */
export function parseUser(raw: unknown): User {
  // 1. Try V3 (current) - fast path for new data
  const v3Result = UserV3Schema.safeParse(raw);
  if (v3Result.success) {
    return v3Result.data;
  }

  // 2. Try V2, upcast to V3
  const v2Result = UserV2Schema.safeParse(raw);
  if (v2Result.success) {
    try {
      const v3Input = upcastUserV2toV3(v2Result.data);
      return UserV3Schema.parse(v3Input);
    } catch (error) {
      throw new DataCorruptionError('User', 2, 3, error instanceof Error ? error : undefined);
    }
  }

  // 3. Try V1, upcast through chain: V1 → V2 → V3
  const v1Result = UserV1Schema.safeParse(raw);
  if (v1Result.success) {
    try {
      const v2Input = upcastUserV1toV2(v1Result.data);
      const v3Input = upcastUserV2toV3(UserV2Schema.parse(v2Input));
      return UserV3Schema.parse(v3Input);
    } catch (error) {
      throw new DataCorruptionError('User', 1, 3, error instanceof Error ? error : undefined);
    }
  }

  // 4. No schema matched - invalid data
  throw new AirlockBreachError('User', raw, v3Result.error);
}

// ============================================
// 5. ADAPTER EXAMPLES
// ============================================

/**
 * API Adapter - fetch with airlock
 */
export async function fetchUser(userId: string): Promise<User> {
  const response = await fetch(`/api/users/${userId}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.status}`);
  }

  const raw = await response.json();
  return parseUser(raw);  // ← Airlock here
}

/**
 * Local Storage Adapter - load with airlock
 */
export function loadUserFromStorage(key: string): User | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {
    const data = JSON.parse(raw);
    return parseUser(data);  // ← Airlock here
  } catch (error) {
    // Clean up corrupted data
    console.error('Failed to load user from storage:', error);
    localStorage.removeItem(key);
    return null;
  }
}

/**
 * Tauri IPC Adapter - invoke with airlock
 */
export async function getUserFromTauri(userId: string): Promise<User> {
  const { invoke } = await import('@tauri-apps/api/tauri');
  const raw = await invoke('get_user', { userId });
  return parseUser(raw);  // ← Airlock here
}

// ============================================
// 6. BATCH PROCESSING
// ============================================

interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  raw: unknown;
}

/**
 * Parse multiple items, collecting errors instead of throwing
 */
export function parseUsers(items: unknown[]): {
  users: User[];
  errors: ParseResult<User>[];
} {
  const users: User[] = [];
  const errors: ParseResult<User>[] = [];

  for (const raw of items) {
    try {
      users.push(parseUser(raw));
    } catch (error) {
      errors.push({
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        raw,
      });
    }
  }

  return { users, errors };
}

// ============================================
// 7. TEMPLATE FOR NEW ENTITIES
// ============================================

/**
 * Copy this template when creating airlock for a new entity:
 *
 * 1. Define schemas: {Entity}V1Schema, {Entity}V2Schema, ...
 * 2. Create upcast functions: upcast{Entity}V1toV2, ...
 * 3. Create parse function: parse{Entity}
 * 4. Use in adapters: fetch{Entity}, load{Entity}FromStorage, ...
 *
 * Example for Order entity:
 *
 * ```typescript
 * const OrderV1Schema = z.object({ ... });
 * const OrderV2Schema = z.object({ ... });
 *
 * function upcastOrderV1toV2(v1: OrderV1): z.input<typeof OrderV2Schema> {
 *   return { version: 2, ... };
 * }
 *
 * export function parseOrder(raw: unknown): Order {
 *   const v2Result = OrderV2Schema.safeParse(raw);
 *   if (v2Result.success) return v2Result.data;
 *
 *   const v1Result = OrderV1Schema.safeParse(raw);
 *   if (v1Result.success) {
 *     const v2Input = upcastOrderV1toV2(v1Result.data);
 *     return OrderV2Schema.parse(v2Input);
 *   }
 *
 *   throw new AirlockBreachError('Order', raw);
 * }
 * ```
 */

// ============================================
// 8. ERROR AIRLOCK (BUG-007)
// ============================================

/**
 * ⚠️ AI-First Rule: Errors are boundary data too, must be transformed in Adapter layer.
 * Never let raw external error codes (e.g., ERR_001) leak into View layer.
 */

/**
 * Domain-level error types
 */
export type AppErrorType =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'UNKNOWN';

export interface AppError {
  readonly type: AppErrorType;
  readonly message: string;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;
}

/**
 * Type guard for AppError
 */
export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    'message' in error &&
    'retryable' in error
  );
}

/**
 * Parse API error response to domain error.
 *
 * ⚠️ AI NOTE: Use this function in every Adapter's catch block.
 * All errors must be transformed through this function before throwing.
 *
 * @example
 * ```typescript
 * async function fetchUser(id: UserId): Promise<User> {
 *   try {
 *     const response = await fetch(`/api/users/${id}`);
 *     if (!response.ok) {
 *       throw await parseApiError(response);
 *     }
 *     return parseUser(await response.json());
 *   } catch (error) {
 *     throw isAppError(error) ? error : parseUnknownError(error);
 *   }
 * }
 * ```
 */
export async function parseApiError(response: Response): Promise<AppError> {
  const status = response.status;

  // Try to parse error body
  let body: Record<string, unknown> = {};
  try {
    body = await response.json();
  } catch {
    // Ignore JSON parse errors
  }

  const message = typeof body.message === 'string'
    ? body.message
    : `HTTP ${status}`;

  // Map HTTP status to domain error type
  const typeMap: Record<number, AppErrorType> = {
    400: 'VALIDATION_ERROR',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    429: 'RATE_LIMITED',
    503: 'SERVICE_UNAVAILABLE',
  };

  return {
    type: typeMap[status] ?? 'UNKNOWN',
    message,
    retryable: status >= 500 || status === 429,
    details: body,
  };
}

/**
 * Parse unknown error (network failures, etc.)
 */
export function parseUnknownError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);

  return {
    type: 'UNKNOWN',
    message,
    retryable: true, // Network errors are usually retryable
  };
}

// ============================================
// USAGE EXAMPLES
// ============================================

/*
// ✅ CORRECT: All external data through airlock

// API response
const user = parseUser(apiResponse.data);

// Local storage
const cachedUser = loadUserFromStorage('current-user');

// Tauri IPC
const user = await getUserFromTauri(userId);

// Batch with error handling
const { users, errors } = parseUsers(apiResponse.items);
if (errors.length > 0) {
  logger.warn('Some users failed to parse', { count: errors.length });
}


// ❌ WRONG: Direct usage without airlock

// No validation
const user = apiResponse.data as User;

// Type assertion
const user: User = JSON.parse(raw);

// Optional chaining for legacy (pollutes domain)
const name = user.profile?.displayName ?? user.displayName ?? user.name;


// ❌ WRONG: Generic factory (too complex for AI)

// Don't do this - use explicit parseUser pattern instead
const parseUser = createAirlock({ ... });
*/
