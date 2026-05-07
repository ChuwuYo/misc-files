# 第 23 章 · MLOps 全流程

> 训练一个模型只是开始。把它每天稳稳地推到几千万用户面前、在数据漂了之后能按下回滚、在出事时讲清楚来龙去脉，这才是工程师的本职。
>
> 学术界发一篇 paper 的时间，工业界要走完"数据 → 实验 → 训练 → 注册 → 部署 → 监控 → 反馈 → 重训"七道工序。每一道都有专属工具、专属坑、专属事故。MLOps 就是把这七道工序串成一条可回放、可追溯、可回滚的流水线。
>
> 这一章把 2026 年的经典 MLOps 全景图铺一遍。下一章再讲它的 LLM 表亲——LLMOps。

---

## 23.1 MLOps 全景图：一条比写论文长十倍的链路

MLOps 不是单一工具，而是一整套生命周期治理。把它拆成阶段就是：

```
数据采集 → 数据版本 → 特征工程 → 实验 → 训练 → 评估 → 模型注册
                                                                ↓
反馈 ← 业务接入 ← 监控 ← 部署 ← CI/CD ← 模型测试 ←─────────────┘
   ↓
   重训
```

每个箭头背后都是一次状态变更，每次状态变更都需要被记录、被审计、被回放。这意味着 MLOps 系统的核心其实不是模型，是**元数据**：哪个数据集、哪段代码、哪台机器、哪个超参、训出哪个模型、哪个版本上了哪个环境、谁批准的、什么时候被回滚。

新人最容易犯的错是把 MLOps 当成 DevOps 加一点 ML。两者确实有交集，但有几条根本差别：

1. **DevOps 的部署单位是代码，MLOps 是代码 + 数据 + 模型权重**。任何一个变了都构成新版本。
2. **DevOps 测试是确定性的**，MLOps 测试是统计性的。同一段代码跑两次 loss 不一样很正常，单元测试在这里得改成"指标在置信区间内"。
3. **DevOps 的上线即终态**，MLOps 上线只是开始。模型会随数据漂移而劣化，不监控就等于裸奔。
4. **DevOps 出故障是日志告诉你的**，MLOps 出故障是用户先发现的。系统看似健康（200 OK、p99 50ms），但模型已经胡说八道。

这四条决定了后面所有工具选型都绕着同一个目标转：**让"代码 + 数据 + 模型 + 指标"四者随时可对齐，可回到任意历史时刻**。

### 23.1.1 MLOps 成熟度

Google 早年的 MLOps 白皮书把团队成熟度分成 0/1/2 级，今天再看仍然是清晰的自检尺：

- **L0 手工流程**：数据科学家在 Notebook 里训出一个模型，把 pickle 文件丢给后端工程师，后端写一段加载代码塞到服务里。每次更新都是这套流程重来一遍。问题：复现不了、监控不了、出事故只能问"上次那版谁训的"。
- **L1 流水线自动化**：训练流程被打包成可调度的流水线，可以一键重跑。模型自动注册到 Registry。问题：流水线本身的更新还是手工的——改特征工程要重新部署训练镜像，没有 CI/CD。
- **L2 CI/CD 自动化**：训练流水线的代码、数据 schema、模型本身都进入 CI/CD。代码合并自动触发训练；训练完自动评估；评估通过自动上线影子环境；指标稳定自动 promote。这是大厂级别的 MLOps。

绝大多数团队卡在 L0 到 L1 之间。直接奔 L2 不仅没必要，往往还会被 K8s + Kubeflow + Tekton 这套组合拳的运维成本拖垮。务实路径是：先把 L0 里"数据可重现"和"实验可比对"两件事做扎实，这两件做不好，再多自动化都只是自动化错误。

### 23.1.2 角色分工

MLOps 的另一面是组织。一个能跑通的中型 ML 团队大致有三类角色：

- **数据科学家 / ML 研究员**：负责实验、特征、模型选型，主要工作在 Notebook 和实验跟踪平台。
- **ML 工程师**：负责把研究员产出的模型工程化——流水线、服务、监控。这一职是 MLOps 的主战场。
- **平台工程师 / SRE**：负责底层基础设施——K8s、Feature Store、Model Registry、监控系统。在大公司这是独立的 ML Platform 团队。

小团队可能一个人兼三职，那也得在脑子里区分这三顶帽子。一个 ML 工程师如果一直戴着"研究员"的帽子，就只会优化离线指标；一直戴着"平台工程师"的帽子，就只会盖基础设施而不出业务价值。

---

## 23.2 数据版本：让数据集变成一等公民

代码用 Git 管，模型权重用 Model Registry 管，那数据呢？早年大家把数据丢在 S3 桶里，靠 `dataset_v3_final_FINAL_2.csv` 命名约定凑合。这种做法在两个场景下立刻崩盘：

- 模型上线后效果变差，想回到上次训练时的数据快照重训对照——找不到了。
- 监管来审"这个模型用谁的数据训的"——说不清。

数据版本控制（Data Version Control）就是解决这两件事。

### 23.2.1 DVC：Git 思维下的数据版本

DVC 把 Git 那一套（add、commit、push、checkout）原封不动地搬到了数据上。它本身不存数据，只存数据的指纹和元数据，真实数据放在 S3、GCS、Azure Blob、本地磁盘等"远端"。

```bash
# 初始化
dvc init
git add .dvc .dvcignore
git commit -m "init dvc"

# 配置远端（以 S3 为例）
dvc remote add -d storage s3://my-bucket/dvcstore

# 把数据集纳入 DVC 管理
dvc add data/raw/transactions.parquet
git add data/raw/transactions.parquet.dvc data/.gitignore
git commit -m "add transactions v1"

# 推到远端
dvc push

# 半年后想回到当时那一版
git checkout <旧 commit>
dvc checkout
```

每个 `.dvc` 文件里只有一段 YAML，记录文件 md5 和大小。这样一来，数据集和代码就能用同一个 `git checkout` 一起回到任意历史点位。

DVC 的强项是 ML 工作流原生：它有 `dvc.yaml` 描述流水线（每个阶段输入、输出、命令），改一个上游文件，下游自动需要重跑，相当于数据版本之上还叠了一层"按需重算"的 Make 系统。

弱项是规模。当数据集过 TB、训练集要几十万人协作时，每次 `dvc pull` 都拉一份完整副本就吃不消了。这时候视野要抬高一层。

### 23.2.2 LakeFS：在数据湖上做 Git

LakeFS 思路反过来：不复制数据，直接在对象存储上做"分支语义"。它在 S3/GCS 之上封装一层，让你能像 Git 那样 `branch`、`commit`、`merge`，但底下的数据块零拷贝。

工作流大致是：

```python
import lakefs

repo = lakefs.repository("my-ml-repo")
main = repo.branch("main")

# 拉一个实验分支
exp = repo.branch("experiment-2026-05-08").create(source_reference="main")

# 在这个分支上跑预处理、生成新特征
# 数据写到 lakefs://my-ml-repo/experiment-2026-05-08/features/...
# 训练完模型，效果好

# 提交并合并回主分支
exp.commit(message="add v3 features, AUC +1.2pt")
exp.merge_into(main)
```

LakeFS 适合数据量大、协作多、要做严格 lineage 审计的团队。它和 DVC 不是替代关系——一个常见组合是 LakeFS 管底层湖、DVC 管研究目录里的小数据。2025 年 LakeFS 收购了 DVC 之后这两个项目逐步并轨，未来会作为一个生态的两个层级。

### 23.2.3 数据 Lineage：上下游谁依赖谁

光有版本还不够，还要知道**这一版的数据是怎么来的**：从哪个上游表 join 哪个表、过了哪些清洗步骤、被哪些模型消费过。

业内常见的 lineage 方案：

- **OpenLineage**：开源标准，让 Airflow / Spark / dbt 自动发出 lineage 事件，被 Marquez、DataHub、Atlan 等元数据平台采集。
- **Unity Catalog / Apache Atlas**：在数据平台层做统一 catalog，自动推断 lineage。
- **dbt 的 manifest**：dbt 模型间的依赖天然就是 lineage 的一种，配合 dbt-core 的 `dbt docs generate` 能直出 DAG。

实战经验：lineage 一定要"自动采集 + 强制规范"，别指望工程师手填。手填的 lineage 上线第二周就会过时。一种行之有效的策略是把 lineage 采集嵌入到流水线编排器里——Airflow、Prefect、Dagster 都有官方 OpenLineage 插件，写流水线时不需要额外动作，事件就会自动发出来。下游元数据平台收到事件后自动绘图，不依赖任何人手维护。

### 23.2.4 数据合同（Data Contract）

数据版本只解决"我能回到过去任意一刻"，不解决"上游随时改字段把我的训练数据搞坏"。后者要靠**数据合同**：上游团队和下游团队就 schema、字段含义、SLO（更新频率、空值率、值域范围）达成显式协议，并用代码强制执行。

工程上常见的实现方式：

- **Pydantic / Marshmallow / dataclass + Pandera** 描述 DataFrame schema，每次 ETL 入口验证。
- **dbt tests** 描述列级断言（unique、not_null、accepted_values、relationship）。
- **Great Expectations** 维护"期望"集合，每天对最新数据跑一遍，违反就报警。
- **Soda Core** 类似 Great Expectations 但 YAML 优先，更轻量。

