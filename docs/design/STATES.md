# UI State Patterns
> Strategy: 70% Material Design 3 + 30% Yorutsuke pragmatism

## Overview

UI state patterns define how to handle and display different states across the application: Empty States, Loading States, and Error States. Provides consistent, accessible, and user-friendly feedback for all system states.

**Current Status**: Documentation complete, ready for implementation.

---

## Empty States

Empty states appear when there's no data to display. They guide users on what to do next.

### 1. First-Use Empty State

**Use Case**: User's first time using a feature, no data yet exists

**Purpose**: Onboard users, explain feature, encourage first action

**Structure**:
```html
<div class="empty-state empty-state-first-use">
  <div class="empty-state-icon">
    📊
  </div>
  <h3 class="empty-state-title">Welcome to Dashboard</h3>
  <p class="empty-state-description">
    Upload your first receipt to start tracking your income and expenses.
  </p>
  <button class="btn btn-primary">
    Upload Receipt
  </button>
</div>
```

**Visual Specs**:
- Icon: 64px emoji or illustration, slate-400 color
- Title: 14px, 600 weight, slate-700
- Description: 12px, 400 weight, slate-500
- Action: Primary button
- Padding: 48px vertical, 24px horizontal

**CSS**:
```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12) var(--space-6); /* 48px 24px */
  text-align: center;
  max-width: 400px;
  margin: 0 auto;
}

.empty-state-icon {
  font-size: 64px;
  opacity: 0.5;
  margin-bottom: var(--space-6);
}

.empty-state-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--slate-700);
  margin: 0 0 var(--space-2) 0;
}

.empty-state-description {
  font-size: 12px;
  font-weight: 400;
  color: var(--slate-500);
  margin: 0 0 var(--space-6) 0;
  line-height: 1.5;
}
```

**Examples**:
- Dashboard (no transactions): "📊 Start tracking your finances"
- Ledger (no transactions): "🧾 No transactions yet"
- Report (no data): "📈 Upload receipts to see reports"

---

### 2. No-Data Empty State

**Use Case**: User has used the feature before, but currently no data

**Purpose**: Acknowledge empty state, suggest action

**Structure**:
```html
<div class="empty-state empty-state-no-data">
  <div class="empty-state-icon">
    🧾
  </div>
  <h3 class="empty-state-title">No transactions today</h3>
  <p class="empty-state-description">
    Upload a receipt to add a transaction.
  </p>
  <button class="btn btn-secondary btn-sm">
    Upload
  </button>
</div>
```

**Visual Differences from First-Use**:
- Slightly smaller (simpler layout)
- Secondary button (less emphasis)
- Shorter copy (user already knows feature)

**CSS**:
```css
.empty-state-no-data {
  padding: var(--space-8) var(--space-4); /* 32px 16px - less padding */
}

.empty-state-no-data .empty-state-icon {
  font-size: 48px; /* Smaller than first-use */
}
```

**Examples**:
- Ledger (today): "No transactions today"
- Search results (no query): "Enter search term above"
- Filtered results (no matches): "Adjust filters"

---

### 3. No-Results Empty State

**Use Case**: User searched/filtered, but no results found

**Purpose**: Explain why no results, suggest alternatives

**Structure**:
```html
<div class="empty-state empty-state-no-results">
  <div class="empty-state-icon">
    🔍
  </div>
  <h3 class="empty-state-title">No results found</h3>
  <p class="empty-state-description">
    Try adjusting your filters or search term.
  </p>
  <button class="btn btn-ghost btn-sm">
    Clear Filters
  </button>
</div>
```

**Visual Differences**:
- Minimal (user is actively searching)
- Ghost button (subtle action)
- Focus on search/filter adjustment

**Examples**:
- Ledger (filtered): "No transactions match your filters"
- Search (no results): "No results for "コンビニ""
- Category (empty): "No transactions in this category"

---

## Loading States

