# Frontend Test Scenarios - LEDGER & REPORT

> Test cases for transaction management and data visualization.

## 10. Transaction / Ledger
| ID | 场景 | 预期 |
|----|----|----|
| SC-1000 | 自动录入显示 | AI 处理完后，账本自动出现新记录 |
| SC-1001 | 手动编辑金额 | 修改后实时保存到本地并同步云端 |
| SC-1010 | 修改分类 | 选择不同分类，账本即时更新图标/样式 |
| SC-1011 | 图片核对 | 点击账本记录，侧边弹出对应收据原图 |
| SC-1020 | 删除记录 | 双重确认，彻底从本地和云端移除 |
| SC-1021 | 搜索/筛选 | 按日期、关键词、金额范围过滤 |

## 11. Report / Dashboard
| ID | 场景 | 预期 |
|----|----|----|
| SC-1100 | 今日收入/支出 | 首页卡片显示今日汇总 |
| SC-1101 | 每日早报数据 | 缓存逻辑验证，点击历史早报快速加载 |
| SC-1110 | 支出趋势图 | 周、月维度的曲线图/柱状图显示 |
| SC-1111 | 分类占比饼图 | 支出组成分析 |

---

## References

- [Index](./README.md)
- [CAPTURE.md](./CAPTURE.md)
- [QUOTA_AUTH.md](./QUOTA_AUTH.md)
