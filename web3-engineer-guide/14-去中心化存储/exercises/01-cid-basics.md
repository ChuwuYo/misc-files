# 练习 01：本地 CID 计算

## 目标

不联网情况下，理解 CID 是怎么从内容算出来的，并能解释 CIDv0 vs CIDv1 的差异。

## 任务

### 任务 1.1（必做）

写一段 Node.js 脚本，对以下三个字符串分别计算 CIDv1（dag-pb + sha256 + base32）：

1. `"hello"`
2. `"hello"`（与第一个完全相同）
3. `"hello "`（多一个空格）

**预期**：
- 1 和 2 的 CID 完全相同（**确定性**）
- 3 与前两者完全不同（**抗冲突**）

### 任务 1.2（必做）

把同一段内容用 `unixfs(helia, { rawLeaves: true })` 和 `unixfs(helia, { rawLeaves: false })` 各算一次 CID，比对结果。

**思考**：
- 两次结果一致吗？
- 如果不一致，哪一个是 Pinata 默认产生的？
- 为什么这是上传后比对失败的高频原因？

### 任务 1.3（选做）

CIDv0 形如 `QmXXX...`，CIDv1 形如 `bafy...`。用 multiformats 库把同一份内容的 CIDv0 转换为 CIDv1，并解释：

- `Qm` 开头是怎么来的
- 同一内容的 v0 和 v1 应该编码同一个 multihash digest，验证之

## 提交格式

`solution-01/` 下：
- `solve.mjs` 完整代码
- `result.txt` 执行输出
- `notes.md` 简答

## 答案要点（先自己做再看）

<details><summary>展开</summary>

```javascript
import { createHelia } from 'helia';
import { unixfs } from '@helia/unixfs';

const helia = await createHelia({ start: false });
const fs = unixfs(helia);

const a = await fs.addBytes(new TextEncoder().encode('hello'));
const b = await fs.addBytes(new TextEncoder().encode('hello'));
const c = await fs.addBytes(new TextEncoder().encode('hello '));

console.log(a.toString() === b.toString());  // true
console.log(a.toString() === c.toString());  // false
```

`Qm` 来源：CIDv0 = base58btc(0x12 0x20 + sha256digest)，前两字节固定 → base58 编码后必以 `Qm` 开头。

</details>