Loading states indicate that content is being fetched or processed. See also `FEEDBACK.md` for additional loading components.

### 1. Full Page Loading

**Use Case**: Initial app load, route navigation

**Structure**:
```html
<div class="loading-page">
  <div class="loading-content">
    <span class="spinner spinner-lg"></span>
    <p class="loading-text">Loading...</p>
  </div>
</div>
```

**CSS**:
```css
.loading-page {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-app);
  z-index: 9999;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.loading-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}
```

---

### 2. Component Loading (Skeleton)

**Use Case**: Lazy-loaded components, data fetching

**Structure**:
```html
<div class="skeleton-card">
  <div class="skeleton-header"></div>
  <div class="skeleton-line"></div>
  <div class="skeleton-line"></div>
  <div class="skeleton-line short"></div>
</div>
```

**CSS**:
```css
.skeleton-card {
  padding: var(--space-4);
  background: var(--bg-card);
  border-radius: var(--radius-lg);
}

.skeleton-header {
  width: 60%;
  height: 24px;
  background: var(--slate-200);
  border-radius: var(--radius-md);
  margin-bottom: 12px;
  animation: pulse 1.5s ease-in-out infinite;
}

.skeleton-line {
  height: 16px;
  background: var(--slate-200);
  border-radius: var(--radius-md);
  margin-bottom: 8px;
  animation: pulse 1.5s ease-in-out infinite;
}

.skeleton-line.short {
  width: 40%;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

**When to Use**:
- ✅ Loading lists (transactions, categories)
- ✅ Loading cards (dashboard stats)
- ✅ Loading complex layouts
- ❌ NOT for buttons (use spinner instead)
- ❌ NOT for fast operations (<500ms)

---

### 3. List Item Loading (Inline Skeleton)

**Use Case**: Loading individual list items

**Structure**:
```html
<div class="list">
  <div class="list-item skeleton-list-item">
    <div class="skeleton-avatar"></div>
    <div class="skeleton-content">
      <div class="skeleton-line"></div>
      <div class="skeleton-line short"></div>
    </div>
  </div>
  <!-- Repeat 3-5 times -->
</div>
```

**CSS**:
```css
.skeleton-list-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid var(--border);
}

.skeleton-avatar {
  width: 48px;
  height: 48px;
  background: var(--slate-200);
  border-radius: var(--radius-full);
  flex-shrink: 0;
  animation: pulse 1.5s ease-in-out infinite;
}

.skeleton-content {
  flex: 1;
}
```

---

## Error States

Error states inform users when something goes wrong and guide them to recovery.

### 1. Inline Error (Form Field)

**Use Case**: Form validation error, input error

**Structure**:
```html
<div class="form-group">
  <label for="email" class="input-label">Email</label>
  <input id="email" type="email" class="input input-error" aria-invalid="true" />
  <span class="input-error-text" role="alert">
    Please enter a valid email address
  </span>
</div>
```

**See**: `FORMS.md` for full form error handling

---

### 2. Component Error (Failed to Load)

**Use Case**: Component failed to load data, API error

**Structure**:
```html
<div class="error-state">
  <div class="error-state-icon">
    ⚠️
  </div>
  <h3 class="error-state-title">Failed to load transactions</h3>
  <p class="error-state-description">
    We couldn't load your transactions. Please try again.
  </p>
  <button class="btn btn-secondary btn-sm" onClick={handleRetry}>
    Try Again
  </button>
</div>
```

**CSS**:
```css
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12) var(--space-6);
  text-align: center;
  max-width: 400px;
  margin: 0 auto;
}

.error-state-icon {
  font-size: 48px;
  margin-bottom: var(--space-4);
}

.error-state-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--slate-700);
  margin: 0 0 var(--space-2) 0;
}

