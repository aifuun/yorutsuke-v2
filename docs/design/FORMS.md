# Form Component System
> Strategy: 70% Material Design 3 + 30% Yorutsuke pragmatism

## Overview

Form component specifications defining Input, Select, Textarea, Checkbox, Radio, and validation states. Provides unified design system for all form elements across the application.

**Current Status**: Documentation complete, ready for implementation.

---

## Input Component

### Base Specifications

| Property | Value | Token | Notes |
|----------|-------|-------|-------|
| **Height** | 40px (base), 48px (large) | - | Default: 40px |
| **Padding** | 12px horizontal, 8px vertical | `var(--space-3) var(--space-2)` | Internal spacing |
| **Border** | 1px solid slate-300 | `1px solid var(--border)` | Default state |
| **Border (focus)** | 2px solid blue-500 | `2px solid var(--color-primary)` | Focus state |
| **Border Radius** | 8px | `var(--radius-md)` | Consistent with system |
| **Font Size** | 14px | `var(--font-size-base)` | Body text size |
| **Background** | White | `var(--bg-input)` | Light theme |

### Input States

#### 1. Default State

```css
.input {
  width: 100%;
  height: 40px;
  padding: 8px 12px;
  font-size: 14px;
  font-family: var(--font-ui);
  color: var(--text-primary);
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  transition: border-color var(--duration-fast) var(--ease-standard);
}

.input::placeholder {
  color: var(--text-muted);
}
```

#### 2. Focus State

```css
.input:focus {
  outline: none;
  border: 2px solid var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}
```

#### 3. Disabled State

```css
.input:disabled {
  background: var(--slate-100);
  color: var(--text-muted);
  cursor: not-allowed;
  opacity: 0.6;
}
```

#### 4. Error State

```css
.input-error {
  border-color: var(--color-error);
}

.input-error:focus {
  border-color: var(--color-error);
  box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.15);
}
```

#### 5. Success State

```css
.input-success {
  border-color: var(--color-success);
}

.input-success:focus {
  border-color: var(--color-success);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
}
```

### Input Sizes

#### Small (32px height)

```css
.input-sm {
  height: 32px;
  padding: 6px 10px;
  font-size: 13px;
}
```

#### Base (40px height) ← **Default**

```css
.input, .input-md {
  height: 40px;
  padding: 8px 12px;
  font-size: 14px;
}
```

#### Large (48px height)

```css
.input-lg {
  height: 48px;
  padding: 12px 16px;
  font-size: 14px;
}
```

### Input Variants

#### 1. Text Input

```html
<input type="text" class="input" placeholder="Enter text..." />
```

#### 2. Number Input

```html
<input type="number" class="input" placeholder="0" />
```

**CSS** (hide spinner for cleaner look):
```css
.input[type="number"]::-webkit-inner-spin-button,
.input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.input[type="number"] {
  -moz-appearance: textfield;
}
```

#### 3. Email Input

```html
<input type="email" class="input" placeholder="email@example.com" />
```

#### 4. Password Input

```html
<div class="input-wrapper">
  <input type="password" class="input" placeholder="Password" />
  <button type="button" class="input-icon-btn" aria-label="Toggle password visibility">
    <!-- Eye icon -->
  </button>
</div>
```

**CSS**:
```css
.input-wrapper {
  position: relative;
  display: inline-block;
  width: 100%;
}

.input-icon-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: var(--slate-500);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-xs);
}

.input-icon-btn:hover {
  background: var(--slate-100);
  color: var(--slate-700);
}
```

---

## Label & Helper Text

### Label

```html
<label for="email" class="input-label">
  Email Address <span class="required">*</span>
</label>
<input id="email" type="email" class="input" required />
```

**CSS**:
```css
.input-label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.input-label .required {
  color: var(--color-error);
}
```

### Helper Text

```html
<input type="email" class="input" />
<span class="input-helper">We'll never share your email</span>
```

**CSS**:
```css
.input-helper {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}
```

### Error Message

