# 练习 02：多网关健康检查

## 目标

实现一个跨网关健康检查工具，能并行查询 6 个 IPFS 公共网关，输出每个网关的可达性 + 延迟。

## 任务

### 任务 2.1

实现 `check.mjs`：
- 输入一个 CID
- 并行 HEAD 请求以下网关：
  - ipfs.io
  - dweb.link
  - cloudflare-ipfs.com
  - gateway.pinata.cloud
  - 4everland.io
  - nftstorage.link
- 每个网关：超时 15s，记录 status 和 latency
- 表格化输出

### 任务 2.2

加一个"任意 2 个网关 success 即视为健康"的判定逻辑，否则退出码 != 0。这个工具适合放进 cron。

### 任务 2.3（选做）

把检查写进 GitHub Actions：
- 每天定时跑 1 次
- 失败时发 Slack webhook

## 提交格式

`solution-02/`:
- `check.mjs`
- `health.yml`（GHA workflow）
- `README.md`

## 评分

- 是否所有网关都能并行（不能串行 6 次）
- 超时是否正确处理（不能整个 hang）
- 失败时是否给出可操作信息（哪些网关挂了，何时）
