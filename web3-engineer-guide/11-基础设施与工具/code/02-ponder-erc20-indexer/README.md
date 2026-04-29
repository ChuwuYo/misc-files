# Ponder ERC20 Indexer 实战

## 启动步骤

```bash
# 1. 起 Postgres
docker compose up -d

# 2. 配置 RPC
cp .env.example .env
# 把 PONDER_RPC_URL_1 改成你的 Alchemy / 自建节点 URL

# 3. 装依赖 + 启动 indexer
pnpm install
pnpm dev
```

## 验证

```bash
# Ponder 默认 GraphQL 端点 http://localhost:42069/graphql
curl -s http://localhost:42069/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ accounts(orderBy: \"balance\", orderDirection: \"desc\", limit: 5){ items { address balance transferCount } } }"}' | jq
```

## 性能基线 (2026-04 测得)

- 起始区块 22300000 -> head (~7 天数据): 单节点 (Alchemy free tier) 约 20 分钟
- 自建 reth 2.0 archive: 约 4 分钟 (HyperSync 等价路径)
- Postgres 体积: ~800 MB / 7 天

## 进阶

- 多链: 在 ponder.config.ts 增加 networks.base / arbitrum, contracts 配置 network 数组
- 实时告警: 在 indexing 函数里调用 Discord webhook, 检测大额转账
- 生产: Ponder Cloud 或自托管 + pg_dump 定时备份
