"""
02 Keccak-256 vs SHA3-256，并演示与 Solidity keccak256(abi.encodePacked(...)) 一致

依赖:
    pip install pycryptodome==3.20.0 eth-utils==4.1.1

要点:
    - Ethereum 用的是 "原始 Keccak"（Keccak[r=1088,c=512]，pad10*1，分隔字节 0x01）
    - FIPS-202 SHA3-256 在原文末尾追加 0x06 分隔字节，导致同输入输出不同
    - pycryptodome 中 Crypto.Hash.keccak 才是以太坊用的 Keccak；hashlib.sha3_256 不是

权威参考:
    - FIPS 202: https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf
    - pycryptodome: https://www.pycryptodome.org/src/hash/keccak
    - SHA-3 维基:   https://en.wikipedia.org/wiki/SHA-3
"""

from __future__ import annotations

import hashlib

from Crypto.Hash import keccak as pyc_keccak
from eth_utils import keccak as eth_keccak


def keccak256(data: bytes) -> bytes:
    """以太坊风格 Keccak-256（pycryptodome 实现）。"""
    h = pyc_keccak.new(digest_bits=256)
    h.update(data)
    return h.digest()


def main() -> None:
    msg = b"abc"

    k = keccak256(msg)
    s = hashlib.sha3_256(msg).digest()
    print(f"Keccak-256('abc') = 0x{k.hex()}")
    print(f"SHA3-256  ('abc') = 0x{s.hex()}")
    assert k != s, "Keccak 与 SHA3 应不同 (分隔字节 0x01 vs 0x06)"

    # 与 eth-utils 实现交叉验证
    assert k == eth_keccak(msg), "pycryptodome Keccak 与 eth-utils 必须一致"

    # 演示 Solidity 的 abi.encodePacked(uint256, address) 拼接规则
    # uint256 -> 32 字节大端；address -> 20 字节
    value = 12345
    addr = bytes.fromhex("d8dA6BF26964aF9D7eEd9e03E53415D37aA96045")  # vitalik.eth
    packed = value.to_bytes(32, "big") + addr
    digest = keccak256(packed)
    print(f"\nabi.encodePacked(uint256(12345), address(0xd8dA..)) 哈希 =")
    print(f"  0x{digest.hex()}")
    print("Solidity 中: keccak256(abi.encodePacked(uint256(12345), addr)) 应得相同结果")

    # 注意：abi.encodePacked 对动态类型存在哈希冲突风险 (string+string)
    # 若用 abi.encode（每个参数 32 字节填充）则没有此问题
    a = b"a"
    b = b"bc"
    p1 = keccak256(a + b)
    p2 = keccak256(b"ab" + b"c")
    print(f"\nabi.encodePacked 冲突演示: 'a'+'bc' 与 'ab'+'c' 哈希相同?  {p1 == p2}")


if __name__ == "__main__":
    main()
