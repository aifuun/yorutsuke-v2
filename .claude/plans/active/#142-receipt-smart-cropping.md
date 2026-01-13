# Feature Plan: #142 前端收据智能切边功能（jscanify 集成）

> **Step 2 of Two-Step Planning** - 在开发前完成详细规划

| 项目 | 值 |
|------|-----|
| Issue | #142 |
| MVP | MVP3 |
| 复杂度 | T2 (Logic - FSM, local state management) |
| 预估 | 6-8h |
| 状态 | [x] 规划 / [ ] 开发中 / [ ] Review / [ ] 完成 |

---

## 1. Architecture Context

### Relevant ADRs

| ADR | Relevance | Application |
|-----|-----------|-------------|
| [ADR-001: Service Pattern](../../../docs/architecture/ADR/001-service-pattern.md) | ✅ High | scanService.ts - Pure TypeScript service, no React dependencies |
| [ADR-004: Upload Queue FSM](../../../docs/architecture/ADR/004-upload-queue-fsm.md) | ✅ High | Extend FSM with scanning states: `idle → scanning → previewing → cropping → uploading` |
| [ADR-008: Component Library](../../../docs/architecture/ADR/008-component-library.md) | ✅ Medium | ScannerModal follows design system tokens, no hard-coded values |
| [ADR-012: Zustand Selector Safety](../../../docs/architecture/ADR/012-zustand-selector-safety.md) | ✅ Medium | Safe store subscriptions in ScannerModal |

### Applicable Pillars

| Pillar | Application | Checklist |
|--------|-------------|-----------|
| **A: Nominal Types** | Corner point types: `CornerPoint = { x: number, y: number }` | Use branded types for imageId |
| **B: Airlock** | Validate jscanify output with Zod | Define `CornerSchema`, `CropResultSchema` |
| **D: FSM** | Scanner workflow states | No boolean flags, use union types |
| **L: Headless** | Separate scan logic from UI | `useScannerLogic` hook with no JSX |

### Architecture Patterns

**Service Layer Pattern (ADR-001)**:
```
ScannerModal (View) → useScannerLogic (Headless) → scanService (Service) → jscanify (Library)
```

**FSM Integration (ADR-004)**:
```
Current: idle → compressing → pending → uploading → completed
Add:     idle → scanning → previewing → cropping/confirmed → compressing → ...
```

---

## 2. Key Functions + Unit Tests (TDD)

### 2.1 scanService.ts (Pure TypeScript)

```typescript
// Function contracts

export async function detectCorners(
  imageElement: HTMLImageElement
): Promise<CornerPoint[]> {
  // Pre: imageElement is loaded (naturalWidth > 0)
  // Post: Returns 4 corner points [topLeft, topRight, bottomRight, bottomLeft]
  // Side effects: None (pure function)
  // Error: Throws DetectionFailedError if corners not found
}

export async function extractPaper(
  imageElement: HTMLImageElement,
  corners: CornerPoint[]
): Promise<Blob> {
  // Pre: imageElement loaded, corners.length === 4
  // Post: Returns WebP blob with cropped + perspective-corrected image
  // Side effects: Creates canvas element internally (cleaned up)
  // Error: Throws CropFailedError if transformation fails
}

export function isValidCorners(corners: CornerPoint[]): boolean {
  // Pre: corners array (may be empty)
  // Post: Returns true if 4 valid corners forming convex quadrilateral
  // Side effects: None (pure function)
}
```

**Unit Tests**:

