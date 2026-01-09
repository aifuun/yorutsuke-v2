# Admin Panel Design Document

> Internal monitoring console for Yorutsuke system management

## 1. Design Philosophy

### Overview

The Admin Panel is a **dark-themed, information-dense dashboard** optimized for:
- Quick status assessment at a glance
- Emergency control with clear action feedback
- Cost monitoring with visual hierarchy

### Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Dark First** | `#0f172a` base, reduced eye strain for monitoring |
| **Status-Driven Colors** | Green=OK, Yellow=Warning, Red=Critical |
| **Progressive Disclosure** | Summary → Details → Actions |
| **Confirmation for Destructive** | Two-step confirmation for critical actions |

### Tech Stack

- **Framework**: React 18 + TypeScript
- **Styling**: Tailwind CSS (custom dark theme)
- **Auth**: AWS Cognito (JWT)
- **Deployment**: CloudFront + S3

---

## 2. Color Palette

### Base Colors

| Token | Value | Usage |
|-------|-------|-------|
| `app-bg` | `#0f172a` | Page background (slate-900) |
| `app-surface` | `#1e293b` | Card backgrounds (slate-800) |
| `app-border` | `#334155` | Borders, dividers (slate-700) |
| `app-text` | `#f1f5f9` | Primary text (slate-100) |
| `app-text-secondary` | `#94a3b8` | Secondary text (slate-400) |
| `app-accent` | `#3b82f6` | Interactive elements (blue-500) |

### Status Colors

| Status | Background | Text | Border | Usage |
|--------|------------|------|--------|-------|
| **Success** | `bg-green-500/20` | `text-green-400` | `border-green-500/30` | Active, OK states |
| **Warning** | `bg-amber-500/20` | `text-amber-400` | `border-amber-500/30` | Pending, attention |
| **Error** | `bg-red-500/20` | `text-red-400` | `border-red-500/30` | Failed, critical |
| **Info** | `bg-blue-500/20` | `text-blue-400` | `border-blue-500/30` | Informational |

### Mode Indicators (Batch Page)

```
Instant Mode:  bg-green-500/20  text-green-400  icon: ⚡
Batch Mode:    bg-amber-500/20  text-amber-400  icon: 📦
Hybrid Mode:   bg-blue-500/20   text-blue-400   icon: 🔄
```

---

## 3. Layout Structure

### Shell Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Sidebar (240px)        │ Main Content (flex-1)              │
│ ┌───────────────────┐  │ ┌───────────────────────────────┐  │
│ │ Logo              │  │ │ Page Header                   │  │
│ │ Yorutsuke         │  │ │ Title + Description + Actions │  │
│ │ Admin Panel       │  │ └───────────────────────────────┘  │
│ ├───────────────────┤  │                                    │
│ │ Navigation        │  │ ┌───────────────────────────────┐  │
│ │ 📊 Dashboard      │  │ │ Stats Grid (3 columns)        │  │
│ │ 🔴 Control        │  │ │ [Card] [Card] [Card]          │  │
│ │ 💰 Costs          │  │ └───────────────────────────────┘  │
│ │ ⚙️  Batch         │  │                                    │
│ ├───────────────────┤  │ ┌───────────────────────────────┐  │
│ │ User              │  │ │ Content Sections              │  │
│ │ admin@email.com   │  │ │ Settings, Tables, etc.        │  │
│ │ [Logout]          │  │ └───────────────────────────────┘  │
│ └───────────────────┘  │                                    │
└─────────────────────────────────────────────────────────────┘
```

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| `< 768px` | Sidebar collapsed, hamburger menu |
| `≥ 768px` | Sidebar visible, main content flex |
| `≥ 1024px` | Full 3-column stats grid |

---

## 4. Page Designs

### 4.1 Login Page

**Purpose**: Authentication entry point

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    ┌─────────────────────┐                  │
│                    │  YORUTSUKE          │                  │
│                    │  Admin Panel        │                  │
│                    │                     │                  │
│                    │  [Email Input     ] │                  │
│                    │  [Password Input  ] │                  │
│                    │                     │                  │
│                    │  [    Login      ]  │                  │
│                    │                     │                  │
│                    │  Error message area │                  │
│                    └─────────────────────┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Components**:
- Centered card (`max-w-md`, `bg-app-surface`)
- Logo and title
- Email/password inputs with validation
- Loading state on submit
- Error display area

### 4.2 Dashboard Page

**Purpose**: System health overview

```
┌─────────────────────────────────────────────────────────────┐
│ Dashboard                                                   │
│ System overview and key metrics                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │ 📊 Active   │ │ 📤 Uploads  │ │ 💴 Today's  │            │
│ │ Users       │ │ Today       │ │ Cost        │            │
│ │    42       │ │   1,234     │ │   ¥850      │            │
│ └─────────────┘ └─────────────┘ └─────────────┘            │
│                                                             │
│ System Status ─────────────────────────────────────────────│
│ ● Upload Processing: Enabled                                │
│ ● Batch Processing: Enabled                                 │
│ ● Last Batch: 10:30 JST (Success)                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Components**:
- StatCard grid (3 columns)
- System status indicators
- Quick navigation to other pages

