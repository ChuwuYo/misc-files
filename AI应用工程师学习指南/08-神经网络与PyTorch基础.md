# 第 08 章 · 神经网络与 PyTorch 基础

> 从这一章开始，我们正式踏入深度学习。前七章里你已经把 Python、NumPy、概率统计、机器学习的基本盘搭好了。现在该让神经网络登场，并把工程上能跑、能调、能上线的那一套 PyTorch 工具链建立起来。

这一章的目标是把"会写一个能跑的训练脚本"这件事彻底吃透，而不是塞满公式和论文引用。深度学习的工程门槛被远远低估，论文里那些漂亮算法跑通需要的胶水代码、超参选择、调试经验，从来不会在论文里写。这章就是补这一块。

读完本章你应当能够：

- 解释一个全连接网络在数学上到底在做什么，能从感知机推到任意层的 MLP；
- 熟练使用 Tensor、autograd、device、dtype 这四样 PyTorch 的命脉；
- 用 `nn.Module` 写出自己的层和模型，分得清 `Parameter`、`Buffer`、`state_dict`；
- 写出一个标准训练循环模板，并且知道每一行为什么要写；
- 用 `Dataset` 和 `DataLoader` 把数据管道做对，调好 `num_workers`、`pin_memory`；
- 选对损失函数和优化器，搞清 AdamW 和 Lion 的区别；
- 会用 `torch.compile` 和 `torch.amp` 这两件 PyTorch 2.x 的现代化武器；
- 跑通一个完整的 MNIST 项目，从数据加载到训练、评估、保存、推理一条龙；
- 把同一套代码迁移到 Fashion-MNIST，体会到模型容量、数据复杂度、过拟合之间的张力。

本章 PyTorch 版本以 2.5 之后的稳定 API 为准，文中代码在 2.5 至 2.11 区间均能运行。如果你装的是更老的版本（比如 1.13），把 `torch.amp` 改回 `torch.cuda.amp`、`torch.compile` 直接删掉就行，剩下的几乎不用动。装 PyTorch 别从 pip 默认源装，去 `pytorch.org` 主页选对应 CUDA 版本的安装命令，否则容易装到 CPU 版还以为自己装好了 GPU 版。Apple Silicon 用户直接 `pip install torch` 就行，MPS 后端默认开启。Windows 用户建议走 WSL2，原生 Windows 上 PyTorch 体验远不如 Linux。

---

## 8.1 为什么是神经网络

### 8.1.1 从感知机讲起

1957 年 Frank Rosenblatt 在康奈尔航空实验室搭出了一台叫 Mark I Perceptron 的机器，物理实现，能识别字母。它的数学骨架简单到一行：

$$
y = \mathrm{step}(w \cdot x + b)
$$

输入向量 $x$，权重向量 $w$，偏置 $b$，加一个阶跃函数。如果 $w \cdot x + b > 0$，输出 1，否则输出 0。这就是感知机，世界上第一个有学习能力的人工神经元模型。

它的局限被 1969 年 Minsky 和 Papert 那本同名书钉死了：单层感知机连异或（XOR）都解不了。XOR 的真值表是 $(0,0) \to 0, (0,1) \to 1, (1,0) \to 1, (1,1) \to 0$，你在二维平面上画不出一条直线把这四个点分成两类。这一刀让神经网络冷了快二十年。

破局的办法其实当时已经有人提：堆两层。把第一层的输出当成新的特征，再过一层线性变换。两层加在一起，能拟合的函数就从"线性可分"扩展到了一大类非线性函数。但有个要命的前提，两层之间必须放一个非线性的激活函数。如果没有，两层线性变换合起来还是线性变换，等于白堆。

XOR 这个例子值得多想一会儿。如果第一层把 $(x_1, x_2)$ 投影成两个新特征 $h_1 = \mathrm{ReLU}(x_1 + x_2 - 0.5)$ 和 $h_2 = \mathrm{ReLU}(x_1 + x_2 - 1.5)$，那么 $h_1 - h_2$ 在 $(0,1)$ 和 $(1,0)$ 上等于 1，在 $(0,0)$ 和 $(1,1)$ 上等于 0。原本不可线性分离的四个点，经过这层非线性变换后落到了一维上，第二层一刀就切开。这就是隐藏层的本质工作：把数据投影到一个让分类器能干活的空间去。

真正让神经网络重新登场的关键，是 1986 年 Rumelhart、Hinton、Williams 那篇反向传播论文。反向传播本身的链式法则在数学上一直存在，但他们把它系统应用到多层网络的权重学习上，让"训练 MLP"这件事真正变成可工程化的方法。今天 PyTorch 的 autograd 引擎做的事情，骨子里就是这套方法的自动化版本。

### 8.1.2 MLP 的数学结构

多层感知机（Multi-Layer Perceptron, MLP）就是把若干层"线性变换 + 非线性激活"串起来。一个 $L$ 层的 MLP 可以写成：

$$
h_0 = x \\
h_l = \sigma(W_l h_{l-1} + b_l), \quad l = 1, 2, \dots, L-1 \\
\hat{y} = W_L h_{L-1} + b_L
$$

其中 $W_l$ 是第 $l$ 层的权重矩阵，$b_l$ 是偏置，$\sigma$ 是激活函数。最后一层通常不加激活，或者根据任务加 softmax/sigmoid。

为什么 MLP 表达能力强？1989 年 Cybenko、Hornik 等人证明了一个叫"通用近似定理"的结果：只要隐藏层神经元数量够多，一个有单隐藏层的 MLP 就能在任意精度下近似任何在紧致集上连续的函数。结论很漂亮，但有两个坑：一是它不告诉你需要多少神经元，可能是天文数字；二是它不告诉你怎么训练。深度学习这二十年的工程进步，本质上就是把这两个坑慢慢填上。

通用近似定理告诉我们 MLP 在理论上"可以"，但实际上人们发现"深"比"宽"更划算。同样的参数预算，分到深网络的多个隐藏层里，往往比堆在一个超宽的隐藏层里效果好得多。直观解释是：深网络可以分阶段构建抽象，每一层只需要学一种相对简单的变换，组合起来表达的函数复杂度是指数级增长的。这个观察跟"组合性"这个数学结构有关，函数 $f \circ g \circ h$ 的复杂度可以远大于单层 $f$ 在同等参数下能达到的复杂度。

### 8.1.3 激活函数：ReLU、GELU、SiLU、Swish

激活函数的角色是引入非线性。早期常用 sigmoid 和 tanh，它们光滑、可导，但有一个致命问题：饱和。当 $|x|$ 很大，sigmoid 的导数趋近于零，梯度反向传播时一层乘一层，越乘越小，梯度消失，深网络就训不动了。

2010 年前后 ReLU 替代了 sigmoid。

$$
\mathrm{ReLU}(x) = \max(0, x)
$$

简单粗暴，正半轴导数恒为 1，不会饱和；负半轴直接归零，也带来了稀疏性。ReLU 是深度学习能"深"起来的关键技术之一。但它也有缺点：负半轴导数为 0，神经元一旦输出全负就再也不更新了，业内叫"死 ReLU"。

后来出了一堆变种：

- **Leaky ReLU**：$\max(\alpha x, x)$，负半轴给个小斜率 $\alpha = 0.01$；
- **ELU/SELU**：负半轴用指数函数，导数更平滑；
- **GELU**：高斯误差线性单元，$x \cdot \Phi(x)$，其中 $\Phi$ 是标准正态的 CDF。BERT、GPT 一系列 Transformer 都用它；
- **SiLU/Swish**：$x \cdot \sigma(x)$，Google 在 2017 年通过自动搜索找出来的，跟 GELU 长得很像，LLaMA 系列、SwiGLU 都基于它。

经验法则：

- 普通卷积/MLP 默认上 ReLU，简单、快；
- Transformer 类模型用 GELU 或 SiLU；
- 如果遇到死神经元问题，换 Leaky ReLU 或 GELU；
- BatchNorm/LayerNorm 配 ReLU 已经能解决大部分梯度问题，先别在激活函数上过度调优。

PyTorch 里这些激活函数都在 `torch.nn` 和 `torch.nn.functional` 下：

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

x = torch.randn(4, 8)
print(F.relu(x).shape)
print(F.gelu(x).shape)
print(F.silu(x).shape)   # 等价于 Swish
print(nn.ReLU()(x).shape)
```

`nn.ReLU` 是模块版（带状态接口，能放进 `nn.Sequential`），`F.relu` 是函数版（无状态，直接调用）。两者数值上等价，写自定义 forward 时按习惯选一个。

### 8.1.4 为什么需要"深"

宽和深都是增加容量的办法，为什么深度学习偏爱深？粗糙地说：深网络可以分层抽特征。前几层学边缘、纹理这种低级特征，中间层学局部组合，高层学语义。同样的参数量，深网络的归纳偏置（inductive bias）更适合视觉、语言这种天然分层的数据。

但深也带来了梯度消失/爆炸、参数量大、训练难等等一系列问题。残差连接（ResNet）、归一化（BN/LN）、合适的初始化（Kaiming、Xavier）、自适应优化器（Adam 系），这些技术加起来才让"深"成为可能。本章的 MLP 还很浅，残差和归一化我们放到后面 CNN/Transformer 章节再展开。

---

## 8.2 PyTorch 的四根支柱

PyTorch 的核心抽象只有四样：Tensor、autograd、device、dtype。把这四样吃透，剩下都是工程封装。

### 8.2.1 Tensor：会算梯度的多维数组

Tensor 长得像 NumPy 的 ndarray，差别在两点：可以放到 GPU 上跑、可以记录计算图自动求导。除此之外的 API 跟 NumPy 几乎是镜像关系，会 NumPy 的人切到 PyTorch 几乎零学习成本。但有几个在数值计算和性能上影响很大的点值得单独记一下，等下面代码示例之后我们会逐个讲清楚。

```python
import torch

