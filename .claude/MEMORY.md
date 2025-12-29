# Memory

## Current Context

Update at session end, read at session start.

- **Last Progress**: [2025-12-29] Phase 1 进行中 (#4 ✅, #5 ✅, #6 ✅)
- **Next Steps**: #7 Auth
- **Blockers**: None

## Architecture Decisions

Record important decisions with context.

<!--
### [YYYY-MM-DD] Decision Title (ID)
- **Decision**: What was decided
- **Reason**: Why this approach was chosen
- **Alternatives**: What was considered but rejected
-->

## Solved Issues

Problems encountered and their solutions.

### [2025-12-29] 拖入图片延迟显示问题
- **Problem**: 原项目拖入多个图片后有几秒延迟才出现在列表中
- **Root Cause**: `useImageQueue` 的 `loadHistory()` 异步加载完成时 `setItems(historyItems)` 会覆盖已添加的新图片
- **Solution**: View 层实现时采用以下方案之一：
  1. 分离 `historyItems` 和 `pendingItems` 状态，显示时合并
  2. 使用 `useReducer` 保证 LOAD_HISTORY 和 ADD_PENDING 操作原子性
- **Prevention**: 避免异步初始化覆盖实时状态，历史数据加载应该是追加而非覆盖

## References

Key resources and links.

<!-- Format: Topic - Link/Path -->

## Best Practices

Lessons learned from this project.

<!-- Format: Scenario → Approach → Result -->