数据合同的本质不是工具，是**把 schema 当成一等公民版本化**，和代码、模型一起进 Git。一个常被忽视的细节：合同破坏时，下游模型必须能"软失败"——继续用旧数据保命，而不是直接挂掉。生产模型挂掉的代价比短暂用旧数据严重得多。

---

## 23.3 实验管理：把每一次跑数都记下来

ML 工程师一天可能跑几十次实验，超参、特征、随机种子来回换。一个月后被问起"上次那个 AUC 0.91 的版本是怎么来的"，没有实验跟踪系统的人只能说"我再试试"，有的人能直接 `mlflow runs --filter 'metrics.auc>0.9'` 查出来。

### 23.3.1 MLflow：开源主流，自托管首选

MLflow 是目前最广泛部署的开源实验跟踪 + 模型注册工具。架构很简单：一个 tracking server（FastAPI + 后端数据库 + artifact store），一个 Python SDK，UI 直接 `mlflow ui` 起来。

最小可用例子：

```python
import mlflow
import mlflow.sklearn
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import roc_auc_score

mlflow.set_tracking_uri("http://mlflow.internal:5000")
mlflow.set_experiment("fraud-detection")

with mlflow.start_run(run_name="gbdt-v3") as run:
    # 1. 记录超参
    params = {"n_estimators": 300, "max_depth": 5, "learning_rate": 0.05}
    mlflow.log_params(params)

    # 2. 训练
    model = GradientBoostingClassifier(**params)
    model.fit(X_train, y_train)

    # 3. 记录指标
    auc = roc_auc_score(y_val, model.predict_proba(X_val)[:, 1])
    mlflow.log_metric("val_auc", auc)

    # 4. 记录 artifact（模型 + 任意文件）
    mlflow.sklearn.log_model(
        sk_model=model,
        name="model",
        registered_model_name="fraud_gbdt",
        input_example=X_val.iloc[:5],
    )
    mlflow.log_artifact("feature_importance.png")
```

跑完之后打开 UI，能看到这次 run 的全部参数、指标曲线、artifact、和它对应的 git commit hash（自动记录）。可以两两对比、可以按指标排序、可以查询。

MLflow 的几个核心组件：

- **Tracking**：刚才演示的那一套，记录 run。
- **Models**：用 `mlflow.<flavor>.log_model` 把模型打包成 MLmodel 格式，里面有签名（输入输出 schema）、依赖（conda env）、推理接口。任何 MLflow 部署目标都能直接吃。
- **Model Registry**：在 tracking 之上叠的一层注册中心。同一个 `registered_model_name` 下版本递增，可以打 alias（`@champion`、`@challenger`）、加 tag、设描述、做权限。
- **Projects**：把整个训练任务打包成一个可复现的项目（`MLproject` 文件 + conda 环境）。
- **Deployments**：把注册的模型一键发到 SageMaker、Azure ML、Kubernetes 等。

### 23.3.2 Weights & Biases：商业产品，UI 顶级

W&B 是商业 SaaS（也有自托管版本），定位"实验跟踪界的 Figma"。和 MLflow 比，W&B 的 UI 完成度高一个量级：自动捕获系统指标、GPU 利用率、梯度直方图、多 run 对比图、自动报告（Reports）功能可以把实验结论像 Notion 文档一样写出来分享。

API 非常轻：

```python
import wandb

wandb.init(project="fraud", name="gbdt-v3", config=params)
wandb.log({"val_auc": auc, "epoch": epoch})
wandb.save("model.pkl")
wandb.finish()
```

W&B 还做了几个特色功能：

- **Sweeps**：超参搜索托管。声明搜索空间和策略（grid / random / bayes），W&B 会自动起 agent 跑、收集结果、画并行坐标图。
- **Artifacts**：数据集和模型版本化，类似 DVC 但更紧贴实验跟踪。
- **Tables**：可以把推理结果以表格形式记录，方便 case study。

价格上 W&B 团队版每用户每月 50–200 美元，对中小团队不是小数目，但相比一个工程师摸黑调参一天的成本通常还是值的。

### 23.3.3 ClearML / Aim / Neptune：备胎清单

- **ClearML**：以色列团队，开源 + 商业并行。强项是把实验跟踪、流水线、远程 agent 三件事整合在一个产品里，不用拼装。学习曲线略陡。
- **Aim**：纯开源，UI 比 MLflow 现代，搜索体验类似 elasticsearch 风格。适合纯研究团队。
- **Neptune**：商业 SaaS，定位和 W&B 类似但更强调"轻量、不侵入"。在大规模 run（几十万次）下查询性能口碑不错。

### 23.3.4 选型经验

- **小团队 / 自托管 / 不想花钱**：MLflow。装 OSS 版本，配 Postgres + S3，能用很久。
- **预算充足 / 注重 UI / 团队协作**：W&B。
- **K8s 原生 / 流水线深度集成**：ClearML 或 Kubeflow（后面讲）。
- **大型企业 / 强治理**：MLflow + 自建权限层，或者直接上 Databricks / Sagemaker / Vertex AI 的托管版。

无论选哪个，**第一原则是只用一个**。同时跑两套实验跟踪等于两套都不可信。

### 23.3.5 让实验跟踪真正发挥价值的几条习惯

工具选好之后，决定回报的是使用习惯。下面这些是几个老团队反复踩过的坑：

- **强制 git commit hash 联动**：每次 run 自动记录代码 commit，未提交时拒绝跑实验。否则三个月后看到"AUC 0.913"的 run，你不知道它对应哪段代码。
- **超参一律走配置文件**，别在代码里写死。用 Hydra、OmegaConf 或者干脆 YAML 都行。MLflow 的 `log_params` 就喂这份配置。
- **跑前先写假设**：在 run 描述里写一句"我猜增大 max_depth 会提高召回但拖累延迟"，跑完和实际比对。这一条非常反直觉但极其有效，能让团队从"试错"升级到"有结构的探索"。
- **artifact 命名严格化**：模型文件、评估图、混淆矩阵、特征重要性各有固定文件名。便于跨 run 自动对比。
- **失败的 run 也保留**：删掉失败 run 等于丢掉负面证据。三个月后另一个工程师重蹈覆辙时，能查到"上次试这个超参组合时 OOM 了"。
- **定期清理 experiment 目录**：tracking server 是数据库，跑久了会膨胀。定期归档一年前的 run 到冷存储。

---

## 23.4 特征工程平台：离线训练和在线服务的"同一份特征"

特征工程平台（Feature Store）解决一个具体的工程痛点：**离线训练用的特征和在线推理用的特征对不上**。

这不是抽象问题。一个真实的事故：风控团队训练时用了"过去 7 天交易次数"这个特征，离线计算窗口用日历日，0 点切；上线后服务端按事件时间滚动 7 天，结果同一个用户在同一时刻，离线值是 12，在线值是 14。模型对这个差异极敏感，AUC 直降两个点，故事讲了三天才定位。

Feature Store 用三层抽象解决这件事：

1. **离线存储**：历史特征数据，用于训练和回溯。一般是数仓（BigQuery、Snowflake、Redshift）或对象存储（Parquet on S3 + Iceberg/Delta）。
2. **在线存储**：低延迟的 KV 系统，用于推理时取特征。Redis、DynamoDB、Cassandra、Bigtable 都行。
3. **特征注册中心**：声明性地定义"什么是一个特征"——它的实体、来源、刷新频率、TTL。离线和在线根据同一份定义算同一份特征。

### 23.4.1 Feast：开源 Feature Store

Feast 是开源 Feature Store 的事实标准。它本身不存数据，是一层"特征定义 + 物化（materialize） + 在线检索"的薄壳，下面接你已有的离线/在线存储。

定义特征：

```python
from feast import Entity, FeatureView, Field, FileSource
from feast.types import Float32, Int64
from datetime import timedelta

driver = Entity(name="driver", join_keys=["driver_id"])

driver_stats_source = FileSource(
    path="s3://feast-demo/driver_stats.parquet",
    timestamp_field="event_timestamp",
)

driver_stats_fv = FeatureView(
    name="driver_stats",
    entities=[driver],
    ttl=timedelta(days=7),
    schema=[
        Field(name="conv_rate", dtype=Float32),
        Field(name="acc_rate", dtype=Float32),
        Field(name="trip_count_7d", dtype=Int64),
    ],
    source=driver_stats_source,
)
```

把定义注册到 registry：

```bash
feast apply
```

物化（把离线数据搬到在线存储）：

```python
from datetime import datetime, timedelta
from feast import FeatureStore

fs = FeatureStore(repo_path=".")
fs.materialize(
    start_date=datetime.utcnow() - timedelta(days=7),
    end_date=datetime.utcnow(),
)
```

训练时取历史特征（point-in-time correct）：

```python
training_df = fs.get_historical_features(
    entity_df=labels_df,  # 必须有 driver_id 和 event_timestamp 列
    features=[
        "driver_stats:conv_rate",
        "driver_stats:trip_count_7d",
    ],
).to_df()
```

Feast 关键的承诺是 **point-in-time correctness**：训练时取的特征值，是当时那个时刻该 entity 真实可见的值，不会用未来数据"穿越"。这是离线在线一致性的基础。

推理时取在线特征：

```python
features = fs.get_online_features(
    features=[
        "driver_stats:conv_rate",
        "driver_stats:trip_count_7d",
    ],
    entity_rows=[{"driver_id": 1001}, {"driver_id": 1002}],
).to_dict()
```

