# 第 24 章 · LLMOps：观测、评估与持续改进

> 2024 年 2 月，加拿大航空（Air Canada）的 LLM 客服承诺一位失去亲人的乘客可以"先全价买票、之后申请丧亲折扣退款"——这是模型幻觉出来的政策。乘客真的去申请退款，被拒；告上小额法庭，法院判航司必须按 LLM 当时说的兑现。这不是 prompt 注入、不是越权调用，只是一次"模型自信地说错了"——但代价是上了头条 + 真金白银赔偿。
> 让 LLM 上线，没有观测、没有评估、没有反馈闭环，等于把这种事故概率乘以你的用户数。

> **【学完本章你应该能】**
> 1. 给现有 LLM 应用接上一套 trace（看清每次调用的输入、输出、cost、延迟）
> 2. 看懂 P50 / P99 延迟和 cost-per-request 大盘
> 3. 写出第一个 LLM-as-judge 评估器
> 4. 把一个线上 failure case 转化为 eval 集回归用例

> 把模型送上线只是开始。
>
> 如果你在传统 MLOps 里活过几年，多半会带着一种残存的安全感：模型权重在我手里，特征管线我能拉日志，指标飘了我重新训。LLM 系统把这些假设几乎全部击穿。模型不在你手里，权重一夜之间被供应商悄悄替换；行为非确定，同一句 prompt 同一个温度，今天的输出和明天的输出可能在语义上完全不同；prompt 即代码，一行模板的修改可能让整条业务链路偏移，但你不可能用 git diff 和单元测试就把它压住；评估难，没有 ground truth，accuracy 这个词在生成任务面前接近作废。
>
> 这一章讲的是 LLM 系统的运维范式。它不是 MLOps 的子集，而是一个交叠又分化的工程领域。我们会先把"为什么传统 MLOps 不够"讲清楚，再扫一遍主流的可观测平台和正在成型的开放标准（OpenTelemetry GenAI），然后把核心闭环落到三件事：观测（trace、cost、latency、feedback），评估（offline / online / LLM-as-judge），持续改进（failure → dataset → eval → fix）。最后是告警、SRE、合规审计。代码全部给出，从 Langfuse 接入到 ragas 评估到 promptfoo 配置到 A/B 框架。

---

## 24.1 LLMOps 与 MLOps 不是同一回事

很多团队在 2024 年踩过同一个坑：直接把 MLOps 那一套照搬过来，结果发现指标体系、CI/CD 流水线、监控大盘几乎全部用不上。原因不是工具不够好，而是底层假设变了。

**模型不在你手里。** 传统 ML 里，模型是你训练的。你知道权重哈希、训练数据快照、超参数版本。LLM 里，模型是供应商托管的黑盒。OpenAI 的 `gpt-4o` 在 2024 年 5 月、8 月、11 月之间至少迭代过三次，且部分版本在不通知用户的前提下直接替换。你看不到权重，看不到训练数据，连"模型今天有没有变"都需要靠输出分布的统计来推断。

**行为是非确定的。** 即使 `temperature=0`，由于 GPU 浮点运算的非结合性、batch 调度的差异、KV 缓存命中状态等因素，同一个 prompt 在两次调用之间也可能产生不同的 token。这不是 bug，是供应商架构的副作用。结果是：你写的所有"快照测试"都会有非零的 flaky rate，你必须从"输出必须等于 X"转向"输出必须满足某个语义性质"。

**Prompt 即代码，但又不是代码。** Prompt 的修改和代码的修改在工程上要承担同等的风险，但它没有类型系统、没有静态检查、没有完整的单元测试。一个看起来无害的"请用更友好的语气"被加进系统提示，可能导致下游 JSON 解析全线失败。Prompt 改动必须配套评估集回归，这是 LLMOps 区别于 MLOps 的第一条硬规则。

**评估难。** 传统 ML 里你有 y_true，accuracy / F1 / RMSE 都能算出一个数。生成任务里没有唯一正确答案。"巴黎是法国的首都"和"法国的首都是巴黎"语义等价但字符串不同；"我不能回答这个问题"在某些场景是合规，在另一些场景是失败。你被迫引入 LLM-as-judge、人工评估、用户反馈这些新的、各自都有偏差的信号源，再用工程手段把它们组合成一个相对可信的判断。

**成本是新的一等公民指标。** 一个 GPT-4 Turbo 的请求可以是 0.01 美元，也可以是 5 美元，差距全看你扔进去多少 token。对话式产品里，token 数随会话轮数线性增长，到第 50 轮可能 prompt 已经膨胀到几万 token。监控大盘里 cost / request、cost / user、cost / feature 这三个数从一开始就要有，否则一个 prompt 改动就能把月账单干翻一倍。

**延迟分布更长尾。** LLM 的首 token 延迟（TTFT）和生成总延迟（TBT × token 数）是两个不同分布，长输出场景下 P99 比中位数高 5–10 倍是常态。你不能再用单一的 latency 指标，必须把首字节、token 速率、总耗时分别监控。

把这些放在一起，你会发现 LLMOps 的核心痛点不是"如何把 model.pkl 部署到 K8s"，而是：**在一个非确定的、闭源模型驱动的、prompt 是核心资产的系统里，怎么持续地知道它好不好、怎么持续地让它变得更好。**

下表把 MLOps 和 LLMOps 在常见实践上的差异并排放出来，方便你把这一章的工作和你过去的经验对齐：

| 关注点 | 传统 MLOps | LLMOps |
|--------|------------|--------|
| 模型治理 | 权重哈希、训练数据集 | 模型 ID + 供应商版本 + 调用参数 |
| 测试方式 | 静态评估集 + accuracy 阈值 | LLM-as-judge + 行为性质 + 人工抽检 |
| 部署单元 | Docker 镜像 + 模型 artifact | Prompt 模板 + 模型 ID + Tools schema |
| 回滚单位 | 镜像版本 | Prompt 版本（毫秒级回滚） |
| 主要监控 | 输入分布漂移、特征缺失率 | Token / 成本 / 延迟 / 反馈 / 质量 |
| 失败模式 | 数值越界、特征 NaN | 幻觉、注入、越狱、JSON 解析失败、PII 泄漏 |
| 改进周期 | 数据 + 重训（周/月） | Prompt + RAG（小时/天）、微调（周） |
| 成本模型 | GPU hours，离线为主 | Per-request token，按调用线性 |

注意到改进周期那一行差异最大。LLM 应用的改进可以非常快——一行 prompt 改完测完上线，可能一个下午就能完成一次有意义的 quality 提升。这种快循环既是机会也是陷阱：快意味着容易乱改，必须用强评估闭环把住质量门禁。

---

> **【小白速读】** 跳过 24.2 平台对比和 24.3 OTel 标准。直接照 24.4.1 的 Langfuse 示例跑通——一个 docker-compose 起服务，三行代码加 `@observe` 装饰器，就有了 trace、cost、latency 三件套。第一次读建议按"24.0 → 24.4.1 → 24.6 → 24.11 反模式"过一遍，再回头补 24.2 / 24.3 扩展知识。

## 24.2 可观测平台扫描

把市面上常见的几家排在一起做一个清单。这里只看 LLM 工程师真正会用到的功能，不评价 MLOps 通用能力。

### 24.2.1 Langfuse

定位是开源 LLM 工程平台。MIT 许可，Python / JS / Java SDK 完整，self-host 是一等公民——单机 docker-compose 几分钟可以起来，生产规模需要 Postgres + ClickHouse + Redis + S3 + 可选 K8s。功能覆盖 trace、prompt 管理、数据集、评估器、人工标注、playground。后端 v3 起拆为 langfuse-web + langfuse-worker 双容器架构，OTel ingestion 走 worker。2026 年 1 月被 ClickHouse 收购，承诺继续 MIT 开源 + self-host，对底层查询性能继续利好。SDK 装机量月级超过 600 万，社区活跃度在开源 LLMOps 里第一梯队。Python SDK 在 2026 年 3 月发布 v4——移除了 `langfuse.decorators` 子模块，`@observe` 改从 `from langfuse import observe` 顶层导入；`update_current_trace` 等命令式更新被拆成 `propagate_attributes` 上下文管理器 + 各 wrapper 对象的 `update_trace()` 方法。本章代码示例以 v3 风格为主（仍是当下使用最广的版本），切到 v4 时按官方迁移指南改两行即可。

适合的团队：需要 self-host（合规、数据主权）；多模型、多框架混用，不想被 LangChain 绑架；预算敏感但接受自己运维。

不适合：完全不想运维基础设施，且预算充足；只用 LangChain 全家桶，希望零配置接入。

### 24.2.2 LangSmith

LangChain 官方平台。闭源，云托管，自托管要 Enterprise 合同。优势是和 LangChain / LangGraph 深度集成，一个环境变量就开始 trace；评估器模板丰富（30+ 种，包含 prompt 注入检测、轨迹评估等）。

适合的团队：全栈 LangChain，且不需要 self-host，且能接受按 seat 计价。

不适合：多框架、多语言、需要数据主权、预算敏感。

### 24.2.3 Phoenix / Arize

Phoenix 是 Arize AI 推出的开源版本，Apache 2.0。架构上是 OpenTelemetry 原生的——它接受标准 OTLP，所以你用任何一个支持 OTel 的 instrumentation（OpenInference 提供了 OpenAI、Anthropic、LangChain、LlamaIndex、DSPy、Vercel AI SDK 等几十种）都能直接打过来。Phoenix 和商业版 Arize AX 的差异在于多用户、长期存储、实验管理这些企业能力。

Phoenix 的强项是评估流程结构化做得最早：dataset、experiment、evaluator 三个概念被显式建模。如果你打算把"failure case → 加入数据集 → 跑 experiment → 看哪些 evaluator 退化了"这条闭环做扎实，Phoenix 的 mental model 是最贴合的。

### 24.2.4 Helicone

定位是 LLM Gateway + 观测一体化。一行代码（改 base_url）就能把 OpenAI 调用代理到 Helicone，自动获得 logging、cost、cache、rate limit、failover、prompt 版本管理。底层用 Cloudflare Workers + ClickHouse + Kafka 跑分布式架构，号称已经处理过 20 亿次 LLM 调用。

适合的团队：希望把 gateway 和观测捏在一起，不想分别接两个 SDK；多模型路由、降本（缓存、路由到便宜模型）是首要目标。

权衡：作为代理，会引入一跳额外延迟；如果你的应用对 P50 延迟极敏感（< 200ms），需要测量。

### 24.2.5 W&B Weave

Weights & Biases 把传统 ML 实验追踪扩展到 LLM 的产品。`@weave.op` 装饰器自动 trace。最大的价值是和 W&B 实验管理打通——如果你的团队已经在 W&B 里跑模型训练 / 微调实验，Weave 可以让"训练 → 评估 → 部署 → 观测"在同一个 UI 里看到。

适合：已经深度用 W&B 的团队。

不适合：纯应用层团队，没有训练实验需求；产品稳定性需求高于实验性。

### 24.2.6 Honeycomb / Datadog LLM Observability

通用 APM 厂商对 LLM 的扩展。Datadog 在 2026 年已经原生支持 OpenTelemetry GenAI 语义约定（v1.37+）。优势是和你已有的基础设施监控（K8s、数据库、上游服务）共用一个平台，trace 可以跨越 LLM 调用和后端服务串成一条完整链路；劣势是评估能力相对薄弱，更偏"看到了什么"而不是"输出好不好"。

通用 APM 适合：LLM 是你整个系统里的一部分，而不是全部；你已经在用 DD / Honeycomb，且不想再引第二套。

### 24.2.7 怎么选

不要一开始就上多套。我的实操建议：

- 自托管 + 多框架 + 预算敏感：Langfuse。
- LangChain 全家桶 + 云：LangSmith。
- OpenTelemetry 原生 + 强结构化评估：Phoenix。
- 想顺便做 gateway / cache：Helicone。
- 已在用 W&B / Datadog：Weave / Datadog LLM。

混搭也常见。一个真实生产组合：Helicone 做 gateway（cache + cost），Langfuse 做 trace 和评估闭环，Datadog 做基础设施监控。三者通过 trace_id 在日志里关联。

