// 简化的两节点 LN demo（基于 ldk-node 0.4.x）。
// 流程：
//   1. 起两个 ldk-node 实例 A / B（各自的 sled storage、各自的钱包种子）
//   2. 链后端 = 本地 bitcoind regtest
//   3. A 给自己生成地址、向链上充钱（从外部 RPC 用 bitcoin-cli 转入），开 A→B 100k sats 通道
//   4. 等通道 ready，B 生成 invoice (1000 sats)，A 支付
//
// 注意：ldk-node 的 Node.js 绑定 API 还在演进，下面接口名以 0.4.x 文档为准。
// 参考：https://github.com/lightningdevkit/ldk-node

import { Builder, NetAddress } from "ldk-node";
import { execSync } from "node:child_process";

function btc(args: string): string {
  return execSync(
    `docker exec btc-regtest bitcoin-cli -regtest -rpcuser=user -rpcpassword=pass ${args}`,
  )
    .toString()
    .trim();
}

function buildNode(name: string, port: number, dataDir: string) {
  const builder = new Builder();
  builder.setNetwork("regtest");
  builder.setStorageDirPath(dataDir);
  builder.setEsploraServer("http://127.0.0.1:30000"); // 本地 esplora（或换成 chain source = bitcoind RPC）
  builder.setListeningAddresses([NetAddress.fromString(`127.0.0.1:${port}`)]);
  builder.setNodeAlias(name);
  return builder.build();
}

const alice = buildNode("alice", 9735, "./data/alice");
const bob = buildNode("bob", 9736, "./data/bob");

await alice.start();
await bob.start();
console.log("alice:", alice.nodeId(), "listen:", alice.listeningAddresses());
console.log("bob:  ", bob.nodeId(), "listen:", bob.listeningAddresses());

// 给 Alice 上链充钱
const aliceAddr = alice.onchainPayment().newAddress();
console.log("fund alice on-chain at:", aliceAddr);
btc(`-rpcwallet=test sendtoaddress ${aliceAddr} 0.01`);
btc(`-rpcwallet=test -generate 6`);
await alice.syncWallets();

// 连接对端
const bobNetAddr = bob.listeningAddresses()![0];
alice.connect(bob.nodeId(), bobNetAddr, /*persist=*/ true);

// 开通道
alice.openChannel(bob.nodeId(), bobNetAddr, /*sats=*/ 100_000n, /*push_msat=*/ 0n, undefined);

// 等待 channel_ready：confirm 几个区块
btc(`-rpcwallet=test -generate 6`);
await alice.syncWallets();
await bob.syncWallets();

// Bob 出 invoice
const inv = bob.bolt11Payment().receive(1000_000n /* msat = 1000 sats */, "ldk-demo", 3600);
console.log("invoice:", inv);

// Alice 支付
const paymentId = alice.bolt11Payment().send(inv, undefined);
console.log("payment_id:", paymentId);

await new Promise((r) => setTimeout(r, 3000));
console.log("alice balance:", alice.listChannels().map((c) => c.outboundCapacityMsat));
console.log("bob balance:  ", bob.listChannels().map((c) => c.outboundCapacityMsat));

await alice.stop();
await bob.stop();