### 23.4.2 Tecton / Hopsworks：商业增强版

Feast 的弱项是流式特征和复杂转换。它假设上游已经把特征算好放在数据源里，自己只做注册和分发。但很多现实特征要现算（比如"过去 5 分钟会话内点击次数"），这就需要更强的特征计算引擎。

- **Tecton**：商业平台，背后是 Spark + Flink，能直接定义批/流/实时特征转换，自动编译成对应引擎的作业。Feast 早期就是 Tecton 公司开源出来的子集。
- **Hopsworks**：开源 + 商业混合。强项是和 Feast、TensorFlow、PyTorch 深度集成，自带数据科学环境和模型注册。北欧开源界出品。

### 23.4.3 落地节奏

不是所有团队都需要 Feature Store。一个判断标准：**如果离线训练和在线推理是同一段代码（或者很容易共用），就先不上**。Feature Store 解决的是"两边代码必然分叉"的场景：训练用 Spark/Pandas、推理用 Java/Go 微服务。两边语言、引擎、数据源都不一样时，Feature Store 才有 ROI。

### 23.4.4 落地时最容易踩的坑

- **忽视 point-in-time correctness**：很多团队第一版 Feature Store 直接拿"当前最新值"做训练样本，等于让模型偷看了未来。线上一上线效果立刻崩。
- **离线在线存储方案绑死单一供应商**：早期为了省事把离线和在线都建在 BigQuery 上，后期想换 Redis 做在线低延迟，发现迁移成本巨大。从一开始就把"离线 store"和"在线 store"当成两个独立的可插拔后端规划。
- **特征版本化没做**：特征和模型一样会迭代——`trip_count_7d_v2` 修了一个 bug，老模型还在用 v1。不在 Feature Store 层面做版本就只能在命名上 hack。
- **on-demand 特征计算性能没压测**：业务期望 p99 < 10ms，结果做了一个聚合查询从 Redis 拉 50 个 key 再算一下要 40ms。Feature Store 的设计阶段就要把延迟预算算进去。
- **特征下线没流程**：上特征容易，下特征难。一个废弃的特征视图可能还有几个老模型在依赖，删它就把生产搞崩了。Feature Store 必须支持"标记为弃用 → 观察 30 天没人调用 → 删除"的三段式生命周期。

---

## 23.5 模型注册：版本、阶段、审批

实验跟踪解决"我训了什么"，模型注册解决"什么模型可以上生产"。两者常常在同一个产品里（MLflow Model Registry 就是这样），但概念要分清。

### 23.5.1 注册中心的核心概念

- **Registered Model**：一个模型的"产品名"，比如 `fraud_gbdt`。
- **Model Version**：每次注册递增的整数版本号。
- **Stage / Alias**：版本所处的环境标签。早期 MLflow 用 `Staging / Production / Archived` 这种固定枚举，后来（2.9 起）换成更灵活的 alias 机制——可以打 `@champion`、`@challenger`、`@shadow` 任意标签。
- **Tag**：键值对元数据，常用来记录评估指标、负责人、审批状态。
- **Description**：自由文本，常用来挂 model card 或者训练 run 链接。

### 23.5.2 一次完整的注册 + 提升流程

```python
from mlflow import MlflowClient
import mlflow

client = MlflowClient()

# 1. 训练 + 注册
with mlflow.start_run() as run:
    # ... 训练 ...
    mlflow.sklearn.log_model(
        sk_model=model,
        name="model",
        registered_model_name="fraud_gbdt",
    )

# 2. 拿到刚注册的版本号
versions = client.search_model_versions("name='fraud_gbdt'")
latest = max(versions, key=lambda v: int(v.version))

# 3. 在该版本上挂离线评估结果作为 tag
client.set_model_version_tag(
    name="fraud_gbdt",
    version=latest.version,
    key="val_auc",
    value="0.913",
)

# 4. 走审批流：先打 challenger 标签，进入影子环境
client.set_registered_model_alias(
    name="fraud_gbdt",
    alias="challenger",
    version=latest.version,
)

# 5. 影子跑一周后业务批准，提升为 champion（生产）
client.set_registered_model_alias(
    name="fraud_gbdt",
    alias="champion",
    version=latest.version,
)
```

服务端永远用 alias 加载模型，永不写死版本号：

```python
model = mlflow.pyfunc.load_model("models:/fraud_gbdt@champion")
```

这种设计的好处是回滚成本几乎为零——发现新版本有问题，把 `@champion` alias 重新指回上一个版本即可，业务侧零感知。

### 23.5.3 审批流和治理

监管严格的行业（金融、医疗）会要求每次模型升级走人工审批。常见做法：

1. **CI 自动门**：注册时自动跑离线评估，指标低于阈值直接拒绝注册。
2. **影子流量门**：新版本必须先以 `@shadow` alias 接收线上流量但不返回给用户，比对一周指标。
3. **人工审批门**：通过 GitHub PR 或者专门的工单系统记录审批人、审批时间、审批理由。
4. **金丝雀门**：审批通过后先放 1% 流量，再 5%，再 50%，最后 100%。每一级都有自动监控和自动回滚阈值。

不要把这些门做成可绕过的——所有"我就上一次紧急修复"的口子，最终都会变成下一次事故的入口。一个反复出现的恶性循环：业务出事 → 工程师手动绕过审批热修 → 大家发现"原来可以绕过" → 下次有人非紧急也绕过 → 没人再走正规流程 → 监管突击审计发现合规漏洞 → 全员加班整改。

### 23.5.4 Champion / Challenger 双模型机制

很多团队上 alias 体系后还会再叠一层"双模型常驻"机制：

- **Champion**：当前生产模型，承接 100% 真实流量。
- **Challenger**：候选新模型，常驻在生产环境但只接收影子流量。
- 每天定时对比 champion 和 challenger 的预测分布、关键指标。
- 当 challenger 在足够长的时间窗口（通常 7-14 天）内稳定优于 champion，自动 promote。

这种机制的关键不是"自动",而是"常驻"——challenger 要一直在那里跑，不是临时起的。这意味着推理资源要按 2 倍预算，但换来的是新模型上线时几乎零风险。对核心业务模型这笔账绝对划算。

实操中要小心两个陷阱：一是 challenger 可能因为长时间不被 promote 而被遗忘，需要"超过 30 天未 promote 自动告警"机制；二是 champion 和 challenger 的指标对比要看绝对值不能只看相对——challenger 把绝对指标搞低了 1%，但相对 champion 涨了 0.5%，这种情况是 champion 自己掉了，应该回滚而不是 promote。

### 23.5.5 Model Card 与可追溯性

模型注册不只是"一个 pickle 文件加版本号"。一个负责任的模型版本要附带一份 **Model Card**——Google 提出的标准化文档，描述模型的用途、训练数据、评估结果、限制和潜在风险。

Model Card 至少要包含：

- **模型基础信息**：版本号、负责人、训练完成时间、对应的训练 run ID、对应的代码 commit、对应的数据快照 ID。
- **业务用途**：这个模型解决什么业务问题，预期用户是谁，不预期的滥用场景是什么。
- **训练数据**：数据来源、时间范围、样本量、关键字段说明、已知的数据偏差。
- **评估结果**：在哪些数据集上、用哪些指标、不同人群上的表现差异。
- **限制和注意事项**：在哪些场景下不能用、已知的失败模式、需要人工兜底的边界。
- **维护信息**：联系人、SLA、上一次重训时间、下一次预计重训时间。

实操中可以把 Model Card 做成 markdown 文件随模型一起注册到 Registry，或者干脆用 MLflow 的 description 字段填进去。监管行业（金融风控、医疗诊断、招聘筛选、信贷决策）这一项是硬要求，没有 Model Card 的模型不允许上线。

---

## 23.6 训练流水线：从 Notebook 到生产作业

实验阶段 Notebook 是最高效的研发环境。但 Notebook 有三个致命问题：依赖隐式、执行顺序不可靠、错误恢复不存在。把模型推到生产前必须把它转成"流水线"——一个有向无环图（DAG），每一步声明输入输出，可重试，可调度。

工业界主流的流水线编排器（orchestrator）有四个流派：

### 23.6.1 Airflow：通用数据编排，ML 是其中一个用户

Airflow 是数据工程的传统主力。它的 DAG 模型成熟、生态丰富、调度器（scheduler）稳定。

```python
from airflow.decorators import dag, task
from datetime import datetime

@dag(schedule="@daily", start_date=datetime(2026, 1, 1), catchup=False)
def fraud_training_pipeline():
    @task
    def extract():
        # 拉取过去 7 天数据
        return "s3://.../raw_2026-05-08.parquet"

    @task
    def preprocess(raw_path: str):
        # 清洗、特征
        return "s3://.../features_2026-05-08.parquet"

    @task
    def train(features_path: str):
        # 调 MLflow，记录 run，返回 model_uri
        return "models:/fraud_gbdt/42"

    @task
    def evaluate(model_uri: str):
        # 离线评估，写到模型注册的 tag
        ...

    raw = extract()
    feat = preprocess(raw)
    model = train(feat)
    evaluate(model)

fraud_training_pipeline()
```

Airflow 的弱项在 ML：每个任务默认是 Python 函数或 Bash，跑在 worker 上，没有原生的资源隔离（GPU 调度、依赖隔离都需要靠 KubernetesPodOperator 或 DockerOperator 自己拼）。

