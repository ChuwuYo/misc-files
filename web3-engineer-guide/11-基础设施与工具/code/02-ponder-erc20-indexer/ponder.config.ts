// Ponder 0.10 索引 USDC 在 mainnet 的 Transfer 事件
// 验证日期: 2026-04
import { createConfig } from "@ponder/core";
import { http } from "viem";

import { erc20Abi } from "./abis/erc20Abi";

export default createConfig({
  database: {
    kind: "postgres",
    connectionString: process.env.DATABASE_URL ?? "postgres://ponder:ponder@localhost:5432/ponder",
  },
  networks: {
    mainnet: {
      chainId: 1,
      transport: http(process.env.PONDER_RPC_URL_1),
      // 一定要给 archive 端点 (Alchemy / 自建 reth archive); pollingInterval 默认 1s
      pollingInterval: 2_000,
    },
  },
  contracts: {
    USDC: {
      network: "mainnet",
      abi: erc20Abi,
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      // 起始区块: USDC 部署区块 6082465; 实际跑全量需要数小时, demo 用近一周
      startBlock: 22300000,
      // 留空 endBlock 表示持续跟随 head
    },
  },
});