### 24.2.8 选型时容易踩的几个坑

**只看功能列表。** 所有平台官网的功能表看着差不多，选型时容易被"勾选了 30 个 feature 的那家"迷惑。真正决定体验的是：trace UI 的检索是否快、IO 字段渲染是否好读（长 JSON 折叠、diff 视图）、evaluator 接入是否能跟着 prompt 改动跑。这些只能在 PoC 里跑一周才看得出来。建议每家给三天时间，跑同一份样本数据，让真正会用的工程师投票。

**忽略数据迁移成本。** trace 一旦有了几个月历史，迁移到另一家几乎不可能——schema 不兼容，索引重建一次要数天。这把每家都变成一种"事实上的锁定"。规避手段是从一开始就用 OpenTelemetry GenAI 标准接入，把 trace 双写到自己控制的存储（ClickHouse / Postgres）作为长期归档。

**Self-host 的真实成本。** Langfuse 单机版 docker-compose 起来很轻，但生产规模需要：Postgres 主从、ClickHouse 集群、Redis 哨兵、S3 兼容存储、定期备份、监控、升级演练。一个工程师专职维护至少 30% 工时。如果你的团队 < 20 人且没有合规硬要求，云版本通常是更划算的选择。算笔账：Langfuse Cloud Pro 每月几百美元，比一个工程师 30% 工时便宜一个数量级。

**混用多家的口径冲突。** 同一个"latency"在 Helicone 里是网关延迟，在 Langfuse 里是端到端延迟，在 Datadog 里是后端服务延迟。聚合到一张大盘上的时候，必须先做口径对齐——给每个指标加上来源 prefix，别在告警 rule 里直接 `latency > 5s`。

---

## 24.3 OpenTelemetry GenAI：正在成型的标准

平台之争最终会被开放标准消化。OpenTelemetry 在 2024 年开始推 GenAI 语义约定（Semantic Conventions for Generative AI），到 2026 年 5 月，绝大部分定义仍在 experimental，但工业界已经按这套约定下注：Phoenix 原生支持，Datadog v1.37 起原生支持，Langfuse 提供 OTel 接入路径，Traceloop 的 OpenLLMetry 也是基于这套约定的开源 instrumentation 集合。

理解这套标准只需要记住几个关键 attribute：

| 维度 | Attribute | 含义 |
|------|-----------|------|
| 模型 | `gen_ai.system` | 提供方，如 `openai`、`anthropic`、`bedrock` |
| 模型 | `gen_ai.request.model` | 请求的模型 ID |
| 模型 | `gen_ai.response.model` | 实际响应的模型 ID（可能不一样，比如别名） |
| 调用 | `gen_ai.operation.name` | 操作类型，如 `chat`、`completion`、`embeddings` |
| 参数 | `gen_ai.request.temperature` / `top_p` / `max_tokens` | 调用参数 |
| Token | `gen_ai.usage.input_tokens` / `output_tokens` | token 用量（旧版叫 prompt_tokens / completion_tokens，被替换） |
| Token-Cache | `gen_ai.usage.cache_creation.input_tokens` / `cache_read.input_tokens` | prompt cache 写入 / 命中 token，部分 provider 才有 |
| 内容 | `gen_ai.input.messages` / `gen_ai.output.messages` （事件 / log record） | 实际 prompt / 输出，**默认不采集**（PII 风险）。早期 `gen_ai.prompt` / `gen_ai.completion` 记法仍在过渡期 |
| Agent | `gen_ai.agent.name` / `gen_ai.agent.id` / `gen_ai.tool.name` | agent / tool 维度 |

注意两点。

**默认不采集 prompt 和 completion 内容。** 这是为了防 PII 泄漏，是工业界共识。你需要内容采集时显式打开开关，并配套脱敏管线（24.10 会讲）。

**`OTEL_SEMCONV_STABILITY_OPT_IN`。** 旧 attribute（`prompt_tokens` 等）和新 attribute 处于过渡期，环境变量决定是否双写。生产里建议设为 `gen_ai_latest_experimental` 以拿到最新约定，同时确保下游的 Collector / 后端能识别。

落到代码上，最小可用的 instrumentation 是这样的：

```python
# 安装：
# pip install opentelemetry-sdk opentelemetry-exporter-otlp \
#             openinference-instrumentation-openai

import os
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from openinference.instrumentation.openai import OpenAIInstrumentor

os.environ["OTEL_SEMCONV_STABILITY_OPT_IN"] = "gen_ai_latest_experimental"

provider = TracerProvider()
provider.add_span_processor(
    BatchSpanProcessor(
        OTLPSpanExporter(endpoint="http://localhost:4317", insecure=True)
    )
)
trace.set_tracer_provider(provider)

# 自动 instrument，所有 OpenAI SDK 调用都会被打成符合 GenAI 语义约定的 span
OpenAIInstrumentor().instrument()

# 之后正常用 OpenAI 客户端，trace 就出来了
from openai import OpenAI
client = OpenAI()
resp = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "ping"}],
)
```

这一段 trace 可以同时被 Phoenix、Langfuse（通过 OTel ingestion）、Datadog、Honeycomb 接收。这是你避免被任何单一供应商绑死的最稳妥姿势。

**关于 OpenInference 和 OTel GenAI 的关系：** OpenInference 是 Arize 主导的 instrumentation 集合，最早出现在 2023 年，比 OTel GenAI 标准成熟。两者在 attribute 命名上有差异，但 OpenInference 现在以兼容 OTel GenAI 为目标在演进，且大部分平台都做了双向映射。生产环境推荐组合：用 OpenInference 的 `instrumentation-*` 包做接入（覆盖最广），同时打开 OTel GenAI 的 stability flag。这样你既拿到了广覆盖，又跟着标准走。

**自定义 span 的 attribute 怎么打：** 框架自动 instrument 之外，你自己写的逻辑（业务规则、自定义 retrieval、特殊后处理）需要手动打 attribute。最低限度记录这几个：

```python
from opentelemetry import trace
from opentelemetry.trace import SpanKind

tracer = trace.get_tracer(__name__)

def custom_retrieval(query: str, k: int):
    with tracer.start_as_current_span(
        "custom-retrieval",
        kind=SpanKind.INTERNAL,
    ) as span:
        # 输入
        span.set_attribute("retrieval.query", query)
        span.set_attribute("retrieval.k", k)

        results = do_retrieve(query, k)

        # 输出 metric
        span.set_attribute("retrieval.hit_count", len(results))
        span.set_attribute("retrieval.top_score", results[0]["score"] if results else 0)
        span.set_attribute("retrieval.doc_ids", [r["id"] for r in results])
        return results
```

这种自定义 attribute 在大多数后端可以直接做聚合查询，比如"按 doc_id 看哪些文档被检索到最多"。打 attribute 的代价几乎为零，习惯性多打。

**关于 OTel GenAI 标准的现实——不要过度乐观。** 上面的写法在 demo 里很顺，但生产环境真要从厂商专有 SDK 迁到 OTel 标准时会遇到一堆痛点，提前知道能少踩坑。

- **Attribute 命名仍在过渡。** 截至 2026 年 5 月，spec 里有相当一部分 attribute 仍标记 experimental，且过去 18 个月经历过 prompt_tokens → input_tokens、prompt/completion → input.messages/output.messages 这样的破坏性改名。生产代码必须双写一段时间（旧名 + 新名），通过 `OTEL_SEMCONV_STABILITY_OPT_IN` 控制。一旦上游下游不同步，token 计费会算错或漏掉，是真实事故。
- **各家 backend 的解析覆盖度不一致。** 同一份符合 spec 的 OTLP span，在 Datadog / Phoenix / Langfuse / Honeycomb 里渲染出来是不一样的——有的能识别 messages 数组并展开 chat UI，有的只显示原始 JSON；有的能从 attribute 推算 cost，有的需要你预先把 cost 算好打进去。选型时必须真的把数据打过去看 UI，别只看官网"支持 OTel"的勾。
- **Collector 链路是新的故障源。** OTLP → Collector → 多个 backend 的 fan-out 拓扑给系统加了一跳，常见故障：Collector OOM（采样配置错误，trace 全量打了）、batch 配置导致丢失、Collector 升级后的协议不兼容。生产建议：Collector 独立部署、单独监控、配置纳入 git、版本变更走 staging。
- **PII 控制策略要重写。** 厂商 SDK 通常默认不发原文，OTel instrumentation（OpenInference / OpenLLMetry）默认行为各不相同——某些版本是默认采集 messages 全文。迁移时必须先确认默认值，配上 redaction processor（OTel Collector 自带 attribute processor 可以做正则脱敏，复杂的还要接 Presidio）。这块踩坑代价是合规事故，不是性能事故。
- **历史数据没法回填。** 老数据是厂商专有 schema，新数据是 OTel schema，两套并存几个月是常态。dashboard 要么写两份查询合并，要么先做一次 ETL 把历史数据搬到 OTel schema——后者通常因为成本被砍掉，于是迁移期的"全局视图"是断的。
- **成本归因更复杂。** 厂商 SDK 自带 cost 字段，OTel 标准没有强制要求 cost 在 span 上——你要么自己根据 model + token 算（要维护价格表），要么依赖 backend 帮你算（每家算法略有差异）。多 provider 场景里这个问题更突出。

实操建议：**新项目从第一天用 OTel + OpenInference 接入**，迁移成本几乎为零；**老项目不要为了"标准"而迁，找一个你真的会用到 OTel 能力的契机**（多 backend 并存、跨服务 trace、严合规要求）再动。如果你现在跑得好好的、就一家厂商、就一个团队，硬迁纯属自找麻烦。OTel GenAI 是趋势，但 2026 年它还是一个工具选项，不是必须的工程纪律。

---

## 24.4 核心可观测维度

观测是 LLMOps 的地基。地基不稳，后面所有评估和改进都站不住。一个能用的观测系统应该让你回答以下问题中的任何一个，且响应时间是秒级：

1. 这次具体的请求里，到底发生了什么？（trace）
2. 用户输入了什么、模型输出了什么？（IO）
3. 这次调用花了多少钱？这周花了多少钱？哪个 feature 花得最多？（cost）
4. P50 / P99 延迟是多少？慢的请求慢在哪一步？（latency）
5. 用户对这次输出怎么看？（feedback）

### 24.4.1 Trace：一次请求的全链路

LLM 应用很少是一次裸调用。一个 RAG 问答的真实链路通常是：

```
用户请求
  └─ 输入预处理（query rewrite / 意图分类）
       └─ 向量检索（embedding + ANN）
            └─ rerank（cross-encoder 或 LLM rerank）
                 └─ prompt 拼装
                      └─ LLM 主调用
                           ├─ tool call: 数据库查询
                           ├─ tool call: 计算器
                           └─ 最终生成
                                └─ 输出后处理（JSON 解析、安全过滤）
```

trace 的目标是把这棵树原样保留下来，每个节点可见输入、输出、耗时、token、cost、错误。你需要它的时候——线上反馈"为什么这个回答这么离谱"——你打开对应 trace_id，30 秒内定位到是 retrieval 召不回，还是 rerank 顺序错了，还是 LLM 跑偏了。

下面是 Langfuse 的完整 RAG trace 接入示例。这个例子里用 `@observe` 装饰器构建嵌套结构，并在 LLM 节点显式标注 token / cost。