### 23.6.2 Prefect：现代化 Airflow，Pythonic 优先

Prefect 是 Airflow 的现代继任者之一，2.x 之后彻底重写。设计哲学是"代码即流水线"，没有 DAG 这种独立概念，函数自然组合就是流水线。

```python
from prefect import flow, task
from prefect.tasks import task_input_hash
from datetime import timedelta

@task(retries=3, retry_delay_seconds=60, cache_key_fn=task_input_hash,
      cache_expiration=timedelta(hours=12))
def load_data(date: str):
    # 自动重试 + 缓存：相同入参 12 小时内不重跑
    ...

@task
def train_model(features):
    import mlflow
    with mlflow.start_run():
        ...
        return model_uri

@flow(name="fraud-training", log_prints=True)
def training_pipeline(date: str):
    raw = load_data(date)
    feat = preprocess(raw)
    model = train_model(feat)
    return evaluate(model)

if __name__ == "__main__":
    training_pipeline("2026-05-08")
```

Prefect 3 引入了事务语义（部分任务失败时整组回滚）和事件触发（数据到达即触发训练，不必死等定时）。对 ML 团队最实用的是它的 retries + caching 默认值就比 Airflow 好用很多。

### 23.6.3 Dagster：资产为中心

Dagster 的差异化思路是**以"资产"（Asset）为一等公民**，而不是任务。一个模型、一份特征表都是资产，资产之间的依赖天然就是流水线。

```python
from dagster import asset, MaterializeResult

@asset
def raw_transactions():
    return load_from_s3("...")

@asset
def features(raw_transactions):
    return featurize(raw_transactions)

@asset
def fraud_model(features):
    model_uri = train(features)
    return MaterializeResult(metadata={"model_uri": model_uri})
```

Dagster 的强项是**可观测性和数据血缘自动可视化**——UI 上能直接看到资产之间的依赖图、每个资产的最新物化时间、每个资产的元数据。对数据工程和 ML 边界模糊的团队特别合适。

### 23.6.4 Kubeflow Pipelines：K8s 原生

如果你的整个公司是 K8s 原生（GKE、EKS、自建集群都行），Kubeflow 是最合身的选择。它把每个流水线步骤打成容器，调度到集群上跑，原生支持 GPU、TPU、分布式训练。

```python
from kfp import dsl

@dsl.component(base_image="python:3.11")
def preprocess(input_path: str, output_path: dsl.OutputPath()):
    import pandas as pd
    df = pd.read_parquet(input_path)
    # ...
    df.to_parquet(output_path)

@dsl.component(base_image="my-org/training:v3")
def train(features_path: dsl.InputPath()) -> str:
    # 这一步可以 request_gpu(1) request_memory("32Gi")
    ...

@dsl.pipeline(name="fraud-training")
def pipeline(date: str):
    pre = preprocess(input_path=f"s3://.../{date}.parquet")
    tr = train(features_path=pre.outputs["output_path"])
```

成本是显著的运维负担——你得有 K8s 集群、有 Argo Workflows 底座、有人能调容器镜像。回报是工业级的扩展性。GCP 用户尤其建议直接用 Vertex AI Pipelines（基于 Kubeflow，但完全托管）。

### 23.6.5 Metaflow：Netflix 出品，研发体验最佳

Metaflow 走另一条路：**让数据科学家完全不用学基础设施**。代码是普通 Python 类，加几个装饰器就自动版本化、自动记录中间结果、自动支持云上跑。

```python
from metaflow import FlowSpec, step, resources

class FraudTrainingFlow(FlowSpec):
    @step
    def start(self):
        self.data = load_raw()
        self.next(self.preprocess)

    @step
    def preprocess(self):
        self.features = featurize(self.data)
        self.next(self.train)

    @resources(memory=32000, gpu=1)
    @step
    def train(self):
        self.model = train_model(self.features)
        self.next(self.end)

    @step
    def end(self):
        register_to_mlflow(self.model)

if __name__ == "__main__":
    FraudTrainingFlow()
```

`python flow.py run` 本地跑；`python flow.py run --with batch` 自动调到 AWS Batch / Kubernetes 上跑，资源声明照搬。Metaflow 最大的优点是**没有 YAML、没有 DAG 定义、没有 K8s 知识**门槛。早期到中期 ML 团队，Metaflow 通常是最快的起点。

### 23.6.6 选型经验

| 场景 | 推荐 |
|------|------|
| 数据工程为主，ML 是其中一支 | Airflow / Dagster |
| Python 优先、希望快速起步 | Prefect / Metaflow |
| 已经全 K8s、有平台团队 | Kubeflow / Argo |
| GCP 全家桶 | Vertex AI Pipelines |
| 大模型分布式训练为主 | Ray + 自定义编排 |

不要为了 MLOps 而上 Kubeflow——如果训练流水线一周跑一次，Prefect + GitHub Actions 就够了。复杂度要和频次匹配。

### 23.6.7 流水线触发模式

流水线什么时候跑，是另一个被忽视的设计点。常见的触发方式有四种：

- **定时（Cron）**：每天 / 每周 / 每月固定时间跑。最简单、最可预期，适合数据更新规律的场景（每天凌晨跑昨日全量）。
- **数据到达触发**：上游数据 ready 才跑，避免空跑或半跑。Airflow 的 sensor、Prefect 的事件驱动、Dagster 的 sensors 都支持。
- **代码变更触发**：通过 Git push / PR merge 触发。适合"代码改动 = 模型该重训"的场景。
- **指标驱动触发**：监控发现漂移、业务指标恶化时自动触发重训。这是最高级的形态，要求闭环。

绝大多数团队从定时起步，等数据流稳定后再加事件驱动。代码变更触发要小心——研究阶段一天 commit 几十次，每次都自动训练会烧爆账单。指标驱动触发要更谨慎——闭环没设保险丝时，一次错误漂移检测可能触发连锁重训，把生产模型替换成更糟的版本。

### 23.6.8 训练流水线常见反模式

- **巨型 monolith 流水线**：一个流水线塞了二十几个步骤、跑两天、中间挂了只能从头来。正确做法是按"一旦失败重来代价大不大"来切——训练步骤独立、特征工程独立、评估独立，每一段产出物都落盘且 cache。
- **没有 idempotency**：流水线跑一半失败重跑，结果在数据仓库里写了重复数据。每个写入步骤要么用确定性的 partition key（`date=2026-05-08`），要么用事务/upsert。
- **本地能跑但调度跑不动**：本地 Python 3.11 + 装好的依赖，调度环境是 Python 3.10 + 没装。所有步骤必须容器化（或至少 conda lock 锁死）。
- **环境变量和 secret 写死在代码里**：流水线进了仓库后被外包看到，AWS key 半夜被刷出去几百块。secret 一律走 Vault / AWS Secrets Manager / K8s Secret，调度时注入。
- **没有 cost guardrail**：一个 bug 让训练循环跑了 50 次，每次起 8 卡 A100，一晚上烧两万美元。流水线要设最大运行时间、最大资源上限、超出自动 kill。

---

## 23.7 部署模式：在线、批量、流式、边缘

模型上线的形态决定了运维上限。先把场景分清楚再选工具。

### 23.7.1 在线 API：低延迟、同步请求

最常见的形态：HTTP/gRPC 接口，每次请求一个或一批样本，毫秒级返回。

**BentoML** 是 Python 生态最易用的方案。一个最小服务：

```python
# service.py
import bentoml
from bentoml import IODescriptor as io
import numpy as np

@bentoml.service(
    resources={"cpu": "2", "memory": "4Gi"},
    traffic={"timeout": 10},
)
class FraudClassifier:
    def __init__(self):
        import mlflow.pyfunc
        self.model = mlflow.pyfunc.load_model("models:/fraud_gbdt@champion")

    @bentoml.api(batchable=True, max_batch_size=64, max_latency_ms=50)
    def predict(self, features: np.ndarray) -> np.ndarray:
        return self.model.predict(features)
```

配套的 `bentofile.yaml`：

```yaml
service: "service:FraudClassifier"
labels:
  owner: ml-platform
  team: risk
include:
  - "*.py"
python:
  packages:
    - mlflow==3.1.4
    - scikit-learn==1.5.0
docker:
  python_version: "3.11"
```

打包 + 部署：

```bash
bentoml build
bentoml deploy fraud_classifier:latest --cloud bento-cloud
# 或者 bentoml containerize 然后推到自己的 K8s
```

BentoML 默认开启**自适应批处理（adaptive batching）**：高 QPS 时自动把单条请求合并批量推理，低 QPS 时降级为单条，吞吐和延迟都比手写 Flask 高一个量级。

**Triton Inference Server** 是 NVIDIA 出品，专攻 GPU 高吞吐场景。它原生支持 ONNX、TensorRT、PyTorch、TensorFlow，能做模型并发、动态批处理、模型集成（ensemble）。对延迟敏感（<10ms p99）且模型在 GPU 上跑的场景几乎是默认选择。代价是配置复杂——`config.pbtxt` 不是给人写的语言。

**Ray Serve** 适合"复杂流量模式 + 多模型流水线"。它建立在 Ray 之上，自动扩缩容、模型组合、流量切分都是一等概念。如果一次推理要串多个模型（比如先粗排再精排再重排），Ray Serve 比 BentoML 更合适。

