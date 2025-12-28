# SCHEMA.md Template

> Data model - Local + Cloud

## Overview

**Version**: [Schema version]
**Last Updated**: [Date]

## Entity Relationship

```
┌──────────┐       ┌──────────┐       ┌──────────┐
│   User   │ 1───n │  Order   │ n───n │  Item    │
└──────────┘       └──────────┘       └──────────┘
```

## Local Storage (SQLite / IndexedDB)

### Table: users
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PK | User ID (branded type) |
| email | TEXT | UNIQUE, NOT NULL | User email |
| name | TEXT | NOT NULL | Display name |
| created_at | INTEGER | NOT NULL | Unix timestamp |
| updated_at | INTEGER | NOT NULL | Unix timestamp |
| version | INTEGER | NOT NULL | Optimistic lock |

**Indexes**:
- `idx_users_email` on (email)

---

### Table: [table_name]
...

## Cloud Storage (DynamoDB)

### Table: Users
| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| PK | S | Partition | `USER#<userId>` |
| SK | S | Sort | `PROFILE` |
| GSI1PK | S | GSI1 | `EMAIL#<email>` |
| data | M | - | User data |
| version | N | - | Optimistic lock |

**Access Patterns**:
| Pattern | Key Condition |
|---------|---------------|
| Get user by ID | PK = USER#id, SK = PROFILE |
| Get user by email | GSI1PK = EMAIL#email |

---

### Table: [table_name]
...

## Type Definitions

```typescript
// Branded types (Pillar A)
type UserId = string & { readonly __brand: 'UserId' };
type OrderId = string & { readonly __brand: 'OrderId' };

// Entity types
interface User {
  id: UserId;
  email: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  version: number;
}

interface Order {
  id: OrderId;
  userId: UserId;
  items: OrderItem[];
  status: OrderStatus;
  // ...
}
```

## Schema Versions

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | [Date] | Initial schema |
| 1.1 | [Date] | Added [field] to [table] |

## Migration Notes

### v1.0 → v1.1
```typescript
// Upcast function
function upcastUser_v1_to_v2(v1: UserV1): UserV2 {
  return {
    ...v1,
    newField: defaultValue,
  };
}
```

## References

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [INTERFACES.md](./INTERFACES.md)
