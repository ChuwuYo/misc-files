# 模块 00：导论与学习路径

> TL;DR：从哪里开始？先装好环境（§3），对照 Mermaid 依赖图（§1）选定一条路径，按 12 周入门表（§2）推进，遇到障碍查附录。

面向已有 1+ 年软件工程经验、第一次系统进入 Web3 的工程师。

### 读者画像扩展：中文圈现实

> TL;DR：本文不替代律师意见。Web3 在中文圈是合规高敏区，**身份分流**和**司法辖区选择**和你写哪行代码同等重要。

**大陆境内 dev**（截至 2026-04）：2021-09-24 央行十部委通知（"924 通知"）把"虚拟货币相关业务活动"定性为非法金融活动，但**写代码、做开源贡献、领工资**本身在司法实践中未被列为禁止行为。红线在三处：（1）**不发币**——任何指向境内用户的 token launch 都踩 ICO 禁令；（2）**不做面向 C 端的 token economic 设计**——白皮书署名、TGE 操盘等留痕极重；（3）**接外包要谨慎**——为境外项目方写"上线即发币"的合约，按帮助信息网络犯罪活动罪（帮信罪）和非法经营罪都有判例。建议：贡献开源协议、给基础设施公司远程打工（薪资走 USDC + 香港/新加坡持牌 OTC 出金）相对安全；自己起项目优先注册海外实体。

**香港持牌路径**：2024-08 *稳定币条例*由 HKMA 主导，**2025-08-01 正式生效**；SFC 1/4/7/9 号牌覆盖证券交易/资管，VATP（虚拟资产交易平台）牌照独立发放。HashKey、OSL 是首批持牌 CEX；StanChart、京东币链科技、圆币科技是首批入沙盒的稳定币发行人候选。香港护照/居留权 + 持牌机构 employment 是合规含金量最高的中文圈路径。

**出海路径**：Singapore PSA（MAS DPT 牌照，2024 起 retail 接入收紧，机构端仍开放）、Dubai VARA（2022 设立，对 DeFi/RWA 较友好，OKX/Bybit/Binance 多家拿牌）、Bali / Chiang Mai / Lisbon 远程节点（数字游民签证 + 海外实体雇佣，无牌照负担但需自管 KYC 和报税）。

**华人海外 dev**：KYC 走海外身份（美/加/欧/港/新护照或绿卡），Coinbase/Kraken 等出入金通道才稳定；token 发行实体优先 Cayman Foundation（DAO 主流）、BVI（Layer-1 偏好）、瑞士 Stiftung（Ethereum Foundation 同款），避免在受限辖区签 SAFT。详细法律结构见 §15。

---

## 0. 前置知识

后续章节默认你已掌握以下能力，任一项空白先回去补：

- **Git**：能处理 merge conflict、懂 `rebase` 与 `merge` 差别。
- **Linux / macOS shell**：会读 `man`、写 `bash` 脚本、理解 `PATH`。
- **JS / TS**：写过生产应用，熟悉 npm/pnpm 与事件循环。
- **Python**：会用 `venv` / `pyenv`。
- **HTTP**：懂 JSON-RPC 与 REST 差别。
- **SQL**：会写 `JOIN`、懂索引与事务。

---

## 1. 16 模块概览与依赖图

> TL;DR：蓝色 3 模块必学，黄色 3 模块吃饭，粉/绿/紫按方向选。图中箭头 = 硬依赖，跳过必踩坑。

### 1.1 依赖图

```mermaid
graph TD
    M00[00 导论与学习路径]
    M01[01 密码学基础]
    M02[02 区块链原理与共识]
    M03[03 以太坊与 EVM]
    M04[04 Solidity 开发]
    M05[05 智能合约安全]
    M06[06 DeFi 协议工程]
    M07[07 L2 与扩容]
    M08[08 零知识证明]
    M09[09 替代生态]
    M10[10 前端与账户抽象]
    M11[11 基础设施与工具]
    M12[12 AI x Web3]
    M13[13 NFT 身份与社交]
    M14[14 去中心化存储]
    M15[15 DAO 治理与 Tokenomics]

    M00 --> M01
    M00 --> M02
    M01 --> M02
    M02 --> M03
    M03 --> M04
    M04 --> M05
    M04 --> M06
    M05 --> M06
    M03 --> M07
    M01 --> M08
    M03 --> M08
    M02 --> M09
    M04 --> M10
    M03 --> M11
    M05 --> M11
    M04 --> M12
    M06 --> M12
    M04 --> M13
    M10 --> M13
    M03 --> M14
    M11 --> M14
    M04 --> M15
    M06 --> M15

    classDef base fill:#e1f5fe,stroke:#0277bd,color:#000
    classDef core fill:#fff9c4,stroke:#f57f17,color:#000
    classDef advanced fill:#fce4ec,stroke:#c2185b,color:#000
    classDef horizontal fill:#e8f5e9,stroke:#2e7d32,color:#000
    classDef applied fill:#f3e5f5,stroke:#7b1fa2,color:#000

    class M00,M01,M02 base
    class M03,M04,M05 core
    class M06,M07,M08,M09 advanced
    class M10,M11,M12 horizontal
    class M13,M14,M15 applied
```

