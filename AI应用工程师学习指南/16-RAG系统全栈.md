# 第 16 章 · RAG 系统全栈构建（从 Naive 到 Agentic）

> 上一章（第 15 章）讲了 LangChain / LlamaIndex 给的现成脚手架：LCEL 一行链起检索 + prompt + LLM，LlamaIndex 的 `VectorStoreIndex.from_documents` 三行起一个 demo。但这两套都把"检索"做成了黑盒。本章把这个黑盒拆开——切分、embedding、混合检索、重排、contextual retrieval、GraphRAG、Agentic RAG 一层层过——目的是让你知道框架的 retriever 在做什么、哪里调得动、什么时候该自己绕开它手写。换句话说，第 15 章给你"怎么编排 LLM 应用"，本章给你"怎么把外部知识喂进去这件事做对"。

> 2024-09，Anthropic 在博客 [Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval) 里给了一组让 RAG 工程师集体重写代码的数字：在他们的内部基准上，纯向量检索的 top-20 失败率是 5.7%；加上 contextual embedding + contextual BM25 + reranker 之后，失败率降到 1.9%——**67% 的相对下降，全部不靠换模型，只靠改 pipeline**。
>
> 2025-03，一家做内部知识库 RAG 的中型 SaaS 公司给我看了他们的工单数据：78% 的"AI 答错"工单，根因不是 LLM 弱，而是检索没召回。其中一半（约 39%）是切分错误——把跨页表格切成两半、把代码块和注释拆开；另一半是查询和文档的语言风格不一致，"How do I cancel my subscription?" 和文档里的 "Subscription Termination Procedure" 根本不在 embedding 空间的同一侧。
>
> 这两件事是本章的起点。RAG 不是"塞文档进 prompt"那么简单。它是**一个有十层以上的 pipeline，每一层都可以独立把准确率从 90% 砍到 30%**。本章的目标，是把这十层全部摊开来讲，并给出一套从 Naive RAG 到 Agentic RAG 的可跑代码。

---

## 0. RAG 是什么、何时用 RAG vs 微调

### 0.1 一句话定义

RAG（Retrieval-Augmented Generation，检索增强生成）：在 LLM 推理前，先从外部知识库里检索相关片段，把它们拼进 prompt，让模型基于这些片段回答。

它解决三个问题：

- **知识时效性**。LLM 的训练数据有截止日期，公司昨天发布的产品文档不在里面。
- **幻觉**。当模型不知道答案时，倾向于编造而不是承认。把答案放进上下文，模型只需要"复读 + 整理"，编造空间就小很多。
- **私有知识**。公司内部 wiki、客户工单、合同条款，不可能也不应该放进基础模型里。

### 0.2 RAG vs 微调：选型决策树

工程师常被问的问题：「我有 10 万条客服对话，应该 fine-tune 还是 RAG？」答案不是非此即彼，是看你想让模型学**事实**还是学**行为**。

| 维度 | RAG | 微调 |
|------|-----|------|
| 注入新事实 | 强项 | 弱项（容易遗忘旧知识） |
| 学习风格、语气、格式 | 弱项 | 强项 |
| 知识更新频率 | 改一份文档就生效 | 重训整个 adapter |
| 引用与溯源 | 天然支持 | 几乎不可能 |
| 单次推理成本 | 高（长上下文） | 低 |
| 可解释性 | 高（能看到检索片段） | 低 |
| 起步门槛 | 一周做 demo | 至少一个月 + 显卡 |

**经验法则**：

- 知识 → RAG。
- 风格 / 格式 / 工具调用偏好 → 微调（或 prompt 工程）。
- 知识 + 风格 → 微调一个会"按公司语气说话"的模型，外接 RAG 给事实。
- 私有知识不能离开公司机房 → RAG（embedding 模型可以本地部署）。

**反例**：有团队为了让模型回答得"更专业"，把 50 万条 FAQ 全部 fine-tune 进去，结果模型记住了 30%、混淆了 50%、彻底遗忘了 20%。同样的数据塞进 RAG，第一周准确率就到 80%。LLM 的参数空间是**有限**的，知识塞太多会挤掉别的能力——这是 2024 年起业界的共识。

### 0.3 RAG 的两种基础形态

```
形态 A · Stuffing（塞）：
[query] → [embed] → [向量库 top-k] → [拼进 prompt] → [LLM] → answer

形态 B · 长上下文直接喂：
[query + 全部文档（< 200K tokens）] → [LLM with prompt cache] → answer
```

Anthropic 的 contextual retrieval 博客明确说了：**知识库小于 20 万 tokens（约 500 页）时，配合 prompt cache，直接整本喂模型可能比搭 RAG 更省事**。RAG 是给「不能整本喂」的场景用的——10 万份合同、3 千万行代码、整个企业 wiki。

本章主要讲形态 A，因为它是大多数生产场景的形态。

---

## 1. Naive RAG：四步最简版

### 1.1 流程

```
1. 把所有文档切成 chunk
2. 每个 chunk 调 embedding 模型，得到向量，存进向量库
3. 用户提问 → 同一个 embedding 模型 → 查向量库 top-k
4. 把 top-k 拼进 prompt → 调 LLM → 输出
```

四步，60 行代码，第一周就能跑起来。但 Naive RAG 在生产里几乎一定会翻车，原因后面慢慢拆。先把骨架立起来：

```python
# naive_rag.py — 一份能跑的最简 RAG
import os
from openai import OpenAI
import chromadb

client = OpenAI()
db = chromadb.PersistentClient(path="./chroma_db").get_or_create_collection("docs")

def embed(texts: list[str]) -> list[list[float]]:
    resp = client.embeddings.create(model="text-embedding-3-small", input=texts)
    return [d.embedding for d in resp.data]

def chunk(text: str, size: int = 500, overlap: int = 50) -> list[str]:
    chunks, i = [], 0
    while i < len(text):
        chunks.append(text[i:i + size])
        i += size - overlap
    return chunks

def ingest(doc_id: str, text: str):
    parts = chunk(text)
    db.add(
        ids=[f"{doc_id}-{i}" for i in range(len(parts))],
        documents=parts,
        embeddings=embed(parts),
    )

def ask(question: str, k: int = 5) -> str:
    hits = db.query(query_embeddings=embed([question]), n_results=k)
    context = "\n\n".join(hits["documents"][0])
    prompt = f"基于以下上下文回答问题。如果上下文里没有答案，说不知道。\n\n上下文：\n{context}\n\n问题：{question}"
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
    )
    return resp.choices[0].message.content

if __name__ == "__main__":
    ingest("py-tutorial", open("python-tutorial.txt").read())
    print(ask("Python 里 list 和 tuple 的区别是什么？"))
```

### 1.2 Naive RAG 在哪些场景下会翻车

按出现概率从高到低：