### 23.7.2 批量推理：定时跑大批量

不是所有模型都要在线服务。推荐系统每晚算一次全用户分数、风控周末批量补打分、用户画像每月刷一次，都是批量推理。这种场景不需要低延迟，需要的是高吞吐和成本可控。

实现路径：

```python
# 一个典型的 Spark 批量推理
import mlflow.pyfunc
from pyspark.sql import SparkSession

spark = SparkSession.builder.getOrCreate()

# 把模型当 UDF
predict_udf = mlflow.pyfunc.spark_udf(
    spark,
    model_uri="models:/fraud_gbdt@champion",
    result_type="double",
)

df = spark.read.parquet("s3://.../candidates_2026-05-08/")
scored = df.withColumn("score", predict_udf("feature_array"))
scored.write.parquet("s3://.../scores_2026-05-08/")
```

成本模型：在线服务按 QPS 配 GPU 实例，常态利用率 30% 起算；批量按需起算，跑完就关，单位预测成本能降到在线的 1/5 到 1/10。能批量就别在线。

### 23.7.3 流式推理：Kafka + 在线模型

事件驱动场景：每条交易实时打分、每次点击实时更新推荐。数据从 Kafka 来，模型嵌在流处理框架里，结果再写回 Kafka 或下游存储。

技术选型一般是 Flink / Spark Structured Streaming + 嵌入式模型：

```python
# Flink Python API 思路示例
@MapFunction
class FraudScorer:
    def open(self, ctx):
        import mlflow.pyfunc
        self.model = mlflow.pyfunc.load_model("models:/fraud_gbdt@champion")

    def map(self, txn):
        features = build_features(txn)  # 也可能要现取 Feature Store
        score = self.model.predict([features])[0]
        return {"txn_id": txn["id"], "score": float(score)}
```

流式场景的难点不在模型，在**特征获取**——Feature Store 的在线 API 必须 p99 < 5ms，否则会拖慢整条流。这也是为什么前面 §23.4 强调离线在线一致性的重要性。

### 23.7.4 边缘部署：模型推到设备上

手机、摄像头、IoT 设备上的模型部署是另一个世界。约束：

- 模型必须小（KB 到 MB 级），精度可能要让步。
- 推理引擎要轻（TensorFlow Lite、ONNX Runtime Mobile、Core ML、ExecuTorch）。
- 更新策略要异步（OTA 推下去，不能强制即时）。
- 监控和日志要回传，但要尊重隐私（差分隐私、本地聚合）。

边缘 MLOps 是一个独立大话题，主流团队用 NVIDIA Jetson 系列 + Triton 或者 TensorFlow Lite + Firebase。这里不展开，记住一条原则：**云上的 MLOps 工具基本都不能直接搬到边缘，需要专门的边缘平台**。

### 23.7.5 模型打包格式：MLmodel、ONNX、TorchScript、TensorRT

部署形态确定后，下一步是把训练阶段产出的模型打包成可移植的格式。常见格式有四种：

- **MLflow MLmodel**：MLflow 的统一封装，里面记录模型的 flavor（sklearn / pytorch / tensorflow）、签名、依赖。优点是和 MLflow 生态无缝衔接、跨语言部署有标准；缺点是依赖 Python 推理。
- **ONNX**：开放神经网络交换格式，几乎所有框架（PyTorch、TensorFlow、sklearn、XGBoost）都能导出到 ONNX。优点是可以在 ONNX Runtime 跨平台跑，C++/Java/Go 都有 binding；缺点是某些算子不被支持，导出过程需要 debug。
- **TorchScript**：PyTorch 自己的可序列化中间表示，可以脱离 Python 解释器在 C++ 里跑。适合 PyTorch 重度团队。
- **TensorRT**：NVIDIA 的推理优化引擎。把模型编译成 GPU 上的高度优化代码，相比原生 PyTorch 推理可以提速 2-5 倍。代价是绑定 NVIDIA、编译时间长、调试困难。

实战建议：训练阶段用框架原生格式（PyTorch 模型直接 `torch.save`），通过 MLflow 注册时记录 flavor。部署到 GPU 高吞吐场景时再额外导出一份 TensorRT/ONNX 优化版本。两份并存：原生版作为 source of truth，优化版用于线上服务。

### 23.7.6 部署形态选型决策表

| 场景特征 | 推荐形态 | 工具 |
|---------|---------|------|
| QPS 高、延迟敏感、单模型 | 在线 API + GPU | Triton / BentoML |
| QPS 中、CPU 可扛 | 在线 API | BentoML / FastAPI + 自研 |
| 多模型流水线 | 在线 API + 编排 | Ray Serve |
| 全量打分、对延迟不敏感 | 批量 | Spark + MLflow UDF |
| 事件驱动、毫秒级响应 | 流式 | Flink + Feature Store |
| 设备端推理 | 边缘 | TFLite / ExecuTorch / Core ML |

一条经验性的判断流程：先问"业务能接受多大延迟"，再问"成本预算多少"，再问"模型多大"。三个问题的答案直接决定形态。不要先选工具再倒推业务——这是 MLOps 工程化最常见的反模式。

### 23.7.7 灰度和金丝雀

无论选哪种部署形态，新模型上线都不应该一次性切换 100% 流量。常见的渐进策略：

1. **影子模式（Shadow）**：新模型接收 100% 流量但结果不返回给业务，仅记录用于离线对比。优点是零风险，缺点是看不到真实业务反馈。
2. **金丝雀（Canary）**：按比例把流量切给新模型——1% → 5% → 25% → 50% → 100%。每一级停留 1–7 天观察。
3. **A/B 测试**：随机一半用户走新模型一半走旧模型，跑两周后比较业务指标。和金丝雀的区别是 A/B 强调统计显著性，金丝雀强调风险控制。
4. **多臂老虎机（MAB）**：流量分配根据实时表现动态调整，表现好的版本自动获得更多流量。在推荐和广告场景常见，但不适合监管严格的场景。

实操上要注意流量切分的"粒度"：按 user_id 哈希切，同一个用户始终走同一个模型，避免同一用户在两个模型间反复跳跃造成体验割裂。如果是无状态业务（如搜索、推荐冷启动），可以按请求随机切。

---

## 23.8 监控：模型上线只是开始

服务端监控（CPU、QPS、p99 延迟、错误率）是 SRE 那一套，不展开。ML 系统额外要监控的是：

### 23.8.1 三种漂移

1. **数据漂移（Data Drift）**：输入特征的分布变了。例子：风控模型训练时用户年龄 P50 是 32 岁，三个月后用户群偏年轻化变成 26 岁。
2. **概念漂移（Concept Drift）**：输入特征 → 标签的映射关系变了。例子：疫情前后"高频出差 + 高消费"对应的"优质客户"概率完全反了。
3. **预测漂移（Prediction Drift）**：模型输出分布变了。这是数据漂移和概念漂移的下游表现，但有时候只能监控到这一层（缺少真实标签时）。

### 23.8.2 Evidently：开源漂移检测

Evidently 是开源工具中的标杆，提供 100+ 内置指标，能直接生成 HTML 报告或推送到监控 UI。

```python
from evidently import Report
from evidently.presets import DataDriftPreset, DataSummaryPreset
import pandas as pd

# 参考数据：训练集，或上次评估的快照
reference = pd.read_parquet("s3://.../reference_2026-04-01.parquet")
# 当前数据：最近 7 天线上输入
current = pd.read_parquet("s3://.../current_2026-05-08.parquet")

report = Report(
    metrics=[DataDriftPreset(method="psi"), DataSummaryPreset()],
    include_tests=True,
)
result = report.run(reference_data=reference, current_data=current)

# 输出 HTML 报告
result.save_html("drift_report.html")

# 程序化获取测试结论
for test in result.tests:
    if test.status == "FAIL":
        send_alert(f"Drift detected: {test.name}")
```

Evidently 的默认算法会按列类型自动选检验：连续特征用 PSI 或 KS 检验，类别特征用卡方或 Jensen-Shannon。当超过 50% 的列检测到漂移，整体数据集判定为 drifted。这些阈值都可以配置。

整套流程接到调度上：

```python
# 每天定时跑漂移检测，结果写 Prometheus
@task
def daily_drift_check():
    result = run_evidently_report()
    drift_share = result.metrics["drifted_features_share"]
    push_metric("model.drift_share", drift_share)
    if drift_share > 0.3:
        trigger_retraining()
```

### 23.8.3 whylogs：轻量级 profiling

whylogs 是另一种思路：不直接做"漂移检测"，而是给每批数据生成"概况（profile）"——分位数、唯一值数、空值率、直方图概要。这些 profile 体量极小（KB 级），能持续记录到 WhyLabs 平台或自建存储，事后任意比较两个时间点。

```python
import whylogs as why

profile = why.log(pandas=df).profile()
profile.write("s3://.../profiles/2026-05-08.bin")

# 之后做对比
ref_profile = why.read("s3://.../profiles/2026-04-01.bin")
cur_profile = why.read("s3://.../profiles/2026-05-08.bin")
drift_report = why.diff(ref_profile, cur_profile)
```

whylogs 的优势是 **profile 体量小、可流式生成**，特别适合数据量极大、不可能存全量样本的场景。

### 23.8.4 Arize / Fiddler：商业一体化平台

