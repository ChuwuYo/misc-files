"""
01 secp256k1 keypair → sign → verify → ecrecover

依赖:
    pip install -r requirements.txt
        coincurve==20.0.0
        eth-keys==0.5.1
        eth-utils==4.1.1

权威参考:
    - libsecp256k1: https://github.com/bitcoin-core/secp256k1
    - eth-keys:     https://github.com/ethereum/eth-keys
    - SECG SEC2:    https://www.secg.org/sec2-v2.pdf

运行:
    python 01_secp256k1_sign_verify.py
"""

from __future__ import annotations

import os

from coincurve import PrivateKey
from eth_keys import keys
from eth_utils import keccak, to_checksum_address


def derive_eth_address(public_key_uncompressed: bytes) -> str:
    """以太坊地址 = keccak256(uncompressed_pubkey[1:])[-20:]，再做 EIP-55 校验和。"""
    assert len(public_key_uncompressed) == 65 and public_key_uncompressed[0] == 0x04
    return to_checksum_address(keccak(public_key_uncompressed[1:])[-20:])


def main() -> None:
    # 1) 生成随机 32 字节私钥（务必用 os.urandom 或 secrets，禁止 random.random）
    sk_bytes = os.urandom(32)
    sk = PrivateKey(sk_bytes)
    pk_uncompressed = sk.public_key.format(compressed=False)  # 65 字节，0x04||X||Y
    address = derive_eth_address(pk_uncompressed)

    print(f"私钥(hex): 0x{sk_bytes.hex()}")
    print(f"公钥(uncompressed): 0x{pk_uncompressed.hex()}")
    print(f"以太坊地址 (EIP-55): {address}")

    # 2) 对消息哈希签名（以太坊用 keccak256；不要直接对原文签名）
    message = b"Hello Web3, signed at 2026-04"
    msg_hash = keccak(message)
    print(f"\n消息: {message!r}")
    print(f"keccak256(消息): 0x{msg_hash.hex()}")

    # 3) 用 eth-keys 生成可恢复 (v,r,s) 的以太坊式签名
    eth_sk = keys.PrivateKey(sk_bytes)
    signature = eth_sk.sign_msg_hash(msg_hash)  # 65 字节 vrs
    r, s, v = signature.r, signature.s, signature.v
    print(f"\nv={v}  r=0x{r:064x}  s=0x{s:064x}")

    # 4) 本地验签：等价于 Solidity ecrecover(hash, v+27, r, s)
    recovered_pk = signature.recover_public_key_from_msg_hash(msg_hash)
    recovered_addr = recovered_pk.to_checksum_address()
    print(f"\necrecover 还原地址: {recovered_addr}")
    assert recovered_addr == address, "ecrecover 失败：地址不匹配"

    # 5) low-s 检查（EIP-2 要求 s ≤ n/2，避免签名延展性）
    SECP256K1_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
    half_n = SECP256K1_N // 2
    assert s <= half_n, "s 不在低位区间，需做 s = n - s 规范化"
    print("\nlow-s 检查通过 (EIP-2)")

    # 6) 把 (r,s,v) 转为 EIP-2098 紧凑签名 (64 字节: r ‖ yParityAndS)
    y_parity = v - 27 if v in (27, 28) else v  # eth-keys 的 v 已经是 0/1
    y_parity_and_s = (y_parity << 255) | s
    compact = r.to_bytes(32, "big") + y_parity_and_s.to_bytes(32, "big")
    assert len(compact) == 64
    print(f"EIP-2098 紧凑签名 (64B): 0x{compact.hex()}")


if __name__ == "__main__":
    main()