# 创建
a = torch.tensor([1.0, 2.0, 3.0])           # 从 Python list
b = torch.zeros(3, 4)                        # 全零，shape (3,4)
c = torch.ones(3, 4)                         # 全一
d = torch.randn(3, 4)                        # 标准正态
e = torch.arange(0, 10, step=2)              # [0,2,4,6,8]
f = torch.linspace(0, 1, steps=11)           # 等距 11 个点

# 形状操作
x = torch.randn(2, 3, 4)
print(x.shape, x.size(), x.numel())          # torch.Size([2,3,4]), 24
x_flat = x.view(2, 12)                       # view: 共享内存，要连续
x_flat2 = x.reshape(2, 12)                   # reshape: 必要时复制
x_t = x.transpose(1, 2)                      # 交换维度
x_perm = x.permute(2, 0, 1)                  # 任意重排
x_sq = torch.randn(1, 3, 1).squeeze()        # 去掉所有 size=1 维度
x_un = torch.randn(3).unsqueeze(0)           # 加一个 size=1 维度，shape (1,3)

# 运算
y = a + b[0]                                 # 广播
z = a @ d.T                                  # 矩阵乘 (a 视为行向量)
torch.matmul(d, d.T)                         # 等价的矩阵乘
d.mean(dim=0)                                # 沿第 0 维求平均
d.sum(dim=1, keepdim=True)                   # 保留维度
```

几个新手最容易翻车的点：

**`view` vs `reshape`**：`view` 要求张量在内存里连续（contiguous），不连续会报错；`reshape` 在不连续时会自动复制。要省内存就用 `view`，不想踩坑就 `reshape`。

**广播规则**：跟 NumPy 完全一样。从最右侧维度开始对齐，要么相等、要么其中一个是 1、要么其中一个不存在。`(3,1,4) + (2,4)` 会广播成 `(3,2,4)`。

**就地操作**：方法名带下划线后缀的是就地修改，比如 `x.add_(1)` 等价于 `x += 1`。在 autograd 里就地操作有时会破坏计算图，能用非就地就用非就地。

**连续性（contiguous）**：Tensor 在内存里的存放顺序是有讲究的。`transpose`、`permute`、`narrow` 这类操作只改 stride 不改实际内存布局，结果不连续；`view` 要求连续，`reshape` 不要求但有时会复制；`flatten` 内部会按需 copy。卷积、矩阵乘等算子对连续输入有更快的实现路径，碰到性能问题先 `tensor.is_contiguous()` 检查一下，不连续就 `.contiguous()` 一下，往往有显著加速。

**梯度版本**：每个 Tensor 还带一个隐式的 version counter，每次就地修改都会让它递增。autograd 在反向传播时检查这个计数，如果发现某个用过的张量被就地改了，会抛 "one of the variables needed for gradient computation has been modified" 错误，强制你写正确的代码。这个机制虽然偶尔烦人，但帮我们避开了无数难调的梯度 bug。

### 8.2.2 autograd：自动微分引擎

PyTorch 的灵魂是动态计算图加自动微分。任何 `requires_grad=True` 的 Tensor，每次参与运算都会在背后构建一张计算图，调 `.backward()` 时反向传播算梯度。

理解 autograd 不需要太多数学。把它想成一个录像机：你做的每一个张量运算，它都把"输入是谁、输出是什么、梯度怎么算"这三条信息记下来。运算完成时你拿到一张有向无环图，叶子节点是模型参数和输入，根节点是 loss。`.backward()` 沿着这张图从根往叶子走，按链式法则把每个节点对 loss 的偏导数算出来，填到对应张量的 `.grad` 字段里。

PyTorch 跟 TensorFlow 1.x 最大的区别就在这里："动态"指图是每次前向时即时构建的，不是预先定义好的静态图。这让调试变得跟普通 Python 一样直观——你可以在 forward 里打印中间结果、用 if/for 控制流、随时切到 numpy 看一眼，全部正常工作。代价是没有静态图那种全局优化机会，所以 PyTorch 2.x 才推出 `torch.compile` 试图把动态的灵活性和静态的性能糅合起来。

```python
import torch

x = torch.tensor([2.0, 3.0], requires_grad=True)
y = x ** 2                  # y 是计算图节点
z = y.sum()                 # 标量
z.backward()                # 反向传播

print(x.grad)               # tensor([4., 6.])，dz/dx_i = 2*x_i
```

注意几条：

- `.backward()` 只能从标量出发。如果输出是向量，得传一个同形状的 `gradient` 参数指明上游梯度。
- 梯度会累加，不会自动清零。所以训练循环里每次反向传播前要 `optimizer.zero_grad()`。
- 不需要梯度的代码段可以包在 `torch.no_grad()` 里，或者用 `@torch.inference_mode()` 装饰，节省显存和算力。验证、推理时一定要用。

```python
with torch.no_grad():
    pred = model(x)         # 不会构建计算图
    
# 等价但更激进的写法（会禁用 view tracking）
@torch.inference_mode()
def predict(model, x):
    return model(x)
```

`detach()` 是另一个常用操作，它把张量从计算图里摘出来，得到一个新张量，不参与梯度计算：

```python
x = torch.randn(3, requires_grad=True)
y = x * 2
z = y.detach()              # z 跟 y 共享数据，但 z.requires_grad=False
```

### 8.2.3 device：CPU、CUDA、MPS

PyTorch 的设备抽象统一在 `torch.device` 上。常见三类：

- `cpu`：万能 fallback，慢但稳；
- `cuda`：NVIDIA GPU；
- `mps`：Apple Silicon（M1/M2/M3）的 Metal Performance Shaders 后端，2022 年后稳定。

写设备无关代码的标准范式：

```python
import torch

def get_device():
    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")

device = get_device()
print(f"Using device: {device}")

x = torch.randn(3, 4).to(device)
model = MyModel().to(device)
```

把模型和数据放到同一个 device 上是基本要求，跨设备运算会直接报错。多 GPU 训练涉及到 `DataParallel`、`DistributedDataParallel`、FSDP，留到后面分布式章节再讲。

### 8.2.4 dtype：fp32、fp16、bf16、int8

数值类型直接关系到精度、速度和显存。常见五种：

| dtype | 字节数 | 范围/精度 | 用途 |
|---|---|---|---|
| `float32` | 4 | $\pm 3.4 \times 10^{38}$，约 7 位有效数字 | 训练默认 |
| `float64` | 8 | 约 15 位有效数字 | 科学计算，DL 几乎不用 |
| `float16` | 2 | $\pm 6.5 \times 10^4$，3-4 位有效数字 | 推理、混合精度 |
| `bfloat16` | 2 | 跟 fp32 同范围，3 位有效数字 | A100/H100/TPU 训练首选 |
| `int8` | 1 | $-128 \sim 127$ | 量化推理 |

fp16 和 bf16 的差别值得多说一句。fp16 的 5 位指数位让它范围窄，训练时容易下溢出（梯度太小直接归零）；bf16 是 Google Brain 设计的，砍掉的是尾数精度而非指数范围，它跟 fp32 的指数范围一样，训练稳定性远好于 fp16，所以 Ampere 之后的 NVIDIA GPU 和 Google TPU 都把 bf16 当训练首选。fp16 还活在两个地方：消费级 GPU（不支持 bf16 的卡）和推理。

切换 dtype 的方式：

```python
x = torch.randn(3, 4, dtype=torch.float32)
y = x.to(torch.float16)
z = x.bfloat16()              # 等价于 .to(torch.bfloat16)

# 创建时指定
w = torch.zeros(3, 4, dtype=torch.bfloat16, device="cuda")
```

混合精度训练（AMP）是日常会用到的玩法，8.7 节专门讲。

dtype 选择对显存的影响是线性的：fp32 → fp16/bf16 直接砍一半，量化到 int8 再砍一半。所以推理部署的常见路径是 fp32 训练 → bf16/fp16 推理 → int8 量化推理 → 极限场景 int4/int2 量化。本章先打好 fp32/bf16 训练这一关，量化推理放到后面工程化章节。

---

## 8.3 nn.Module：搭模型的标准方式

### 8.3.1 Module 是什么

`nn.Module` 是 PyTorch 所有模型的基类。它管三件事：

1. 注册子模块、参数、缓冲区，自动收集到 `state_dict`；
2. 把 `.to(device)`、`.train()`、`.eval()` 这种操作递归地下发到所有子模块；
3. 提供 `forward` 这个钩子，定义一次前向传播。

最小例子：

```python
import torch
import torch.nn as nn

class TinyMLP(nn.Module):
    def __init__(self, in_dim: int, hidden: int, out_dim: int):
        super().__init__()
        self.fc1 = nn.Linear(in_dim, hidden)
        self.fc2 = nn.Linear(hidden, out_dim)
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = torch.relu(self.fc1(x))
        return self.fc2(x)

model = TinyMLP(784, 128, 10)
x = torch.randn(32, 784)
print(model(x).shape)         # torch.Size([32, 10])
```

几条规矩：

- `__init__` 里先调 `super().__init__()`，否则后续注册都不工作；
- 子模块用 `self.xxx = nn.Linear(...)` 这样的方式赋值，PyTorch 会通过 `__setattr__` 自动注册；
- `forward` 里写计算逻辑，不要直接调用 `model.forward(x)`，应该用 `model(x)`，后者会触发 hooks。

### 8.3.2 Parameter vs Buffer

`Parameter` 是要训练的（出现在 `model.parameters()` 里，参与梯度更新）；`Buffer` 是不训练但要随模型保存的状态（比如 BatchNorm 的 running_mean）。两者都进 `state_dict`。

```python
class WithBuffer(nn.Module):
    def __init__(self):
        super().__init__()
        self.weight = nn.Parameter(torch.randn(3, 4))    # 可训练
        self.register_buffer("running_mean", torch.zeros(4))  # 不可训练但要保存
        self.scratch = torch.zeros(4)                    # 不会保存，重启就丢