### 1.2 五色分层

| 颜色 | 模块 | 定位 |
|---|---|---|
| 蓝（基础） | 00 / 01 / 02 | 所有方向都绕不开，顺序刚性 |
| 黄（核心） | 03 / 04 / 05 | 95% 工程师的吃饭栈，必须按 EVM → Solidity → 安全串起来 |
| 粉（协议专精） | 06 / 07 / 08 / 09 | 按方向只挑一条深耕 |
| 绿（横向） | 10 / 11 / 12 | 任意阶段并行接入，决定项目能否上线 |
| 紫（应用） | 13 / 14 / 15 | 至少熟一个才能做出落地产品 |

### 1.3 三条硬依赖链（跳过必踩坑）

**01 → 02 / 08**：椭圆曲线、哈希、Merkle 是后两者的语言。不懂 SHA-256 就不懂 PoW 为何安全，不懂 Merkle 树就读不懂 state proof。

**03 EVM → 04 Solidity**：Solidity 长得像 JS，初学者误以为可跳过 EVM。结果：把临时变量错写成 `storage`，gas 超限两个数量级；`stack / memory / storage / calldata` 四种数据位置永远分不清。

**04 → 05 → 06**：不会写合约就看不懂漏洞；DeFi 是漏洞收割机，没刷完 Ethernaut 1-15 就写资金路径等于裸奔。[rekt.news](https://rekt.news) 每年前 10 名累计损失常超 30 亿美元。

### 1.4 模块前置与产出

| 模块 | 前置 | 核心产出（可验证） | 时长 |
|---|---|---|---|
| 00 导论 | 无 | 3 条动机 + 6 个月目标 + 选定路径 | 0.5 周 |
| 01 密码学 | 00 | Python/TS 实现 SHA-256 对比 Keccak-256、ECDSA 签名验证、Merkle proof | 1 周 |
| 02 共识 | 01 | 本地起 PoS 双客户端（Geth+Lighthouse 或 Reth+Lodestar），观察 finality | 1 周 |
| 03 EVM | 02 | evm.codes 跟踪 1 笔 ETH 转账 + 1 笔 ERC-20 transfer 的全部 opcode | 1 周 |
| 04 Solidity | 03 | Foundry 项目：ERC-20、ERC-721、unit test、fuzz test，覆盖率 ≥ 90% | 3 周 |
| 05 安全 | 04 | Ethernaut 1-25、Damn Vulnerable DeFi v4 至少 5 关 writeup | 3 周 |
| 06 DeFi | 04+05 | Uniswap V2+V3+V4 hook 逐行 reading note，自写 minimal AMM | 3 周 |
| 07 L2 | 03 | 同一份合约部署到 OP Stack、Arbitrum Nitro、zkSync Era，对比 gas 与延迟 | 2 周 |
| 08 ZK | 01+03 | Circom 写 Merkle membership proof、Noir 写 password check | 3 周 |
| 09 替代生态 | 02 | Anchor token+NFT；可选 Move（Aptos/Sui）或 Cosmos SDK | 2-4 周 |
| 10 前端 | 04 | scaffold-eth-2 + wagmi + ERC-4337 smart account 完整流程 | 2 周 |
| 11 基础设施 | 03+05 | 自跑 Erigon/Reth 节点、起 Subgraph、可选 Flashbots 仿真 | 2-3 周 |
| 12 AI x Web3 | 04+06 | Claude/Cursor 写合约 → 自审 → 对比差异，写 lessons learned | 1-2 周 |
| 13 NFT 身份 | 04+10 | Solady 721+2981 mint 合约 + IPFS metadata + 1 个 Farcaster Frame | 2-3 周 |
| 14 去中心化存储 | 03+11 | 同一份 NFT metadata 上 IPFS/Filecoin/Arweave/Walrus，对比成本 | 1-2 周 |
| 15 DAO 治理 | 04+06 | OZ Governor v5.5 + Tally 集成 + token launch 白皮书 + 真实 DAO 提案 | 3 周 |

### 章末

- 记住：蓝→黄是刚性顺序，跳不了。
- 记住：每模块要有可验证的产出物，GitHub 公开。
- 记住：横向模块（10/11/12）决定项目能否上线，不是可选项。

---

## § 行业历史时间轴（事件驱动地图）

> TL;DR：Web3 不是平稳增长的工程领域，是被一连串**爆炸性事件**塑造出来的。每个事件都对应一类现在还在写的代码、还在跑的合规规则。下面 11 个节点是 Web2 工程师的"心智锚点"，详细技术机制见各对应模块。

**2014-02 Mt.Gox 崩盘**：日本东京交易所丢失约 85 万 BTC（当时市值 4.5 亿美元，2026-04 价位约 600 亿美元）。表层归因为 transaction malleability 攻击，深层是 Karpelès 长期挪用与会计造假。这件事直接催生了**现代 Proof-of-Reserves（PoR）**实践和"not your keys, not your coins"行业口号。详见 11 章基础设施。

**2016-06 The DAO 攻击**：Slock.it 募资 1.5 亿美元的链上风投基金被 reentrancy 攻击抽走 360 万 ETH（约 6000 万美元）。社区分裂导致 ETH/ETC 硬分叉——这是历史上第一次"代码即法律 vs 救济持币人"的公开对立。**reentrancy 从此成为安全教科书第一章**，OZ ReentrancyGuard 是每个新人写的第一个 modifier。详见 05 章。

**2017-Q3 ICO 退潮 + Howey Test 执法**：2017 年下半年至 2018 年 ICO 募资超 200 亿美元，1500+ 项目 90% 归零。SEC 启动 *Munchee*、*DAO Report*、Telegram、Kik 等系列执法，确立"以 Howey Test 判断 token 是否属于证券"的事实标准。后续 Ripple/XRP 案（2023 部分胜诉）、Coinbase/SEC 案（2024-10 撤诉）等都基于这一框架。**法务审查 token launch 的工作流由此成型**。

**2020 夏 DeFi Summer + 流动性挖矿**：Compound 6 月推出 COMP 治理代币空投，开启"yield farming"狂潮，TVL 从 10 亿美元 6 个月内冲到 200 亿美元。Uniswap V2、Yearn、Curve、Aave 在这个窗口同步爆发。**这是 Web2 工程师第一次大规模涌入 Solidity 写合约**，也是现代 DeFi 协议工程的诞生。详见 06 章。

**2022-05 Luna/UST 崩塌**：Terra 算法稳定币 UST 脱钩，Luna 从 80 美元一周内跌到 0.0001 美元（19000 倍稀释），蒸发约 600 亿美元。Do Kwon 后被韩国和美国双双起诉。**这一事件让"算稳"在监管层成为脏词**，直接推动了美国 GENIUS Act（2024 年提案、2025 年初通过）和欧盟 MiCA（2024-12 全面生效）对储备金型稳定币的强制 1:1 fiat backing。

**2022-06/07 暑假连锁清算**：Luna 暴雷触发 3AC（Three Arrows Capital）追加保证金失败 → 借出方 Celsius、Voyager、BlockFi 接连冻结提现 → 2023-01 Genesis 申请破产。串联机制是**未公开的链下信贷敞口**，同一份抵押被多家 prime broker 重复计入。教训：CeFi 黑箱的风险在 DeFi 之外，PoR + 链上抵押证明从此成为 CEX 合规底线。

**2022-08 Tornado Cash 制裁与 Roman Storm 案**：OFAC 把混币器 Tornado Cash 的智能合约地址列入 SDN 清单——**史上第一次制裁不可变代码**。开发者 Alexey Pertsev 在荷兰、Roman Storm 在美国先后被起诉。2025-03 美国财政部部分解除对合约地址的制裁（保留对个人的指控），Storm 案 2025 年开庭。这场官司直接定义了"写开源代码 vs 运营服务"的法律边界，每个 mixer/隐私协议工程师必读。

**2022-11 FTX/Alameda 崩盘**：CoinDesk 披露 Alameda 资产负债表中 FTT（FTX 自家代币）占比异常高，引发 CZ 抛售触发挤兑。FTX 一周内破产，约 80 亿美元客户资金被挪用至 Alameda 高风险头寸。SBF 2024-03 被判 25 年监禁。**这件事杀死了"trust the founder"叙事**，把 PoR、链上结算、自托管推到合规标配。详见 11 章。

**2023-03 SVB → USDC 脱钩**：硅谷银行倒闭，Circle 披露 33 亿美元储备卡在 SVB，USDC 跌至 0.87。FDIC 周末紧急接管后恢复脱钩。这件事让全行业重写**储备金披露规则**——Circle 改为月度 attestation + 每日 Treasury 持仓公开，Tether 也被迫加速透明化。稳定币工程师从此默认要做"reserve composition + redemption proof"集成。

**2024-07 Mt.Gox 14 万 BTC 还款分发**：破产管理人 Nobuaki Kobayashi 启动 10 年来首次大规模分发，约 14.2 万 BTC 通过 Kraken/Bitstamp/BitGo 等交易所打给债权人。市场短期承压（BTC 从 7 万跌至 5.4 万）。这是流动性风险管理（cliff vesting → linear unlock 设计）的真实压力测试，token 解锁曲线设计的反面教材。详见 15 章。

**2025-02 Bybit Hack 14.6 亿美元**：朝鲜 Lazarus Group 攻陷 Safe{Wallet} 一名前端开发者的 AWS session token，篡改 Safe UI 让 Bybit 多签签名人在不知情下批准了恶意交易，从 cold wallet 转走 40.1 万 ETH。**史上单笔最大加密盗窃**。教训：multisig 不是终点，前端供应链 + 签名内容验证（blind signing 是头号反派）才是。详见 05 章 + 11 章。

每个事件背后都是一类活的工程实践。读完这本书的目标，是让你看到下一次崩盘新闻时**第一反应是去看代码**，而不是看价格。

---

## 2. 12 周入门 / 24 周精通路径表

> TL;DR：12 周学会看 EVM、写 Solidity、通过 Ethernaut；24 周能审计合约、搭全栈 dApp、选定专精方向。

### 2.1 12 周入门路径（智能合约工程师基线）

| 周 | 模块 | 每周目标 | 产出检查点 |
|---|---|---|---|
| W1 | 00 导论 + 装环境 | 读完本文，装好环境，选定方向 | `forge init` 跑通，Sepolia ETH 已领 |
| W2 | 01 密码学 | 理解 hash / ECDSA / Merkle | Python 实现 ECDSA 签名验证 |
| W3 | 02 共识 | PoW vs PoS，finality 概念 | 本地起 Geth+Lighthouse 双客户端 |
| W4 | 03 EVM | opcode / stack / 四种数据位置 | evm.codes 跟踪 ERC-20 transfer |
| W5-6 | 04 Solidity 基础 | ERC-20 / ERC-721 / modifier | Foundry unit test 覆盖率 ≥ 90% |
| W7 | 04 Solidity 进阶 | proxy / gas optimization | UUPS + fuzz test 通过 |
| W8-9 | 05 安全 | 重入 / 访问控制 / 常见漏洞 | Ethernaut 1-15 关 writeup |
| W10 | 05 安全进阶 | Ethernaut 16-25 + DVDv4 | 至少 5 关 DVDv4 writeup |
| W11 | 10 前端 | wagmi + viem + ERC-4337 | scaffold-eth-2 dApp 能在 Sepolia 演示 |
| W12 | 06 DeFi 入门 | Uniswap V2 AMM 逻辑 | 自写 minimal AMM，测试覆盖 |

**12 周结束标准**：能独立写、测试、部署一个有安全意识的 ERC-20/ERC-721 合约，并有配套前端。

### 2.2 24 周精通路径（可选专精方向）

在 12 周基础上，继续 12 周按方向深耕：

| 周 | 通用方向 | 合约/安全方向 | 前端方向 | 协议/基础设施方向 |
|---|---|---|---|---|
| W13-14 | 06 DeFi 深耕 | Uniswap V3+V4 hook | ERC-4337 + EIP-7702 完整 UX | 11 基础设施：自跑节点 |
| W15-16 | 06 DeFi 深耕 | 写自己的 lending protocol | Privy/Dynamic embedded wallet | 11 Subgraph + Goldsky indexer |
| W17-18 | 07 或 08 | Code4rena 公开赛首战 | 13 NFT + Farcaster Frame | 11 MEV / Flashbots 仿真 |
| W19-20 | 07 或 08 | Sherlock 赛 / bounty | 14 去中心化存储集成 | 12 AI agent + 链上工具 |
| W21-22 | 09 替代生态 | 自选协议漏洞复盘 50 篇 | 全栈 dApp 上线 Base/Zora | 09 Solana Anchor 实战 |
| W23-24 | 方向收敛 | 公开审计报告首发 | 真实用户 dApp 上线 | 节点服务 / 公开 dashboard |

**24 周结束标准**：至少有 1 个公开运行的项目，或 1 份公开审计报告，或 1 个 protocol PR。

### 章末

- 记住：12 周只是基线，不等于找到工作。产出物公开才有效。
- 记住：表格是参考节奏，每周实际进度因人而异，±1 周正常。
- 记住：卡住就看 §4 怎么用这本书，不要独自死磕超过 2 小时。

---

## 3. 环境配置（macOS / Linux，2026-04 验证）

> TL;DR：所有运行时走版本管理器，否则被老项目锁死编译器。生产私钥用 Foundry keystore，不用 `.env` 明文。

### 3.1 版本管理器（强制）

- **Node.js**：`nvm`，装 Node 20 LTS + 22 LTS（wagmi v2/viem v2 要求 ≥18）。
- **Python**：`pyenv`，Slither/Mythril/ape 要 3.10+。
- **Rust**：`rustup`，nightly + stable 双装（Solana/Anchor/Reth/Foundry 源码编译）。
- **Solidity**：用 Foundry 自带切换，**不要 `brew install solc`**——brew 只装最新版，老项目必卡。
- **Foundry**：`foundryup`；生产项目锁版本：`foundryup --install <commit>`。

### 3.2 一键脚本：EVM 工具链

```bash
# ── Foundry（forge / cast / anvil / chisel）
curl -L https://foundry.paradigm.xyz | bash && foundryup

# ── Hardhat 3（2026-02 v3.1.12，性能关键路径用 Rust 重写）
pnpm add -D hardhat @nomicfoundation/hardhat-toolbox
npm i -g hardhat-shorthand   # 之后用 hh 代替 npx hardhat

# ── 静态分析
pipx install slither-analyzer
cargo install aderyn          # Cyfrin 的 Rust 实现，比 Slither 快 10x
npm i -g @halmoslabs/halmos   # 形式化 / symbolic execution
```

### 3.3 一键脚本：Solana / Move / ZK 工具链

```bash
# ── Solana CLI（2025 起迁到 release.anza.xyz，2026-04 stable = v3.1.9）
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

# ── Anchor（Solana 智能合约框架）
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install latest && avm use latest

# ── Reth 2.0（2026-04 发布 v2.0，Rust，Paradigm 出品）
git clone https://github.com/paradigmxyz/reth
cd reth && cargo install --locked --path bin/reth --bin reth

# ── Lighthouse（CL 客户端，Rust）
curl -LO https://github.com/sigp/lighthouse/releases/latest/download/lighthouse-x86_64-unknown-linux-gnu.tar.gz

# ── ZK：Circom + Noir
npm install -g snarkjs
git clone https://github.com/iden3/circom && cd circom && cargo install --path circom
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash && noirup

# ── Move：Sui / Aptos
brew install sui aptos  # macOS
```

### 3.4 Foundry 配置锁版本（生产必须）

```toml
# foundry.toml 示例
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.28"
evm_version = "cancun"        # 2026-04 主网 EVM 版本
optimizer = true
optimizer_runs = 10_000
via_ir = true

[invariant]
runs = 5000
depth = 50
fail_on_revert = false
show_metrics = true
```

Curve Vyper 事故部分原因是浮动编译器版本——`solc_version` 必须固定。

### 3.5 私钥安全（部署生产合约前必读）

私钥**绝不**进 git。流程：

1. `.env` 加 `.gitignore`；用 `direnv` 自动加载。
2. CI 用 GitHub Actions secrets。
3. 生产私钥用 Foundry keystore：

```bash
cast wallet import deployer --interactive
forge script Deploy.s.sol --account deployer --sender 0xYourAddr --broadcast
```

`--account` 签名时弹 password prompt 无法绕过——这正是安全价值所在。

### 章末

- 记住：版本管理器是护身符，跳过等于给自己埋路障。
- 记住：`.env` 明文私钥只能在 testnet 用，生产必须 keystore。
- 记住：`foundry.toml` 锁 `solc_version` 和 `evm_version`，永远。

---

## 4. 怎么用这本书

> TL;DR：搜→改→验三步循环，每模块写产出物，卡住超 2 小时就换策略。

### 4.1 学习三步循环（事件钩子）

1. **搜**：同一名词在 ethereum.org docs、Cyfrin Updraft、相关 EIP、原始论文各看一遍。不一致处往往是真知识。
2. **改**：写最小复现，故意改坏一行（把 `nonReentrant` 去掉），看测试失败。改坏比写对学到的多。
3. **验**：跑 `forge test -vvvv` 读完整 trace；或放 testnet 让钱包真签一次——确认按钮时你会注意到 gas、nonce、chainId 等平时被抽象的细节。

### 4.2 不变量驱动（Invariant-Driven）

每读一个协议先问"哪些状态绝不能违反？"，写成 Foundry invariant test 跑给自己看。

经典样本：
- Uniswap V2：swap 前后 `k = x * y` 不减（无手续费情况）。
- ERC-20：`sum(balanceOf(每地址)) == totalSupply()`。
- ERC-4626 vault：`totalSupply == sum(LP shares)`，用 ghost variable 在 handler 中累加跟踪。

`forge test --match-test invariant_*` 关键参数：默认 `runs=256, depth=15` 太弱，生产代码至少 `runs=5000, depth=50`，开 `show_metrics=true`。

### 4.3 三类笔记不要混

- **概念笔记**（Markdown，永久）：what + why，每概念一篇 3-5 段，手写不复制粘贴。
- **排错笔记**（issue tracker / Linear / Notion）：错误信息 + 复现步骤 + 解决路径。
- **源码 reading note**（写在 fork 注释里 commit 上去）：每 200 行写 5 行总结。

### 4.4 AI 使用边界

AI 是草稿生成器，不是决策者：

**可以放心用**：测试用例骨架、生成 fuzz test 输入、解释陌生代码、前端胶水代码、NatSpec、部署脚本。

**必须自己懂、不能交给 AI**：资金路径（`transfer/approve/call value`）、访问控制（`onlyOwner`/role）、签名校验与重放保护、upgradability 模式、跨合约调用、固定点数学。

工作流：`草稿（AI） → 人工逐行 review → invariant test → Slither/Aderyn → testnet 真签 → 第三方审计 → mainnet`

**绝不**让 AI 执行任何带私钥的命令。

### 4.5 反面教材（常见陷阱）

- **跳过密码学直接学 Solidity**：`ecrecover` 返回值要校验非零，ERC-2612 permit 需要 EIP-712 domain separator——密码学直接决定 Solidity 写法。
- **信任 AI 写资金路径**：编译通过 ≠ 安全 ≠ 经济正确。AI 不知道你的 oracle 有 1 分钟延迟或 token 有 transfer fee。
- **"学完所有再开始做"**：Web3 栈太宽，等"学完"早已过时。每完成一个模块写一个最小项目挂 GitHub。
- **不公开作品**：GitHub 私库 = 不存在。产出物必须可被外部访问。

### 章末

- 记住：搜→改→验，不是看→记→背。
- 记住：AI 写资金路径逐行 review，不是 copy-paste 上线。
- 记住：公开进度不是为了流量，是给招聘方和同行一个查证入口。

---

## 附录 A. 招聘画像（5 方向）

以下 5 条路径对应市场主流岗位，每条给出模块路径、核心技能、典型产出。

| 方向 | 模块路径 | 核心技能 | 典型产出 |
|---|---|---|---|
| 智能合约工程师 | 04→05→06 | Foundry、不变量测试、gas optimization | 3 个开源协议 PR、ERC 提案 draft、1000 行协议+测试套件 |
| 安全审计员 | 04→05→06→CTF | Ethernaut 全关、DVDv4、Secureum RACE | 50+ 份公开审计报告总结；Code4rena/Sherlock 首赛报告 |
| 前端/全栈工程师 | 04→10→11 | wagmi v2/viem v2/ERC-4337/EIP-7702 | 3 个公开 dApp，至少 1 个含 AA 流程、1 个有真实用户 |
| 协议研发员 | 01→02→03→07/08 | 密码学、PoS、ZK、客户端源码 | Ethereum 客户端非平凡 PR、EIP draft、ethresear.ch 有讨论帖 |
| 基础设施/MEV | 02→03→11 | RPC/indexer/MEV searcher/节点运维 | 公开运行服务（indexer / 公共 RPC / MEV bot 数据看板） |

**技术栈速查（2026 production-ready）：**

- 前端：Next.js 15 + React 19 + wagmi v2 + viem v2 + RainbowKit + shadcn/ui + Privy/Dynamic
- 执行层客户端：Geth（41%）、Reth 2.0（~20-25%，Base/OP 已迁移）、Erigon（archive，3-3.5 TB）
- 共识层客户端：Lighthouse、Prysm、Teku、Nimbus、Lodestar
- 安全竞赛：Code4rena（Zellic 收购，参与人数最多）、Sherlock（提供事后保险）、Cantina（审计员 stake）

### 职业地图：9 类 Web3 公司

> TL;DR：5 方向是技能侧，9 类公司是雇主侧。同样写 Solidity，在协议方、L2、审计所、AI×Web3 的日常完全不同——选哪类公司比选哪门语言更决定下一步。

**1. 协议方（Protocol Labs）** — 直接造 DeFi/Restaking 原语，估值最高、薪水顶配，对算法/经济学/安全审视极严。代表：**Uniswap Labs / Aave / Lido / EigenLayer Labs / Morpho / Pendle**。工作语言：Solidity 主，Rust 副（核心算子和 watcher 偏 Rust）。

**2. L2 / Rollup 团队** — 客户端、sequencer、bridge、proof system 全栈，工程量最大，跨执行层与共识层。代表：**OP Labs / Arbitrum Foundation / Matter Labs（zkSync）/ Scroll / Polygon Labs / Linea / Starknet / Taiko**。工作语言：Solidity（合约） + Rust（客户端、prover）+ Go（旧 fork）。

**3. 钱包 / 账户层** — UX 复杂度最高，签名安全是命脉，AA + passkey + EIP-7702 全链路。代表：**MetaMask / Rabby / Privy / Dynamic / Frame / Coinbase Smart Wallet / Safe**。工作语言：TypeScript 主 + 安全审视 + 部分原生（iOS/Android secure enclave）。

**4. CEX / 中心化交易所** — 撮合引擎、风控、托管、上币、清结算，量化在内，规模最大，合规最重。代表：**Coinbase / Binance / OKX / Bybit / Kraken / Bitget**。工作语言：Go / Java / Rust 后端 + TypeScript 前端 + Python 风控。

**5. 做市商 / Prop Trading** — 高频、链上 MEV、跨场套利，门槛最高，薪水也最离谱。代表：**Wintermute / Jump Crypto / GSR / DRW / Cumberland / Flow Traders**。工作语言：Rust / C++ 高频 + Python 策略，对延迟和数学要求极高。

**6. VC / 投研机构** — 投后服务、技术尽调、研究报告、portfolio 协调。代表：**a16z crypto / Paradigm / Pantera / Polychain / HashKey / Multicoin / Variant / 1confirmation**。工作语言：TypeScript 投后工具 + 研究为主（Python/SQL/链上数据）。

**7. 审计所 / 安全公司** — 协议代码逐行审计，形式化验证、fuzzing、bounty 平台。代表：**OpenZeppelin / Trail of Bits / Cyfrin / Spearbit / ChainSecurity / Zellic / Halborn / Quantstamp**。工作语言：Solidity 深 + Halmos / Certora / K Framework / Foundry invariant，重写比读懂更重要。

**8. 基础设施 / DevTools** — RPC、indexer、oracle、bridge、节点托管、监控、CI。代表：**Alchemy / Infura / Chainlink / The Graph / Pyth / Goldsky / Tenderly / Blockscout**。工作语言：Go / Rust 后端 + TypeScript 控制面 + DevOps（K8s / Terraform 重度）。

**9. AI × Web3** — 链上推理网络、ML 训练协调、agent 经济、隐私 ML。代表：**Bittensor / Gensyn / Sahara / Olas / Ritual / Hyperbolic**。工作语言：Python ML（PyTorch/JAX）+ Solidity 经济层 + Rust 节点。详见 12 章。

**华人创立的公司值得关注**：**Conflux**（龙凡，Tree-Graph PoW，2021 上线香港金科沙盒）、**Plasma Labs**（BTC-secured stablecoin L1，2024 主网，Founders Fund 领投）、**Goplus**（链上安全 SaaS，wallet/dApp 端实时风险扫描）、**Babylon**（David Tse，BTC staking 协议）、**Matter Labs / zkSync**（Alex Gluchowski 团队含华人核心）、**Pendle**（Vu Gaba Vineb + 华人核心，yield trading 头部）。

**怎么挑**：薪资上限 1≈5>2>3>8>4>7>9>6；学习曲线 5≈7>1≈2>9>3>4>8>6；签证/远程友好度 7≈8>2>1>9>3>6>4>5（做市商基本不远程）。第一份工作建议：协议方（深度）或审计所（广度）任选其一，三年后再切换不迟。

---

## 附录 B. 工具链锚点表

| 工具 | 类别 | 安装命令 / 地址 | 备注 |
|---|---|---|---|
| Foundry | EVM 测试框架 | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` | forge/cast/anvil/chisel |
| Hardhat 3 | EVM 测试框架 | `pnpm add -D hardhat` | v3.1.12，Rust 重写关键路径 |
| Slither | 静态分析 | `pipx install slither-analyzer` | Trail of Bits 出品 |
| Aderyn | 静态分析 | `cargo install aderyn` | Cyfrin，比 Slither 快 10x |
| Halmos | 形式化验证 | `npm i -g @halmoslabs/halmos` | symbolic execution |
| Solana CLI | Solana 工具链 | `sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"` | 2025 起迁到 anza.xyz |
| Anchor | Solana 框架 | `cargo install --git ...coral-xyz/anchor avm` | avm install latest |
| Reth | EL 客户端 | github.com/paradigmxyz/reth | v2.0（2026-04），Rust |
| Lighthouse | CL 客户端 | github.com/sigp/lighthouse | Rust，Sigma Prime |
| Circom + snarkjs | ZK | `npm install -g snarkjs` + cargo circom | Iden3 |
| Noir | ZK | `curl -L ...noirup/install \| bash && noirup` | Aztec |
| Ethernaut | 安全 CTF | ethernaut.openzeppelin.com | 30+ 关，2025-09 新增 4 关 |
| DVDv4 | 安全 CTF | damnvulnerabledefi.xyz | Damn Vulnerable DeFi v4 |
| evm.codes | EVM 参考 | evm.codes | opcode 成本查询 |
| Tenderly | trace 调试 | tenderly.co | 比 Etherscan 友好 10 倍 |
| L2BEAT | L2 监控 | l2beat.com | stage 分类 + TVL |
| scaffold-eth-2 | 全栈模板 | github.com/scaffold-eth/scaffold-eth-2 | wagmi+viem+RainbowKit |

**IDE：**
- VS Code：插件 *Solidity (Juan Blanco)* + *Hardhat Solidity* + *Even Better TOML* + *GitLens*；`solidity.formatter` 设 `forge`。
- Cursor：Composer mode 写测试快，写资金路径必须人工 review。

**钱包/浏览器：**
- MetaMask（开发）+ Rabby（日常）+ Safe（多签）+ Coinbase Smart Wallet（passkey）
- MetaMask Flask 用于测试 EIP-7702/4337 新特性
- RPC：Alchemy + Infura（主备）；永远不在前端 hardcode RPC URL。

---

## 附录 C. 资源清单与社区

### C.1 必读书（按方向极简选）

| 方向 | 首选（只读 1 本） | 进阶 |
|---|---|---|
| 通用入门 | *Mastering Ethereum* 2nd Ed（O'Reilly 2025-11-11，github.com/ethereumbook） | *Upgrading Ethereum*（eth2book.info，免费） |
| 合约工程 | 同上 | *RareSkills Book of Solidity Gas Optimization*（rareskills.io/book，免费） |
| 安全审计 | *Fundamentals of Smart Contract Security*（Richard Ma，Quantstamp） | Secureum RACE 1-41 题库 |
| ZK | *Proofs, Arguments, and Zero-Knowledge*（Justin Thaler，免费 PDF） | *The MoonMath Manual*（github.com/LeastAuthority/moonmath-manual） |
| Solana | *Solana Development with Rust and Anchor*（Sebastian Dine） | *The Rust Programming Language*（doc.rust-lang.org/book） |
| Bitcoin | *Programming Bitcoin*（Jimmy Song，O'Reilly 2019） | *Mastering Bitcoin*（Antonopoulos，2nd/3rd） |
| DeFi/DAO | *DeFi and the Future of Finance*（Harvey et al，Wiley 2021） | *Token Economy*（Voshmgir，token.kitchen，部分免费） |
| 密码学 | *Real-World Cryptography*（David Wong） | — |

**第一个项目**（通用）：Cyfrin Updraft Foundry Fundamentals（免费，60+ 小时）→ Speedrun Ethereum 10 关。CryptoZombies 停留在 2018 年，不推荐。

### C.2 免费课程平台

| 平台 | 强项 | 检索日 |
|---|---|---|
| Cyfrin Updraft | 安全审计、DeFi 实战、ZK Solidity；100% 免费，可获 SSCD+ 证书 | 2026-04 |
| Speedrun Ethereum | 全栈 dApp 直觉、scaffold-eth；10 关含 ZK Voting | 2026-04 |
| Solana Developer Bootcamp 2024 | Solana 全栈最权威免费，20 小时 | 2026-04 |
| Alchemy University | JS for Ethereum；内容停留较早 | 2026-04，免费 |

**付费进阶**：RareSkills Solidity Bootcamp（$5,850，13 周，下期 2026-06-04）；RareSkills ZK Bootcamp（16 周）；Atrium Uniswap Hook Incubator（免费+申请制，9 周）。Secureum Epoch∞ 已暂停，但 RACE 1-41 题库仍是行业事实标准。

### C.3 信息渠道

**Newsletter（每周）：**
- *Week in Ethereum News*（Evan Van Ness）：最高信噪比
- *Bankless Newsletter*：日刊 3 分钟
- *a16z crypto* / *Paradigm* research blog

**论坛：**
- ethresear.ch（协议研究）、ethereum-magicians.org（EIP 讨论原始现场）
- rekt.news（事故复盘，每周 1 篇，半年 25 篇安全直觉暴涨）

**Twitter/X Pin 列表（不刷主页）：**
- 协议研发：@VitalikButerin, @drakefjustin, @dankrad, @lightclients, @TimBeiko
- 安全：@samczsun, @0xfoobar, @PatrickAlphaC, @transmissions11, @bytes032
- DeFi：@haydenzadams, @0xMaki, @StaniKulechov, @AndreCronjeTech
- L2/ZK：@bkiepuszewski, @dabit3, @anna_rrose
- 基础设施/MEV：@bertcmiller, @phildaian, @0xQuintus

**会议（年度必看录像）：**
Devcon/Devconnect（协议路线图首发）、ZK Summit、ETHGlobal 黑客松（找 finalist 源码读一遍）

### C.4 Ethereum Roadmap 速览（2026-04）

- **Pectra**（2025-05-07）：EIP-7702 / EIP-7251 / EIP-7002 / EIP-7549 / EIP-7691 / EIP-2935 / EIP-7623 / EIP-7685，账户抽象事实标准。
- **Fusaka**（2025-Q4）：PeerDAS 落地，L2 数据成本进一步下降。
- **Glamsterdam**（2026 H1）：ePBS + BAL（EIP-7928），目标 L1 10000 TPS 区间。

---

## 附录 D. 自审记录

完成每个模块后在这里打勾，或另建学习日志文件维护。公开进度不是为流量，是给招聘方和同行一个查证入口。

### D.1 环境准备

- [ ] `forge init` 跑通，`forge test` 通过
- [ ] Sepolia ETH 已领取（[faucet.quicknode.com](https://faucet.quicknode.com) 或 [sepoliafaucet.com](https://sepoliafaucet.com)）
- [ ] `.env` 已加入 `.gitignore`
- [ ] Foundry keystore 配置完毕（`cast wallet import`）
- [ ] VS Code / Cursor 插件装好，`solidity.formatter` 设为 `forge`

### D.2 模块完成情况

| 模块 | 产出物 URL | 完成日期 | 备注 |
|---|---|---|---|
| 00 导论 | — | | 6 个月目标已写下 |
| 01 密码学 | | | ECDSA 验证实现 |
| 02 共识 | | | 本地双客户端节点 |
| 03 EVM | | | evm.codes 跟踪记录 |
| 04 Solidity | | | GitHub repo 链接 |
| 05 安全 | | | Ethernaut writeup |
| 06 DeFi | | | minimal AMM repo |
| 07 L2 | | | 三链部署对比笔记 |
| 08 ZK | | | Circom / Noir repo |
| 09 替代生态 | | | Anchor token repo |
| 10 前端 | | | dApp URL |
| 11 基础设施 | | | 节点 / indexer URL |
| 12 AI x Web3 | | | lessons learned blog |
| 13 NFT 身份 | | | mint 合约 + Frame |
| 14 存储 | | | 对比笔记 |
| 15 DAO 治理 | | | 提案 + 白皮书 |

### D.3 方向选定

- [ ] 已选定主方向：_______________
- [ ] 已加入相关社区（Discord / Telegram）：_______________
- [ ] GitHub profile 公开，已 pin 产出物

### D.4 进度里程碑

| 里程碑 | 目标日期 | 完成日期 |
|---|---|---|
| 装好环境，跑通 `forge init` | | |
| 完成蓝色三模块（00/01/02） | | |
| 完成黄色三模块（03/04/05） | | |
| Ethernaut 1-15 关全部 writeup | | |
| 12 周入门路径完成 | | |
| 24 周精通路径完成 | | |
| 第一个公开项目上线 | | |

---

*下一步：`01-密码学基础/README.md`。已熟悉哈希/椭圆曲线/Merkle tree 可跳到 `02-区块链原理与共识/`。*

