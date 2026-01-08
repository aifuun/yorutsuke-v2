# ADR-003: Image Compression Strategy

**Status**: Accepted
**Date**: 2025-12

## Context

Receipt images need to be compressed before upload to reduce storage costs and bandwidth. The compression strategy must:
- Maintain OCR readability (primary requirement)
- Minimize file size for cost efficiency
- Support duplicate detection via hash

## Decision

### Compression Pipeline

```
Original Image → Resize (max 1024px) → Grayscale → WebP 75% → MD5 Hash
```

### Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Format | WebP | Best compression ratio for images |
| Quality | 75% | Balance between size and OCR accuracy |
| Max dimension | 1024px | Sufficient for text recognition |
| Color | Grayscale | ~60% size reduction, receipts are mostly text |

### MD5 Timing

Calculate hash **after** compression, not on original file:
- Same original compressed twice = same hash (deterministic)
- Enables deduplication even if user re-drops same image
- Hash stored in `images.md5_hash` column

### Output Location

```
std::env::temp_dir().join("yorutsuke-v2")
```

Temporary directory for compressed files, cleaned up after upload.

## Consequences

### Positive
- ~80% file size reduction (typical 2MB → 200KB)
- Deterministic hashing enables reliable deduplication
- Grayscale sufficient for OCR (Nova Lite tested)

### Negative
- Color information lost (acceptable for receipts)
- Compression adds ~200ms processing time
- Temp files need cleanup on failure

### Implementation

- Rust: `src-tauri/src/commands/compress.rs`
- DB: `images.md5_hash` for deduplication
- Cleanup: Track `compressedPath`, delete in catch block

## Related

- [SCHEMA.md](../SCHEMA.md) - images table definition
- Issue #5 - Original implementation