```

### 8.3.3 常用层一览

`nn.Linear(in, out)` 是全连接层，权重 shape `(out, in)`，偏置 shape `(out,)`。前向是 $y = xW^T + b$。

`nn.Conv2d(in_channels, out_channels, kernel_size, stride, padding)` 是二维卷积。后面 CNN 章节展开。

`nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)` 是长短时记忆网络。一般 `batch_first=True` 让输入形状是 `(batch, seq, feature)`，符合直觉。

容器类：

- `nn.Sequential(*layers)`：按顺序串联，写浅模型方便；
- `nn.ModuleList([m1, m2, ...])`：像 list 一样存模块，但会被注册；
- `nn.ModuleDict({"a": m1, "b": m2})`：按名字存模块。

普通 Python list 装模块是不行的，PyTorch 不会注册，参数收不到、`.to(device)` 也搬不过去。这是新手常见 bug。`nn.ModuleList` 跟普通 list 用法完全一样，可以索引、迭代、`len()`，唯一区别是它继承自 `nn.Module`，`__setitem__` 时会自动调注册函数。`nn.ModuleDict` 同理。如果你的子模块数量是变长的（比如根据配置文件决定层数），用 `ModuleList` + 列表推导是最自然的写法。

```python
class Bug(nn.Module):
    def __init__(self):
        super().__init__()
        self.layers = [nn.Linear(10, 10) for _ in range(3)]   # 错！

class Right(nn.Module):
    def __init__(self):
        super().__init__()
        self.layers = nn.ModuleList([nn.Linear(10, 10) for _ in range(3)])  # 对
```

### 8.3.4 自定义层

写一个带可学习缩放和偏移的 LayerNorm-like 层：

```python
class AffineNorm(nn.Module):
    def __init__(self, dim: int, eps: float = 1e-5):
        super().__init__()
        self.gamma = nn.Parameter(torch.ones(dim))
        self.beta = nn.Parameter(torch.zeros(dim))
        self.eps = eps
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (..., dim)
        mean = x.mean(dim=-1, keepdim=True)
        var = x.var(dim=-1, keepdim=True, unbiased=False)
        x_hat = (x - mean) / torch.sqrt(var + self.eps)
        return self.gamma * x_hat + self.beta
```

这个例子覆盖了几乎所有要点：注册参数、用 tensor API 写计算、形状无关（最后一维做 norm，前面随便几个维度都行）。

写自定义层时容易翻车的几个细节。第一是初始化，PyTorch 默认对 Linear 用 Kaiming uniform，Conv 类似，但你自己 `nn.Parameter(torch.empty(...))` 创建出来的张量值是随机的、未初始化的，必须显式调用初始化函数比如 `nn.init.kaiming_normal_` 或者用 `torch.zeros / torch.ones / torch.randn` 给个明确分布。第二是 dtype 一致性，Parameter 默认是 fp32，如果你模型整体跑在 bf16 下，Parameter 会被自动转换；但如果你在 forward 里用 `torch.tensor(...)` 临时构造常量张量，记得指定 `dtype=x.dtype` 跟随输入，否则会有自动类型提升导致计算掉回 fp32。第三是 device 一致性，自定义层里手动构造的张量要 `.to(x.device)` 或者用 `torch.zeros_like(x)`，否则模型 `.to('cuda')` 之后这个临时张量还在 CPU 上，前向直接报错。

### 8.3.5 train/eval 模式

`model.train()` 和 `model.eval()` 切换的是 BatchNorm、Dropout 等模块的行为：

- BatchNorm 在 train 模式用当前 batch 统计量并更新 running 统计量，在 eval 模式用 running 统计量；
- Dropout 在 train 模式随机丢弃，在 eval 模式直接通过。

写训练循环时切到 `train()`，写评估/推理时切到 `eval()`。这一行常被忘，忘了之后 dropout 还在丢神经元，BN 统计量还在乱跳，验证集指标当然不对。

需要强调的是 `train()`/`eval()` 跟 `requires_grad` 完全是两码事。前者改的是模块的 training flag，影响 BN/Dropout 这些行为分支；后者改的是张量是否参与 autograd。所以 `model.eval()` 之后梯度计算照样进行，只是行为模式切到推理那一支。要彻底关掉梯度还是要包 `torch.no_grad()` 或 `torch.inference_mode()`。这俩概念新手最容易混。

### 8.3.6 state_dict 和保存加载

```python
# 保存
torch.save(model.state_dict(), "model.pt")

# 加载
model = TinyMLP(784, 128, 10)
model.load_state_dict(torch.load("model.pt", map_location="cpu"))
model.eval()
```

最佳实践是只保存 `state_dict`（一个 OrderedDict），不要 pickle 整个模型对象。pickle 整个模型对类定义敏感，重构代码就加载不回来；只存权重则跨版本兼容性好得多。

加载时几个常见情景需要分别处理。第一种是结构变了（比如新加了一层或改了名字），`load_state_dict` 默认 strict=True 会报缺 key 或多 key 的错。可以临时传 `strict=False` 让它忽略不匹配，但要确认确实是预期内的不匹配，否则等于偷偷加载了错的权重。第二种是从多 GPU `DataParallel` 训练保存的权重加载到单卡模型，key 都多了 `module.` 前缀，需要手动 strip 掉。第三种是从老版本 PyTorch 加载，某些算子的 buffer 名字变过，社区一般会给迁移脚本，碰到了去 GitHub 翻 issue。第四种是从公开模型仓库下载权重，`map_location='cpu'` 要先加上避免 GPU 显存峰值过大，加载完再 `.to(device)`。

如果训练中途要存（恢复用），把优化器状态、调度器状态、当前 epoch 都存上：

```python
ckpt = {
    "epoch": epoch,
    "model": model.state_dict(),
    "optimizer": optimizer.state_dict(),
    "scheduler": scheduler.state_dict() if scheduler else None,
    "scaler": scaler.state_dict() if scaler else None,    # AMP 的话
}
torch.save(ckpt, f"ckpt_{epoch:03d}.pt")
```

---

## 8.4 训练循环模板

### 8.4.1 标准五步法

PyTorch 的训练循环里每一步都是显式的，没有 Keras 那种 `model.fit` 一句搞定。这看起来啰嗦，但好处是一切尽在掌控。

```python
model.train()
for batch in dataloader:
    x, y = batch
    x, y = x.to(device), y.to(device)
    
    optimizer.zero_grad()           # 1. 清零旧梯度
    pred = model(x)                 # 2. 前向
    loss = loss_fn(pred, y)         # 3. 算损失
    loss.backward()                 # 4. 反向传播
    optimizer.step()                # 5. 更新参数
```

为什么是这五步：

- **zero_grad**：PyTorch 的梯度是累加的（这是设计选择，方便实现梯度累积），不清零会把上一次的梯度叠进来。新版可以传 `set_to_none=True`（2.0+ 默认），把梯度直接置为 None 而非置零，更省一点显存。
- **forward**：调用 `model(x)` 等价于 `model.__call__(x)`，会触发 forward hooks 和 forward 本身。
- **loss**：要是标量。多任务多 loss 时把它们加权求和成一个标量再 backward。
- **backward**：从 loss 出发反向传播，把梯度填到每个 `requires_grad=True` 的参数的 `.grad` 字段。
- **step**：优化器读 `.grad`，按各自的更新规则改 `.data`。

### 8.4.2 加上验证

完整版多了验证、记录、保存：

```python
def train_one_epoch(model, loader, loss_fn, optimizer, device):
    model.train()
    total_loss, total_correct, total_n = 0.0, 0, 0
    for x, y in loader:
        x, y = x.to(device), y.to(device)
        optimizer.zero_grad(set_to_none=True)
        logits = model(x)
        loss = loss_fn(logits, y)
        loss.backward()
        optimizer.step()
        
        total_loss += loss.item() * x.size(0)
        total_correct += (logits.argmax(dim=1) == y).sum().item()
        total_n += x.size(0)
    return total_loss / total_n, total_correct / total_n

@torch.inference_mode()
def evaluate(model, loader, loss_fn, device):
    model.eval()
    total_loss, total_correct, total_n = 0.0, 0, 0
    for x, y in loader:
        x, y = x.to(device), y.to(device)
        logits = model(x)
        loss = loss_fn(logits, y)
        total_loss += loss.item() * x.size(0)
        total_correct += (logits.argmax(dim=1) == y).sum().item()
        total_n += x.size(0)
    return total_loss / total_n, total_correct / total_n
```

`@torch.inference_mode()` 比 `torch.no_grad()` 更激进，它额外禁用了 view 跟踪，开销更小。验证、推理首选。

### 8.4.3 梯度累积

显存装不下大 batch 怎么办？把 batch 拆成几个小 micro-batch，反向传播但不立刻 step，攒够了再 step。这就是梯度累积：

```python
accum_steps = 4
optimizer.zero_grad(set_to_none=True)
for i, (x, y) in enumerate(loader):
    x, y = x.to(device), y.to(device)
    logits = model(x)
    loss = loss_fn(logits, y) / accum_steps     # 注意要除
    loss.backward()
    
    if (i + 1) % accum_steps == 0:
        optimizer.step()
        optimizer.zero_grad(set_to_none=True)