Arize、Fiddler、WhyLabs 这一档是商业 SaaS，提供一站式监控 + 解释 + 根因。它们的差异化能力是：

- **特征级根因**：发现整体漂移后，自动定位是哪些特征、哪些 cohort 导致的。
- **预测和真实标签延迟回填**：业务真实标签往往延迟（用户三天后才退款），平台支持"先记预测、后补真值"再算线上指标。
- **片段化（Slicing）**：自动找到表现差的子人群（"30 岁以下女性 iOS 用户在你这个模型上 AUC 比整体低 15 个点"）。
- **告警和工单集成**：直接 PagerDuty / Slack / Jira。

商业平台的痛点是**一切走他们的 SaaS**，对数据出域有要求的行业（金融、医疗、政务）通常不能用。

### 23.8.5 业务指标 vs 模型指标

监控要分两层：

- **模型层指标**：AUC、precision、recall、漂移分。这些工程师能算，但业务可能不关心。
- **业务层指标**：欺诈漏过金额、用户次日留存、推荐 CTR、客服转人工率。这些是最终目标。

线上**永远要监控业务层指标**。模型层指标稳定不代表业务没出事——见过太多次"AUC 没动，业务收入掉了 5%"，事后才发现是新版本把高价值用户推成了低价值人群（整体均值没变，分布变了）。

最佳实践是建立"模型 → 业务"的双层监控大屏：上半屏模型指标，下半屏业务指标，每个模型版本上线时打竖线，回滚时也打。事故复盘时这张图能省一半时间。

### 23.8.6 模型可观测性的三层指标体系

监控架构要分层。一个可落地的三层模型：

- **基础设施层**：CPU、内存、GPU 利用率、磁盘 IO、网络。Prometheus + Grafana 这一套，和普通后端服务没本质区别。
- **服务层**：QPS、p50/p95/p99 延迟、错误率、超时率、批处理利用率。这一层 BentoML、Triton、Ray Serve 通常都自带 Prometheus exporter，接 Grafana 即可。
- **模型层**：预测分布、特征分布、漂移度、关键样本预测稳定性、模型置信度直方图。这一层是 ML 特有的，需要 Evidently/whylogs/Arize 这种专用工具。

实战中很多团队只做了前两层，第三层缺失。结果就是基础设施健康、服务正常、但模型已经胡说八道好几天了。把这三层的指标接到同一张 Grafana 大屏，一眼能看出"性能问题"还是"模型问题"，定位时间能从小时级降到分钟级。

### 23.8.7 标签延迟与"延迟反馈"

ML 系统的另一个监控难题是**真实标签的延迟**。

- 风控模型当下判定一笔交易"低风险"，是不是欺诈要等用户三天后投诉才知道。
- 推荐模型当下推一篇内容，是不是用户喜欢要看接下来 7 天的留存。
- 信贷模型批了一笔贷款，是不是好客户要等 6 个月还款记录。

这意味着"上线第一周看不到真实业务指标"，监控只能依赖代理指标——预测分布、漂移度、用户即时反馈（点击率）、模型置信度。等到真标签回填后再算延迟指标，往往为时已晚。

工程上常见的处理：

1. **预测留痕**：每条预测都连同完整输入、模型版本、时间戳记录到日志表，用 Kafka 推到数据湖。
2. **真值回填管道**：建立独立的 ETL 把业务真值（投诉记录、还款表现、用户行为）按 entity_id + 时间戳 join 到预测日志上。
3. **滚动指标计算**：每天计算"截止 D-N 已经能算出真值"的预测指标，N 是业务回填周期。
4. **早期信号建模**：用代理指标（如点击率）训练一个"快速反馈模型"作为真实指标的早期预警。

这套机制做好的团队，能在事故发生 1–3 天内捕捉到劣化；做不好的团队，要等到月度业务复盘才发现。

### 23.8.8 监控告警分级

监控告警如果分不清严重程度，工程师就会"告警麻木"——一个月几百条告警，最后没人看。务实的分级：

- **P0 立即响应**：业务核心指标（GMV、安全损失）异常。值班电话叫醒。
- **P1 当天响应**：模型层指标显著漂移、漏判率超阈值、错误率突增。Slack/钉钉告警。
- **P2 工作日响应**：单特征轻微漂移、训练流水线偶发失败。邮件汇总，每日早会过一遍。
- **P3 信息留底**：常规健康检查、容量趋势。Grafana 看板可见但不主动推送。

把每条告警明确归类到 P0–P3，一年后告警噪声会下降一个数量级。

---

## 23.9 CI/CD for ML：从代码合并到模型上线

传统 CI/CD 跑单测、起 Docker、推 K8s。ML 的 CI/CD 多三层：

1. **数据测试**：schema 是否一致、范围是否合理、关键字段是否非空。
2. **模型测试**：离线评估指标是否达标、对关键样本的预测是否一致（regression test）、对扰动是否稳健（鲁棒性测试）。
3. **部署测试**：影子流量比对、金丝雀指标观察、自动回滚阈值。

### 23.9.1 模型测试该写什么

- **指标门**：新模型在 holdout 集上 AUC 必须 ≥ 当前生产版本 - 0.005（不能严重退步）。
- **关键样本**：维护一个"已知样本 + 期望预测"集合（"这条交易必须判欺诈"、"这个用户必须召回 SKU=123"），新模型预测必须保持一致或更好。
- **公平性**：在敏感分组（性别、年龄、地域）上的指标差异不能超过阈值。
- **鲁棒性**：对输入加噪、缺失、极值，预测变化不应超过预设范围。
- **延迟**：单样本推理 p99 < X ms，不能因为模型变大拖垮服务。

```python
# 一个最小可落地的模型测试套件
import pytest, mlflow.pyfunc, numpy as np, pandas as pd

@pytest.fixture(scope="module")
def model():
    return mlflow.pyfunc.load_model("models:/fraud_gbdt@candidate")

@pytest.fixture(scope="module")
def champion():
    return mlflow.pyfunc.load_model("models:/fraud_gbdt@champion")

def test_no_metric_regression(model, champion):
    holdout = pd.read_parquet("tests/data/holdout.parquet")
    X, y = holdout.drop("y", axis=1), holdout["y"]
    from sklearn.metrics import roc_auc_score
    new_auc = roc_auc_score(y, model.predict(X))
    old_auc = roc_auc_score(y, champion.predict(X))
    assert new_auc >= old_auc - 0.005, f"AUC dropped: {old_auc:.4f} -> {new_auc:.4f}"

def test_known_cases(model):
    cases = pd.read_csv("tests/data/known_cases.csv")
    preds = model.predict(cases.drop(["expected"], axis=1))
    assert (preds == cases["expected"]).mean() >= 0.95

def test_inference_latency(model):
    sample = np.random.rand(1, 64)
    import time
    n = 200
    t0 = time.perf_counter()
    for _ in range(n):
        model.predict(sample)
    p_avg = (time.perf_counter() - t0) / n * 1000
    assert p_avg < 20, f"avg latency {p_avg:.2f} ms exceeds 20 ms"
```

### 23.9.2 GitHub Actions 走完整流水线

```yaml
# .github/workflows/ml-cicd.yml
name: ml-cicd
on:
  push:
    branches: [main]
  pull_request:

jobs:
  data-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - run: pip install -r requirements.txt
      - run: pytest tests/data/ -v

  train-and-eval:
    needs: data-test
    if: github.event_name == 'push'
    runs-on: [self-hosted, gpu]
    steps:
      - uses: actions/checkout@v4
      - run: dvc pull
      - env:
          MLFLOW_TRACKING_URI: ${{ secrets.MLFLOW_URI }}
        run: python train.py
      - run: pytest tests/model/ -v

  shadow-deploy:
    needs: train-and-eval
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Promote to challenger
        run: |
          python scripts/promote.py --alias challenger
      - name: Deploy to shadow
        run: |
          bentoml deploy --env shadow --traffic-split 0
```

注意几个原则：

- 训练步骤跑在自托管 GPU runner 上，云端 GitHub Runner 没 GPU 还贵。
- 模型测试是必经环节，等同于 Java/Go 的单测。
- 部署到生产从不在 CI 里直接做，而是先到 challenger / shadow 环境，由后续金丝雀流程接手。

### 23.9.3 Argo Workflows / Tekton：K8s 原生方案

GitHub Actions 适合代码层面 CI/CD，但流水线本身（训练、部署）一旦复杂、需要长时间跑、需要 GPU 集群调度，就要切到 K8s 原生工具。

- **Argo Workflows**：Kubeflow Pipelines 的底层就是它。声明式 YAML，每个 step 是一个 Pod。可以表达 DAG、条件、循环、重试。
- **Tekton**：CD Foundation 出品，Kubernetes 原生 CI/CD。Argo 偏工作流，Tekton 偏 CI/CD。两者经常组合：Tekton 跑代码 CI，Argo 跑训练流水线。
- **Argo CD**：声明式持续部署，把 Git 中的 K8s manifest 同步到集群。新模型镜像推到 registry 后改 git，Argo CD 自动同步。

GitOps 流派下，"部署"这件事变成"提交一个 PR"。所有上线都在 Git 里有审计记录，回滚就是 git revert。这种范式特别适合监管严格的团队。

### 23.9.4 测试金字塔的 ML 版本

传统软件的测试金字塔是底层单测多、中层集成测试少、顶层 E2E 最少。ML 系统要叠一层：

