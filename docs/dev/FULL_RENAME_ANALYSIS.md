# 全面改名为 Recie - 可行性分析

> 评估将所有 "yorutsuke" 改为 "recie" 的影响

---

## 📊 总体评估

| 方面 | 可行性 | 影响程度 | 工作量 | 风险等级 |
|------|--------|----------|--------|----------|
| **开发环境** | ✅ 可行 | 🟢 低 | 1-2 小时 | 🟢 低 |
| **生产环境** | ⚠️ 谨慎 | 🔴 高 | 1-2 周 | 🔴 高 |
| **AWS 资源** | ✅ 可行 | 🔴 极高 | 2-3 周 | 🔴 极高 |

**结论**:
- ✅ 开发环境：影响小，推荐改
- ⚠️ 生产环境：需要详细迁移计划
- 🔴 AWS 资源：风险极高，需要停机维护

---

## 🎯 分层改名策略

### 方案 A: 最小改名（推荐）✅

**只改用户可见部分** - 已完成

**影响**: 零风险
**工作量**: 0 小时（已完成）
**结果**: 用户看到 "Recie"，技术栈保持不变

**✅ 推荐理由**:
- 用户体验已完全改变
- 无需数据迁移
- 无需 AWS 资源迁移
- 生产环境零风险

---

### 方案 B: 中度改名（开发环境）⚠️

**改用户可见 + 本地技术标识符**

#### 影响范围

| 项目 | 当前 | 改后 | 影响 |
|------|------|------|------|
| 数据库文件 | `yorutsuke.db` | `recie.db` | ⚠️ 需要数据迁移脚本 |
| localStorage | `yorutsuke:quota` | `recie:quota` | ⚠️ 用户配额重置 |
| 日志目录 | `~/.yorutsuke/` | `~/.recie/` | ⚠️ 历史日志丢失 |
| Cargo 库名 | `yorutsuke_v2_lib` | `recie_lib` | ✅ 只需重新编译 |

#### 详细影响

**1. 数据库迁移**

**影响**:
- 用户现有数据（交易记录、图片）需要迁移
- 迁移失败风险：数据丢失

**迁移步骤**:
```typescript
// app/src/00_kernel/storage/migration.ts
async function migrateDatabase() {
  const oldDbPath = 'yorutsuke.db';
  const newDbPath = 'recie.db';

  // 1. 检查旧数据库是否存在
  if (await fileExists(oldDbPath)) {
    // 2. 复制到新位置
    await copyFile(oldDbPath, newDbPath);

    // 3. 验证数据完整性
    const oldCount = await countRecords(oldDbPath);
    const newCount = await countRecords(newDbPath);

    if (oldCount !== newCount) {
      throw new Error('Migration failed: record count mismatch');
    }

    // 4. 备份旧数据库
    await copyFile(oldDbPath, `${oldDbPath}.backup`);

    logger.info('Database migrated successfully', {
      oldPath: oldDbPath,
      newPath: newDbPath,
      recordCount: newCount,
    });
  }
}
```

**风险**:
- 🔴 迁移失败导致数据丢失
- 🟡 迁移过程应用崩溃
- 🟡 新旧版本同时运行导致数据不一致

**工作量**: 2-3 天（开发 + 测试）

---

**2. localStorage 迁移**

**影响**:
- 用户配额设置重置
- Mock 模式设置丢失

**迁移代码**:
```typescript
// app/src/01_domains/quota/migration.ts
function migrateLocalStorage() {
  const oldKey = 'yorutsuke:quota';
  const newKey = 'recie:quota';

  const oldData = localStorage.getItem(oldKey);
  if (oldData) {
    localStorage.setItem(newKey, oldData);
    // 保留旧数据，防止降级
    logger.info('localStorage migrated', { oldKey, newKey });
  }
}
```

**风险**: 🟢 低（可以保留旧 key 作为 fallback）

**工作量**: 1 天

---

**3. 日志目录迁移**

**影响**:
- 历史日志文件需要移动
- 旧日志查询工具需要更新

**迁移脚本**:
```bash
# 一次性迁移脚本
if [ -d ~/.yorutsuke ]; then
  mv ~/.yorutsuke ~/.recie
  echo "Logs migrated from ~/.yorutsuke to ~/.recie"
fi
```

**风险**: 🟢 低（不影响应用运行）

**工作量**: 1 天

---

#### 方案 B 总结

**工作量**: 4-5 天
**风险**: 🟡 中等（主要是数据库迁移）
**回滚策略**: 保留旧文件作为备份

**测试清单**:
- [ ] 新用户首次安装（无旧数据）
- [ ] 老用户升级（有旧数据）
- [ ] 迁移失败回滚
- [ ] 新旧版本共存（开发环境）

---