```python
import os
from langfuse import Langfuse, observe
from langfuse.openai import openai  # drop-in 替换

os.environ["LANGFUSE_PUBLIC_KEY"] = "pk-lf-..."
os.environ["LANGFUSE_SECRET_KEY"] = "sk-lf-..."
os.environ["LANGFUSE_HOST"] = "http://localhost:3000"  # self-host

langfuse = Langfuse()

@observe(name="retrieve", as_type="retriever")
def retrieve(query: str, k: int = 5):
    # 假装这里是 embedding + ANN
    return [
        {"id": "doc-1", "score": 0.91, "text": "RAG 是检索增强生成..."},
        {"id": "doc-2", "score": 0.87, "text": "向量库通常用 HNSW..."},
    ][:k]

@observe(name="rerank", as_type="span")
def rerank(query: str, docs: list):
    # 假装这里是 cross-encoder rerank
    return sorted(docs, key=lambda d: -d["score"])

@observe(name="rag-answer")
def rag_answer(user_id: str, query: str) -> str:
    # 把用户身份和会话挂到 trace 上
    langfuse.update_current_trace(user_id=user_id, tags=["rag", "prod"])

    docs = retrieve(query, k=5)
    docs = rerank(query, docs)
    context = "\n\n".join(d["text"] for d in docs)

    # openai 已被 langfuse 包装，会自动产生 generation 子 span
    resp = openai.OpenAI().chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "用提供的上下文严格回答。"},
            {"role": "user", "content": f"上下文:\n{context}\n\n问题: {query}"},
        ],
        temperature=0.2,
        name="rag-llm-call",  # langfuse 扩展参数
        metadata={"retrieved_doc_ids": [d["id"] for d in docs]},
    )
    return resp.choices[0].message.content

if __name__ == "__main__":
    out = rag_answer(user_id="u-42", query="RAG 用什么向量索引？")
    print(out)
    langfuse.flush()
```

打开 Langfuse UI，你会看到一棵树：根 trace 是 `rag-answer`，两个 span 是 `retrieve` 和 `rerank`，一个 generation 是 `rag-llm-call`，每个节点都有 IO、耗时、token、cost。把 user_id 和 tags 挂上去之后，可以按用户、按 feature 维度做聚合查询，这是后面做 cohort 分析的入口。

**trace 数据用来回答的典型问题：**

- "上周哪些用户的失败率最高？"——按 user_id 聚合 thumbs down rate。
- "上下文长度是否和回答质量负相关？"——把 prompt token 数和 LLM-as-judge 分数做散点。
- "rerank 是否真的有用？"——比较带 rerank 和不带 rerank 的 faithfulness。
- "哪个 retrieval 文档被检索最多？这个文档质量如何？"——按 doc_id 聚合命中次数和下游评分。

这些问题在没有 trace 之前几乎全部要靠拍脑袋。有了结构化 trace 后，每个都是一条 SQL。

### 24.4.2 输入输出：要不要全采

全采是合规的对立面。多数生产系统会做三档处理：

- 默认：采 metadata（token、模型、参数、retrieval doc IDs），不采原文。
- 抽样：随机或按 user_id 哈希采 1–5% 的原文，用于离线分析。
- 失败：报错或低分反馈触发的 trace，全采原文，确保能复盘。

如果业务涉及医疗、金融、未成年人，原文采集要走法务，并配套字段级脱敏（手机号、身份证、地址、姓名）。Langfuse / Phoenix 都支持自定义 redaction hook，把数据塞进 SDK 之前先过一遍正则或 NER。

### 24.4.3 成本：从一开始就建模

成本是 LLM 应用最容易失控的维度，因为它跟着 token 走，而 token 跟着用户行为走。最低限度要监控：

- **cost / request**：单次调用花费。出现尖刺通常意味着某个 prompt 模板里塞进了不该塞的大段上下文。
- **cost / user / day**：按用户聚合。出现某用户单日 100 美元，要么是滥用，要么是某个长会话循环。
- **cost / feature**：按业务功能聚合，需要 trace 上挂 `feature` tag。决定哪个 feature 值得继续投入。
- **cost forecast**：基于近 7 / 30 天趋势预测月底总成本，超过预算 80% 触发告警。

成本计算依赖准确的单价表。OpenAI / Anthropic / Bedrock 各家定价不同，且随版本变。Langfuse、Helicone、Phoenix 都内置了主流模型的价格映射，但**自托管模型必须自己算**——按 GPU 小时折算到 token 单价，再回填进 trace。

### 24.4.4 延迟：分清三种延迟

LLM 延迟不能用单一数字表达，至少要拆三个：

- **TTFT**（Time To First Token）：用户感知"系统是不是死了"的第一指标。流式接口下 TTFT 直接决定用户体验。
- **TBT**（Time Between Tokens）：token 之间的间隔。和模型大小、批处理、网络抖动相关。
- **Total Latency**：完整生成时间 = TTFT + TBT × output_tokens。

监控大盘上每个都要有 P50 / P95 / P99。注意 P99 在 LLM 场景下经常是 P50 的 5–10 倍，因为长输出本身就慢。把"延迟过长"和"延迟相对自身基线偏移"分开报警，避免长输出场景天天误告警。

**一个真实的延迟故障案例：** 有团队报告"用户感觉系统越来越慢"，看 P50 没变化，看 P95 也只涨了 10%，但用户投诉持续。打开 trace 详看，发现是 P99 长尾从 8 秒涨到了 22 秒，且这部分长尾用户重叠度高（同一批高频用户）。根因是某个新加的 retrieval 在大文档命中时全量加载到 context，把 prompt 推到 50K token 以上，输出阶段被 token 速率拖慢。这种问题在传统 latency 监控里几乎看不出，必须看 P99、按用户聚合、且能下钻到 trace 的 token 数。另外建议把 token 数 vs 总延迟做散点，异常点往往是一类故障的早期证据。

### 24.4.5 用户反馈：显式 + 隐式

显式反馈是 thumbs up / down、5 星评分、文本反馈。挂到 trace 上，可以直接定位问题样本。

```python
# 用户在 UI 里点了 thumbs down
langfuse.create_score(
    trace_id=trace_id,
    name="user_feedback",
    value=0,  # 0 = down, 1 = up
    comment=user_comment,  # 可选文本
)
```

隐式反馈往往更稠密：

- **重试率**：用户在收到回答后立即追问"再说一遍"或换个问法，是回答失败的强信号。
- **复制率**：用户复制了回答内容，是有用的强信号（对代码助手、文案生成尤其有效）。
- **会话长度**：偏离正常分布的极长会话往往是用户在死磕一个失败的请求。
- **流失**：用户在收到这条回答后多久没回来，是产品级的延迟信号。

显式反馈样本量小但精确，隐式反馈量大但有噪声，两者都要进 trace，由后续评估管线消化。

### 24.4.6 漂移监控：把传统 PSI/KS 套到 LLM 上

第 06 章 6.11 节讲的 PSI、KS、Wasserstein、JS 散度这套方法论在 LLM 应用里**没有作废，反而是漂移监控的根基**。需要换的不是统计工具，而是输入空间——从结构化特征换成 token / embedding / judge score。

落到工程实现，三类信号要分别跑漂移检测：

| 信号 | 输入 | 监控指标 | 工具 |
|------|------|----------|------|
| **Query embedding 漂移** | 用户 query 的 embedding 向量 | 逐维 PSI；MMD（联合分布） | alibi-detect、自实现 |
| **Output 长度 / 结构漂移** | output tokens、JSON 字段缺失率、格式合规率 | KS 检验、卡方 | 自实现 + dashboard |
| **Judge score 分布漂移** | 在线 judge 的 quality score 序列 | KS 检验、PSI | 自实现 |

```python
# Query embedding 漂移：复用 06 章的 PSI 思路
import numpy as np
from sklearn.decomposition import PCA

def embedding_psi(ref_embeds: np.ndarray, cur_embeds: np.ndarray,
                  n_components: int = 8, buckets: int = 10):
    """先 PCA 降到低维，再逐维算 PSI，返回每维 PSI 和最大值。
    ref_embeds: 参考期 embedding，shape (N_ref, dim)
    cur_embeds: 当前期 embedding，shape (N_cur, dim)
    """
    pca = PCA(n_components=n_components).fit(ref_embeds)
    ref_p = pca.transform(ref_embeds)
    cur_p = pca.transform(cur_embeds)

    psi_per_dim = []
    for d in range(n_components):
        bp = np.percentile(ref_p[:, d], np.linspace(0, 100, buckets + 1))
        bp[0], bp[-1] = -np.inf, np.inf
        e = np.histogram(ref_p[:, d], bp)[0] / len(ref_p)
        a = np.histogram(cur_p[:, d], bp)[0] / len(cur_p)
        e = np.where(e == 0, 1e-6, e)
        a = np.where(a == 0, 1e-6, a)
        psi_per_dim.append(float(np.sum((a - e) * np.log(a / e))))
    return psi_per_dim, max(psi_per_dim)

# 经验阈值同 06 章：max PSI < 0.1 稳定，0.1~0.25 注意，> 0.25 告警
```

```python
# Judge score 分布漂移：KS 检验
from scipy import stats

def judge_score_drift(ref_scores: list, cur_scores: list, alpha: float = 0.05):
    stat, pvalue = stats.ks_2samp(ref_scores, cur_scores)
    return {
        "ks_statistic": float(stat),
        "p_value": float(pvalue),
        "drifted": pvalue < alpha,
        "ref_mean": float(np.mean(ref_scores)),
        "cur_mean": float(np.mean(cur_scores)),
    }
```

**和 06 章方法论的对应关系：**

- 06 章里"用一个分类器区分训练集和线上数据，AUC 显著高于 0.5 即漂移"——LLM 场景里直接训一个二分类器把 query embedding 分成"参考期 vs 当前期"，AUC 越高漂移越严重。这是检测联合分布变化最敏感的方法。
- 06 章 6.11.3 讲的"三层告警（数据漂移 → 预测漂移 → 性能下降）"在 LLMOps 里直接对应：query embedding 漂移（最早期）→ 输出分布 / judge score 漂移（中期）→ thumbs down rate / 业务转化率下降（最晚但最确定）。早期信号给运营和数据团队留排查时间，最晚信号触发回滚。
- 06 章强调"漂移特征是不是 SHAP top-3"决定是否立即应对——LLMOps 里没有 SHAP，但可以看"漂移最严重的 embedding 维度上的样本"是不是同时 judge score 也低，两个信号叠加才升级到 page。

分布对比 + 距离度量 + 显著性检验的思路 30 年没变，变的只是输入。**06 章给方法论，本章给 LLM 场景的工程实现，配合读才完整。**

---

## 24.5 离线评估

线上跑得再多也代替不了离线评估。原因有三：线上没法穷举边角 case，线上失败有用户代价，线上没法做"这两个 prompt 哪个更好"的 head-to-head 比较。离线评估的核心组件是：数据集 + 评估器 + 实验管理。

### 24.5.1 数据集怎么建

数据集不是一次性产物。它是一个不断生长的资产。常见的来源是四块：

1. **种子样本**：上线前根据 PRD 手写 50–200 条覆盖主要 use case 的样本。这是最低门槛。
2. **真实流量采样**：从生产 trace 里抽样，按 user / feature / 时间分层。注意脱敏。
3. **失败案例**：所有 thumbs down、报错、低分 LLM-as-judge 自动入数据集（Failure → Dataset 闭环，24.7 详述）。
4. **对抗样本**：red team 手工或自动生成的越界、注入、异常输入。

建议至少分三个 split：

- **regression set**：大约 100–500 条，每次 prompt 改动都跑。要快（几分钟内）、要稳（指标稳定才能感知变化）。
- **comprehensive set**：1000+ 条覆盖各种边角，发版前跑。
- **adversarial set**：专门测安全、注入、越狱、PII 泄漏。

数据集要版本化。Langfuse、Phoenix、LangSmith 都把 dataset 作为一等公民，每次添加新样本就是一次 dataset version。这是后面做"Prompt v3 在 dataset v7 上的得分"的前提。

**数据集的"难度分布"很重要。** 一个常见错误是数据集全是简单 case，prompt 怎么改都满分，看不出差异；或者全是极端 case，反复在 50% 上下抖。健康分布大致是：

- 30% 简单（成熟 prompt 应该做对）：用来发现严重退化
- 50% 中等（边界 case）：用来区分版本优劣
- 20% 困难（已知失败或对抗）：用来观察天花板

每次评估报告里把三档分数分开看，比看一个聚合数字信息量大得多。

**隐藏测试集（held-out）的纪律：** 即使是离线 evaluation，也要切出 10–20% 永远不参与 prompt 调试的 held-out。否则你会在长期迭代中无意识地 overfit 到评估集。held-out 只在重大版本发布前跑一次，作为最终质量证明。如果 held-out 分数和日常 dev set 差太多，说明你已经过拟合了，要么 dev set 重新洗牌，要么扩充 held-out。

### 24.5.2 自动指标：传统指标已经不够

