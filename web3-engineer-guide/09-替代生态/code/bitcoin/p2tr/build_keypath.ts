// 构造一笔 P2TR (key-path spend) 交易：
//   输入：一个已存在的 P2TR UTXO（regtest 上 fund 一笔即可）
//   输出：发回到一个新的 P2TR 地址 + 找零
//
// 关键点：
//   - 内部公钥 (internal pubkey, x-only, 32B) 经过 BIP-341 tweak 得到输出公钥
//   - key-path 签名是 BIP-340 Schnorr signature over sighash (BIP-341)
//   - witness 只放一个 64B/65B 签名（无 control block）
//
// 参考：
//   BIP-340: https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki
//   BIP-341: https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki

import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "@bitcoinerlab/secp256k1";
import { ECPairFactory } from "ecpair";

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);
const network = bitcoin.networks.regtest;

// 1. 一对 keypair
const kp = ECPair.makeRandom({ network });
const xOnlyPubkey = Buffer.from(kp.publicKey.subarray(1, 33)); // drop 0x02/0x03 byte → 32B x-only

// 2. P2TR address (key-path only, 没有 script tree)
const { address, output } = bitcoin.payments.p2tr({ internalPubkey: xOnlyPubkey, network });
console.log("p2tr address:", address);

// 3. 假设我们已经向 address 发了一笔 100_000 sats 的 UTXO
//    (实际跑：btc -rpcwallet=test sendtoaddress <address> 0.001 → 拿 txid)
const fakePrevTxid = "0".repeat(64);
const fakeVout = 0;
const fakeAmount = 100_000;

const psbt = new bitcoin.Psbt({ network });
psbt.addInput({
  hash: fakePrevTxid,
  index: fakeVout,
  witnessUtxo: { script: output!, value: fakeAmount },
  // P2TR 必须告诉 PSBT 内部公钥才能算 tweak
  tapInternalKey: xOnlyPubkey,
});

// 4. 输出：90_000 sats 给某个新 P2TR 地址，剩下做手续费
const recipient = bitcoin.payments.p2tr({
  internalPubkey: Buffer.from(ECPair.makeRandom().publicKey.subarray(1, 33)),
  network,
});
psbt.addOutput({ address: recipient.address!, value: 90_000 });

// 5. 用 tweaked signer 签名
const tweakedSigner = kp.tweak(
  bitcoin.crypto.taggedHash("TapTweak", xOnlyPubkey), // BIP-341 tweak = H_TapTweak(P || merkle_root)，无 script tree 时 merkle_root = ""
);
psbt.signInput(0, tweakedSigner);
psbt.finalizeAllInputs();

const tx = psbt.extractTransaction();
console.log("raw tx hex:", tx.toHex());
console.log("vsize:", tx.virtualSize(), "weight:", tx.weight());