```
       ┌──────────────┐
       │  业务 A/B 实验  │   ← 真实流量、最贵、最慢
       ├──────────────┤
       │  影子流量比对   │   ← 真实分布、不影响用户
       ├──────────────┤
       │  E2E 流水线测试 │   ← 起完整 stack、慢
       ├──────────────┤
       │  模型测试      │   ← 指标、关键样本、鲁棒性
       ├──────────────┤
       │  数据测试      │   ← schema、范围、空值
       ├──────────────┤
       │  代码单测      │   ← 工程逻辑
       └──────────────┘
```

底两层（代码单测、数据测试）每次 PR 都跑，秒级。中两层（模型测试、E2E）每次合并跑，分钟级到小时级。顶两层（影子、A/B）按周跑，天级。每往上一层覆盖率就该下降一个数量级，但一旦发现问题严重程度就指数级上升。

很多团队的错误是**只做最顶层的 A/B**——出问题损失最大，但发现也最晚。务实的投入比例是：底层单测 + 数据测试 70%、模型测试 20%、E2E 10%、影子 + A/B 是结果不是测试本身。

---

## 23.10 复盘文化：事故是模型成长的唯一养料

工具讲完了，最后讲一件没工具的事：复盘。

ML 系统的复盘比 DevOps 复盘更难，因为：

- 故障可能"无声"：服务 200 OK 但模型胡说八道。
- 故障归因困难：是数据漂了、还是上游 feature pipeline 改了字段、还是模型训练时混进了坏数据？
- 故障可能延迟暴露：模型在某个特定子人群上劣化，整体指标不变，几周后业务才感知。

### 23.10.1 一份合格的 ML 事故 Postmortem 模板

```
# 事故标题：风控模型 v42 在 2026-05-08 漏判约 1.2 万条欺诈

## 时间线
- 05-05 09:00 v42 通过 CI，注册为 challenger
- 05-06 14:00 影子环境观察 24 小时，AUC 0.913，与生产持平 -> 通过
- 05-07 10:00 v42 promoted 为 champion，全量上线
- 05-08 03:00 风控值班发现凌晨欺诈量突增 3 倍
- 05-08 03:45 SRE 确认服务正常，定位到模型层
- 05-08 04:10 回滚到 v41，问题缓解
- 05-08 12:00 复盘启动

## 影响
- 经济损失：约 350 万人民币（漏判欺诈金额）
- 用户影响：约 8000 名正常用户被错误拦截后释放
- 监管影响：触发了内部红线，需上报合规

## 根因
v42 训练时，数据流水线的 "device_fingerprint" 字段因为上游 SDK 升级，
取值范围从 0-65535 扩到了 0-2^32，但训练集只覆盖了升级前的数据。
线上推理时碰到新值被截断为 0，模型把"未知设备"判为低风险。

离线评估为什么没发现：评估集和训练集来自同一个时间窗口，都是升级前数据。

## 检测和响应
- 平均检测时间（MTTD）：6 小时（凌晨业务低峰，到早班才发现）
- 平均缓解时间（MTTM）：1 小时 10 分（值班 + 回滚流程）
- 平均根因定位时间：4 小时

## 行动项（带负责人和截止日）
1. 评估集必须包含最近 24 小时数据 - @ml-platform - 05-15
2. device_fingerprint 字段加 schema 校验，新值范围必须在 CI 报警 - @data-eng - 05-12
3. 漂移监控阈值从"超过 50% 列漂移"调整为"任一关键特征漂移" - @ml-platform - 05-15
4. 风控类模型必须 7 天影子，不能 24 小时就 promote - @policy - 立即生效

## 不写的东西
- 不追究值班是否反应慢（凌晨 3 点 1 小时缓解已经超出预期）
- 不追究"谁批准的 v42"（流程合规，是流程本身有漏洞）
```

注意几条：

- **行动项必须有人、有截止日、有验证方式**。没有这三样的行动项，三个月后还会原样发生。
- **追事不追人**。复盘文化崩坏的第一个信号，就是事故被用来定 KPI、扣绩效。
- **流程 > 个人**。"小李没好好评估"不是根因，"流程允许小李一个人就能上线"才是根因。

### 23.10.2 模型回滚预案

回滚必须**预设、自动化、可演练**。预设是指上线前就明确"出现什么指标恶化时立即回滚"，不是事故时再讨论。自动化是指回滚要一键、最好零接触（监控触发自动调 alias 切换）。可演练是指每个季度故意触发一次回滚演习，验证流程没烂掉。

最佳实践是把回滚做成"切 alias"而不是"重新部署"。MLflow Model Registry 的 alias 机制就是为此设计的——回滚不需要重打镜像、不需要重启服务，只是把 `@champion` 指回上一个版本，几秒钟生效。

```python
# 一键回滚脚本
from mlflow import MlflowClient
client = MlflowClient()

def rollback(model_name: str):
    versions = client.search_model_versions(f"name='{model_name}'")
    versions = sorted(versions, key=lambda v: int(v.version), reverse=True)
    current = client.get_model_version_by_alias(model_name, "champion")
    previous = next(v for v in versions if int(v.version) < int(current.version))
    client.set_registered_model_alias(
        name=model_name, alias="champion", version=previous.version
    )
    print(f"Rolled back from v{current.version} to v{previous.version}")

if __name__ == "__main__":
    import sys
    rollback(sys.argv[1])
```

### 23.10.3 把"反馈"接回数据

复盘和监控产出的，不只是事故记录，更是**新一轮训练数据**。

- 漏判的欺诈案例：补到下一版训练集，提升对这类样本的召回。
- 误拒的正常用户：补到下一版训练集的负样本，降低误报。
- 漂移检测发现的新分布：把最近一段时间的数据按比例加进训练集。

这条循环跑通的标志是：**模型上线后的失败案例，能在 14 天内变成下一版本的训练样本**。做不到这一点的 MLOps，再花哨也是死的——它只是在记录历史，不是在改善未来。

### 23.10.4 事故等级分类

不是所有事故都该惊动 CTO，也不是所有事故都该静默处理。一个清晰的事故等级体系能让团队在事故发生的第一秒就知道该按哪个按钮。参考分级：

- **SEV-1 灾难级**：核心业务停摆、安全损失超过百万、监管必须上报。例：风控模型漏判致大额欺诈损失、推荐系统全量推违法内容。处置：立即回滚 + 全员动员 + CTO 通报。
- **SEV-2 严重级**：核心业务指标下降 5% 以上、影响超过 10% 用户。例：推荐 CTR 跌 8%、风控误拒率翻倍。处置：工作时间内 1 小时内启动应急 + 当天回滚或修复。
- **SEV-3 一般级**：边缘指标恶化、影响小部分用户、业务可承受。例：单一子人群指标下滑、模型推理延迟 P99 翻倍但仍可用。处置：当周内修复，进入下一个迭代版本。
- **SEV-4 信息级**：监控告警但实际无业务影响。例：漂移轻微但下游业务正常。处置：记录、观察、按月聚合复盘。

把这套等级写进 runbook，每次告警自动按规则归类，能避免"小事故响应过度 + 大事故响应不足"的双重失误。

### 23.10.5 演练：故意把生产搞挂一次

DevOps 圈里 Netflix 推 Chaos Engineering 已经十几年，ML 圈学得慢。但 ML 系统比传统服务更需要演练——因为故障模式更隐蔽、回滚链路更复杂、人为流程更多。

值得每季度演练一次的场景：

- **回滚演练**：把当前 champion 故意标记成"出问题"，要求值班工程师 30 分钟内回滚到上一版本。验证回滚脚本、监控告警、上下游通知都通畅。
- **数据合同破坏**：偷偷在测试环境上游 schema 加一个字段或改个字段类型，看下游 ETL 是否能优雅降级、是否能在 1 小时内告警。
- **特征漂移注入**：人为往在线特征里注入异常值（年龄 = -1、金额 = 1e10），看模型是否被搞崩、是否触发漂移告警。
- **依赖故障**：Feature Store 的 Redis 单节点挂掉、Model Registry 不可达，验证服务是否能用兜底策略（缓存的旧特征、本地缓存的旧模型）继续工作。

演练的目的不是证明系统完美，是发现"我们以为有这个能力，其实没有"的盲区。第一次演练通常一败涂地，这正是它的价值。

### 23.10.6 团队层面的复盘文化建设

工具和流程都是表象，真正的复盘文化是组织能力。几条经验：

- **每月固定复盘时间**：哪怕没出大事故也要开，回顾本月所有 P1 以上事件 + 上线变更，找模式。
- **复盘报告公开**：写完上 Wiki，全公司可读。隐藏复盘报告会让事故重复发生在另一个团队。
- **行动项跟踪到底**：开复盘容易，落实行动项难。每周站会要过一遍未关闭的复盘行动项。
- **管理层带头自批评**：如果只有工程师在复盘里写"我做错了"，没人写"我们的流程没设这道门"，复盘就退化成检讨大会。
- **数据驱动而非情绪驱动**：复盘描述事实和影响，不评价个人能力。"v42 漏判 1.2 万条"是事实，"小李太不细心"是评价。前者推进流程改进，后者制造内耗。

---

## 23.11 一条端到端的 MLflow 实战链路

把前面的零件拼一遍，跑一个能上线、能监控、能回滚的最小闭环。