```

效果近似于 batch 扩大 4 倍。注意 BatchNorm 的统计量不会因此变化，所以严格来说梯度累积不等价于真大 batch，但大多数任务上够用了。

### 8.4.4 梯度裁剪

训练 RNN、Transformer 时偶尔会遇到梯度爆炸，loss 突然变 NaN。常用对策是梯度裁剪，把所有梯度的总范数限制在阈值内：

```python
loss.backward()
torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
optimizer.step()
```

阈值一般 1.0 起步。MLP/CNN 用得少，Transformer 几乎是标配。

裁剪要在 `loss.backward()` 之后、`optimizer.step()` 之前调。如果用了 AMP 的 GradScaler，要先 `scaler.unscale_(optimizer)` 把梯度反缩放回真实尺度再裁剪，否则裁的是被放大过几千倍的假梯度，等于没裁。完整顺序是 `scaler.scale(loss).backward()` → `scaler.unscale_(optimizer)` → `clip_grad_norm_(...)` → `scaler.step(optimizer)` → `scaler.update()`。这个顺序背一下，写错很难调。

---

## 8.5 数据管道：Dataset 与 DataLoader

### 8.5.1 Dataset 抽象

PyTorch 把数据抽象成 `Dataset` 类，要求实现两个方法：`__len__` 和 `__getitem__(idx)`。

```python
from torch.utils.data import Dataset

class CSVDataset(Dataset):
    def __init__(self, csv_path, transform=None):
        import pandas as pd
        self.df = pd.read_csv(csv_path)
        self.transform = transform
    
    def __len__(self):
        return len(self.df)
    
    def __getitem__(self, idx):
        row = self.df.iloc[idx]
        x = torch.tensor(row[:-1].values, dtype=torch.float32)
        y = torch.tensor(row[-1], dtype=torch.long)
        if self.transform:
            x = self.transform(x)
        return x, y
```

`__getitem__` 返回的可以是 tuple、dict、namedtuple，看你方便。建议用 dict 或 namedtuple 给字段起名字，下游消费时不容易搞错顺序。

如果数据是流式的、长度无法确定，用 `IterableDataset`，实现 `__iter__` 即可。本章不展开。

### 8.5.2 DataLoader 配置

`DataLoader` 把 `Dataset` 包装成 mini-batch 迭代器，处理 shuffle、batch、并行加载、collate。

```python
from torch.utils.data import DataLoader

train_loader = DataLoader(
    train_dataset,
    batch_size=128,
    shuffle=True,                # 训练集要 shuffle
    num_workers=4,               # 子进程数
    pin_memory=True,             # 锁页内存，加速 H2D 拷贝
    persistent_workers=True,     # 跨 epoch 保持 worker 进程
    prefetch_factor=2,           # 每个 worker 预取的 batch 数
    drop_last=True,              # 丢掉最后不足一个 batch 的部分
)

val_loader = DataLoader(
    val_dataset,
    batch_size=256,
    shuffle=False,               # 验证集不 shuffle
    num_workers=4,
    pin_memory=True,
    persistent_workers=True,
)
```

各参数详解：

**`num_workers`**：用多少个子进程加载数据。0 表示主进程串行加载。一般起步设 `2 * GPU 数量` 或 `min(8, CPU 核数)`，再根据 profiling 调。设太多会吃内存、抢 CPU、反而变慢。Windows 和 macOS 上多进程开销比 Linux 大，要保守一些。

**`pin_memory`**：开启后 worker 把数据写到锁页（不可被 OS 换出磁盘）的内存里，从锁页内存到 GPU 的拷贝可以异步进行（搭配 `non_blocking=True`），节省时间。CPU-only 训练时关掉，没意义还吃 RAM。

**`persistent_workers`**：默认每个 epoch 结束 worker 进程会被回收，下个 epoch 再起，启动开销大。开启后 worker 不退出，省启动时间。前提是 `num_workers > 0`。

**`prefetch_factor`**：每个 worker 预取多少个 batch。默认 2，调大可以让 GPU 等数据的时间更短，但吃内存。

**`drop_last`**：训练时建议开，避免最后一个不完整 batch 触发 BatchNorm 之类对 batch size 敏感的层抽风。验证时关掉，要算完整指标。

搭配 `non_blocking=True` 的拷贝：

```python
for x, y in train_loader:
    x = x.to(device, non_blocking=True)
    y = y.to(device, non_blocking=True)
    ...
```

只在 `pin_memory=True` 时有效。

### 8.5.3 collate_fn 自定义

默认的 collate 把同 shape 的张量 stack 起来，但碰到变长序列就要自己写：

```python
from torch.nn.utils.rnn import pad_sequence

def collate_variable_length(batch):
    # batch: list of (x, y), x 是变长 1D tensor
    xs, ys = zip(*batch)
    xs_padded = pad_sequence(xs, batch_first=True, padding_value=0)
    lengths = torch.tensor([len(x) for x in xs])
    ys = torch.stack(ys)
    return xs_padded, lengths, ys

loader = DataLoader(dataset, batch_size=32, collate_fn=collate_variable_length)
```

NLP 训练里几乎离不开自定义 collate。

### 8.5.4 数据增强放哪

图像任务常见两种增强方式：

1. CPU 上做（在 Dataset 的 `__getitem__` 里，用 torchvision.transforms 或 albumentations）；
2. GPU 上做（在 forward 里，用 kornia 之类的库）。

CPU 增强简单稳定但会变成数据加载瓶颈；GPU 增强要小心显存和 batch 一致性。开始就用 CPU 增强，profile 出来确实是数据加载慢，再考虑迁到 GPU。

判断瓶颈的简单方法：在训练循环里记录每个阶段的耗时。如果 GPU 利用率经常掉到 50% 以下，说明 GPU 在等数据，瓶颈是数据加载或 H2D 拷贝。先调高 `num_workers`、开 `pin_memory`、看看 `prefetch_factor` 改 4 有没有用。这些都试过还是 GPU 等数据，就该考虑减小图像分辨率、提前缓存到 LMDB/WebDataset、或者把增强搬到 GPU。`nvidia-smi -l 1` 是粗略观察 GPU 利用率的好工具，配合 `torch.profiler` 能拿到更细的 timeline。

---

## 8.6 损失函数：选对 loss 等于成功一半

### 8.6.1 回归类

**MSE（均方误差）**：

$$
L = \frac{1}{n}\sum_i (\hat{y}_i - y_i)^2
$$

```python
loss_fn = nn.MSELoss()
loss = loss_fn(pred, target)
```

输出和目标都是连续值。MSE 对异常点敏感，因为平方放大了误差。从概率视角看，MSE 等价于假设噪声服从高斯分布的最大似然估计：模型输出 $\hat{y}$ 是 $y$ 的高斯分布均值，方差固定，那么似然的对数恰好是负的 MSE。这个视角在很多地方都有用，比如做不确定性估计时让网络输出方差，loss 就从 MSE 升级成高斯负对数似然。

**MAE/L1**：用绝对值代替平方，对异常点鲁棒，但 0 处不可导（PyTorch 实现做了处理，可以用）。

**Huber/SmoothL1**：小误差用平方、大误差用线性，兼顾。

```python
loss_fn = nn.HuberLoss(delta=1.0)
```

### 8.6.2 分类类

**CrossEntropyLoss（交叉熵）**：多分类首选。注意 PyTorch 的 `nn.CrossEntropyLoss` 内部已经包含了 LogSoftmax + NLLLoss，所以模型最后一层输出原始 logits（不要自己加 softmax）。

$$
L = -\frac{1}{n}\sum_i \log \frac{\exp(z_{i, y_i})}{\sum_j \exp(z_{i,j})}
$$

```python
loss_fn = nn.CrossEntropyLoss()
logits = model(x)              # shape (batch, num_classes)，原始 logits
loss = loss_fn(logits, y)      # y: shape (batch,)，整数标签
```

`label_smoothing=0.1` 这个参数在 ImageNet 训练里几乎是标配，能小幅提升泛化。

**BCEWithLogitsLoss**：二分类或多标签分类。同样是 logits 输入，不要自己加 sigmoid。

```python
loss_fn = nn.BCEWithLogitsLoss()
logits = model(x)              # shape (batch,) 或 (batch, num_labels)
loss = loss_fn(logits, y.float())  # y 用 0/1 浮点
```

类别不平衡时用 `pos_weight` 给正样本加权。

为什么 `BCEWithLogitsLoss` 比"自己 sigmoid 再 BCELoss"好？同样是数值稳定性。把 sigmoid 和 BCE 合在一起算，内部用了 log-sum-exp 的稳定形式，可以正确处理 logits 绝对值很大时的数值。手动拆开则可能在 sigmoid 那一步就饱和到 0 或 1，再取 log 得到 -inf，loss 直接 NaN。这个坑老老实实用 `BCEWithLogitsLoss` 就能完全避开。

**KLDivLoss（KL 散度）**：常用于知识蒸馏。把 student 的 log-softmax 和 teacher 的 softmax 喂进去：

```python
loss_fn = nn.KLDivLoss(reduction="batchmean")
loss = loss_fn(F.log_softmax(student_logits / T, dim=1),
               F.softmax(teacher_logits / T, dim=1)) * (T ** 2)
