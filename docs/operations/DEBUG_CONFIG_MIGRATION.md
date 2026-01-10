# Debug Panel Configuration Migration

> Migration from secret code to environment variable configuration

**Migration Date**: 2026-01-10
**Affects**: Development workflow only (no impact on production)

---

## What Changed

### Before (Secret Code)

**Access Method**: Type "debug" anywhere in the app
```typescript
// Old implementation
const secretCodeResult = useSecretCode();
const isDebugUnlocked = IS_DEVELOPMENT && secretCodeResult.isUnlocked;
```

**Issues**:
- ❌ Not discoverable (hidden feature)
- ❌ State managed in React component
- ❌ Requires user interaction every session
- ❌ Not documented in visible location

---

### After (Environment Variable)

**Access Method**: Configure via `.env.local`
```bash
# app/.env.local (gitignored)
VITE_DEBUG_PANEL=true
```

```typescript
// New implementation
export function isDebugEnabled(): boolean {
  if (import.meta.env.PROD) return false;
  return import.meta.env.VITE_DEBUG_PANEL === 'true';
}
```

**Benefits**:
- ✅ Standard Vite configuration pattern
- ✅ Discoverable (documented in `.env.local.example`)
- ✅ Persistent across sessions (no re-typing)
- ✅ Compile-time resolution (zero runtime overhead)
- ✅ Per-developer configuration (gitignored)
- ✅ No UI state management needed

---

## Migration Guide

### For Developers

**If you previously used the secret code**:

1. Open or create `app/.env.local`:
   ```bash
   # Create if not exists
   touch app/.env.local
   ```

2. Add debug panel flag:
   ```bash
   echo 'VITE_DEBUG_PANEL=true' >> app/.env.local
   ```

3. Restart dev server:
   ```bash
   npm run tauri dev
   ```

4. Debug icon appears in sidebar (no need to type "debug")

**Template available**: See `app/.env.local.example` for all configuration options.

---

## File Changes

### Removed Files
- `app/debug.json.example` (replaced by `.env.local.example`)
- `app/DEBUG_MODE.md` (replaced by `app/DEBUG.md`)

### Modified Files
- `app/src/00_kernel/config/debug.ts` - Simplified from 115 lines → 35 lines
- `app/src/App.tsx` - Removed useState/useEffect for debug state
- `app/src/02_modules/debug/headless/useSecretCode.ts` - No longer used for debug unlock

### New Files
- `app/.env.local.example` - Configuration template
- `app/DEBUG.md` - Quick developer guide
- `docs/operations/PRODUCTION_SECURITY.md` - Security architecture documentation

### Updated Documentation
- `docs/operations/DEBUG_PANEL.md` - Access method updated
- `docs/tests/MOCKING.md` - Prerequisites section updated

---

## Production Security

### No Changes to Production Behavior

Production builds remain secure with **3-layer protection**:

1. **Layer 1**: Compile-time check
   ```typescript
   if (import.meta.env.PROD) return false;  // Always returns false
   ```

2. **Layer 2**: Tree-shaking removes DebugView component code

3. **Layer 3**: Sidebar button hidden

**Verification**:
```bash
npm run build
grep -r "DebugView" dist/assets/*.js  # Should find nothing
```

See [PRODUCTION_SECURITY.md](PRODUCTION_SECURITY.md) for details.

---

## Code Comparison

### Before (115 lines)
```typescript
// File-based configuration with async loading
import { exists, readTextFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { logger } from '../telemetry/logger';

let _isDebugEnabled = false;
let _initialized = false;

export async function loadDebugConfig(): Promise<void> {
  if (_initialized) return;

  if (import.meta.env.PROD) {
    _isDebugEnabled = false;
    _initialized = true;
    return;
  }

  try {
    const fileExists = await exists('debug.json', { baseDir: BaseDirectory.AppConfig });
    if (!fileExists) { /* ... */ }
    const content = await readTextFile('debug.json', { baseDir });
    const config = JSON.parse(content);
    _isDebugEnabled = config.debug === true;
    // ... error handling, logging, etc.
  } catch (error) { /* ... */ }
}
```

### After (35 lines)
```typescript
// Environment variable (compile-time)
export function isDebugEnabled(): boolean {
  if (import.meta.env.PROD) return false;
  return import.meta.env.VITE_DEBUG_PANEL === 'true';
}

// No-op for API compatibility
export async function loadDebugConfig(): Promise<void> {
  return Promise.resolve();
}
```

**Reduction**: 70% less code, 100% synchronous, zero dependencies

---

## Breaking Changes

### For Developers

**Old way** (no longer works):
```
Type "debug" → Debug panel appears
```

**New way**:
```bash
# Add to .env.local
VITE_DEBUG_PANEL=true

# Restart dev server
npm run tauri dev
```

### For End Users

**No impact** - Debug panel was never accessible to end users in release builds.

---

## FAQ

### Q: Why change from secret code to env var?

**A**:
- Secret code was a workaround for lack of proper configuration
- Environment variables are Vite's standard configuration method
- Compile-time configuration is more secure and performant
- Per-developer settings are better than app-wide state

### Q: Can I still use the secret code?

**A**: No, the secret code feature has been removed. Use `.env.local` instead.

### Q: What if I forget to add VITE_DEBUG_PANEL=true?

**A**: Debug panel won't appear. This is intentional - opt-in rather than opt-out.

### Q: Does this affect production builds?

**A**: No. Production builds always have debug panel disabled, regardless of `.env.local` settings.

### Q: Can users enable debug panel in production?

**A**: No. The check `import.meta.env.PROD` happens at compile time, and the debug panel code is removed from the bundle via tree-shaking.

---

## Rollback (If Needed)

If you need to rollback to the old secret code system:

```bash
# Revert commits
git log --oneline | grep -i "debug config"
git revert <commit-hash>

# Restore old files
git checkout HEAD~1 app/src/00_kernel/config/debug.ts
git checkout HEAD~1 app/src/App.tsx
```

**Not recommended** - the new system is significantly better.

---

## References

- [DEBUG.md](../../app/DEBUG.md) - Quick configuration guide
- [DEBUG_PANEL.md](DEBUG_PANEL.md) - Debug panel features and usage
- [PRODUCTION_SECURITY.md](PRODUCTION_SECURITY.md) - Security architecture
- [MOCKING.md](../tests/MOCKING.md) - Mock mode configuration

---

*Migration completed: 2026-01-10*