### 方案 C: 完全改名（AWS + 生产环境）🔴

**改所有内容，包括 AWS 资源**

#### AWS 资源迁移

**影响范围**:

| 资源类型 | 当前名称 | 新名称 | 迁移方式 |
|---------|---------|--------|----------|
| S3 Bucket | `yorutsuke-images-us-dev` | `recie-images-us-dev` | 数据复制 + 切换 |
| DynamoDB Table | `yorutsuke-transactions-us-dev` | `recie-transactions-us-dev` | 数据导出 + 导入 |
| Lambda Function | `yorutsuke-instant-processor-us-dev` | `recie-instant-processor-us-dev` | 重新部署 |
| Lambda Layer | `yorutsuke-shared-dev` | `recie-shared-dev` | 重新发布 |
| CloudFormation Stack | `Yorutsuke2Stack-dev` | `Recie2Stack-dev` | 重新创建 |

---

#### 详细迁移步骤

**阶段 1: 准备（1 周）**

1. **备份所有数据**
   ```bash
   # S3 备份
   aws s3 sync s3://yorutsuke-images-us-dev s3://backup-yorutsuke-images-us-dev

   # DynamoDB 备份
   aws dynamodb create-backup \
     --table-name yorutsuke-transactions-us-dev \
     --backup-name yorutsuke-transactions-backup-$(date +%Y%m%d)
   ```

2. **创建迁移脚本**
   ```typescript
   // infra/scripts/migrate-aws-resources.ts

   // S3 数据迁移
   async function migrateS3() {
     const oldBucket = 'yorutsuke-images-us-dev';
     const newBucket = 'recie-images-us-dev';

     // 列出所有对象
     const objects = await s3.listObjectsV2({ Bucket: oldBucket });

     // 复制到新 bucket
     for (const obj of objects.Contents) {
       await s3.copyObject({
         CopySource: `${oldBucket}/${obj.Key}`,
         Bucket: newBucket,
         Key: obj.Key,
       });
     }
   }

   // DynamoDB 数据迁移
   async function migrateDynamoDB() {
     const oldTable = 'yorutsuke-transactions-us-dev';
     const newTable = 'recie-transactions-us-dev';

     // 扫描所有数据
     const items = await scanAllItems(oldTable);

     // 批量写入新表
     await batchWriteItems(newTable, items);
   }
   ```

3. **更新 CDK 代码**
   ```typescript
   // infra/bin/infra.ts
   const config = {
     imageBucketName: `recie-images-us-${env}-${account}`,
     transactionsTableName: `recie-transactions-us-${env}`,
     quotasTableName: `recie-quotas-us-${env}`,
     // ... 所有资源改名
   };
   ```

---

**阶段 2: 迁移执行（3-5 天）**

**2.1 创建新资源**
```bash
# 部署新的 CDK stack（不删除旧的）
cd infra
npm run deploy -- --all --profile dev
```

**2.2 数据迁移**
```bash
# S3 数据复制（约 1-2 小时，取决于数据量）
node scripts/migrate-s3.mjs

# DynamoDB 数据迁移（约 2-4 小时）
node scripts/migrate-dynamodb.mjs

# 验证数据完整性
node scripts/verify-migration.mjs
```

**2.3 切换应用**
```bash
# 更新应用配置，指向新资源
# 发布新版本应用
npm run build
```

**2.4 验证新系统**
```bash
# 测试所有功能
# - 上传图片
# - 查询交易
# - 同步数据
```

**2.5 删除旧资源（1 周后）**
```bash
# 确认新系统稳定后，删除旧资源
aws cloudformation delete-stack \
  --stack-name Yorutsuke2Stack-dev \
  --profile dev
```

---

#### 停机时间估算

**方案 1: 蓝绿部署（推荐）**
- 停机时间: **0 分钟**
- 方法: 新旧系统并行运行，逐步切换流量
- 成本: 双倍资源成本（1 周）

**方案 2: 直接切换**
- 停机时间: **4-6 小时**
- 方法: 停止旧系统 → 数据迁移 → 启动新系统
- 风险: 迁移失败需要回滚

---

#### 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| S3 数据丢失 | 🟡 中 | 🔴 极高 | 完整备份 + 验证脚本 |
| DynamoDB 数据不一致 | 🟡 中 | 🔴 极高 | 事务迁移 + 验证 |
| Lambda 部署失败 | 🟢 低 | 🟡 中 | 蓝绿部署 + 回滚 |
| 客户端兼容性 | 🟡 中 | 🟡 中 | 版本检测 + 强制升级 |
| 监控/告警失效 | 🟡 中 | 🟡 中 | 提前配置新告警 |

---

#### 成本估算

