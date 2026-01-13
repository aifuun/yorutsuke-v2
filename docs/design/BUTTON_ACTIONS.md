# Standard Button Actions Guide

**Purpose**: Standardized button usage for common actions across the application.

**Base Reference**: See `BUTTONS.md` for component specifications.

---

## Button Action Standards

### 1. ✅ Confirm / OK

**Variant**: `primary`
**Use Case**: Confirm an action, submit a form, acknowledge a message
**Icon**: ✓ (Check) - optional
**Text Examples**:
- English: "Confirm", "OK", "Got it", "Agree"
- 日本語: "確認", "OK", "了解"
- 中文: "确认", "好的", "知道了"

**CSS**:
```css
.btn-confirm {
  /* Inherits from btn-primary */
}
```

**React Example**:
```typescript
<Button variant="primary" onClick={handleConfirm}>
  Confirm
</Button>

// With icon
<Button variant="primary" iconLeft={<Check size={20} />} onClick={handleConfirm}>
  Confirm
</Button>
```

**Rules**:
- ✅ One per dialog/form
- ✅ Right-most position in button group
- ✅ Disabled if form invalid
- ⚠️ Always pair with Cancel button

---

### 2. ❌ Cancel

**Variant**: `secondary`
**Use Case**: Cancel an operation, close without saving, dismiss a dialog
**Icon**: None (text only)
**Text Examples**:
- English: "Cancel", "Dismiss", "Close"
- 日本語: "キャンセル", "閉じる"
- 中文: "取消", "关闭"

**CSS**:
```css
.btn-cancel {
  /* Inherits from btn-secondary */
}
```

**React Example**:
```typescript
<Button variant="secondary" onClick={handleCancel}>
  Cancel
</Button>
```

**Rules**:
- ✅ Left of Confirm/OK button
- ✅ Always enabled (no disabled state)
- ✅ ESC key should trigger cancel action
- ✅ Clicking overlay should trigger cancel

**Button Group Example**:
```typescript
<div className="btn-group">
  <Button variant="secondary" onClick={onCancel}>
    Cancel
  </Button>
  <Button variant="primary" onClick={onConfirm}>
    Confirm
  </Button>
</div>
```

---

### 3. 🗑️ Delete

**Variant**: `danger`
**Use Case**: Permanently remove data (cannot undo)
**Icon**: 🗑️ (Trash) or <Trash2 /> from lucide-react
**Text Examples**:
- English: "Delete", "Remove", "Discard"
- 日本語: "削除", "取り除く", "破棄"
- 中文: "删除", "移除", "丢弃"

**CSS**:
```css
.btn-delete {
  /* Inherits from btn-danger */
}
```

**React Example**:
```typescript
import { Trash2 } from 'lucide-react';

<Button variant="danger" iconLeft={<Trash2 size={20} />} onClick={handleDelete}>
  Delete
</Button>
```

**Rules**:
- ⚠️ **MUST show confirmation dialog** (destructive action)
- ✅ Disabled if nothing selected
- ✅ Use danger variant (red background)
- ✅ Clear label explaining what will be deleted

**Confirmation Dialog Pattern**:
```typescript
// Step 1: User clicks delete button
const handleDeleteClick = async () => {
  const confirmed = await ask(
    'Are you sure you want to delete this transaction?',
    {
      title: 'Delete Transaction',
      kind: 'warning',
      okLabel: 'Delete',
      cancelLabel: 'Cancel',
    }
  );

  if (confirmed) {
    await deleteTransaction(id);
  }
};

// Step 2: Show delete button
<Button variant="danger" iconLeft={<Trash2 size={20} />} onClick={handleDeleteClick}>
  Delete
</Button>
```

---

### 4. ✕ Close

**Variant**: `ghost` or icon-only
**Use Case**: Close a modal, dismiss a notification, exit a view
**Icon**: ✕ (X) or <X /> from lucide-react
**Text**: Icon only (no text)

**CSS**:
```css
.btn-close {
  /* Icon-only ghost button */
  width: 32px;
  height: 32px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

**React Example**:
```typescript
import { X } from 'lucide-react';

<button
  className="btn btn-ghost btn-icon"
  onClick={onClose}
  aria-label="Close"
