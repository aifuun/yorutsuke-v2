# Execute Next Task

智能三级导航系统：自动检查 TODO → Issues → MVP 并推荐下一步行动。

## 执行逻辑（三级瀑布）

### Level 1: 检查 TODO.md 中的活跃任务

1. **读取 `.claude/TODO.md`**
2. **检查 "Active Issues" 或 "Current Session" 章节**
3. **如果存在进行中的 Issue**:
   - 显示当前 Issue 的名称和子任务列表
   - 询问："继续处理 #XXX 吗？还是切换到其他任务？"
   - 如果用户确认继续，执行该 Issue 的下一个子任务
4. **如果所有子任务都已完成**:
   - 提示："#XXX 已完成所有子任务，建议执行 `*review` 或关闭 Issue"
   - 自动进入 Level 2

### Level 2: 检查可用的 Issues

1. **如果 TODO.md 为空或无活跃任务**:
   - 读取当前 MVP 文件（根据 `.claude/TODO.md` 的 Milestone 标记判断）
   - 例如：如果 TODO 显示 "MVP2 - 云端集成"，则读取 `docs/dev/MVP2_UPLOAD.md`

2. **从 MVP 文件中提取未完成的 Issues**:
   - 查找 "相关 Issues" 或 "功能范围" 章节
   - 筛选状态为 `[ ]` 的 Issue

3. **推荐优先级最高的 Issue**:
   - 优先推荐标记为 P1 的 Issue
   - 如果没有优先级标记，按顺序推荐第一个未完成的 Issue
   - 显示格式：
     ```
     推荐下一个任务：
     
     Issue #101: Presign URL 集成 [P1]
     关联测试: SC-300~303 (Offline Handling)
     预估复杂度: T2 (中等)
     
     开始这个任务吗？(yes/no/show-all)
     ```

4. **如果用户选择 "show-all"**:
   - 列出当前 MVP 的所有未完成 Issue
   - 让用户手动选择

5. **如果用户确认开始**:
   - 在 TODO.md 中创建新的 "Active Issues" 条目
   - 加载 Issue 的详细内容（从 GitHub 或本地描述）
   - 开始执行第一个子任务

### Level 3: 检查 MVP 蓝图

1. **如果当前 MVP 的所有 Issues 都已完成**:
   - 检查 `docs/dev/` 目录下的所有 MVP 文件
   - 读取每个 MVP 的验收标准状态

2. **推荐下一个 MVP**:
   - 按顺序查找第一个未完成的 MVP（MVP1 → MVP2 → MVP3 → MVP4）
   - 显示格式：
     ```
     当前 MVP2 已完成所有任务！
     
     推荐下一个 MVP：
     
     MVP3 - 批量处理 (Batch Processing)
     目标: 实现夜间 AI 批处理和晨报生成
     预估工期: 2-3 周
     核心功能:
     - [ ] Nova Lite OCR 集成
     - [ ] 批量处理队列管理
     - [ ] 晨报生成器
     
     开始规划 MVP3 吗？(yes/no)
     ```

3. **如果用户确认**:
   - 提示："建议先执行 `*plan MVP3` 拆解 Issues"
   - 或者直接进入规划模式：
     - 读取 MVP 文件的功能范围
     - 生成建议的 Issues 列表
     - 等待用户确认后创建 Issues

## 执行前检查

在执行任何任务前，自动检查：

1. **加载相关 Checklist**:
   - 如果是 T1 任务：`.prot/checklists/tier1.md`
   - 如果是 T2 任务：`.prot/checklists/in-code.md`
   - 如果是 T3 任务：`.prot/checklists/tier3.md`

2. **检查 Template**:
   - 如果创建新文件，自动匹配 Template：
     ```
     Creating headless hook? → .prot/pillar-l/headless.ts
     Creating adapter?       → .prot/pillar-b/airlock.ts
     Creating saga?          → .prot/pillar-m/saga.ts
     Creating FSM state?     → .prot/pillar-d/fsm-reducer.ts
     ```

3. **评估复杂度**:
   - 如果复杂度 ≥ 7：先解释计划，等待 `*approve`
   - 如果复杂度 < 7：直接执行

## 执行后更新

完成当前子任务后：

1. **更新 TODO.md**:
   - 在对应 Issue 的子任务中打勾 `[x]`
   - 如果所有子任务完成，提示关闭 Issue

2. **检查是否需要归档**:
   - 如果 Issue 包含重要的技术决策，建议更新 MEMORY.md
   - 如果涉及架构变更，建议创建 ADR

3. **自动触发下一轮**:
   - 询问："继续下一个子任务吗？(yes/no)"
   - 如果用户选择 yes，重新执行 Level 1 逻辑

## Template Quick Reference

| File Type | Template Location |
|-----------|-------------------|
| Headless hook | `.prot/pillar-l/headless.ts` |
| Adapter | `.prot/pillar-b/airlock.ts` |
| Branded types | `.prot/pillar-a/branded.ts` |
| FSM reducer | `.prot/pillar-d/fsm-reducer.ts` |
| Saga workflow | `.prot/pillar-m/saga.ts` |
| Idempotency | `.prot/pillar-q/idempotency.ts` |

## 示例对话流程

### 场景 1: TODO 中有活跃任务
```
AI: 检测到活跃任务：

#101 Presign URL 集成 [进行中]
- [x] 移除 Mock 分支
- [x] 实现真实 fetch
- [ ] Zod 响应验证
- [ ] 错误处理 (403/429/500)

下一步：实现 Zod 响应验证

继续执行吗？(yes/no/switch)
```

### 场景 2: TODO 为空，推荐 Issue
```
AI: TODO.md 当前无活跃任务。

检测到 MVP2 (云端上传) 有以下未完成 Issues：

推荐: #102 S3 字节流上传验证 [P1]
- 关联测试: SC-310~313
- 预估复杂度: T2
- 修改文件: uploadApi.ts, uploadService.ts

其他可选:
- #103 配额 API 云端同步 [P1]
- #104 网络状态管理 [P2]

开始 #102 吗？(yes/103/104/show-all)
```

### 场景 3: 当前 MVP 完成，推荐下一个 MVP
```
AI: 🎉 MVP2 (云端上传) 所有任务已完成！

检测到下一个 MVP：

MVP3 - 批量处理 (Batch Processing)
目标: 实现夜间 AI 批处理和晨报生成
状态: 未开始
预估: 2-3 周

核心功能:
- [ ] Nova Lite OCR 集成
- [ ] 批量处理队列管理
- [ ] 晨报生成器
- [ ] 交易数据提取

建议行动:
1. 执行 `*plan MVP3` 拆解为 Issues
2. 或直接查看 `docs/dev/MVP3_BATCH.md`

选择操作 (plan/view/defer)
```

## Notes

- **单一焦点**：一次只处理一个 Issue
- **小步快跑**：将大任务拆解为可在 30 分钟内完成的子任务
- **及时更新**：每完成一步立即更新 TODO.md
- **使用 Template**：确保 Pillar 合规性
- **智能推荐**：优先考虑依赖关系和优先级
