# INTERFACES.md Template

> Interface definitions - IPC + Cloud API

## Overview

**Version**: [API version]
**Last Updated**: [Date]

---

## Part 1: IPC Commands (Tauri)

> Frontend (React) ↔ Backend (Rust)

### Command: get_user

**Description**: Retrieve user by ID

**Request**:
```typescript
// Frontend call
import { invoke } from '@tauri-apps/api/tauri';

const user = await invoke<User>('get_user', { userId: 'usr_123' });
```

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| userId | string | Yes | User ID (branded) |

**Response**:
```typescript
interface User {
  id: UserId;
  email: string;
  name: string;
}
```

**Errors**:
| Code | Description |
|------|-------------|
| NOT_FOUND | User does not exist |
| INVALID_ID | Invalid user ID format |

---

### Command: save_user

**Description**: Create or update user

**Request**:
```typescript
await invoke('save_user', {
  user: { id, email, name },
  expectedVersion: 1  // Optimistic lock
});
```

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| user | User | Yes | User data |
| expectedVersion | number | Yes | Version for CAS |

**Response**: `void`

**Errors**:
| Code | Description |
|------|-------------|
| VERSION_CONFLICT | Concurrent modification |
| VALIDATION_ERROR | Invalid user data |

---

### Command: [command_name]
...

## IPC Command Index

| Command | Tier | Description |
|---------|------|-------------|
| get_user | T1 | Read user |
| save_user | T2 | Write user with CAS |
| process_order | T3 | Saga with compensation |

---

## Part 2: Cloud API (AWS)

> Backend (Rust/Lambda) ↔ AWS Services

### Endpoint: GET /users/{id}

**Description**: Get user from cloud

**Authentication**: Bearer token (Cognito)

**Request**:
```http
GET /users/usr_123
Authorization: Bearer <token>
```

**Response**:
```json
{
  "id": "usr_123",
  "email": "user@example.com",
  "name": "User Name"
}
```

**Status Codes**:
| Code | Description |
|------|-------------|
| 200 | Success |
| 401 | Unauthorized |
| 404 | User not found |

---

### Endpoint: POST /users

**Description**: Create new user

**Request**:
```json
{
  "email": "user@example.com",
  "name": "User Name"
}
```

**Response**:
```json
{
  "id": "usr_456",
  "email": "user@example.com",
  "name": "User Name"
}
```

**Status Codes**:
| Code | Description |
|------|-------------|
| 201 | Created |
| 400 | Validation error |
| 409 | Email already exists |

---

### Endpoint: [METHOD /path]
...

## Cloud API Index

| Method | Path | Description |
|--------|------|-------------|
| GET | /users/{id} | Get user |
| POST | /users | Create user |
| PUT | /users/{id} | Update user |
| DELETE | /users/{id} | Delete user |

## Error Response Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  },
  "traceId": "trace-abc-123"
}
```

## Authentication

### IPC (Local)
- No authentication (trusted context)
- User context passed via state

### Cloud API
- **Method**: JWT (Cognito)
- **Header**: `Authorization: Bearer <token>`
- **Token refresh**: Automatic via SDK

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| GET /users/* | 100 | 1 min |
| POST /users | 10 | 1 min |
| * (default) | 60 | 1 min |

## References

- [SCHEMA.md](./SCHEMA.md) - Data types
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
