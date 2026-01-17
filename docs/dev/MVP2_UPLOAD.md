# MVP2 - 上传云端 (Upload)

> **目标**: 验证图片上传到 S3

### 功能范围

| 功能 | 说明 | 状态 |
|------|------|------|
| Presigned URL | 从 Lambda 获取上传 URL | [ ] |
| S3 上传 | 上传 WebP 到 S3 | [ ] |
| 网络状态 | 显示 online/offline | [ ] |
| 上传重试 | 失败自动重试 (最多 3 次) | [ ] |
| 离线队列 | 离线时暂停，恢复后继续 | [ ] |
| Quota 显示 | 显示今日使用量/限额 | [ ] |

### 测试场景

从 [FRONTEND.md](../tests/FRONTEND.md) 选取：

#### 4.1 Network - Offline Handling
| ID | 场景 | 预期 |
|----|------|------|
| SC-300 | 离线启动 | 本地功能正常 |
| SC-301 | 上传中断网 | 暂停并显示 offline |
| SC-302 | 恢复网络 | 自动继续上传 |
| SC-303 | 离线指示器 | UI 显示离线状态 |

> **Note**: SC-304~307 (离线交易操作) 移至 MVP3，因为交易数据需要 AI 批处理后才存在。

#### 5.2 Error Recovery - Database
| ID | 场景 | 预期 |
|----|------|------|
| SC-410 | DB 写入失败 | 压缩 OK → DB 锁定，清理临时文件 |
| SC-411 | DB 损坏 | 打开应用，重置或报错 |
| SC-412 | 迁移失败 | 打开应用，回滚或报错 |

#### 4.2 Network - Instability
| ID | 场景 | 预期 |
|----|------|------|
| SC-310 | 不稳定连接 | 模拟丢包，指数退避重试 |
| SC-311 | 超时处理 | 慢网络 (>15s) 压缩超时 |
| SC-312 | 上传重试 | 自动重试最多 3 次 |
| SC-313 | 永久失败 | 状态 failed，可手动重试 |

#### 4.3 Network - Race Conditions
| ID | 场景 | 预期 |
|----|------|------|
| SC-320 | 上传中断网 | 保持 paused 状态，非 idle |
| SC-321 | 重试中恢复 | 恢复后正常完成 |

#### 5.1 Error Recovery - Compression
| ID | 场景 | 预期 |
|----|------|------|
| SC-400 | 源文件删除 | 报错，其他图片继续 |
| SC-401 | 磁盘满 | 清晰错误消息 |
| SC-402 | 内存压力 | 优雅降级 |

#### 5.3 Error Recovery - Upload
| ID | 场景 | 预期 |
|----|------|------|
| SC-420 | URL 过期 | 获取新 URL 重试 |
| SC-421 | S3 访问拒绝 | 报错，不重试 |
| SC-422 | 配额超限 (服务端) | 暂停队列，显示消息 |
| SC-423 | 服务限制 | 显示"服务暂时不可用" |

#### 6.2 App Lifecycle - Background/Foreground
| ID | 场景 | 预期 |
|----|------|------|
| SC-510 | 切到后台 | 上传继续 (Tauri) |
| SC-511 | 回到前台 | 状态同步显示 |
| SC-512 | 长时间后台 | 后台 1 小时后返回，配额刷新 |

### 环境配置

```bash
# 需要部署 presign Lambda
cd infra
cdk deploy YorutsukePresignStack --profile dev

# 配置 Lambda URL
cd app
echo "VITE_LAMBDA_PRESIGN_URL=https://xxx.lambda-url.us-east-1.on.aws" >> .env.local
npm run tauri dev
```

### 验收标准

- [ ] 上传 5 张图片到 S3，全部成功
- [ ] 断网后上传暂停，恢复后自动继续
- [ ] 上传失败后自动重试
- [ ] Quota 正确显示 (used/limit)
- [ ] 所有 SC-300~303 通过 (Offline Handling)
- [ ] 所有 SC-410~412 通过 (Database Errors)
- [ ] 所有 SC-310~313 通过 (Instability)
- [ ] 所有 SC-320~321 通过 (Race Conditions)
- [ ] 所有 SC-400~402 通过 (Compression Errors)
- [ ] 所有 SC-420~423 通过 (Upload Errors)
- [ ] 所有 SC-510~512 通过 (Background/Foreground)

### 依赖

- Lambda: `presign`
- S3: `yorutsuke-images-dev`