>
  <X size={20} />
</button>
```

**Rules**:
- ✅ Top-right corner of modal/dialog
- ✅ **MUST include aria-label** (icon-only)
- ✅ ESC key should also trigger close
- ✅ Size: 32px × 32px minimum

**Modal Header Example**:
```typescript
<div className="modal-header">
  <h2 className="modal-title">Settings</h2>
  <button
    className="btn btn-ghost btn-icon"
    onClick={onClose}
    aria-label="Close settings"
  >
    <X size={20} />
  </button>
</div>
```

---

### 5. 🔄 Sync

**Variant**: `primary` or `ghost` (depending on context)
**Use Case**: Synchronize data with cloud, refresh data
**Icon**: ↻ (Circular arrow) or <RefreshCw /> from lucide-react
**Text Examples**:
- English: "Sync", "Sync Now", "Refresh"
- 日本語: "同期", "今すぐ同期", "更新"
- 中文: "同步", "立即同步", "刷新"

**CSS**:
```css
.btn-sync {
  /* Can be primary or ghost */
}

/* Loading state - spinning icon */
.btn-sync.btn-loading .icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

**React Example**:
```typescript
import { RefreshCw } from 'lucide-react';

// Primary sync button (standalone)
<Button
  variant="primary"
  iconLeft={<RefreshCw size={20} />}
  onClick={handleSync}
  loading={isSyncing}
>
  {isSyncing ? 'Syncing...' : 'Sync Now'}
</Button>

// Ghost sync button (toolbar)
<button
  className="btn btn-ghost btn-icon"
  onClick={handleSync}
  disabled={isSyncing}
  aria-label="Sync data"
>
  <RefreshCw size={20} className={isSyncing ? 'icon-spinning' : ''} />
</button>
```

**Rules**:
- ✅ Show loading state during sync (spinning icon)
- ✅ Disable during sync (prevent double-click)
- ✅ Show success feedback after sync
- ✅ Handle errors gracefully (show error message)

**Sync Status Pattern**:
```typescript
const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

const handleSync = async () => {
  setSyncStatus('syncing');
  try {
    await syncData();
    setSyncStatus('success');
    showToast('Synced successfully', 'success');
    setTimeout(() => setSyncStatus('idle'), 2000);
  } catch (error) {
    setSyncStatus('error');
    showToast('Sync failed', 'error');
  }
};

<Button
  variant="primary"
  iconLeft={<RefreshCw size={20} />}
  onClick={handleSync}
  loading={syncStatus === 'syncing'}
  disabled={syncStatus === 'syncing'}
>
  {syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}
</Button>
```

---

### 6. 💾 Save

**Variant**: `primary`
**Use Case**: Save changes, persist data
**Icon**: 💾 (Floppy disk) or <Save /> from lucide-react
**Text Examples**:
- English: "Save", "Save Changes", "Apply"
- 日本語: "保存", "変更を保存", "適用"
- 中文: "保存", "保存更改", "应用"

**React Example**:
```typescript
import { Save } from 'lucide-react';

<Button
  variant="primary"
  iconLeft={<Save size={20} />}
  onClick={handleSave}
  disabled={!hasChanges}
>
  Save Changes
</Button>
```

**Rules**:
- ✅ Disabled if no changes made
- ✅ Show loading state during save
- ✅ Auto-disable after successful save
- ✅ Show success feedback

---

### 7. ✏️ Edit

**Variant**: `ghost` or `secondary`
**Use Case**: Enter edit mode, modify data
**Icon**: ✏️ (Pencil) or <Edit2 /> from lucide-react
**Text Examples**:
- English: "Edit", "Modify"
- 日本語: "編集", "変更"
- 中文: "编辑", "修改"

**React Example**:
```typescript
import { Edit2 } from 'lucide-react';

// Inline ghost button
<button
  className="btn btn-ghost btn-sm"
  onClick={handleEdit}
  aria-label="Edit transaction"
>
  <Edit2 size={16} />
</button>

// Secondary button
<Button variant="secondary" iconLeft={<Edit2 size={20} />} onClick={handleEdit}>
  Edit
</Button>
```

