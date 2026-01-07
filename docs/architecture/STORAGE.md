# Local File Storage

> Disk usage and directory structure on the user's computer.

## Strategy: Permanent Local Retention

Compressed receipt images are **permanently stored locally** for:
1. **Offline viewing**: Verify AI results against original receipt
2. **Transaction confirmation**: Compare extracted data with image
3. **Local-first access**: No network required for image viewing

## Directory Structure

```
~/.yorutsuke/
├── images/           # Compressed receipt images (permanent)
│   └── {uuid}.webp   # ~50-100KB each
├── logs/             # Daily log files (7-day retention)
│   └── {date}.jsonl
└── yorutsuke.db      # SQLite database
```

**Platform paths**:
| OS | Base Path |
|----|-----------|
| macOS | `~/Library/Application Support/yorutsuke-v2/` |
| Linux | `~/.local/share/yorutsuke-v2/` |
| Windows | `C:\Users\<user>\AppData\Local\yorutsuke-v2\` |

## Storage Estimation

| Period | Images (50/day) | Size |
|--------|-----------------|------|
| Daily | 50 | 5 MB |
| Monthly | 1,500 | 150 MB |
| Yearly | 18,000 | 1.8 GB |

## Lifecycle

```
拖入 → 压缩 → 保存本地 → 上传S3 → 本地永久保留
              │                         │
              └── ~/.yorutsuke/images/  │
                                        │
                           S3: 30天后自动删除
```

## Cleanup (Optional)

- **Manual**: Settings → "清除数据" button
- **Selective**: Delete images older than N days (future feature)

---

## Cloud Storage (S3)

### Bucket Structure

```
yorutsuke-images-{env}-{account}/
└── uploads/
    └── {userId}/
        └── {date}/
            └── {uuid}.webp
```

**Example**: `uploads/abc123/2025-12-28/550e8400-e29b-41d4.webp`

### Lifecycle Rules

| Tier | S3 Retention | Rule |
|------|--------------|------|
| Guest/Free | 30 days | Lifecycle expiration |
| Basic/Pro | Permanent | No expiration (paying users) |

| Rule | Action | Condition |
|------|--------|-----------|
| Expiration | Delete | 30 days (Guest/Free only) |
| Transition | Intelligent-Tiering | 7 days |

**Implementation**: S3 objects tagged with `tier=free` get lifecycle rule; `tier=paid` objects are exempt.

---

## References

- [SCHEMA.md](./SCHEMA.md) - Database tables and cloud interfaces
- [MODELS.md](./MODELS.md) - Row vs Domain mappings
