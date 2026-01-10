# Debug Panel Configuration

## Quick Start

Add to `.env.local` (gitignored):

```bash
VITE_DEBUG_PANEL=true
```

Restart development server:

```bash
npm run tauri dev
```

## Configuration

### Enable Debug Panel

1. Open or create `app/.env.local`
2. Add: `VITE_DEBUG_PANEL=true`
3. Restart dev server

### Disable Debug Panel

Option 1: Remove the line from `.env.local`
Option 2: Set to `false`: `VITE_DEBUG_PANEL=false`

## Production Builds

### 🔒 Automatic Disable (No Action Required)

Debug panel is **automatically disabled** in production builds:

```bash
npm run tauri build  # Debug panel automatically disabled
```

**Security Guarantees**:
- ✅ Compile-time check: `import.meta.env.PROD` always returns `false` for `isDebugEnabled()`
- ✅ Tree-shaking: DebugView component code is removed from bundle
- ✅ UI hidden: Sidebar doesn't show debug button

**Verification**:
```bash
# Build and check
npm run build
grep -r "DebugView" dist/assets/*.js  # Should find nothing

# Or use automated script
./scripts/verify-production-security.sh
```

See [PRODUCTION_SECURITY.md](../docs/operations/PRODUCTION_SECURITY.md) for detailed security architecture.

## Notes

- **Development**: Controlled by `VITE_DEBUG_PANEL` in `.env.local`
- **Production**: ALWAYS disabled (cannot be overridden)
- **Per-developer**: `.env.local` is gitignored, each developer has their own config
- **Compile-time**: No runtime overhead, decision made at build time
- **No UI flicker**: Synchronous check, no async loading

## Example .env.local

See `.env.local.example` for a template with all available variables.