### 4.3 Control Page

**Purpose**: Emergency controls

```
┌─────────────────────────────────────────────────────────────┐
│ System Control                                              │
│ Emergency stop and service toggles                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ Upload Processing                                       ││
│ │ Accept new image uploads from users                     ││
│ │                                                         ││
│ │ Status: ● Active                    [  Deactivate  ]   ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ Batch Processing                                        ││
│ │ Automated batch OCR processing                          ││
│ │                                                         ││
│ │ Status: ● Active                    [  Deactivate  ]   ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ ⚠️ Emergency Stop                                       ││
│ │ Immediately halt ALL system operations                  ││
│ │                                                         ││
│ │          [ !! Emergency Stop All !! ]                   ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ Audit Log ─────────────────────────────────────────────────│
│ | Time | User | Action | Status |                          │
│ | ...  | ...  | ...    | ...    |                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Components**:
- Control cards with status + action button
- Two-step confirmation for destructive actions
- Audit log table

### 4.4 Costs Page

**Purpose**: Cost monitoring and analysis

```
┌─────────────────────────────────────────────────────────────┐
│ Cost Analysis                                               │
│ AWS service costs breakdown                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Period: [< Prev] January 2026 [Next >]                     │
│                                                             │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │ 💰 Total    │ │ 📈 vs Last  │ │ 📊 Daily    │            │
│ │ This Month  │ │ Month       │ │ Average     │            │
│ │   ¥12,450   │ │   +15%      │ │   ¥401      │            │
│ └─────────────┘ └─────────────┘ └─────────────┘            │
│                                                             │
│ Breakdown by Service ──────────────────────────────────────│
│ ┌───────────────────────────────────────────────────────┐  │
│ │ Service         │ Cost      │ %     │ Bar            │  │
│ │ Bedrock (OCR)   │ ¥8,200    │ 66%   │ ████████████   │  │
│ │ Lambda          │ ¥2,100    │ 17%   │ ███            │  │
│ │ S3 Storage      │ ¥1,500    │ 12%   │ ██             │  │
│ │ DynamoDB        │ ¥650      │ 5%    │ █              │  │
│ └───────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Components**:
- Period selector with navigation
- Summary stat cards
- Breakdown table with visual bars
- Trend indicators

### 4.5 Batch Page (Optimized)

**Purpose**: Receipt processing configuration and monitoring

