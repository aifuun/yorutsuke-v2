# Button Quick Reference

**快速查表**: 应用中常用按钮的标准配置

---

## 常用按钮速查表

| 动作 | Variant | Icon | 位置 | 需要确认? | 示例文本 |
|------|---------|------|------|----------|---------|
| **✅ Confirm** | `primary` | Check ✓ | 右侧 | No | Confirm / 确认 / 確認 |
| **❌ Cancel** | `secondary` | None | 左侧 | No | Cancel / 取消 / キャンセル |
| **🗑️ Delete** | `danger` | Trash 🗑️ | - | **YES** | Delete / 删除 / 削除 |
| **✕ Close** | `ghost` | X ✕ | 右上角 | No | (icon only) |
| **🔄 Sync** | `primary` | RefreshCw ↻ | - | No | Sync / 同步 / 同期 |
| **💾 Save** | `primary` | Save 💾 | 右侧 | No | Save / 保存 / 保存 |
| **✏️ Edit** | `ghost`/`secondary` | Edit2 ✏️ | 内联 | No | Edit / 编辑 / 編集 |
| **➕ Add** | `primary` | Plus ➕ | - | No | Add / 添加 / 追加 |
| **📤 Upload** | `primary` | Upload 📤 | - | No | Upload / 上传 / アップロード |
| **🔙 Back** | `ghost`/`secondary` | ArrowLeft ← | 左上角 | No | Back / 返回 / 戻る |

---

## 按钮组合模式

### 1. 确认对话框 (Confirm Dialog)

```typescript
// 模式：Cancel (left) + Confirm (right)
<div className="btn-group">
  <Button variant="secondary" onClick={onCancel}>Cancel</Button>
  <Button variant="primary" onClick={onConfirm}>Confirm</Button>
</div>
```

**规则**:
- ✅ Cancel 总是在左边
- ✅ Confirm 总是在右边
- ✅ 只有一个 Primary 按钮

---

### 2. 删除确认 (Delete Confirmation)

```typescript
// 模式：Cancel (left) + Delete (right)
<div className="btn-group">
  <Button variant="secondary" onClick={onCancel}>Cancel</Button>
  <Button variant="danger" iconLeft={<Trash2 />} onClick={onDelete}>
    Delete
  </Button>
</div>
```

**规则**:
- ⚠️ **必须显示确认对话框**
- ✅ Delete 使用 `danger` variant (红色)
- ✅ 附带删除图标

---

### 3. 表单操作 (Form Actions)

```typescript
// 模式：Cancel (left) + Save (right)
<div className="form-actions">
  <Button variant="ghost" onClick={onCancel}>Cancel</Button>
  <Button variant="primary" onClick={onSave} disabled={!hasChanges}>
    Save Changes
  </Button>
</div>
```

**规则**:
- ✅ Cancel 可用 `ghost` variant
- ✅ Save 未改动时禁用
- ✅ 显示加载状态

---

### 4. 页面头部操作 (Page Header)

```typescript
// 模式：Icon buttons (left) + Primary action (right)
<div className="page-actions">
  <button className="btn btn-ghost btn-icon" onClick={handleSync}>
    <RefreshCw size={20} />
  </button>
  <Button variant="primary" iconLeft={<Plus />} onClick={handleAdd}>
    Add
  </Button>
</div>
```

**规则**:
- ✅ 次要操作用 icon-only 按钮
- ✅ 主要操作用 Primary 按钮
- ✅ 左到右优先级递增

---

## 代码模板

### Confirm Button
```typescript
import { Check } from 'lucide-react';

<Button variant="primary" iconLeft={<Check size={20} />} onClick={onConfirm}>
  Confirm
</Button>
```

### Cancel Button
```typescript
<Button variant="secondary" onClick={onCancel}>
  Cancel
</Button>
```

### Delete Button (with confirmation)
```typescript
import { Trash2 } from 'lucide-react';
import { ask } from '@tauri-apps/plugin-dialog';

const handleDelete = async () => {
  const confirmed = await ask('Delete this item?', {
    title: 'Confirm Delete',
    kind: 'warning',
  });

  if (confirmed) {
    await deleteItem(id);
  }
};

<Button variant="danger" iconLeft={<Trash2 size={20} />} onClick={handleDelete}>
  Delete
</Button>
```

### Close Button (icon only)
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

### Sync Button (with loading)
```typescript
import { RefreshCw } from 'lucide-react';

<Button
  variant="primary"
  iconLeft={<RefreshCw size={20} />}
  onClick={handleSync}
  loading={isSyncing}
  disabled={isSyncing}
>
  {isSyncing ? 'Syncing...' : 'Sync Now'}
</Button>
```

### Save Button (with state)
```typescript
import { Save } from 'lucide-react';

<Button
  variant="primary"
  iconLeft={<Save size={20} />}
  onClick={handleSave}
  disabled={!hasChanges || !isValid}
  loading={isSaving}
>
  Save Changes
</Button>
```

---

## 图标库

### Lucide React (推荐)

```bash
npm install lucide-react
```

