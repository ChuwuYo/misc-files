// 用 @mysten/sui 1.x 调用 counter::counter::create / increment。
// 用法：PACKAGE_ID=0x... pnpm tsx call.ts
//
// 默认连 localnet。生产环境用 getFullnodeUrl('mainnet'/'testnet').

import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

const PACKAGE_ID = process.env.PACKAGE_ID;
if (!PACKAGE_ID) {
  console.error("set PACKAGE_ID=0x... after `sui client publish`");
  process.exit(1);
}

const client = new SuiClient({ url: process.env.SUI_RPC ?? "http://127.0.0.1:9000" });

// 演示：用一个一次性 keypair；真实场景从环境/钱包加载
const kp = Ed25519Keypair.generate();
const sender = kp.getPublicKey().toSuiAddress();
console.log("sender:", sender);

// 给 sender 发点 SUI（仅 localnet）
await fetch("http://127.0.0.1:9123/gas", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ FixedAmountRequest: { recipient: sender } }),
});

// 1. create() —— 直接从 objectChanges 中拿到新建的 shared Counter 对象 ID
//    （create 不会发 Incremented 事件，所以不能靠 queryEvents 来定位）
let counterId: string | undefined;
{
  const tx = new Transaction();
  tx.moveCall({ target: `${PACKAGE_ID}::counter::create` });
  const r = await client.signAndExecuteTransaction({
    signer: kp,
    transaction: tx,
    options: { showEffects: true, showObjectChanges: true },
  });
  console.log("create digest:", r.digest);

  const created = (r.objectChanges ?? []).find(
    (c: any) =>
      c.type === "created" &&
      typeof c.objectType === "string" &&
      c.objectType.includes("::counter::Counter"),
  ) as { objectId: string } | undefined;
  counterId = created?.objectId;
}

// 2. 打印 owned + counterId（shared object 不属于任何人，需要从 objectChanges 取）
const owned = await client.getOwnedObjects({ owner: sender, options: { showType: true } });
console.log("owned:", owned.data.map((o) => o.data?.type));
console.log("counterId:", counterId);

if (counterId) {
  const tx = new Transaction();
  tx.moveCall({ target: `${PACKAGE_ID}::counter::increment`, arguments: [tx.object(counterId)] });
  const r = await client.signAndExecuteTransaction({ signer: kp, transaction: tx });
  console.log("increment digest:", r.digest);
}