```python
# train.py
import mlflow
import mlflow.sklearn
from mlflow import MlflowClient
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import roc_auc_score
import pandas as pd

mlflow.set_tracking_uri("http://mlflow.internal:5000")
mlflow.set_experiment("fraud-detection")

# 1. 拉数据（已经被 DVC 钉住版本）
df = pd.read_parquet("data/features_2026-05-08.parquet")
X, y = df.drop("label", axis=1), df["label"]
split = int(len(df) * 0.8)
X_tr, X_va, y_tr, y_va = X[:split], X[split:], y[:split], y[split:]

# 2. 跑实验 + 注册
with mlflow.start_run(run_name="gbdt-2026-05-08") as run:
    params = {"n_estimators": 300, "max_depth": 5, "learning_rate": 0.05}
    mlflow.log_params(params)

    model = GradientBoostingClassifier(**params).fit(X_tr, y_tr)
    auc = roc_auc_score(y_va, model.predict_proba(X_va)[:, 1])
    mlflow.log_metric("val_auc", auc)

    info = mlflow.sklearn.log_model(
        sk_model=model,
        name="model",
        registered_model_name="fraud_gbdt",
        input_example=X_va.iloc[:5],
    )

# 3. 模型测试通过 -> 打 challenger
client = MlflowClient()
client.set_model_version_tag(
    "fraud_gbdt", info.registered_model_version, "val_auc", f"{auc:.4f}"
)
client.set_registered_model_alias(
    "fraud_gbdt", "challenger", info.registered_model_version
)
print(f"Registered fraud_gbdt v{info.registered_model_version} as @challenger")
```

```python
# promote.py - 影子流量观察 7 天后由 cron 调用
from mlflow import MlflowClient
client = MlflowClient()

def promote_if_safe():
    cand = client.get_model_version_by_alias("fraud_gbdt", "challenger")
    cand_auc = float(client.get_model_version(
        "fraud_gbdt", cand.version
    ).tags.get("shadow_auc", "0"))
    champ = client.get_model_version_by_alias("fraud_gbdt", "champion")
    champ_auc = float(champ.tags.get("shadow_auc", "0"))

    if cand_auc >= champ_auc - 0.005:
        client.set_registered_model_alias(
            "fraud_gbdt", "champion", cand.version
        )
        print(f"Promoted v{cand.version}: {cand_auc:.4f} >= {champ_auc:.4f} - 0.005")
    else:
        print(f"Reject v{cand.version}: shadow AUC dropped too much")
```

```python
# serve.py - BentoML 服务入口
import bentoml
import mlflow.pyfunc
import numpy as np

@bentoml.service(resources={"cpu": "2"}, traffic={"timeout": 5})
class FraudClassifier:
    def __init__(self):
        self.model = mlflow.pyfunc.load_model("models:/fraud_gbdt@champion")

    @bentoml.api(batchable=True, max_batch_size=128)
    def predict(self, x: np.ndarray) -> np.ndarray:
        return self.model.predict(x)
```

```python
# monitor.py - 每天定时跑漂移
from evidently import Report
from evidently.presets import DataDriftPreset
import pandas as pd, requests

def run_daily():
    ref = pd.read_parquet("s3://.../reference.parquet")
    cur = pd.read_parquet("s3://.../last_24h.parquet")
    r = Report([DataDriftPreset(method="psi")], include_tests=True).run(ref, cur)

    drifted_share = r.metrics_results["DataDriftPreset"]["share_drifted_columns"]
    requests.post(
        "http://pushgateway.internal:9091/metrics/job/fraud_drift",
        data=f"fraud_model_drift_share {drifted_share}\n",
    )
    if drifted_share > 0.3:
        requests.post(
            "https://hooks.slack.com/services/...",
            json={"text": f":warning: fraud_gbdt drift {drifted_share:.2f}"},
        )
```

```python
# rollback.py - 自动回滚（在监控里检测到业务指标恶化时调用）
from mlflow import MlflowClient
client = MlflowClient()

def rollback_to_previous(name: str):
    cur = client.get_model_version_by_alias(name, "champion")
    versions = sorted(
        client.search_model_versions(f"name='{name}'"),
        key=lambda v: int(v.version), reverse=True,
    )
    prev = next(v for v in versions if int(v.version) < int(cur.version))
    client.set_registered_model_alias(name, "champion", prev.version)
    return prev.version
```

把这五个文件接成 Prefect 流水线：

```python
# pipeline.py
from prefect import flow, task
import subprocess

@task
def train(): subprocess.run(["python", "train.py"], check=True)

@task
def test_model(): subprocess.run(["pytest", "tests/model/"], check=True)

@task
def deploy_shadow(): subprocess.run(["bentoml", "deploy", "--env", "shadow"], check=True)

@task
def daily_monitor(): subprocess.run(["python", "monitor.py"], check=True)

@flow
def daily_training():
    train()
    test_model()
    deploy_shadow()

@flow
def daily_monitoring():
    daily_monitor()

if __name__ == "__main__":
    daily_training.serve(name="train", cron="0 2 * * *")
    daily_monitoring.serve(name="monitor", cron="0 6 * * *")
```

至此，一条最小但完整的 MLOps 链路就能跑了：

- DVC 钉数据版本 → MLflow 跟实验 → 注册中心管模型版本 → BentoML 在线服务 → Evidently 监控漂移 → Prefect 调度 → GitHub Actions 跑 CI/CD → 出事一键回滚。

---

## 23.12 章节小结

把这一章的内容收成一张工程师查得到的清单：

1. **MLOps 的核心是元数据**——代码、数据、模型、指标四者必须随时可对齐、可回放。
2. **数据先版本化**：DVC 适合中小规模研究目录，LakeFS 适合 TB 级数据湖，二者可组合。
3. **实验跟踪只用一个**：MLflow 是默认开源选择，W&B 是 UI 最强的商业选择。
4. **Feature Store 不是必选**：训练和推理代码不分叉时不上；分叉时 Feast 起步、Tecton 进阶。
5. **模型注册靠 alias 不靠版本号**：业务永远加载 `@champion`，回滚就是切 alias。
6. **流水线编排按团队配**：数据工程为主选 Airflow/Dagster；Python 优先选 Prefect/Metaflow；K8s 原生选 Kubeflow。
7. **部署形态决定运维上限**：在线 BentoML/Triton/Ray Serve，批量 Spark+MLflow，流式 Flink+Feature Store，边缘单独的世界。
8. **监控分模型和业务两层**：模型层指标稳定不代表业务层没出事，永远以业务指标为最终判官。
9. **CI/CD 多三层**：数据测试、模型测试、部署测试。模型测试要写关键样本和指标门。
10. **事故是养料不是负担**：复盘必须追根因不追人，行动项必须有人有截止日，失败案例必须能在两周内进入下一版训练数据。

### 23.12.1 进阶阅读路线

如果你想从这一章往深处走，下面这条路线不会让你掉坑：

- 先把 MLflow + Prefect + Evidently 这三件最小套件在自己机器上跑通端到端 demo，完整经历一次"训练 → 注册 → 部署 → 漂移检测 → 回滚"。
- 然后读 Google 的 MLOps 白皮书《Practitioners Guide to MLOps》和 Databricks 的《The Big Book of MLOps》，理解大厂级架构。
- 接着挑一个具体方向深入：要做大规模分布式训练就读 Ray + Kubeflow；要做 Feature Store 就读 Feast 源码 + Tecton 博客；要做模型监控就读 Evidently 源码 + Arize 论文。
- 最后参与一次真实事故的复盘，再回头读 Google SRE Workbook 的 Postmortem 章节。这一步比前面三步加起来更有效——理论懂了，但只有真出过事才知道哪些工具不靠谱、哪些流程会失灵。

### 23.12.2 一条最简实战起步路径

落到能动手的层面，给一周的时间，按下面这条路径搭一个最小可用 MLOps：

- **Day 1**：本地起 MLflow tracking server（`mlflow server --backend-store-uri sqlite:///mlflow.db --default-artifact-root ./artifacts`），跑一个 sklearn demo，确认 run 能记录、UI 能看。
- **Day 2**：把训练代码 git 化，加 DVC 管数据，配 S3/MinIO 远端。验证 `git checkout` 历史 commit 后 `dvc checkout` 能拉到当时的数据。
- **Day 3**：把训练代码改成 Prefect flow，加 retry + cache。本地 `prefect server start` 起 UI，看 flow 跑起来。
- **Day 4**：把模型用 BentoML 打包成服务，本地 `bentoml serve` 起来，curl 一下 predict 接口。
- **Day 5**：加 Evidently 漂移检测脚本，构造一份"漂移过的"测试数据，验证报告能生成、能告警。
- **Day 6**：写一个最小的 GitHub Actions workflow，在 PR 合并时自动跑数据测试 + 模型测试。
- **Day 7**：把所有这些用一段 README 写下来——为什么这么搭、每个工具解决什么问题、下一步可以加什么。这一步是给未来的自己（和团队）的礼物。

这一周走完，你不是 MLOps 专家，但你已经比 80% 的"用过 sklearn 但没上过线"的工程师领先了一整个段位。

---

下一章我们换个赛道：**LLMOps**。生成式模型的运维体系和这一章讲的经典 MLOps 同源但不同骨——评估方式、监控对象、成本模型、安全边界全都重新洗牌。

---