**常用图标**:
```typescript
import {
  Check,        // ✓ Confirm
  X,            // ✕ Close
  Trash2,       // 🗑️ Delete
  RefreshCw,    // ↻ Sync
  Save,         // 💾 Save
  Edit2,        // ✏️ Edit
  Plus,         // ➕ Add
  Upload,       // 📤 Upload
  ArrowLeft,    // ← Back
  Search,       // 🔍 Search
  Download,     // 📥 Download
} from 'lucide-react';
```

**使用方式**:
```typescript
<Button iconLeft={<Check size={20} />}>Confirm</Button>
```

### Emoji (备选)

如果不想依赖图标库，可以用 Emoji:
```typescript
<Button>✓ Confirm</Button>
<Button>🗑️ Delete</Button>
<Button>↻ Sync</Button>
```

---

## CSS 类名规范

### 通用按钮类

```css
/* 基础类 */
.btn { /* 基础按钮样式 */ }

/* Variant */
.btn-primary { /* 蓝色主按钮 */ }
.btn-secondary { /* 灰色次按钮 */ }
.btn-ghost { /* 透明按钮 */ }
.btn-danger { /* 红色危险按钮 */ }

/* Size */
.btn-sm { /* 小按钮 (32px) */ }
.btn-md { /* 中按钮 (40px) - 默认 */ }
.btn-lg { /* 大按钮 (48px) */ }

/* State */
.btn-loading { /* 加载中 */ }
.btn:disabled { /* 禁用 */ }
.btn:hover { /* 悬停 */ }
.btn:active { /* 按下 */ }
.btn:focus-visible { /* 焦点 */ }

/* Icon */
.btn-icon { /* 仅图标按钮 */ }
```

### 组合使用

```html
<!-- Primary medium button (default) -->
<button class="btn btn-primary">Save</button>

<!-- Secondary small button -->
<button class="btn btn-secondary btn-sm">Cancel</button>

<!-- Danger button with loading -->
<button class="btn btn-danger btn-loading" disabled>Deleting...</button>

<!-- Ghost icon-only button -->
<button class="btn btn-ghost btn-icon" aria-label="Close">
  <svg>...</svg>
</button>
```

---

## 国际化 (i18n)

### 翻译键标准

```json
{
  "common": {
    "confirm": "Confirm",
    "cancel": "Cancel",
    "delete": "Delete",
    "close": "Close",
    "save": "Save",
    "saveChanges": "Save Changes",
    "edit": "Edit",
    "add": "Add",
    "create": "Create",
    "upload": "Upload",
    "download": "Download",
    "sync": "Sync",
    "syncNow": "Sync Now",
    "refresh": "Refresh",
    "back": "Back",
    "next": "Next",
    "submit": "Submit",
    "apply": "Apply",
    "ok": "OK"
  }
}
```

### 使用方式

```typescript
import { useTranslation } from '@/i18n';

function MyComponent() {
  const { t } = useTranslation();

  return (
    <div className="btn-group">
      <Button variant="secondary" onClick={onCancel}>
        {t('common.cancel')}
      </Button>
      <Button variant="primary" onClick={onSave}>
        {t('common.save')}
      </Button>
    </div>
  );
}
```

---

## 常见错误

### ❌ 错误示例

```typescript
// 1. 多个 Primary 按钮
<Button variant="primary">Save</Button>
<Button variant="primary">Cancel</Button>

// 2. 删除没有确认
<Button variant="danger" onClick={deleteItem}>Delete</Button>

// 3. 图标按钮没有 aria-label
<button className="btn btn-icon">
  <X size={20} />
</button>

// 4. 使用硬编码颜色
<button style={{ background: '#3B82F6' }}>Save</button>
```

### ✅ 正确示例

```typescript
// 1. 一个 Primary，其他 Secondary/Ghost
<Button variant="primary">Save</Button>
<Button variant="secondary">Cancel</Button>

// 2. 删除必须确认
const handleDelete = async () => {
  const confirmed = await ask('Delete?');
  if (confirmed) await deleteItem();
};
<Button variant="danger" onClick={handleDelete}>Delete</Button>

// 3. 图标按钮必须有 aria-label
<button className="btn btn-icon" aria-label="Close">
  <X size={20} />
</button>

// 4. 使用 CSS 类
<Button variant="primary">Save</Button>
```

---

## 检查清单

### 新按钮检查

- [ ] 使用正确的 variant (primary/secondary/ghost/danger)
- [ ] 适当的图标 (如果需要)
- [ ] 清晰的文本标签
- [ ] 正确的禁用逻辑
- [ ] 加载状态 (如果是异步操作)
- [ ] 删除操作有确认对话框
- [ ] 图标按钮有 aria-label
- [ ] 使用 i18n 翻译键
- [ ] 焦点状态可见
- [ ] 触摸目标 ≥ 44px

---

## 参考文档

- **[BUTTON_ACTIONS.md](./BUTTON_ACTIONS.md)** - 详细的按钮动作指南
- **[BUTTONS.md](./BUTTONS.md)** - 基础按钮组件规范
- **[ACCESSIBILITY.md](./ACCESSIBILITY.md)** - 无障碍标准

---

**Last Updated**: 2026-01-12
**Version**: 1.0.0
