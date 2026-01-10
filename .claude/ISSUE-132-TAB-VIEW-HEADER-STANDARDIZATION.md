# Issue #132: Tab View Header Design & Content Standardization

**Status**: 🔴 NEW  
**Priority**: 🟠 MEDIUM  
**Category**: Design System / UI Consistency  
**Date Created**: 2026-01-10  

---

## Problem Statement

Tab view headers across the application have **inconsistent design styles and content patterns**, creating a fragmented user experience. Different views (Dashboard, Ledger, Settings, Capture, Debug) implement headers with varying CSS classes, background treatments, and content layouts.

---

## Current Issues

### 1️⃣ Inconsistent Background Styling

| View | Background | Backdrop Filter | Notes |
|------|-----------|-----------------|-------|
| **Dashboard** | Linear gradient (blue hint) | blur(8px) | ✅ Branded, optimized |
| **Ledger** | Solid rgba(255,255,255,0.4) | blur(20px) | ❌ Generic, high blur |
| **Settings** | Solid rgba(255,255,255,0.4) | blur(20px) | ❌ Generic, high blur |
| **Capture** | Solid rgba(255,255,255,0.4) | blur(20px) | ❌ Generic, high blur |
| **Debug** | Solid rgba(255,255,255,0.4) | blur(20px) | ❌ Generic, high blur |

**Problem**: Dashboard and Ledger use different backgrounds (gradient vs. solid). Blur value inconsistency (8px vs 20px).

### 2️⃣ Inconsistent CSS Class Naming

| View | Header Class | Title Class | Notes |
|------|-------------|------------|-------|
| Dashboard | `.dashboard-header` | `.dashboard-title` | ✅ Namespaced |
| Ledger | `.ledger-header` | `.ledger-title` | ✅ Namespaced |
| Settings | `.settings-header` | `.settings-title` | ✅ Namespaced |
| Capture | `.capture-header` | `.capture-title` | ✅ Namespaced |
| Debug | `.debug-header` | `.debug-title` | ✅ Namespaced |

**Problem**: Each view has its own CSS class, but they duplicate nearly identical styles (DRY violation).

### 3️⃣ Inconsistent Header Content Structure

**Dashboard Header** (has date info):
```tsx
<DashboardHeader 
  date={today}           // Shows date + day of week
  dayOfWeek={dayOfWeek}
  title={t('nav.dashboard')} 
/>
```

**Ledger Header** (has action buttons):
```tsx
<LedgerHeader
  title={t('nav.ledger')}
  onNewEntry={...}       // Shows action buttons
  onSync={...}
  syncState={...}
  lastSynced={...}
/>
```

**Settings Header** (has version):
```tsx
<SettingsHeader
  title={t('settings.title')}
  version={APP_VERSION}  // Shows version badge
/>
```

**Capture Header** (has date info):
```tsx
<CaptureHeader
  date={today}
  dayOfWeek={dayOfWeek}
  title={t('capture')}
/>
```

**Debug Header** (has version):
```tsx
<DebugHeader
  title={t('debug.title')}
  version={APP_VERSION}
/>
```

**Problem**: No consistent pattern for header content (some show date, some show version, some show buttons).

### 4️⃣ Inconsistent Section Header Styling

| Context | Class | Font Size | Weight | Color | Notes |
|---------|-------|-----------|--------|-------|-------|
| Dashboard | `.section-header` | 11px | 800 | slate-400 | ✅ Per typography spec |
| Settings | `.card--settings__header` | ? | ? | ? | ❌ Unknown styling |
| Debug | `.card--settings__header` | ? | ? | ? | ❌ Unknown styling |
| Ledger | `.section-header` | 11px | 800 | slate-400 | ✅ Consistent |

**Problem**: Settings and Debug reuse `.card--settings__header` instead of standardized `.section-header`.

### 5️⃣ Content Issues

| View | Issue | Impact |
|------|-------|--------|
| **All Headers** | No descriptive subtitle or help text | Users don't understand view purpose |
| **Settings/Debug** | Missing breadcrumb or navigation context | Users unsure of navigation state |
| **Dashboard/Capture** | Date display format inconsistent with locale | Internationalization issues |
| **Ledger** | Action buttons in header (sync, new entry) | Heavy header, cognitive load |

---

## Affected Files

