// Branded Types for Yorutsuke
// Pillar A: Nominal Typing - prevents ID mixups at compile time

declare const brand: unique symbol;
type Brand<T, B> = T & { readonly [brand]: B };

// Core Entity IDs
export type UserId = Brand<string, 'UserId'>;
export type ImageId = Brand<string, 'ImageId'>;
export type TransactionId = Brand<string, 'TransactionId'>;
export type ReportId = Brand<string, 'ReportId'>;

// Constructors - only use at system boundaries
export const UserId = (id: string): UserId => id as UserId;
export const ImageId = (id: string): ImageId => id as ImageId;
export const TransactionId = (id: string): TransactionId => id as TransactionId;
export const ReportId = (id: string): ReportId => id as ReportId;

// Type guards
export const isUserId = (id: unknown): id is UserId =>
  typeof id === 'string' && id.length > 0;
export const isImageId = (id: unknown): id is ImageId =>
  typeof id === 'string' && id.length > 0;
export const isTransactionId = (id: unknown): id is TransactionId =>
  typeof id === 'string' && id.length > 0;
