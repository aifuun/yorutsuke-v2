# Frontend Test Scenarios - QUOTA & AUTH

> Test cases for user management and usage limits.

## 4. Tier & Quota
| ID | 场景 | 预期 |
|----|----|----|
| SC-100 | Guest 模式限额 | 只能处理 10 张，达到后提示注册 |
| SC-110 | 注册用户 (Free) 限额 | 每日处理限额生效 |
| SC-120 | 配额实时更新 | 压缩成功后暂不扣除，上传成功后才扣除 |
| SC-130 | 配额跨会话持久化 | 重启应用后，今日已用配额正确显示 |
| SC-131 | 配额每日重置 | 跨过凌晨 0 点，配额自动刷新 (JST) |

## 7. Auth (Registration & Login)
| ID | 场景 | 预期 |
|----|----|----|
| SC-600 | 注册新用户 | 邮箱验证，注册后获得 Free Tier |
| SC-601 | 登录 | 成功获取 JWT/Token，恢复配置 |
| SC-610 | 匿名用户数据同步 | 注册后，之前的本地记录迁移到新 UID |
| SC-611 | 退出登录 | 本地缓存清空，回到 Guest 模式 |
| SC-612 | 密码找回 | 忘记密码流程验证 |
| SC-613 | 自动续期 | Token 过期后静默刷新 |

## 9. Transitions (Tier Upgrades)
| ID | 场景 | 预期 |
|----|----|----|
| SC-800 | 购买 Pro | 支付后 Tier 实时从 Free 变 Pro |
| SC-810 | 限额即时放开 | 升级后无需重启，立即可以继续上传 |
| SC-811 | 降级处理 | 到期后 Tier 回归 Free，限制立即生效 |

---

## References

- [Index](./README.md)
- [CAPTURE.md](./CAPTURE.md)
- [LEDGER_REPORT.md](./LEDGER_REPORT.md)
