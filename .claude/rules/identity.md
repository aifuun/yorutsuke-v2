# Identity Management Rules

## User ID Format

| Type | Prefix | Source | Stability |
|------|--------|--------|-----------|
| **Guest** | `device-` | machine-uid | Until OS reinstall |
| **Authenticated** | `user-` | Cognito sub | Permanent |

## Device ID (Guest)

```typescript
// Generated via Rust IPC using machine-uid crate
const deviceId = await invoke<string>('get_machine_id');
// Returns: "device-bd9bafc9-0e39-430c-b20e-..."
```

### Platform Sources

| Platform | Source |
|----------|--------|
| macOS | `IOPlatformUUID` |
| Linux | `/etc/machine-id` |
| Windows | `MachineGuid` (Registry) |

### Key Files

| File | Purpose |
|------|---------|
| `src-tauri/src/lib.rs` | `get_machine_id` IPC command |
| `src/00_kernel/identity/deviceId.ts` | Frontend wrapper with caching |

## User Type Detection

```typescript
// Check if guest user
const isGuest = userId.startsWith('device-');

// Check if authenticated user
const isAuthenticated = userId.startsWith('user-');
```

## Data Migration (Guest → User)

When guest registers/logs in, their data is claimed:

```typescript
// Old: device-{machineId}
// New: user-{cognitoSub}
await updateImagesUserId(oldUserId, newUserId);
```

## Guidelines

**DO:**
- Use `getDeviceId()` from `00_kernel/identity`
- Check user type via prefix (`device-` vs `user-`)
- Cache device ID in memory (IPC is expensive)

**DON'T:**
- Store device ID in SQLite (use IPC each time)
- Use random UUID for device identification
- Add extra prefixes like `guest-device-`

## References

- Architecture: `docs/architecture/ARCHITECTURE.md#device-id`
- Implementation: `app/src/00_kernel/identity/deviceId.ts`
