# UI Design

> Visual mockups and design specifications for Yorutsuke v2

## Files

| File | Screen | Description |
|------|--------|-------------|
| `0 design.html` | Ledger | Transaction list with filters |
| `1 dashboard.html` | Dashboard | Today's summary, stats, activity |
| `1 dashboard.md` | - | Dashboard design spec |
| `3 capture.html` | Capture | Drop zone, upload queue |
| `3 capture.md` | - | Capture design spec |
| `4 setting.html` | Settings | Preferences, account, debug |
| `4 setting.md` | - | Settings design spec |

## Design System

### Colors (Tailwind)

| Token | Dark Mode | Light Mode |
|-------|-----------|------------|
| Sidebar | `slate-900` (#0F172A) | - |
| Background | `slate-100` (#F1F5F9) | - |
| Card | `white/85` | - |
| Accent | `blue-500` (#3B82F6) | - |
| Success | `emerald-500` | - |
| Warning | `amber-500` | - |
| Error | `rose-500` | - |

### Typography

| Element | Font | Weight |
|---------|------|--------|
| UI Text | Inter | 400-700 |
| Numbers | JetBrains Mono | 400-700 |

See [TYPOGRAPHY.md](./TYPOGRAPHY.md) for detailed font usage guidelines.

### Components

- **Premium Card**: Glassmorphism with 28px radius
- **Sidebar**: Fixed 256px, dark theme
- **Nav Item**: Active state with left accent bar

## Usage

Open HTML files directly in browser - uses Tailwind CDN.
