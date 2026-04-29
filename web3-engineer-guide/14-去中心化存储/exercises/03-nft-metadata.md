# 练习 03：上传 NFT 元数据

## 目标

完整跑一遍 NFT 元数据上传流程：图片 → metadata → IPFS 双平台。

## 任务

### 任务 3.1

准备 5 个 NFT：
- 5 个 PNG 图片（任意，每个 < 200 KB）
- 5 个 JSON metadata（含 name / description / image / attributes 字段）

### 任务 3.2

写脚本 `upload.mjs`：
1. 上传 images 目录到 Pinata，得到 imagesCid
2. 改写 metadata 中的 image 字段为 `ipfs://<imagesCid>/<filename>`
3. 上传 metadata 目录到 Pinata，得到 metaCid
4. 同步上传 metadata 到 Lighthouse（双备份）
5. 输出最终的 `BASE_URI=ipfs://<metaCid>/`

### 任务 3.3

跨网关验证：
- 用 `https://ipfs.io/ipfs/<metaCid>/1.json` 拉一个 metadata
- 解析 image 字段
- 用 `https://ipfs.io/ipfs/<imagesCid>/1.png` 验证图片可达

### 任务 3.4（选做）

实现一个 simulation：
- 模拟 Pinata 失效（替换为不存在的 JWT）
- Lighthouse 备份是否还能完整恢复 metadata + 图片？
- 写一个 `recover.mjs` 演示从 Lighthouse 单平台读回数据

## 提交格式

`solution-03/`:
- `images/` `metadata/` 原始数据
- `upload.mjs` `recover.mjs`
- `result.md` 包含两个 CID + 测试网关的结果截图

## 评分

- baseURI 是否真 immutable（不出现 mutable 字段）
- metadata 内 image 是否用 `ipfs://` 而非 `https://`
- 两平台 CID 是否比对一致
- recover 脚本能否在 Pinata 失效时仍跑通