1. **切错**——把表格切成两半、代码和注释分家、Markdown 标题和正文分离。检索回来的片段意思都对不上。
2. **embedding 不匹配**——查询是口语，文档是正式文体，向量空间错位。
3. **召回缺位**——top-5 没召回，再厉害的 LLM 也救不了。
4. **上下文塞太多**——top-20 全部拼进 prompt，模型在 30 个段落里找不到重点（"lost in the middle" 现象，[Liu et al. 2023](https://arxiv.org/abs/2307.03172)）。
5. **多跳问答失败**——「张三的导师在哪里读的博士？」需要先找到张三的导师是李四，再找李四的简历。一次向量查询解决不了。

后面的章节就是逐个修这些问题。

---

## 2. 文档处理：切分质量是 RAG 头号问题

### 2.1 加载：不同格式不同坑

| 格式 | 推荐工具 | 坑点 |
|------|----------|------|
| PDF（文字层） | PyMuPDF (fitz) | 双栏排版会把左右栏交叉读出来 |
| PDF（扫描件 / 图） | Docling、unstructured + OCR、ColPali（直接图片检索） | OCR 错字率 |
| HTML | trafilatura、readability | 把 nav / footer 当正文 |
| Office（docx/xlsx/pptx） | unstructured、python-docx | 表格行列丢失 |
| Markdown | langchain MarkdownHeaderTextSplitter | 简单，几乎没坑 |
| 代码 | Tree-sitter（按 AST 切） | 普通切分会把函数砍半 |

2024-2025 年最值得关注的两个新工具：

- **[Docling](https://github.com/DS4SD/docling)**（IBM Research，2024 开源）：专门解决科研论文/报告里复杂版面的 PDF 解析，对表格、公式、图表做结构化输出。在多栏论文上比 PyMuPDF 干净得多。
- **[unstructured](https://github.com/Unstructured-IO/unstructured)**：通用文档转 element 流，每个 element 带类型（Title / NarrativeText / Table / ListItem），下游切分时可以按类型组织。

经验数据：在金融年报这类「有大量表格的 PDF」上，PyMuPDF 直接抽文字，下游 RAG 准确率约 55%；换 Docling 之后能到 78%。**解析阶段的天花板，决定了 RAG 整体的天花板**。

### 2.2 切分：五种切分策略对比

切分（chunking）的核心矛盾：

- 切太大 → 单个 chunk 包含太多无关信息，embedding 被稀释，检索精度下降。
- 切太小 → 上下文不完整，比如代码片段缺函数签名、合同条款缺主语。

**策略一：固定大小 + overlap**

最朴素，按字符数 / token 数硬切。50 行能写完。问题是会切断语义单元——句子中间、表格中间、代码中间都可能被切。

**策略二：递归切分（Recursive）**

LangChain 的 `RecursiveCharacterTextSplitter`，按一组分隔符（`\n\n`、`\n`、` `、``）依次尝试，优先在段落、句子、词的边界切。在没有结构信息的纯文本上是默认选择。

**策略三：Markdown / 结构感知切分**

文档本身有结构（Markdown 标题、HTML h1-h6、Word heading）就别浪费。按标题切，每个 chunk 自然形成一个语义单元。

```python
from langchain_text_splitters import MarkdownHeaderTextSplitter

splitter = MarkdownHeaderTextSplitter(headers_to_split_on=[
    ("#", "h1"), ("##", "h2"), ("###", "h3"),
])
docs = splitter.split_text(markdown_text)
# 每个 doc 自带 metadata: {"h1": "...", "h2": "..."}
```

切出来的 chunk 自带层级元数据，后面可以用来做 metadata 过滤。

**策略四：语义切分（Semantic Chunking）**

Greg Kamradt 在 [5 Levels of Text Splitting](https://github.com/FullStackRetrieval-com/RetrievalTutorials) 里提出。算法：

1. 把文档切成句子。
2. 给每个句子算 embedding。
3. 计算相邻句子的余弦相似度，得到一条曲线。
4. 在相似度低谷处断开（"话题切换点"）。

理论很美，实测在 well-structured 的文档上比 recursive 提升 3-5 个点；在松散的对话/邮件里几乎没差。**只在长篇连续文本（论文、长报告）上值得用，且要用快的 embedding 模型，不然 ingest 阶段会很慢**。

**策略五：代码 AST 切分**

代码不能按字符切。Tree-sitter 提供了主流语言的 parser，可以按函数 / 类 / 模块切。

```python
# 伪代码：用 tree-sitter 切 Python 代码
import tree_sitter_python
from tree_sitter import Language, Parser

PY = Language(tree_sitter_python.language())
parser = Parser(PY)
tree = parser.parse(source.encode())

chunks = []
for node in tree.root_node.children:
    if node.type in ("function_definition", "class_definition"):
        chunks.append(source[node.start_byte:node.end_byte])
```

代码 RAG（如 GitHub Copilot Workspace 类应用）这是必修。

### 2.3 切分尺寸的经验值

没有绝对答案，但有一个稳健的起点：

| 场景 | 推荐 chunk size（tokens） | overlap |
|------|--------------------------|---------|
| 通用文档 QA | 300-500 | 50 |
| 长文档摘要式问答 | 800-1200 | 100 |
| 代码 RAG | 按函数 / 类 | 0 |
| FAQ / 短文档 | 整段不切 | 0 |
| 多语言混合 | 偏短（300） | 50 |

**关键原则**：chunk size 应该和你的查询粒度匹配。用户问「这个 API 怎么用」→ chunk 应该是单个 API 文档单元；用户问「这个项目的架构」→ chunk 应该是章节级。

### 2.4 切分质量自检清单

切完之后，从切片里**随机抽 30 个**，逐个看：

- [ ] chunk 是否切在语义边界？还是切在句子中间？
- [ ] 表格是否被切成两半？
- [ ] 代码块是否完整？
- [ ] 标题是否和正文一起？还是孤零零一个标题？
- [ ] 引用关系是否成立？比如 chunk 里出现"如上图所示"，但图不在这个 chunk 里。

30 个里有超过 5 个不达标，说明切分策略要重做。**这一步是 RAG 工程里最容易被跳过、又最值得投入的**。

---

## 3. Embedding：模型选型决定检索的天花板

### 3.1 Embedding 模型的核心指标

- **维度**：通常 256-4096。维度越高表达能力越强，但存储和查询成本同步上升。
- **上下文窗口**：能编码多长的文本。通常 512-8192 tokens，BGE-M3 / Qwen3 系列做到 8K。超长则截断，影响很大。
- **多语言能力**：纯英文模型（OpenAI 老版）在中文文档上排序经常失序。
- **MTEB / C-MTEB 排名**：[MTEB Leaderboard](https://huggingface.co/spaces/mteb/leaderboard) 是最权威的多任务榜单，C-MTEB 是中文专版。

### 3.2 主流模型横评（2026-04 视角）

| 模型 | 维度 | 上下文 | 中英文 | 部署 | 备注 |
|------|------|--------|--------|------|------|
| OpenAI text-embedding-3-large | 3072（Matryoshka 可降到 256/1024 等） | 8191 | 中文一般、英文好 | API only | 工程默认选项之一 |
| OpenAI text-embedding-3-small | 1536（Matryoshka 可降维） | 8191 | 中文一般 | API only | 便宜，准确率打六折 |
| Cohere Embed v4 | 1536（Matryoshka 256/512/1024/1536） | 128K | 多语言强、含图文 | API | 100+ 语言、SOTA 多模态搜索 |
| Cohere embed-multilingual-v3 | 1024 | 512 | 多语言极强 | API | 老款，仍在维护，跨语言检索好 |
| Voyage voyage-4-large（MoE） | 1024（可量化 int8 / 1bit） | 32K | 英文 SOTA | API | 2025 年 MoE 旗舰，比 voyage-3-large 更准更便宜 |
| Voyage voyage-3-large | 1024（Matryoshka） | 32K | 英文好 | API | 仍可用，2025-01 发布的上代旗舰 |
| Jina jina-embeddings-v4 | 2048（Matryoshka 可降到 128） | 32K | 多语言 + 多模态 | API + 开源（3.8B） | 2025-06，文本/图像/代码统一，支持单/多向量 |
| Jina jina-embeddings-v3 | 1024 | 8192 | 多语言均衡 | API + 开源 | 老款，支持任务指令前缀 |
| **BGE-M3** | 1024 | 8192 | 中英文均衡、SOTA | 开源（约 568M） | dense+sparse+colbert 三合一 |
| **Qwen3-Embedding-8B** | 4096（Matryoshka 32-4096） | 32K | 中英文 SOTA | 开源 | 2025-06，MTEB 多语榜 No.1（70.58） |
| Qwen3-Embedding-0.6B / 4B | 1024 / 2560 | 32K | 强 | 开源 | 资源受限场景首选 |
| nomic-embed-text-v1.5 | 768（可降到 64） | 8192 | 英文好 | 开源 | Matryoshka 嵌入 |

**选型建议**：

- **闭源 API 起步**：直接 OpenAI text-embedding-3-large、Voyage voyage-4-large 或 Cohere Embed v4，少踩坑。
- **中文为主，预算敏感，要本地部署**：BGE-M3（约 568M，单卡 A10 能跑）。
- **追求中文 SOTA、有 8B 显存预算**：Qwen3-Embedding-8B。
- **多语言、跨语言检索**：Cohere Embed v4 或 BGE-M3。
- **PDF / 图文 / 表格混合内容**：Jina v4 或 Cohere Embed v4（原生多模态）。

### 3.3 一个常被忽略的细节：Asymmetric Search

很多 embedding 模型（BGE、Qwen3、Jina v3/v4）支持「query 和 document 用不同 prefix」的 asymmetric search。例如：

```python
# BGE-M3 推荐用法（如果用作 query encoder）
query_embedding = model.encode("如何取消订阅", prompt_name="query")
doc_embedding = model.encode("订阅终止流程：登录后台...", prompt_name="passage")
```

不加 prefix 的检索准确率会低 3-8 个点，工程上这是「免费午餐」必须吃。

### 3.4 BGE-M3 的特殊地位：三合一

[BGE-M3](https://github.com/FlagOpen/FlagEmbedding) 同时输出三种向量：

- **Dense**：标准的语义向量。
- **Sparse（lexical weight）**：类似 BM25 的稀疏关键词权重，但是学出来的。
- **Multi-vector（ColBERT-style）**：每个 token 一个向量，late interaction。

一个模型同时支撑 dense + sparse + late-interaction 三种检索路径，是 2024 年之后做混合检索的事实标准。

---

## 4. 检索：从单一向量到混合 + 多向量

### 4.1 向量检索的算法层

向量库本质是 ANN（Approximate Nearest Neighbor）。两类主流索引：

- **HNSW**（Hierarchical Navigable Small World）：图索引，构建慢、查询快、内存开销大。Qdrant、Weaviate、Chroma 默认。
- **IVF + PQ**（Inverted File + Product Quantization）：适合上亿级，准确率略低，内存友好。FAISS、Milvus 常用。

工程经验：百万级文档 HNSW 够用；上亿级再考虑 IVF-PQ + 重排两段式。

### 4.2 BM25 / SPLADE：稀疏检索没死

向量检索的弱点：**精确匹配差**。用户搜「错误码 ECONNREFUSED」，向量检索可能把别的"连接错误"召回到前面，把真正含 ECONNREFUSED 的文档排到第 30 名。

- **BM25**（Okapi BM25）：经典稀疏检索算法，本质是改进版 TF-IDF。Elasticsearch / OpenSearch 默认。
- **SPLADE**（[paper 2021](https://arxiv.org/abs/2107.05720)）：神经稀疏检索，用 BERT 学每个 token 的稀疏权重。准确率比 BM25 高，但 indexing 比 BM25 慢。

**结论**：BM25 至今在「关键词、专有名词、错误码、版本号」类查询上仍然是 SOTA。**纯向量替代 BM25 的论调过于激进，工程上 99% 的场景应该是 dense + sparse 混合**。

### 4.3 混合检索（Hybrid Search）

最简单、最有效、最被低估。流程：

```
1. dense 路径：query → embedding → 向量库 top-100
2. sparse 路径：query → tokenize → BM25 top-100
3. 用 RRF 合并，输出 top-50
4. 重排器选 top-10 给 LLM
```

**Reciprocal Rank Fusion (RRF)** 的合并公式简单到不可思议：

```
score(d) = Σ over each retriever  1 / (k + rank_i(d))
```

`k` 通常取 60。每个文档在每个检索器里的排名倒数加起来，按总分排序。**没有调参、没有训练、效果好得离谱**。这是 [Cormack et al. 2009](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf) 的方法，在 2024-2025 年又被 RAG 界重新发现。

```python
def rrf_merge(rank_lists: list[list[str]], k: int = 60) -> list[str]:
    """rank_lists: [[doc_id_rank1, doc_id_rank2, ...], ...]"""
    scores = {}
    for ranks in rank_lists:
        for rank, doc_id in enumerate(ranks):
            scores[doc_id] = scores.get(doc_id, 0) + 1 / (k + rank + 1)
    return sorted(scores, key=scores.get, reverse=True)
```

Anthropic 的 contextual retrieval 实验显示：纯 dense baseline top-20 失败率 5.7%；加上 contextual embedding（不含 BM25）降到 3.7%（-35%）；contextual embedding + contextual BM25 降到 2.9%（-49%）；最后再加 reranker 降到 1.9%（-67%）。两条 sparse/dense 路并行，是最便宜的提升。

### 4.4 多向量检索：ColBERT 与 ColPali

**ColBERT v2**（[Khattab et al. 2021](https://arxiv.org/abs/2112.01488)）：每个 token 一个向量（不是整段一个向量），查询时做 token 级 late interaction：

```
score(q, d) = Σ over q_tokens  max over d_tokens  cos(q_t, d_t)
```

对每个 query token，找文档里最相似的 token，求和。这样能保留 token 级匹配信息，对长文档、多概念查询效果显著。

**代价**：存储量是 dense 的 N 倍（每 chunk 平均 256 个 token）。ColBERT v2 用 PQ 把存储砍到原来 1/6-1/10，但仍然比单向量贵。

**ColPali**（[2024-07](https://arxiv.org/abs/2407.01449)）：把 ColBERT 的 late interaction 思路搬到视觉。用 VLM（PaliGemma）直接编码 PDF 页面图像，每页输出多向量，跳过 OCR 和切分。

ColPali 在含表格、图表、信息图的 PDF 上把 retrieval recall 比传统 OCR + dense 提了 10-15 点。**对于"PDF 主要是图、表格、扫描件"的场景（金融、法律、医疗），这是 2024 年最重要的范式转移之一**。

### 4.5 实操：Qdrant 混合检索完整代码

```python
# hybrid_retrieval.py
# 依赖：qdrant-client >= 1.10（Universal Query API），FlagEmbedding
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, VectorParams, SparseVectorParams,
    PointStruct, SparseVector,
    Prefetch, FusionQuery, Fusion,
)
from FlagEmbedding import BGEM3FlagModel

client = QdrantClient(":memory:")
model = BGEM3FlagModel("BAAI/bge-m3", use_fp16=True)

# 1. 创建 collection，同时存 dense + sparse
client.create_collection(
    collection_name="hybrid",
    vectors_config={"dense": VectorParams(size=1024, distance=Distance.COSINE)},
    sparse_vectors_config={"sparse": SparseVectorParams()},
)

# 2. 编码 + 入库
def encode_and_upsert(docs: list[str]):
    out = model.encode(docs, return_dense=True, return_sparse=True)
    points = []
    for i, doc in enumerate(docs):
        sparse = out["lexical_weights"][i]
        points.append(PointStruct(
            id=i,
            vector={
                "dense": out["dense_vecs"][i].tolist(),
                "sparse": SparseVector(
                    indices=[int(k) for k in sparse.keys()],
                    values=[float(v) for v in sparse.values()],
                ),
            },
            payload={"text": doc},
        ))
    client.upsert(collection_name="hybrid", points=points)

# 3. 混合查询：RRF 合并 dense + sparse
def hybrid_search(query: str, top_k: int = 10):
    out = model.encode([query], return_dense=True, return_sparse=True)
    dense_q = out["dense_vecs"][0].tolist()
    sparse_q = out["lexical_weights"][0]

    results = client.query_points(
        collection_name="hybrid",
        prefetch=[
            Prefetch(query=dense_q, using="dense", limit=50),
            Prefetch(
                query=SparseVector(
                    indices=[int(k) for k in sparse_q.keys()],
                    values=[float(v) for v in sparse_q.values()],
                ),
                using="sparse", limit=50,
            ),
        ],
        query=FusionQuery(fusion=Fusion.RRF),
        limit=top_k,
    )
    return [(p.payload["text"], p.score) for p in results.points]
```

---

## 5. 重排（Rerank）：把检索从 80% 拉到 95%

### 5.1 为什么需要重排

向量检索的本质是**双塔（bi-encoder）**：query 和 doc 各自独立编码，最后做点积。这种结构便宜——doc embedding 可以离线算好——但牺牲了 query 和 doc 的交互。

重排器是**交叉编码（cross-encoder）**：把 query 和 doc 拼成一个序列，过一个完整 transformer，输出相关度分数。这样能捕捉细粒度交互，准确率显著高于双塔。**代价是不能预计算**——必须 online 跑，所以只对 top-N 做（N 通常 50-200）。

```
两段式检索：
[query] → [向量库] → top-100（粗排，召回为主）
                  ↓
              [reranker] → top-10（精排，准确率为主）
                  ↓
              [LLM]
```

### 5.2 主流 reranker

| 模型 | 类型 | 部署 | 备注 |
|------|------|------|------|
| Cohere Rerank v3.5 | 商用 cross-encoder | API | 2024-12 发布，4096 ctx，100+ 语言 SOTA |
| Jina Reranker v2 (multilingual) | cross-encoder | API + 开源 | 性价比高，多语言均衡 |
| **bge-reranker-v2-m3** | 开源 cross-encoder（约 568M） | 本地 | 中英文均衡，部署门槛低 |
| **Qwen3-Reranker-0.6B / 4B / 8B** | 开源 cross-encoder | 本地 | 2025-06 发布，8B 比 0.6B 提升约 3 个点 |
| Voyage rerank-2.5 | 商用 cross-encoder | API | 英文领域强 |

[Aimultiple Rerankers Benchmark](https://aimultiple.com/rerankers) 的对比里，Qwen3-Reranker-4B 的 Hit@1 达到 77.67%，bge-reranker-v2-m3 在 MTEB-R 上 57.03。**结论**：

- 不想付费、要中文、要本地部署 → bge-reranker-v2-m3 是最稳的起点。
- 追求开源 SOTA → Qwen3-Reranker（按显存预算选大小，8B 最强）。
- 不想自己部署 → Cohere Rerank v3.5（多语言 + 4K 上下文）或 Jina Reranker v2。

### 5.3 LLM-as-reranker

用 LLM（GPT-4o-mini、Claude Haiku）做重排：

```python
prompt = f"""给定查询和候选文档，输出每个文档的相关度分数（0-10）。

查询：{query}

候选：
{enumerate_docs(docs)}

输出 JSON：[{{"id": 0, "score": 8}}, ...]"""
```

优点：可解释、可定制（可以让 LLM 优先关注某些维度）。缺点：贵、慢、不稳定。

工程经验：当你**已经有专用 reranker**，再上 LLM-as-reranker 通常没收益。当你**没有 reranker、又有特殊业务规则**（"医疗回答优先来自 FDA 来源"），LLM-as-reranker 是合理选择。

### 5.4 重排到底有多少收益

Anthropic contextual retrieval 实验（"top-20 失败率" = 1 - recall@20）：

| 配置 | top-20 失败率 |
|------|---------------|
| dense only | 5.7% |
| Contextual Embeddings | 3.7% |
| Contextual Embeddings + Contextual BM25 + RRF | 2.9% |
| 上一行 + reranker | **1.9%** |

**重排单独贡献了把失败率从 2.9% 砍到 1.9%——34% 的相对下降**。如果你的 RAG 还没上 reranker，这是 ROI 最高的一次升级。

### 5.5 实操：BGE Reranker 集成

```python
from FlagEmbedding import FlagReranker

reranker = FlagReranker("BAAI/bge-reranker-v2-m3", use_fp16=True)

def rerank(query: str, candidates: list[str], top_k: int = 5):
    pairs = [[query, c] for c in candidates]
    scores = reranker.compute_score(pairs, normalize=True)
    indexed = sorted(enumerate(scores), key=lambda x: x[1], reverse=True)
    return [(candidates[i], s) for i, s in indexed[:top_k]]
```

---

## 6. 进阶 RAG 技术

到这里基础 pipeline 已经搭完：切分 → 混合检索 → 重排 → LLM。下面是从 80% 准确率往 95% 推的工程手段。

### 6.1 HyDE：用假答案找真文档

[Gao et al. 2022 · Precise Zero-Shot Dense Retrieval without Relevance Labels](https://arxiv.org/abs/2212.10496)。

**问题**：用户的查询是问句（"如何取消订阅"），文档是陈述（"订阅终止流程"）。两者在 embedding 空间天然有距离。

**HyDE 解法**：先让 LLM 写一个**假设性答案**，然后用这个答案去检索，而不是用原始查询。

```python
def hyde_search(query: str, top_k: int = 5):
    # 1. 生成假设答案
    hypo_prompt = f"针对下列问题，写一段 100-150 字的简明答复，模仿技术文档的语气。\n\n问题：{query}"
    hypo = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": hypo_prompt}],
    ).choices[0].message.content

    # 2. 用假答案检索
    return retrieve(hypo, top_k)
```

**有效场景**：

- 查询很短（< 10 词）。
- 用户用口语，文档用书面语。
- 跨语言检索（让 LLM 把中文问题"答"成英文，再去查英文文档）。

**失效场景**：

- LLM 对该领域完全不懂，生成的假答案是错的，检索就被带偏。
- 查询本身已经包含足够信息（"transformer attention 公式"）。

**经验**：HyDE 不是万能 trick，它的方差大。值得 A/B 实验，但别盲信。

### 6.2 查询改写（Query Rewriting / Decomposition）

用户的查询可能是模糊的、复合的、需要拆解的。LLM 改写比直接检索好。

**多查询扩展（Multi-Query）**：

```python
prompt = f"""为下列用户问题生成 3 个不同角度的检索查询，覆盖不同关键词。

用户问题：{query}

输出 JSON：["查询1", "查询2", "查询3"]"""
```

把生成的 3 个查询各自检索，结果合并去重。对召回率提升明显。

**问题分解（Decomposition）**：

```
原问题：「张三的导师在哪所大学读的博士？」

LLM 分解：
  - sub_q1: 张三的导师是谁？
  - sub_q2: <sub_q1 答案>在哪所大学读博士？
```

这是多跳问答的标准范式。LangChain 的 [Self-Querying Retriever](https://python.langchain.com/docs/how_to/self_query/) 和 LlamaIndex 的 [SubQuestion Engine](https://docs.llamaindex.ai/en/stable/examples/query_engine/sub_question_query_engine/) 都是这个思路。

**Step-Back Prompting**（[Zheng et al. 2023](https://arxiv.org/abs/2310.06117)）：先让 LLM 把具体问题"退一步"问出原则性问题。

```
原问题：「为什么 PVO_3 在 200K 以下会有金属-绝缘体相变？」

step-back: 「过渡金属氧化物的金属-绝缘体相变机制是什么？」
```

先用 step-back 问题检索原理性文档，再回到原问题用具体证据答。在物理 / 化学 / 法律这种"先讲原理再讲个案"的领域提升明显。

### 6.3 父子文档（Small-to-Big）

**矛盾**：

- 嵌入小 chunk（300 token）→ 检索精度高，但单 chunk 上下文不足。
- 嵌入大 chunk（2000 token）→ 上下文足，但精度差。

**解法**：嵌入小 chunk 做检索，命中后把它的**父 chunk**（包含小 chunk 的更大段落）拼进 prompt。

```python
@dataclass
class ChildChunk:
    text: str
    parent_id: str

# ingest 时
parents = chunk_large(doc, size=2000)
children = []
for p in parents:
    for c in chunk_small(p.text, size=300):
        children.append(ChildChunk(text=c, parent_id=p.id))

# retrieve 时
hits = vector_search(query)            # 命中 child
parent_ids = {h.parent_id for h in hits}
contexts = [parent_lookup[pid] for pid in parent_ids]  # 取 parent 喂 LLM
```

LlamaIndex 的 [HierarchicalNodeParser](https://docs.llamaindex.ai/en/stable/examples/node_parsers/HierarchicalNodeParser/) 内置了这套结构。

### 6.4 Auto-Merging Retrieval

Small-to-big 的进阶版：维护一棵"chunk 树"，叶子节点是最小单元。检索命中多个叶子时，如果它们大多在同一个父节点下，**自动合并成父节点**喂给 LLM，避免重复。

```
父节点 P1
├── 叶子 L1 [命中]
├── 叶子 L2 [命中]
└── 叶子 L3 [命中]
父节点 P2
└── 叶子 L4 [命中]

→ 输出：P1（合并 L1+L2+L3）+ L4
```

LlamaIndex 的 [Auto-Merging Retriever](https://docs.llamaindex.ai/en/stable/examples/retrievers/auto_merging_retriever/) 直接可用。

### 6.5 RAPTOR：层级摘要

[Sarthi et al. 2024 · Stanford](https://arxiv.org/abs/2401.18059)。

**问题**：用户问「这本 200 页的书的核心论点是什么？」——任何一个 chunk 都答不了，需要全局视角。

**RAPTOR 解法**：自底向上构建一棵摘要树：

```
Level 0: 原始 chunks（叶子）
         ↓ embed + cluster
Level 1: 每个 cluster 用 LLM 生成摘要
         ↓ embed + cluster
Level 2: 摘要的摘要
         ...
```

检索时同时在所有 level 上查向量库。具体问题命中叶子，全局问题命中高层摘要。

**代价**：indexing 时要调多次 LLM 做摘要，比 naive RAG 贵 5-10 倍。**只对会被反复查的稳定知识库值得做**——比如教科书、产品手册、不常更新的内部 wiki。每天变的工单数据库不要做 RAPTOR，indexing 成本会失控。

### 6.6 Contextual Retrieval（Anthropic 2024-09）

[Anthropic 博客](https://www.anthropic.com/news/contextual-retrieval) 提出，是过去两年 RAG 改进里**ROI 最高的单点优化之一**。

**问题**：chunk 被切出来后失去上下文。一句"它的销售额比上季度增长 12%"，没有"它"指什么、"上季度"是哪个季度。embedding 出来的向量含义不清。

**Contextual Retrieval 解法**：每个 chunk 入库前，让 LLM 写一段"situating context"——这个 chunk 在原文档里的上下文位置说明——拼到 chunk 前面，再去 embed。

```python
CONTEXTUAL_PROMPT = """<document>
{whole_document}
</document>

下面是这个文档里的一个片段：
<chunk>
{chunk_content}
</chunk>

请写一段简短上下文（50-100 字），说明这个片段在整个文档里的位置和角色，让该片段单独被检索时也能被理解。只输出上下文，不要解释。"""

def contextualize(whole_doc: str, chunk: str) -> str:
    resp = client.messages.create(
        model="claude-haiku-4-5",  # 2025-10 发布；用便宜模型即可，配 prompt cache 把 whole_doc 缓住
        max_tokens=200,
        messages=[{"role": "user", "content": CONTEXTUAL_PROMPT.format(
            whole_document=whole_doc, chunk_content=chunk,
        )}],
    )
    return resp.content[0].text

# ingest 时
contextualized = f"{contextualize(whole_doc, chunk)}\n\n{chunk}"
```

每个 chunk 都过一遍 LLM，听起来贵——但 Anthropic 用 prompt cache 把整本文档缓存住，每个 chunk 只需要付 chunk 那部分 token 的钱，**总成本约 $1.02 / 百万 tokens**。

数据：纯 contextual embedding 把 top-20 失败率从 5.7% 降到 3.7%（35% 相对下降）。配合 contextual BM25 降到 2.9%（49%），再加 reranker 累计降到 1.9%（67%）。

**这个方法的优雅之处**：它不要求改 embedding 模型、不要求改向量库、不要求改 LLM，只在 ingest 阶段多调一次廉价 LLM。能加进任何现有 pipeline。

**自己实现时的成本估算**（这是 Anthropic 博客没明说的）：

```
每 chunk 成本 ≈ (cached_doc_tokens × cache_read_price)
              + (chunk_tokens × input_price)
              + (~80 output_tokens × output_price)

总成本 ≈ N_chunks × 每 chunk 成本
```

代入 Claude Haiku 4.5（2025-10）参考价：input $0.80 / Moutput $4 / Mcache write $1 / Mcache read $0.08 / M。一份 50 页文档（约 30K tokens），切 60 个 chunk（每个 ≈ 500 tokens）：

- cache write 一次：30K × $1/M ≈ $0.030
- 每 chunk：30K × $0.08/M (cache read) + 500 × $0.80/M + 80 × $4/M ≈ $0.0024 + $0.0004 + $0.00032 ≈ $0.0031
- 60 chunks × $0.0031 + 一次 cache write $0.030 ≈ $0.22 / 文档

**关键前提（缺一项就翻车）**：

1. **必须启用 prompt cache**——不开 cache，每个 chunk 都要全量送整本 doc，成本会乘以 20-100×。
2. **doc 必须 ≥ 1024 tokens**（Claude prompt cache 的最小缓存单位），太短的文档不要用 contextual retrieval，直接用 chunk 原文即可。
3. **TTL 内打完所有 chunk**——Claude 默认 cache 5 分钟，超时要重新付 cache write，所以 ingest 时一份文档的所有 chunk 应该连续打完，不要中间穿插别的请求。
4. **超长文档（> 200K tokens）拆段处理**——一份 1000 页报告整本缓存超过模型上下文窗口，要按章节拆成多个"sub-document"分别 cache。

**估算一下你的项目**：1000 万 tokens 知识库（约 1.5 万页），按 500 tokens/chunk 切 = 2 万 chunks，按上面公式 ≈ $60-100 一次性 ingest 成本。**听起来不贵，但记住"一次性"前提是文档不变**——文档每周更新一次，成本要乘以更新频率。频繁变动的工单库不要做 contextual retrieval，ROI 是负的。

### 6.7 Self-RAG / CRAG：自我反思

**Self-RAG**（[Asai et al. 2023](https://arxiv.org/abs/2310.11511)）：训练一个会自己决定**何时检索、检索结果是否有用、答案是否充分**的模型。通过特殊 reflection token（`[Retrieve]`、`[Relevant]`、`[Supported]`、`[Useful]`）实现。优点是端到端；缺点是要专门训模型，工程上罕见落地。

**CRAG**（[Yan et al. 2024 · Corrective RAG](https://arxiv.org/abs/2401.15884)）：更工程友好。流程：

```
1. 检索 top-k
2. 用一个轻量级评估器（论文用 T5-large，0.77B）打分
3. 路由：
   - high confidence → 直接用检索结果
   - medium → 检索结果 + 网络搜索补充
   - low → 抛弃检索，只用网络搜索
4. 用 decompose-then-recompose 算法过滤无关 chunk
5. 生成
```

CRAG 是 Self-RAG 的"插即用"版，不需要重训生成模型。在 LangGraph 里可以直接复刻。

---

## 7. GraphRAG：当向量检索解决不了的时候

### 7.1 向量检索的盲区

把全部文档切成片段后，**实体之间的关系**就丢了。问「张三和李四是什么关系」时，向量检索可能找回"张三的简历"和"李四的简历"，但回答不了。

知识图谱（KG）天生擅长这件事，但传统 KG 的痛点是**构建昂贵 + 查询语言陡峭**（Cypher、SPARQL 不是工程师默认会的）。

### 7.2 Microsoft GraphRAG（2024-04）

[Microsoft Research GraphRAG](https://github.com/microsoft/graphrag) 把 KG 的构建交给 LLM：

```
Phase 1 · Indexing（贵）
  1. 切 chunks
  2. 对每个 chunk 调 LLM 抽取 (entity, entity_type, description) 和 (entity_a, entity_b, relationship)
  3. 合并实体（entity resolution）
  4. 构建图
  5. 跑 Leiden 社区检测，得到层级社区
  6. 对每个社区生成摘要

Phase 2 · Query
  - Local search：从 query 关联的实体出发遍历图
  - Global search：用所有社区摘要做 map-reduce
```

**Local search** 适合具体问题（"张三的导师是谁"）；**Global search** 适合全局问题（"这份合同集合的主要风险点是什么"）——后者是普通向量 RAG 的死穴。

**代价**：[paperclipped.de 的实测](https://www.paperclipped.de/en/blog/graph-rag-production/)显示，500 页文档纯向量入库不到 5 美元，GraphRAG 入库要 50-200 美元。1 万份文档时 indexing 成本会到四位数。

### 7.3 LightRAG（2024-10）

[HKU LightRAG](https://github.com/HKUDS/LightRAG) 把 GraphRAG 砍掉社区检测和层级摘要，只保留实体抽取和扁平图：

```
1. 抽实体 + 关系（一次 LLM 调用）
2. 入库（实体表 + 关系表 + 向量库三套并存）
3. 查询时双路：
   - low-level：从 query 实体出发的 1-hop / 2-hop 邻居
   - high-level：query 主题相关的关系子图
4. 二者融合喂 LLM
```

LightRAG 的 indexing 成本相对 GraphRAG 大幅下降（论文给出的对比是 500 页约 0.5 美元 / 3 分钟 vs. 50-200 美元 / 数小时，差异接近 100×），质量保留 70-90%。**在不需要全局摘要的场景下，LightRAG 是更工程的选择**。

> **数字校准**：100× 的成本差是 LightRAG 论文里的有利对比——它假设 GraphRAG 跑了完整 Leiden 社区检测 + 多层级摘要，而 LightRAG 只抽实体关系。**工程实测的差异更常见落在 10-50× 区间**，取决于：(1) GraphRAG 的 community level 切到几层；(2) 用什么模型抽实体（gpt-4o vs gpt-4o-mini vs Qwen3-32B 差一个数量级）；(3) 是否启用 entity resolution。所以**别把"100× 便宜"作为选型唯一理由**——先算自己语料的 token 量 × 抽取调用次数 × 模型单价，得出工程估值，再决定要不要上 Graph 系。

### 7.4 Neo4j Graphiti（2024-11）

Neo4j 官方的 Graphiti 主打**时序知识图谱**——每条事实带时间戳，能回答"2024-Q3 时供应商 A 的状态是什么"这种带时间维度的问题。这是金融、法律、医疗领域的硬需求。

### 7.5 何时用 GraphRAG / LightRAG

| 场景 | 推荐 |
|------|------|
| 多跳推理（A 的 B 的 C） | Graph 系 |
| 全局摘要类查询 | Microsoft GraphRAG |
| 实体关系密集的领域（生物医药、企业关系网、法律条文） | Graph 系 |
| 时间敏感数据 | Graphiti |
| 短文档 / FAQ / 单领域知识 | 普通 RAG（GraphRAG 是过度设计） |
| 预算敏感 / 文档频繁更新 | LightRAG |
| 需要 SOTA 全局回答能力且预算充足 | Microsoft GraphRAG |

**Graph 不是银弹**。普通 RAG 已经能解决 70% 的企业问题，剩下 30% 里只有一部分需要 Graph。把所有 RAG 都搞成 Graph，是 2024-2025 流行过的过度工程。

### 7.6 LightRAG 最小可跑示例

```python
# light_rag_demo.py
import asyncio
from lightrag import LightRAG, QueryParam
from lightrag.llm.openai import openai_complete_if_cache, openai_embed
from lightrag.utils import EmbeddingFunc

WORKING_DIR = "./light_rag_workspace"

async def llm(prompt, system_prompt=None, history=None, **kwargs):
    return await openai_complete_if_cache(
        "gpt-4o-mini", prompt,
        system_prompt=system_prompt, history_messages=history or [], **kwargs,
    )

async def embed(texts):
    return await openai_embed(texts, model="text-embedding-3-small")

async def main():
    rag = LightRAG(
        working_dir=WORKING_DIR,
        llm_model_func=llm,
        embedding_func=EmbeddingFunc(
            embedding_dim=1536, max_token_size=8192, func=embed,
        ),
    )
    await rag.initialize_storages()

    with open("docs.txt") as f:
        await rag.ainsert(f.read())

    # local：实体邻居
    print(await rag.aquery("张三的导师是谁？", param=QueryParam(mode="local")))
    # global：主题摘要
    print(await rag.aquery("整体讲了什么？", param=QueryParam(mode="global")))
    # hybrid：双路融合
    print(await rag.aquery("张三和李四怎么认识的？", param=QueryParam(mode="hybrid")))

asyncio.run(main())
```

---

## 8. Agentic RAG：让 Agent 自己决定怎么查

### 8.1 从 Pipeline 到 Loop

到目前为止 RAG 都是**固定 pipeline**：检索 → 重排 → 生成，一条直线走完。Agentic RAG 改成**循环**：

```
Plan → Retrieve → Critique → (Rewrite | Re-retrieve | Answer)
   ↑__________________________|
```

Agent 每一步都可以决定：

- 这个问题需要检索吗？还是直接答？
- 检索回来的结果够不够？
- 不够的话，要换查询、补查询还是分解查询？
- 答案有没有引用支撑？没有就重来。

### 8.2 LangGraph 实现 Agentic RAG

LangGraph（[官方文档](https://langchain-ai.github.io/langgraph/)）是 LangChain 团队 2024 年推出的 cyclic graph 编排框架，专门给这种"带循环、带状态、带条件分支"的 agent 用。

下面是一个**Self-Reflective RAG**的核心结构（参考 [LangChain 博客](https://blog.langchain.com/agentic-rag-with-langgraph/)）：

```python
# agentic_rag.py（精简版）
from typing import TypedDict, Literal
from langgraph.graph import StateGraph, END

class State(TypedDict):
    question: str
    rewrites_left: int
    documents: list[str]
    grade: Literal["relevant", "irrelevant", ""]
    answer: str

def retrieve(state: State) -> dict:
    docs = vector_search(state["question"], k=5)
    return {"documents": docs}

def grade_documents(state: State) -> dict:
    """让 LLM 评估检索结果"""
    prompt = f"""判断以下文档是否能回答问题，回答 yes/no。
问题：{state["question"]}
文档：{chr(10).join(state["documents"])}"""
    grade = llm_call(prompt).strip().lower()
    return {"grade": "relevant" if "yes" in grade else "irrelevant"}

def decide_next(state: State) -> str:
    if state["grade"] == "relevant":
        return "generate"
    if state["rewrites_left"] > 0:
        return "rewrite"
    return "fallback"  # 改投网搜或返回"未知"

def rewrite_query(state: State) -> dict:
    new_q = llm_call(f"重写下列查询使之更明确：{state['question']}")
    return {"question": new_q, "rewrites_left": state["rewrites_left"] - 1}

def generate(state: State) -> dict:
    ans = llm_call(f"基于上下文回答。\n上下文：\n{chr(10).join(state['documents'])}\n问题：{state['question']}")
    return {"answer": ans}

graph = StateGraph(State)
graph.add_node("retrieve", retrieve)
graph.add_node("grade", grade_documents)
graph.add_node("rewrite", rewrite_query)
graph.add_node("generate", generate)

graph.set_entry_point("retrieve")
graph.add_edge("retrieve", "grade")
graph.add_conditional_edges("grade", decide_next, {
    "generate": "generate", "rewrite": "retrieve", "fallback": END,
})
graph.add_edge("generate", END)

app = graph.compile()

result = app.invoke({"question": "...", "rewrites_left": 2,
                     "documents": [], "grade": "", "answer": ""})
```

完整生产版还会加：

- **document grader**（分别给每个文档打分而不是全量打分）
- **answer grader**（生成完之后再验证答案是否真的从 context 里来）
- **hallucination grader**（专门判断有没有出现 context 之外的事实）
- **fallback to web search**（CRAG 思路）
- **checkpoint / 人工介入**（LangGraph 1.0 内置）

### 8.3 Agentic RAG 的代价

每个查询要调 3-7 次 LLM（粗排 grade、改写、再 grade、生成、再验证），延迟从普通 RAG 的 1-2 秒变成 5-15 秒，成本是普通 RAG 的 3-5 倍。

**经验**：

- 客服 / 内部 QA / 内容创作辅助 → 延迟敏感，普通 RAG + 强 reranker 通常够。
- 法律 / 医疗 / 金融研究 → 准确率优先，Agentic RAG 值得。
- 高频 / 大流量 → 用 Agentic RAG 做 fallback，普通 RAG 做主路径。

---

## 9. 评估：RAG 工程的真正硬骨头

> 「我们换了 BGE-M3，准确率提升了 8%」——这句话如果没有评估集和明确指标，就是一句空话。RAG 工程师 70% 的时间该花在评估和数据集建设，而不是换模型。

### 9.1 评估的两个层

```
检索层：召回是否拿到了正确的 chunk
生成层：基于这些 chunk 答得对不对、有没有幻觉
```

两层的指标完全不同，不能混着看。

### 9.2 检索层指标

假设有一个**评估集**：每条记录是 `(question, ground_truth_chunks, ...)`。

- **Hit Rate@K**：top-K 里有没有命中至少一个正确 chunk。简单粗暴，看召回。
- **MRR (Mean Reciprocal Rank)**：第一个正确答案的 rank 倒数。看排序质量。
- **NDCG@K**（Normalized Discounted Cumulative Gain）：考虑相关度等级，看精细排序。
- **Recall@K / Precision@K**：召回率 / 精确率。

```python
def hit_rate_at_k(retrieved, ground_truth, k=5):
    return int(any(d in ground_truth for d in retrieved[:k]))

def mrr(retrieved, ground_truth):
    for i, d in enumerate(retrieved):
        if d in ground_truth:
            return 1 / (i + 1)
    return 0
```

**评估集从哪来**？三种方法，按工程难度排序：

1. **手标 100 条 golden set**：质量最高、最可靠，工作量最大。生产 RAG 必须有，无论多少都要做。
2. **从用户日志挖**：从历史问答里取真实问题，人工标注「这个回答对不对、用了哪些 chunk」。
3. **LLM 合成**：用 GPT-4 / Claude 让它读文档生成 (question, chunk) 对。便宜量大，质量参差。**只能做补充，不能替代手标**。

### 9.3 生成层指标：ragas 框架

[ragas](https://github.com/explodinggradients/ragas) 是 RAG 评估的事实标准，基于 LLM-as-judge。核心指标：

| 指标 | 衡量什么 | 需要什么 |
|------|---------|---------|
| **Faithfulness** | 答案的每个事实是不是都来自 context（反幻觉） | question + context + answer |
| **Answer Relevancy** | 答案是不是切题（不跑题） | question + answer |
| **Context Precision** | context 里相关 chunk 排在前面（排序质量） | question + context + ground_truth |
| **Context Recall** | ground_truth 里的关键事实是否都被 context 覆盖 | context + ground_truth |
| **Answer Correctness** | 答案与 ground_truth 的总体一致度 | answer + ground_truth |
| **Context Entities Recall** | context 是否包含了 ground_truth 里的实体 | context + ground_truth |

四个核心指标的工程意义：

- **Context Recall 低** → 检索没召回，先修检索。
- **Context Precision 低** → 召回了但排序差，加 reranker。
- **Faithfulness 低** → 模型在编（幻觉），换更强 LLM 或加更严格 prompt。
- **Answer Relevancy 低** → 答非所问，prompt 工程问题。

### 9.4 ragas 完整脚本

> 兼容性提示：ragas 0.2（2024-10）引入了 `EvaluationDataset` + `SingleTurnSample`/`MultiTurnSample` 这套显式类型化 API，取代了基于 HuggingFace `datasets.Dataset` + 字符串字段的 legacy 写法。legacy 形态在 0.x 仍可跑、1.0 会移除。下面给的是 0.2+ 推荐写法。注意字段名也对齐了：旧版 `ground_truth` → 新版 `reference`、旧版 `contexts` → 新版 `retrieved_contexts`。

```python
# ragas_eval.py — ragas 0.2+ EvaluationDataset API
from ragas import evaluate, EvaluationDataset
from ragas.dataset_schema import SingleTurnSample
from ragas.metrics import (
    Faithfulness, ResponseRelevancy,
    LLMContextPrecisionWithReference, LLMContextRecall,
    AnswerCorrectness,
)
from ragas.llms import LangchainLLMWrapper
from ragas.embeddings import LangchainEmbeddingsWrapper
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

# 1. judge LLM / embeddings（推荐用比生成 LLM 更强的模型做 judge）
judge_llm = LangchainLLMWrapper(ChatOpenAI(model="gpt-4o", temperature=0))
judge_emb = LangchainEmbeddingsWrapper(OpenAIEmbeddings(model="text-embedding-3-large"))

# 2. 评估集（人工准备 50-200 条最佳）
samples: list[SingleTurnSample] = []
for row in golden_set:  # golden_set: [{"question": ..., "reference": ...}, ...]
    out = rag_pipeline.run(row["question"])  # 你的 RAG 在线运行
    samples.append(SingleTurnSample(
        user_input=row["question"],
        retrieved_contexts=out["contexts"],   # list[str]
        response=out["answer"],               # str
        reference=row["reference"],           # str（旧版叫 ground_truth）
    ))

dataset = EvaluationDataset(samples=samples)

# 3. 指标（0.2+ 是类实例，构造时绑定 judge llm / embeddings）
metrics = [
    Faithfulness(llm=judge_llm),
    ResponseRelevancy(llm=judge_llm, embeddings=judge_emb),
    LLMContextPrecisionWithReference(llm=judge_llm),
    LLMContextRecall(llm=judge_llm),
    AnswerCorrectness(llm=judge_llm, embeddings=judge_emb),
]

# 4. 跑评估
result = evaluate(dataset=dataset, metrics=metrics, llm=judge_llm, embeddings=judge_emb)
df = result.to_pandas()
print(df.describe())
df.to_csv("ragas_report.csv", index=False)
```

字段对照（迁移老脚本时照着改）：

| legacy 字段（0.1） | 0.2+ 字段 |
|---|---|
| `question` | `user_input` |
| `answer` | `response` |
| `contexts` | `retrieved_contexts` |
| `ground_truth` | `reference` |
| `ground_truth_contexts` | `reference_contexts` |

### 9.5 端到端 LLM-as-judge

ragas 的指标偏细。生产里另一个常见做法：写一个统一的 judge prompt，输出 0-10 分 + 理由。

```python
JUDGE_PROMPT = """你是一名严格的 QA 评审。给定问题、参考答案、模型答案，从下面三个维度打分（0-10）并给理由：
1. 准确性（事实是否正确）
2. 完整性（是否答全）
3. 相关性（是否切题）

输出 JSON：
{{
  "accuracy": int, "completeness": int, "relevance": int,
  "overall": int, "reasoning": "..."
}}

问题：{q}
参考答案：{gt}
模型答案：{ans}"""
```

优点：维度自定义、跨项目可比较。缺点：prompt 设计本身要调，judge 模型差异（GPT-4 vs Claude）会带来漂移。

**生产建议**：

- ragas 跑指标做 trend monitoring（每次 deploy 看变化）。
- 自定义 judge 做对外汇报（业务团队听得懂"准确性 8/10"）。
- 永远保留 50-200 条人工验证 set，每个版本都人审。

### 9.6 评估集建设：最容易被偷工的环节

工程现实：90% 的 RAG 项目在头三个月没有像样的评估集。结果是「换了 model 觉得变好了，过了一周又觉得变差了」，一直在主观感受里循环。

**最低标准**：

- 50 条手标 golden（覆盖三类：高频问、长尾问、对抗问）。
- 每周从用户日志加 5-10 条新样本。
- 每次改动 pipeline，跑全量评估，记录到 CSV。
- 三个月后会有 200-500 条规模，足以做有意义的 A/B。

**别等"完美评估集"**——50 条不完美的评估集，胜过没有。

---

## 10. 实战：从零搭一个企业知识库 RAG

下面是一个完整的、可以直接跑的项目骨架。技术栈：

- **数据**：Python 官方文档（开源，结构化好）
- **解析**：Markdown 直接读取
- **切分**：MarkdownHeaderTextSplitter + recursive
- **embedding + sparse**：BGE-M3
- **向量库**：Qdrant（dense + sparse 一体）
- **重排**：bge-reranker-v2-m3
- **生成**：OpenAI GPT-4o-mini（替换为任意 LLM 都行）
- **服务化**：FastAPI
- **评估**：ragas

### 10.1 目录结构

```
enterprise_rag/
├── app/
│   ├── __init__.py
│   ├── config.py
│   ├── ingest.py        # 解析 + 切分 + 入库
│   ├── retriever.py     # 混合检索 + 重排
│   ├── rag.py           # 拼 prompt + 调 LLM
│   └── api.py           # FastAPI 服务
├── eval/
│   ├── golden_set.jsonl
│   └── run_ragas.py
├── data/
│   └── python-docs/     # 数据放这里
└── requirements.txt
```

### 10.2 config.py

```python
import os
from dataclasses import dataclass

@dataclass
class Config:
    qdrant_url: str = os.getenv("QDRANT_URL", "http://localhost:6333")
    collection: str = "python_docs"
    embed_model: str = "BAAI/bge-m3"
    rerank_model: str = "BAAI/bge-reranker-v2-m3"
    llm_model: str = "gpt-4o-mini"
    top_k_retrieve: int = 30
    top_k_rerank: int = 5
    chunk_size: int = 500
    chunk_overlap: int = 50

cfg = Config()
```

### 10.3 ingest.py

```python
import os, glob, hashlib
from langchain_text_splitters import (
    MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter,
)
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, VectorParams, SparseVectorParams,
    PointStruct, SparseVector,
)
from FlagEmbedding import BGEM3FlagModel
from app.config import cfg

def init_collection(client: QdrantClient):
    if client.collection_exists(cfg.collection):
        return
    client.create_collection(
        collection_name=cfg.collection,
        vectors_config={"dense": VectorParams(size=1024, distance=Distance.COSINE)},
        sparse_vectors_config={"sparse": SparseVectorParams()},
    )

def two_stage_split(md_text: str) -> list[dict]:
    """先按 Markdown 标题切，再对超长段落做 recursive 切分。"""
    md_splitter = MarkdownHeaderTextSplitter(headers_to_split_on=[
        ("#", "h1"), ("##", "h2"), ("###", "h3"),
    ])
    sec_docs = md_splitter.split_text(md_text)

    rec_splitter = RecursiveCharacterTextSplitter(
        chunk_size=cfg.chunk_size, chunk_overlap=cfg.chunk_overlap,
    )

    out = []
    for sd in sec_docs:
        meta = sd.metadata
        for piece in rec_splitter.split_text(sd.page_content):
            out.append({"text": piece, "meta": meta})
    return out

def hash_id(s: str) -> int:
    return int(hashlib.md5(s.encode()).hexdigest()[:15], 16)

def ingest(data_dir: str = "data/python-docs"):
    client = QdrantClient(url=cfg.qdrant_url)
    init_collection(client)
    model = BGEM3FlagModel(cfg.embed_model, use_fp16=True)

    all_chunks = []
    for path in glob.glob(f"{data_dir}/**/*.md", recursive=True):
        with open(path) as f:
            text = f.read()
        for ck in two_stage_split(text):
            ck["meta"]["source"] = os.path.relpath(path, data_dir)
            all_chunks.append(ck)

    print(f"chunks: {len(all_chunks)}")

    # 批量编码
    BATCH = 32
    for start in range(0, len(all_chunks), BATCH):
        batch = all_chunks[start:start + BATCH]
        out = model.encode([c["text"] for c in batch],
                           return_dense=True, return_sparse=True, max_length=1024)
        points = []
        for i, c in enumerate(batch):
            sparse = out["lexical_weights"][i]
            points.append(PointStruct(
                id=hash_id(c["meta"].get("source", "") + c["text"][:50]),
                vector={
                    "dense": out["dense_vecs"][i].tolist(),
                    "sparse": SparseVector(
                        indices=[int(k) for k in sparse.keys()],
                        values=[float(v) for v in sparse.values()],
                    ),
                },
                payload={"text": c["text"], **c["meta"]},
            ))
        client.upsert(collection_name=cfg.collection, points=points)
        print(f"upserted {start + len(batch)}/{len(all_chunks)}")

if __name__ == "__main__":
    ingest()
```

### 10.4 retriever.py

```python
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Prefetch, FusionQuery, Fusion, SparseVector,
)
from FlagEmbedding import BGEM3FlagModel, FlagReranker
from app.config import cfg

class HybridRetriever:
    def __init__(self):
        self.client = QdrantClient(url=cfg.qdrant_url)
        self.embedder = BGEM3FlagModel(cfg.embed_model, use_fp16=True)
        self.reranker = FlagReranker(cfg.rerank_model, use_fp16=True)

    def retrieve(self, query: str) -> list[dict]:
        # 1. 混合检索
        out = self.embedder.encode([query], return_dense=True, return_sparse=True)
        dense_q = out["dense_vecs"][0].tolist()
        sparse_q = out["lexical_weights"][0]

        results = self.client.query_points(
            collection_name=cfg.collection,
            prefetch=[
                Prefetch(query=dense_q, using="dense", limit=cfg.top_k_retrieve),
                Prefetch(
                    query=SparseVector(
                        indices=[int(k) for k in sparse_q.keys()],
                        values=[float(v) for v in sparse_q.values()],
                    ),
                    using="sparse", limit=cfg.top_k_retrieve,
                ),
            ],
            query=FusionQuery(fusion=Fusion.RRF),
            limit=cfg.top_k_retrieve,
        )
        candidates = [
            {"text": p.payload["text"], "source": p.payload.get("source", ""),
             "score_rrf": p.score}
            for p in results.points
        ]

        # 2. 重排
        if not candidates:
            return []
        pairs = [[query, c["text"]] for c in candidates]
        scores = self.reranker.compute_score(pairs, normalize=True)
        for c, s in zip(candidates, scores):
            c["score_rerank"] = float(s)
        candidates.sort(key=lambda x: x["score_rerank"], reverse=True)
        return candidates[:cfg.top_k_rerank]
```

### 10.5 rag.py

```python
from openai import OpenAI
from app.retriever import HybridRetriever
from app.config import cfg

SYSTEM = """你是 Python 文档助手。基于提供的文档片段回答用户问题。要求：
1. 仅使用片段里的信息，不要编造。
2. 如果片段不足以回答，明确说"文档中未涵盖"。
3. 在每个事实后面用 [n] 标注来源编号。
4. 回答用中文，技术词汇保留英文原文。"""

class RAG:
    def __init__(self):
        self.retriever = HybridRetriever()
        self.llm = OpenAI()

    def answer(self, question: str) -> dict:
        chunks = self.retriever.retrieve(question)
        if not chunks:
            return {"answer": "文档中未涵盖。", "citations": []}

        ctx = "\n\n".join(
            f"[{i+1}] (来源: {c['source']})\n{c['text']}"
            for i, c in enumerate(chunks)
        )
        user = f"文档片段：\n{ctx}\n\n问题：{question}"

        resp = self.llm.chat.completions.create(
            model=cfg.llm_model,
            messages=[
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": user},
            ],
            temperature=0.1,
        )
        return {
            "answer": resp.choices[0].message.content,
            "citations": [
                {"id": i + 1, "source": c["source"],
                 "text": c["text"][:200], "score": c["score_rerank"]}
                for i, c in enumerate(chunks)
            ],
        }
```

### 10.6 api.py

```python
from fastapi import FastAPI
from pydantic import BaseModel
from app.rag import RAG

app = FastAPI(title="Enterprise RAG")
rag = RAG()

class Query(BaseModel):
    question: str

@app.post("/ask")
def ask(q: Query):
    return rag.answer(q.question)

@app.get("/health")
def health():
    return {"status": "ok"}
```

启动：

```bash
docker run -p 6333:6333 qdrant/qdrant
python -m app.ingest
uvicorn app.api:app --reload
curl -X POST http://localhost:8000/ask \
  -H 'Content-Type: application/json' \
  -d '{"question": "如何使用 dataclass？"}'
```

### 10.7 HyDE 简易版

```python
# hyde.py
from openai import OpenAI
from app.retriever import HybridRetriever

llm = OpenAI()
retriever = HybridRetriever()

def hyde_retrieve(question: str):
    hypo_resp = llm.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content":
            f"针对以下问题，写一段 100 字的技术文档式答复（不要解释，直接写答复）：\n{question}"}],
        temperature=0.1,
    )
    hypo = hypo_resp.choices[0].message.content
    return retriever.retrieve(hypo)
```

接进 `rag.py` 里做 A/B：一半流量走原始 query，一半走 HyDE，跑两周看 ragas。

### 10.8 评估脚本

```python
# eval/run_ragas.py — ragas 0.2+ API
import json
from ragas import evaluate, EvaluationDataset
from ragas.dataset_schema import SingleTurnSample
from ragas.metrics import (
    Faithfulness, ResponseRelevancy,
    LLMContextPrecisionWithReference, LLMContextRecall,
)
from ragas.llms import LangchainLLMWrapper
from ragas.embeddings import LangchainEmbeddingsWrapper
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

from app.rag import RAG

def main():
    rag = RAG()
    judge_llm = LangchainLLMWrapper(ChatOpenAI(model="gpt-4o", temperature=0))
    judge_emb = LangchainEmbeddingsWrapper(OpenAIEmbeddings(model="text-embedding-3-large"))

    samples: list[SingleTurnSample] = []
    with open("eval/golden_set.jsonl") as f:
        for line in f:
            row = json.loads(line)
            out = rag.answer(row["question"])
            samples.append(SingleTurnSample(
                user_input=row["question"],
                retrieved_contexts=[c["text"] for c in out["citations"]],
                response=out["answer"],
                reference=row["reference"],   # golden_set 里的字段名也用 reference
            ))

    dataset = EvaluationDataset(samples=samples)
    metrics = [
        Faithfulness(llm=judge_llm),
        ResponseRelevancy(llm=judge_llm, embeddings=judge_emb),
        LLMContextPrecisionWithReference(llm=judge_llm),
        LLMContextRecall(llm=judge_llm),
    ]
    result = evaluate(dataset=dataset, metrics=metrics, llm=judge_llm, embeddings=judge_emb)
    df = result.to_pandas()
    cols = ["faithfulness", "answer_relevancy",
            "llm_context_precision_with_reference", "context_recall"]
    print(df[[c for c in cols if c in df.columns]].describe())
    df.to_csv("eval/report.csv", index=False)

if __name__ == "__main__":
    main()
```

`golden_set.jsonl` 一行一条 `{"question": "...", "reference": "..."}`，先手标 30-50 条（注意 0.2+ 字段名是 `reference`，老脚本 `ground_truth` 要批量改）。

### 10.9 一份完整的实验日志

为了让"准确率提升 X%"不是空话，每次改动留这种记录：

| 版本 | 配置 | faithfulness | ans_rel | ctx_prec | ctx_rec | 备注 |
|------|------|--------------|---------|----------|---------|------|
| v0 | dense only, no rerank | 0.71 | 0.78 | 0.62 | 0.55 | baseline |
| v1 | + BM25 RRF | 0.74 | 0.80 | 0.71 | 0.68 | hybrid |
| v2 | + bge-reranker-v2-m3 | 0.86 | 0.84 | 0.89 | 0.81 | reranker 单点 ROI 极高 |
| v3 | + contextual retrieval | 0.91 | 0.87 | 0.92 | 0.88 | indexing 慢 4x |
| v4 | + HyDE | 0.90 | 0.87 | 0.91 | 0.86 | 持平，pipeline 慢 1.3x，下版本回滚 |

**这种表是 RAG 工程师的简历**，比口头说"我做过 RAG"重要十倍。

---

## 11. 生产工程：从 demo 到上线

### 11.1 增量索引与文档更新

文档每天会变。如果每次都全量重建索引，几分钟到几小时都不够。

**策略**：

- 给每份文档分配 `doc_id`，切出来的 chunk id 用 `f"{doc_id}-{chunk_hash}"`。
- 文档更新流程：
  1. 重新切分新版本文档。
  2. 计算新 chunk_hash 集合 `new_set`，从向量库读旧 set `old_set`。
  3. delete: `old_set - new_set`。
  4. upsert: `new_set - old_set`。
  5. 不变的 chunk 跳过。
- 用 message queue（Kafka / Redis stream）异步处理，不要让用户等。

### 11.2 多租户隔离

SaaS 化的 RAG 必须解决"用户 A 的文档不能被用户 B 检索到"。

| 方案 | 优点 | 缺点 |
|------|------|------|
| 一租户一 collection | 强隔离、易备份 | collection 太多管理麻烦（>1000 时） |
| 单 collection + payload filter | 资源利用率高 | 隔离靠应用层，bug 直接漏数据 |
| 按租户分 namespace（Pinecone）| 平衡 | 依赖向量库厂商 |

**通用建议**：

- 小客户（<1000 个）→ 单 collection + 强制 metadata filter（`tenant_id`）。
- 大客户（企业大单）→ 独占 collection 或独占实例。
- 任何方案都必须**在向量库网关层强制注入 tenant_id 过滤**，不能依赖业务代码记得带。

### 11.3 引用与溯源

LLM 输出必须能追溯到具体文档。已经做过两件事：

- ingest 时把 `source` 存进 payload。
- 生成时让 LLM 用 `[n]` 标注。

进阶：

- **段落级 anchor**：source 里带行号或 anchor，用户点击直接跳到原文。
- **置信区分**：Faithfulness 评分低的引用标红。
- **冲突检测**：多个 chunk 内容矛盾时，prompt 里显式标出，让 LLM 选择并解释。

#### 11.3.1 引用幻觉：生产 RAG 的高频暗坑

让 LLM "在每个事实后面用 `[n]` 标注来源"听上去很美——直到上线后你会发现这些 bug：

1. **超出范围的编号**：你只送了 5 个 chunks，LLM 输出 `... [7]`、`[12]`。
2. **凭空捏造的 page / section**：prompt 里根本没给 page number，LLM 自己写"参见第 47 页"或 "in section 3.2.1"——纯属编造。
3. **doc_id 串味**：从 chunk A 的事实，挂在 chunk B 的引用上（事实和引用不对应）。
4. **文件名拼写漂移**：source 是 `python-tutorial-v3.md`，LLM 写成 `python_tutorial.md` 或 `python-tutorial.pdf`。
5. **引用空洞**：Markdown 里 `[1]` 链接但 `[1]: ...` 没生成（半截 footnote）。
6. **多 chunk 同源时去重失败**：3 个 chunk 都来自同一份合同，LLM 给三个不同编号，前端展示 3 条几乎一样的引用。

这类 bug 在 ragas 的 `faithfulness` 上不一定能抓到——指标看的是事实是否来自 context，不看引用编号是否合法。**必须做引用层的硬校验**。最小可用版本：

```python
import re
from typing import Iterable

CITE_RE = re.compile(r"\[(\d+)\]")
PAGE_RE = re.compile(r"(?:page|页|p\.|第)\s*(\d+)\s*(?:页)?", re.IGNORECASE)

def validate_citations(answer: str, chunks: list[dict]) -> dict:
    """返回 {valid: bool, issues: [str], cleaned_answer: str}"""
    issues = []
    n = len(chunks)
    valid_ids = set(range(1, n + 1))

    # 1. 检查 [n] 编号是否都在范围内
    cited = {int(m.group(1)) for m in CITE_RE.finditer(answer)}
    out_of_range = cited - valid_ids
    if out_of_range:
        issues.append(f"out_of_range_citations: {sorted(out_of_range)}")

    # 2. 检查未被引用的 chunk（不一定是 bug，但常见诊断信号）
    unused = valid_ids - cited
    if unused == valid_ids and n > 0:
        issues.append("no_citation_at_all")

    # 3. 检查页码 / section 是否在 chunk metadata 里出现过
    cited_pages = {int(m.group(1)) for m in PAGE_RE.finditer(answer)}
    actual_pages = {c.get("page") for c in chunks if c.get("page") is not None}
    fabricated_pages = cited_pages - actual_pages
    if fabricated_pages:
        issues.append(f"fabricated_pages: {sorted(fabricated_pages)}")

    # 4. 检查文件名是否被改写（chunk source 必须出现在答案里，如果你要求引用文件名）
    # ... 视产品形态决定要不要做

    return {"valid": not issues, "issues": issues}
```

**生产兜底策略**（按防御深度排）：

- **结构化输出强约束**：用 `response_format` / `with_structured_output` 让 LLM 输出 `{"answer": "...", "citations": [{"id": 1, "snippet": "..."}, ...]}`，把"哪个事实对应哪个 id"显式拆出来，比放任 LLM 在文本里塞 `[n]` 稳得多。
- **post-validation 层**：上面那段 `validate_citations`，发现 out_of_range / fabricated_pages 时——要么 retry 一次（带"上次输出有 X 错误"反馈），要么直接降级输出"无法从知识库中找到可靠引用"。
- **prompt 强约束**：system prompt 里写死「只能引用 1-{N} 之间的编号；不要写 page、section、章节号；不要拼凑文件名」。Claude 4.5+ / GPT-4.1+ 对这种约束遵循度可接受，老模型不行。
- **前端折叠**：把 LLM 给的 citations 在前端按 chunk_id 去重 + 重新编号，用户看到的不是 LLM 编号而是后处理过的合法编号。
- **采样审计**：每天随机抽 50 条线上回答，跑 `validate_citations`，把违例率作为日常 KPI（健康 RAG 的引用违例率应 < 2%；> 5% 说明 prompt 或模型有问题）。

**什么时候这件事最严重**：法律 / 医疗 / 金融——一句"参见招股书第 47 页"如果是编的，是合规事故。**这些领域必须把"引用合法性校验"做到检索/生成 pipeline 内，不能只靠 prompt 自觉**。

### 11.4 缓存

三级缓存：

```
L1 · query 完全一致缓存（Redis，TTL 5min）
L2 · query embedding + top-k chunks 缓存（避免重新 embed + 重新查向量库）
L3 · prompt cache（Anthropic / OpenAI 都支持）：把检索结果之外的 system prompt 部分 cache 住
```

L3 特别值得注意：Claude 的 prompt cache 让不变的部分（system prompt + 长 few-shot）成本降到 1/10。RAG 系统 system prompt 通常 500-1500 tokens，每次都送是浪费。

### 11.5 成本监控

记录每个 query 的：

- embedding 调用次数 + tokens
- LLM 调用次数 + input/output tokens
- 检索次数（混合检索算两次）
- 重排次数 + 候选数

每周看 P50 / P95 / P99 成本和延迟。**Agentic RAG 的 P99 经常是 P50 的 10-20 倍**——某些 query 触发 5-7 次循环——这种长尾必须监控起来，否则月底账单会让你惊讶。

### 11.6 一份生产 checklist

- [ ] 切分质量人工抽查 30 个，达标率 > 90%。
- [ ] 50+ 条 golden set，每周扩充。
- [ ] ragas 四指标 baseline 已记录，每次改动跑一遍。
- [ ] dense + sparse 混合检索（不要纯 dense）。
- [ ] 上线 reranker（哪怕是开源 bge）。
- [ ] 每个 chunk 带 source / doc_id / tenant_id metadata。
- [ ] 多租户场景：网关层强制 tenant_id 过滤。
- [ ] 引用机制：答案必须可追溯到具体 chunk。
- [ ] 增量索引（不要全量重建）。
- [ ] L1 + L3 缓存。
- [ ] 成本监控（按 P95 / P99 看）。
- [ ] 用户反馈通道（点踩按钮 → 自动入候选评估集）。
- [ ] 危险查询过滤（PII 脱敏 / prompt injection 检测）。

---

## 12. 章节小结：决策清单

读到这里，下次接到 RAG 需求，先按这个顺序问自己：

```
Q1. 知识库 < 200K tokens？
    → 是：直接长上下文 + prompt cache，不要搭 RAG
    → 否：继续

Q2. 文档主要是文字 / Markdown / 结构化 PDF？
    → 是：标准 pipeline
    → 主要是图表 / 扫描件：考虑 ColPali

Q3. 是否需要回答全局摘要类问题（"整体讲了什么"）？
    → 否：普通 RAG 够
    → 是：考虑 RAPTOR 或 Microsoft GraphRAG

Q4. 是否多跳推理？（A 的 B 的 C）
    → 否：普通 RAG
    → 是：Query Decomposition 或 Graph RAG

Q5. 准确率瓶颈到了？
    → 先加 reranker（最大单点收益）
    → 再上 contextual retrieval
    → 再考虑 hybrid + RRF
    → 最后才是换 embedding 模型

Q6. 准确率还不够？
    → 上 Agentic RAG（self-reflective）
    → 上 CRAG（带 web search fallback）

Q7. 评估呢？
    → 还没有 golden set？停下来，先标 50 条
    → 已经有了？接进 ragas，每次改动跑全量
```

**最后一条铁律**：RAG 的所有改进都是经验性的，没有银弹。同一种技术（HyDE、GraphRAG、Self-RAG）在 A 项目提升 10 个点，在 B 项目可能持平甚至下降。**永远 A/B、永远评估、永远记录**——这才是 RAG 工程师真正的基本功。

---

> **承上启下**：本章把 RAG 当作"固定 pipeline"或"带几条循环的 self-reflective 流程"来讲。一旦你想让模型自己决定"现在该不该检索、检索什么、检索完够不够、要不要换数据源、要不要调别的工具"——就跨进了 Agent 的领域。下一章（第 17 章）会把"决策循环 + 工具 + 状态"拆开讲透：从零写一个 ReAct Agent、Plan-and-Execute / Reflexion 等范式、工具调用工程、多 Agent 协作模式、生产级 Agent 的真实约束。本章里的 Agentic RAG 只是 Agent 的一个特例，第 17 章会回到一般情形。

---

## 参考与延伸阅读

**核心论文**

- Gao et al. 2022 · [Precise Zero-Shot Dense Retrieval without Relevance Labels (HyDE)](https://arxiv.org/abs/2212.10496)
- Khattab & Zaharia 2020 / 2021 · [ColBERT v2](https://arxiv.org/abs/2112.01488)
- Liu et al. 2023 · [Lost in the Middle](https://arxiv.org/abs/2307.03172)
- Asai et al. 2023 · [Self-RAG](https://arxiv.org/abs/2310.11511)
- Sarthi et al. 2024 · [RAPTOR](https://arxiv.org/abs/2401.18059)
- Yan et al. 2024 · [Corrective RAG (CRAG)](https://arxiv.org/abs/2401.15884)
- Edge et al. 2024 · [GraphRAG · Microsoft](https://arxiv.org/abs/2404.16130)
- Faysse et al. 2024 · [ColPali](https://arxiv.org/abs/2407.01449)
- Guo et al. 2024 · [LightRAG](https://arxiv.org/abs/2410.05779)
- Qwen Team 2025 · [Qwen3 Embedding](https://arxiv.org/abs/2506.05176)

**工程博客**

- [Anthropic · Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval)
- [LangChain · Agentic RAG with LangGraph](https://blog.langchain.com/agentic-rag-with-langgraph/)
- [Greg Kamradt · 5 Levels of Text Splitting](https://github.com/FullStackRetrieval-com/RetrievalTutorials)
- [Together AI · Implement Contextual RAG](https://docs.together.ai/docs/how-to-implement-contextual-rag-from-anthropic)

**开源代码**

- [BGE-M3 · FlagEmbedding](https://github.com/FlagOpen/FlagEmbedding)
- [Qwen3-Embedding](https://github.com/QwenLM/Qwen3-Embedding)
- [Microsoft GraphRAG](https://github.com/microsoft/graphrag)
- [HKUDS LightRAG](https://github.com/HKUDS/LightRAG)
- [ragas](https://github.com/explodinggradients/ragas)
- [LangGraph](https://github.com/langchain-ai/langgraph)
- [Qdrant](https://github.com/qdrant/qdrant)
- [LlamaIndex](https://github.com/run-llama/llama_index)
- [NirDiamant/RAG_Techniques · 30+ 种技术 notebook](https://github.com/NirDiamant/RAG_Techniques)

**评估与基准**

- [MTEB Leaderboard · HuggingFace](https://huggingface.co/spaces/mteb/leaderboard)
- [Aimultiple · Reranker Benchmark](https://aimultiple.com/rerankers)
- [Paperclipped · Graph RAG in 2026](https://www.paperclipped.de/en/blog/graph-rag-production/)
