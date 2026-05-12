# 第 09 章 · 主流神经网络架构：CNN / RNN / Transformer

> **章首钩子**：上一章你已经能把神经网络当通用函数拟合器用了。但如果直接把一张 224×224 的图拍平丢进 MLP，第一层权重就 1.5 亿——还没训练就先爆显存。这一章讲的是**三种"特殊形状的神经网络"**：CNN 让模型懂"图像有空间"，RNN 让模型懂"序列有先后"，Transformer 把这些先验都扔掉、用"全局两两看一遍 + 海量数据"压倒一切。读懂这三个，2026 年所有 LLM、VLM、扩散模型你都能看懂主干。
>
> **本章可以分两次读**（强烈建议小白这么读）：
>
> - **第一遍：只看概念图，跳过所有代码**。重点读 §1（归纳偏置）、§2.1-§2.3（CNN 思想，跳 §2.4 代码）、§3.1-§3.5（RNN 思想，跳 §3.6 代码）、§4-§8（Transformer 总览/Q-K-V/位置编码/归一化/三种变体）、§13（场景速查表）。这条路径约 1 万字，目标是建立"看到 Transformer 论文图能认出零件"的能力。
> - **第二遍：动手抄代码**。回头读 §2.4（ResNet block）、§3.6（LSTM cell）、§9（200 行迷你 Transformer）、§10（CharGPT 莎翁 demo）。**§9 是本章最硬的一节**，第一次读一定懵；先跑通 §10 的莎翁 demo 建立"我能让它跑"的成就感，再回头抠 §9 细节。
> - **完全不想自己写 Transformer**：只读第一遍路径 + §11（效率优化速查）+ §13（场景速查），跳过 §9 §10 §12，仍然能在团队里跟人聊架构、看懂别人的代码。

> **本章面向已经读完前八章基础的读者**。如果你能用 PyTorch 写一个 MLP、做反向传播、跑 MNIST 收敛，那这一章就是该读的内容。
>
> 三种架构按重要性排序是 **Transformer ≫ CNN > RNN**。Transformer 占本章 50% 篇幅，因为 2026 年的 LLM、VLM、扩散模型主干、语音模型、甚至大部分时序预测模型，背后都是它的变种。CNN 仍然是视觉任务的硬通货，理解它能让你看懂 ResNet、ConvNeXt、UNet。RNN 在生产中已经被替代得差不多，但它的建模思想（隐状态、时间展开、门控）在 Mamba、RWKV、RetNet 这一波"线性 RNN 复兴"里又活过来了，必须懂。
>
> **一句话定位三者**：CNN 用"局部权重共享 + 平移不变"压榨视觉先验；RNN 用"隐状态沿时间轴递推"压榨序列先验；Transformer 把先验全扔了，用"全局两两交互 + 位置编码"换来无限扩展。

时间锚点 2026-05：Transformer 仍然是 LLM 主流，Llama 4、GPT-5、Claude 4.5 全是 Decoder-only Transformer + MoE + GQA。Mamba-2、RWKV-7、RetNet 等线性 RNN 已在中等规模（7B 以下）展现出可与 Transformer 对标的语言建模能力，但旗舰模型还没人敢做纯 SSM。Flash Attention 3 是 H100 上 attention 的事实标准，FA-2 在 A100 上仍是主流。

前置：[第 08 章 · 神经网络与 PyTorch 基础](./08-神经网络与PyTorch基础.md)。后置：[第 10 章 · 训练技巧、正则化与分布式训练](./10-训练技巧与分布式.md)。

## 目录

### 主线（第一遍只读这里）