### CSS Files (Header Styles)
- `app/src/02_modules/report/styles/dashboard.css` (lines 1-35)
- `app/src/02_modules/transaction/views/ledger.css` (lines 1-35)
- `app/src/02_modules/settings/styles/settings.css` (lines 1-35)
- `app/src/02_modules/capture/views/capture.css` (lines 1-35)
- `app/src/02_modules/debug/views/debug.css` (lines 1-35)

### Component Files (Header Implementation)
- `app/src/02_modules/report/views/DashboardView.tsx` (DashboardHeader)
- `app/src/02_modules/transaction/views/TransactionView.tsx` (LedgerHeader)
- `app/src/02_modules/settings/views/SettingsView.tsx` (SettingsHeader)
- `app/src/02_modules/capture/views/CaptureView.tsx` (CaptureHeader)
- `app/src/02_modules/debug/views/DebugView.tsx` (DebugHeader)

### Section Header Issues
- `app/src/02_modules/report/views/DashboardView.tsx` (uses `.section-header`)
- `app/src/02_modules/settings/views/SettingsView.tsx` (uses `.card--settings__header`)
- `app/src/02_modules/debug/views/DebugView.tsx` (uses `.card--settings__header`)
- `app/src/02_modules/transaction/views/ledger.css` (uses `.section-header`)

---

## Proposed Solution

### Phase 1: Create Unified Header Component 📦

Create a new shared header component in `app/src/components/`:

**File**: `app/src/components/ViewHeader/ViewHeader.tsx`

```tsx
interface ViewHeaderProps {
  title: string;
  subtitle?: string;        // Optional description
  rightContent?: React.ReactNode;  // Version, buttons, date, etc.
  showDate?: boolean;       // Show formatted date
  className?: string;
}

export function ViewHeader({
  title,
  subtitle,
  rightContent,
  showDate,
  className = ''
}: ViewHeaderProps) {
  const today = new Date().toLocaleDateString(i18n.language, {...});
  
  return (
    <header className={`view-header ${className}`}>
      <div className="view-header__content">
        <div>
          <h1 className="view-header__title">{title}</h1>
          {subtitle && <p className="view-header__subtitle">{subtitle}</p>}
        </div>
        {showDate && <span className="view-header__date">{today}</span>}
      </div>
      {rightContent && <div className="view-header__right">{rightContent}</div>}
    </header>
  );
}
```

**CSS**: `app/src/components/ViewHeader/ViewHeader.css`

```css
.view-header {
  height: 64px;
  background: rgba(255, 255, 255, 0.90);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(203, 213, 225, 0.5);
  padding: 0 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.view-header__content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.view-header__title {
  font-size: 18px;
  font-weight: 700;
  color: var(--slate-700);
  letter-spacing: -0.025em;
  margin: 0;
}

.view-header__subtitle {
  font-size: 13px;
  color: var(--slate-500);
  margin: 0;
}

.view-header__date {
  font-size: 14px;
  color: var(--slate-500);
  margin-left: auto;
}

.view-header__right {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: 20px;
}
```

### Phase 2: Standardize Section Headers 🎨

Update all section headers to use `.section-header` class:

**Rules**:
- Font size: 11px
- Font weight: 800
- Color: var(--slate-400)
- Text transform: uppercase
- Letter spacing: 0.2em

**Files to Update**:
- ❌ `app/src/02_modules/settings/styles/settings.css` - Replace `.card--settings__header` with `.section-header`
- ❌ `app/src/02_modules/debug/views/DebugView.tsx` - Replace `.card--settings__header` with `.section-header`
- ✅ `app/src/02_modules/report/styles/dashboard.css` - Already correct
- ✅ `app/src/02_modules/transaction/views/ledger.css` - Already correct

### Phase 3: Migrate Views to New Component 🔄

Replace individual header components with unified `ViewHeader`:

**Dashboard**:
```tsx
<ViewHeader 
  title={t('nav.dashboard')}
  subtitle={t('dashboard.subtitle')}  // NEW: Add helpful subtitle
  showDate={true}
/>
```

**Ledger**:
```tsx
<ViewHeader 
  title={t('nav.ledger')}
  rightContent={/* sync button, new entry button */}
/>
```

**Settings**:
```tsx
<ViewHeader 
  title={t('settings.title')}
  subtitle={t('settings.subtitle')}  // NEW: Add helpful subtitle
  rightContent={<VersionBadge version={APP_VERSION} />}
/>
```