**Rules**:
- ✅ Use ghost for inline actions
- ✅ Use secondary for standalone actions
- ✅ Toggle to "Save" when in edit mode

---

### 8. ➕ Add / Create

**Variant**: `primary`
**Use Case**: Create new item, add to list
**Icon**: ➕ (Plus) or <Plus /> from lucide-react
**Text Examples**:
- English: "Add", "Create", "New"
- 日本語: "追加", "作成", "新規"
- 中文: "添加", "创建", "新建"

**React Example**:
```typescript
import { Plus } from 'lucide-react';

<Button variant="primary" iconLeft={<Plus size={20} />} onClick={handleAdd}>
  Add Transaction
</Button>
```

**Rules**:
- ✅ Use primary variant (high emphasis)
- ✅ Clear label what will be added
- ✅ Opens modal or navigates to form

---

### 9. 📤 Upload

**Variant**: `primary`
**Use Case**: Upload files, images, documents
**Icon**: 📤 (Upload) or <Upload /> from lucide-react
**Text Examples**:
- English: "Upload", "Choose File", "Browse"
- 日本語: "アップロード", "ファイルを選択", "参照"
- 中文: "上传", "选择文件", "浏览"

**React Example**:
```typescript
import { Upload } from 'lucide-react';

<Button
  variant="primary"
  iconLeft={<Upload size={20} />}
  onClick={handleUpload}
>
  Upload Receipt
</Button>
```

**Rules**:
- ✅ Show progress during upload
- ✅ Disable during upload
- ✅ Validate file type/size before upload
- ✅ Show success/error feedback

---

### 10. 🔙 Back / Return

**Variant**: `ghost` or `secondary`
**Use Case**: Navigate to previous screen
**Icon**: ← (Left arrow) or <ArrowLeft /> from lucide-react
**Text Examples**:
- English: "Back", "Return", "Go Back"
- 日本語: "戻る", "前に戻る"
- 中文: "返回", "后退"

**React Example**:
```typescript
import { ArrowLeft } from 'lucide-react';

<Button
  variant="ghost"
  iconLeft={<ArrowLeft size={20} />}
  onClick={handleGoBack}
>
  Back
</Button>
```

**Rules**:
- ✅ Top-left of page/modal
- ✅ Always enabled
- ✅ Browser back button should also work

---

## Button Group Patterns

### 1. Confirm Dialog (Modal Footer)

```typescript
<div className="modal-footer">
  <div className="btn-group">
    <Button variant="secondary" onClick={onCancel}>
      Cancel
    </Button>
    <Button variant="primary" onClick={onConfirm}>
      Confirm
    </Button>
  </div>
</div>
```

**CSS**:
```css
.modal-footer {
  display: flex;
  justify-content: flex-end;
  padding: var(--space-4);
  border-top: 1px solid var(--border);
}

.btn-group {
  display: flex;
  gap: var(--space-3); /* 12px */
}
```

---

### 2. Destructive Action Dialog

```typescript
<div className="modal-footer">
  <div className="btn-group">
    <Button variant="secondary" onClick={onCancel}>
      Cancel
    </Button>
    <Button variant="danger" iconLeft={<Trash2 />} onClick={onDelete}>
      Delete
    </Button>
  </div>
</div>
```

---

### 3. Form Actions (Save/Cancel)

```typescript
<div className="form-actions">
  <Button variant="ghost" onClick={onCancel}>
    Cancel
  </Button>
  <Button
    variant="primary"
    onClick={onSave}
    disabled={!hasChanges || !isValid}
  >
    Save Changes
  </Button>
</div>
```

**CSS**:
```css
.form-actions {
  display: flex;
  justify-content: space-between;
  padding-top: var(--space-6);
  border-top: 1px solid var(--border);
}
```

---

### 4. Page Header Actions

```typescript
<div className="page-header">
  <h1>Transactions</h1>
  <div className="page-actions">
    <button
      className="btn btn-ghost btn-icon"
      onClick={handleSync}
      aria-label="Sync"
    >
      <RefreshCw size={20} />
    </button>
    <Button variant="primary" iconLeft={<Plus />} onClick={handleAdd}>
      Add Transaction
    </Button>
  </div>
</div>
```

**CSS**:
```css
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-6);
}

.page-actions {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}
```

