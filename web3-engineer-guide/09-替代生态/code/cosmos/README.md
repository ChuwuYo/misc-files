# Cosmos: ignite scaffold + 自定义 blog module

用 Ignite CLI 起一条全新链 `blogchain`，并 scaffold 出一个 `blog` 模块（CRUD 文章）。
全程命令式可复现。

## 环境（2026-04 推荐）

- Go 1.22+
- Ignite CLI v28.x（基于 Cosmos SDK v0.50 / v0.53 + IBC v8）
- Node 20.x（前端可选）

```bash
# 安装 Ignite
curl https://get.ignite.com/cli! | bash
ignite version
```

## 一键脚本

```bash
bash bootstrap.sh
```

`bootstrap.sh` 会做：

1. `ignite scaffold chain blogchain --no-module` 起链骨架
2. `ignite scaffold module blog` 起一个空 module
3. `ignite scaffold list post title body --module blog` 生成 CRUD message + keeper + CLI
4. `ignite chain serve` 启动 Tendermint/CometBFT 节点 + REST/gRPC + faucet

## 验证（serve 起来后另开一个终端）

```bash
# 用默认 alice 账号写一篇文章
blogchaind tx blog create-post "first post" "hello cosmos" --from alice -y

# 查询
blogchaind q blog list-post

# 通过 REST 查询
curl http://localhost:1317/blogchain/blog/post
```

## 自定义点（看 module/keeper/msg_server_post.go）

文件 `customizations/msg_server_post.go.patch` 演示一个常见改动：
**对 `CreatePost` 加一个 1 BLOG 的提交费**（演示 `bankKeeper.SendCoinsFromAccountToModule`）。

应用方法：

```bash
cp customizations/msg_server_post.go.patch blogchain/x/blog/keeper/
# 按 patch 内提示替换 msg_server_post.go 中对应函数
```

## 与 IBC 的关系

`ignite scaffold chain` 默认开启 IBC v8（CometBFT 0.38+）。
IBC fungible token transfer module（`transfer`）已默认注册，可直接发起跨链转账。
练习 `exercises/cosmos-ibc-transfer/` 演示如何在两条链之间用 `relayer` 建 IBC channel。