```
┌─────────────────────────────────────────────────────────────┐
│ Receipt Processing                    ⚡ Instant Mode       │
│ Receipts are processed immediately after upload    [Refresh]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │ 📋 Queued   │ │ ✅ Last Run │ │ ⚠️ Failed   │            │
│ │ Images      │ │             │ │             │            │
│ │    0        │ │    15       │ │    0        │            │
│ │ No waiting  │ │ 10:30 AM    │ │ All success │            │
│ └─────────────┘ └─────────────┘ └─────────────┘            │
│                                                             │
│ Processing Settings ───────────────────────────────────────│
│ ┌───────────────────────────────────────────────────────┐  │
│ │ Processing Mode                                       │  │
│ │ ○ Instant (On-Demand)  ← RECOMMENDED                  │  │
│ │ ○ Batch Only (50% Discount)                           │  │
│ │ ○ Hybrid                                              │  │
│ │                                                       │  │
│ │ LLM Model                                             │  │
│ │ [Nova Lite] [Nova Pro] [Claude 3 Haiku]               │  │
│ │                                                       │  │
│ │                              [Save Changes]           │  │
│ └───────────────────────────────────────────────────────┘  │
│                                                             │
│ Manual Processing ─────────────────────────────────────────│
│ ┌───────────────────────────────────────────────────────┐  │
│ │ Force reprocess any failed images                     │  │
│ │ Lambda: yorutsuke-batch-process-dev                   │  │
│ │                                     [Reprocess Failed]│  │
│ └───────────────────────────────────────────────────────┘  │
│                                                             │
│ Recent Logs ───────────────────────────────────────────────│
│ | Time     | Message                                    |  │
│ | 10:30:15 | Processing complete: 15 images             |  │
│                                                             │
│ Processing Modes Explained ────────────────────────────────│
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│ │ ⚡ Instant   │ │ 📦 Batch     │ │ 🔄 Hybrid    │        │
│ │ Immediate    │ │ Queue 100+   │ │ Batch first, │        │
│ │ Full price   │ │ 50% savings  │ │ then Instant │        │
│ └──────────────┘ └──────────────┘ └──────────────┘        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Design Decisions**:

1. **Mode Indicator in Header**
   - Badge shows current mode with icon and color
   - Subtitle dynamically describes mode behavior

2. **Contextual Stats**
   - "Queued Images" shows threshold info in Batch mode
   - "Failed" shows severity-based colors
   - Subtitles adapt to data state

3. **Mode-Aware Actions**
   - Button text changes: "Reprocess Failed" (Instant) vs "Process Now" (Batch)
   - Disabled state when no action needed

4. **Visual Mode Comparison**
   - Three-card layout at bottom
   - Color-coded for quick recognition

---

## 5. Component Library

### StatCard

```tsx
<StatCard
  title="Queued Images"
  value={0}
  subtitle="No images waiting"
  icon="📋"
  color="green"  // green | yellow | red | blue | purple
/>
```

**Variants**:
- Default: Neutral border
- Colored: Left border accent based on `color` prop

### ModeOption (Radio Card)

```tsx
<ModeOption
  value="instant"
  selected={true}
  label="Instant (On-Demand)"
  description="Process immediately after upload"
  recommended={true}
  onClick={() => {}}
/>
```

**States**:
- Default: `border-app-border`
- Selected: `border-app-accent bg-app-accent/10`
- Recommended: Green badge

### ControlCard

```tsx
<ControlCard
  title="Upload Processing"
  description="Accept new uploads"
  status="active"
  onToggle={() => {}}
/>
```

**States**:
- Active: Green status dot
- Inactive: Gray status dot
- Loading: Spinner

### ConfirmDialog

Two-step confirmation pattern:
1. Initial button click → Show confirm/cancel
2. Confirm click → Execute action
3. Success/error feedback

---

## 6. Interaction Patterns

### Loading States

| Element | Loading State |
|---------|---------------|
| Page | Centered spinner + "Loading..." |
| Button | Disabled + "Loading..." text |
| Table | Skeleton rows |
| Card | Pulse animation |

### Error States

| Level | Display |
|-------|---------|
| Page error | Red banner at top |
| Field error | Red border + message below |
| Toast error | Temporary notification |

### Success Feedback

- Button: Brief "✓ Saved!" text
- Action: Green toast notification
- Form: Fields reset + success message

---

## 7. Accessibility

### Keyboard Navigation

- Tab order follows visual hierarchy
- Focus indicators visible on all interactive elements
- Enter/Space activates buttons

### Screen Reader

- Semantic HTML elements
- ARIA labels on icon-only buttons
- Status announcements for async operations

### Color Contrast

- All text meets WCAG AA (4.5:1 minimum)
- Status colors have text alternatives (icons)

---

## 8. Future Considerations

### Planned Enhancements

1. **Role-based UI** - Hide controls based on user role
2. **Real-time updates** - WebSocket for live stats
3. **Dark/Light toggle** - Theme switching
4. **Mobile optimization** - Better touch targets

### Design Debt

1. Inconsistent spacing in some cards
2. Missing loading skeletons in Costs page
3. No empty state illustrations

---

## References

- Operations Guide: `docs/operations/ADMIN_PANEL.md`
- CDK Stack: `infra/lib/yorutsuke-admin-stack.ts`
- Frontend Code: `admin/src/`
- Main App Design: `docs/design/00-overview.md`