在第 06 章我们已经聊过 BLEU / ROUGE 在生成任务下的局限，这里只补充 LLM 应用特有的指标。

**事实一致性（faithfulness）**：输出是否被检索到的上下文支持？这是 RAG 最重要的指标，对应"幻觉率"的反面。

**答案相关性（answer relevancy）**：输出是否和用户问题相关？

**上下文相关性（context relevancy / precision / recall）**：检索到的文档是否相关？这是 retrieval 单独的健康度。

**简洁性 / 礼貌 / 语气**：业务相关的风格指标，通常用 LLM-as-judge 或正则做。

**结构化合规**：JSON / 函数调用是否符合 schema。这是少数能用纯代码确定性判定的指标，能用就用。

ragas 是 RAG 场景下做这些指标的事实标准。用法：

```python
# pip install ragas datasets
from datasets import Dataset
from ragas import evaluate
from ragas.metrics import (
    Faithfulness,
    AnswerRelevancy,
    ContextPrecision,
    ContextRecall,
)
from ragas.llms import LangchainLLMWrapper
from langchain_openai import ChatOpenAI

# 数据集字段约定：question, answer, contexts, ground_truth
samples = [
    {
        "question": "RAG 用什么向量索引？",
        "answer": "通常用 HNSW 或 IVF-PQ，HNSW 召回好但内存大。",
        "contexts": [
            "向量库常用 HNSW...",
            "IVF-PQ 适合超大规模...",
        ],
        "ground_truth": "HNSW、IVF-PQ 是常见的向量索引。",
    },
    # ... 更多样本
]
ds = Dataset.from_list(samples)

judge = LangchainLLMWrapper(ChatOpenAI(model="gpt-4o", temperature=0))

result = evaluate(
    ds,
    metrics=[
        Faithfulness(llm=judge),
        AnswerRelevancy(llm=judge),
        ContextPrecision(llm=judge),
        ContextRecall(llm=judge),
    ],
)
print(result)
# 输出: {'faithfulness': 0.84, 'answer_relevancy': 0.91, ...}
```

ragas 的所有指标都是 LLM-as-judge 实现的，意味着它的可信度上限就是 judge 模型的可信度。生产里建议用比应用本身更强的模型做 judge（应用用 gpt-4o-mini，judge 用 gpt-4o 或 Claude Sonnet），否则会出现 judge 看不出问题的情况。

ragas 在 0.4 之后启动了 collections-based API 迁移：旧的 `from ragas.metrics import Faithfulness` 仍可用，但官方计划在 1.0 移除，新写代码推荐 `from ragas.metrics.collections import Faithfulness` 并使用其 `.score() / .ascore()` 方法。生产代码做版本升级时关注这条迁移路径，避免到 1.0 才发现要全量改。

### 24.5.3 LLM-as-judge：又强又脏的工具

LLM-as-judge 解决了"生成任务没法自动评估"这个根本问题，让评估能跑在 CI 流水线里。但它有一堆已知偏见，照搬会得到看起来精确实际胡来的指标。

**位置偏见（position bias）**：在两两对比 A vs B 时，LLM 倾向于选第一个或第二个，且不同模型偏好不同。GPT-4 系列偏第二个，Claude 系列在某些版本偏第一个。候选越多偏见越严重。**缓解：每对都跑两遍正反顺序，只在两次都给同一个答案时才采纳。**

**长度偏见（length bias）**：更长的回答被认为更好，即使内容质量没差。**缓解：在 prompt 里显式说明"长度不应作为质量判断依据"；或者把回答截断到等长。**

**自我偏好（self-preference）**：judge 偏好和自己同家族的模型生成的回答。GPT-4 judge 给 GPT-4 生成的打分系统性偏高。**缓解：用不同家族模型做 judge；或者用多 judge 集成。**

**冗长偏见（verbosity）**：判断说理详细的回答更可信，即使逻辑错误。**缓解：要求 judge 先输出判断再输出理由，或反之，做对照实验。**

**已知答案偏见（known-answer）**：judge 对自己训练数据里见过的答案打分偏高。**缓解：数据集尽量用近期数据 + 私有数据。**

**校准漂移**：同一个 judge 在不同时间给同一对回答打分可能不同（即便 temperature=0）。**缓解：绑定 judge 模型版本（不要用 alias 如 `gpt-4o`，用 `gpt-4o-2024-08-06`）；定期跑 calibration set 监控漂移。**

**文化与语言偏见（cultural / linguistic bias）**：以英文为主训练的 judge（GPT-4 / Claude / Gemini）评估非英文输出时存在系统性偏差，中文场景尤甚。具体表现：

- **结构偏见**：偏好"先结论后论据"的美式写作结构，对中文常见的"先铺垫后结论""曲径通幽"扣分，即便业务语境下后者更合适（客服、政务、医疗咨询）。
- **风格偏见**：把中文敬语、委婉语判定为"啰嗦不直接"，反而对英式客套（"I would be happy to assist..."）打高分。中文产品里"您好，关于您咨询的问题..."这种开场常被 judge 标"redundant"。
- **术语偏见**：偏好中英混用甚至全英文术语，"调用 API 接口"打分高于"调用接口"，与目标用户语感相反。
- **本地化事实判定弱**：涉及医保政策、户籍流程、节日习俗、本地法规、地名简称时，judge 常把"对的中文事实"判为"幻觉"——它训练数据里这部分覆盖薄。
- **方言/口语容忍度低**：用户用粤语、川渝、东北话等地域表达提问时，模型理解后给出的合规中文回答会被 judge 判定"答非所问"。

**缓解手段**：

1. **rubric 显式声明语言/文化中立条款**。在 judge prompt 里加："评分仅基于事实正确性、相关性、完整性；语言风格、表达习惯、文化背景差异不应影响打分。中文回答的常见结构（铺垫-展开-结论）和敬语用法是合规的。"
2. **中文场景优先选中文友好的 judge**。DeepSeek-V3 / Qwen-Max / GLM-4 / Doubao 在中文 rubric 任务上的 inter-annotator agreement 通常优于 GPT-4 / Claude。生产里常见组合：应用用 gpt-4o-mini，judge 用 Qwen-Max 或多 judge 集成（GPT-4 + Qwen-Max + 一个开源中文 judge）。
3. **calibration set 必须包含中文母语标注**。不能只把英文 rubric 翻译过来跑；要让中文母语者独立标注 100–200 条，再算 judge 与人工的 Cohen's κ。κ < 0.5 直接换 judge。
4. **本地化事实题单独跑**。把"中国本地业务知识"切成单独 evaluation set，由领域专家（医保咨询师、税务师、政务工作人员）标注 ground truth，绕过 judge 的本地化盲区。
5. **多 judge 投票时按文化背景配权**。中文任务里 GPT-4 和 Qwen-Max 分歧时，更信任 Qwen-Max；英文任务里反过来。

不做这些处理，中文 LLM 应用跑出的 LLM-as-judge 分数曲线和真实用户满意度曲线常常是脱节的——judge 觉得"哎这个回答不够直接"，中文用户觉得"这答得挺得体"。这种脱节在产品 metric 复盘时会变成谜团，根因往往就在这里。

下面是一个自实现的 pairwise LLM-as-judge，包含位置偏见缓解：

```python
from openai import OpenAI
import json
from concurrent.futures import ThreadPoolExecutor

client = OpenAI()
JUDGE_MODEL = "gpt-4o-2024-08-06"  # 绑定版本

JUDGE_PROMPT = """你是严格的评估员。比较两个回答 A 和 B 对用户问题的质量。

评估维度（按重要性排序）：
1. 事实正确性（是否有错误信息）
2. 回答相关性（是否切题）
3. 完整性（是否回答了问题的所有部分）

注意：长度不应作为质量判断依据。简短但正确的回答应该胜过冗长但有错的回答。

请输出 JSON: {"winner": "A" | "B" | "TIE", "reason": "..."}

问题: {question}

回答 A: {answer_a}

回答 B: {answer_b}
"""

def judge_once(question, ans_x, ans_y):
    prompt = JUDGE_PROMPT.format(question=question, answer_a=ans_x, answer_b=ans_y)
    resp = client.chat.completions.create(
        model=JUDGE_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        response_format={"type": "json_object"},
    )
    return json.loads(resp.choices[0].message.content)

def pairwise_judge(question, answer_a, answer_b):
    """带位置偏见缓解的 pairwise judge。
    返回: 'A' / 'B' / 'TIE' / 'INCONSISTENT'
    """
    # 正反两个顺序各跑一遍
    fwd = judge_once(question, answer_a, answer_b)  # A 在前
    bwd = judge_once(question, answer_b, answer_a)  # B 在前

    # 把 bwd 的 A/B 翻译回原始 A/B
    bwd_winner = {"A": "B", "B": "A", "TIE": "TIE"}[bwd["winner"]]

    if fwd["winner"] == bwd_winner:
        return fwd["winner"]
    # 两次结果不一致，意味着 judge 对位置敏感，结果不可信
    return "INCONSISTENT"

def evaluate_dataset(samples, model_a_fn, model_b_fn, n_workers=8):
    """并行评估整个数据集。"""
    def one(s):
        q = s["question"]
        return pairwise_judge(q, model_a_fn(q), model_b_fn(q))

    with ThreadPoolExecutor(max_workers=n_workers) as ex:
        results = list(ex.map(one, samples))

    n = len(results)
    return {
        "A_wins": results.count("A") / n,
        "B_wins": results.count("B") / n,
        "ties": results.count("TIE") / n,
        "inconsistent": results.count("INCONSISTENT") / n,
    }
```

`inconsistent` 比例是 judge 质量的体感指标。如果它超过 20%，说明你的 judge prompt 或 judge model 对这个任务不胜任，要么换更强的 judge，要么改写评估 rubric。

**单点打分（pointwise）vs 两两对比（pairwise）的取舍：** pointwise 让 judge 给单个回答打 1–5 分，简单、快、能跨实验比较，但绝对分数极易受 prompt 措辞影响（同一份回答让 judge 用不同 rubric 打可能从 3 分变 5 分）。pairwise 让 judge 比较两个回答，对相对差距敏感，结论稳定，但跨实验对比要构造对照组。实操：迭代 prompt 时用 pairwise（拿当前线上版本做 baseline，比较新版本的胜率），上线后做时间趋势监控用 pointwise（只看趋势，不看绝对值）。

**LLM-as-judge 和人工的 calibration：** 上线一个新的 judge 之前，跑这套流程：

1. 准备一个 100 条的 calibration set，每条都有 2–3 个标注员的人工评分。
2. 用 judge 跑同一个 set，得到 LLM 评分。
3. 计算 Pearson / Spearman 相关，以及 Cohen's κ（如果是离散分类）。
4. 相关系数 > 0.7 才能上线。低于 0.5 就别用了，结论不可信。
5. 上线后每月重跑一次同一个 calibration set，监控 judge 是否漂移。

这一步常被跳过，导致一堆团队跑出"看起来很科学"的 LLM-as-judge 结论，但其实和真人判断脱节。

**ragas 是怎么算 faithfulness 的：** 它把生成的答案先拆成原子声明（claim），对每个 claim 单独问 judge："给定这些 context，这个 claim 是否被支持？"最后取支持比例作为 faithfulness 分数。这种"先拆解再判断"的设计极大降低了 judge 一次性消化整段输出的难度，也让分数有了可解释性——分数低的时候你能看到具体是哪个 claim 没被支持。自实现简化版本：

```python
from openai import OpenAI
import json
client = OpenAI()

def extract_claims(answer: str) -> list[str]:
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content":
            f"把下面的回答拆成原子声明（每条不可再分），输出 JSON 数组。\n\n回答: {answer}"}],
        response_format={"type": "json_object"},
        temperature=0,
    )
    return json.loads(resp.choices[0].message.content).get("claims", [])

def claim_supported(claim: str, contexts: list[str]) -> bool:
    ctx = "\n---\n".join(contexts)
    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content":
            f"上下文:\n{ctx}\n\n声明: {claim}\n\n这个声明是否被上下文支持？只输出 yes 或 no。"}],
        temperature=0,
    )
    return resp.choices[0].message.content.strip().lower().startswith("yes")

def faithfulness(answer: str, contexts: list[str]) -> float:
    claims = extract_claims(answer)
    if not claims:
        return 1.0
    supported = sum(1 for c in claims if claim_supported(c, contexts))
    return supported / len(claims)
```

