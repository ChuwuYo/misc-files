# 练习 3：用 EZKL 证明一个 MNIST 推理

> 主 README §10.3
>
> 目的：让你**亲手**记下 zkML 的 setup/prove/verifier gas 数据点。

## 任务

1. 训练一个小 CNN（< 1M 参数）做 MNIST 分类（参考代码：[zkonduit/ezkl-examples](https://github.com/zkonduit/ezkl)）；
2. 导出 ONNX → EZKL 流水线 → 生成 EVM Verifier；
3. 在 Foundry 中验证 proof；
4. 记录每步耗时、proof size、verifier gas。

## 数据点表（必填）

```
模型参数量：________
训练精度：________
EZKL setup 用时：________
EZKL prove 用时：________
proof 字节数：________
Solidity verifier 部署 gas：________
verifier verifyProof 调用 gas：________
峰值 RAM：________
```

## 对比题（思考）

把你测到的数据点跟主 README §3.1.3 表格里 EZKL 的官方 benchmark 对比：

- 哪些指标接近？哪些差距大？
- 差距主要来自什么（CPU/GPU、内存、模型规模、calibration 设置）？
- 如果换成 Lagrange DeepProve 跑同一个 MNIST CNN，根据他们公开的 521× CNN 验证加速，你预期会快多少？亲自跑一遍验证。

## 进阶

- 把 MNIST 换成"链上信用评分"小模型：4-5 个特征、二分类；
- 评估这个用 EZKL 上链是否经济：单次 verify 100-200 万 gas、在 mainnet 大约多少美元？
- 跟"中心化预言机 + 模型 hash 公开"做经济对比。