**AWS 资源双份成本**（蓝绿部署期间）:
- S3: $0.023/GB/月 × 2 = ~$5/月
- DynamoDB: $1.25/百万读写 × 2 = ~$20/月
- Lambda: $0.20/百万请求 × 2 = ~$10/月

**总计**: ~$35/月 × 1 周 = **~$10 临时成本**

**人力成本**:
- 开发: 2 周 × 1 人 = 2 人周
- 测试: 1 周 × 1 人 = 1 人周
- 总计: **3 人周**

---

#### 方案 C 总结

**工作量**: 2-3 周
**停机时间**: 0-6 小时（取决于方案）
**风险**: 🔴 高（数据迁移风险）
**成本**: ~$10 (AWS) + 3 人周

**关键成功因素**:
- ✅ 完整的备份策略
- ✅ 详细的迁移脚本
- ✅ 充分的测试（staging 环境先测试）
- ✅ 快速回滚方案
- ✅ 监控和告警

---

## 📋 三种方案对比

| 方案 | 用户体验 | 技术债务 | 工作量 | 风险 | 推荐 |
|------|----------|----------|--------|------|------|
| **A: 最小改名** | ✅ 完美 | 🟡 技术标识符保留 | 0 天 | 🟢 零风险 | ✅ 强烈推荐 |
| **B: 中度改名** | ✅ 完美 | 🟢 本地标识符统一 | 4-5 天 | 🟡 中等 | 🔄 可选 |
| **C: 完全改名** | ✅ 完美 | ✅ 完全统一 | 2-3 周 | 🔴 高 | ⚠️ 谨慎 |

---

## 🎯 推荐决策流程

### 问题 1: 你的项目处于什么阶段？

```
开发阶段（未上线）
  ↓
  方案 C: 完全改名 ✅
  理由: 没有生产数据，改名成本最低

已上线（有用户）
  ↓
  方案 A: 最小改名 ✅
  理由: 用户体验已改变，避免数据迁移风险
```

---

### 问题 2: 技术债务是否困扰你？

```
是（代码中 yorutsuke 很困扰）
  ↓
  方案 B: 中度改名
  范围: 只改本地标识符，不改 AWS

否（只要用户看不到就行）
  ↓
  方案 A: 最小改名 ✅
  理由: 已完成
```

---

### 问题 3: 是否有充足的资源？

```
有（2-3 周开发时间 + staging 环境）
  ↓
  方案 C: 完全改名
  前提: 必须在 staging 环境先完整测试

没有（时间紧迫）
  ↓
  方案 A: 最小改名 ✅
  理由: 零风险，已完成
```

---

## 💡 我的建议

### 当前状态 ✅

**已完成**: 方案 A（最小改名）
- ✅ 用户看到: "Recie"
- ✅ 技术栈: yorutsuke（用户看不到）
- ✅ 风险: 零
- ✅ 维护成本: 零

**是否需要进一步改名？**

**NO（推荐）** ✅
- 用户体验已完美
- 技术标识符对用户不可见
- 避免数据迁移风险
- 参考: Twitter → X, Facebook → Meta（技术栈保留旧名）

**YES（如果必要）**
1. **先做方案 B**（本地标识符）
   - 工作量小（4-5 天）
   - 风险中等
   - 可以逐步推进

2. **staging 环境完整测试方案 C**
   - 验证迁移脚本
   - 测试回滚流程
   - 确保零数据丢失

3. **生产环境谨慎执行方案 C**
   - 选择低峰期
   - 准备回滚方案
   - 实时监控

---

## 📚 实施清单（如果选择完全改名）

### Phase 1: 准备（1 周）

- [ ] 创建完整的备份策略
- [ ] 编写迁移脚本
- [ ] 编写验证脚本
- [ ] 编写回滚脚本
- [ ] 更新所有 CDK 代码
- [ ] 配置新的监控和告警

### Phase 2: Staging 测试（1 周）

- [ ] 在 staging 环境执行完整迁移
- [ ] 验证所有功能
- [ ] 测试回滚流程
- [ ] 性能测试
- [ ] 记录实际耗时

### Phase 3: 生产迁移（3-5 天）

- [ ] 选择维护窗口（周末低峰期）
- [ ] 备份所有生产数据
- [ ] 执行迁移脚本
- [ ] 验证数据完整性
- [ ] 切换应用流量
- [ ] 监控系统稳定性
- [ ] 1 周后删除旧资源

### Phase 4: 验证（1 周）

- [ ] 用户反馈收集
- [ ] 性能监控
- [ ] 错误率监控
- [ ] 成本监控

---

**Last Updated**: 2026-01-27
**Conclusion**:
- ✅ 最小改名（方案 A）已完成，强烈推荐保持现状
- 🔄 如必须完全改名，建议先在 staging 环境完整测试
- 🔴 生产环境改名风险高，需要详细的迁移计划和回滚策略