ragas 的实现比这复杂很多（处理多语言、增量计算、缓存、批量），但思路是这一套。理解原理之后你就能按业务需要扩展自己的指标。

**dataset 版本化的实操：** 数据集变化是 LLMOps 里最容易被忽视的回归源。如果你今天加了 50 条新样本，明天的评估分数下降了，是 prompt 退化还是数据集变难了？区分不开就没法决策。最稳的做法：

- 每次 dataset 变更视为一次 commit（在 Langfuse / Phoenix / LangSmith 都是 dataset version）。
- prompt 的每次变更对应一个 prompt version。
- evaluation run 同时绑定 (prompt_version, dataset_version, judge_version)。
- 看趋势的时候只对比"同一 dataset_version 上不同 prompt_version 的得分"。

### 24.5.4 人工标注：贵但不可或缺

LLM-as-judge 不能完全替代人工。对模糊任务（创意、风格、复杂推理），人工标注仍是金标准。常用工具：

- **Label Studio**：开源，自托管。配 LLM 输出对比模板很简单，适合多人协作。
- **Prodigy**：商业，spaCy 出品。极简交互，适合快速迭代标注 schema。
- **平台内置**：Langfuse / Phoenix / LangSmith 都内置标注队列，可以直接把生产 trace 派给标注员。

实战节奏：每周从生产采样 100–200 条，标注员花半天打分，分数回流到平台。这批人工分也喂给 §24.5.3 的 judge calibration 流程。

**标注质量怎么保证：** 单人标注容易有个人偏好，要么三人交叉（取多数），要么主标 + 抽查（10% 由 senior 复核）。标注 rubric 要写到非常具体——"回答是否准确"这种问法标注员自由心证差异极大；改成"回答中是否包含至少一处事实错误（错误是指与提供 context 矛盾的陈述）"，结论一致性会明显上升。新 rubric 上线前一定要跑 IAA（Inter-Annotator Agreement），κ < 0.6 说明 rubric 还不够明确。

**标注成本怎么控：** 全量人工标注不现实。常见做法是 LLM-as-judge 先跑全量，标注员只复核 judge 不确定（置信度低）或 judge 与用户反馈冲突的样本。这样人工成本可以压到全量的 10–20%，且重点放在最有信息的样本上。

### 24.5.5 框架对比：DeepEval / promptfoo / ragas / OpenAI evals

四个框架不是互斥的。

- **ragas**：RAG 专用。指标库窄但深，零配置（不需要 ground truth 也能跑大部分指标）。适合 RAG-as-product。
- **DeepEval**：pytest 风格的通用 LLM 测试框架。50+ 指标覆盖 RAG、agent、多轮、多模态。最适合放进 CI 当回归门禁。
- **promptfoo**：CLI + YAML 配置驱动。强项是 red team、prompt 对比矩阵（多 prompt × 多模型 × 多输入）、多模型对比。Node 生态友好。
- **OpenAI evals**：OpenAI 官方框架，结构严谨但工程化偏弱。如果你完全在 OpenAI 生态，且对开源贡献评估集有兴趣，值得用。

混搭推荐：CI 用 DeepEval 做 pytest 风格的回归；prompt iteration 阶段用 promptfoo 跑矩阵实验；RAG 健康度用 ragas；最后所有结果丢进 Langfuse / Phoenix 看趋势。

下面是一个 promptfoo 配置，对比两个 prompt 在五种模型上的表现：

```yaml
# promptfooconfig.yaml
description: "客服回复 prompt 对比"

prompts:
  - id: prompt-v1
    raw: |
      你是客服助手。用礼貌简洁的语气回答用户问题。
      用户: {{query}}
  - id: prompt-v2
    raw: |
      你是高级客服专员。先确认理解用户的问题，再给出明确解决方案，
      最后询问是否还有其他需要帮助。
      用户: {{query}}

providers:
  - openai:gpt-4o-mini
  - openai:gpt-4o
  - anthropic:claude-3-5-haiku-20241022
  - anthropic:claude-3-5-sonnet-20241022
  - bedrock:anthropic.claude-3-5-sonnet-20241022-v2:0

tests:
  - vars:
      query: "我的订单怎么还没发货？"
    assert:
      - type: llm-rubric
        value: 回答必须包含查询订单状态的具体步骤，且语气礼貌
      - type: not-contains
        value: "我不能"
      - type: javascript
        value: "output.length < 500"
  - vars:
      query: "申请退款"
    assert:
      - type: llm-rubric
        value: 必须告知退款流程，预期到账时间，并表达歉意
      - type: latency
        threshold: 5000  # ms

defaultTest:
  options:
    provider:
      id: openai:gpt-4o
      config:
        temperature: 0
```

跑 `promptfoo eval` 之后，得到一张 prompt × model × test case 的矩阵，每格是 pass / fail 加一个分数。这种格式适合在 prompt 调试期快速做横向对比。

---

## 24.6 在线评估

离线评估再充分，最后一公里仍然要在线上验证。原因是离线数据集再大也是历史快照，捕捉不到分布漂移、用户行为变化、新型对抗输入。

### 24.6.1 显式反馈与隐式反馈

显式：thumbs up/down、星级、文本反馈。要把这些字段挂到 trace 上，做到"任意一个差评样本都能在 5 秒内打开它的完整 trace"。

隐式：

- **重试 / 改写**：用户在收到回答 30 秒内发出包含"再说一遍 / 换个说法 / 你没听懂"的消息，标记为隐式 negative。
- **复制行为**：在产品里埋点，记录用户复制了哪一段输出。复制是高强度的 positive 信号。
- **打断**：在流式输出场景，用户在生成过程中点击停止，标记为隐式 negative。
- **后续行为**：用户在收到代码后是否真的运行、收到答案后是否点了引用文档链接。这些都是任务完成度的代理信号。

显式 + 隐式聚合成一个 quality score 之后，能驱动两件事：（1）按时间趋势监控产品健康度；（2）筛选低分样本进 failure dataset。

### 24.6.2 在线 LLM-as-judge：异步评分而非同步阻塞

理想情况下，每条线上请求都跑一次 LLM-as-judge 给出实时评分，但这有两个代价：增加一次 LLM 调用的成本（往往用更强的 judge 模型，可能比应用本身贵几倍），增加用户感知延迟（同步等 judge 完成再返回）。

实操中通常这样处理：

- **采样在线评分**：随机抽 5–10% 的请求做异步 judge，结果回写到 trace。这部分给质量趋势监控用。
- **失败优先评分**：thumbs down、低显式分、parse error 等失败信号触发的请求，全部 judge，进 failure dataset。
- **离线全量评分**：每天定时把昨天的 trace 拉出来做批量 judge，结果回填，做日级别质量报表。

异步要靠后台 worker（Celery / Sidekiq / 自己写的队列）。架构上 judge 完全和用户路径解耦，judge 失败不影响线上。

### 24.6.3 评估成本：LLM-as-judge 不是免费午餐

很多团队接 LLM-as-judge 时只算应用本身的 cost，结果月底账单出来发现 judge 占了总成本 30–60%。Judge 成本必须从一开始就建模，否则你的 quality 监控会反噬业务利润率。

**单次 judge 调用的 token 成本估算**。一次典型的 pointwise judge 调用 ≈ 系统 prompt（rubric，300–800 token）+ 用户问题（50–200 token）+ 模型回答（100–500 token）+ 输出（100–300 token，含理由 + 分数）。综合下来一次 judge 平均 **800–1500 input token + 200–400 output token**。pairwise 判定要塞两个回答，再加 200–500 token。Faithfulness 这种"先拆 claim 再逐条判"的指标要跑 N+1 次（N = claim 数），单条样本可能要 5–10 次 judge 调用。

**按单价折算（2026 年 5 月主流模型价格，仅作量级参考）：**

| Judge 模型 | Input ($/1M tok) | Output ($/1M tok) | 单次 pointwise judge | 单次 ragas faithfulness |
|------------|------------------|-------------------|----------------------|--------------------------|
| gpt-4o-mini | 0.15 | 0.60 | ~$0.0003 | ~$0.002 |
| gpt-4o | 2.50 | 10.00 | ~$0.005 | ~$0.03 |
| claude-3.5-sonnet | 3.00 | 15.00 | ~$0.006 | ~$0.04 |
| claude-3.5-haiku | 0.80 | 4.00 | ~$0.002 | ~$0.012 |
| deepseek-v3 | 0.27 | 1.10 | ~$0.0006 | ~$0.004 |
| qwen-max | 2.40 | 9.60 | ~$0.005 | ~$0.03 |

**按每 1000 次应用请求的 judge 成本测算（输出量级感）：**

- **简单 pointwise judge + 100% 采样**：用 gpt-4o-mini 约 $0.30；用 gpt-4o 约 $5；用 claude-3.5-sonnet 约 $6。
- **ragas 全套（faithfulness + answer_relevancy + context_precision + context_recall）+ 100% 采样**：用 gpt-4o 约 $50–100，用 gpt-4o-mini 约 $3–6。
- **pairwise judge（带位置偏见缓解，跑两遍）+ 100% 采样**：判定成本约翻倍。

反直觉但常见的事实：当应用本身用便宜模型（gpt-4o-mini、deepseek-v3）而 judge 用强模型（gpt-4o）时，**judge 比应用贵 5–20 倍**，100% 全量 judge 时 judge 单项能吃掉月度总成本一半以上。

**采样比例 vs 检测精度的权衡**：在线 judge 不需要 100% 跑。采样比例 $r$ 时，对一个真实 quality drop $\Delta$（比如 quality score 从 0.85 跌到 0.80），最少需要的总流量约为：

$$N \geq \frac{(z_{\alpha/2} + z_{\beta})^2 \cdot 2\sigma^2}{\Delta^2 \cdot r}$$

也就是说 **judge 采样率减半，需要的总流量翻倍才能可靠检测同样的 drop**。实操经验：

- 流量 < 1k QPS：建议 100% judge（成本绝对值不大，检测延迟最小）。
- 流量 1k–10k QPS：5–20% 随机采样 + 失败优先全采。
- 流量 > 10k QPS：1–5% 随机采样 + 失败优先全采。
- 任何规模下，**failure-driven judge（thumbs down、parse error、低显式分触发）都要 100% 跑**——这部分样本不仅最有信息量，量也小。

**降本套路（每条都验证有效）：**

1. **分层 judge**：用便宜 judge（gpt-4o-mini、Haiku、DeepSeek-V3）跑全量，分歧或低分样本再上贵 judge。这是最有效的成本控制手段，可以压成本 60–80%。
2. **prompt cache**：rubric 是固定的，让 judge prompt 命中 prompt cache（OpenAI、Anthropic 都已支持）。rubric 长度大于 1024 token 时 cache 命中能省 50–90% input cost。
3. **小模型 + 多次投票**：3 次小模型投票的总成本通常仍低于 1 次大模型，且方差更可控。
4. **批量 API**：OpenAI / Anthropic 都有 batch API，离线 judge 用 batch 走能拿到 50% 折扣，延迟换成本。
5. **判定预算上限**：在 worker 配 budget limit（每天 $X），超了切到便宜 judge 或暂停。
6. **绕过 LLM 能算的不要走 judge**：JSON schema 校验、长度上限、关键词黑白名单、正则——这些用代码 0 成本判定，先跑这一层把 90% 简单 case 过掉，judge 只看剩下的。

**Judge 成本要单独打 dashboard**：和应用 cost 分开看，按 judge model、按 evaluator 类别、按采样原因（random vs failure-triggered）三个维度切。任何一档突然涨了，立刻能定位。建议给 judge 单独建一个 service tag（"llm-judge-online" / "llm-judge-offline" / "llm-judge-batch"），trace 上挂上去，cost 归集干净。