```typescript
describe('scanService', () => {
  describe('detectCorners', () => {
    it('should detect 4 corners from receipt image', async () => {
      const img = await loadTestImage('receipt-straight.jpg');
      const corners = await detectCorners(img);

      expect(corners).toHaveLength(4);
      expect(corners[0].x).toBeGreaterThan(0);
      expect(corners[0].y).toBeGreaterThan(0);
    });

    it('should throw DetectionFailedError for blank image', async () => {
      const img = await loadTestImage('blank.jpg');

      await expect(detectCorners(img)).rejects.toThrow(DetectionFailedError);
    });

    it('should handle tilted receipt', async () => {
      const img = await loadTestImage('receipt-45deg.jpg');
      const corners = await detectCorners(img);

      expect(corners).toHaveLength(4);
      expect(isValidCorners(corners)).toBe(true);
    });
  });

  describe('extractPaper', () => {
    it('should crop and correct perspective', async () => {
      const img = await loadTestImage('receipt-tilted.jpg');
      const corners = await detectCorners(img);
      const blob = await extractPaper(img, corners);

      expect(blob.type).toBe('image/webp');
      expect(blob.size).toBeLessThan(img.size * 0.7); // Cropped should be smaller
    });

    it('should throw CropFailedError for invalid corners', async () => {
      const img = await loadTestImage('receipt.jpg');
      const invalidCorners = [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 }
      ];

      await expect(extractPaper(img, invalidCorners)).rejects.toThrow(CropFailedError);
    });
  });

  describe('isValidCorners', () => {
    it('should validate convex quadrilateral', () => {
      const validCorners = [
        { x: 100, y: 100 },
        { x: 400, y: 100 },
        { x: 400, y: 600 },
        { x: 100, y: 600 }
      ];

      expect(isValidCorners(validCorners)).toBe(true);
    });

    it('should reject self-intersecting corners', () => {
      const invalidCorners = [
        { x: 100, y: 100 },
        { x: 400, y: 600 }, // Swapped
        { x: 400, y: 100 },
        { x: 100, y: 600 }
      ];

      expect(isValidCorners(invalidCorners)).toBe(false);
    });
  });
});
```

### 2.2 useScannerLogic.ts (Headless Hook)

```typescript
// Function contract

export function useScannerLogic(imageFile: File) {
  // Returns: { state, corners, updateCorner, confirmCrop, skipCrop, cancel }
  // Pre: imageFile is valid image (validated by caller)
  // Post: Manages scanner FSM and corner manipulation
  // Side effects: Updates local state, calls scanService methods
}
```

**Unit Tests**:

```typescript
describe('useScannerLogic', () => {
  it('should auto-detect corners on mount', async () => {
    const file = createMockImageFile();
    const { result } = renderHook(() => useScannerLogic(file));

    await waitFor(() => {
      expect(result.current.state).toBe('previewing');
      expect(result.current.corners).toHaveLength(4);
    });
  });

  it('should allow manual corner adjustment', async () => {
    const file = createMockImageFile();
    const { result } = renderHook(() => useScannerLogic(file));

    await waitFor(() => expect(result.current.state).toBe('previewing'));

    act(() => {
      result.current.updateCorner(0, { x: 150, y: 150 });
    });

    expect(result.current.corners[0]).toEqual({ x: 150, y: 150 });
  });

  it('should handle confirmCrop', async () => {
    const file = createMockImageFile();
    const { result } = renderHook(() => useScannerLogic(file));

    await waitFor(() => expect(result.current.state).toBe('previewing'));

    act(() => {
      result.current.confirmCrop();
    });

    expect(result.current.state).toBe('cropping');
    await waitFor(() => expect(result.current.state).toBe('confirmed'));
  });

  it('should handle skipCrop', async () => {
    const file = createMockImageFile();
    const { result } = renderHook(() => useScannerLogic(file));

    await waitFor(() => expect(result.current.state).toBe('previewing'));

    const blob = await act(() => result.current.skipCrop());

    expect(blob).toBe(file); // Returns original file
  });
});
```

---

## 3. 实现方案

### 改动范围

| 文件 | 类型 | 改动 |
|------|------|------|
| `app/package.json` | 修改 | 添加 jscanify 依赖 |
| `app/src/01_domains/image/scanService.ts` | 新增 | jscanify 封装，透视变换逻辑 |
| `app/src/01_domains/image/types.ts` | 修改 | 添加 CornerPoint, ScanResult 类型 |
| `app/src/02_modules/capture/headless/useScannerLogic.ts` | 新增 | Scanner FSM 逻辑 |
| `app/src/02_modules/capture/views/ScannerModal.tsx` | 新增 | 扫描预览 UI |
| `app/src/02_modules/capture/views/scanner.css` | 新增 | Scanner 样式 |
| `app/src/02_modules/capture/views/CaptureView.tsx` | 修改 | 集成 ScannerModal 到上传流程 |
| `app/src/02_modules/capture/adapters/captureService.ts` | 修改 | 添加 scanAndCrop 方法 |

### 实现步骤

**Phase 1: Install & Service Layer** (~2h)

- [x] 安装 jscanify: `npm install jscanify`
- [ ] 创建 `01_domains/image/scanService.ts`
  - [ ] 封装 `detectCorners(imageElement)`
  - [ ] 封装 `extractPaper(imageElement, corners)`
  - [ ] 添加 `isValidCorners(corners)` 校验
  - [ ] 错误处理：`DetectionFailedError`, `CropFailedError`
