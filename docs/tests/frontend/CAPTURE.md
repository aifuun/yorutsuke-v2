# Frontend Test Scenarios - CAPTURE

> Test cases for image acquisition, validation, and processing.

## 1. Happy Path
| ID | 场景 | 预期 |
|----|----|----|
| SC-001 | 单张图片拖放 | 压缩成功，状态 compressed |
| SC-002 | 多张图片拖放 | 顺序处理，显示进度 |
| SC-003 | 大图 (>5MB) | 强制压缩到 <500KB |
| SC-004 | 小图 (<100KB) | 转换为 WebP，即使体积可能微增 |
| SC-005 | 点击选择单张图片 | 系统文件选择器弹出，选择后处理 |
| SC-006 | 点击选择多张图片 | 列表批量出现，后台顺序处理 |
| SC-007 | 粘贴截图 (Cmd+V) | 剪贴板图片自动处理 |
| SC-008 | 粘贴单张图片文件 | 识别文件路径并处理 |
| SC-009 | 粘贴多张图片文件 | 批量处理所有粘贴的文件 |

## 2. File Validation
| ID | 场景 | 预期 |
|----|----|----|
| SC-010 | 支持格式 (JPG/PNG/WebP/HEIC) | 全部接受并转为 WebP |
| SC-011 | 不支持格式 (.txt/.pdf) | 拦截并显示红色通知 |
| SC-012 | 损坏的图片文件 | 压缩步骤报错，状态 failed |
| SC-013 | 超大图片 (>20MB) | 拦截或显示警告，防止内存溢出 |

## 3. Duplicate Detection
| ID | 场景 | 预期 |
|----|----|----|
| SC-020 | 拖入完全相同的文件两次 | 第二个文件提示重复，不计入队列 |
| SC-021 | 相同内容不同文件名 | MD5 匹配成功，拦截重复 |
| SC-022 | 相似但内容不同的两张图 | 两张都成功处理 |
| SC-023 | 快速双击/多次快速拖入 | 幂等处理，防止创建多个记录 |

---

## References

- [Index](./README.md)
- [QUOTA_AUTH.md](./QUOTA_AUTH.md)
- [LIFECYCLE_ERROR.md](./LIFECYCLE_ERROR.md)