**一个真实数字**：某中型客服 RAG 系统，日均 50 万次应用调用，应用模型 gpt-4o-mini，月成本约 $1500。开 100% 在线 ragas 评估（gpt-4o 做 judge）后月成本变成 $4800（judge 占 70%）。改成 5% 随机采样 + 100% failure 触发 + prompt cache 后月成本回落到 $1900（judge 占 20%），且核心指标的检测精度仍能在 1 周内识别 5% 的 quality drop。这是个值得参考的目标比例：**judge 成本控制在应用成本的 20–30% 是健康的**，超过 50% 通常意味着采样策略需要重新设计。

### 24.6.4 A/B 测试在 LLM 应用里怎么做

A/B 测试的统计学和传统产品没区别——你需要一个 KPI、一个分流机制、一个统计显著性检验。难点在 LLM 特有的几个地方：

**KPI 选什么。** 不要直接用"用户对回答的满意度"做唯一 KPI，因为它分布偏 positive、信号稀疏。建议组合：

- 主指标：任务完成率（业务定义，比如"用户点击了答案中的链接"）
- 次指标：thumbs up rate、复制率、平均会话长度
- 健康指标：cost / request、P95 latency、error rate

**分流粒度。** 必须按用户分流，不能按请求分流。同一个用户在一次会话里看到两个不同 prompt 的输出会精神分裂。

**对照组健全性。** 在正式 A/B 之前先跑 A/A——两组都跑控制 prompt——确认两组指标在统计上无显著差异。如果 A/A 就显著，说明你的分流或埋点有问题。

**样本量。** LLM 指标通常方差大、信号弱，需要的样本量比传统 A/B 多。先用历史数据估方差，再算样本量。一个粗略经验：thumbs up rate 类指标，要检测 1% 的提升，单组至少 5–10 万用户。

**回滚机制。** 上线前必须有 instant rollback——通过 feature flag 一键切回。任何 A/B 都不能依赖代码部署来切换。

下面是一个最小 A/B 框架，使用一致性哈希分流，输出按变体打 trace tag，方便后续在 Langfuse / 数仓里做汇总分析。

```python
import hashlib
import os
from dataclasses import dataclass
from typing import Callable
from langfuse import Langfuse, observe

langfuse = Langfuse()

@dataclass
class Variant:
    name: str
    handler: Callable[[str], str]  # query -> answer

@dataclass
class Experiment:
    name: str
    variants: list[Variant]
    weights: list[float]  # 长度 == variants，和为 1
    enabled: bool = True

    def __post_init__(self):
        assert abs(sum(self.weights) - 1.0) < 1e-6
        assert len(self.weights) == len(self.variants)

def assign_variant(exp: Experiment, user_id: str) -> Variant:
    """一致性哈希分流。同一 user_id + 同一 experiment 永远落到同一变体。"""
    if not exp.enabled:
        return exp.variants[0]  # 默认控制组
    h = hashlib.md5(f"{exp.name}:{user_id}".encode()).hexdigest()
    bucket = int(h, 16) / 16**32  # 0..1
    cum = 0.0
    for v, w in zip(exp.variants, exp.weights):
        cum += w
        if bucket < cum:
            return v
    return exp.variants[-1]

def handler_v1(query: str) -> str:
    # ... 调用 prompt v1
    return f"[v1] {query}"

def handler_v2(query: str) -> str:
    # ... 调用 prompt v2
    return f"[v2] {query}"

EXP = Experiment(
    name="customer_reply_v2",
    variants=[Variant("control", handler_v1), Variant("treatment", handler_v2)],
    weights=[0.9, 0.1],  # canary：10% 流量到新 prompt
    enabled=os.getenv("EXP_CUSTOMER_REPLY_V2", "1") == "1",
)

@observe(name="customer-reply")
def serve(user_id: str, query: str) -> str:
    variant = assign_variant(EXP, user_id)
    langfuse.update_current_trace(
        user_id=user_id,
        tags=[f"exp:{EXP.name}", f"variant:{variant.name}"],
        metadata={"experiment": EXP.name, "variant": variant.name},
    )
    return variant.handler(query)
```

trace 上挂了 `variant` tag 之后，在 Langfuse 里按 tag 分组就能算每个变体的 cost、latency、user feedback rate。统计显著性检验留给数仓侧（按用户分组、按转化二元变量做 chi-square 或 z-test）。

**关于 canary 比例：** 新 prompt 上线第一天 1–5%，确认没冒烟（成本、延迟、错误率没爆）后扩到 10–20%，再观察 3–7 天的核心指标，没退化才扩到 50/50。LLM 应用的回归往往是延迟性的——某些边角输入要在 100 万 QPS 下才能撞到，所以扩量节奏要比传统后端慢。

**关于一致性哈希用 MD5 够不够：** 上面的代码用 `hashlib.md5` 做分流，对 A/B 场景**完全够用**。理由：

- 这里 MD5 不是密码学用途，没有抗碰撞要求，只要"哈希分布均匀 + 同一 key 永远落同一桶"就行，MD5 在这两个性质上都达标。
- 性能上 MD5 比 SHA-256 快约 2–3×，比 xxhash / mmh3 慢，但 LLM 调用本身远比哈希贵几个数量级（几十毫秒 vs 几微秒），分流哈希永远不是瓶颈。
- 真正的考虑是**避免桶分布不均**：把 `experiment_name` 拼到 user_id 前面是必要的，否则两个实验会用同一组用户，相关性污染结果。当前代码里 `f"{exp.name}:{user_id}"` 这种 salt 写法是对的。

如果硬要换：xxhash 性能好（库要装 `xxhash`），mmh3 是 Cassandra / Redis 等系统的默认选择，FNV 简单但分布略偏。这些都行，没必要为此改代码。**唯一别用的是 Python 内置 `hash()`** ——Python 3 的 `hash()` 对字符串带 PYTHONHASHSEED 随机化，进程重启后同一 user_id 落到不同桶，分流就废了。

**样本量怎么算（不要拍脑袋）。** 上面只给了"thumbs up rate 类指标 1% 提升至少 5–10 万"的粗略经验，下面给可操作的公式。对二元转化率指标（点击、thumbs up、复制率），双侧检验、α=0.05、power=0.8 时：

$$n_{\text{per group}} = \frac{(z_{\alpha/2} + z_{\beta})^2 \cdot [p_1(1-p_1) + p_2(1-p_2)]}{(p_1 - p_2)^2}$$

其中 $z_{\alpha/2} \approx 1.96$，$z_{\beta} \approx 0.84$，$p_1$ 是基线转化率，$p_2 = p_1 + \Delta$ 是目标转化率。代码：

```python
from statsmodels.stats.power import NormalIndPower
from statsmodels.stats.proportion import proportion_effectsize

def sample_size_for_proportion(p_baseline, lift_relative,
                                alpha=0.05, power=0.8):
    """计算每组所需样本量（双侧检验）。
    p_baseline: 基线转化率，例如 0.10
    lift_relative: 想检测的相对提升，例如 0.05 表示 5%（对应 p2 = 0.105）
    """
    p1 = p_baseline
    p2 = p_baseline * (1 + lift_relative)
    effect_size = proportion_effectsize(p1, p2)
    n = NormalIndPower().solve_power(
        effect_size=abs(effect_size),
        alpha=alpha, power=power, alternative="two-sided",
    )
    return int(n) + 1

# 例：基线 thumbs up rate = 70%, 想检测 1% 相对提升
print(sample_size_for_proportion(0.70, 0.01))   # 单组约 30 万
# 基线 task completion = 40%, 想检测 5% 相对提升
print(sample_size_for_proportion(0.40, 0.05))   # 单组约 7700
```

对连续指标（cost / request、latency、复合 quality score），用 t-test 公式：

$$n_{\text{per group}} = \frac{2 \cdot (z_{\alpha/2} + z_{\beta})^2 \cdot \sigma^2}{\Delta^2}$$

其中 $\sigma$ 是指标标准差（用历史数据估），$\Delta$ 是想检测的最小绝对差。LLM 指标方差通常很大（quality score 标准差 0.15–0.25 是常态），换算下来连续指标的样本量要求也并不低。

**对 LLM 应用的几条调整：**

1. **先估方差再算样本量**。从历史 trace 拉 7 天数据算指标的 std，不要套公式默认值。LLM 指标的方差比传统点击率类指标大 2–3 倍。
2. **多重比较校正**。如果同一实验同时看 5 个指标，单指标 α 要从 0.05 降到 0.01（Bonferroni）或用 BH。要么提前定主指标。
3. **MDE（Minimum Detectable Effect）思维**。不是"我能跑多少天"，而是"以现有流量我能在 14 天内可靠检测到多少 lift"。MDE > 业务关心的 lift 时实验设计就是失败的，要么换更敏感的指标，要么加流量，要么放弃。
4. **避免 peeking**。LLM A/B 实验最常见的破坏统计的方式：每天打开 dashboard 看一眼，p < 0.05 就停。这会把假阳性率从 5% 推到 30%+。要么预先定好样本量到了再看，要么用 sequential testing（mSPRT、Always Valid Inference）。
5. **置信区间比 p 值更有用**。报告 "treatment lift 1.2%, 95% CI [0.3%, 2.1%]" 比 "p=0.018" 信息量大得多。下界包含 0 时要特别警惕——名义显著但效应可能很小。

**A/A 测试的样本量陷阱：** A/A 期望两组无差异，但用上面公式算出的 n 只保证你能"检测到 X% 差异"，A/A 跑出 p < 0.05 是 5% 概率的正常事件，不一定是埋点错。建议 A/A 跑两次，两次都显著才下结论"分流有问题"。

---

## 24.7 持续改进闭环

观测和评估只是工具，真正的目标是让系统每天比前一天更好。这一节讲怎么把零散的工具拼成一个闭环。

### 24.7.1 失败案例 → 数据集

每个进生产的 LLM 应用都需要一条"失败采集 → 数据集"的自动化管道。触发源：

- 用户 thumbs down
- LLM-as-judge 在线评估给出低分
- 程序解析失败（JSON / function call schema 不合法）
- 用户在 60 秒内重试或改写
- 上游 API 返回错误
- Guardrail / 安全过滤命中

任何一个触发都把对应 trace_id 和原文（脱敏后）丢进一个 candidates 队列。值班工程师每天扫一次，标注成 confirmed failure，分类（retrieval miss、prompt error、模型 hallucination、安全失败、用户表达不清），加到对应数据集。

```python
# 失败采集 hook
@observe(name="post-process")
def post_process(trace_id, raw_output: str):
    try:
        parsed = json.loads(raw_output)
    except json.JSONDecodeError as e:
        # 失败入库
        save_failure(
            trace_id=trace_id,
            failure_type="json_parse_error",
            raw_output=raw_output,
            error=str(e),
        )
        raise
    return parsed

def save_failure(trace_id, failure_type, **fields):
    # 把失败丢进队列等待标注
    db.failures.insert({
        "trace_id": trace_id,
        "type": failure_type,
        "ts": time.time(),
        "status": "pending_review",
        **fields,
    })
```

### 24.7.2 Active Learning：哪些样本最值得标

数据集会膨胀。一万条样本里，多数信息冗余——它们彼此相似，标注一条等于标注一片。Active learning 的目标是优先标"最能消除模型不确定性"的样本。

LLM 场景下常用三种策略：

**Disagreement sampling**：用 N 个不同的 judge / 模型跑同一批输出，挑分歧最大的样本。分歧大说明这是边界 case。

**Uncertainty sampling**：让 judge 输出置信度，挑置信度最低的。

**Cluster-then-sample**：把样本 embedding，K-means 聚类，每类取代表。保证覆盖度。

```python
# disagreement sampling 简化版
import numpy as np
from sklearn.cluster import KMeans

def select_for_labeling(candidates, judges, k=100):
    """
    candidates: list of (trace_id, output)
    judges: list of judge functions: output -> score in [0,1]
    返回: 最值得标注的 k 条 trace_id
    """
    scores = np.array([
        [j(o) for j in judges] for _, o in candidates
    ])  # shape (n, n_judges)
    # 每条样本在多个 judge 之间的方差
    disagreement = scores.var(axis=1)
    top_idx = np.argsort(-disagreement)[:k]
    return [candidates[i][0] for i in top_idx]
```

### 24.7.3 Evaluator-Driven Development

把整个工作流颠倒过来：先写评估器，再写应用。

具体做法：

