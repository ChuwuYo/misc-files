// 索引函数: 处理每一条 USDC.Transfer 事件
import { ponder } from "@/generated";

ponder.on("USDC:Transfer", async ({ event, context }) => {
  const { from, to, value } = event.args;
  const { account, transferEvent } = context.db;

  // 1. 写入 transfer 流水 (txHash + logIndex 唯一)
  await transferEvent.insert({
    txHash: event.transaction.hash,
    logIndex: event.log.logIndex,
    from,
    to,
    amount: value,
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
  });

  // 2. 维护双方账户余额 (upsert)
  // 注意: USDC 0x0 地址是 mint/burn 来源, 余额不应减
  if (from !== "0x0000000000000000000000000000000000000000") {
    await account
      .insert({ address: from, balance: -value, transferCount: 1 })
      .onConflictDoUpdate((row) => ({
        balance: row.balance - value,
        transferCount: row.transferCount + 1,
      }));
  }

  await account
    .insert({ address: to, balance: value, transferCount: 1 })
    .onConflictDoUpdate((row) => ({
      balance: row.balance + value,
      transferCount: row.transferCount + 1,
    }));
});