```

### 8.6.3 怎么选

- 连续值 → MSE 或 SmoothL1；
- 单标签多分类 → CrossEntropy；
- 二分类或多标签 → BCEWithLogits；
- 蒸馏、分布匹配 → KLDiv；
- 排序、检索 → MarginRanking、TripletMargin、ContrastiveLoss；
- 分割 → CrossEntropy + Dice 联合，或 Focal。

这一节不要硬背，用到时翻文档。但记住一条：分类任务的最后一层别加 softmax，让 loss function 处理 log-sum-exp，数值稳定性好得多。

为什么数值更稳？直接算 $\log(\mathrm{softmax}(z)_i)$ 会先做 $\exp(z_i)$，当 $z_i$ 比较大时 $\exp$ 会上溢成 inf。$\mathrm{logsumexp}$ 这个内部函数用的是 $\log \sum_j \exp(z_j) = z_{\max} + \log \sum_j \exp(z_j - z_{\max})$ 这个等价变形，把所有 $\exp$ 的输入都减去最大值，结果都在 $(-\infty, 0]$ 区间内，$\exp$ 永远不会溢出。这种"数学上等价但数值上稳定"的小技巧在深度学习里到处都是，记住一个原则：**能用一步算完的别拆开算**。

---

## 8.7 优化器：从 SGD 到 Lion

### 8.7.1 SGD 与动量

最朴素的随机梯度下降：

$$
\theta_{t+1} = \theta_t - \eta \nabla L(\theta_t)
$$

加上动量（Polyak/Nesterov），等于在梯度方向上加一个滑动平均：

$$
v_{t+1} = \mu v_t + \nabla L(\theta_t) \\
\theta_{t+1} = \theta_t - \eta v_{t+1}
$$

```python
optimizer = torch.optim.SGD(model.parameters(), lr=0.01, momentum=0.9, weight_decay=5e-4)
```

ImageNet 时代 SGD + momentum + 余弦学习率 + 权重衰减是 ResNet 训练的标配，至今在视觉任务上仍然有竞争力。

为什么 SGD 在视觉上还活得不错？一个常见解释是 SGD 找到的极小值"更平坦"。Hessian 谱分析显示 SGD 收敛点附近的曲率比 Adam 系优化器更小，对应的解对扰动更鲁棒，泛化也更好。但这只是经验观察的事后解释，没有严格证明。实践中的 takeaway 是：如果你训练的是相对简单的 CNN（ResNet 系列）、有充足时间调参、想榨最后一两个点的精度，SGD + momentum 仍然值得试。如果你训的是 Transformer、数据噪声大、想用默认配置一次跑通，AdamW 更省事。

### 8.7.2 Adam 与 AdamW

Adam = 动量（一阶矩） + RMSProp（二阶矩自适应学习率）：

$$
m_t = \beta_1 m_{t-1} + (1-\beta_1) g_t \\
v_t = \beta_2 v_{t-1} + (1-\beta_2) g_t^2 \\
\hat{m}_t = m_t / (1 - \beta_1^t),\quad \hat{v}_t = v_t / (1 - \beta_2^t) \\
\theta_{t+1} = \theta_t - \eta \frac{\hat{m}_t}{\sqrt{\hat{v}_t} + \epsilon}
$$

每个参数都有自己的有效学习率，对稀疏梯度、不同尺度的特征友好。NLP、Transformer 类模型默认就用它。

AdamW 修了 Adam 一个老问题：weight decay 和 L2 正则的耦合。原版 Adam 的 `weight_decay` 实际上是把 L2 惩罚项加进梯度，再过 Adam 的自适应缩放，结果不同参数的等效衰减强度变得不一致。AdamW 把 weight decay 解耦出来，直接在参数上做 $\theta \leftarrow \theta - \eta \lambda \theta$。Loshchilov & Hutter 2017 的论文证明这一改动让 Adam 的泛化能跟 SGD 打平。

```python
optimizer = torch.optim.AdamW(
    model.parameters(),
    lr=3e-4,                 # 经典 "Karpathy constant"
    betas=(0.9, 0.999),
    weight_decay=0.01,
    eps=1e-8,
)
```

现代 Transformer 训练默认 AdamW，不用纠结。

### 8.7.3 Lion

Lion（EvoLved Sign Momentum）是 Google Brain 用程序搜索找出来的优化器，2023 年提出。它只维护一阶动量、用 sign 函数代替自适应缩放：

$$
c_t = \beta_1 m_{t-1} + (1-\beta_1) g_t \\
\theta_{t+1} = \theta_t - \eta (\mathrm{sign}(c_t) + \lambda \theta_t) \\
m_t = \beta_2 m_{t-1} + (1-\beta_2) g_t
$$

特点：

- **省显存**：只存一阶动量，比 Adam 少一半 optimizer state；
- **学习率小 3-10 倍**：跟 AdamW 比，Lion 的 lr 通常要除 3 到 10；
- **weight decay 大 3-10 倍**：相应地 weight_decay 要乘 3 到 10；
- **大 batch 更友好**：sign 操作有隐式正则效果，batch 1024+ 时常优于 AdamW；
- **小 batch 可能不如 AdamW**：32-128 的 batch 上，AdamW 的梯度噪声本身就是正则，Lion 优势消失。

PyTorch 主仓库还没合入 Lion，但有成熟第三方实现：

```python
# pip install lion-pytorch
from lion_pytorch import Lion

optimizer = Lion(
    model.parameters(),
    lr=1e-4,                 # 比 AdamW 小一个数量级
    betas=(0.9, 0.99),
    weight_decay=1e-1,       # 比 AdamW 大一个数量级
)
```

什么时候考虑 Lion：训练 LLM/扩散模型这种大模型大 batch 场景，且显存吃紧。日常项目继续 AdamW 即可。

Lion 跟 AdamW 的迁移有几个隐藏陷阱。第一是学习率范围完全不同，把 AdamW 配置直接套上去 Lion 会发散。规则是 AdamW 的 lr 除以 3-10 再开始扫，weight_decay 乘 3-10。第二是 Lion 对学习率比 AdamW 更敏感，最优区间窄一些，Sweep 时步长要小。第三是 Lion 没有 epsilon 这种"分母兜底"机制，sign 函数在零附近不连续，所以梯度噪声很小的时候表现可能不稳定，这也是它在小 batch 上吃亏的原因。理解这些差异之后再决定换不换，比看完一篇博客就立刻 all-in 要靠谱得多。

### 8.7.4 学习率调度

学习率本身是最重要的超参，没有之一。常见调度策略：

**StepLR**：每 N 步衰减到原来的 $\gamma$：

```python
scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=30, gamma=0.1)
```

**CosineAnnealingLR**：余弦曲线从初始 lr 降到 0（或 eta_min），现代训练首选：

```python
scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-6)
```

**OneCycleLR**：先升后降，配合超大 batch + 短训练，Leslie Smith 的 super-convergence 玩法：

```python
scheduler = torch.optim.lr_scheduler.OneCycleLR(
    optimizer, max_lr=1e-3, total_steps=total_steps,
    pct_start=0.1, anneal_strategy="cos",
)
```

**Warmup**：前几百到几千 step 把 lr 从很小线性升到目标值，再走主调度。Transformer 几乎必须 warmup，否则训练初期不稳。常见做法是 `LinearLR` + `CosineAnnealingLR` 用 `SequentialLR` 串联。

调度器的调用时机：每个 step 调一次还是每个 epoch 调一次？看构造时的语义：CosineAnnealingLR 的 `T_max` 单位由你决定，传 epoch 数就 epoch 末调，传 step 数就 step 末调。OneCycleLR 必须 step 末调。读文档别想当然。

学习率扫法的一个实操套路：先用 `torch.optim.lr_scheduler.LambdaLR` 做 lr finder，从 1e-7 线性升到 1e-1，跑一两百 step，画 loss 关于 lr 的曲线。loss 开始下降到下降最快的那一段对应的 lr 就是好的起始 lr，通常比下降最快点再小 3-10 倍是稳妥选择。这是 fastai 推广的方法，比拍脑袋猜要靠谱多了。本章不展开实现，但记住这个工具链，后面章节调超参时能省你很多时间。

```python
# 每个 epoch 末
for epoch in range(epochs):
    train_one_epoch(...)
    scheduler.step()

# 每个 step 末
for x, y in loader:
    optimizer.step()
    scheduler.step()