1. PRD 阶段产出"接受标准"：用户需求 X 时，系统应该满足条件 A、B、C。
2. 把每个条件落成一个 evaluator：可以是规则（regex / schema）、是 LLM rubric、是检索召回率。
3. 把 PRD 里的边角 case 写成 dataset。
4. **此时 evaluator 应该全部失败**——因为应用还没写。
5. 写应用的过程就是让 evaluator 一项一项 pass。

这套范式接近 TDD 的精神，但因为 evaluator 不是 0/1 而是分数，更像 BDD + 可量化验收标准。Hamel Husain 的 evals 工作流、Arize 的 EDD 文档、Anthropic 的内部实践都汇聚到这个方向。

实操上一个常见误区：以为 evaluator 越多越好。错。evaluator 太多会把"系统好不好"的问题稀释掉，谁都没法回答了。控制在 5–10 个核心 evaluator，每个都有明确的业务对应物，定期 review 删掉冗余的。

### 24.7.4 一个真实的改进闭环案例

一个客服 RAG 系统上线两个月后遇到瓶颈：用户满意度卡在 72%，怎么调 prompt 都上不去。团队按以下顺序排查：

1. 把过去两个月的 thumbs down 样本（约 1500 条）拉出来，按 LLM 聚类（embedding + HDBSCAN）分成 23 组。
2. 人工抽样每组 5 条，发现失败模式集中在三类：
   - **A 类（约 40%）**：用户问"我的订单"，但没说订单号，系统直接编了一个。这是 prompt 没要求"信息不足时反问"。
   - **B 类（约 30%）**：用户问退款规则，retrieval 召回的是发货规则文档。这是 retrieval 的问题。
   - **C 类（约 30%）**：用户用方言或错别字，模型理解错了。
3. 三类分别处理：
   - A 类：改 system prompt，加一条"如果用户没提供订单号、商品 ID 等关键信息，必须先反问"。在 dataset 里加 30 条新 case 用作回归。
   - B 类：retrieval 改用混合检索（BM25 + dense），加 metadata 过滤（按文档分类），rerank 换更强的 cross-encoder。在 dataset 里加 retrieval-only 评估集。
   - C 类：在系统 prompt 前增加一步意图归一化（用便宜模型把口语化输入翻译成标准查询）。
4. 改完跑回归，A、B 类分数明显上升，C 类提升有限。
5. 上线 canary 5%，A/B 跑两周，satisfaction 从 72% 提升到 81%。

这个案例说明几件事：失败不要笼统看，必须聚类分类；针对不同类别的根因分别施策；改进永远配套数据集扩增和回归测试，否则下次同类问题会再次出现。

### 24.7.5 闭环节奏

一个成熟的 LLM 应用团队的节奏大致是：

- **每天**：值班工程师扫前一天的失败案例，分类入库。检查告警通道。
- **每周**：跑完整 evaluation suite，对比上周指标趋势。决定是否触发改进。
- **每两周**：根据 evaluator 退化情况、用户反馈聚类、cost 趋势，决定下一轮 prompt / RAG / 微调改动。
- **每月**：重新审视核心 evaluator 是否还和业务对齐；裁剪过时数据集；重训 / 升级 LLM-as-judge。
- **每季**：考虑是否升级底层模型；做一次 red team；review 合规审计。

---

## 24.8 告警与 SRE

LLM 应用的告警层级和传统服务不完全一样。除了"挂了 / 没挂"这种基础健康检查，还要监控质量层信号。最低限度需要的告警条目：

| 类别 | 信号 | 阈值（参考） | 触发动作 |
|------|------|--------------|----------|
| 可用性 | 错误率（5xx / SDK exception） | > 1% 持续 5 min | 立刻 page |
| 上游 | OpenAI / Anthropic API 错误率 | > 5% 持续 5 min | 切到备用 provider |
| 上游 | rate limit 命中率 | > 10% | 扩配额 / 降级 |
| 延迟 | TTFT P95 偏移 | > 基线 2× 持续 10 min | 分级 page |
| 延迟 | 总延迟 P99 | > 业务 SLA | 调查 + 降级 |
| 成本 | cost / hour | 历史 P99 的 1.5× | 调查（往往是 prompt 膨胀或刷量） |
| 成本 | cost / user / day | 单用户 > $X | 限流 + 调查 |
| 质量 | thumbs down rate | 偏移 > 20% | 排查最近 prompt / 模型变更 |
| 质量 | LLM-as-judge 在线评分 | 偏移 > 10% | 排查 |
| 安全 | guardrail 命中率突增 | > 历史 P99 | red team 调查 |
| 安全 | jailbreak 检测命中 | > 0（任何命中） | 立刻 page，关闭可疑账号 |

**关于告警去噪：** LLM 服务的告警噪声特别大，因为非确定性带来很多伪信号。两条经验：

1. 所有质量类告警必须基于 baseline 偏移而不是绝对阈值。"thumbs down rate > 5%" 是糟糕的告警，"thumbs down rate 比上周同时段高 30%" 是合理的。
2. 关联多条信号再 page。单一信号触发只产生 ticket，多条同时偏移才上升到 page。否则值班同学三天就疲劳了。

**降级路径：** 必须设计好。常见降级链是：主模型（gpt-4o）→ 备用模型（claude-sonnet）→ 简化 prompt（不带 context）→ 静态 fallback（"系统繁忙，请稍后再试"）。每一档都要在 staging 演练过，确保切换是秒级。

**一份最小 runbook（值班同学的操作手册）：**

```
告警: cost-spike
触发: cost / 5min > 历史 P99 × 1.5

排查步骤:
1. 打开 Langfuse "cost by feature" 面板，看哪个 feature 异常。
2. 同步看 trace 列表按 cost 倒排前 100 条，确认是单次大调用还是批量。
3. 如果是单次大调用 → 检查 prompt token 数，看是否上下文膨胀。
4. 如果是批量 → 检查 user_id 分布，是不是单一用户刷量。
5. 决策:
   - prompt 膨胀: 通知 owning team 立即修复，回滚最近一次 prompt 变更。
   - 单用户刷量: 启用 user-level rate limit。
   - 真实流量增长: 通知 capacity team，确认预算。

升级条件:
- 5 分钟内未确认根因 → page on-call lead
- cost 累计达到日预算 50% → page CTO
```

每个核心告警都要有这种结构化 runbook。值班同学半夜起来不应该思考，只应该跟着操作。

---

## 24.9 合规与审计

合规是 LLM 应用从 demo 到生产的最后一关。监管侧（GDPR、HIPAA、PCI、AI Act）和企业内部审计（SOC 2、ISO 27001）都要求 LLM 调用可追溯。

最低要求：

**所有 LLM 调用留痕。** trace 必须包含：调用时间、用户 ID（或匿名 hash）、模型版本、prompt 哈希、输入输出（按数据分类决定是否脱敏后存储）、token 用量、cost、IP / region。留存周期跟着行业要求，金融通常 7 年，医疗通常 6 年。

**可回溯。** 给定任何一个用户投诉的对话，能在分钟内拉出完整 trace 并复盘。这要求 trace 存储是可索引的，且 trace_id 在产品 UI、客服系统、数据库都有埋点。

**数据分类。** 输入输出按敏感度分级：公开 / 内部 / 机密 / PII / PHI。不同级别对应不同存储位置（不同加密、不同访问权限）和不同留存策略。

**字段级脱敏。** 在数据进入 trace SDK 之前过一遍 redaction：手机、身份证、信用卡、邮件、地址、姓名（NER）。开源工具：Microsoft Presidio。

**访问审计。** 谁在什么时候看了哪个 trace 必须留痕。Langfuse / Phoenix / LangSmith 自托管版本都支持 SSO + RBAC + audit log，云版本要看合同。

**模型版本绑定。** trace 必须记录 `gen_ai.response.model` 而不只是 `gen_ai.request.model`，因为二者可能不一样（alias、provider auto-update）。这是出问题时归责的关键。

**模型卡 / DPIA。** 高风险场景（招聘、信贷、医疗诊断辅助）需要做模型影响评估，包括 bias 测试、解释性、人在回路设计。监管侧的趋势是越来越严，AI Act 在 2026 年开始严格执行。

合规不是事后补的。它是从 trace 数据模型设计的第一天就必须考虑的约束——一旦上线再追加脱敏，要回填的历史数据通常是 PB 级，工程量极大。

**Presidio 脱敏的最小例子：**

```python
# pip install presidio-analyzer presidio-anonymizer
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine

analyzer = AnalyzerEngine()
anonymizer = AnonymizerEngine()

def redact(text: str, language: str = "en") -> str:
    """脱敏 PII，返回替换后的文本。"""
    results = analyzer.analyze(
        text=text,
        entities=["PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER",
                  "CREDIT_CARD", "US_SSN", "IP_ADDRESS"],
        language=language,
    )
    return anonymizer.anonymize(text=text, analyzer_results=results).text

# 在 trace SDK 接入前过一遍
def safe_observe(name):
    def deco(fn):
        @observe(name=name)
        def wrapper(*args, **kwargs):
            result = fn(*args, **kwargs)
            # 输出脱敏后再写 trace
            redacted = redact(result) if isinstance(result, str) else result
            langfuse.update_current_observation(output=redacted)
            return result  # 返回给业务的仍是原始值
        return wrapper
    return deco
```

中文 PII 检测 Presidio 默认能力有限，可以接 spaCy 中文模型 + 自定义识别器（手机号、身份证、银行卡的正则）。或者用专门的中文方案（HanLP、阿里云 PAI 的脱敏组件）。

**留痕字段最小集：**

```sql
CREATE TABLE llm_audit_log (
    trace_id UUID PRIMARY KEY,
    ts TIMESTAMP NOT NULL,
    user_id_hash TEXT NOT NULL,           -- 不存原 user_id
    feature TEXT NOT NULL,
    request_model TEXT NOT NULL,
    response_model TEXT NOT NULL,         -- 实际响应的模型
    prompt_template_version TEXT,
    prompt_hash TEXT NOT NULL,            -- 不存原 prompt
    input_redacted TEXT,                  -- 脱敏后输入（可选）
    output_redacted TEXT,                 -- 脱敏后输出（可选）
    input_tokens INT,
    output_tokens INT,
    cost_usd DECIMAL(10, 6),
    latency_ms INT,
    region TEXT,
    error_code TEXT,
    PRIMARY KEY (trace_id),
    INDEX idx_user_ts (user_id_hash, ts),
    INDEX idx_feature_ts (feature, ts)
);
```

按合规留存周期分区（按月或按季），过期分区自动归档冷存储。

---

## 24.10 一个完整最小栈：把上面所有东西连起来

本节示意一个真实可跑的最小生产栈，作为这一章的收束。

**架构：**

```
   用户
    ↓
  应用服务（FastAPI）─── @observe ───→  Langfuse self-host
    ↓                                      ↑
  Helicone Gateway                         │ trace
    ↓                                      │
  OpenAI / Anthropic / Bedrock              │
                                            │
   离线 evaluation（GitHub Actions / Airflow）
       ↓
       ├─ ragas（RAG 指标）
       ├─ DeepEval（pytest 回归）
       └─ promptfoo（prompt 矩阵）
                                            │
   在线 LLM-as-judge（Worker 异步）   ──────┘
       ↓
   失败采集 → 标注队列 → dataset → 下一轮 eval
```

**docker-compose（Langfuse v3 + 依赖）：** 注意 v3 起后端是 web + worker 双容器，不能只起 web。完整官方版包含 healthcheck 和细粒度环境变量（参考 langfuse 仓库根目录的 docker-compose.yml），下面是删减后只保留主干的最小可读版本。