.error-state-description {
  font-size: 12px;
  color: var(--slate-500);
  margin: 0 0 var(--space-4) 0;
  line-height: 1.5;
}
```

**Examples**:
- Dashboard (API error): "Failed to load dashboard data"
- Ledger (network error): "Connection lost. Check your internet."
- Upload (quota error): "Upload quota exceeded. Try again tomorrow."

---

### 3. Page Error (404, 500)

**Use Case**: Page not found, server error

**Structure**:
```html
<div class="error-page">
  <div class="error-page-code">404</div>
  <h1 class="error-page-title">Page Not Found</h1>
  <p class="error-page-description">
    The page you're looking for doesn't exist or has been moved.
  </p>
  <div class="error-page-actions">
    <button class="btn btn-primary" onClick={goHome}>
      Go to Dashboard
    </button>
    <button class="btn btn-secondary" onClick={goBack}>
      Go Back
    </button>
  </div>
</div>
```

**CSS**:
```css
.error-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: var(--space-8);
  text-align: center;
}

.error-page-code {
  font-size: 72px;
  font-weight: 700;
  color: var(--slate-300);
  line-height: 1;
  margin-bottom: var(--space-4);
}

.error-page-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--slate-800);
  margin: 0 0 var(--space-2) 0;
}

.error-page-description {
  font-size: 14px;
  color: var(--slate-600);
  margin: 0 0 var(--space-8) 0;
  max-width: 400px;
}

.error-page-actions {
  display: flex;
  gap: var(--space-3);
}
```

**Examples**:
- 404: "Page Not Found"
- 500: "Something Went Wrong"
- 403: "Access Denied"

---

### 4. Toast Error (Non-Critical)

**Use Case**: Action failed, but user can continue

**See**: `FEEDBACK.md` for Toast component

**Example**:
```typescript
showToast('error', 'Upload Failed', 'Please try again or contact support');
```

---

## State Machine Pattern

Recommended state management pattern for components:

```typescript
type DataState<T> =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'success'; data: T }
  | { type: 'error'; error: Error };

function TransactionList() {
  const [state, setState] = useState<DataState<Transaction[]>>({ type: 'idle' });

  useEffect(() => {
    setState({ type: 'loading' });
    fetchTransactions()
      .then((data) => setState({ type: 'success', data }))
      .catch((error) => setState({ type: 'error', error }));
  }, []);

  switch (state.type) {
    case 'idle':
      return null;

    case 'loading':
      return <SkeletonList />;

    case 'error':
      return (
        <ErrorState
          title="Failed to load transactions"
          description={state.error.message}
          onRetry={() => refetch()}
        />
      );

    case 'success':
      if (state.data.length === 0) {
        return <EmptyState type="no-data" />;
      }
      return <TransactionList transactions={state.data} />;
  }
}
```

---

## Best Practices

### Empty States

**DO**:
- ✅ Use emoji or simple illustrations (avoid complex graphics)
- ✅ Provide clear next action (button)
- ✅ Keep copy concise (1-2 sentences)
- ✅ Match tone to context (first-use: encouraging, no-results: helpful)

**DON'T**:
- ❌ Don't show empty state during loading (use skeleton instead)
- ❌ Don't use technical jargon ("No data in database")
- ❌ Don't leave users without action (always provide button or link)

### Loading States

**DO**:
- ✅ Show skeleton for known layout (list, card)
- ✅ Show spinner for unknown/variable content
- ✅ Use spinners for fast operations (<3s)
- ✅ Show progress bar for long operations (upload, batch)

**DON'T**:
- ❌ Don't show loading for <200ms operations (causes flicker)
- ❌ Don't block entire UI for component-level loading
- ❌ Don't use generic "Loading..." for >5s operations (show progress)

### Error States

**DO**:
- ✅ Explain what happened (not just "Error")
- ✅ Suggest recovery action ("Try again", "Check connection")
- ✅ Use appropriate severity (toast for minor, page for critical)
- ✅ Log errors for debugging

**DON'T**:
- ❌ Don't show technical error messages to users
- ❌ Don't blame user ("You did something wrong")
- ❌ Don't leave errors unhandled (always catch and display)

---

## Accessibility

### Empty States

```html
<div class="empty-state" role="status">
  <p>No transactions found</p>