```html
<input type="email" class="input input-error" aria-invalid="true" aria-describedby="email-error" />
<span id="email-error" class="input-error-text" role="alert">
  Please enter a valid email address
</span>
```

**CSS**:
```css
.input-error-text {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-error);
}
```

---

## Select Component

### Base Select

```html
<select class="select">
  <option value="">Choose an option</option>
  <option value="1">Option 1</option>
  <option value="2">Option 2</option>
</select>
```

**CSS**:
```css
.select {
  width: 100%;
  height: 40px;
  padding: 8px 32px 8px 12px; /* Extra padding for arrow */
  font-size: 14px;
  font-family: var(--font-ui);
  color: var(--text-primary);
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-standard);
  appearance: none; /* Remove native arrow */
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M5 7.5L10 12.5L15 7.5' stroke='%2364748B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  background-size: 20px;
}

.select:focus {
  outline: none;
  border: 2px solid var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.select:disabled {
  background-color: var(--slate-100);
  color: var(--text-muted);
  cursor: not-allowed;
  opacity: 0.6;
}
```

### Custom Dropdown (React Select Alternative)

For more control, use a custom dropdown component:

```typescript
// Future: Implement custom Select with better UX
// - Search/filter options
// - Multi-select
// - Async loading
// - Custom styling
```

---

## Textarea Component

### Base Textarea

```html
<textarea class="textarea" rows="4" placeholder="Enter description..."></textarea>
```

**CSS**:
```css
.textarea {
  width: 100%;
  min-height: 80px;
  padding: 8px 12px;
  font-size: 14px;
  font-family: var(--font-ui);
  color: var(--text-primary);
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  resize: vertical; /* Allow vertical resize only */
  transition: border-color var(--duration-fast) var(--ease-standard);
}

.textarea:focus {
  outline: none;
  border: 2px solid var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.textarea::placeholder {
  color: var(--text-muted);
}
```

### Character Count

```html
<div class="textarea-wrapper">
  <textarea class="textarea" maxlength="500"></textarea>
  <span class="textarea-count">0 / 500</span>
</div>
```

**CSS**:
```css
.textarea-wrapper {
  position: relative;
}

.textarea-count {
  position: absolute;
  bottom: 8px;
  right: 12px;
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-input);
  padding: 2px 4px;
}
```

---

## Checkbox Component

### Base Checkbox

```html
<label class="checkbox">
  <input type="checkbox" class="checkbox-input" />
  <span class="checkbox-label">I agree to the terms</span>
</label>
```

**CSS**:
```css
.checkbox {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.checkbox-input {
  width: 20px;
  height: 20px;
  margin: 0;
  margin-right: 8px;
  cursor: pointer;
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  appearance: none;
  background: var(--bg-input);
  transition: all var(--duration-fast) var(--ease-standard);
}

.checkbox-input:checked {
  background: var(--color-primary);
  border-color: var(--color-primary);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M13.5 4L6 11.5L2.5 8' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: center;
  background-size: 14px;
}

.checkbox-input:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.checkbox-input:disabled {
  cursor: not-allowed;
  opacity: 0.5;
  background-color: var(--slate-100);
}

.checkbox-label {
  font-size: 14px;
  color: var(--text-primary);
}
```

---

## Radio Component

### Base Radio

```html
<div class="radio-group">
  <label class="radio">
    <input type="radio" name="option" class="radio-input" value="1" />
    <span class="radio-label">Option 1</span>
  </label>
  <label class="radio">
    <input type="radio" name="option" class="radio-input" value="2" />
    <span class="radio-label">Option 2</span>
  </label>
</div>
```

**CSS**:
```css
.radio-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.radio {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.radio-input {
  width: 20px;
  height: 20px;
  margin: 0;
  margin-right: 8px;
  cursor: pointer;
  border: 1px solid var(--border);
  border-radius: 50%;
  appearance: none;
  background: var(--bg-input);
  transition: all var(--duration-fast) var(--ease-standard);
}

.radio-input:checked {
  border-color: var(--color-primary);
  border-width: 6px;
  background: white;
}

.radio-input:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.radio-input:disabled {
  cursor: not-allowed;
  opacity: 0.5;
  background-color: var(--slate-100);
}

.radio-label {
  font-size: 14px;
  color: var(--text-primary);
}
```