```

---

## 8.8 PyTorch 2.x 的现代化武器

### 8.8.1 torch.compile：JIT 编译加速

PyTorch 2.0 最重要的特性是 `torch.compile`。一行代码把 eager 模式的模型编译成优化过的图：

```python
model = MyModel().to(device)
model = torch.compile(model)        # 就这一行
```

它做了什么？背后是 TorchDynamo（捕获 Python 字节码生成 FX graph）+ AOTAutograd（生成反向图）+ Inductor（默认后端，把图编译成 Triton 内核或 C++）。结果是大部分模型在 GPU 上能拿到 1.3-2x 的加速，CPU 上也有提升。

**模式选择**：

```python
model = torch.compile(model, mode="default")          # 平衡
model = torch.compile(model, mode="reduce-overhead")  # 减少 Python 开销
model = torch.compile(model, mode="max-autotune")     # 最大化吞吐，编译慢
```

LLM 推理首选 `reduce-overhead`，训练默认 `default` 就够。

**首次运行慢**：第一次会编译，可能要几十秒到几分钟。之后就快了。所以 benchmark 时要 warmup 几个 batch 再测。

**torch.compile vs torch.jit**：老 API `torch.jit.trace` 和 `torch.jit.script` 现在基本进入维护模式。torch.jit 的痛点是要么不支持控制流（trace），要么得重写代码符合 TorchScript 的 Python 子集（script）。`torch.compile` 通过 graph break 机制能优雅处理任何 Python 代码：编译能编的部分，编不了的部分回落到 eager，整体不会因为一个不支持的操作就报错。新代码一律用 `torch.compile`，老代码迁移没动力就先放着。

**`torch.compile` 跟旧 JIT 的本质差别**：老的 `torch.jit.trace` 通过执行一次 forward 把动态控制流"烤死"成静态图，看到 if 走哪边就只保留那一边，换个输入分支错了直接静默出错。`torch.jit.script` 不靠 trace 而是直接编译 Python 源码，但只支持 TorchScript 这个 Python 子集，自定义类、第三方库、复杂控制流经常报"unsupported"。`torch.compile` 的杀手锏叫 graph break：碰到无法编译的代码（比如 `.item()`、Python 全局变量访问、外部 C 扩展调用）它不会报错，而是把这一段切出去回落到 eager，前后能编译的部分各自编译。结果是你写的 Python 代码可以原封不动地塞进去，性能下界是 eager 模式（不会变慢），上界是全图编译。这种渐进式优化的 UX 是 torch.compile 比 jit 好用太多的根本原因。

**graph breaks 是性能损失**：把模型迁移到 `torch.compile` 后，建议用 `fullgraph=True` 跑一次，看哪些地方有 graph break，逐个消除：

```python
model = torch.compile(model, fullgraph=True)        # 有 graph break 直接报错，方便定位
```

常见的 graph break 来源：Python 的动态属性访问、外部 C 扩展、某些 inplace 操作、tensor 转 Python 标量（`.item()`、`.tolist()`）。

**动态形状**：默认 `torch.compile` 会针对见到的具体 shape 编译特化版本。形状一变就重编译，浪费时间。开 `dynamic=True` 让它把某些维度当符号变量：

```python
model = torch.compile(model, dynamic=True)
```

或者在编译前用 `torch._dynamo.mark_dynamic(x, 0)` 显式标记某个维度为动态。LLM 推理（变长 prompt）几乎必须开。

### 8.8.2 torch.amp：混合精度训练

混合精度训练用 fp16 或 bf16 做大部分前向反向计算，关键节点（loss、reduce）保持 fp32。带来的收益：

- 速度 1.5-2x（A100/H100 的 Tensor Core 在低精度下吞吐是 fp32 的几倍到几十倍）；
- 显存减半（参数仍是 fp32，但激活可以低精度存）；
- 精度几乎不损失（bf16）或损失极小（fp16 + GradScaler）。

**bf16 流程**（Ampere 之后的卡推荐）：

```python
import torch
from torch.amp import autocast

device = "cuda"
model = MyModel().to(device)
optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4)

for x, y in loader:
    x, y = x.to(device, non_blocking=True), y.to(device, non_blocking=True)
    optimizer.zero_grad(set_to_none=True)
    
    with autocast(device_type=device, dtype=torch.bfloat16):
        logits = model(x)
        loss = loss_fn(logits, y)
    
    loss.backward()                # bf16 梯度直接 backward，不用 GradScaler
    optimizer.step()
```

**fp16 流程**（消费级卡或不支持 bf16）：

```python
from torch.amp import autocast, GradScaler

scaler = GradScaler(device=device)

for x, y in loader:
    x, y = x.to(device, non_blocking=True), y.to(device, non_blocking=True)
    optimizer.zero_grad(set_to_none=True)
    
    with autocast(device_type=device, dtype=torch.float16):
        logits = model(x)
        loss = loss_fn(logits, y)
    
    scaler.scale(loss).backward()  # 缩放 loss 防止梯度下溢
    scaler.step(optimizer)         # 内部反缩放梯度，无 NaN/Inf 才 step
    scaler.update()                # 动态调整缩放因子
```

GradScaler 的存在是因为 fp16 范围窄，小梯度容易下溢出归零。把 loss 乘个大数（缩放因子）→ 反向传播得到大梯度 → step 前把梯度除回去。如果检测到溢出（NaN/Inf），跳过这一步，缩放因子减半。

bf16 的指数范围跟 fp32 一样宽，不存在下溢出问题，所以不需要 GradScaler。这也是 bf16 比 fp16 更省心的原因。

**autocast 的注意事项**：

- 只包 forward + loss 计算，不要包 backward；
- 不要手动 `.half()` 或 `.bfloat16()` 模型，autocast 自己会处理；
- autocast 内部不同 op 会被自动选 fp32 或低精度（softmax、layernorm 这种数值敏感的留 fp32），是经过设计的；
- 验证时也要用 autocast 才能拿到一致的速度，但不需要 GradScaler。

### 8.8.3 torch.compile + torch.amp 一起用

两者完全兼容，写法只是把 compile 套在外面：

```python
model = MyModel().to(device)
model = torch.compile(model)

with autocast(device_type="cuda", dtype=torch.bfloat16):
    logits = model(x)
    loss = loss_fn(logits, y)
loss.backward()
```

实践中训练 LLM、ViT 之类的大模型基本是 compile + bf16 + AdamW + 余弦调度的组合。

一个容易踩的坑：compile 跟 `torch.utils.checkpoint`（梯度检查点，用算力换显存）组合时，老版本会有兼容性问题。如果你用的是 PyTorch 2.5 之前的版本，碰到诡异错误可以先把 compile 关掉确认是不是这个问题。2.5 之后基本修好了，但偶尔还会出现新算子不支持编译的情况。判断方法很简单：报错栈里出现 `dynamo`、`inductor`、`fx` 这几个关键词，大概率跟 compile 有关。

### 8.8.4 torch.cuda.is_available 和后端检查

写跨平台代码时这几个 API 是常客：

```python
torch.cuda.is_available()              # 有 CUDA GPU
torch.cuda.device_count()              # GPU 数量
torch.cuda.get_device_name(0)          # 设备名
torch.cuda.get_device_capability(0)    # (major, minor) 计算能力

torch.backends.mps.is_available()      # Apple Silicon GPU
torch.backends.mps.is_built()          # PyTorch 构建时是否包含 MPS

torch.backends.cudnn.benchmark = True  # 让 cuDNN 找最快算法（输入 shape 稳定时开）
torch.backends.cudnn.deterministic = True  # 牺牲一点速度换确定性
```

`cudnn.benchmark = True` 在输入 shape 不变的训练里能给一点免费加速，shape 变化频繁就关掉，否则反复 benchmark 反而慢。复现实验时 `cudnn.deterministic = True` + 固定 seed。

---

## 8.9 第一个完整模型：MNIST 手写识别

下面是一个能直接 `python train.py` 跑起来的完整脚本。CPU 上几分钟，GPU 上几十秒。我会逐段解释。

### 8.9.1 项目结构

```text
mnist_project/
├── train.py
├── infer.py
└── data/                # 自动下载到这里
```

### 8.9.2 train.py 完整代码

```python
"""
MNIST 手写数字识别 · 完整训练脚本
"""
from __future__ import annotations

import argparse
import time
from dataclasses import dataclass
from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader
from torchvision import datasets, transforms


# -----------------------------
# 1. 配置
# -----------------------------
@dataclass
class Config:
    data_dir: str = "./data"
    ckpt_dir: str = "./checkpoints"
    batch_size: int = 128
    epochs: int = 10
    lr: float = 1e-3
    weight_decay: float = 1e-4
    num_workers: int = 2
    seed: int = 42
    use_amp: bool = True            # 自动混合精度
    use_compile: bool = False       # PyTorch 2.0+ 编译，CPU 上效果有限可关
    log_every: int = 100


def get_device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


# -----------------------------
# 2. 模型
# -----------------------------
class MLP(nn.Module):
    """三层全连接，输入 28*28，输出 10 类。"""
    
    def __init__(self, hidden: int = 256, dropout: float = 0.2):
        super().__init__()
        self.flatten = nn.Flatten()
        self.net = nn.Sequential(
            nn.Linear(28 * 28, hidden),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout),
            nn.Linear(hidden, hidden),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout),
            nn.Linear(hidden, 10),
        )
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.flatten(x)
        return self.net(x)


# -----------------------------
# 3. 数据
# -----------------------------
def build_loaders(cfg: Config):
    # MNIST 全局均值/方差，公开常数
    mean, std = (0.1307,), (0.3081,)
    train_tf = transforms.Compose([
        transforms.RandomAffine(degrees=10, translate=(0.1, 0.1)),
        transforms.ToTensor(),
        transforms.Normalize(mean, std),
    ])
    eval_tf = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize(mean, std),
    ])
    
    train_set = datasets.MNIST(cfg.data_dir, train=True, download=True, transform=train_tf)
    test_set = datasets.MNIST(cfg.data_dir, train=False, download=True, transform=eval_tf)
    
    pin = torch.cuda.is_available()
    train_loader = DataLoader(
        train_set, batch_size=cfg.batch_size, shuffle=True,
        num_workers=cfg.num_workers, pin_memory=pin,
        persistent_workers=cfg.num_workers > 0, drop_last=True,
    )
    test_loader = DataLoader(
        test_set, batch_size=cfg.batch_size * 2, shuffle=False,
        num_workers=cfg.num_workers, pin_memory=pin,
        persistent_workers=cfg.num_workers > 0,
    )
    return train_loader, test_loader


