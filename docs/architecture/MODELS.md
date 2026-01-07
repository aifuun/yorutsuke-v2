# Schema Layers

> **Important**: This project uses a two-layer schema approach for type safety and separation of concerns.

## Layer Overview

| Layer | Location | Purpose | Naming |
|-------|----------|---------|--------|
| **Storage** | `00_kernel/storage/types.ts` | SQLite row types | snake_case |
| **Domain** | `01_domains/*/types.ts` | Business model types | camelCase |

## ImageRow vs ReceiptImage

These are **intentionally different** types serving different purposes:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Storage Layer: ImageRow                                                       │
│ File: 00_kernel/storage/types.ts                                             │
│                                                                              │
│ Purpose: SQLite row representation                                           │
│ Scope: LOCAL processing lifecycle only                                       │
│                                                                              │
│ ImageStatus (6 states):                                                      │
│   'pending' → 'compressing' → 'compressed' → 'uploading' → 'uploaded'        │
│        └─────────────────────────────────────────────────────→ 'failed'      │
│                                                                              │
│ Fields: snake_case (matches SQLite columns)                                  │
│   - id, user_id, trace_id, intent_id                                         │
│   - original_path, compressed_path, original_size, compressed_size           │
│   - md5, status, s3_key, ref_count, created_at, uploaded_at                  │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Adapter transforms at boundary
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ Domain Layer: ReceiptImage                                                   │
│ File: 01_domains/receipt/types.ts                                            │
│                                                                              │
│ Purpose: Business domain model                                               │
│ Scope: FULL lifecycle including cloud processing                             │
│                                                                              │
│ ImageStatus (8 states):                                                      │
│   'pending' → 'compressed' → 'uploading' → 'uploaded'                        │
│        │                                       │                             │
│        │                                       ▼                             │
│        │                              'processing' → 'processed' → 'confirmed'│
│        └────────────────────────────────────────────────────→ 'failed'       │
│                                                                              │
│ Fields: camelCase (TypeScript domain model)                                  │
│   - id (ImageId), userId (UserId), intentId, traceId                         │
│   - status (ImageStatus), localPath, s3Key, thumbnailPath                    │
│   - originalSize, compressedSize, createdAt, uploadedAt, processedAt         │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Why Two Types?

1. **Storage isolation**: `ImageRow` matches SQLite schema exactly (snake_case)
2. **Domain purity**: `ReceiptImage` uses TypeScript conventions (camelCase)
3. **Lifecycle scope**: Local processing doesn't need cloud states (`processing`, `processed`, `confirmed`)
4. **Boundary validation**: Adapter transforms ensure type safety (Pillar B)

## Where Each Is Used

| Type | Used In | Purpose |
|------|---------|---------|
| `ImageRow` | `imageDb.ts` adapter | SQLite queries, raw row handling |
| `ReceiptImage` | Services, Stores, Views | Business logic, UI rendering |

## Conversion Example

```typescript
// In adapter layer (imageDb.ts)
function rowToReceiptImage(row: ImageRow): ReceiptImage {
  return {
    id: ImageId(row.id),
    userId: UserId(row.user_id!),
    status: row.status,  // May need mapping for cloud states
    localPath: row.compressed_path ?? row.original_path,
    // ... transform snake_case → camelCase
  };
}
```

---

## References

- [SCHEMA.md](./SCHEMA.md) - Database tables and cloud interfaces
- [STORES.md](./STORES.md) - Runtime state with Zustand
