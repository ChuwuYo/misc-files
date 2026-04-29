# 模块 14 代码示例

模块 14《去中心化存储》配套可运行示例。

## 目录结构

```
code/
├── package.json                       Node 依赖（Helia / Pinata / Irys / Lighthouse）
├── .env.example                       环境变量模板（复制为 .env 填值）
├── 01-helia-local-cid.mjs             本地计算 CID（不联网）
├── 02-pinata-upload.mjs               上传到 Pinata + CID 校验
├── 03-lighthouse-upload.mjs           上传到 Lighthouse（IPFS + Filecoin）
├── 04-irys-upload.mjs                 通过 Irys 上传到 Arweave
├── 05-walrus-upload.sh                通过 walrus CLI 上传到 Walrus
├── 06-cid-verify.mjs                  跨网关 CID 校验
├── 07-multi-platform-redundancy.mjs   多平台冗余上传
├── health-check.mjs                   生产环境每日健康检查
└── nft-dapp/
    ├── foundry.toml
    ├── contracts/MyNFT.sol            ERC-721 with immutable IPFS baseURI
    ├── script/Deploy.s.sol            Foundry 部署脚本
    └── upload-metadata.mjs            批量上传图片 + metadata 到双平台
```

## 快速开始

```bash
# 1. 安装依赖
cd code
npm install

# 2. 配置环境
cp .env.example .env
# 编辑 .env，填入 PINATA_JWT / LIGHTHOUSE_API_KEY / PRIVATE_KEY

# 3. 跑示例
npm run cid:local                            # 本地 CID 计算
echo "Hello" > sample.txt
node 02-pinata-upload.mjs sample.txt         # 上传 Pinata
node 04-irys-upload.mjs sample.txt           # 上传 Arweave
node 06-cid-verify.mjs <CID>                 # 跨网关验证
```

## NFT dApp 完整流程

```bash
cd nft-dapp

# 1. 准备 images/ 和 metadata/ 目录
# 2. 上传到 IPFS
node upload-metadata.mjs
# 输出形如 BASE_URI="ipfs://bafy.../"

# 3. 部署合约（Sepolia 测试网）
export BASE_URI="ipfs://bafy.../"
export OWNER=0xYourAddress
export PRIVATE_KEY=0x...
forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC --broadcast --verify
```

## 注意事项

- 所有依赖版本 pin 在 `package.json`，2026-04 验证通过
- Walrus 不通过 npm，需单独装 sui CLI 和 walrus client
- Irys 上传需要钱包有 ETH（即使存在 Arweave，bundler 替你换 AR）
- Lighthouse 一次付费永久存的报价随 FIL 价格波动
- 生产环境永远不要把 .env 提交到 git
