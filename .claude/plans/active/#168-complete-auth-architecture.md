# Feature: Complete Auth Module 4-Layer Architecture - Plan

**Issue**: #168
**Tier**: T2 (Logic)
**Estimated Time**: 6-8 hours

## Overview

Complete the Auth module by extracting the vanilla Zustand store from `authStateService`, creating proper hook bridge layer, and implementing Login/Logout views with proper UI. Currently, the Auth module has services and adapters but is missing proper store separation and view implementation.

---

## Architecture Context

### Relevant ADRs

- **[ADR-001: Service Pattern](../../docs/architecture/ADR/001-service-pattern.md)**
  - Apply: Services own vanilla stores, initialized in main.tsx
  - Current state: authStateService embeds store, needs extraction

- **[ADR-012: Zustand Selector Safety](../../docs/architecture/ADR/012-zustand-selector-safety.md)**
  - Apply: Hook selectors must return primitives only
  - Risk: Object selectors cause infinite loops (Issue #86)

- **[ADR-020: Hook Bridge Layer](../../docs/architecture/ADR/020-hook-bridge-layer.md)**
  - Apply: Three identities - Connector, Selector, Orchestrator
  - Current state: hooks/useAuthState.ts already follows pattern

### Applicable Pillars

- [x] **Pillar A**: Nominal Types - UserId already branded
- [x] **Pillar B**: Airlock - Auth API responses validated with Zod
- [x] **Pillar D**: FSM - Auth states ('idle' | 'loading' | 'authenticated' | 'error')
- [x] **Pillar L**: Headless - Separate UI from logic (views will use hooks only)
- [ ] **Pillar M**: Saga - Not needed (no distributed transactions)
- [ ] **Pillar Q**: Idempotency - Not needed (login/logout are not retryable)

### Architecture Patterns

- **Service Pattern**: AuthStateService manages business logic, orchestrates adapters
- **Hook Bridge Pattern**: useAuthState.ts bridges vanilla store to React
- **FSM Pattern**: Explicit state machine with discriminated unions

---

## Current State Analysis

### What Exists ✅

1. **Services** (`services/`)
   - `authService.ts`: Cognito operations (register, login, logout, refresh)
   - `authStateService.ts`: State management + FSM (but store is embedded)

2. **Adapters** (`adapters/`)
   - `authApi.ts`: HTTP calls to Auth Lambda
   - `tokenStorage.ts`: LocalStorage for tokens
   - `authIpc.ts` (if exists): Tauri IPC for secure storage

3. **Hooks** (`hooks/`)
   - `useAuthState.ts`: Already implements Hook Bridge pattern (3 identities)
   - `useAuthInit.ts`: Initialization hook
   - `useEffectiveUserId.ts`: Guest vs authenticated user

4. **Types** (`types.ts`)
   - Complete type definitions with FSM states
   - Branded types (UserId)

### What's Missing ❌

1. **Store** (`stores/authStore.ts`)
   - Currently embedded in `authStateService.ts`
   - Needs extraction to vanilla store

2. **Views** (`views/`)
   - Empty placeholder file
   - Need: LoginView.tsx, LogoutConfirmView.tsx

3. **Integration Tests**
   - No tests verifying hook + service + store interaction

---

## Key Functions

### 1. createAuthStore (New)

**Location**: `stores/authStore.ts`

```typescript
export const authStore = createStore<AuthState>(() => ({
  status: 'loading',
  user: null,
  error: null,
}));
```

- **Pre**: None (store creation)
- **Post**: Vanilla Zustand store with initial state
- **Side effects**: None
- **Tests**: 3 test cases
  - TC-U-1.1: Store initializes with 'loading' status
  - TC-U-1.2: Store transitions between FSM states correctly
  - TC-U-1.3: Store rejects invalid state transitions

### 2. authStateService.init() (Modified)

**Location**: `services/authStateService.ts`

```typescript
async init(): Promise<void>
```

- **Pre**: Store exists, initialized = false
- **Post**: Auth session loaded, store updated with 'idle' or 'authenticated'
- **Side effects**:
  - Reads from tokenStorage
  - Updates authStore state
  - Logs AUTH_SESSION_RESTORED or AUTH_LOAD_FAILED
- **Tests**: 4 test cases
  - TC-U-2.1: Init with stored session → authenticated
  - TC-U-2.2: Init without stored session → idle
  - TC-U-2.3: Init with invalid tokens → idle + error logged
  - TC-U-2.4: Prevent duplicate initialization

### 3. authStateService.login() (Modified)

**Location**: `services/authStateService.ts`

```typescript
async login(email: string, password: string): Promise<{ success: boolean; error?: string }>
```

- **Pre**: email and password are non-empty strings
- **Post**:
  - Success: User authenticated, tokens stored, store updated
  - Failure: Store updated with error message
- **Side effects**:
  - Calls loginUser() adapter
  - Saves tokens to tokenStorage
  - Updates authStore state
  - Emits 'auth:dataClaimed' if guest data migrated
  - Updates images table userId if data claimed
- **Tests**: 6 test cases
  - TC-U-3.1: Login with valid credentials → authenticated
  - TC-U-3.2: Login with invalid credentials → error
  - TC-U-3.3: Login triggers guest data claim → emit event
  - TC-U-3.4: Login with network error → error
  - TC-U-3.5: Login transitions FSM correctly (loading → authenticated)
  - TC-U-3.6: Login with missing fields → validation error

### 4. LoginView Component (New)

**Location**: `views/LoginView.tsx`

```typescript
export function LoginView(): JSX.Element
```

- **Pre**: User is not authenticated (status === 'idle' or 'error')
- **Post**: User sees login form with email/password inputs
- **UI States**:
  - Default: Form visible, submit enabled
  - Loading: Submit disabled, loading indicator
  - Error: Error message displayed below form
  - Success: Redirect to dashboard
- **Tests**: 5 test cases
  - TC-U-4.1: Renders login form with email and password inputs
  - TC-U-4.2: Submit button disabled when fields empty
  - TC-U-4.3: Shows loading state during login
  - TC-U-4.4: Shows error message on login failure
  - TC-U-4.5: Email validation (format check)

### 5. LogoutConfirmView Component (New)

**Location**: `views/LogoutConfirmView.tsx`

```typescript
export function LogoutConfirmView(): JSX.Element
```

- **Pre**: User is authenticated (status === 'authenticated')
- **Post**: User sees confirmation dialog
- **UI States**:
  - Default: Confirmation modal with Cancel/Logout buttons
  - Loading: Logout button disabled, loading indicator
- **Tests**: 3 test cases
  - TC-U-5.1: Renders confirmation modal
  - TC-U-5.2: Cancel closes modal without logging out
  - TC-U-5.3: Logout calls authStateService.logout()

---

## Implementation Steps

### Step 1: Extract Vanilla Store

**Files affected**:
- `app/src/02_modules/auth/stores/authStore.ts` (CREATE)
- `app/src/02_modules/auth/stores/index.ts` (CREATE)
- `app/src/02_modules/auth/services/authStateService.ts` (MODIFY)

**Description**: Create standalone vanilla Zustand store, remove embedded store from service

**Subtasks**:
- [ ] Create `stores/authStore.ts` with initial FSM state
- [ ] Export store and selectors
- [ ] Update `authStateService.ts` to use external store
- [ ] Update all `this.store.setState()` to `authStore.setState()`
- [ ] Update all `this.store.getState()` to `authStore.getState()`
- [ ] Remove `store = createStore()` from authStateService class
- [ ] Update `services/index.ts` to export store

**Pillar concerns**:
- Pillar D: FSM state machine preserved
- Pillar J: Locality - store close to service

**Tests**:
- Unit: authStore initializes correctly
- Unit: authStore state transitions are valid
- Integration: authStateService uses authStore correctly

**Verification**:
```bash
# After implementation
npm run test -- auth/stores
npm run test -- auth/services/authStateService.test.ts
```

---

### Step 2: Verify Hook Bridge (Already Complete)

**Files affected**:
- `app/src/02_modules/auth/hooks/useAuthState.ts` (VERIFY)

**Description**: Verify existing hooks follow ADR-020 pattern (3 identities)

**Subtasks**:
- [x] Verify primitive selectors (useAuthStatus, useUser, useAuthError) ✅
- [x] Verify no object selectors ✅
- [x] Verify actions use useMemo ✅
- [ ] Add JSDoc comments for each hook
- [ ] Update hooks to use new authStore import

**Pillar concerns**:
- Pillar L: Headless pattern (hooks bridge logic to UI)
- ADR-012: Selector safety (primitives only)

**Tests**:
- Integration: Hooks subscribe to store correctly
- Integration: Hooks return primitive values
- Integration: Actions coordinate service methods

**Verification**:
```bash
npm run test -- auth/hooks/useAuthState.test.ts
```

---

### Step 3: Implement LoginView

**Files affected**:
- `app/src/02_modules/auth/views/LoginView.tsx` (CREATE)
- `app/src/02_modules/auth/views/LoginView.css` (CREATE)
- `app/src/02_modules/auth/views/index.ts` (MODIFY)

**Description**: Create login form UI with email/password inputs, validation, and error handling

**Subtasks**:
- [ ] Create LoginView component with form structure
- [ ] Add email input with format validation
- [ ] Add password input
- [ ] Add submit button with loading state
- [ ] Add error message display
- [ ] Connect to useAuthActions hook
- [ ] Add form validation (empty fields, email format)
- [ ] Style according to FORMS.md design spec
- [ ] Add accessibility attributes (aria-label, role)

**Pillar concerns**:
- Pillar L: View uses hooks only, no direct service access
- Design System: Follow FORMS.md input specs

**UI Specifications** (from FORMS.md):
- Input height: 40px
- Border: 1px solid var(--border)
- Focus border: 2px solid var(--color-primary)
- Border radius: var(--radius-md)
- Error state: border-color var(--color-error)
- Submit button: Primary button style (BUTTONS.md)

**Tests**:
- Unit: LoginView renders form correctly
- Unit: Validation shows errors for invalid email
- Unit: Submit button disabled when loading
- Integration: Form submission calls authStateService.login()
- Integration: Error message displayed on login failure

**Verification**:
```bash
npm run test -- auth/views/LoginView.test.tsx
npm run dev  # Manual UI verification
```

---

### Step 4: Implement LogoutConfirmView

**Files affected**:
- `app/src/02_modules/auth/views/LogoutConfirmView.tsx` (CREATE)
- `app/src/02_modules/auth/views/LogoutConfirmView.css` (CREATE)
- `app/src/02_modules/auth/views/index.ts` (MODIFY)

**Description**: Create logout confirmation modal

**Subtasks**:
- [ ] Create LogoutConfirmView component
- [ ] Add confirmation modal structure
- [ ] Add Cancel button
- [ ] Add Logout button with loading state
- [ ] Connect to useAuthActions hook
- [ ] Style according to FEEDBACK.md modal spec
- [ ] Add keyboard navigation (Escape to cancel)
- [ ] Add accessibility attributes

**Pillar concerns**:
- Pillar L: View uses hooks only
- Design System: Follow FEEDBACK.md modal specs

**UI Specifications**:
- Modal overlay: semi-transparent background
- Modal content: var(--bg-card) with shadow
- Cancel button: Secondary style
- Logout button: Error style (red)

**Tests**:
- Unit: LogoutConfirmView renders modal
- Unit: Cancel button closes modal
- Unit: Logout button calls authStateService.logout()
- Integration: Modal closes after logout completes

**Verification**:
```bash
npm run test -- auth/views/LogoutConfirmView.test.tsx
npm run dev  # Manual UI verification
```

---

### Step 5: Integration Tests

**Files affected**:
- `app/src/02_modules/auth/auth.integration.test.ts` (CREATE)

**Description**: Create integration tests verifying full flow (store → service → hooks → views)

**Subtasks**:
- [ ] Test: Login flow (form submit → service → store → hook update)
- [ ] Test: Logout flow (button click → service → store → hook update)
- [ ] Test: Session restoration (init → load tokens → store → hook update)
- [ ] Test: Error handling (failed login → error in store → error in hook)
- [ ] Test: Guest data claim (login with deviceId → emit event → update images)

**Pillar concerns**:
- Integration: Verify all layers work together
- ADR-001: Service initialization in main.tsx (verify indirectly)

**Test Strategy**:
- Mock ONLY external services (authApi, tokenStorage, eventBus)
- Use REAL authStore, authStateService, hooks
- Verify state flows through all layers

**Tests**:
- TC-INT-1.1: Login flow updates store and triggers hook re-render
- TC-INT-1.2: Logout flow clears user and updates hooks
- TC-INT-1.3: Session restore loads user on init
- TC-INT-1.4: Failed login shows error in view
- TC-INT-1.5: Guest data claim emits event correctly

**Verification**:
```bash
npm run test -- auth/auth.integration.test.ts
```

---

### Step 6: Update Module Index

**Files affected**:
- `app/src/02_modules/auth/index.ts` (MODIFY)

**Description**: Export new views and stores

**Subtasks**:
- [ ] Export authStore from stores
- [ ] Export LoginView from views
- [ ] Export LogoutConfirmView from views
- [ ] Verify no circular dependencies
- [ ] Update JSDoc comments

**Pillar concerns**:
- Pillar I: Firewalls (proper module boundaries)

**Verification**:
```bash
# Check exports are correct
npm run build
# Should compile without circular dependency errors
```

---

### Step 7: Update Main.tsx (If Needed)

**Files affected**:
- `app/src/main.tsx` (VERIFY)

**Description**: Verify authStateService.init() is called at app startup

**Subtasks**:
- [ ] Check if authStateService.init() already called
- [ ] If not, add init call in main.tsx
- [ ] Verify init happens before React render

**Pillar concerns**:
- ADR-001: Service initialization at startup

**Verification**:
```bash
npm run dev
# Check console logs for AUTH_SESSION_RESTORED or similar
```

---

## Technical Decisions

### 1. Store Extraction Strategy

**Decision**: Extract store to separate file, keep service as orchestrator

**Rationale**:
- Follows ADR-001 pattern (services own stores, but stores are separate entities)
- Enables easier testing (can test store independently)
- Matches pattern used in other modules (Settings, Debug, Transaction)

**Alternatives Considered**:
- Keep store embedded in service → Rejected (doesn't follow established pattern)
- Use React Context for state → Rejected (violates ADR-001, tied to React)

---

### 2. Form Validation Strategy

**Decision**: Basic format validation in view, business validation in service

**Rationale**:
- ADR-020: Format validation (UI concern) in hook/view
- Business validation (user exists, password correct) in service
- Prevents unnecessary API calls for invalid formats

**Example**:
```typescript
// LoginView (format validation)
const emailError = !email.includes('@') ? 'Invalid email format' : null;

// authStateService (business validation)
const result = await loginUser(email, password);
if (!result.ok) {
  throw new Error('Invalid credentials'); // Business rule
}
```

---

### 3. View Component Structure

**Decision**: Create separate LoginView and LogoutConfirmView components

**Rationale**:
- LoginView: Full-page form (route: /login)
- LogoutConfirmView: Modal overlay (triggered from menu)
- Separation of concerns (different UI patterns)

**Alternatives Considered**:
- Single AuthView with mode prop → Rejected (too complex, different use cases)

---

## Risk Assessment

### Medium Risk: Store Extraction

**Risk**: Breaking existing service logic during store extraction

**Mitigation**:
1. Run all existing tests before and after extraction
2. Verify no regression in auth flows (login, logout, refresh)
3. Test session restoration carefully

**Indicators**:
- Tests pass: ✅ Safe to proceed
- Tests fail: ❌ Debug store access patterns

---

### Low Risk: View Implementation

**Risk**: UI not matching design spec

**Mitigation**:
1. Follow FORMS.md and BUTTONS.md strictly
2. Use design tokens (no hard-coded values)
3. Manual visual testing before PR

**Indicators**:
- Design tokens used: ✅ Consistent
- Hard-coded values: ❌ Fix immediately

---

### Low Risk: Integration Test Mocking

**Risk**: Over-mocking hides architectural issues

**Mitigation**:
1. Mock ONLY external boundaries (authApi, tokenStorage)
2. Use REAL store, service, hooks
3. Verify data flows through all layers

**Reference**: Issue #89 lesson (unit tests with heavy mocking missed issues)

---

## Deployment Notes

### Breaking Changes

None - this is purely additive (completing incomplete module)

### Migration

None needed - store extraction is internal refactoring

### Feature Flags

Not applicable

---

## Acceptance Criteria

- [ ] authStore extracted to separate file
- [ ] authStateService uses external authStore
- [ ] All existing tests still pass
- [ ] LoginView renders with email/password inputs
- [ ] LoginView validates email format
- [ ] LoginView calls authStateService.login() on submit
- [ ] LoginView shows loading state during login
- [ ] LoginView shows error message on failure
- [ ] LogoutConfirmView renders confirmation modal
- [ ] LogoutConfirmView calls authStateService.logout() on confirm
- [ ] LogoutConfirmView closes on cancel
- [ ] Integration tests cover full login/logout flow
- [ ] Integration tests verify hook + service + store interaction
- [ ] All exports updated in module index
- [ ] Design tokens used (no hard-coded values)
- [ ] Accessibility attributes present (aria-label, role)

---

## Test Coverage Matrix

| Acceptance Criterion | Unit Tests | Integration Tests | Status |
|---------------------|-----------|-------------------|--------|
| Store extraction | TC-U-1.1-1.3 | TC-INT-1.1-1.5 | Pending |
| Service uses external store | TC-U-2.1-2.4, TC-U-3.1-3.6 | TC-INT-1.1-1.5 | Pending |
| LoginView form | TC-U-4.1-4.5 | TC-INT-1.1, TC-INT-1.4 | Pending |
| LogoutConfirmView modal | TC-U-5.1-5.3 | TC-INT-1.2 | Pending |
| Session restoration | TC-U-2.1-2.2 | TC-INT-1.3 | Pending |
| Error handling | TC-U-3.2, TC-U-3.4, TC-U-4.4 | TC-INT-1.4 | Pending |
| Guest data claim | TC-U-3.3 | TC-INT-1.5 | Pending |

**Expected Coverage**:
- Unit tests: ~30-40 test cases
- Integration tests: ~5 test cases
- Total: ~35-45 test cases

---

## Related Documentation

- **ADR-001**: Service Pattern
- **ADR-012**: Zustand Selector Safety
- **ADR-020**: Hook Bridge Layer
- **FORMS.md**: Input component specifications
- **BUTTONS.md**: Button component specifications
- **FEEDBACK.md**: Modal component specifications
- **Issue #165**: Settings 4-layer (reference implementation)
- **Issue #166**: Debug Hook Bridge (reference implementation)

---

**Plan Created**: 2026-01-27
**Estimated Completion**: 6-8 hours (split across multiple sessions)
**Complexity**: T2 (Logic tier - forms, FSM, async operations)