# -----------------------------
# 4. 训练 / 评估
# -----------------------------
def train_one_epoch(model, loader, optimizer, scaler, device, cfg, epoch):
    model.train()
    total_loss = total_correct = total_n = 0
    t0 = time.time()
    
    use_cuda_amp = cfg.use_amp and device.type == "cuda"
    amp_dtype = torch.bfloat16 if scaler is None else torch.float16
    
    for step, (x, y) in enumerate(loader):
        x = x.to(device, non_blocking=True)
        y = y.to(device, non_blocking=True)
        
        optimizer.zero_grad(set_to_none=True)
        
        if use_cuda_amp:
            with torch.autocast(device_type="cuda", dtype=amp_dtype):
                logits = model(x)
                loss = F.cross_entropy(logits, y)
            if scaler is not None:                    # fp16 路径
                scaler.scale(loss).backward()
                scaler.step(optimizer)
                scaler.update()
            else:                                     # bf16 路径，无需缩放
                loss.backward()
                optimizer.step()
        else:
            logits = model(x)
            loss = F.cross_entropy(logits, y)
            loss.backward()
            optimizer.step()
        
        with torch.no_grad():
            total_loss += loss.item() * x.size(0)
            total_correct += (logits.argmax(dim=1) == y).sum().item()
            total_n += x.size(0)
        
        if (step + 1) % cfg.log_every == 0:
            elapsed = time.time() - t0
            print(f"[Epoch {epoch}] step {step+1}/{len(loader)} "
                  f"loss={total_loss/total_n:.4f} "
                  f"acc={total_correct/total_n:.4f} "
                  f"({elapsed:.1f}s)")
    
    return total_loss / total_n, total_correct / total_n


@torch.inference_mode()
def evaluate(model, loader, device):
    model.eval()
    total_loss = total_correct = total_n = 0
    for x, y in loader:
        x = x.to(device, non_blocking=True)
        y = y.to(device, non_blocking=True)
        logits = model(x)
        loss = F.cross_entropy(logits, y, reduction="sum")
        total_loss += loss.item()
        total_correct += (logits.argmax(dim=1) == y).sum().item()
        total_n += x.size(0)
    return total_loss / total_n, total_correct / total_n


# -----------------------------
# 5. 主流程
# -----------------------------
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--batch-size", type=int, default=128)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--no-amp", action="store_true")
    parser.add_argument("--compile", action="store_true")
    args = parser.parse_args()
    
    cfg = Config(
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
        use_amp=not args.no_amp,
        use_compile=args.compile,
    )
    
    torch.manual_seed(cfg.seed)
    device = get_device()
    print(f"Device: {device}")
    
    Path(cfg.ckpt_dir).mkdir(parents=True, exist_ok=True)
    
    # 数据
    train_loader, test_loader = build_loaders(cfg)
    print(f"Train samples: {len(train_loader.dataset)}, "
          f"Test samples: {len(test_loader.dataset)}")
    
    # 模型 + 优化器 + 调度器
    model = MLP(hidden=256, dropout=0.2).to(device)
    if cfg.use_compile and hasattr(torch, "compile"):
        try:
            model = torch.compile(model)
            print("torch.compile enabled")
        except Exception as e:
            print(f"compile skipped: {e}")
    
    optimizer = torch.optim.AdamW(model.parameters(), lr=cfg.lr,
                                   weight_decay=cfg.weight_decay)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer, T_max=cfg.epochs, eta_min=cfg.lr * 0.01)
    scaler = None  # bf16 路径无需，留接口给 fp16
    
    # 训练
    best_acc = 0.0
    for epoch in range(1, cfg.epochs + 1):
        train_loss, train_acc = train_one_epoch(
            model, train_loader, optimizer, scaler, device, cfg, epoch)
        val_loss, val_acc = evaluate(model, test_loader, device)
        scheduler.step()
        
        print(f"Epoch {epoch:02d} | train_loss={train_loss:.4f} "
              f"train_acc={train_acc:.4f} | "
              f"val_loss={val_loss:.4f} val_acc={val_acc:.4f} | "
              f"lr={optimizer.param_groups[0]['lr']:.6f}")
        
        if val_acc > best_acc:
            best_acc = val_acc
            ckpt = {
                "epoch": epoch,
                "model": (model._orig_mod.state_dict()
                          if hasattr(model, "_orig_mod")
                          else model.state_dict()),
                "optimizer": optimizer.state_dict(),
                "val_acc": val_acc,
                "config": cfg.__dict__,
            }
            torch.save(ckpt, Path(cfg.ckpt_dir) / "best.pt")
            print(f"  -> saved best checkpoint (val_acc={val_acc:.4f})")
    
    print(f"Training done. Best val_acc = {best_acc:.4f}")


if __name__ == "__main__":
    main()
```

### 8.9.3 关键设计点解释

**为什么用 dataclass 配置**：写一个 `Config` 数据类，所有超参集中一处。比散落在 `argparse` 默认值里好维护，也方便后续切到 Hydra/OmegaConf。

**为什么 BatchNorm/Dropout 都没在 eval 用**：`evaluate` 里 `model.eval()` 把 Dropout 关了，BN 改用 running 统计量。`@torch.inference_mode()` 确保不构建计算图。

**为什么 `_orig_mod`**：`torch.compile` 包装过的模型多一层 `_orig_mod` 属性，存的是原始模型。保存权重时要剥掉这层，否则 load 时找不到对应 key。

**为什么 `pin_memory` 跟 CUDA 挂钩**：CPU-only 训练开 `pin_memory` 没意义。用 `torch.cuda.is_available()` 判断。

**为什么 train 用 RandomAffine、test 不用**：训练时增强增加多样性，验证/测试时要在干净数据上评估真实泛化能力。这是数据增强的铁律。

**`F.cross_entropy(reduction="sum")` 的 trick**：评估时希望算总损失再除总样本数，loss 的默认 reduction 是 mean，最后一个 batch 不满 batch_size 时会被错误平均。改成 sum 再除 `total_n` 是更精确的做法。

**为什么 evaluate 不用 autocast**：在 inference_mode 下用不用 autocast 不影响 loss 的数值（因为没 backward），主要影响速度。如果你想压榨更多性能可以加上，但本章为了代码简洁省了。生产推理脚本里我们会把 autocast 加回来。

**为什么 `Path(cfg.ckpt_dir).mkdir(parents=True, exist_ok=True)`**：避免第一次跑因为目录不存在直接报错。`parents=True` 让父目录也一并创建，`exist_ok=True` 让目录已存在时不抛异常。这两个组合是写脚本的肌肉记忆。

**为什么用 `non_blocking=True`**：搭配 `pin_memory=True` 时，CPU 到 GPU 的拷贝可以异步进行，让 GPU 在拷贝下一个 batch 的同时计算上一个 batch，提高吞吐。不开 pin_memory 时这个参数没用。

### 8.9.4 推理脚本 infer.py

```python
"""加载训练好的模型对单张图片做推理。"""
from pathlib import Path
import torch
import torch.nn.functional as F
from torchvision import transforms
from PIL import Image

from train import MLP, get_device


def load_model(ckpt_path: str, device):
    ckpt = torch.load(ckpt_path, map_location=device)
    model = MLP(hidden=256, dropout=0.2).to(device)
    model.load_state_dict(ckpt["model"])
    model.eval()
    return model


def preprocess(image_path: str) -> torch.Tensor:
    """加载图像，转灰度，缩放到 28x28，标准化。"""
    img = Image.open(image_path).convert("L").resize((28, 28))
    tf = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize((0.1307,), (0.3081,)),
    ])
    return tf(img).unsqueeze(0)   # 加 batch 维


@torch.inference_mode()
def predict(model, x: torch.Tensor, device) -> tuple[int, float]:
    x = x.to(device)
    logits = model(x)
    probs = F.softmax(logits, dim=1)
    pred = probs.argmax(dim=1).item()
    conf = probs[0, pred].item()
    return pred, conf


if __name__ == "__main__":
    import sys
    if len(sys.argv) != 2:
        print("Usage: python infer.py <image_path>")
        sys.exit(1)
    
    device = get_device()
    model = load_model("./checkpoints/best.pt", device)
    x = preprocess(sys.argv[1])
    pred, conf = predict(model, x, device)
    print(f"Predicted: {pred} (confidence={conf:.4f})")
