// 解析一笔真实 mainnet Taproot 交易（含 key-path / script-path 自适应判断）。
// 这里用一笔典型的 Ordinals inscription reveal 交易作为例子。

import * as bitcoin from "bitcoinjs-lib";

// 解析任意你想分析的 Taproot 交易：
//   - 在 mempool.space 上找到目标 tx → 点 "Details" → 拷贝 raw tx hex
//   - 设置 RAW_HEX=<hex> 环境变量后运行
//
// 注意：本文件未内置默认 hex（之前的占位 hex 是手工拼的非法字节，会让
// Transaction.fromHex 在不同位置抛出难以排查的错误）。请显式提供 RAW_HEX。
const RAW_HEX = process.env.RAW_HEX;
if (!RAW_HEX) {
  console.error(
    "未设置 RAW_HEX。请从 mempool.space 复制一笔 Taproot 交易的 raw hex，例如:\n" +
      "  RAW_HEX=0200000000010... pnpm tsx decode_taproot_tx.ts",
  );
  process.exit(1);
}

const tx = bitcoin.Transaction.fromHex(RAW_HEX);
console.log("txid:", tx.getId());
console.log("version:", tx.version);
console.log("locktime:", tx.locktime);
console.log("inputs:", tx.ins.length, "outputs:", tx.outs.length);

tx.ins.forEach((vin, i) => {
  console.log(`\n--- vin[${i}] ---`);
  console.log(`  prev: ${Buffer.from(vin.hash).reverse().toString("hex")}:${vin.index}`);
  console.log(`  sequence: 0x${vin.sequence.toString(16)}`);
  if (vin.witness && vin.witness.length > 0) {
    const last = vin.witness[vin.witness.length - 1];
    // BIP-341：witness 末项第一字节 0xc0/0xc1 = control block → script-path
    if (vin.witness.length >= 2 && (last[0] & 0xfe) === 0xc0) {
      console.log(`  spend: script-path (BIP-341 leaf v${last[0] & 0x01})`);
      console.log(`  control block parity bit: ${last[0] & 0x01}`);
      console.log(`  internal pubkey: ${last.subarray(1, 33).toString("hex")}`);
      const script = vin.witness[vin.witness.length - 2];
      console.log(`  revealed script (asm): ${bitcoin.script.toASM(script)}`);
      console.log(`  signatures (witness items 0..n-2):`);
      for (let k = 0; k < vin.witness.length - 2; k++) {
        console.log(`    [${k}] len=${vin.witness[k].length} ${vin.witness[k].toString("hex")}`);
      }
    } else if (vin.witness.length === 1 && (vin.witness[0].length === 64 || vin.witness[0].length === 65)) {
      console.log(`  spend: key-path (single 64/65B Schnorr signature)`);
      console.log(`  signature: ${vin.witness[0].toString("hex")}`);
    } else {
      console.log(`  witness items: ${vin.witness.length} (likely SegWit v0)`);
    }
  } else {
    console.log(`  legacy / non-segwit input`);
  }
});

tx.outs.forEach((vout, i) => {
  console.log(`\n--- vout[${i}] --- ${vout.value} sats`);
  console.log(`  scriptPubKey: ${bitcoin.script.toASM(vout.script)}`);
  // P2TR 输出脚本：OP_1 <32B>
  if (vout.script.length === 34 && vout.script[0] === 0x51 && vout.script[1] === 0x20) {
    console.log(`  type: P2TR, output key (x-only): ${vout.script.subarray(2).toString("hex")}`);
  }
});