- [0 学习目标](#0-学习目标)
- [1 三种架构的归纳偏置](#1-三种架构的归纳偏置)
- [2 CNN：视觉任务的脊梁](#2-cnn视觉任务的脊梁)
- [3 RNN / LSTM / GRU：被替代但思想还在](#3-rnn--lstm--gru被替代但思想还在)
- [4 Transformer 总览：六个零件](#4-transformer-总览六个零件)
- [5 自注意力的数学](#5-自注意力的数学)
- [6 位置编码：从 sin/cos 到 RoPE 与 ALiBi](#6-位置编码从-sincos-到-rope-与-alibi)
- [7 归一化与残差：Pre-LN、RMSNorm](#7-归一化与残差pre-lnrmsnorm)
- [8 三种 Transformer 变体](#8-三种-transformer-变体)
- [9 从零实现一个迷你 Transformer](#9-从零实现一个迷你-transformer)
- [10 用迷你 Transformer 跑字符级语言模型](#10-用迷你-transformer-跑字符级语言模型)
- [11 效率优化：Flash Attention、KV Cache、GQA、滑窗](#11-效率优化flash-attentionkv-cachegqa滑窗)
- [12 新兴架构：Mamba 与 MoE](#12-新兴架构mamba-与-moe)
- [13 怎么选：场景到架构的速查表](#13-怎么选场景到架构的速查表)
- [14 习题（含答案）](#14-习题含答案)
- [15 延伸阅读](#15-延伸阅读)

### 附录

- [附录 A. 一张图看懂参数量增长](#附录-a-一张图看懂参数量增长)
- [附录 B. 怎么读架构论文](#附录-b-怎么读架构论文)

---

## 0 学习目标

读完这一章，你应该能：

1. 白板画出 CNN / RNN / Transformer 各自的一个 block，标出参数量和 FLOPs 随输入规模的增长曲线。
2. 不查文档手写一个 ResNet basic block 和一个 LSTM cell。
3. 不调 `nn.Transformer`，从零实现一个能跑通的 Transformer Encoder + Decoder（约 200 行 PyTorch）。
4. 解释 Q/K/V 在物理上分别"代表什么"，为什么要除以 $\sqrt{d_k}$，为什么要 multi-head。
5. 讲清 RoPE 与绝对位置编码、ALiBi 的差异，以及为什么 Llama 选 RoPE。
6. 估算一个 7B Decoder-only 模型在 batch=1、context=8K 时的 KV Cache 显存。
7. 说出 Mamba、RWKV、MoE 三者各自解决 Transformer 的什么瓶颈。

---

## 1 三种架构的归纳偏置

### 1.1 什么是归纳偏置

任何模型都不是从零归纳，它都假设了"这个世界长什么样"。这种假设就是 **归纳偏置（inductive bias）**。MLP 的偏置最弱：除了"层级组合"几乎啥都不假设，于是它对大部分结构化数据拟合得一般，必须靠堆数据去填。CNN、RNN、Transformer 各自往这个空旷的 MLP 上添了不同的"先验"。

| 架构 | 假设 | 受益的数据 |
|---|---|---|
| MLP | 输入维度之间任意可交互 | 表格、特征向量 |
| CNN | 局部相关、平移不变、空间层级 | 图像、音频频谱、网格状传感器 |
| RNN | 时间因果、马尔可夫式状态压缩 | 一维序列、流式数据 |
| Transformer | 全局两两交互（无空间/时间先验） | 万物，但需要规模 |

注意 Transformer 那一格写的是"无空间/时间先验"。它不假设近邻更相关、不假设过去比未来重要，所有 token 一开始都是平等的。这既是它的优势——任何数据都能往里塞——又是它的代价：必须靠位置编码补回先验，必须靠海量数据学回那些 CNN/RNN 白送的"近邻相关"。

### 1.2 偏置-数据曲线

一句话总结业界过去十年的经验：

> **数据量小，强偏置赢；数据量大，弱偏置赢。**

ImageNet 1.3M 张图，CNN 长期碾压 ViT；JFT-300M 三亿张图，ViT 反过来碾压 CNN。语言任务上 LSTM 在百 MB 级数据上能打过早期 Transformer，到了万亿 token 没人提 LSTM 了。

这条规律解释了为什么 Transformer 的胜利是和"互联网爆炸 + GPU 涌现"绑在一起的。它不是更聪明，它只是更愿意吃数据，而 2017 年之后我们突然有数据可吃。

### 1.3 三种结构的复杂度对比

设序列长度 $N$、特征维度 $d$。

| 结构 | 训练时单层时间 | 训练时单层显存 | 推理 per-token | 训练并行度 |
|---|---|---|---|---|
| CNN（kernel=k） | $O(N \cdot k \cdot d^2)$ | $O(N \cdot d)$ | $O(k \cdot d^2)$ | 完全并行 |
| RNN | $O(N \cdot d^2)$ | $O(N \cdot d)$ | $O(d^2)$ | 沿 $N$ 串行 |
| Transformer self-attn | $O(N^2 \cdot d)$ | $O(N^2)$ | $O(N \cdot d)$（带 KV Cache） | 完全并行 |
| Mamba/SSM | $O(N \cdot d^2)$ | $O(N \cdot d)$ | $O(d^2)$ | prefix scan，准并行 |

关键观察：

- **Transformer 是这四个里训练最贵的**，$N^2$ 那一项让长上下文成本暴涨。一段 32K 上下文的 attention 矩阵一头就吃掉好几 GB。
- **Transformer 推理却最适合并行**，因为训练阶段每一步都看得到全局，可以用 teacher forcing 一步并行算完所有位置；RNN 必须串行，训练慢。
- **Mamba / RNN 推理是常数复杂度**（不依赖历史长度），这是它们在长上下文场景的主要优势。
- **CNN 的训练 / 推理都极度并行**，加上有 cuDNN 这种近 30 年优化的 kernel，跑视觉任务效率极高。

理解这张表，你就能预判未来。短上下文（< 4K）Transformer 没有被替代的压力；超长上下文（> 100K）Mamba 类一定会蚕食市场。

### 1.4 一条贯穿全章的隐线：信息流的拓扑

回头看，三种架构其实是在画**不同的计算图拓扑**：

- **CNN**：每个输出像素只连接局部窗口的输入像素，是一张稀疏、有空间结构的图。
- **RNN**：每个时刻的输出是一条沿时间链向前的链式依赖图。
- **Transformer**：每两个 token 之间都有一条边，是一张完全连通图。

层数越深，CNN 的有效感受野越大、RNN 的有效记忆窗口越深、Transformer 则在第一层就已经全连通——这就是 Transformer 训练样本利用率高、但首层注意力难学到正确 pattern（因为初始化下注意力近乎均匀）的根本原因。

把这条隐线握住，你后面读到的所有"高效 Transformer"（Longformer、BigBird、Sparse Transformer、Linear Attention）都是在**有结构地稀疏化这张完全图**——给某些边加权重、砍掉另一些。它们和 CNN/RNN 之间是连续光谱，不是离散类别。

---

## 2 CNN：视觉任务的脊梁

### 2.1 为什么图像不能直接喂 MLP

把一张 224×224×3 的图片拉平，是 150,528 维输入。第一层 MLP 哪怕只有 1024 个神经元，权重就 1.5 亿。还没训练你就先 OOM 了。更要命的是，MLP 学不会"图片左上角的猫和右下角的猫是同一只猫"这种平移不变性——它会把同一个特征在每个位置各学一遍。

CNN 的两个核心想法回答了这两个问题：

1. **权重共享**：同一组卷积核滑过整张图，等价于在每个位置应用同一个特征检测器。参数量从 $O(H \cdot W \cdot C_{in} \cdot C_{out})$ 砍到 $O(k^2 \cdot C_{in} \cdot C_{out})$，砍掉两到三个数量级。
2. **局部连接**：每个输出像素只看输入的一个小窗口（kernel × kernel）。这强行把"近邻像素更相关"的先验灌进来。

### 2.2 卷积、池化、感受野

**卷积（convolution）** 在 CV 里其实是 cross-correlation。给定输入 $x \in \mathbb{R}^{H \times W \times C_{in}}$ 和核 $w \in \mathbb{R}^{k \times k \times C_{in} \times C_{out}}$：

$$y_{i,j,o} = \sum_{p=0}^{k-1}\sum_{q=0}^{k-1}\sum_{c=0}^{C_{in}-1} w_{p,q,c,o} \cdot x_{i+p, j+q, c} + b_o$$

stride 控制滑动步长，padding 控制是否在边缘补零。一个 $3\times 3$、stride=1、padding=1 的卷积保持空间尺寸不变。

**池化（pooling）** 把空间分辨率降下来。MaxPool 在每个 $2\times 2$ 窗口取最大值，AvgPool 取均值。池化让网络在空间上抽象——细粒度像素 → 粗粒度物体。现代设计里 MaxPool 部分被 stride=2 的卷积替代，因为后者可学习。

**感受野（receptive field）** 是输出特征图上一个像素能"看到"的输入区域。它随着层数指数级扩大：堆 $L$ 层 $3\times 3$ 卷积，感受野是 $2L+1$。VGG-19 的最深层感受野约 200×200，刚好覆盖一张 224×224 图。

| 操作 | 参数量 | FLOPs | 输出尺寸 |
|---|---|---|---|
| Conv $k\times k$，stride=1，padding=`same` | $k^2 C_{in} C_{out}$ | $H W k^2 C_{in} C_{out}$ | $H \times W \times C_{out}$ |
| MaxPool $2\times 2$, stride=2 | 0 | $H W$ | $H/2 \times W/2 \times C_{in}$ |
| BatchNorm | $2 C$ | $H W C$ | 不变 |
| ReLU | 0 | $H W C$ | 不变 |

### 2.3 经典演化：LeNet → AlexNet → VGG → ResNet → EfficientNet

**LeNet-5**（LeCun, 1998）。手写数字识别，5 层（2 conv + 3 fc），约 6 万参数。它定义了"卷积 → 池化 → 卷积 → 池化 → 全连接"的范式，30 年没本质变过。

**AlexNet**（Krizhevsky, 2012）。8 层，6000 万参数。把 ImageNet 错误率从 26% 砍到 15%，开启深度学习时代。三个创新：ReLU 替代 sigmoid（解决梯度消失）、Dropout（缓解过拟合）、GPU 训练（首次真正用上 CUDA）。

**VGG**（Simonyan, 2014）。一个朴素观察：堆很多个 $3\times 3$ 卷积，比少量大 kernel 更好。两个 $3\times 3$ 的感受野等于一个 $5\times 5$，但参数量从 $25 C^2$ 降到 $18 C^2$，且多了一层非线性。VGG-16/19 至今是 perceptual loss、特征提取的基线选手。

**ResNet**（He, 2015）。深度突破到 152 层。核心是残差连接：

$$y = F(x) + x$$

让网络学习"修正项 $F(x)$"而不是"完整映射 $H(x)$"。直觉：当最优解接近恒等映射时，$F(x) \to 0$ 比 $H(x) \to x$ 好优化得多。残差连接还提供了一条让梯度无衰减回流的直连通道，这是训练 100+ 层网络的前提。**残差思想后来被 Transformer 全盘继承**，每个 attention 块和 FFN 块都包了残差。

**EfficientNet**（Tan, 2019）。提出复合缩放：网络深度、宽度、输入分辨率三者按一个固定比例同步放大，而不是只放大一项。EfficientNet-B7 在参数量是 ResNet-152 1/8 的情况下精度更高。这种"协同缩放"思想直接预告了后来 LLM 的 Chinchilla 缩放定律。

**ConvNeXt**（Liu, 2022）。CNN 的反击。它把 ViT 的所有"现代化"设计（大 kernel、LayerNorm、GELU、倒置瓶颈、深度可分离卷积）搬回 ResNet，结果在 ImageNet 上反超同规模 ViT。**ConvNeXt 证明：架构差异远没大家想象的大，2010s 末流行的"transformer 优越论"很大程度上是训练 trick 优越论**。2026 年的视觉任务里，ConvNeXt-V2 仍然是和 ViT 并列的两大主流主干。

**ConvNeXt 的具体变更清单**（值得抄进笔记）：

1. stage compute ratio 从 (3, 4, 6, 3) 调成 (3, 3, 9, 3)，向 Swin Transformer 看齐。
2. 把首层 7×7 conv stride 2 改成 4×4 conv stride 4，做 patchify-style 输入。
3. 深度卷积（depthwise conv）：把空间和通道维度的卷积分开做。
4. 倒置瓶颈：先升维 4×、再点卷积、再降回原维度——和 Transformer FFN 形状一致。
5. 大 kernel（7×7 depthwise）：感受野更大、参数仍然可控。
6. 把 ReLU 换 GELU、BN 换 LN、激活只放一处、归一化只放一处。

每一条单独看都是小改动，凑起来就是 +6 个点的 ImageNet。这种"现代化清单"思想在 2024 年的 RWKV-7、Mamba-2 论文里也能看到——架构进步常常是若干小调优的合力，不是一次大顿悟。

### 2.4 PyTorch 实现 ResNet basic block

```python
import torch
import torch.nn as nn

class BasicBlock(nn.Module):
    """ResNet-18/34 用的 basic block。
    两个 3x3 卷积 + 一条残差连接。
    若 stride>1 或 in_planes != planes，残差连接需要 1x1 投影。
    """
    expansion = 1  # ResNet-50+ 的 Bottleneck 这里是 4

    def __init__(self, in_planes: int, planes: int, stride: int = 1):
        super().__init__()
        self.conv1 = nn.Conv2d(
            in_planes, planes, kernel_size=3,
            stride=stride, padding=1, bias=False,
        )
        self.bn1 = nn.BatchNorm2d(planes)
        self.conv2 = nn.Conv2d(
            planes, planes, kernel_size=3,
            stride=1, padding=1, bias=False,
        )
        self.bn2 = nn.BatchNorm2d(planes)

        # shortcut：恒等映射，必要时投影
        if stride != 1 or in_planes != planes * self.expansion:
            self.shortcut = nn.Sequential(
                nn.Conv2d(
                    in_planes, planes * self.expansion,
                    kernel_size=1, stride=stride, bias=False,
                ),
                nn.BatchNorm2d(planes * self.expansion),
            )
        else:
            self.shortcut = nn.Identity()

        self.relu = nn.ReLU(inplace=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        identity = self.shortcut(x)
        out = self.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        out = out + identity        # 这一行是残差核心
        return self.relu(out)


class ResNet18(nn.Module):
    def __init__(self, num_classes: int = 1000):
        super().__init__()
        self.stem = nn.Sequential(
            nn.Conv2d(3, 64, 7, stride=2, padding=3, bias=False),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(3, stride=2, padding=1),
        )
        self.layer1 = self._make_layer(64,  64,  2, stride=1)
        self.layer2 = self._make_layer(64,  128, 2, stride=2)
        self.layer3 = self._make_layer(128, 256, 2, stride=2)
        self.layer4 = self._make_layer(256, 512, 2, stride=2)
        self.pool = nn.AdaptiveAvgPool2d(1)
        self.fc = nn.Linear(512, num_classes)

    def _make_layer(self, in_planes, planes, blocks, stride):
        layers = [BasicBlock(in_planes, planes, stride)]
        for _ in range(1, blocks):
            layers.append(BasicBlock(planes, planes, 1))
        return nn.Sequential(*layers)

    def forward(self, x):
        x = self.stem(x)
        x = self.layer1(x); x = self.layer2(x)
        x = self.layer3(x); x = self.layer4(x)
        x = self.pool(x).flatten(1)
        return self.fc(x)
```

跑一下 sanity check：

```python
model = ResNet18(num_classes=1000)
x = torch.randn(2, 3, 224, 224)
y = model(x)
print(y.shape)                      # torch.Size([2, 1000])
print(sum(p.numel() for p in model.parameters()))   # 11689512
```

1170 万参数，这是 ResNet-18 的标准答案。把 BasicBlock 换成 Bottleneck（1×1 → 3×3 → 1×1，expansion=4）就是 ResNet-50。

### 2.5 BatchNorm 的工程麻烦

CNN 训练几乎一定带 BatchNorm，但它有一组令人头大的工程性质，必须心里有数：

- **训推不一致**：训练时用当前 batch 的均值方差，推理时用整个训练过程的滑动平均（running mean/var）。这意味着 `model.eval()` 和 `model.train()` 切换时，BN 的行为完全不同——一个常见 bug 是在验证集忘了 `eval()`，结果验证 loss 莫名其妙地比训练 loss 还低（因为用了当前 batch 的统计）。
- **小 batch 退化**：batch 太小（< 8）时，统计估计不稳，模型崩。检测、分割任务 batch 通常很小（高分辨率图片塞不下），所以这些任务往往用 GroupNorm 或 LayerNorm 替代。
- **多机训练同步开销**：每个 forward 步要做 all-reduce 同步均值方差（SyncBN），这是分布式训练的常见瓶颈之一。
- **微调不友好**：从预训练模型继续训练时，BN 的 running stats 会被新数据慢慢污染。常用 trick 是 freeze BN（`bn.eval()`）。

正是这些麻烦，让 LayerNorm / RMSNorm 在 Transformer 时代成为更优雅的默认选择——它们对 batch size 不敏感、训推完全一致、不需要 SyncBN。

### 2.6 现代 CV 主干的选择

2026 年做新视觉项目，主干选型大致按下表来：

| 场景 | 推荐 |
|---|---|
| 移动端实时推理 | MobileNetV3 / EfficientNet-Lite |
| 中等算力 + 小数据 | ConvNeXt-V2-Tiny |
| 大数据 + 大算力 | ViT-L/14 + DINOv3 自监督预训练权重 |
| 检测分割 | ConvNeXt + Cascade Mask R-CNN，或 ViT-Adapter |
| 多模态对齐 | SigLIP-2 / DINOv3 + LLM |

不要默认 ViT。Conv 在数据量 < 10M 时往往更稳。

### 2.7 一个常被忽略的细节：CNN 的"参数共享"是它最贵的代价

CNN 的权重共享给了它平移不变性，也给了它最致命的弱点：**它假设特征对位置不敏感**。但在很多任务里这假设不成立——人脸识别里眼睛在上、嘴在下；自动驾驶里地平线在中间、天空在上；卫星图里上下颠倒会改变语义。CNN 必须靠堆更多层、更大感受野、再加 self-attention 等机制来曲线救国。ViT 反过来用绝对位置 embedding 直接编码"哪块 patch 在哪里"，把"位置敏感性"作为一等公民写进架构——代价是它得自己学"近邻 patch 应该相关"，但学到之后能更灵活地表示长程依赖。

这条权衡线在 2026 年还没结束。Hybrid 网络（CoAtNet、MaxViT、MobileViT）把卷积和注意力堆叠，在中等规模数据上往往打过两端单选。

---

## 3 RNN / LSTM / GRU：被替代但思想还在

### 3.1 序列建模的动机

文本、语音、时序传感器、股价——所有按时间排成一排的数据，共同特点是**当前依赖过去**，且**长度可变**。MLP 处理不了变长输入；CNN 能处理（一维卷积），但局部窗口看不远。

RNN 的设计极简：维护一个隐状态 $h_t$，每来一个输入 $x_t$，把它和 $h_{t-1}$ 一起送进同一组权重，得到新的 $h_t$ 和输出 $y_t$。

$$h_t = \tanh(W_{xh} x_t + W_{hh} h_{t-1} + b_h)$$
$$y_t = W_{hy} h_t + b_y$$

这种"沿时间展开 + 权重共享"的形式是 RNN 的全部精髓。注意它和 CNN 的对偶：CNN 沿空间共享权重，RNN 沿时间共享权重。

### 3.2 梯度消失与爆炸

把 RNN 沿时间展开 $T$ 步做反向传播（BPTT），梯度会经过 $W_{hh}$ 矩阵 $T$ 次相乘。设 $W_{hh}$ 的最大奇异值为 $\sigma$：

- $\sigma > 1$：梯度爆炸，loss 变 NaN。
- $\sigma < 1$：梯度指数衰减，长程信号传不回去，模型只学得到最近几步的依赖。
- $\sigma = 1$：理论上是好的，实践中难以稳定维持。

**梯度爆炸**好治：clip gradient norm 到 1.0 即可。**梯度消失**难治，它本质是"长程信号在长期相乘里被压成 0"。LSTM 是 1997 年给出的解药。

### 3.3 LSTM：用门控保留长期信号

LSTM（Long Short-Term Memory）在隐状态 $h_t$ 之外，加了一条 **细胞状态 $c_t$**，并通过三个 sigmoid 门控制信息流：

$$\begin{aligned}
f_t &= \sigma(W_f \cdot [h_{t-1}, x_t] + b_f) \quad &\text{遗忘门} \\
i_t &= \sigma(W_i \cdot [h_{t-1}, x_t] + b_i) \quad &\text{输入门} \\
\tilde{c}_t &= \tanh(W_c \cdot [h_{t-1}, x_t] + b_c) \quad &\text{候选} \\
c_t &= f_t \odot c_{t-1} + i_t \odot \tilde{c}_t \quad &\text{细胞更新} \\
o_t &= \sigma(W_o \cdot [h_{t-1}, x_t] + b_o) \quad &\text{输出门} \\
h_t &= o_t \odot \tanh(c_t)
\end{aligned}$$

关键的式子是 $c_t = f_t \odot c_{t-1} + i_t \odot \tilde{c}_t$。当 $f_t \approx 1$、$i_t \approx 0$ 时，$c_t \approx c_{t-1}$——细胞状态几乎原样传递，梯度也就近乎无衰减地流回去。这条 **加法路径** 是 LSTM 抗梯度消失的命门，和 ResNet 的残差连接、Transformer 的 skip connection 在精神上是同一件事。

### 3.4 GRU：LSTM 的精简版

GRU（Gated Recurrent Unit）把 LSTM 的三门压成两门，把 $h$ 和 $c$ 合并：

$$\begin{aligned}
r_t &= \sigma(W_r \cdot [h_{t-1}, x_t]) \quad &\text{重置门} \\
z_t &= \sigma(W_z \cdot [h_{t-1}, x_t]) \quad &\text{更新门} \\
\tilde{h}_t &= \tanh(W \cdot [r_t \odot h_{t-1}, x_t]) \\
h_t &= (1-z_t) \odot h_{t-1} + z_t \odot \tilde{h}_t
\end{aligned}$$

参数量比 LSTM 少约 1/4，效果在大多数任务上接近持平，训练更快。当时业界关于"用 LSTM 还是 GRU"的争论持续了五六年，最后被 Transformer 一刀终结——不重要了。

### 3.5 双向 RNN

只看过去，叫单向 RNN，适合自回归生成。看完整序列后再判断每个位置的标签，叫双向 RNN（Bi-RNN）：跑两条独立的 RNN，一条正向、一条反向，把两个隐状态拼起来。BERT 之前的 NLP 老牌选手 ELMo 就是 BiLSTM。

### 3.6 教学实现：手写一个 LSTM cell

```python
import torch
import torch.nn as nn

class LSTMCell(nn.Module):
    """从零实现的 LSTM cell，便于教学。
    实战请用 nn.LSTM——它有 cuDNN 优化。"""
    def __init__(self, input_size: int, hidden_size: int):
        super().__init__()
        self.input_size = input_size
        self.hidden_size = hidden_size
        # 把四个门的权重合并成一个矩阵，一次 matmul 出 4*H 维
        self.W_ih = nn.Parameter(torch.empty(4 * hidden_size, input_size))
        self.W_hh = nn.Parameter(torch.empty(4 * hidden_size, hidden_size))
        self.b_ih = nn.Parameter(torch.zeros(4 * hidden_size))
        self.b_hh = nn.Parameter(torch.zeros(4 * hidden_size))
        nn.init.xavier_uniform_(self.W_ih)
        nn.init.orthogonal_(self.W_hh)
        # forget gate bias 初始化为 1，是个老传统：让初始时尽量保留历史
        with torch.no_grad():
            self.b_ih[hidden_size:2*hidden_size].fill_(1.0)

    def forward(self, x, state):
        h_prev, c_prev = state                                  # (B, H), (B, H)
        gates = x @ self.W_ih.T + self.b_ih + h_prev @ self.W_hh.T + self.b_hh
        i, f, g, o = gates.chunk(4, dim=-1)                     # 切成四份
        i = torch.sigmoid(i); f = torch.sigmoid(f)
        g = torch.tanh(g);    o = torch.sigmoid(o)
        c = f * c_prev + i * g
        h = o * torch.tanh(c)
        return h, (h, c)


class CharLSTM(nn.Module):
    """字符级 LSTM 语言模型。"""
    def __init__(self, vocab_size, embed_dim=128, hidden_size=256):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim)
        self.cell = LSTMCell(embed_dim, hidden_size)
        self.head = nn.Linear(hidden_size, vocab_size)
        self.hidden_size = hidden_size

    def forward(self, x):                                       # x: (B, T)
        B, T = x.shape
        h = x.new_zeros(B, self.hidden_size, dtype=torch.float)
        c = x.new_zeros(B, self.hidden_size, dtype=torch.float)
        emb = self.embed(x)                                     # (B, T, E)
        outs = []
        for t in range(T):
            h, (h, c) = self.cell(emb[:, t], (h, c))
            outs.append(h)
        out = torch.stack(outs, dim=1)                          # (B, T, H)
        return self.head(out)                                   # (B, T, V)
```

注意 `for t in range(T)` 那行——RNN 训练慢的本质就在这里，没法并行。Transformer 训练时 $T$ 个时刻全在一次 matmul 里同时算完，这是它在 GPU 上压倒 RNN 的根本原因。

### 3.7 RNN 的训练现实：truncated BPTT 与教师强制

朴素 BPTT 把整段序列展开做反向传播。但 100K 长度的文本完全展开不可能：显存爆炸。实战用 **truncated BPTT**：每隔 $K$ 步（典型 $K=128$）切一刀，把当前隐状态 detach 后继续往下走。代价是模型只能学到 $K$ 步以内的依赖，超过这个长度的信号梯度被截断。LSTM 把可学习窗口从 RNN 的几十步推到几百步，但要让它学到几千步依赖很难——这是 RNN 在长上下文上不如 Transformer 的本质原因之一。

**Teacher Forcing**：训练序列生成时，每步把"真实的上一个 token"喂进去，而不是用模型自己上一步的输出。这样训练梯度稳、收敛快，但带来 **exposure bias**：推理时模型看到的是自己的输出（可能是错的），训练时看到的是真值，分布不匹配会让错误像滚雪球。Scheduled Sampling、Reinforcement Learning 都是缓解这个问题的传统方案。Transformer 训练同样用 teacher forcing，只是因为它是 next-token prediction 框架，exposure bias 仍然存在，但实践中影响相对小。

### 3.8 现实：2026 年 RNN 的位置

到 2026 年，纯 RNN 在工业界基本只剩三个角落：

1. **极端实时低算力场景**：助听器、可穿戴设备的语音前处理。
2. **教学**：理解隐状态、门控、BPTT 这些概念绕不开。
3. **作为 Mamba/RWKV/RetNet 的祖辈**：这些线性 RNN 复活的关键，是把 LSTM 的 $W_{hh}$ 矩阵-向量乘法改成可对角化或低秩结构，从而能在训练时也变成并行的 prefix scan。它们是 RNN，但训练并行度接近 Transformer。

剩下的所有"序列建模任务"——机器翻译、语音识别、TTS、ASR、时序预测、蛋白结构——都被 Transformer 全面占领了。

---

## 4 Transformer 总览：六个零件

Transformer 来自 2017 年 Vaswani 等人的 *Attention is All You Need*。它最初为机器翻译设计，由 Encoder 和 Decoder 两座塔组成，每座塔由 $N$ 个相同的 block 叠起来。

一个标准 Encoder block 包含 **六个零件**：

```
        ┌──────────────────────────┐
   x ──►│ ① Multi-Head Self-Attn  │──► + ──► ② LayerNorm
        └──────────────────────────┘    │
                ▲                       │
                └────── ③ residual ─────┘
                            │
        ┌──────────────────────────┐
        │ ④ FFN (MLP, 2 layers)   │──► + ──► ⑤ LayerNorm
        └──────────────────────────┘    │
                ▲                       │
                └────── ⑥ residual ─────┘
```

六件套，自上而下：

1. **Multi-Head Self-Attention**：序列里两两位置交互。
2. **Add（残差连接）**：从 ResNet 借来的稳定剂。
3. **LayerNorm**（或 RMSNorm）：稳定每一层激活值的分布。
4. **FFN（Feed-Forward Network）**：两层 MLP，先升维到 $4d$ 再降回 $d$，中间夹一个 ReLU/GELU/SwiGLU。
5. **Add**：又一道残差。
6. **LayerNorm**：又一次归一化。

Decoder block 多两个零件：**Masked Self-Attention**（不许看未来）和 **Cross-Attention**（attend 到 Encoder 输出）。

整个 Transformer 没有循环、没有卷积，全靠 attention 把序列内的长程依赖一次性捞到。它的核心代价是 attention 矩阵 $O(N^2)$ 的复杂度，这条命门后面我们会看到一系列效率优化都在围着它打。

### 4.1 为什么 Transformer 比 RNN 更适合 GPU

回到 §3.6 那行 `for t in range(T)`——RNN 训练时必须按时间步顺序计算，每一步依赖上一步，**没法并行**。GPU 的全部杀器是并行算大矩阵乘法（数千核同时干活），把它当串行 CPU 用就是浪费。

Transformer 训练阶段（teacher forcing）一次性把整段序列喂进去，每个位置的 attention 都能并行计算（除了 causal mask 屏蔽未来位置），$N$ 个时刻一次大矩阵乘法搞定。**对 GPU 友好** 是 Transformer 在 2017 年扛过来 RNN 的真正原因——不是因为它建模能力强，而是因为它能吃满硬件，于是同样的训练时间可以喂更多数据，于是模型规模可以飞速放大。

这条道理也解释了为什么 Mamba 一定要把核心递推改成 prefix scan：纯 RNN 的串行结构在 GPU 上注定被淘汰。任何想替代 Transformer 的新架构，第一道门槛是"训练时能并行"。

### 4.2 一个常见的混淆点：Encoder 不是 Decoder 的"前置"

入门常见错误：以为 Encoder-Decoder 结构里 Decoder 是接在 Encoder 后面的"下游"。其实它们是**一前一后两座独立的塔，由 cross-attention 连接**。Encoder 看一遍源序列，输出一组向量（memory），就再也不动了。Decoder 自回归生成时每步的 self-attention 看自己已经写过的字，然后通过 cross-attention 抓 Encoder 的 memory。

Encoder-only / Decoder-only 是把这两个砍掉一个：BERT 没有 Decoder（直接用 encoder 输出做分类），GPT 没有 Encoder（不需要外部条件，从空 prompt 开始生成）。理解清楚这个解耦，你看任何变种（Pix2Seq、BLIP-2、Flamingo）都是这两座塔加 cross-attention 桥的某种排列。

---

## 5 自注意力的数学

### 5.1 Q、K、V 是什么

把序列每个 token 的向量表示叫 $x_i \in \mathbb{R}^d$。自注意力做的是这件事：让每个 $x_i$ 去问"序列里哪些位置和我相关？"，然后用相关性加权聚合所有位置的信息。

工程上，给 $x_i$ 配三个角色：

- **Query（查询）** $q_i = x_i W_Q$：我要问的问题。
- **Key（键）** $k_j = x_j W_K$：每个位置自我介绍的标签。
- **Value（值）** $v_j = x_j W_V$：每个位置真正想被读取的内容。

$W_Q, W_K, W_V \in \mathbb{R}^{d \times d_k}$ 三个独立的可学习投影。一个粗糙的类比：你在图书馆找书，**Query** 是你脑里的问题、**Key** 是书脊上的关键词、**Value** 是书的正文。你拿问题去匹关键词，匹得越好，那本书的内容你就读得越多。

### 5.2 Scaled Dot-Product Attention

整个序列堆成矩阵 $X \in \mathbb{R}^{N \times d}$，得到 $Q, K, V \in \mathbb{R}^{N \times d_k}$。注意力的计算是一句话：

$$\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^\top}{\sqrt{d_k}}\right) V$$

拆开看：

1. $QK^\top \in \mathbb{R}^{N \times N}$：每对 $(i, j)$ 的相似度（点积）。
2. 除以 $\sqrt{d_k}$：缩放。
3. softmax 沿最后一维（每一行）：把相似度变成和为 1 的权重。
4. 乘 $V$：每个 query 用自己的权重把所有 value 加权求和。

**为什么除 $\sqrt{d_k}$**？两个独立标准正态向量做 $d_k$ 维点积，结果方差是 $d_k$。$d_k$ 一大（比如 64、128），点积方差就大，softmax 之后权重会极度尖锐——绝大部分概率塌到一个位置，梯度变 0，训练立刻崩。除掉 $\sqrt{d_k}$ 把点积方差拉回 1，softmax 输出柔和，梯度健康。这是 2017 年原论文的小细节，但它是 Transformer 训得动的关键之一。

### 5.3 Multi-Head Attention

只做一次注意力，模型只能学到"一种关系"。Multi-head 把 $d$ 维特征切成 $H$ 个头，每个头独立做注意力，输出再拼接：

$$\text{MHA}(X) = \text{Concat}(\text{head}_1, \dots, \text{head}_H) W_O$$
$$\text{head}_h = \text{Attention}(X W_Q^{(h)}, X W_K^{(h)}, X W_V^{(h)})$$

实践中每个头的维度 $d_h = d / H$，总参数量和单头一致。

直觉上，不同头学不同的 attention 模式：有的头看局部（"形容词修饰名词"），有的头看代词指代，有的头看句法结构。可解释性论文里能看到这些 attention pattern 的可视化，特别像人类语言学家手工画的依存图。

### 5.4 Causal Mask：防止偷看未来

Decoder 在自回归生成时，第 $i$ 个位置只能看 $\le i$ 的位置。实现是在 $QK^\top$ 上加一个**上三角负无穷掩码**：

```
         k0  k1  k2  k3
    q0   ✓   -∞  -∞  -∞
    q1   ✓   ✓   -∞  -∞
    q2   ✓   ✓   ✓   -∞
    q3   ✓   ✓   ✓   ✓
```

softmax 之后，被屏蔽的位置权重就是 0。这一行掩码代码看似不起眼，但它把 Decoder 和 Encoder 在精神上彻底分开：Encoder 是 BERT 那种"理解全局"，Decoder 是 GPT 那种"逐词生成"。

### 5.5 注意力到底学到了什么

可视化 attention 矩阵能给你直观感觉，但要小心几个常见误读：

1. **Attention 权重不等于因果归因**。一个 token 把权重 0.9 放在另一个 token 上，不代表后者"导致了"前者的预测。归因分析（attribution）需要更严谨的工具，如 integrated gradients、causal tracing。
2. **不同层不同头模式差异极大**。底层注意力倾向于关注语法、临近 token；中层关注语义、共指；高层关注任务相关结构。BERTology 那一波研究（2019-2020）有大量这方面的可视化。
3. **大量头是"冗余"或"近似均匀"的**。Voita 等人 2019 年的论文指出，BERT 里相当部分注意力头剪掉对性能影响很小——这给了后来 GQA、MoE-Attention 等"压缩头"思路理论依据。

### 5.6 一个被忽略的细节：softmax 温度

有时候你会看到代码里在 logits 上除一个温度 $T$：

$$\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^\top}{T \sqrt{d_k}}\right) V$$

这本质上是在调"注意力的尖锐度"。$T < 1$ 让分布更尖锐（聚焦少数位置），$T > 1$ 让分布更平。训练时通常 $T=1$，但推理时调整这个温度可以做一些有趣的事——比如 long context 推理时如果分布过于扁平，可以小幅降温让模型更聚焦最相关位置（这是 YaRN 等长上下文外推技术里的小细节）。

### 5.7 复杂度账本

| 项 | 时间 | 显存 |
|---|---|---|
| $QK^\top$ | $O(N^2 d_k)$ | $O(N^2)$ |
| softmax | $O(N^2)$ | 同上 |
| 乘 $V$ | $O(N^2 d_k)$ | — |
| FFN | $O(N d^2)$ | $O(N d)$ |

短序列（$N \ll d$）瓶颈在 FFN；长序列（$N \gg d$）瓶颈在 attention 的 $N^2$。这条分界线决定了一个模型在多长上下文上算账划得来。Llama-3 8B 的 $d = 4096$，所以 4K 以内 FFN 是大头，超过 4K 后 attention 开始爆。

把这点记住，你看任何"高效 attention"论文，能立刻判断它是不是真有用：如果它声称把 attention 复杂度从 $N^2$ 降到 $N \log N$，但常数因子翻 5 倍，对 4K 以下的应用反而是负优化——这种"高效"在大量论文里出现过又被淘汰，理由就是没考虑短序列场景。

### 5.8 FFN 的隐藏角色：参数密度的主战场

很多人以为 Transformer 的"魔法"全在 attention 里。其实从参数量看，**FFN 才是大头**：每个 block 的 attention 部分参数量约 $4d^2$（QKV+输出投影），FFN 部分约 $8d^2$（两个 4× 升降维矩阵），FFN 占了三分之二。Llama 系把 FFN 改成 SwiGLU 后用三个矩阵替代两个：

$$\text{SwiGLU}(x) = (\text{Swish}(x W_{\text{gate}}) \odot x W_{\text{up}}) W_{\text{down}}$$

其中 $W_{\text{gate}}, W_{\text{up}} \in \mathbb{R}^{d \times d_{ff}}$，$W_{\text{down}} \in \mathbb{R}^{d_{ff} \times d}$。Swish 是 $x \cdot \sigma(\beta x)$ 的平滑激活（Llama 取 $\beta=1$ 即 SiLU）。为了在多了一个矩阵的情况下还跟普通 4× FFN 参数量基本对齐，Llama 把 FFN 隐维 $d_{ff}$ 从 $4d$ 缩到约 $\frac{8}{3}d$，三个矩阵合计仍是约 $3 \times \frac{8}{3} d^2 = 8d^2$。SwiGLU 比朴素 ReLU FFN 在等参数量下精度高约 0.5-1 个 ppl，是 PaLM 之后的事实标准。

这告诉我们一件事：**Transformer 的"知识"主要存在 FFN 的权重里，attention 只是负责"按需路由"**。相关研究（Geva 2021，*Transformer Feed-Forward Layers Are Key-Value Memories*）甚至指出 FFN 可以解读为一种 key-value 记忆库——这条线后来直接孕育出"知识编辑"（ROME、MEMIT）这一整条研究路径。

---

## 6 位置编码：从 sin/cos 到 RoPE 与 ALiBi

Transformer 的 self-attention 是排列等变的——把输入 token 顺序打乱，attention 矩阵也跟着对应打乱，模型完全分不出 "猫追狗" 和 "狗追猫"。必须把位置信息硬塞进去。

### 6.1 绝对位置编码（Sinusoidal，2017）

原 Transformer 用一组固定的 sin/cos 函数：

$$PE_{(pos, 2i)} = \sin(pos / 10000^{2i/d}), \quad PE_{(pos, 2i+1)} = \cos(pos / 10000^{2i/d})$$

直接加到 token embedding 上。这种做法的好处是任意位置都有定义（理论上能外推），坏处是它和"两个 token 之间的相对距离"没有清晰关系——模型得自己从绝对坐标里学相对距离。

**学习式绝对位置编码**（BERT 用的）把上面的 sin/cos 换成可学习的 embedding，能力强一点但完全无法外推到训练时没见过的长度。

### 6.2 RoPE（Rotary Position Embedding）

RoPE（苏剑林 RoFormer，2021）是 2026 年所有主流 LLM（Llama、Qwen、DeepSeek、GPT-OSS、Mistral）的位置编码方案。它的想法极其漂亮：

> **把位置信息编码成对 Q 和 K 做旋转的角度，使得 $q_i \cdot k_j$ 自动只依赖相对位置 $i - j$。**

具体做法：把 $d$ 维的 query/key 向量两两组队成 $d/2$ 个二维子空间，每个子空间用一个跟位置 $m$ 成正比的角度 $\theta_m^{(k)} = m \cdot \theta^{(k)}$ 做二维旋转：

$$\begin{pmatrix} q_{2k}' \\ q_{2k+1}' \end{pmatrix} = \begin{pmatrix} \cos m\theta^{(k)} & -\sin m\theta^{(k)} \\ \sin m\theta^{(k)} & \cos m\theta^{(k)} \end{pmatrix} \begin{pmatrix} q_{2k} \\ q_{2k+1} \end{pmatrix}$$

旋转矩阵的关键性质：两个被分别旋转 $m\theta$ 与 $n\theta$ 的向量做内积，结果只依赖角度差 $(m-n)\theta$（因为旋转 $m\theta$ 后再被对方旋转 $-n\theta$ 等价于直接旋转 $(m-n)\theta$）。所以：

$$q_i' \cdot k_j' = \text{某种关于 } (i - j) \text{ 的函数}$$

**自动相对位置！** 训练时不存任何位置 embedding 表，推理时不查表，外推到更长上下文时只要把基频 $\theta$ 调一下（YaRN、NTK-aware scaling、Llama-3 那套）。

RoPE 的统治力在 2023-2026 年是绝对的，几乎每篇新 LLM 论文都默认它。

### 6.3 ALiBi（Attention with Linear Biases）

ALiBi（Press, 2022）走另一条路：根本不动 Q/K，而是在 attention logits 上直接加一个跟相对距离成线性的偏置：

$$\text{score}(i, j) = q_i \cdot k_j - m \cdot |i - j|$$

$m$ 是每个 head 不一样的固定 slope（一个等比数列）。距离越远，惩罚越大。ALiBi 的卖点是**零参数 + 极强外推**：训练 2K，推理可以直接拉到 16K 甚至 64K，质量不大塌。MPT、BLOOM 都用过。

但 ALiBi 在 2024 后逐渐让位 RoPE，主要因为 ALiBi 的"距离衰减"假设过于刚性，在某些任务（代码、长文档检索）上不如 RoPE 表达能力强。

### 6.4 速查

| 编码 | 谁在用 | 外推 | 相对/绝对 |
|---|---|---|---|
| Sinusoidal | 原 Transformer、T5 v1 | 一般 | 绝对（隐含相对） |
| Learned Absolute | BERT、GPT-2 | 不能 | 绝对 |
| RoPE | Llama 全家、Qwen、DeepSeek、GPT-OSS、Mistral | 调基频可外推 | 相对 |
| ALiBi | MPT、BLOOM | 强 | 相对 |
| NoPE | 部分研究模型 | 实验性 | 无 |

新项目 99% 选 RoPE。

### 6.5 RoPE 外推：YaRN 与 NTK-aware

训练时上下文长度 $L_{\text{train}}$，推理想用 $L_{\text{test}} > L_{\text{train}}$，怎么办？直接外推 RoPE 通常会让模型困惑（因为高频维度的旋转角度跑出训练分布）。两条路：

- **NTK-aware（dynamic）**：把基频 $\theta = 10000$ 改成 $\theta' = \theta \cdot \alpha^{d/(d-2)}$，其中 $\alpha = L_{\text{test}} / L_{\text{train}}$。本质是把高频压低、低频不动，避免高频维"转飞"。
- **YaRN**：进一步分析"哪些频率维度需要压缩、哪些不需要"，对不同频段做差异化缩放，加上一个温度因子调 attention 锐度。比 NTK-aware 在长上下文（> 32K）上更稳。

主流开源项目（vLLM、SGLang、Transformers）都内置这两个选项，配置一个 `rope_scaling` 字段就能切换。Llama-3.1 把 max context 从 8K 推到 128K，关键技术之一就是 YaRN + 长上下文继续训练。

### 6.6 一段历史

BERT 的学习式绝对编码 max_len=512 写死在权重里，超过就不工作——但当时 NLP 任务大多句子级、段落级，512 够用。Transformer 进入"上下文越长越值钱"的时代是 GPT-3 之后（2020+），位置编码研究的爆发也在这之后。从 Sinusoidal → Learned Absolute → Relative Bias → RoPE → ALiBi → YaRN，整条线本质都在回答同一个问题：**怎么让位置信息既能让模型用，又不让位置信息把模型锁在训练长度里**。

---

## 7 归一化与残差：Pre-LN、RMSNorm

### 7.1 LayerNorm vs BatchNorm

CNN 用 BatchNorm（沿 batch 维度归一化），Transformer 用 LayerNorm（沿特征维度归一化）。BN 的工程麻烦事见 §2.5；LN 对每个样本独立归一化，跟 batch 大小无关，训推一致，特别适合 NLP 这种变长输入。

LayerNorm 公式：

$$y = \frac{x - \mu}{\sqrt{\sigma^2 + \epsilon}} \cdot \gamma + \beta$$

$\mu, \sigma$ 是 $x$ 沿特征维度的均值方差，$\gamma, \beta$ 是可学习的缩放和偏移。

### 7.2 RMSNorm：去掉均值

RMSNorm（Zhang, 2019）发现 LayerNorm 减均值那一步其实没什么用，去掉只算 RMS：

$$y = \frac{x}{\sqrt{\frac{1}{d}\sum_i x_i^2 + \epsilon}} \cdot \gamma$$

参数从 $2d$ 降到 $d$，计算少一次减法、一次均值。Llama 2 起所有现代 LLM 都换成了 RMSNorm，性能持平甚至略好，吞吐略升。

### 7.3 Pre-LN vs Post-LN

原 2017 论文用的是 Post-LN：先做 attention/FFN + 残差，再 LN。

```
Post-LN:  y = LN(x + Sublayer(x))
Pre-LN:   y = x + Sublayer(LN(x))
```

实践发现 Post-LN 在深层（> 12 层）训练极度不稳，需要小心调 warmup。**Pre-LN** 把归一化挪到子层之前、残差路径全程不归一化，让梯度沿残差直连无衰减回流，深网络稳得多。GPT-2 起几乎所有 Transformer 都用 Pre-LN。

工程上 Pre-LN 还有一个隐患：因为残差路径累加越来越大，最后一层的输出方差会膨胀。所以 Llama 之类在最终输出前再补一次 RMSNorm 收一下尾。

### 7.4 QK-Norm：训练超大模型的稳定剂

ViT-22B 论文里发现一个细节：当 head 维度大、训练规模大时，attention logits 容易爆炸（前面 5.2 节那个老问题的极端情况）。解法是在算 $QK^\top$ 之前给 Q 和 K 各加一个 LayerNorm（俗称 **QK-Norm**），强行把它们的范数拉平。这一刀下去训练立刻稳住，2024 年起几乎所有超过百亿参数的视觉/多模态模型都默认开 QK-Norm。

```python
# QK-Norm 的实现极其朴素
q = self.q_proj(x); k = self.k_proj(x); v = self.v_proj(x)
q = self.q_norm(q); k = self.k_norm(k)  # 这两行就是全部
attn = (q @ k.transpose(-2, -1)) / math.sqrt(d_k)
```

学院派会说"这相当于把 Q、K 投到固定模长的球面后做点积，近似余弦相似度"——LayerNorm 让向量的方差归一、模长基本可控（再乘可学习的 $\gamma$）。QK-Norm 把 attention 实质上变成"模长有界的相似度"，logits 不会爆。

### 7.5 残差缩放：DeepNet 与 Megatron 的细节

训练超深 Transformer（> 200 层）时，单纯的 Pre-LN 还不够，残差路径还会膨胀。**DeepNet**（Wang, 2022）的做法叫 DeepNorm：仍然走 Post-LN 框架，但把残差加法改成 $y = \mathrm{LN}(\alpha \cdot x + \mathrm{Sublayer}(x))$，并对 FFN、注意力 V/Out 投影的初始化做下放缩。Encoder 部分 $\alpha = (2N)^{1/4}$（即上调残差路径的输入），初始化缩放系数 $\beta = (8N)^{-1/4}$（即下调子层权重），$N$ 是 encoder 层数；Decoder 把 $N$ 换成 decoder 层数 $M$、用 $(2M)^{1/4}$ 与 $(8M)^{-1/4}$。这条小调整让 1000 层 Transformer 训练成为可能。生产里 Megatron-LM、DeepSpeed 都集成了这套残差缩放。

把 §7.1 ~ §7.5 这五个细节串起来：从 BatchNorm → LayerNorm → RMSNorm → Pre-LN → QK-Norm → DeepNet 残差缩放，每一步都是一个"我们想让模型更深更宽时碰到的具体崩溃"+"对症下药的一行代码"的故事。这条改进线的累计威力，就是从 GPT-2 1.5B 到 Llama-3 405B 之间六年的工程突破。

---

## 8 三种 Transformer 变体

### 8.1 Encoder-only：BERT 路线

只用 Encoder 堆叠，输入是完整句子，输出每个位置的 contextual embedding。训练任务是 **Masked Language Modeling**：随机掩掉 15% token 让模型猜。BERT、RoBERTa、DeBERTa、ModernBERT（2024）都是这一路。

适合的任务：分类、命名实体识别、抽取式问答、检索（句向量）。**不擅长生成**——它没见过自回归损失，让它续写就是车祸现场。

2026 年 Encoder-only 仍然在生产里有一席之地：embedding 服务（如 BGE、E5、SigLIP 文本塔）几乎全是 BERT 系，因为它的 contextual embedding 比 Decoder-only 的最后 token 表示更适合稠密检索。

### 8.2 Decoder-only：GPT 路线

只用 Decoder 堆叠（带 causal mask），训练任务是**自回归语言建模**——根据前文预测下一个 token。GPT 系、Llama 全家、Qwen、Claude、Gemini、DeepSeek 全是这套。

它的胜利由两个东西决定：

1. **训练目标天然适合 zero/few-shot**：next-token prediction 等价于压缩世界知识，足够大的模型 + 足够多的数据，几乎所有 NLP 任务都能用 prompt 转成续写问题。
2. **推理友好**：KV Cache 让自回归生成的每步是 $O(N)$ 而不是 $O(N^2)$。

2026 年所有旗舰 LLM 都是 Decoder-only。

### 8.3 Encoder-Decoder：T5 路线

经典的"理解 + 生成"分离架构。Encoder 吃源序列，Decoder 一边自回归生成、一边 cross-attend 到 Encoder 输出。机器翻译、摘要、Seq2Seq 任务的标准答案。

T5、BART、FLAN-T5、mT5 都是这一路。2024 后整体被 Decoder-only 吞食——你完全可以把 "翻译" 写成 prompt 让 GPT 干。但在 **多模态** 里还活着：很多 VLM（如 BLIP-2、Flamingo 早期）用 vision encoder + LLM decoder 的结构，本质就是 Encoder-Decoder 的现代化。

### 8.4 ViT：把图像当文本

跳一下题。Vision Transformer（ViT，Dosovitskiy 2020）把 Transformer 搬到视觉的方法极其朴素：

1. 把 224×224 图像切成 14×14 个 16×16 的 patch。
2. 每个 patch 展平成 768 维向量，加可学习位置 embedding。
3. 喂给标准 Transformer Encoder。
4. 取 [CLS] token 的输出做分类。

就这么简单，配合大数据（JFT-300M）和大模型（ViT-L/H），ImageNet 反超 CNN。ViT-22B 进一步把这套推到 220 亿参数，图像表征能力对标 CLIP 等多模态大模型。

ViT 之后，**自监督预训练**成为视觉的事实标准：MAE（Masked Autoencoder，He 2021）借鉴 BERT 的 MLM，把图像 75% 的 patch 遮掉让模型重建；DINOv3（Meta 2025）通过自蒸馏学到极强的通用视觉表征，是 2026 年视觉特征提取的默认选择。

### 8.5 速查

| 路线 | 注意力 | 训练目标 | 代表 | 拿手 |
|---|---|---|---|---|
| Encoder-only | bidirectional | MLM | BERT | 表示、检索、分类 |
| Decoder-only | causal | next-token | GPT、Llama | 生成、对话、通用 |
| Encoder-Decoder | bi + causal + cross | seq2seq | T5、BART | 翻译、摘要、多模态 |
| ViT (Encoder) | bidirectional | 监督/MAE/DINO | ViT、DINOv3 | 视觉表征 |
| DiT (Decoder-style) | bidirectional | denoising | Stable Diffusion 3 | 图像/视频生成 |

---

## 9 从零实现一个迷你 Transformer

> **小白警告**：本节同时涉及 multi-head attention、sin/cos 位置编码、Pre-LN、causal mask、weight tying 等 8 个独立概念，第一次读一定会懵。建议：
>
> 1. **先跳过去 §10 跑通莎翁 demo**，带着"它真的能跑"的成就感再回头读 §9 代码。
> 2. **第一遍只对照 §4 的六零件图**，把 `MultiHeadAttention`、`FeedForward`、`EncoderBlock`、`DecoderBlock` 对应到图上的方块，能对上就过，不抠每行实现。
> 3. **第二遍再看实现细节**（拆头、causal mask、Pre-LN 残差），配合 §9.1 自审清单一项项核对。
>
> 实在不想读代码也没关系——后面第 13、14 章会大量调用 `nn.Transformer` 和 HuggingFace 现成实现，从零写一遍只是帮你"看得见黑盒里有什么"，不是工作必备。

下面是一个完整、可跑、不依赖 `nn.Transformer` 的实现。约 200 行，覆盖 Encoder + Decoder + multi-head attention + sin/cos 位置编码 + Pre-LN + 训练循环。

```python
# minigpt.py
import math
import torch
import torch.nn as nn
import torch.nn.functional as F


class MultiHeadAttention(nn.Module):
    def __init__(self, d_model: int, n_heads: int, dropout: float = 0.0):
        super().__init__()
        assert d_model % n_heads == 0
        self.d_model = d_model
        self.n_heads = n_heads
        self.d_head  = d_model // n_heads
        # Q 来自 x，K/V 来自 context（self-attn 时 context=x）
        self.q_proj  = nn.Linear(d_model, d_model, bias=False)
        self.k_proj  = nn.Linear(d_model, d_model, bias=False)
        self.v_proj  = nn.Linear(d_model, d_model, bias=False)
        self.out_proj = nn.Linear(d_model, d_model, bias=False)
        self.drop = nn.Dropout(dropout)

    def forward(self, x, context=None, mask=None):
        # x:       (B, T_q, d)
        # context: (B, T_k, d)；None 时退化为 self-attention
        B, T_q, _ = x.shape
        if context is None:
            context = x
        T_k = context.shape[1]

        q = self.q_proj(x)                                      # (B, T_q, d)
        k = self.k_proj(context)                                # (B, T_k, d)
        v = self.v_proj(context)                                # (B, T_k, d)

        # 拆头：(B, T, d) -> (B, n_heads, T, d_head)
        def split(z, T):
            return z.view(B, T, self.n_heads, self.d_head).transpose(1, 2)
        q, k, v = split(q, T_q), split(k, T_k), split(v, T_k)

        # scaled dot-product
        scores = q @ k.transpose(-2, -1) / math.sqrt(self.d_head)   # (B, h, T_q, T_k)
        if mask is not None:
            scores = scores.masked_fill(mask == 0, float('-inf'))
        attn = F.softmax(scores, dim=-1)
        attn = self.drop(attn)
        out = attn @ v                                          # (B, h, T_q, d_head)

        # 合头
        out = out.transpose(1, 2).contiguous().view(B, T_q, self.d_model)
        return self.out_proj(out)


class FeedForward(nn.Module):
    """两层 MLP，中间 4x 升维。"""
    def __init__(self, d_model: int, dropout: float = 0.0):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(d_model, 4 * d_model),
            nn.GELU(),
            nn.Linear(4 * d_model, d_model),
            nn.Dropout(dropout),
        )
    def forward(self, x):
        return self.net(x)


class EncoderBlock(nn.Module):
    """Pre-LN 风格的 encoder block。"""
    def __init__(self, d_model, n_heads, dropout=0.0):
        super().__init__()
        self.ln1 = nn.LayerNorm(d_model)
        self.attn = MultiHeadAttention(d_model, n_heads, dropout)
        self.ln2 = nn.LayerNorm(d_model)
        self.ff  = FeedForward(d_model, dropout)

    def forward(self, x, mask=None):
        x = x + self.attn(self.ln1(x), mask=mask)
        x = x + self.ff(self.ln2(x))
        return x


class DecoderBlock(nn.Module):
    """Pre-LN decoder block：masked self-attn + cross-attn + FFN。"""
    def __init__(self, d_model, n_heads, dropout=0.0):
        super().__init__()
        self.ln1 = nn.LayerNorm(d_model)
        self.self_attn = MultiHeadAttention(d_model, n_heads, dropout)
        self.ln2 = nn.LayerNorm(d_model)
        self.cross_attn = MultiHeadAttention(d_model, n_heads, dropout)
        self.ln3 = nn.LayerNorm(d_model)
        self.ff  = FeedForward(d_model, dropout)

    def forward(self, x, memory, self_mask=None, cross_mask=None):
        x = x + self.self_attn(self.ln1(x), mask=self_mask)
        x = x + self.cross_attn(self.ln2(x), context=memory, mask=cross_mask)
        x = x + self.ff(self.ln3(x))
        return x


def sinusoidal_pe(max_len: int, d_model: int) -> torch.Tensor:
    pe = torch.zeros(max_len, d_model)
    pos = torch.arange(0, max_len).unsqueeze(1).float()
    div = torch.exp(torch.arange(0, d_model, 2).float() * -(math.log(10000.0) / d_model))
    pe[:, 0::2] = torch.sin(pos * div)
    pe[:, 1::2] = torch.cos(pos * div)
    return pe                                                   # (max_len, d_model)


def causal_mask(T: int, device) -> torch.Tensor:
    """生成 (1, 1, T, T) 的下三角掩码。1=允许，0=屏蔽。"""
    return torch.tril(torch.ones(T, T, device=device)).view(1, 1, T, T)


class MiniTransformer(nn.Module):
    """完整 Encoder-Decoder Transformer，足以跑机器翻译。"""
    def __init__(self,
                 src_vocab: int, tgt_vocab: int,
                 d_model: int = 256, n_heads: int = 8,
                 n_enc: int = 4, n_dec: int = 4,
                 max_len: int = 512, dropout: float = 0.1):
        super().__init__()
        self.d_model = d_model
        self.src_emb = nn.Embedding(src_vocab, d_model)
        self.tgt_emb = nn.Embedding(tgt_vocab, d_model)
        self.register_buffer('pe', sinusoidal_pe(max_len, d_model))
        self.drop = nn.Dropout(dropout)

        self.encoder = nn.ModuleList([
            EncoderBlock(d_model, n_heads, dropout) for _ in range(n_enc)
        ])
        self.decoder = nn.ModuleList([
            DecoderBlock(d_model, n_heads, dropout) for _ in range(n_dec)
        ])
        self.ln_out = nn.LayerNorm(d_model)
        self.head = nn.Linear(d_model, tgt_vocab, bias=False)
        # weight tying：输入 embedding 与输出 head 共享，省参数
        self.head.weight = self.tgt_emb.weight

    def encode(self, src, src_mask=None):
        B, T = src.shape
        x = self.src_emb(src) * math.sqrt(self.d_model)         # 缩放是原论文细节
        x = x + self.pe[:T]
        x = self.drop(x)
        for blk in self.encoder:
            x = blk(x, mask=src_mask)
        return x

    def decode(self, tgt, memory, tgt_mask=None, cross_mask=None):
        B, T = tgt.shape
        x = self.tgt_emb(tgt) * math.sqrt(self.d_model)
        x = x + self.pe[:T]
        x = self.drop(x)
        for blk in self.decoder:
            x = blk(x, memory, self_mask=tgt_mask, cross_mask=cross_mask)
        return self.head(self.ln_out(x))

    def forward(self, src, tgt, src_mask=None, cross_mask=None):
        memory = self.encode(src, src_mask)
        T_t = tgt.shape[1]
        tgt_mask = causal_mask(T_t, src.device)                 # 防止偷看未来
        return self.decode(tgt, memory, tgt_mask, cross_mask)
```

跑一下形状测试：

```python
torch.manual_seed(0)
model = MiniTransformer(src_vocab=1000, tgt_vocab=1200, d_model=128, n_heads=4)
src = torch.randint(0, 1000, (2, 10))
tgt = torch.randint(0, 1200, (2, 8))
logits = model(src, tgt)
print(logits.shape)                                             # torch.Size([2, 8, 1200])
print(sum(p.numel() for p in model.parameters()) / 1e6, 'M')    # ~1.5M
```

跑通即合格。

### 9.1 代码自审清单

写完每个 Transformer 都要勾这一遍，避免低级 bug：

- [ ] $\sqrt{d_k}$ 缩放：在 score 上除而不是乘。
- [ ] Causal mask：下三角是 1，上三角是 0；`-inf` 加在 mask=0 的位置。
- [ ] Pre-LN：`x + Sublayer(LN(x))`，不是 `LN(x + Sublayer(x))`。
- [ ] 位置编码加在 token embedding **之后**。
- [ ] Multi-head 拆头维度别搞反：`(B, T, d) -> (B, T, h, d_h) -> (B, h, T, d_h)`。
- [ ] Embedding 缩放 $\sqrt{d}$：原论文细节，不加也能训，但加了更稳。
- [ ] Weight tying（输入输出 embedding 共享）：省 1/6 参数，效果常常更好。
- [ ] Dropout 至少加在 attention 权重和 FFN 输出。

---

## 10 用迷你 Transformer 跑字符级语言模型

完整 Encoder-Decoder 适合翻译，但要演示一个能"自己学到点东西"的 demo，我们改用 Decoder-only 跑字符级语言模型——目标：在莎士比亚文本上学会胡诌古英语风句子。

```python
# train_charlm.py
import torch
import torch.nn as nn
import torch.nn.functional as F
from minigpt import DecoderBlock, sinusoidal_pe, causal_mask    # 复用上面的零件

class CharGPT(nn.Module):
    """Decoder-only 字符级语言模型。"""
    def __init__(self, vocab, d_model=192, n_heads=6, n_layers=6,
                 max_len=256, dropout=0.1):
        super().__init__()
        self.tok = nn.Embedding(vocab, d_model)
        self.register_buffer('pe', sinusoidal_pe(max_len, d_model))
        self.drop = nn.Dropout(dropout)
        # Decoder-only：cross-attn 这条线我们不用，直接复用 EncoderBlock 也行
        # 这里偷懒，把 DecoderBlock 的 cross_attn 喂自己
        self.blocks = nn.ModuleList([
            DecoderBlock(d_model, n_heads, dropout) for _ in range(n_layers)
        ])
        self.ln_f = nn.LayerNorm(d_model)
        self.head = nn.Linear(d_model, vocab, bias=False)
        self.head.weight = self.tok.weight
        self.max_len = max_len

    def forward(self, idx):                                     # idx: (B, T)
        B, T = idx.shape
        x = self.tok(idx) + self.pe[:T]
        x = self.drop(x)
        mask = causal_mask(T, idx.device)
        for blk in self.blocks:
            # 注意：复用 DecoderBlock 时 cross-attn 也用自身做 memory，
            # 在数学上等价于多算了一次 self-attn——参数量略高、训练略慢，
            # 但功能正确。生产代码请直接用 EncoderBlock + causal mask（见下方注解）。
            x = blk(x, x, self_mask=mask, cross_mask=mask)
        return self.head(self.ln_f(x))

    @torch.no_grad()
    def generate(self, prompt: torch.Tensor, n: int, temperature: float = 1.0):
        out = prompt
        for _ in range(n):
            ctx = out[:, -self.max_len:]
            logits = self(ctx)[:, -1] / temperature
            probs = F.softmax(logits, dim=-1)
            nxt = torch.multinomial(probs, 1)
            out = torch.cat([out, nxt], dim=1)
        return out


# === 数据：拼一份莎士比亚 ===
import urllib.request
url = 'https://raw.githubusercontent.com/karpathy/char-rnn/master/data/tinyshakespeare/input.txt'
text = urllib.request.urlopen(url).read().decode('utf-8')
chars = sorted(set(text))
stoi = {c: i for i, c in enumerate(chars)}
itos = {i: c for c, i in stoi.items()}
data = torch.tensor([stoi[c] for c in text], dtype=torch.long)
n = int(0.9 * len(data))
train, val = data[:n], data[n:]

def get_batch(split, batch_size=64, block_size=128, device='cpu'):
    src = train if split == 'train' else val
    ix = torch.randint(0, len(src) - block_size - 1, (batch_size,))
    x = torch.stack([src[i:i+block_size]   for i in ix])
    y = torch.stack([src[i+1:i+1+block_size] for i in ix])
    return x.to(device), y.to(device)

device = 'cuda' if torch.cuda.is_available() else 'cpu'
model = CharGPT(vocab=len(chars), d_model=192, n_heads=6,
                n_layers=6, max_len=128).to(device)
opt = torch.optim.AdamW(model.parameters(), lr=3e-4)

# === 训练循环 ===
for step in range(2000):
    x, y = get_batch('train', batch_size=64, block_size=128, device=device)
    logits = model(x)                                           # (B, T, V)
    loss = F.cross_entropy(logits.reshape(-1, len(chars)), y.reshape(-1))
    opt.zero_grad(); loss.backward(); opt.step()
    if step % 200 == 0:
        with torch.no_grad():
            xv, yv = get_batch('val', device=device)
            vloss = F.cross_entropy(
                model(xv).reshape(-1, len(chars)), yv.reshape(-1)
            )
        print(f'step {step}: train {loss.item():.3f}  val {vloss.item():.3f}')

# === 采样 ===
prompt = torch.tensor([[stoi['R'], stoi['O'], stoi['M']]], device=device)
out = model.generate(prompt, n=300, temperature=0.9)[0].tolist()
print(''.join(itos[i] for i in out))
```

笔记本电脑（M2 Mac CPU）跑 2000 步约 15-25 分钟（CUDA 上 3-5 分钟），train loss 从 ~4.2 降到 1.9-2.1（字符级，Karpathy nanoGPT 同等规模 baseline），已经能生成像下面这样的文本：

```
ROMEO: What art thou, the seas of thee
That so the cousin to her boy.
JULIET: My lord, I shall thee speak.
```

——半通不通、合法 token 多但句法漏洞频出，这正是 6 层 d=192、2000 步、loss≈2.0 的真实质量。要练到论文里那种"读起来像莎翁"的字符级输出，得把模型加到 12 层以上、训 5K-10K 步以上。这个 demo 的全部价值在于：你已经亲手把一个 Decoder-only Transformer 从零搭起来、训起来、采样起来——GPT 的核心机制就这点东西。

> **复现提醒**：如果你跑出来的 loss 卡在 2.5+ 不下，先检查 (a) `causal_mask` 是否真生效（试 T=8 打印一下 mask）；(b) 学习率（3e-4 是 Adam 默认起点，但 d=192 偏小时可以拉到 1e-3）；(c) tinyshakespeare 是否正确下载（Karpathy 那份 1MB 文本不全等同于完整莎翁全集）。
>
> **关于代码效率**：上面 `CharGPT` 复用 `DecoderBlock` 节省了实现行数，但每层多算一次 self-attn——这是教学代码。如果你要对比 PyTorch 原生 `nn.TransformerDecoder`，预期速度会慢约 1.5×，参数量也多约 30%。生产代码应当为 Decoder-only 写专用 Block（只含 masked self-attn + FFN，无 cross-attn）。

---

## 11 效率优化：Flash Attention、KV Cache、GQA、滑窗

上面那个 demo 跑 128 上下文还可以，扩到 32K 立刻爆显存——attention 矩阵是 $32K \times 32K = 10$ 亿个元素，光这一张表就 4GB（fp32）。生产 LLM 必须靠下面这一套优化拼出长上下文。

### 11.1 Flash Attention：不实例化整个 attention 矩阵

朴素 attention 把 $S = QK^\top$ 物化在 HBM（GPU 主显存）里，然后再读出来 softmax，再读出来乘 V。这个 $N \times N$ 矩阵的读写次数随 $N$ 二次增长，是 attention 慢和费显存的真实原因——不是计算瓶颈，是**内存带宽瓶颈**。

Flash Attention（Tri Dao, 2022）的核心是 **tile + online softmax + 不实例化中间矩阵**：

1. 把 $Q, K, V$ 按行分块加载到 SRAM（GPU 片上缓存，比 HBM 快 100 倍）。
2. 对每对 $(Q_i, K_j)$ 在 SRAM 里算块内的 $S$ 和 softmax。
3. 用一种数学等价的**递推 softmax 公式**，把不同块的部分结果合并，得到全局正确的 softmax。
4. 整个过程只把 $Q, K, V, O$（输出）写入 HBM，**$S$ 矩阵从未在 HBM 出现过**。

效果：

| 版本 | 硬件 | 加速 | 显存 |
|---|---|---|---|
| 朴素 | A100 | 1× | $O(N^2)$ |
| Flash Attention 1 | A100 | 2-4× | $O(N)$ |
| Flash Attention 2 | A100/H100 | 5-9× | $O(N)$ |
| Flash Attention 3 | H100 | 1.5-2× over FA-2，FP16 达约 75% MFU | $O(N)$ |

FA-3 是 2024 年中针对 Hopper（H100）的重写：利用 TMA（Tensor Memory Accelerator）和 warp specialization 把数据搬运和矩阵乘法做异步重叠，进一步提利用率。FP8 版本还能再快 1.5×。

工程上你不需要自己实现 Flash Attention：

```python
# PyTorch 2.x 起原生支持
out = torch.nn.functional.scaled_dot_product_attention(q, k, v, is_causal=True)
# 它会在合适的硬件 + 形状下自动调 Flash Attention 后端
```

或者直接装 `flash-attn` 包：

```python
from flash_attn import flash_attn_func
out = flash_attn_func(q, k, v, causal=True)
```

### 11.2 KV Cache：自回归生成的命脉

自回归生成时，每生成一个新 token，前面所有 token 的 K、V 都是不变的。每步重算它们就太蠢了。**KV Cache**：把前面所有位置的 K、V 缓存下来，下一步只算新 token 的 Q，然后和缓存里的 K、V 做 attention。

每步代价从 $O(N^2)$ 降到 $O(N)$，但显存代价是 KV Cache 本身：

$$\text{KV Cache 大小} = B \cdot N \cdot L \cdot H_{kv} \cdot d_h \cdot 2 \cdot \text{bytes}$$

其中 $B$ 是 batch、$N$ 上下文长度、$L$ 层数、$H_{kv}$ 是 KV head 数（MHA 下 $H_{kv}=H$，GQA 下 $H_{kv}<H$），$d_h$ 每头维度，最后那个 2 是 K 和 V 各一份，bytes 是数据类型字节数（fp16=2，fp8=1）。

**算个账**：先看 MHA 的极端反例。一个假想的 8B 量级模型如果不开 GQA、用 $L=32, H_{kv}=32, d_h=128$、fp16、batch=1、上下文 8K：

$$1 \times 8192 \times 32 \times 32 \times 128 \times 2 \times 2 \text{ bytes} = 4.0 \text{ GiB}$$

batch=1 的 KV Cache 就 4 GiB，模型本体（fp16 权重）约 16 GiB——KV Cache 在长上下文下能占到总显存的一半。

**真实的 Llama-3 8B 用 GQA**（$H_{kv}=8$），同样 batch=1、8K 上下文：

$$1 \times 8192 \times 32 \times 8 \times 128 \times 2 \times 2 \text{ bytes} = 1.0 \text{ GiB}$$

直接砍到原来的 1/4。这就是为什么 GQA、MQA、MLA 这些"压缩 KV"的技术对工业部署如此重要。

### 11.3 GQA / MQA / MLA：压缩 KV Cache

朴素 multi-head attention 给每个 head 配一组独立的 K 和 V。**Multi-Query Attention（MQA）** 让所有 head 共享同一组 K、V，KV Cache 砍 $H$ 倍。代价是模型质量略降。

**Grouped-Query Attention（GQA）** 是折中：把 $H$ 个 head 分成 $G$ 组，每组共享一组 KV。$G=H$ 退化成标准 MHA，$G=1$ 退化成 MQA。Llama-2 70B、Llama-3 全系、Qwen 2/3、Mistral 都用 GQA，典型 $G=8$。

**Multi-Head Latent Attention（MLA，DeepSeek-V2/V3）** 更激进：把 K、V 通过低秩投影压到一个小得多的 latent 维度（比如从 $H \cdot d_h = 4096$ 压到 512），缓存 latent 而不是 KV，需要时再投影回去。KV Cache 砍 4-8 倍，效果几乎不掉。MLA 的工程复杂度比 GQA 高，但 DeepSeek 已经证明大规模能跑。

| 方案 | KV Cache | 质量 | 谁在用 |
|---|---|---|---|
| MHA（标准） | 1× | 1× | GPT-2、早期 BERT |
| GQA（$G=8$） | 1/4 | ~99% | Llama-3、Qwen |
| MQA | 1/$H$ | ~95% | PaLM、早期 Falcon |
| MLA | 1/4 ~ 1/8 | ~99% | DeepSeek-V2/V3 |

### 11.4 滑动窗口注意力（Sliding Window Attention，SWA）

每个 token 只 attend 到自己前 $W$ 个 token，把 attention 复杂度从 $O(N^2)$ 砍到 $O(N \cdot W)$。Mistral-7B 第一代用的就是 $W=4096$ 的 SWA。

SWA 的窗口拼接性质很优雅：堆 $L$ 层 SWA，**有效感受野** $L \cdot W$。Mistral-7B 32 层 + W=4096，理论感受野 $128K$，实际能用大概 32K 上下文。这思路在长上下文里不错，但纯 SWA 会丢失全局信息，所以现代设计常常和 sink token、global attention 混用（Gemma、Mistral Mixtral）。

### 11.5 Attention Sink：一个反直觉的现象

2023 年 StreamingLLM 论文发现一个有意思的事：解码长上下文（特别是滑窗式流式推理把超出窗口的早期 token 丢掉）时，质量会突然崩溃。深挖发现模型对**最前面几个 token**（通常是 BOS / 系统提示符）放了异常高的 attention 权重——它们成了"注意力垃圾桶"，不携带具体语义，但承接 softmax 概率必须加和到 1 的"剩余概率"。一旦把这些 sink token 丢掉，softmax 的概率被迫塞向其它真正有内容的位置，分布失真，输出垮掉。

解法是 **StreamingLLM**（2023）：始终保留前几个 sink token + 滑动窗口最近几千 token，丢中间，效果几乎不掉。这个发现也启发了"显式 attention sink"机制——给模型加一个永远存在的 learnable sink，让 softmax 永远有"什么都不像"的兜底位置。Cohere 的 Command R+、Mistral 后期版本都加了这个细节。

### 11.6 长上下文的"实测衰减"：声称 ≠ 有效

工程上一个反复踩的坑：**模型支持 128K 上下文，不等于 128K 范围内信息都能被均匀利用**。两条经验线：

- **Lost in the Middle**（Liu et al., 2023, [arXiv:2307.03172](https://arxiv.org/abs/2307.03172)）：把关键信息放 prompt 中段，召回率明显低于头尾。即使模型号称支持 128K，把答案藏在第 60K-90K token，准确率会比放在前 5K 或后 5K 低 10-30 个百分点。这条规律对 GPT-4、Claude、Llama 都成立——结构性的，不是 bug。
- **RULER**（Hsieh et al., 2024, [arXiv:2404.06654](https://arxiv.org/abs/2404.06654)）给出"effective context length"的量化方法：在 NIAH（Needle-In-A-Haystack）等 13 个任务上要求达到 90% 的 baseline 准确率才算"有效支持该长度"。实测结果：声称 128K 的 Llama-3.1-70B 有效约 64K，声称 1M 的 Gemini 1.5 Pro 有效约 200K-400K，声称 200K 的 Claude 3.5 Sonnet 有效约 100K-128K。

机制上看，**Lost-in-the-Middle 来自三件事的合力**：(a) RoPE/位置编码在外推到训练分布外的位置时高频维"转飞"；(b) attention sink 把概率质量持续吸到 BOS 附近，中段位置被边缘化；(c) 训练数据本身的"重要信息分布"——文档头部和尾部（标题、摘要、结论）在预训练语料里就比中段更高密度地承载关键信息。

工程影响：

- **RAG 检索结果排序**：把 top-1 chunk 放 prompt 头部或尾部，不放中段——这会被 11 章和 16 章反复重提。
- **长 prompt 设计**：prefix（system + instruction）放最前、user query 放最后、context 夹在中间是反模式；正确做法是关键 context 紧贴 query。
- **架构层缓解**：Attention Sink（§11.5）+ NoPE 在 high-end 实验上有效，但生产模型仍然以"工程绕开"为主——架构改动还在研究阶段。

### 11.7 推理时的工程层：vLLM、SGLang、TensorRT-LLM

聊完 kernel 层和算法层的优化，最后一层是**推理服务**层。生产 LLM 部署不是"加载模型 + forward"那么简单，要解决：

- **批处理**：同时处理多个请求，每个请求长度不一。**Continuous Batching**（vLLM 提出）让新请求随时插入正在跑的 batch，吞吐提升 5-10×。
- **KV Cache 管理**：**PagedAttention**（vLLM）借鉴操作系统虚拟内存，把 KV Cache 切成 16-token 的 page，减少碎片，可以多请求共享前缀。
- **投机解码**（Speculative Decoding）：用一个小模型一次猜 4 个 token，再用大模型一次验证，正确就直接接受，错了从分歧点重来。期望加速 2-3×。Medusa、EAGLE 是更进一步的"用大模型自己当 draft"的变种。
- **量化**：FP16 → INT8 → INT4 → INT2，显存和带宽随精度同步压缩。GPTQ、AWQ、SmoothQuant 是几种主流量化算法。

vLLM、SGLang、TensorRT-LLM 是 2026 年三大推理框架。一个完整的生产 LLM 栈是：模型架构（Transformer + GQA）+ kernel（Flash Attention 3）+ 推理引擎（vLLM）+ 量化（INT4 AWQ）。这一整串决定了最终的 token/s 和 $/M tokens。

---

## 12 新兴架构：Mamba 与 MoE

### 12.1 Mamba 与 SSM：线性 RNN 的复活

Transformer 最大的痛点是 $O(N^2)$ 的训练和 $O(N)$ 的 KV Cache。**State Space Model（SSM）** 想用一种特殊形式的线性 RNN 把两者都干掉：训练 $O(N \log N)$ 或 $O(N)$、推理 $O(1)$ per token、零 KV Cache。

经典 SSM 的递推是：

$$h_t = A h_{t-1} + B x_t, \quad y_t = C h_t$$

$A$ 矩阵决定隐状态怎么演化、$B$ 怎么吸收输入、$C$ 怎么输出。看起来就是个 RNN，但关键是 $A, B, C$ 设计成与输入无关、可对角化的特殊形式（HiPPO、S4），这样整个递推可以用 **prefix scan**（也叫并行扫描）在 GPU 上 $O(N \log N)$ 并行算完，训练速度逼近 Transformer。

**Mamba（Gu, 2023）** 的关键改动是把 $A, B, C$ 变成**与输入相关**的（selective），代价是失去了 prefix scan 的简单形式，但 Tri Dao（对，就是 Flash Attention 那位）写了个高效的 selective scan CUDA kernel，让它在 GPU 上仍然飞起。Mamba-2（2024）进一步证明 SSM 和 attention 在数学上是同一种结构（State Space Duality），统一了两个家族。

**RWKV** 和 **RetNet** 是另两条独立的"线性 RNN 复兴"路线，思想接近，工程细节不同。它们的共同点：

- 训练并行度接近 Transformer。
- 推理是 $O(1)$ per token，无 KV Cache。
- 长上下文（> 100K）显存恒定。
- 在 7B 以下规模已对标 Transformer，更大规模仍待证明。

2026 年的现实：旗舰模型还都是纯 Transformer，但 **Hybrid 架构**（Transformer + Mamba 交替）开始进入主流（Jamba、Zamba-2、Falcon Mamba），它们试图取两者之长。

**实战上是否值得用 Mamba / Mamba-2**：

- **作为研究 baseline**：Mamba-2 是 2025-2026 年长上下文论文的标配 baseline，几乎所有"线性复杂度序列建模"工作都得跟它比。学术上必读。
- **作为生产部署**：**仍不推荐纯 SSM 替换 Transformer**。原因有三：(1) 7B 以下小模型 Mamba-2 能对标，但 in-context learning 重的对话/agent 任务召回率低；(2) 70B+ 规模没有任何开源纯 SSM 模型经过大规模 RLHF/RLAIF 后训练验证；(3) Hybrid 架构（Jamba 1.5、Zamba-2、IBM Granite 4 Hybrid）是更稳的选择——保留 30%-50% Transformer 层做 in-context learning，剩下用 Mamba 层省 KV Cache。

**Mamba 适合 vs 不适合的场景**：

| 适合 | 不适合 |
|---|---|
| 极长上下文（基因组、长视频、长音频） | In-context learning 重（prompt 塞例子让模型现学） |
| 流式推理（per-token 时间常数） | 精确位置查找（"第 17 个 token 是什么"） |
| 边缘设备（KV Cache 预算极小） | 通用对话/agent（细节召回要求高） |

理论上：Transformer attention 是**完美记忆**（保留 $N$ 个 KV，需要时精准查找），Mamba 是**有损压缩**（把 $N$ 个 token 压进固定大小隐状态）。前者代价是 $O(N)$ 显存，后者代价是细节丢失。这条权衡是结构性的、不会因为优化 kernel 消失。

### 12.2 MoE：Mixture of Experts

模型变大有两条路：**dense**（每个 token 走全部参数）和 **sparse**（每个 token 只走一小部分参数）。MoE 是 sparse 路线的代表：

把 FFN 替换成 $N$ 个并行的"专家"（每个就是一个独立 FFN），加一个轻量的 **gating network**，对每个 token 动态选 top-$k$ 个专家（典型 $k=2$ 或 $k=8$）。token 过专家，输出加权混合。

```
                ┌──── Expert 1 ────┐
                │                  │
  x ──► Gating ─┼──── Expert 2 ────┼─► weighted sum ─► out
                │                  │
                └──── Expert N ────┘
                  (top-k 激活)
```

**MoE 的卖点**：总参数量做大，但每个 token 的 **激活参数量** 仍然小。Mixtral 8×7B 总参数 47B，每 token 激活 13B；DeepSeek-V3 总参 671B，每 token 激活 37B。算力代价≈激活参数量，效果≈总参数量。"用小模型的算力跑大模型的效果。"

**工程麻烦事**：

- **负载均衡**：必须加 auxiliary loss 强迫专家被均匀使用，否则会塌缩到几个热门专家。Mixtral 的 Switch-style aux loss 系数典型 $\alpha=0.001$；过大会和主任务冲突，过小负载塌缩。
- **训练不稳**：gating 是离散选择，梯度难传，需要技巧（Switch、ST-Gumbel、DeepSeek-V3 的 auxiliary-loss-free balancing）。
- **专家并行（EP）+ 路由不均衡**：分布式训练/推理时一种常见做法是把每个 expert 单独放一张 GPU（EP=N_expert），forward 时用 All-to-All 把 token dispatch 到对应 GPU。两个真实问题：(1) **token 分配偏斜**——某些 expert 收到的 token 数远超其它 expert，慢的那张卡拖垮整个 step；DeepSeek-V3 实测在 64-way EP 下，最忙 expert 的 token 数能达到平均的 1.5-2×。(2) **All-to-All 跨节点带宽**：在 4 节点以上时，All-to-All 占整个 forward 时间的 30%-50%，是 MoE 比 dense 模型训练慢得多的根本原因。DeepSeek 的解法是 **device-limited routing**（每个 token 至多发到 4 个节点）+ DeepEP 通信库（针对 H800 优化的自定义 All-to-All）。Mixtral / Qwen-MoE 在 EP 规模较小时这个问题不明显。

2026 年所有旗舰开源模型基本都是 MoE：DeepSeek-V3、Mixtral、Qwen-MoE、GPT-OSS（Llama 4 的衍生）。MoE 是把 Transformer 推到万亿参数尺度的关键。

**MoE 路由机制的几种主流策略**：

| 策略 | 描述 | 代表 |
|---|---|---|
| Top-K Routing | 每 token 选 top-K 个专家 | Switch (K=1)、Mixtral (K=2) |
| Expert Choice | 每个专家选 top-K 个 token | Google 内部多个项目 |
| Hash Routing | 按 token hash 选专家 | 早期实验，已少用 |
| Soft MoE | 每 token 软分配给所有专家 | Soft MoE 论文 |

Top-K 是事实标准，但它有"不可微"问题（argmax 没梯度），通常配合 noisy gating + auxiliary load balance loss 一起训。DeepSeek-V3 提出 **auxiliary-loss-free** 的负载均衡：通过给每个专家一个动态可调的偏置项，让 routing 在不引入辅助 loss 的前提下保持均衡，避免辅助 loss 对模型主任务的副作用。

### 12.3 共享专家与细粒度专家

DeepSeek-V2 起的另一个工程贡献：**共享专家**（shared experts）+ **细粒度专家**（fine-grained experts）。

- **细粒度专家**：把传统的几十个大专家切成几百个小专家（每个尺寸更小），增加专家组合空间，提升路由精度。
- **共享专家**：一两个永远激活的专家，承接所有 token 共有的"基础知识"，让其它路由专家更专注差异化能力。

DeepSeek-V3 一共 256 个路由专家 + 1 个共享专家，每 token 激活 8 个路由 + 1 个共享。这是 2026 年 MoE 设计的标配模式。

### 12.4 Diffusion Transformer（DiT）：图像和视频生成的新主干

提一句但本章不展开：扩散模型主干从 UNet（2020-2022）逐步切换到 Transformer（2023-2026）。Stable Diffusion 3、FLUX、Sora、可灵都用 DiT 做图像/视频去噪网络。DiT 的变种 MM-DiT 把文本和图像作为同一序列联合处理，是 SD3 之后的事实标准。这条线属于"Transformer 吞食所有 modality"的另一战场。

### 12.5 速查

| 架构 | 解决什么 | 代价 |
|---|---|---|
| Mamba / SSM | 长上下文、KV Cache 显存 | 工程不如 Transformer 成熟，超大规模未验证 |
| MoE | 把模型做大但保持激活算力可控 | 总显存爆炸、训练不稳、通信开销 |
| Flash Attention | attention 内存带宽 | 仅是 kernel 优化，不改架构 |
| GQA / MLA | KV Cache 显存 | 略损质量（GQA 几乎不损） |
| Hybrid (Transformer + Mamba) | 长上下文 + 短文 attention 优势 | 两套机制并存，工程复杂 |
| DiT | 用 Transformer 当扩散网络主干 | 训练数据量需求高于 UNet |

---

## 13 怎么选：场景到架构的速查表

| 场景 | 推荐 | 备注 |
|---|---|---|
| 图像分类、检测、分割 | ConvNeXt-V2 / ViT-L | 数据 < 10M 选前者 |
| 视频理解 | TimeSformer / VideoMAE / V-JEPA-2 | 时空注意力 |
| 文本生成、对话 | Decoder-only Transformer | Llama / Qwen 起步 |
| 文本表示、检索 | Encoder-only Transformer | BGE-M3、E5 |
| 翻译、摘要（独立任务） | Decoder-only 用 prompt 即可 | T5 路线已边缘 |
| 极长上下文（> 200K） | Hybrid Transformer-Mamba | 或 RoPE + 扩展训练 |
| 移动端 / 实时 ASR | Conformer（CNN + Transformer） | 或 RNN-T |
| 时间序列预测 | Patch-TST / iTransformer | 或 N-BEATS（非 NN） |
| 多模态 LLM | Vision Encoder（ViT / SigLIP）+ Decoder LLM | 标准范式 |
| 蛋白结构 | Evoformer（Transformer 变种） | AlphaFold-2/3 |
| 推荐系统 | Two-Tower DNN / Transformer | 工业界仍混用 |

---

## 14 习题（含答案）

### 14.1 卷积参数量

> **题**：一层 Conv2d，输入 64 通道，输出 128 通道，kernel 3×3，stride 1，padding 1，bias=True。参数量是多少？FLOPs（输入空间尺寸 56×56）是多少？

**答**：
参数量 $= 3 \times 3 \times 64 \times 128 + 128 = 73,856$。
FLOPs $= 56 \times 56 \times 3 \times 3 \times 64 \times 128 \times 2 \approx 4.6 \times 10^8$（乘加各算 1 次）。
直觉值：典型 ResNet 中段一层差不多就这个量级。

### 14.2 LSTM 参数量

> **题**：一个 input_size=300、hidden_size=512 的单层 LSTM，参数量？

**答**：四个门，每个门有 $W_{ih}$（300×512）和 $W_{hh}$（512×512）以及 bias（512）。PyTorch 默认有两套 bias（input 和 hidden 各一份），所以每门 bias 是 $2 \times 512 = 1024$。总：
$4 \times (300 \times 512 + 512 \times 512 + 2 \times 512)$
$= 4 \times (153{,}600 + 262{,}144 + 1{,}024) = 4 \times 416{,}768 = 1{,}667{,}072$。
也可以直接套 PyTorch 的公式 $4 \cdot \text{hidden} \cdot (\text{input} + \text{hidden} + 2)= 4 \cdot 512 \cdot 814$ 得到同一个数。

### 14.3 Attention 缩放

> **题**：Q 和 K 都是 $d_k = 64$ 的标准正态向量，不除 $\sqrt{d_k}$，softmax 之后会发生什么？

**答**：点积 $q \cdot k$ 是 64 项独立标准正态变量之和，方差 64，标准差 8。两个 logit 之差很容易达到 10+，softmax 输出几乎全集中在最大 logit 上（接近 one-hot），其它位置概率近 0、梯度近 0，反向传播时 $W_Q, W_K$ 收不到信号。除 $\sqrt{d_k}=8$ 把方差拉回 1，softmax 输出柔和。

### 14.4 KV Cache 计算

> **题**：Qwen2.5-7B（$L=28, H_{kv}=4, d_h=128$, GQA），fp16，batch=1，context=32K。KV Cache 多大？

**答**：$1 \times 32{,}768 \times 28 \times 4 \times 128 \times 2 \times 2 \text{ bytes} \approx 1.75 \text{ GiB}$（约 1.88 GB，按 $10^9$ 计）。
对比同样配置但用 MHA（$H=28$）的话会是 7 倍即约 12 GiB——这就是 GQA 在生产中的价值。

### 14.5 RoPE 直觉

> **题**：为什么 RoPE 比绝对位置编码更适合外推？

**答**：RoPE 让 $q_m \cdot k_n$ 只依赖 $m-n$，是天然的相对位置建模。当推理时遇到训练时没见过的位置 $m$，相对距离 $m-n$ 仍然落在训练分布内（只要句内距离没变）。绝对编码则相反，超过训练 max_len 的位置完全是模型没见过的"陌生数字"，外推必崩。配合 NTK-aware 或 YaRN 的 $\theta$ 调整，RoPE 还能进一步把外推质量推到 4×~16×训练长度。

### 14.6 复杂度判断

> **题**：以下哪些操作可以用 Mamba 替换 Transformer 而显著获益？(A) 4K 上下文对话；(B) 100K 长文档摘要；(C) 图像分类；(D) 流式音频合成。

**答**：B 和 D 显著获益。B 因为长上下文 KV Cache 是大头；D 因为流式生成要求 per-token 推理是 $O(1)$、Mamba 天然合适。A 上下文不够长，Mamba 没明显优势。C 是非自回归二维数据，主流仍是 ViT/ConvNeXt，Mamba 在视觉上的工作（Vim、VMamba）有但还不主流。

### 14.7 残差思想

> **题**：举出 ResNet、LSTM、Transformer 各自的"加法捷径"。

**答**：
- ResNet：$y = F(x) + x$。
- LSTM：$c_t = f_t \odot c_{t-1} + i_t \odot \tilde{c}_t$（$f_t \to 1$ 时是恒等）。
- Transformer：每个 sublayer 后的 `x + sublayer(LN(x))`。
所有这些"加法直连"都给梯度提供了不衰减的回流路径，是深网络可训的共同支柱。

---

## 15 延伸阅读

**经典论文**

- Vaswani et al., *Attention Is All You Need*, NeurIPS 2017. [arXiv:1706.03762](https://arxiv.org/abs/1706.03762)
- He et al., *Deep Residual Learning for Image Recognition*, CVPR 2016. [arXiv:1512.03385](https://arxiv.org/abs/1512.03385)
- Devlin et al., *BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding*, NAACL 2019. [arXiv:1810.04805](https://arxiv.org/abs/1810.04805)
- Hochreiter & Schmidhuber, *Long Short-Term Memory*, Neural Computation 1997.

**位置编码与归一化**

- Su et al., *RoFormer: Enhanced Transformer with Rotary Position Embedding*, 2021. [arXiv:2104.09864](https://arxiv.org/abs/2104.09864)
- Press et al., *Train Short, Test Long: Attention with Linear Biases*, ICLR 2022. [arXiv:2108.12409](https://arxiv.org/abs/2108.12409)
- Zhang & Sennrich, *Root Mean Square Layer Normalization*, NeurIPS 2019. [arXiv:1910.07467](https://arxiv.org/abs/1910.07467)
- Xiong et al., *On Layer Normalization in the Transformer Architecture*, ICML 2020. [arXiv:2002.04745](https://arxiv.org/abs/2002.04745)

**效率优化**

- Dao et al., *FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness*, NeurIPS 2022. [arXiv:2205.14135](https://arxiv.org/abs/2205.14135)
- Dao, *FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning*, 2023. [arXiv:2307.08691](https://arxiv.org/abs/2307.08691)
- Shah et al., *FlashAttention-3: Fast and Accurate Attention with Asynchrony and Low-precision*, NeurIPS 2024. [arXiv:2407.08608](https://arxiv.org/abs/2407.08608)
- Ainslie et al., *GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints*, EMNLP 2023. [arXiv:2305.13245](https://arxiv.org/abs/2305.13245)

**新兴架构**

- Gu & Dao, *Mamba: Linear-Time Sequence Modeling with Selective State Spaces*, 2023. [arXiv:2312.00752](https://arxiv.org/abs/2312.00752)
- Dao & Gu, *Transformers are SSMs: Generalized Models and Efficient Algorithms Through Structured State Space Duality*, ICML 2024. [arXiv:2405.21060](https://arxiv.org/abs/2405.21060)
- Fedus et al., *Switch Transformer*, JMLR 2022. [arXiv:2101.03961](https://arxiv.org/abs/2101.03961)
- Liu et al., *DeepSeek-V3 Technical Report*, 2024. [arXiv:2412.19437](https://arxiv.org/abs/2412.19437)

**视觉 Transformer 与 ConvNet 复兴**

- Dosovitskiy et al., *An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale*, ICLR 2021. [arXiv:2010.11929](https://arxiv.org/abs/2010.11929)
- Liu et al., *A ConvNet for the 2020s* (ConvNeXt), CVPR 2022. [arXiv:2201.03545](https://arxiv.org/abs/2201.03545)
- Dehghani et al., *Scaling Vision Transformers to 22 Billion Parameters*, ICML 2023. [arXiv:2302.05442](https://arxiv.org/abs/2302.05442)

**非论文**

- Karpathy, *The Unreasonable Effectiveness of Recurrent Neural Networks*（char-rnn 经典博客）。
- Karpathy, *Let's build GPT: from scratch, in code, spelled out*（YouTube）——本章 §10 的灵感来源。
- Tri Dao 的 [FlashAttention 系列博客](https://tridao.me/) — 想了解 GPU kernel 最佳一手材料。

---

> **章末小成果——你现在能 demo 什么给同事**：
>
> 1. **跑过 §10 的人**：打开终端，敲 `python train_charlm.py`，15 分钟后让屏幕上吐出莎翁味的英文。"这是我从零写的 GPT，6 层 Decoder-only Transformer，没调用任何 `nn.Transformer`。"——这一句话的杀伤力比读十篇博客都大。
> 2. **没跑代码、只读概念的人**：拿一张 §4 的六零件图，跟同事讲清楚"为什么 Transformer 比 LSTM 适合 GPU"（§4.1）、"Q/K/V 的图书馆比喻"（§5.1）、"为什么 Llama 用 RoPE 不用绝对位置编码"（§6.5）。能把这三件事讲明白，你已经超过 80% 自称"了解 Transformer"的人。
> 3. **进阶展示**：把 §11.2 的 KV Cache 公式套你公司在用的模型，算一笔"上下文从 8K 扩到 32K，单卡显存够不够"的账。这种"能算账"的能力在生产团队里非常稀缺。
>
> 章末小结：
>
> CNN 教会我们"权重共享 + 局部 + 残差"，RNN 教会我们"隐状态 + 门控 + 时间展开"，Transformer 把这两套先验一并扔掉，押注"全局 attention + 规模"，用海量数据把先验一点点学回来。2026 年的 AI 应用工程师不需要再纠结哪个赢——三者都在生产，每个都有它的舒适区。重要的是你能用脑子里这三个原型去解构每一个新冒出来的架构（Mamba、MoE、Diffusion Transformer、JEPA）：**它在哪条权衡曲线上选了哪一点？** 想清楚这个，所有论文和库就只是这三件事的排列组合。
>
> 架构选完了，下一章我们回到训练本身：让深网络稳定收敛的正则化与学习率调度、救显存救稳定性的梯度三件套（裁剪、累积、检查点）、混合精度，以及多卡场景下的 DDP / FSDP / DeepSpeed。

---

## 附录 A. 一张图看懂参数量增长

| 模型 | 年份 | 参数量 | 架构 |
|---|---|---|---|
| LeNet-5 | 1998 | 60K | CNN |
| AlexNet | 2012 | 60M | CNN |
| VGG-19 | 2014 | 144M | CNN |
| ResNet-152 | 2015 | 60M | CNN（残差） |
| Transformer base | 2017 | 65M | Transformer |
| BERT-Large | 2018 | 340M | Encoder-only |
| GPT-2 | 2019 | 1.5B | Decoder-only |
| T5-11B | 2019 | 11B | Encoder-Decoder |
| GPT-3 | 2020 | 175B | Decoder-only |
| ViT-22B | 2023 | 22B | Encoder-only（视觉） |
| Llama-3 405B | 2024 | 405B | Decoder-only + GQA |
| DeepSeek-V3 | 2024 | 671B（37B 激活） | Decoder-only + MoE + MLA |

26 年间从 60K 到 671B，参数量翻了 1000 万倍。架构基本框架没变（多层堆叠 + 残差 + 归一化），但每隔几年就有一个工程化的"补丁"让规模再上一阶——没有这条工程进化链，纯靠 2017 年的原 Transformer 是撞不到今天这数字的。

## 附录 B. 怎么读架构论文

最后留一份方法论。读任何新架构论文，按这个顺序看，效率最高：

1. **看图 1**：架构图通常在 Figure 1，搞清楚整体拓扑（怎么连的）。
2. **看伪代码**：很多论文有 algorithm 块，比文字描述清楚 10 倍。
3. **看消融实验**：哪些设计是关键的、哪些是凑数的，消融表里都有。
4. **看复杂度表**：和 baseline 比，时间/显存怎么变的。
5. **看实验配置**：数据规模、训练 step、硬件，决定结论的适用范围。
6. **回到 abstract**：到这一步再读 abstract，你会知道哪些是真贡献、哪些是话术。

**读论文最危险的事是只读 abstract 然后照抄结论**——因为 abstract 总是把贡献讲到极致，但实际上 90% 的论文在 abstract 没说明的"小条件"下才成立（比如某个数据集、某个规模、某种训练 trick）。把上面六步做完，你才能判断这个架构到底值不值得用进自己的项目。