- [ ] 定义类型 `01_domains/image/types.ts`
  ```typescript
  export type CornerPoint = { x: number; y: number };
  export type ScanResult = {
    originalBlob: Blob;
    croppedBlob: Blob;
    corners: CornerPoint[];
  };
  ```
- [ ] 编写单元测试 `scanService.test.ts`
  - [ ] Test: 正常识别 4 个角
  - [ ] Test: 空白图片抛出错误
  - [ ] Test: 透视变换正确输出

**Phase 2: Headless Logic** (~2h)

- [ ] 创建 `02_modules/capture/headless/useScannerLogic.ts`
  - [ ] FSM 状态定义
    ```typescript
    type ScannerState =
      | 'idle'
      | 'scanning'      // 自动识别中
      | 'previewing'    // 展示预览，等待确认
      | 'cropping'      // 用户调整中
      | 'confirmed'     // 确认完成
      | 'error';
    ```
  - [ ] 初始化时调用 `detectCorners`
  - [ ] 提供 `updateCorner(index, point)` 手动调整
  - [ ] 提供 `confirmCrop()` → 调用 `extractPaper`
  - [ ] 提供 `skipCrop()` → 返回原图
  - [ ] 提供 `cancel()` → 回到选图界面
- [ ] 编写测试 `useScannerLogic.test.ts`
  - [ ] Test: 自动识别流程
  - [ ] Test: 手动调整角点
  - [ ] Test: 确认裁剪
  - [ ] Test: 跳过裁剪

**Phase 3: UI Component** (~2h)

- [ ] 创建 `02_modules/capture/views/ScannerModal.tsx`
  - [ ] 使用 `useScannerLogic` hook
  - [ ] 渲染图片预览（canvas）
  - [ ] 渲染四角控制点（可拖动）
  - [ ] 绘制绿色半透明框（有效区域）
  - [ ] 按钮：返回、原图上传、确认上传
  - [ ] 加载状态：Scanning...
  - [ ] 错误状态：识别失败提示
- [ ] 创建 `scanner.css`
  - [ ] 使用设计 token（`--color-primary`, `--space-*`, `--shadow-*`）
  - [ ] 控制点样式：44x44px 圆形，可拖动
  - [ ] 响应式：移动端 touch 优化
  - [ ] 无障碍：focus states, ARIA labels
- [ ] 设计系统合规检查
  - [ ] 颜色使用 semantic tokens
  - [ ] 间距使用 `--space-*`
  - [ ] 阴影使用 `--shadow-*`
  - [ ] 动画支持 `prefers-reduced-motion`

**Phase 4: Integration** (~1h)

- [ ] 修改 `CaptureView.tsx`
  - [ ] 添加 `scannerOpen` 状态
  - [ ] 图片选择后 → 打开 ScannerModal（而非直接上传）
  - [ ] ScannerModal 确认 → 获取 cropped blob → 传给 captureService
  - [ ] ScannerModal 取消 → 关闭 modal
- [ ] 修改 `captureService.ts`
  - [ ] 添加 `scanAndCrop(file)` 方法
  - [ ] 调用 scanService
  - [ ] 返回 cropped blob 或原图

**Phase 5: Testing & Polish** (~1-2h)

- [ ] 集成测试
  - [ ] Test: 完整流程（选图 → 扫描 → 确认 → 上传）
  - [ ] Test: 跳过裁剪流程
  - [ ] Test: 取消操作
- [ ] 性能优化
  - [ ] 大图片压缩后再传给 jscanify（< 2000px）
  - [ ] 防抖拖动事件
  - [ ] 测试扫描耗时 < 500ms
- [ ] 用户体验优化
  - [ ] 加载状态明确
  - [ ] 错误提示友好
  - [ ] 移动端触摸体验流畅
- [ ] 文档更新
  - [ ] 更新 `docs/architecture/FLOWS.md` 添加扫描流程
  - [ ] 更新 `docs/design/03-capture.md` 添加 ScannerModal 设计

---

## 4. 测试用例

### 单元测试