---

## Accessibility Requirements

### Keyboard Navigation

| Action | Key | Behavior |
|--------|-----|----------|
| **Activate** | Enter / Space | Trigger button click |
| **Navigate** | Tab | Move to next focusable element |
| **Navigate Back** | Shift + Tab | Move to previous element |
| **Cancel** | ESC | Close modal/dialog (if applicable) |

### ARIA Labels

**Icon-only buttons MUST have aria-label**:
```typescript
<button className="btn btn-icon" aria-label="Close dialog">
  <X size={20} />
</button>
```

**Loading state**:
```typescript
<button
  className="btn btn-primary"
  disabled
  aria-busy="true"
>
  Loading...
</button>
```

**Disabled state with reason**:
```typescript
<button
  className="btn btn-primary"
  disabled
  aria-label="Save disabled: No changes made"
>
  Save
</button>
```

---

## Anti-Patterns

### ❌ DON'T

1. **Multiple Primary actions in same context**:
   ```html
   <!-- Bad -->
   <Button variant="primary">Save</Button>
   <Button variant="primary">Cancel</Button>
   ```

2. **Delete without confirmation**:
   ```typescript
   // Bad - No confirmation
   <Button variant="danger" onClick={deleteImmediately}>
     Delete
   </Button>
   ```

3. **Unclear button labels**:
   ```html
   <!-- Bad - What does "Submit" do? -->
   <Button variant="primary">Submit</Button>

   <!-- Good - Clear action -->
   <Button variant="primary">Save Transaction</Button>
   ```

4. **Icon-only without aria-label**:
   ```html
   <!-- Bad - Screen readers can't understand -->
   <button className="btn btn-icon">
     <X size={20} />
   </button>
   ```

### ✅ DO

1. **One Primary, others Secondary/Ghost**:
   ```typescript
   <Button variant="primary">Save</Button>
   <Button variant="secondary">Cancel</Button>
   ```

2. **Always confirm destructive actions**:
   ```typescript
   const handleDelete = async () => {
     const confirmed = await ask('Delete this item?');
     if (confirmed) await deleteItem();
   };
   ```

3. **Clear, action-oriented labels**:
   ```typescript
   <Button variant="primary">Upload Receipt</Button>
   <Button variant="danger">Delete Transaction</Button>
   ```

4. **Accessible icon buttons**:
   ```typescript
   <button className="btn btn-icon" aria-label="Close dialog">
     <X size={20} />
   </button>
   ```

---

## i18n Integration

### Translation Keys

**Location**: `app/src/i18n/locales/{lang}.json`

```json
{
  "common": {
    "confirm": "Confirm",
    "cancel": "Cancel",
    "delete": "Delete",
    "close": "Close",
    "save": "Save",
    "edit": "Edit",
    "add": "Add",
    "upload": "Upload",
    "sync": "Sync",
    "back": "Back"
  }
}
```

**Usage**:
```typescript
import { useTranslation } from '@/i18n';

function MyComponent() {
  const { t } = useTranslation();

  return (
    <Button variant="primary" onClick={handleSave}>
      {t('common.save')}
    </Button>
  );
}
```

---

## Testing Checklist

### Visual Testing
- [ ] All button variants render correctly
- [ ] Icons positioned correctly (left/right)
- [ ] Loading states show spinner
- [ ] Disabled states have reduced opacity

### Interaction Testing
- [ ] Click triggers onClick handler
- [ ] Enter/Space trigger click
- [ ] ESC closes dialogs
- [ ] Disabled buttons don't respond to clicks

### Accessibility Testing
- [ ] Icon-only buttons have aria-label
- [ ] Focus visible (blue ring)
- [ ] Tab order logical
- [ ] Screen reader announces button purpose

---

## Related Documents

- **[BUTTONS.md](./BUTTONS.md)** - Base button component specifications
- **[FEEDBACK.md](./FEEDBACK.md)** - Toast, Modal patterns
- **[ACCESSIBILITY.md](./ACCESSIBILITY.md)** - WCAG standards
- **[ICONS.md](./ICONS.md)** - Icon usage guidelines

---

**Last Updated**: 2026-01-12
**Version**: 1.0.0
**Status**: ✅ Complete
