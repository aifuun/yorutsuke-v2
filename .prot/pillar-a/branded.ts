/**
 * Pillar A: Branded Types Template
 *
 * Copy and adapt these patterns for your domain entities.
 * Eliminates "Primitive Obsession" bugs through type safety.
 */

import { z } from 'zod';

// ============================================
// 1. BRANDED TYPE FACTORY
// ============================================

/**
 * Creates a branded type.
 * Usage: type UserId = Brand<string, 'UserId'>;
 */
declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

// ============================================
// 2. COMMON ID TYPES
// ============================================

// String-based IDs
export type UserId = Brand<string, 'UserId'>;
export type OrderId = Brand<string, 'OrderId'>;
export type ProductId = Brand<string, 'ProductId'>;
export type SessionId = Brand<string, 'SessionId'>;
export type TraceId = Brand<string, 'TraceId'>;
export type IntentId = Brand<string, 'IntentId'>;

// Number-based IDs (for legacy systems)
export type LegacyId = Brand<number, 'LegacyId'>;

// ============================================
// 3. VALUE OBJECTS
// ============================================

// Money (in cents to avoid floating point)
export type Money = Brand<number, 'Money'>;

// Email with validation
export type Email = Brand<string, 'Email'>;

// URL
export type Url = Brand<string, 'Url'>;

// ============================================
// 4. BOUNDARY CONVERSION FUNCTIONS
// ============================================

/**
 * Generic ID creator with optional validation
 */
function createIdConverter<T extends string>(
  name: string,
  validate?: (raw: string) => boolean
) {
  return (raw: string): T => {
    if (!raw || raw.trim() === '') {
      throw new TypeError(`${name} cannot be empty`);
    }
    if (validate && !validate(raw)) {
      throw new TypeError(`Invalid ${name} format: ${raw}`);
    }
    return raw as T;
  };
}

// ID Converters
export const toUserId = createIdConverter<UserId>('UserId');
export const toOrderId = createIdConverter<OrderId>('OrderId');
export const toProductId = createIdConverter<ProductId>('ProductId');
export const toSessionId = createIdConverter<SessionId>('SessionId');
export const toTraceId = createIdConverter<TraceId>('TraceId');
export const toIntentId = createIdConverter<IntentId>('IntentId');

// Value Object Converters
export function toMoney(cents: number): Money {
  if (!Number.isInteger(cents)) {
    throw new TypeError('Money must be in whole cents');
  }
  if (cents < 0) {
    throw new TypeError('Money cannot be negative');
  }
  return cents as Money;
}

export function toEmail(raw: string): Email {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(raw)) {
    throw new TypeError(`Invalid email format: ${raw}`);
  }
  return raw as Email;
}

export function toUrl(raw: string): Url {
  try {
    new URL(raw);
    return raw as Url;
  } catch {
    throw new TypeError(`Invalid URL format: ${raw}`);
  }
}

// ============================================
// 5. ZOD SCHEMA INTEGRATION
// ============================================

/**
 * Create a Zod schema for branded types
 */
function brandedString<T extends string>(
  name: string,
  validate?: (val: string) => boolean
) {
  return z.string().refine(
    (val) => val.length > 0 && (!validate || validate(val)),
    { message: `Invalid ${name}` }
  ).transform((val) => val as T);
}

// Zod Schemas
export const UserIdSchema = brandedString<UserId>('UserId');
export const OrderIdSchema = brandedString<OrderId>('OrderId');
export const ProductIdSchema = brandedString<ProductId>('ProductId');
export const IntentIdSchema = brandedString<IntentId>('IntentId');

export const EmailSchema = z.string().email().transform((val) => val as Email);

export const MoneySchema = z.number().int().nonnegative().transform((val) => val as Money);

// ============================================
// 6. ENTITY EXAMPLE
// ============================================

/**
 * Example: Order entity with branded types
 */
export interface Order {
  id: OrderId;
  userId: UserId;
  items: Array<{
    productId: ProductId;
    quantity: number;
    price: Money;
  }>;
  total: Money;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered';
  createdAt: Date;
}

// Zod schema for Order
export const OrderSchema = z.object({
  id: OrderIdSchema,
  userId: UserIdSchema,
  items: z.array(z.object({
    productId: ProductIdSchema,
    quantity: z.number().int().positive(),
    price: MoneySchema,
  })),
  total: MoneySchema,
  status: z.enum(['pending', 'confirmed', 'shipped', 'delivered']),
  createdAt: z.date(),
});

// ============================================
// 7. API BOUNDARY EXAMPLE
// ============================================

/**
 * Example: Parsing API response at boundary
 */
export function parseOrderFromApi(raw: unknown): Order {
  // Validates AND transforms to branded types
  return OrderSchema.parse(raw);
}

/**
 * Example: URL param conversion
 */
export function parseOrderIdFromUrl(param: string | undefined): OrderId {
  if (!param) {
    throw new Error('Order ID is required');
  }
  return toOrderId(param);
}

// ============================================
// 8. UTILITY: Generate new IDs
// ============================================

export function generateUserId(): UserId {
  return `user_${crypto.randomUUID()}` as UserId;
}

export function generateOrderId(): OrderId {
  return `order_${crypto.randomUUID()}` as OrderId;
}

export function generateIntentId(): IntentId {
  return crypto.randomUUID() as IntentId;
}

export function generateTraceId(): TraceId {
  return crypto.randomUUID() as TraceId;
}

// ============================================
// 9. TYPE GUARDS (for runtime checks)
// ============================================

export function isUserId(value: unknown): value is UserId {
  return typeof value === 'string' && value.length > 0;
}

export function isOrderId(value: unknown): value is OrderId {
  return typeof value === 'string' && value.startsWith('order_');
}

// ============================================
// USAGE EXAMPLES
// ============================================

/*
// ✅ CORRECT USAGE

// At API boundary
const order = parseOrderFromApi(apiResponse);

// In route handler
const orderId = parseOrderIdFromUrl(req.params.id);
const order = await orderService.get(orderId);

// Creating new entities
const newOrder: Order = {
  id: generateOrderId(),
  userId: toUserId(currentUser.id),
  items: [...],
  total: toMoney(9999),  // $99.99 in cents
  status: 'pending',
  createdAt: new Date(),
};


// ❌ WRONG USAGE

// Direct string assignment
const orderId: OrderId = '123';  // Type error!

// Swapped arguments (caught by compiler)
function getOrder(orderId: OrderId, userId: UserId) { }
getOrder(userId, orderId);  // Type error!

// Passing string where branded type expected
await orderService.get('123');  // Type error!
*/
