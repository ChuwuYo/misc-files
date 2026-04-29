# Demo 3：用 EZKL 把 Logistic 回归塞进 ZK 证明

> 配合主 README §8 阅读。
>
> 文档版本：v1.0 · 最后更新 2026-04-27

## 目标

把一个 4 维输入、1 维输出的二分类逻辑回归模型变成 ZK 电路；生成 Solidity verifier；在 Foundry 中链上验证 proof。

## 前置依赖

```bash
# Python
python -m venv .venv && source .venv/bin/activate
pip install ezkl scikit-learn onnx onnxruntime numpy

# EZKL CLI
curl https://raw.githubusercontent.com/zkonduit/ezkl/main/install_ezkl_cli.sh | bash

# Foundry（同 demo 1）
```

## 步骤 1：训练并导出 ONNX（`train.py`）

```python
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.datasets import make_classification
import torch
import torch.nn as nn

X, y = make_classification(n_samples=1000, n_features=4, n_informative=3, random_state=42)
clf = LogisticRegression().fit(X, y)

class Wrap(nn.Module):
    def __init__(self, w, b):
        super().__init__()
        self.lin = nn.Linear(4, 1)
        with torch.no_grad():
            self.lin.weight.copy_(torch.tensor(w, dtype=torch.float32))
            self.lin.bias.copy_(torch.tensor(b, dtype=torch.float32))
    def forward(self, x):
        return torch.sigmoid(self.lin(x))

m = Wrap(clf.coef_, clf.intercept_)
m.eval()
dummy = torch.randn(1, 4)
torch.onnx.export(m, dummy, 'model.onnx', input_names=['x'], output_names=['y'], opset_version=11)

# 准备一组 input.json 给 ezkl
import json
sample = X[0].tolist()
json.dump({'input_data': [sample]}, open('input.json', 'w'))
```

## 步骤 2：EZKL 流水线

```bash
# 1) 生成默认 settings
ezkl gen-settings -M model.onnx --settings-path settings.json

# 2) 校准设置（根据你的输入分布）
ezkl calibrate-settings -M model.onnx -D input.json --settings-path settings.json

# 3) 编译电路
ezkl compile-circuit -M model.onnx --settings-path settings.json --compiled-circuit network.compiled

# 4) 下载 SRS（结构化参考字符串，KZG 公共参数）
ezkl get-srs --settings-path settings.json

# 5) Setup
ezkl setup -M network.compiled --vk-path vk.key --pk-path pk.key

# 6) 生成 witness
ezkl gen-witness -D input.json -M network.compiled --output witness.json

# 7) Prove
ezkl prove --witness witness.json -M network.compiled --pk-path pk.key --proof-path proof.json

# 8) 验证（链下）
ezkl verify --proof-path proof.json --vk-path vk.key --settings-path settings.json

# 9) 生成 EVM Verifier
ezkl create-evm-verifier --vk-path vk.key --sol-code-path Verifier.sol --abi-path Verifier.abi
```

## 步骤 3：Foundry 测试（`test/Verifier.t.sol`）

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/Verifier.sol";

contract VerifierTest is Test {
    Halo2Verifier verifier;

    function setUp() public {
        verifier = new Halo2Verifier();
    }

    function testVerifyProof() public {
        // proof.json 由 step 7 ezkl prove 输出；其中 hex/instances 字段需要从 JSON 解出
        // 简化起见，这里假设你已用工具把 proof bytes 与 instances 提取为以下两个文件
        bytes memory proof = vm.parseBytes(vm.readFile("proof.bin"));
        uint256[] memory inst = vm.parseJsonUintArray(vm.readFile("instances.json"), "$");
        bool ok = verifier.verifyProof(proof, inst);
        assertTrue(ok);
    }
}
```

## 数据点记录模板

跑完一遍记下：

| 指标                | 数值 |
| ------------------- | ---- |
| `setup` 用时        |      |
| `prove` 用时        |      |
| proof 字节数        |      |
| verifier gas（一次） |      |
| 内存峰值            |      |

把这些发到团队 wiki，下次选型 zkML 时不会被营销话术误导。

## 注意

- 输入要离散化到固定小数位（fixed-point），ONNX float 不能直接进电路；
- 第一次 setup 要下几十 MB 的 SRS；
- proof 字节较大（几 KB），链上 verifier gas 高（百万级），适合**低频高价值**场景。

## 进阶

- 把 logistic regression 换成小 CNN，跑一遍 §10.3 练习里的 MNIST；
- 对比 Lagrange DeepProve 的同模型 benchmark，看自己机器是否能复现"54-158× 加速"。
