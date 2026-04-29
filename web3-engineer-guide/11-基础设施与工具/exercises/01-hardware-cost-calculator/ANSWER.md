# 习题 1 参考答案: reth + lighthouse 硬件成本估算

## 输出 (2026-04)

```
型号 / 模式                                 一次性  月度   年度    云对照
reth + lighthouse mainnet full (self-hosted) ¥ 8000  ¥ 330  ¥ 11960  ¥42000
reth + lighthouse mainnet full (colo)        ¥ 8000  ¥ 180  ¥ 10160  ¥42000
reth archive + lighthouse mainnet (self)     ¥11800  ¥ 356  ¥ 16072  ¥42000
reth archive + lighthouse mainnet (colo)     ¥11800  ¥ 206  ¥ 14272  ¥42000
geth + lighthouse mainnet full (self)        ¥ 8000  ¥ 330  ¥ 11960  ¥42000
geth + lighthouse mainnet full (colo)        ¥ 8000  ¥ 180  ¥ 10160  ¥42000
```

## 关键决策点

1. **NVMe 是核心成本**: archive 节点必须 8 TB 企业级或高端消费级 (Crucial T700 / Samsung 990 Pro), 不能用 QLC. 写入放大估算: 链上每天 ~50 GB 增量, 加上 trie compaction 实际写入 ~200 GB/天, 一块 1200 TBW 的 SSD 约 16 个月磨穿.
2. **reth 比 geth 省 30-40% 磁盘** (storage v2 默认开启), 全节点 ~700 GB vs geth ~1.2 TB. 但 geth 生态成熟, archive trace API 调试体验更好.
3. **托管 vs 自建**: 托管月度便宜 ¥150 但限制带宽和物理访问; 自建拥有完全控制但需要 UPS / 散热 / 物理安全成本未计入.
4. **云 vs 自建 break-even**: 一年 ¥42000 云成本 vs ¥10000 自建 -> 4 倍差距. 但云有按需扩容、自动迁移、SOC2 合规等优势, 适合早期项目.

## 进阶: 多节点高可用

- 3 节点冗余 (2 region): 月度成本 ~¥600 (托管) + ¥1000 跨地域内网, 总年度 ~¥30000
- 加 Prometheus + Grafana + PagerDuty: ¥0 (开源) + 监控人力成本 (1 SRE 0.2 FTE)
- 比较 Alchemy Growth tier ($199/月) = ¥17000/年, 自建仍便宜约一半且数据可信
