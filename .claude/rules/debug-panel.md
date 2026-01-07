# Debug Panel Rules

## Visibility

**CRITICAL**: The Debug panel is **developer-only** and **NOT visible to end users**.

- In **development**: Accessible via secret code (`debug`)
- In **release**: Completely hidden, no access path

## Implications

When working on Debug panel features:

1. **No user-facing concerns**: Don't worry about UX for "normal users"
2. **Developer convenience first**: Optimize for developer workflow
3. **No i18n required**: English-only is acceptable (but we do have ja.json)
4. **Mock mode persistence**: Safe to persist because users can't access it

## Mock Mode

Mock mode settings are persisted to SQLite and restored on app start.

This is safe because:
- Only developers can access Debug panel
- Release builds hide the panel entirely
- No risk of end users accidentally enabling mock mode

## Code Location

```
src/02_modules/debug/
├── views/
│   ├── DebugView.tsx    # Main debug panel
│   └── debug.css        # Debug-specific styles
├── headless/
│   └── debugLog.ts      # Log buffer management
└── index.ts             # Public exports
```

## Secret Code

The debug panel is unlocked by typing `debug` anywhere in the app:
- Implemented in `useSecretCode` hook
- State persisted in memory (resets on app restart)
- No persistence needed - developers know the code
