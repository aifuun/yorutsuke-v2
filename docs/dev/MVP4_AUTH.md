# MVP4 - 完整认证 (Full Auth)

> **目标**: 验证用户系统和配额管理

### 功能范围

| 功能 | 说明 | 状态 |
|------|------|------|
| Guest 模式 | 无需登录即可使用 | [ ] |
| 注册流程 | Email + 验证码 | [ ] |
| 登录/登出 | Cognito 认证 | [ ] |
| Guest 数据迁移 | 登录后认领 Guest 数据 | [ ] |
| Tier 配额 | guest/free/basic/pro 限额 | [ ] |
| Token 刷新 | 自动刷新过期 Token | [ ] |
| 设置持久化 | 主题/语言/通知 | [ ] |

### 测试场景

从 [FRONTEND.md](../tests/FRONTEND.md) 选取：

#### 2.1 Quota - Guest User
| ID | 场景 | 预期 |
|----|------|------|
| SC-100 | Guest 默认配额 | limit=30, tier=guest |
| SC-101 | Guest 过期警告 | 46+ 天显示"X 天后过期" |
| SC-102 | Guest 接近限额 | 28/30 显示剩余数量 |
| SC-103 | Guest 达到限额 | 30/30 阻止上传，提示消息 |

#### 2.2 Quota - Free Tier
| ID | 场景 | 预期 |
|----|------|------|
| SC-110 | Free Tier 配额 | limit=50, 无过期警告 |
| SC-111 | Free 达到限额 | 50/50 阻止，建议升级 |
| SC-112 | Free 配额重置 | 午夜 JST 重置 |

#### 2.3 Quota - Paid Tiers
| ID | 场景 | 预期 |
|----|------|------|
| SC-120 | Basic Tier 配额 | limit=100 |
| SC-121 | Pro Tier 配额 | limit=500 或无限制 |

