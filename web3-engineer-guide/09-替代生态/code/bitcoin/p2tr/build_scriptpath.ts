// 构造一笔 P2TR (script-path spend) 交易：
//   - 内部 key 是 NUMS（nothing-up-my-sleeve），证明无人能用 key-path 花掉
//   - 一棵 leaf script tree，叶子里是 OP_CHECKSIG <alice_pubkey>
//   - 花费时 witness = [signature, leaf_script, control_block]
//
// 这是 Ordinals/inscriptions 与 BitVM 用的核心模式：脚本只在花费时被 reveal。

import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "@bitcoinerlab/secp256k1";
import { ECPairFactory } from "ecpair";

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);
const network = bitcoin.networks.regtest;

const NUMS = Buffer.from(
  "50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0",
  "hex",
); // BIP-341 推荐的 unspendable internal key

const alice = ECPair.makeRandom({ network });
const aliceXOnly = Buffer.from(alice.publicKey.subarray(1, 33));

// leaf script: OP_CHECKSIG over Alice 的 schnorr key
const leafScript = bitcoin.script.compile([aliceXOnly, bitcoin.opcodes.OP_CHECKSIG]);

const scriptTree = { output: leafScript };
const p2tr = bitcoin.payments.p2tr({
  internalPubkey: NUMS,
  scriptTree,
  redeem: { output: leafScript, redeemVersion: 0xc0 },
  network,
});

console.log("script-path P2TR address:", p2tr.address);
console.log("output script:", p2tr.output!.toString("hex"));

// 假设已 fund：先省略输入构造，重点演示 witness 排布
const psbt = new bitcoin.Psbt({ network });
psbt.addInput({
  hash: "0".repeat(64),
  index: 0,
  witnessUtxo: { script: p2tr.output!, value: 100_000 },
  tapLeafScript: [
    {
      leafVersion: 0xc0,
      script: leafScript,
      controlBlock: p2tr.witness![p2tr.witness!.length - 1],
    },
  ],
});
psbt.addOutput({ address: p2tr.address!, value: 90_000 });
psbt.signInput(0, alice);

// BIP-141 witness stack 编码：先写 stack item 个数（compact size），
// 再依次写每个 item 的 (compact size length || bytes)。
// 注意：bitcoinjs-lib 的 finalScriptWitness 期望的就是这种序列化格式，
// 而不是 script.compile（后者是 OP_PUSH 序列化的脚本，会产出非法 witness）。
function encodeVarInt(n: number): Buffer {
  if (n < 0xfd) return Buffer.from([n]);
  if (n <= 0xffff) {
    const b = Buffer.alloc(3);
    b[0] = 0xfd;
    b.writeUInt16LE(n, 1);
    return b;
  }
  if (n <= 0xffffffff) {
    const b = Buffer.alloc(5);
    b[0] = 0xfe;
    b.writeUInt32LE(n, 1);
    return b;
  }
  const b = Buffer.alloc(9);
  b[0] = 0xff;
  b.writeBigUInt64LE(BigInt(n), 1);
  return b;
}
function serializeWitnessStack(stack: Buffer[]): Buffer {
  const parts: Buffer[] = [encodeVarInt(stack.length)];
  for (const item of stack) {
    parts.push(encodeVarInt(item.length), item);
  }
  return Buffer.concat(parts);
}

psbt.finalizeInput(0, (_idx, input) => {
  // 自定义 finalizer：witness = [sig, script, control_block]
  const sig = input.tapScriptSig![0].signature;
  const ls = input.tapLeafScript![0];
  const witnessStack = [sig, ls.script, ls.controlBlock];
  return {
    finalScriptWitness: serializeWitnessStack(witnessStack),
  };
});

console.log("raw tx hex:", psbt.extractTransaction().toHex());
