# Frontend Test Scenarios - PERFORMANCE, DEBUG & i18n

> Test cases for non-functional requirements and development tools.

## 12. Settings
| ID | 场景 | 预期 |
|----|----|----|
| SC-1200 | 修改语言 | 界面即时切换中/英/日文 |
| SC-1210 | 清空本地数据 | 删除所有 local_path 下的图片和 SQLite 记录 |
| SC-1211 | 修改主题 | 深浅色模式切换 |

## 13. Debug & Telemetry
| ID | 场景 | 预期 |
|----|----|----|
| SC-1300 | 模拟 API 报错 | 500 错误时前端显示“服务器繁忙” |
| SC-1301 | 日志查看 | 控制台/日志文件记录 TraceId |
| SC-1310 | 刷新配额 | 强制从云端获取最新配额 |
| SC-1311 | Mock 模式切换 | 开关 Mock API 回调 |

## 14. Performance (NFR)
| ID | 场景 | 预期 |
|----|----|----|
| SC-1400 | 包体积 | < 5MB (Compressed) |
| SC-1410 | 处理延迟 | 单图压缩 < 1000ms |
| SC-1411 | 首页渲染 | 数据加载 < 300ms |
| SC-1420 | 启动速度 | < 3000ms |
| SC-1421 | 内存占用 | 闲置时 < 200MB，处理时 < 1GB |

## 15. i18n
| ID | 场景 | 预期 |
|----|----|----|
| SC-1500 | 字符集测试 | 处理包含特殊表情的文件名 |
| SC-1503 | 时区验证 | 不同时区下的配额清零点验证 (JST 为主) |

---

## References

- [Index](./README.md)
- [CAPTURE.md](./CAPTURE.md)
- [QUOTA_AUTH.md](./QUOTA_AUTH.md)
