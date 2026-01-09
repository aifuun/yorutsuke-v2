# MVP[X] - [Name]

> **目标**: [一句话说明这个 MVP 要验证什么]

## 概要

| 项目 | 值 |
|------|-----|
| 版本 | X.0.0 |
| 状态 | [ ] 规划中 / [ ] 开发中 / [ ] 验收中 / [ ] 完成 |
| 前置 | MVP[X-1] |
| Issues | #xxx - #xxx |

## 功能范围

| 功能 | 说明 | Issue | 状态 |
|------|------|-------|------|
| 功能1 | 简要说明 | #xxx | [ ] |
| 功能2 | 简要说明 | #xxx | [ ] |
| 功能3 | 简要说明 | #xxx | [ ] |

## 架构图

```
[ASCII 流程图展示核心数据流]
```

## 测试场景

> 选自 `docs/tests/FRONTEND.md` 和 `docs/tests/BACKEND.md`

### Backend (SB-xxx)
| ID | 场景 | 预期 |
|----|------|------|
| SB-xxx | 场景描述 | 预期结果 |

### Frontend (SC-xxx)
| ID | 场景 | 预期 |
|----|------|------|
| SC-xxx | 场景描述 | 预期结果 |

## 验收标准

- [ ] 核心功能1正常工作
- [ ] 核心功能2正常工作
- [ ] 所有 SB-xxx 通过
- [ ] 所有 SC-xxx 通过

## 环境配置

```bash
# 部署命令
cd infra && cdk deploy --profile dev

# 环境变量
echo "VITE_XXX=..." >> app/.env.local
```

## 依赖

**AWS Resources**:
- Service: `resource-name` - 用途

**Lambda Functions**:
| Lambda | 用途 |
|--------|------|
| `lambda-name` | 说明 |

---

## Issues 详情

> Step 1 输出：MVP 分解后的 Issues 列表

### #xxx - [Issue Title]
- **复杂度**: T1/T2/T3
- **依赖**: 无 / #yyy
- **说明**: 简要技术说明

### #xxx - [Issue Title]
- **复杂度**: T1/T2/T3
- **依赖**: #xxx
- **说明**: 简要技术说明

---

*Created: YYYY-MM-DD*
*Last Updated: YYYY-MM-DD*