---

## Form Layout

### Vertical Layout (Default)

```html
<form class="form">
  <div class="form-group">
    <label for="name" class="input-label">Name</label>
    <input id="name" type="text" class="input" />
  </div>

  <div class="form-group">
    <label for="email" class="input-label">Email</label>
    <input id="email" type="email" class="input" />
  </div>

  <div class="form-actions">
    <button type="submit" class="btn btn-primary">Submit</button>
    <button type="button" class="btn btn-secondary">Cancel</button>
  </div>
</form>
```

**CSS**:
```css
.form {
  max-width: 500px;
}

.form-group {
  margin-bottom: var(--space-6); /* 24px */
}

.form-actions {
  display: flex;
  gap: var(--space-3); /* 12px */
  margin-top: var(--space-8); /* 32px */
}
```

### Horizontal Layout

```html
<div class="form-row">
  <label for="first-name" class="form-row-label">First Name</label>
  <input id="first-name" type="text" class="input form-row-input" />
</div>
```

**CSS**:
```css
.form-row {
  display: flex;
  align-items: center;
  gap: var(--space-4); /* 16px */
  margin-bottom: var(--space-4);
}

.form-row-label {
  width: 120px;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.form-row-input {
  flex: 1;
}
```

### Grid Layout (2 columns)

```html
<div class="form-grid">
  <div class="form-group">
    <label for="first-name" class="input-label">First Name</label>
    <input id="first-name" type="text" class="input" />
  </div>

  <div class="form-group">
    <label for="last-name" class="input-label">Last Name</label>
    <input id="last-name" type="text" class="input" />
  </div>
</div>
```

**CSS**:
```css
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

@media (max-width: 767px) {
  .form-grid {
    grid-template-columns: 1fr; /* Stack on mobile */
  }
}
```

---

## Validation States

### Inline Validation (Real-time)

**Success**:
```html
<div class="form-group">
  <label for="email" class="input-label">Email</label>
  <input id="email" type="email" class="input input-success" value="user@example.com" />
  <span class="input-success-text">✓ Email is valid</span>
</div>
```

**CSS**:
```css
.input-success-text {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-success);
}
```

**Error**:
```html
<div class="form-group">
  <label for="email" class="input-label">Email</label>
  <input id="email" type="email" class="input input-error" value="invalid" aria-invalid="true" />
  <span class="input-error-text" role="alert">Please enter a valid email</span>
</div>
```

### Submit Validation

Show errors after form submission attempt:

```typescript
const [errors, setErrors] = useState<Record<string, string>>({});

const handleSubmit = (e: FormEvent) => {
  e.preventDefault();
  const newErrors = validateForm(formData);

  if (Object.keys(newErrors).length > 0) {
    setErrors(newErrors);
    // Focus first error field
    const firstErrorField = document.querySelector('.input-error');
    firstErrorField?.focus();
    return;
  }

  // Submit form
};
```

---

## Accessibility

### Label Association

**Always** associate labels with inputs:

```html
<!-- Method 1: for/id (preferred) -->
<label for="username">Username</label>
<input id="username" type="text" class="input" />

<!-- Method 2: Wrapping -->
<label>
  Username
  <input type="text" class="input" />
</label>
```

### Required Fields

```html
<label for="email" class="input-label">
  Email <span class="required" aria-label="required">*</span>
</label>
<input id="email" type="email" class="input" required aria-required="true" />
```

### Error Messages

```html
<input
  id="email"
  type="email"
  class="input input-error"
  aria-invalid="true"
  aria-describedby="email-error"
/>
<span id="email-error" role="alert">Invalid email format</span>
```

### Disabled Fields

```html
<input type="text" class="input" disabled aria-disabled="true" />
```

### Autocomplete

Use `autocomplete` attribute for better UX:

```html
<input type="email" class="input" autocomplete="email" />
<input type="password" class="input" autocomplete="current-password" />
<input type="text" class="input" autocomplete="given-name" />
```

---

## React Form Example

```typescript
import { useState, FormEvent } from 'react';

interface FormData {
  email: string;
  password: string;
  remember: boolean;
}

export function LoginForm() {
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    remember: false,
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validate
    const newErrors: Partial<FormData> = {};
    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.password) newErrors.password = 'Password is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Submit
    setIsSubmitting(true);
    try {
      await login(formData);
    } catch (error) {
      setErrors({ email: 'Invalid credentials' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      <div className="form-group">
        <label htmlFor="email" className="input-label">
          Email <span className="required">*</span>
        </label>
        <input
          id="email"
          type="email"
          className={`input ${errors.email ? 'input-error' : ''}`}
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <span id="email-error" className="input-error-text" role="alert">
            {errors.email}
          </span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="password" className="input-label">
          Password <span className="required">*</span>
        </label>
        <input
          id="password"
          type="password"
          className={`input ${errors.password ? 'input-error' : ''}`}
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          aria-invalid={!!errors.password}
        />
        {errors.password && (
          <span className="input-error-text" role="alert">{errors.password}</span>
        )}
      </div>

      <div className="form-group">
        <label className="checkbox">
          <input
            type="checkbox"
            className="checkbox-input"
            checked={formData.remember}
            onChange={(e) => setFormData({ ...formData, remember: e.target.checked })}
          />
          <span className="checkbox-label">Remember me</span>
        </label>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Logging in...' : 'Log in'}
        </button>
      </div>
    </form>
  );
}
```

---

## Testing Checklist

### Visual Testing

- [ ] **Inputs**: All states render correctly (default, focus, error, success, disabled)
- [ ] **Select**: Custom arrow appears, options visible
- [ ] **Textarea**: Resizable vertically, min-height correct
- [ ] **Checkbox/Radio**: Checked state shows checkmark/dot
- [ ] **Labels**: Associated with inputs, required asterisk visible

### Interaction Testing

- [ ] **Focus**: Tab order logical, focus ring visible
- [ ] **Validation**: Errors show on submit, clear on fix
- [ ] **Checkbox/Radio**: Toggleable via click or keyboard
- [ ] **Select**: Options selectable, value updates

### Accessibility Testing

- [ ] **Labels**: All inputs have associated labels
- [ ] **ARIA**: aria-invalid, aria-required, aria-describedby used correctly
- [ ] **Keyboard**: All inputs accessible via Tab/Shift+Tab
- [ ] **Screen Reader**: Errors announced with role="alert"

---

## Related Documents

- **[BUTTONS.md](./BUTTONS.md)** - Button styles for form actions
- **[COLOR.md](./COLOR.md)** - Color tokens (error, success, primary)
- **[SPACING.md](./SPACING.md)** - Form group spacing
- **[ACCESSIBILITY.md](./ACCESSIBILITY.md)** - WCAG standards

---

## Decision Log

### [2026-01] No Custom Select Library (Initially)
**Decision**: Use native `<select>` first, add custom library if needed.
**Reason**: Native select works well for simple use cases, lighter bundle.
**Alternatives**: React Select - deferred until complex use cases emerge.

### [2026-01] Vertical Resize Only for Textarea
**Decision**: `resize: vertical` for textarea.
**Reason**: Horizontal resize breaks layout, vertical is sufficient.
**Alternatives**: `resize: both` - rejected for UX.

### [2026-01] Hide Number Input Spinners
**Decision**: Hide spinners on `<input type="number">`.
**Reason**: Cleaner look, users can type directly.
**Alternatives**: Keep spinners - rejected for visual clutter.

---

## Next Steps

1. **Implementation**:
   - Create form component library
   - Add validation helpers
   - Implement error handling

2. **Future Enhancements**:
   - Custom Select component (search, multi-select)
   - Date picker styling
   - File upload component

---

**Last updated**: 2026-01-10
**Version**: 1.0.0
**Status**: ✅ Complete (documentation ready for implementation)