```yaml
# docker-compose.yml （示意，最小化；生产请直接基于官方版改）
services:
  postgres:
    image: postgres:17
    environment:
      POSTGRES_PASSWORD: changeme
      POSTGRES_DB: langfuse
    volumes:
      - pg_data:/var/lib/postgresql/data

  clickhouse:
    image: clickhouse/clickhouse-server:25.3
    environment:
      CLICKHOUSE_USER: default
      CLICKHOUSE_PASSWORD: changeme
    volumes:
      - ch_data:/var/lib/clickhouse

  redis:
    image: redis:7

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minio
      MINIO_ROOT_PASSWORD: changeme123
    volumes:
      - minio_data:/data

  langfuse-web:
    image: langfuse/langfuse:3
    depends_on: [postgres, clickhouse, redis, minio]
    ports: ["3000:3000"]
    environment: &langfuse_env
      DATABASE_URL: postgresql://postgres:changeme@postgres:5432/langfuse
      CLICKHOUSE_URL: http://clickhouse:8123
      CLICKHOUSE_USER: default
      CLICKHOUSE_PASSWORD: changeme
      CLICKHOUSE_MIGRATION_URL: clickhouse://clickhouse:9000
      REDIS_CONNECTION_STRING: redis://redis:6379
      LANGFUSE_S3_EVENT_UPLOAD_BUCKET: langfuse
      LANGFUSE_S3_EVENT_UPLOAD_REGION: auto
      LANGFUSE_S3_EVENT_UPLOAD_ENDPOINT: http://minio:9000
      LANGFUSE_S3_EVENT_UPLOAD_ACCESS_KEY_ID: minio
      LANGFUSE_S3_EVENT_UPLOAD_SECRET_ACCESS_KEY: changeme123
      LANGFUSE_S3_EVENT_UPLOAD_FORCE_PATH_STYLE: "true"
      NEXTAUTH_SECRET: changeme-please
      SALT: changeme-too
      ENCRYPTION_KEY: 0000000000000000000000000000000000000000000000000000000000000000
      NEXTAUTH_URL: http://localhost:3000

  langfuse-worker:
    image: langfuse/langfuse-worker:3
    depends_on: [postgres, clickhouse, redis, minio]
    ports: ["3030:3030"]
    environment: *langfuse_env

volumes:
  pg_data: {}
  ch_data: {}
  minio_data: {}
```

`docker compose up -d`，访问 `localhost:3000`，建项目，拿 public key / secret key 接入应用。`ENCRYPTION_KEY` 生产必须换成 64 位 hex 随机串（`openssl rand -hex 32`）。

**这份 compose 是最小可读版，生产前还要补这几样：**

- `restart: unless-stopped` 加到所有 service，避免容器单次崩溃就要人工重启。
- `healthcheck` 至少给 postgres、clickhouse、redis 加；`langfuse-web` 的 `depends_on` 改成 `condition: service_healthy`，否则首次启动可能因为 web 比依赖快而崩溃循环。
- ClickHouse 默认用户和密码这里都是 `default / changeme`，生产请改成强密码并通过 secret 注入；ClickHouse 用户密码不一致是 langfuse-web 启动失败最常见的根因，启动后看 worker 日志最快。
- MinIO 的 `MINIO_ROOT_USER / PASSWORD` 同上，且 `LANGFUSE_S3_*` 系列环境变量必须和 MinIO 凭据严格一致，包括 region 字段（用 `auto` 是 MinIO 的写法，AWS S3 要换成实际 region）。
- 备份策略：postgres 每日 dump，ClickHouse 每周快照（trace 数据增长最快的就是它），MinIO 看是否启用 versioning。
- 升级演练：langfuse v3 到 v4 已经有破坏性 SDK 变更，server 端镜像升级也会触发 ClickHouse migration（耗时随数据量从几分钟到数小时），生产升级必须先在 staging 走一遍。

依赖完整性自检清单：✅ PostgreSQL（应用主数据）✅ ClickHouse（trace / observation 时序数据）✅ Redis（job queue）✅ MinIO / S3（事件 blob 存储）✅ langfuse-web ✅ langfuse-worker。任何一项缺失都不能算 self-host 完整。

**应用侧（FastAPI + Langfuse + LLM-as-judge 异步）：**

```python
# app.py
import os, json, asyncio
from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
from langfuse import Langfuse, observe
from langfuse.openai import openai

os.environ["LANGFUSE_PUBLIC_KEY"] = "pk-lf-..."
os.environ["LANGFUSE_SECRET_KEY"] = "sk-lf-..."
os.environ["LANGFUSE_HOST"] = "http://localhost:3000"

app = FastAPI()
langfuse = Langfuse()
client = openai.OpenAI()

class Query(BaseModel):
    user_id: str
    question: str

JUDGE_PROMPT = """评估这个回答的质量（0-1 分）。
仅输出 JSON: {"score": float, "reason": "..."}。

问题: {q}
回答: {a}
"""

async def online_judge(trace_id: str, question: str, answer: str):
    """异步 LLM-as-judge，结果回写到 trace。"""
    resp = await asyncio.to_thread(
        client.chat.completions.create,
        model="gpt-4o-2024-08-06",
        messages=[{"role": "user", "content": JUDGE_PROMPT.format(q=question, a=answer)}],
        temperature=0,
        response_format={"type": "json_object"},
    )
    parsed = json.loads(resp.choices[0].message.content)
    langfuse.create_score(
        trace_id=trace_id,
        name="online_quality",
        value=parsed["score"],
        comment=parsed.get("reason"),
    )

@observe(name="rag-endpoint")
def handle(user_id: str, question: str) -> tuple[str, str]:
    langfuse.update_current_trace(user_id=user_id, tags=["api", "v1"])
    # ... retrieval、rerank（略）
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "用中文回答。"},
            {"role": "user", "content": question},
        ],
        temperature=0.2,
    )
    answer = resp.choices[0].message.content
    trace_id = langfuse.get_current_trace_id()
    return trace_id, answer

@app.post("/ask")
async def ask(q: Query, bg: BackgroundTasks):
    trace_id, answer = handle(q.user_id, q.question)
    # 异步打分，不阻塞用户响应
    bg.add_task(online_judge, trace_id, q.question, answer)
    return {"trace_id": trace_id, "answer": answer}

@app.post("/feedback")
def feedback(trace_id: str, value: int, comment: str | None = None):
    langfuse.create_score(
        trace_id=trace_id,
        name="user_feedback",
        value=value,
        comment=comment,
    )
    return {"ok": True}
```

**CI 回归（GitHub Actions + DeepEval pytest 风格）：**

```python
# tests/test_rag_regression.py
import pytest
from deepeval import assert_test
from deepeval.metrics import (
    AnswerRelevancyMetric,
    FaithfulnessMetric,
    HallucinationMetric,
)
from deepeval.test_case import LLMTestCase
from app import handle

# 从 langfuse / 本地 yaml 加载固定回归集
REGRESSION_SET = [
    {"q": "RAG 用什么向量索引？", "ctx": "...", "ref": "HNSW、IVF-PQ"},
    # ...
]

@pytest.mark.parametrize("case", REGRESSION_SET)
def test_rag(case):
    _, answer = handle("ci-bot", case["q"])
    tc = LLMTestCase(
        input=case["q"],
        actual_output=answer,
        retrieval_context=[case["ctx"]],
        expected_output=case["ref"],
    )
    assert_test(tc, [
        AnswerRelevancyMetric(threshold=0.7),
        FaithfulnessMetric(threshold=0.8),
        HallucinationMetric(threshold=0.3),  # 越低越好
    ])
```

```yaml
# .github/workflows/eval.yml
name: LLM Regression
on: [pull_request]
jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -r requirements.txt
      - run: pytest tests/test_rag_regression.py -v
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          LANGFUSE_PUBLIC_KEY: ${{ secrets.LANGFUSE_PUBLIC_KEY }}
          LANGFUSE_SECRET_KEY: ${{ secrets.LANGFUSE_SECRET_KEY }}
          LANGFUSE_HOST: ${{ secrets.LANGFUSE_HOST }}
```

PR 上跑回归集，evaluator 不达标直接 fail。这就是 Evaluator-Driven Development 的最小落地形态。

---

## 24.11 反模式：见过的就别再犯

把真实见过的几个典型坑列出来。每个都见过不止一次。

**只在出问题之后才接 trace。** 团队上线时觉得 trace 是后期再补的事，结果第一次大故障要复盘的时候，发现关键的两小时没有任何观测数据。教训：trace 接入是上线 checklist 的第一项，不是最后一项。

**评估集只跑一遍就拍板。** LLM-as-judge 有方差，单次跑出来 0.85 和 0.83 的差异可能是噪声而不是真实变化。教训：每次评估跑 3 次取均值和方差；变化在方差范围内不算结论。

**把"prompt 工程化"和"prompt 一锅炖"混着搞。** 看到一份代码里 prompt 散在 30 个地方，每个 if-else 分支拼一段，没有版本、没有 owner。教训：prompt 必须像 SQL 一样独立成文件 / 配置 / DSL，进 prompt registry，独立 review、独立版本、独立测试。

**把 token 数当成成本的全部。** 实际成本还包括失败请求重试、长尾延迟带来的资源占用、缓存 miss 的额外 embedding 计算。教训：成本指标要包含全链路，不只是 LLM 调用本身。

**评估指标越多越好。** 看到一份评估报告里有 30 个指标，每个都在 ±2% 波动，看不出哪个真重要。教训：核心指标控制在 5–8 个，每个都对应明确的业务/质量含义；其它做辅助分析用，不上 dashboard。

**用 thumbs down rate 直接做模型质量结论。** 用户点 thumbs down 的动机有"答错了"、"答得对但语气不喜欢"、"想要更详细"、"误点"等等。教训：负反馈必须配合人工分类才能定性；只看比率会让你决策错位。

**把告警阈值写死。** "thumbs down rate > 5%" 这种绝对阈值在新功能上线初期一定误告警。教训：所有质量类告警基于 baseline 偏移（按周或按月对比），不基于绝对值。

**离线评估和在线行为指标分离。** 离线评估 score 涨了，但用户反馈没变化，团队还沾沾自喜。这通常说明你的离线评估根本没对齐用户偏好。教训：每次离线评估的"金标准"应该是历史用户反馈，而不是工程师自己拍脑袋的 rubric。

---

## 24.12 这一章的几条总结

- **LLMOps ≠ MLOps。** 模型不在你手里、行为非确定、prompt 即代码、评估难、成本是一等公民。任何照搬 MLOps 的尝试都会撞墙。
- **观测是地基。** trace、IO、cost、latency、feedback 五个维度从一开始就建好。OpenTelemetry GenAI 是正在收敛的开放标准，按它埋点能避免供应商锁定。
- **平台不是宗教。** Langfuse / Phoenix / LangSmith / Helicone 各有适配场景。多数团队混搭：gateway + 观测 + 评估三件套，按需组合。
- **评估是工程问题。** 数据集要版本化、要持续生长；自动指标 + LLM-as-judge + 人工标注三层并存；ragas / DeepEval / promptfoo 各管一段。
- **LLM-as-judge 必须做偏见缓解。** 位置、长度、自我偏好、版本漂移，每个都有缓解手段，不做就是自欺欺人。
- **A/B 是终判。** 离线再漂亮也要在线验证。按用户分流，先 A/A 再 A/B，canary 节奏要慢。
- **闭环靠 failure → dataset → eval → fix。** 这条线不断，系统不会自己变好。Active learning 帮你把标注预算花在刀刃上。
- **告警按 baseline 偏移。** 绝对阈值在 LLM 场景下不工作，关联多信号才上升到 page。
- **合规从第一天考虑。** 留痕、脱敏、版本绑定、访问审计——这些都不是事后能补的。

**最后一句话：** LLMOps 不是"在 LLM 上套一层 MLOps"。它是一种新的工程纪律——你接受了一个非确定的、闭源的、按调用收费的核心组件作为系统中枢，然后用观测、评估、闭环把这种不确定性压回到产品可以承担的范围。这种纪律学起来比单纯的 prompt 工程或 RAG 优化都要慢，但一旦内化，你的 LLM 应用就有了真正可以长期运行的工程地基。

---

观测和评估解决的是"系统好不好"的问题。下一章我们处理另一类只有上线之后才会暴露的问题——**有人在主动让你的系统变坏**。Prompt 注入、越狱、Agent 越权、数据泄漏，每一项都不是 trace 大盘能直接告诉你的。第 25 章把这套对抗面摆开。

下一章我们会从持续改进的"改"那一侧深入：什么时候 prompt 已经调到头了，需要走微调或继续训练？怎么判断、怎么准备数据、怎么把微调结果接回这一章的评估闭环。