| Case | 输入 | 期望 |
|------|------|------|
| 正常识别 | 标准收据图片 | 返回 4 个角点 |
| 倾斜识别 | 45° 倾斜收据 | 返回 4 个角点 |
| 识别失败 | 空白图片 | 抛出 DetectionFailedError |
| 透视变换 | 图片 + 4 角点 | 返回裁剪后的 WebP blob |
| 无效角点 | 自相交的角点 | 抛出 CropFailedError |

### 场景测试

| ID | 场景 | 预期 |
|----|------|------|
| SC-142-01 | 用户选择收据图片 | 自动进入扫描预览界面 |
| SC-142-02 | 系统自动识别四角 | 显示绿色半透明框标记区域 |
| SC-142-03 | 用户拖动角点调整 | 实时更新预览框 |
| SC-142-04 | 用户点击"确认上传" | 显示裁剪结果 1 秒后进入上传队列 |
| SC-142-05 | 用户点击"原图上传" | 跳过裁剪，直接上传原图 |
| SC-142-06 | 用户点击"返回" | 关闭 modal，回到选图界面 |
| SC-142-07 | 识别失败（空白图） | 显示错误提示，提供"原图上传"选项 |

---

## 5. 风险 & 依赖

### 风险

| 风险 | 级别 | 应对 |
|------|------|------|
| jscanify 识别失败率高 | 高 | 提供"原图上传"备选方案，不阻塞流程 |
| 大图片处理性能差 | 中 | 限制输入分辨率（< 2000px），压缩后再处理 |
| 移动端触摸拖动体验差 | 中 | 加大控制点尺寸（44x44px），添加触摸反馈 |
| 增加 2-3 秒交互时间 | 低 | 提供明确加载反馈，用户可跳过 |
| jscanify 库维护停滞 | 低 | 评估替代方案（OpenCV.js），做好抽象层 |

### 依赖

- [x] jscanify npm package (已发布，v1.2.0)
- [x] 现有 captureService (已实现)
- [x] 现有 fileService (已实现)
- [x] 设计系统 tokens (已定义)

---

## 6. Acceptance Criteria (Copy from Issue)

### 功能要求
- [ ] 图片选择后自动进入扫描预览界面
- [ ] 自动识别并标记收据四角（绿色半透明框）
- [ ] 支持手动拖动四角调整（当自动识别不准时）
- [ ] 提供"原图上传"选项（跳过切边）
- [ ] 展示最终裁剪结果 1 秒后自动进入上传队列
- [ ] 支持取消操作（返回拍照/选图界面）

### 性能要求
- [ ] 扫描识别耗时 < 500ms（本地计算）
- [ ] 透视变换耗时 < 300ms
- [ ] 整体交互增加时间 < 3 秒

### 设计要求
- [ ] 遵循 Material Design 3 设计系统
- [ ] 使用设计 token（颜色、间距、阴影）
- [ ] 支持移动端触摸操作
- [ ] 提供明确的视觉反馈（加载、成功、错误）

---

## 7. 进度

| 日期 | 状态 | 备注 |
|------|------|------|
| 2026-01-13 | 规划完成 | Plan written, awaiting approval |
| | 开发中 | After *approve |
| | 完成 | |

---

## 8. Architecture Diagrams

### FSM State Transitions

```
┌─────────────────────────────────────────────────────────────┐
│                     Scanner Workflow FSM                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  idle → scanning → previewing → confirmed → (upload flow)    │
│           ↓           ↓            ↓                          │
│         error    skip_crop     cancel                        │
│           ↓           ↓            ↓                          │
│         idle      (upload)      idle                         │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
CaptureView
  └─ ScannerModal
       ├─ useScannerLogic (headless)
       │    └─ scanService
       │         └─ jscanify
       ├─ Canvas (image preview)
       ├─ CornerMarkers (4 draggable)
       └─ Actions (返回 | 原图 | 确认)
```

### Data Flow

```
1. User selects image file
      ↓
2. CaptureView opens ScannerModal
      ↓
3. ScannerModal → useScannerLogic → scanService.detectCorners()
      ↓
4. User adjusts corners OR confirms
      ↓
5. useScannerLogic → scanService.extractPaper()
      ↓
6. ScannerModal returns cropped blob
      ↓
7. CaptureView → captureService.processNewImages([croppedBlob])
      ↓
8. (Existing upload flow)
```

---

*开发前确认*:
- [ ] 方案已确认，无 open questions
- [ ] 依赖已就绪（jscanify 可用）
- [ ] 测试用例覆盖完整
- [ ] 架构合规（ADR-001, ADR-004, Pillars A/B/D/L）