**Capture**:
```tsx
<ViewHeader 
  title={t('capture')}
  subtitle={t('capture.subtitle')}  // NEW: Add helpful subtitle
  showDate={true}
/>
```

**Debug**:
```tsx
<ViewHeader 
  title={t('debug.title')}
  rightContent={<VersionBadge version={APP_VERSION} />}
/>
```

---

## Checklist for Implementation

### Design & Specification
- [ ] Define unified header component interface
- [ ] Specify background treatment (gradient vs solid)
- [ ] Specify backdrop filter blur value (8px recommended)
- [ ] Define subtitle/description guidelines
- [ ] Add internationalization strings for subtitles

### Component Creation
- [ ] Create ViewHeader component
- [ ] Create ViewHeader.css with unified styles
- [ ] Create ViewHeader tests
- [ ] Export from components/index.ts

### Migration
- [ ] Update DashboardView to use ViewHeader
- [ ] Update LedgerView to use ViewHeader
- [ ] Update SettingsView to use ViewHeader
- [ ] Update CaptureView to use ViewHeader
- [ ] Update DebugView to use ViewHeader
- [ ] Remove old header components (DashboardHeader, LedgerHeader, etc.)

### Standardization
- [ ] Update all section headers to use `.section-header`
- [ ] Remove `.card--settings__header` references
- [ ] Verify typography compliance (TYPOGRAPHY.md)
- [ ] Add subtitle content to i18n files

### Quality Assurance
- [ ] Visual regression testing (all views)
- [ ] Responsive design testing (mobile, tablet, desktop)
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Cross-browser testing
- [ ] RTL language testing (if applicable)

---

## Acceptance Criteria

✅ **Visual Consistency**:
- All view headers use identical background treatment
- All view headers use identical blur filter value (8px)
- All view headers have consistent height (64px) and padding

✅ **Code Quality**:
- No CSS duplication (all headers use unified component)
- DRY principle applied (header logic in single component)
- TypeScript strict mode compliant

✅ **Content Quality**:
- All headers include descriptive subtitles
- Date display is locale-aware and consistent
- Action buttons/badges properly positioned

✅ **Accessibility**:
- WCAG 2.1 Level AA compliant
- Proper heading hierarchy (h1 for view title)
- Screen reader compatible

✅ **Performance**:
- No performance regression
- Backdrop filter optimized (8px blur)
- Component renders efficiently

---

## Design Reference

See `docs/design/TYPOGRAPHY.md` for:
- Page Title: 18px, weight 700, color slate-700 ✓
- Section Header: 11px, weight 800, color slate-400, uppercase ✓
- Background: rgba(255,255,255,0.90) with blur(8px) ✓

---

## Dependencies

- Related: Issue #124 (Motion System)
- Related: Issue #128 (Feedback Components)
- Related: Issue #131 (Icon System)
- Depends on: docs/design/TYPOGRAPHY.md

---

## Estimated Effort

- **Component Creation**: 2-3 hours
- **Migration (5 views)**: 2-3 hours
- **Testing & QA**: 2-3 hours
- **Total**: 6-9 hours (1 day)

---

## Notes

1. **Background Gradient**: Dashboard uses a subtle blue-hint gradient (recommended for brand). Consider applying to all views for consistency, or revert to solid white for minimalist approach.

2. **Backdrop Filter**: Current blur values vary (8px vs 20px). Recommend standardizing to 8px for performance while maintaining visual clarity.

3. **Header Content**: Different views need different complementary info (date, version, buttons). ViewHeader component should support flexible `rightContent` prop to accommodate all patterns.

4. **Internationalization**: Add i18n strings for header subtitles (currently missing):
   - `dashboard.subtitle`
   - `settings.subtitle`
   - `capture.subtitle`
   - `ledger.subtitle`
   - `debug.subtitle`

5. **Section Headers**: Two different class names (`.section-header` vs `.card--settings__header`) create confusion. Consolidate to single `.section-header` throughout codebase.

---

## Related Issues

- Issue #124: Motion System (defines transition tokens for header animations)
- Issue #128: Feedback System (uses headers in modal/dialog components)
- Issue #131: Icon System (icons used in header action buttons)

---

## Next Steps

1. ✅ Create this issue
2. ⏳ Design review and approval
3. ⏳ Component implementation
4. ⏳ View migration
5. ⏳ QA testing
6. ⏳ Production deployment

---

*Last Updated: 2026-01-10*