</div>
```

**ARIA**: `role="status"` announces to screen readers

### Loading States

```html
<div class="loading" role="status" aria-live="polite" aria-busy="true">
  <span class="spinner" aria-label="Loading content"></span>
</div>
```

**ARIA**:
- `role="status"`: Loading announcement
- `aria-live="polite"`: Don't interrupt
- `aria-busy="true"`: Indicates loading

### Error States

```html
<div class="error-state" role="alert">
  <p>Failed to load transactions</p>
</div>
```

**ARIA**: `role="alert"` announces immediately

---

## React Component Examples

### EmptyState Component

```typescript
interface EmptyStateProps {
  type: 'first-use' | 'no-data' | 'no-results';
  icon?: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ type, icon = '📊', title, description, action }: EmptyStateProps) {
  return (
    <div className={`empty-state empty-state-${type}`} role="status">
      <div className="empty-state-icon">{icon}</div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>
      {action && (
        <button
          className={`btn ${type === 'first-use' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
```

### ErrorState Component

```typescript
interface ErrorStateProps {
  title: string;
  description: string;
  onRetry?: () => void;
}

export function ErrorState({ title, description, onRetry }: ErrorStateProps) {
  return (
    <div className="error-state" role="alert">
      <div className="error-state-icon">⚠️</div>
      <h3 className="error-state-title">{title}</h3>
      <p className="error-state-description">{description}</p>
      {onRetry && (
        <button className="btn btn-secondary btn-sm" onClick={onRetry}>
          Try Again
        </button>
      )}
    </div>
  );
}
```

---

## Testing Checklist

### Visual Testing

- [ ] **Empty States**: All 3 types render correctly
- [ ] **Loading States**: Skeleton matches content layout
- [ ] **Error States**: Icon, title, description, action visible

### Interaction Testing

- [ ] **Empty State**: Action button triggers expected behavior
- [ ] **Error State**: Retry button refetches data
- [ ] **Loading State**: Transitions to success/error correctly

### Accessibility Testing

- [ ] **Screen Reader**: States announced correctly
- [ ] **Keyboard**: Action buttons focusable
- [ ] **ARIA**: role="status", role="alert" used appropriately

---

## Related Documents

- **[FEEDBACK.md](./FEEDBACK.md)** - Toast, Modal, Loading (detailed)
- **[FORMS.md](./FORMS.md)** - Form validation error states
- **[BUTTONS.md](./BUTTONS.md)** - Button loading states
- **[COLOR.md](./COLOR.md)** - Error, success, warning colors

---

## Decision Log

### [2026-01] 3 Empty State Types
**Decision**: First-use, no-data, no-results.
**Reason**: Covers all use cases, distinct purposes.
**Alternatives**: Single empty state - rejected, lacks context.

### [2026-01] Emoji for Empty State Icons
**Decision**: Use emoji instead of custom illustrations.
**Reason**: Simple, no dependencies, cross-platform.
**Alternatives**: Custom SVG illustrations - deferred until brand maturity.

### [2026-01] Skeleton over Spinner for Lists
**Decision**: Use skeleton loaders for lists/cards.
**Reason**: Reduces perceived loading time, shows expected layout.
**Alternatives**: Spinner only - rejected, less informative.

---

## Next Steps

1. **Implementation**:
   - Create EmptyState component
   - Create ErrorState component
   - Add skeleton variants

2. **Future Enhancements**:
   - Animated illustrations (Lottie)
   - Custom error tracking (Sentry integration)

---

**Last updated**: 2026-01-10
**Version**: 1.0.0
**Status**: ✅ Complete (documentation ready for implementation)
