# Frontend Test Scenarios - LIFECYCLE & ERROR

> Test cases for app stability, network handling, and crash recovery.

## 5. Network & Offline
| ID | 场景 | 预期 |
|----|----|----|
| SC-300 | 启动时无网络 | 应用正常进入，显示“离线模式”警告 |
| SC-310 | 传输中途断网 | 上传任务暂停并进入 retry 队列 |
| SC-320 | 网络恢复 | 自动检测并继续未完成的上传 |
| SC-321 | 离线缓存 | 允许在离线时进行本地压缩和 MD5 校验 |

## 6. App Lifecycle (Startup & Crash)
| ID | 场景 | 预期 |
|----|----|----|
| SC-500 | 全新安装启动 | 数据库初始化，引导页出现 |
| SC-501 | 全量恢复 | 正常关闭应用重启，队列状态恢复 |
| SC-502 | 强制退出崩溃恢复 | 状态为 pending 的图片在下次启动自动重新处理 |
| SC-503 | 上传中断恢复 | 状态为 uploading 的任务回滚到 compressed |

## 8. Data Integrity
| ID | 场景 | 预期 |
|----|----|----|
| SC-700 | ImageId 唯一性 | 生成 UUID，确保不冲突 |
| SC-710 | Local/Remote 同步 | 修改本地记录，云端在 3 秒内同步成功 |
| SC-711 | 冲突解决 | 离线修改后，上线时以最新本地修改为准 (LWW) |
| SC-712 | 数据库降级 | Schema 变更时的迁移测试 (Future) |

---

## References

- [Index](./README.md)
- [CAPTURE.md](./CAPTURE.md)
- [PERFORMANCE_DEBUG.md](./PERFORMANCE_DEBUG.md)