```

跑法：

```bash
python train.py --epochs 10 --batch-size 128
python infer.py path/to/digit.png
```

预期 10 个 epoch 后 MLP 能在 MNIST 上拿到 98% 左右的测试准确率。要更高（99%+）就得换 CNN，留到下一章。

---

## 8.10 进阶任务：Fashion-MNIST

Fashion-MNIST 是 Zalando 公司 2017 年发布的服装图像数据集，规格跟 MNIST 完全一致（28×28 灰度，10 类，60000 训练 + 10000 测试），但图像内容是 T 恤、裤子、帽子之类的服装，比手写数字难得多。MNIST 上 MLP 能干到 98%，Fashion-MNIST 上 MLP 卡在 88-90% 是常态，要 CNN 才能上 92%+。

把上面的 MNIST 代码迁过去几乎只改一行：

```python
# build_loaders 里把 datasets.MNIST 改成 datasets.FashionMNIST
train_set = datasets.FashionMNIST(cfg.data_dir, train=True, download=True, transform=train_tf)
test_set = datasets.FashionMNIST(cfg.data_dir, train=False, download=True, transform=eval_tf)
```

均值/方差稍微变一下（用 Fashion-MNIST 的）：

```python
mean, std = (0.2860,), (0.3530,)
```

然后跑：

```bash
python train.py --epochs 20
```

会观察到几件事：

1. **训练损失下降但验证准确率早早平台**：典型容量不足。MLP 把图像拍平丢了空间结构，对纹理类任务吃亏；
2. **过拟合明显**：训练准确率持续上升但验证准确率不动甚至下降。说明 dropout 0.2 不够，可以加到 0.3 或者加 weight decay；
3. **学习率敏感**：1e-3 偏激进，调到 5e-4 + 更长的 cosine schedule 通常更稳。

把这些观察跟 MNIST 上的"轻松 98%"对比，你会真切感受到任务难度的差异。下一章我们用 CNN 重做这个任务，看看空间归纳偏置带来什么。

为什么图像类任务对 MLP 不友好？根本原因是 MLP 把图像 flatten 成一个向量后，丢掉了像素之间的空间关系。一只 T 恤平移两个像素，对人眼来说没差别，对 MLP 来说输入向量完全变了，模型必须用大量参数把每个空间位置的"T 恤特征"分别学一遍。CNN 用卷积核做空间共享，让"T 恤就是 T 恤，不管它在画面哪个角落"这个先验直接编码进网络结构里。这种"把先验编码进结构"的思路是深度学习的核心方法论之一，下一章你会看到它如何把 Fashion-MNIST 准确率从 88% 推到 92% 以上。

另一个值得注意的现象是 Fashion-MNIST 的"误识别集中模式"。MLP 在 T 恤、衬衫、外套这三类之间出错最多，因为它们的低分辨率轮廓本来就接近，加上 MLP 没有空间结构感知，看到的就是一堆灰度统计量。把 confusion matrix 画出来你会清楚看到这种类间混淆，这种观察对设计真实生产系统很重要——不是所有类别都同等好训练，提升某几类就能整体抬高指标。

### 10.1 进阶练习题

1. 把 MLP 的 hidden 从 256 翻到 512，再加一层（变四层），看 Fashion-MNIST 验证准确率有什么变化。提示：可能更过拟合。
2. 把激活换成 GELU、SiLU，看有没有差异。
3. 把优化器换 SGD + momentum=0.9 + 余弦调度，跟 AdamW 对比训练稳定性和最终精度。
4. 用 `torch.utils.tensorboard.SummaryWriter` 把 loss、acc、lr 写入 TensorBoard，跑 `tensorboard --logdir runs/` 看曲线。
5. 实现梯度累积，把有效 batch 从 128 扩到 512，比较收敛曲线。
6. 在训练脚本里加 EarlyStopping：连续 3 个 epoch 验证准确率不提升就停，避免浪费算力。
7. 把 dropout 全部移除，只用 weight_decay 控制过拟合，对比两种正则化效果。
8. 跑两次相同配置的训练，对比最终验证准确率，体会随机性带来的差异。再用 `torch.manual_seed` 固定种子，看能不能完全复现。

---

## 8.11 常见坑速查

写到这里我想把工程上踩过的坑列一份小清单，按出现频率排序：

- **忘记 `optimizer.zero_grad()`**：梯度叠加，loss 一开始就爆。
- **忘记切 `model.eval()`**：dropout 还在丢，BN 还在更新，验证集指标抽风。
- **忘了把数据 `.to(device)`**：报"expected all tensors on same device"。
- **shuffle 验证集**：每次评估用不同顺序，结果可复现性差。验证集永远不 shuffle。
- **`pin_memory=True` 但 CPU-only**：浪费 RAM。判断一下 `torch.cuda.is_available()`。
- **`num_workers > 0` 在 Windows/macOS 下没保护 `if __name__ == "__main__"`**：多进程递归启动报错。
- **classifier 最后一层加了 softmax 又用 CrossEntropyLoss**：等于做了两次 softmax，loss 数值看起来还正常但梯度变小，训练慢。
- **`view` 不连续时报错**：用 `reshape` 或先 `.contiguous()`。
- **`torch.tensor(x)` vs `torch.as_tensor(x)`**：前者总是复制，后者在能共享时共享。批量处理大张量时差别明显。
- **`tensor.item()` 在 GPU tensor 上调用阻塞**：触发同步等待，循环里调用是性能杀手。日志统计可以累积到 epoch 末再 `.item()`。
- **`torch.compile` 后 `state_dict` key 多一层 `_orig_mod`**：保存时剥掉，加载到非编译模型才能匹配。
- **fp16 训练 loss NaN**：忘了 GradScaler，或者模型里有 softmax 之类的没在 fp32。autocast 是首选方案。
- **Dataset 的 `__getitem__` 太慢**：所有 worker 都堵在 IO 上，GPU 空转。用 SSD、用更快的解码库（pillow-simd、turbojpeg、tar shard）、提前缓存到内存。
- **学习率太大，前几步就 NaN**：用 warmup，或者把 lr 降一个数量级再二分搜索。
- **复现性问题**：`torch.manual_seed`、`numpy.random.seed`、`random.seed` 都设上，再加 `cudnn.deterministic=True`、`cudnn.benchmark=False`，DataLoader 的 `worker_init_fn` 设 worker 种子。还做不到完全复现就接受现实，深度学习里 100% 复现成本极高。
- **`loss.backward()` 重复调用报错**：默认 backward 后计算图会被释放。要再次反向传播得加 `loss.backward(retain_graph=True)`。但九成场景下你只是写错了循环结构，重复 backward 这个需求很罕见，先怀疑自己。
- **多模型/多 loss 时 optimizer 配错**：每个模型一个 optimizer，每次 step 前清自己的 grad。GAN 训练里 generator 和 discriminator 必须分开管，零基础容易把它们的梯度混到一起。
- **GPU 显存爆但代码看着没问题**：常见是评估时忘了 `inference_mode`，或者把 loss 之类的 tensor 累加进 list 时没 `.item()` 转 Python 标量，整张计算图被累积引用导致显存不释放。
- **`tensor.detach().cpu().numpy()` 三连**：把 GPU tensor 转 numpy 的标准姿势。少一步就报错或者死锁。日志、可视化前都得这么转。

---

## 8.12 本章小结

我们从感知机讲到了 MLP，搭起了 PyTorch 的核心抽象（Tensor、autograd、device、dtype），梳理了 `nn.Module` 的设计哲学，把训练循环模板拆成五步法，调通了数据管道（Dataset、DataLoader、num_workers、pin_memory），把损失函数和优化器选型问题摊开讲，覆盖了 PyTorch 2.x 的两件现代化武器（torch.compile、torch.amp），最后把所有这些拼起来跑了一个完整的 MNIST 项目，并把它迁移到了更难的 Fashion-MNIST。

下一章我们把"图像"这个数据类型严肃对待，引入卷积神经网络，看看为什么 CNN 在 Fashion-MNIST 上能轻松超过 MLP 的天花板。再之后是 RNN/Transformer，是大模型的算力账，是从训练到部署的工程化。

工程上几条值得带走的原则：

- 写设备无关代码，永远用 `device = get_device()` 这种封装；
- 训练脚本里区分 train/eval 模式，验证用 `inference_mode`；
- DataLoader 默认开 `pin_memory`、`persistent_workers`、合理 `num_workers`；
- 分类任务最后一层输出 logits，让 CrossEntropyLoss 处理 log-softmax；
- 默认 AdamW + 余弦调度 + bf16 autocast；
- 学习率比模型架构更重要，先调它；
- `torch.compile` 是免费午餐，新代码默认开；
- 保存 `state_dict` 而不是整个模型；
- 用 Fashion-MNIST 检验 MLP 的天花板，建立"任务难度感"。

把这些落到肌肉记忆，深度学习篇后续章节就只是在 MLP 这个骨架上换零件了。

最后给一份"最小可行训练脚本"的检查清单，写新项目时可以从头到尾过一遍：

- 设备选择封装好，CPU/CUDA/MPS 三种环境都能跑；
- 随机种子固定（虽然不一定能完全复现，至少能减小每次跑的差异）；
- 数据集均值方差用真实数据算或者从可信来源抄，别瞎填；
- DataLoader 参数：训练 shuffle，验证不 shuffle，pin_memory 跟着 CUDA 走，num_workers 起步 2-4；
- 模型最后一层输出 logits，不加 softmax/sigmoid；
- 优化器 AdamW，lr 3e-4，weight_decay 0.01-0.1，betas 默认；
- 调度器 CosineAnnealingLR 或 OneCycleLR，T_max 设成总 step 数或总 epoch 数；
- 训练循环五步法，evaluate 用 `inference_mode`；
- 保存 state_dict、optimizer state、当前 epoch、val_acc，文件名带 epoch 编号；
- 日志至少打 train_loss、train_acc、val_loss、val_acc、lr，越详细越好调；
- 模型架构相关的超参（hidden_dim、num_layers）单独做成可配参数，方便 ablation；
- 默认开 `torch.compile` 和 bf16 autocast（CUDA 环境下），CPU 环境下退回 eager；
- 梯度裁剪在 Transformer 必加，MLP 可选；
- 第一次跑设少 epoch（比如 1-2 个）确认 pipeline 能跑通再扩展到完整训练。

这些东西没有一条是某个论文的核心贡献，但少了任何一条都能让你的项目卡上半天到几天。深度学习工程的复杂度不在算法，而在每个不起眼细节加起来对正确性和性能的累积影响。

---

## 参考资源

- PyTorch 官方文档：<https://pytorch.org/docs/stable/>
- torch.compile 教程：<https://pytorch.org/tutorials/intermediate/torch_compile_tutorial.html>
- AMP 训练 recipe：<https://pytorch.org/tutorials/recipes/recipes/amp_recipe.html>
- AdamW 论文：Loshchilov & Hutter, "Decoupled Weight Decay Regularization", ICLR 2019
- Lion 论文：Chen et al., "Symbolic Discovery of Optimization Algorithms", 2023
- Lion PyTorch 实现：<https://github.com/lucidrains/lion-pytorch>
- Fashion-MNIST：<https://github.com/zalandoresearch/fashion-mnist>
- 通用近似定理原始论文：Cybenko 1989, "Approximation by Superpositions of a Sigmoidal Function"
- 反向传播原始论文：Rumelhart, Hinton, Williams 1986, "Learning representations by back-propagating errors"
- 残差网络：He et al., "Deep Residual Learning for Image Recognition", CVPR 2016
- BatchNorm 论文：Ioffe & Szegedy, "Batch Normalization", ICML 2015
- 数据加载性能调优指南：PyTorch 官方 performance tuning guide
