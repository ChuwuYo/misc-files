# 第 02 章 · Python 工程化基础

> 目标：把你从「会写 .py 脚本」拉到「能写一个能交付、能运行、能维护的 AI 应用」。
>
> 本章默认 Python 3.13+，所有示例在 macOS / Linux 下验证。Windows 用户请自行替换路径分隔符。
>
> **前置假设**：本书不教 Python 基础语法。本章默认你 `def`、`class`、`import`、`with`、`try/except` 都写过，至少跟着教程做过一两个能跑的小程序。否则先回序言看推荐的 Python 入门资源（廖雪峰 / Real Python / 官方 Tutorial），再回来读——否则你会在 2.1 节就被术语劝退。本章是「字典」，不是「小说」，看不懂的小节直接跳，章末有「读不下去怎么办」自救清单。

### 真实场景：为什么需要「工程化」

想象一下你在 2026 年加入了一家 AI 创业公司，第一周老板扔给你一个 issue：「我们的 RAG 客服机器人在用户问长问题时偶尔超时，帮忙看下。」你打开仓库，发现里面有 `pyproject.toml`、CI 在跑 `ruff check` 和 `mypy --strict`、日志是 JSON 格式、调 LLM 的代码全是 `async def` 和 `@retry` 装饰器。你之前写的 Python 都是「装个 Anaconda、pip install 一堆包、写个 main.py 跑一下」——这套陌生的东西到底是什么？

第 01 章讲过这一行真正稀缺的是「能交付完整闭环」的人——能把 RAG 从 60% 推到 90%、能让 Agent 在 200 步内不偏题、能把 P95 延迟压在 3 秒以内。这些活儿没有一项能在脚本式 Python 上长出来。本章把现代 AI 工程团队那套工具链（pyproject.toml、ruff、mypy strict、async、结构化日志、pytest fixture、Dockerfile）一次性讲清，并用一个贯穿全章的小项目串起来：**一个调用 LLM API 的 CLI 工具 `askbot`**，从 `uv init` 到 `docker build`，每节都给它加一块。

### 术语速查（先扫一眼，看不懂留个印象，正文再细讲）

| 名词 | 一句话白话 | 类比 |
|------|----------|------|
| **uv** | Rust 写的 Python 包管理器，10–100× 速度，一个二进制顶替 pip + venv + pyenv | 像 Node 的 pnpm |
| **ruff** | Rust 写的代码检查 + 格式化工具，900+ 规则一锅端 | 像 ESLint + Prettier |
| **mypy** | 静态类型检查器，提前帮你抓出 `int` 当 `str` 用之类的低级错 | 像 TypeScript 编译器 |
| **Pydantic** | 数据校验库，定义一个类就能把外部 JSON 变成有类型保证的 Python 对象 | 像 Java 的 Bean Validation |
| **asyncio / async** | Python 的并发机制，一个进程里同时等 50 个网络请求，专治调 LLM 慢 | 像 JS 的 async/await |
| **httpx** | 现代 HTTP 客户端，能同步能异步，API 跟 requests 几乎一样 | requests + 异步版 |
| **tenacity** | 重试装饰器，一行代码给函数加「失败自动重试」 | 像 Java 的 @Retryable |
| **structlog** | 结构化日志，每条日志是 dict 而不是字符串，方便机器查询 | 像往 Elasticsearch 喂 JSON |
| **pytest** | Python 最主流的测试框架，文件名以 `test_` 开头自动识别 | 像 JS 的 jest |
| **pyproject.toml** | 现代 Python 项目的「身份证」+ 配置文件，所有工具都读它 | 像 Node 的 package.json |
| **Docker** | 把代码 + 依赖打成一个镜像，到哪都能跑 | 「集装箱」原意 |
| **CI** | 持续集成，每次 push 代码自动跑测试 + 检查 | 像 GitHub Actions / GitLab Runner |
| **CLI** | Command Line Interface，命令行工具，比如 `git`、`curl` | 没有界面、靠敲命令的程序 |
| **wheel** | Python 的安装包格式，后缀 `.whl`，相当于打包好的二进制 | 像 jar 包 |

---

## 章节速览

- 2.1 工具链选型，为什么是 uv + ruff + mypy
- 2.2 类型系统：为什么写类型注解，进阶语法（Protocol / 泛型 / 装饰器）按需读
- 2.3 Pydantic v2：模型、validator、settings
- 2.4 异步：asyncio 基础、Semaphore 限流、httpx
- 2.5 错误处理：tenacity 重试、断路器、幂等
- 2.6 日志：structlog + OpenTelemetry
- 2.7 项目结构：src/ 布局
- 2.8 测试：pytest-asyncio + pytest-httpx
- 2.9 把 askbot 拼起来
- 2.10 打包与分发：wheel + Docker
- 2.11 pre-commit + CI

> **本章三档读法**（不知道从哪下嘴时先看这个）：
>
> - **必读 6 节**（覆盖 80% 工程能力）：2.1 工具链 / 2.3 Pydantic / 2.4 异步 / 2.5 错误处理 / 2.7 项目结构 / 2.9 askbot 拼起来。
> - **选读 3 节**（用到再回来）：2.2 类型系统、2.6 日志、2.8 测试。
> - **进阶 2 节**（真要发版部署再读）：2.10 打包与分发、2.11 pre-commit + CI。
>
> 第一遍按「必读 6 节」走一遍能跑通 askbot，就算这章过关了；选读和进阶部分先扫标题留个印象，工作里撞到再回来查。

## 2.1 工具链：2026 年的现实

我先把结论甩在前面：

| 用途 | 2020-2023 主流 | 2026 现实 | 为什么换 |
|------|----------------|-----------|----------|
| 包管理 / 虚拟环境 / Python 安装 | pip + venv + pyenv | **uv** | 一个 Rust 二进制顶替三个工具，10–100× 速度，PyPI 月下载已超过 Poetry |
| 格式化 | black | **ruff format** | 与 black 输出 99.9% 一致，速度快 30× |
| Lint | flake8 + isort + pyupgrade + ... | **ruff check** | 一个工具替掉一打，900+ 规则 |
| 类型检查 | mypy | **mypy**（仍主流）/ pyright / ty | mypy 仍是默认，pyright 在编辑器里更快 |
| 数据校验 | pydantic v1 / dataclass / attrs | **pydantic v2** | Rust 核心，5–50× 速度，AI 应用刚需 |
| HTTP 客户端 | requests | **httpx** | 同 API 风格 + 原生 async + HTTP/2 |
| 重试 | 自己写 try/except | **tenacity** | 装饰器式，async 友好 |
| 日志 | logging | **structlog**（结构化）/ loguru（脚本/原型） | 结构化日志直接进 ELK/Loki |

代价是接受单一供应商（Astral）和一个新二进制——值得。AI 项目依赖图常常 80–200 个包，pip 解析一次 30 秒起步，uv 通常 1–3 秒搞定，一年下来省的时间是几十小时。

> <small>**背景知识（可跳）**：2026 年 3 月 OpenAI 宣布收购 Astral（uv / ruff / ty 背后的公司）。两个工具仍然是 MIT/Apache 2.0 开源许可，短期不会有破坏性变化——零基础读者不必纠结这条产业八卦，知道「uv 现在被大厂背书、近期不会消失」就够了。</small>

### 安装 uv

```bash
# macOS / Linux：官方一键脚本
curl -LsSf https://astral.sh/uv/install.sh | sh

# 或用 brew
brew install uv

# 验证
uv --version   # 2026 年 5 月已到 0.11.x；本章命令在 0.4+ 都能跑
```

uv 不需要预先安装 Python。它会按需下载并缓存指定版本，避免和系统 Python 打架。

> <small>**背景知识（可跳）**：uv 背后用的是 Astral 自家的 python-build-standalone 预编译版，比 pyenv 现编译快几个数量级，也避开了 macOS 系统 Python 那堆 OpenSSL 链接问题。零基础读者只要记住「`uv python install 3.13` 一行搞定，不用自己折腾 pyenv 和编译错误」。</small>

几个常用子命令的对应关系，方便 pip / poetry 用户切换：

| 你以前会 | 现在敲 |
|---------|--------|
| `python -m venv .venv && source .venv/bin/activate` | `uv venv` |
| `pip install -r requirements.txt` | `uv sync` |
| `pip install foo` | `uv add foo` |
| `pip install --dev pytest` | `uv add --dev pytest` |
| `python script.py` | `uv run python script.py`（自动激活 venv） |
| `pyenv install 3.13` | `uv python install 3.13` |
| `pipx install ruff` | `uv tool install ruff` |
| `pip-compile` | `uv lock` |

### 第一次创建项目（贯穿小项目正式开工）

```bash
# 创建一个应用项目（不是库），自动生成 src/ 布局
uv init --app --package askbot
cd askbot

# 指定 Python 版本（uv 会自动下载）
uv python pin 3.13

# 加生产依赖
uv add httpx pydantic pydantic-settings tenacity structlog typer

# 加开发依赖（uv 用 dependency-groups，不再是 dev-dependencies）
uv add --dev pytest pytest-asyncio pytest-httpx ruff mypy
```

跑完之后看一眼 `pyproject.toml`：

```toml
[project]
name = "askbot"
version = "0.1.0"
description = "A CLI that asks an LLM."
readme = "README.md"
requires-python = ">=3.13"
dependencies = [
    "httpx>=0.27",
    "pydantic>=2.9",
    "pydantic-settings>=2.5",
    "structlog>=24.4",
    "tenacity>=9.0",
    "typer>=0.12",
]

[dependency-groups]
dev = [
    "mypy>=1.13",
    "pytest>=8.3",
    "pytest-asyncio>=0.24",
    "pytest-httpx>=0.32",
    "ruff>=0.7",
]

[project.scripts]
askbot = "askbot:main"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/askbot"]
```

> 这里所有 `>=` 写的是「写本书时的下限」，到 2026 年 5 月 ruff 已发到 0.15.x（2026-04 起带 2026 style guide）、mypy 出到 2.1（2026-05）、uv 来到 0.11.x、httpx 0.28.x。把下限定保守、由 `uv lock` 锁具体版本，是兼容性最稳的做法。

几个 2026 年的细节：`requires-python = ">=3.13"` 写死下限保证 CI 一致、镜像可复现；`[dependency-groups]` 是 PEP 735 标准化的依赖组，替代了 `[tool.poetry.group.dev]` 与 `[project.optional-dependencies]` 的尴尬；`[project.scripts]` 让 `pip install askbot` 之后能直接 `askbot` 命令调用，不用 `python -m askbot`。

### 配置 ruff 和 mypy

把下面这段拼到 `pyproject.toml` 末尾：

```toml
[tool.ruff]
line-length = 100
target-version = "py313"

[tool.ruff.lint]
# 选择常用规则集，官方文档列了全部
select = [
    "E", "F",     # pycodestyle / pyflakes 基础
    "I",          # isort 排序
    "B",          # flake8-bugbear 易错点
    "UP",         # pyupgrade 自动升级老语法
    "ASYNC",      # 异步代码规则（很重要）
    "SIM",        # 简化建议
    "RUF",        # ruff 自家
]
ignore = ["E501"]  # 行长由 formatter 控

[tool.ruff.format]
quote-style = "double"

[tool.mypy]
python_version = "3.13"
strict = true
# 第三方库没类型时不要红整个项目
ignore_missing_imports = true
```

为什么 ruff 选 `ASYNC` 这一族？因为 AI 应用 90% 是 IO 密集型，写 async 是迟早的事，而 `await` 漏写、阻塞调用混进协程这种坑，ruff 静态查得出来，比线上 P0 早。比如 `ASYNC100` 会抓 `time.sleep` 出现在 `async def` 里——这种代码不会抛错，但会卡住整个事件循环，过去要靠资深同事 review 才看得见。

跑一遍校验：

```bash
uv run ruff check .       # lint
uv run ruff check --fix . # lint 并自动修
uv run ruff format .      # format
uv run mypy src           # 类型检查
```

`uv run` 会自动激活虚拟环境，省掉 `source .venv/bin/activate`。本章之后所有命令都用它。

### uv 的几个隐藏技巧

- **`uv lock --upgrade-package httpx`**：只升级单个包到最新兼容版本，其他包锁不动。比 `uv lock --upgrade`（全量升级）安全得多。
- **`uv tree`**：看清楚依赖图，发现「我装了 langchain 居然把 httpx 锁到 0.25」之类的祖传锁定。
- **`uv export -o requirements.txt`**：导出 requirements.txt，给那些还不支持 pyproject.toml 的工具（比如某些 PaaS 平台）。
- **`uv run --with foo bar`**：临时加个依赖跑一次，不写进 pyproject。一次性脚本特别有用。
- **`uv self update`**：升级 uv 自身，不用 brew/curl 重装。

### 关于 mypy strict 的争议

`strict = true` 一打开会强制：每个函数必须有返回类型注解，不允许 `Any` 漏出，不允许 `# type: ignore` 不带原因，等等。新代码上来就开 strict 是值得的（增量成本低）；老项目上来开 strict 会红出几千行，建议改成 `strict = false` + 逐文件开：

```toml
[[tool.mypy.overrides]]
module = ["askbot.client", "askbot.types"]
strict = true
```

这种「strict 边界 + 宽松其它」的策略，是大多数生产代码库的现实选择。

### 一份生产级 pyproject.toml 模板

把上面零散的配置拼到一起，照抄基本不会错：

```toml
[project]
name = "askbot"
version = "0.1.0"
description = "A CLI that asks an LLM."
readme = "README.md"
requires-python = ">=3.13"
license = "MIT"
authors = [{name = "your-name"}]
dependencies = [
    "httpx[http2]>=0.27",
    "pydantic>=2.9",
    "pydantic-settings>=2.5",
    "structlog>=24.4",
    "tenacity>=9.0",
    "typer>=0.12",
]

[dependency-groups]
dev = [
    "mypy>=1.13",
    "pytest>=8.3",
    "pytest-asyncio>=0.24",
    "pytest-httpx>=0.32",
    "pytest-cov>=5.0",
    "ruff>=0.7",
    "syrupy>=4.7",
]

[project.scripts]
askbot = "askbot:main"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/askbot"]

[tool.ruff]
line-length = 100
target-version = "py313"
src = ["src", "tests"]

[tool.ruff.lint]
select = ["E", "F", "I", "B", "UP", "ASYNC", "SIM", "RUF", "PT", "S"]
ignore = ["E501", "S101"]  # 行长由 formatter 控；S101 允许测试用 assert

[tool.ruff.lint.per-file-ignores]
"tests/**" = ["S"]  # 测试里允许 hardcoded creds、硬编码 url

[tool.ruff.format]
quote-style = "double"

[tool.mypy]
python_version = "3.13"
strict = true
ignore_missing_imports = true
warn_return_any = true
warn_unused_ignores = true

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
addopts = "-ra --strict-markers --tb=short"

[tool.coverage.run]
branch = true
source = ["src/askbot"]
```

注意几个细节：
- `httpx[http2]` 里方括号是 extras，会自动装 `h2` 依赖。
- `per-file-ignores` 让测试代码豁免几个规则，否则每个测试都报「使用了 assert」。
- `warn_unused_ignores` 让 `# type: ignore` 失效后报错——避免遗留过时的忽略注释。

---

## 2.2 类型系统：让 IDE 帮你抓 bug

> **白话先看这段（零基础必读）**：Python 本来是「动态语言」——变量不写类型也能跑，传错类型要到运行时才炸。类型注解就是手动给变量贴个标签（`x: int`、`def add(a: int, b: int) -> int`），告诉编辑器和 mypy 这种工具「这个东西应该是什么类型」。**Python 运行时不会强制检查**（你传 `str` 进来照样能跑），但 mypy 会在你写代码时就把「int 当 str 用」这种低级错标红。可以理解成「给变量贴标签，让 IDE 帮你 review」。
>
> **难度地图**：本节前半（「为什么 AI 工程更需要类型」「类型注解的三种姿势」「Protocol」「TypedDict」）每个 AI 工程师都要会。后半的 **PEP 695 泛型 / ParamSpec** 是 Python 高级类型系统，给写库作者和写装饰器的人用——零基础读者**第一遍可整段跳**，只看「为什么 AI 工程更需要类型」这一节就够，等真正要写自己的 `@retry` 装饰器时再回来。

### 为什么 AI 工程更需要类型

AI 应用里有大量「数据从外部来、形状不可信」的边界：用户输入、LLM 返回、工具调用入参、向量库元数据。任何一处类型错乱，下游就是 `KeyError` 或者更糟——一个看起来跑通了但语义错了的请求。类型系统是把这些边界钉死的最便宜手段。

### 类型注解的三种姿势

Python 三种类型注解风格并存，不要混着用：

```python
# 1. 旧式 typing 模块（Python <3.9 兼容）
from typing import List, Dict, Optional
def f(xs: List[int], m: Dict[str, int]) -> Optional[int]: ...

# 2. PEP 585（Python 3.9+，内建容器直接用）
def f(xs: list[int], m: dict[str, int]) -> int | None: ...

# 3. PEP 695（Python 3.12+，新泛型语法）
def first[T](xs: list[T]) -> T: ...
```

新代码全部用 2 + 3 风格，下限 3.13 完全没历史包袱。从老代码迁移有 ruff 规则 `UP006/UP007/UP045`，会自动把 `List[int]` 改成 `list[int]`，把 `Optional[X]` 改成 `X | None`。`uv run ruff check --fix --select UP .` 一键搞定。

### Generics 与 PEP 695 新语法（3.12+）

```python
# Python 3.12 之前需要 TypeVar，繁琐
from typing import TypeVar
T = TypeVar("T")
def first(xs: list[T]) -> T:
    return xs[0]

# Python 3.12+：方括号就地声明，IDE 跳转更稳
def first[T](xs: list[T]) -> T:  # T 的作用域只在这个函数里
    return xs[0]

# 类也一样
class Cache[K, V]:
    def __init__(self) -> None:
        self._d: dict[K, V] = {}
    def get(self, k: K) -> V | None:
        return self._d.get(k)
    def set(self, k: K, v: V) -> None:
        self._d[k] = v
```

旧的 `TypeVar` 写法仍然合法，但新代码一律用 PEP 695 语法。少一行 import，少一处忘记声明 covariant 的坑。

### Protocol：结构化「鸭子类型」

LLM 应用经常要支持多家厂商（OpenAI、Anthropic、本地 Ollama），不要写 `if provider == "openai"`，写一个 Protocol：

```python
from typing import Protocol

class ChatBackend(Protocol):
    """任何具备 chat 方法的类，自动被认为符合此协议，无需继承。"""
    async def chat(self, prompt: str) -> str: ...

class OpenAIBackend:
    async def chat(self, prompt: str) -> str:
        # ... 实际调用
        return "from openai"

class OllamaBackend:
    async def chat(self, prompt: str) -> str:
        return "from ollama"

async def run(backend: ChatBackend, q: str) -> str:
    # mypy 会校验传进来的对象有 chat(prompt: str) -> str
    return await backend.chat(q)
```

Protocol 不要求被实现类继承它，这就是 Python 类型系统对「鸭子类型」的合法化。在依赖注入、单测打桩时尤其香——你的 `FakeBackend` 不用 import 业务代码也能通过 mypy。

### TypedDict：给字典上锁

LLM 返回的 JSON 很自然映射到 dict，但 dict 没有类型保护。`TypedDict` 让你给特定结构的字典写出形状：

```python
from typing import TypedDict, NotRequired

class ToolCall(TypedDict):
    id: str
    name: str
    arguments: dict[str, object]
    # NotRequired 表示该键可缺省，比 total=False 更精确
    parallel: NotRequired[bool]

def dispatch(call: ToolCall) -> None:
    print(call["name"])  # mypy 知道返回 str
    # print(call["unknown"])  # mypy 直接报红
```

经验法则：「跨函数边界、跨进程边界、能被序列化的」用 Pydantic 模型；只在内部局部传的用 TypedDict。两者关键差别（运行时校验）见下面「类型与运行时的边界」。

### ParamSpec：写正确的装饰器

```python
from collections.abc import Awaitable, Callable
from typing import ParamSpec, TypeVar
import functools, time

P = ParamSpec("P")
R = TypeVar("R")

def timing(fn: Callable[P, Awaitable[R]]) -> Callable[P, Awaitable[R]]:
    """给任意 async 函数加耗时打点，且保留原签名让调用端类型完整。"""
    @functools.wraps(fn)
    async def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        t0 = time.perf_counter()
        try:
            return await fn(*args, **kwargs)
        finally:
            print(f"{fn.__name__} took {(time.perf_counter() - t0) * 1000:.1f}ms")
    return wrapper

@timing
async def call_llm(prompt: str, *, temperature: float = 0.7) -> str:
    return "ok"
```

如果不用 `ParamSpec`，被装饰函数的参数提示在调用端会直接退化成 `*args, **kwargs`，VS Code 弹不出原参数名。AI 项目里装饰器（重试、限流、追踪）会叠 3–5 层，`ParamSpec` 几乎是刚需。

### 给 askbot 加上类型骨架

```python
# src/askbot/types.py
from pydantic import BaseModel, Field
from typing import Literal

Role = Literal["system", "user", "assistant"]

class Message(BaseModel):
    role: Role
    content: str

class ChatRequest(BaseModel):
    model: str = Field(default="gpt-4o-mini")
    messages: list[Message]
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int | None = Field(default=None, gt=0)

class ChatResponse(BaseModel):
    content: str
    model: str
    usage_prompt_tokens: int
    usage_completion_tokens: int
```

`Role` 是 Literal 类型——传 `"User"`（大写 U）mypy 直接报红。AI API 大量字段是固定枚举，用 Literal 别用 str。

### 类型与运行时的边界

一个常见误区：以为类型注解会在运行时帮你校验。它不会。下面这段代码 mypy 不报错，运行时也不报错：

```python
def add(a: int, b: int) -> int:
    return a + b

add("1", "2")  # mypy 红；但实际跑会返回 "12"，因为 str 也支持 +
```

类型注解是给静态分析器和你看的。要运行时校验，必须用 Pydantic（或 `beartype`、`typeguard` 这类装饰器）。AI 应用的边界全在 Pydantic 模型上，内部代码大多数时候纯类型注解就够了。

---

## 2.3 Pydantic v2：AI 应用的护城河

> **本节核心**：Pydantic 把外部 JSON / dict 自动校验、转换成「有类型保证」的 Python 对象（错了立刻抛），并能反向生成 JSON Schema 描述这个结构。LLM 应用 90% 的「调用工具 / 结构化输出」全靠它，少写一堆 `if "xxx" not in data: raise`。
>
> **JSON Schema 是什么**：一份用 JSON 写的「数据形状说明书」——LLM Function Calling 时就是把这份说明书喂给模型，让它按格式输出。
>
> **「v2」是什么**：Pydantic 2024 年发的大版本，<small>底层用 Rust 重写（pydantic-core），速度比 v1 快 5–50 倍</small>。本书全部用 v2，老教程里 `from pydantic import validator`（v1）这种写法已经过时。

### 为什么 AI 应用离不开它

LLM 的所谓 Function Calling / Tool Use / Structured Output，本质上都是「拿一个 JSON Schema 喂给模型，模型返回符合该 Schema 的 JSON」。Pydantic 干的两件事正好对上：

1. `Model.model_json_schema()` 一行生成 JSON Schema 喂给 LLM。
2. `Model.model_validate(payload)` 把 LLM 返回的字符串/字典变结构化对象，错了立刻抛。

没有它，你得手写 Schema、手写校验、手写错误信息——而 v2 的 Rust 核心让运行时开销几乎为零。

### BaseModel 与 Field：第一层契约

```python
from typing import Literal
from pydantic import BaseModel, Field

class WeatherQuery(BaseModel):
    """Get current weather of a city."""  # docstring 会进 JSON Schema 的 description
    city: str = Field(description="City name in English, e.g. 'Tokyo'")
    unit: Literal["celsius", "fahrenheit"] = Field(default="celsius")

# 喂给 LLM 的 tool definition 直接生成
tool_schema = {
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": WeatherQuery.__doc__,
        "parameters": WeatherQuery.model_json_schema(),
    },
}
```

经验：LLM 对 Schema 的 `description` 字段非常敏感。把每个字段的描述当 prompt 的一部分写，准确率立刻上一个台阶。

### 收 LLM 的 JSON 输出：双向校验

LLM 返回的 JSON 字符串经常不规范——多个空行、注释、markdown 围栏。健壮的解析：

```python
import re
from pydantic import ValidationError

def parse_llm_json(model: type[BaseModel], text: str) -> BaseModel:
    # 1. 剥掉 ```json ... ``` 包裹
    m = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if m:
        text = m.group(1)
    text = text.strip()
    # 2. 让 Pydantic 直接解析（v2.5+ 内部用 jiter，比 stdlib json 解析快、错误信息更细，
    #    但仍要求严格 JSON：trailing comma、单引号 key 不接受，需要先做规整）
    try:
        return model.model_validate_json(text)
    except ValidationError as e:
        # 3. 如果失败，把错误塞回 prompt 让 LLM 自我修正
        raise

# 配合一个「修正」prompt：
# "Your previous output didn't match the schema, errors: {errors}. Please return valid JSON only."
```

这是 instructor、langchain-output-parsers 这些库的核心逻辑——把 ValidationError 转成 prompt 反馈，让 LLM 自我修复。我们后面第 14 章会自己实现一个简版。

### field_validator 与 model_validator

```python
from pydantic import BaseModel, field_validator, model_validator

class RetrievalConfig(BaseModel):
    top_k: int = 5
    min_score: float = 0.0
    rerank_top_k: int = 0

    @field_validator("top_k", "rerank_top_k")
    @classmethod
    def _positive(cls, v: int) -> int:
        # 单字段校验，比类型更严的语义检查放这里
        if v < 0:
            raise ValueError("must be >= 0")
        return v

    @model_validator(mode="after")
    def _rerank_smaller(self) -> "RetrievalConfig":
        # 跨字段校验，必须用 model_validator
        if 0 < self.rerank_top_k > self.top_k:
            raise ValueError("rerank_top_k must be <= top_k")
        return self
```

`mode="after"` 表示在字段都被类型转换之后跑（可以直接用 `self.xxx`）；`mode="before"` 拿到的是原始 dict，适合做归一化（去空格、统一大小写）。新手优先用 after，更直观。

实际项目中常见的 LLM 场景：

```python
class LLMOutput(BaseModel):
    """约束 LLM 必须按这个格式输出。"""
    intent: Literal["search", "summarize", "translate"]
    query: str
    confidence: float = Field(ge=0.0, le=1.0)

    @field_validator("query", mode="before")
    @classmethod
    def _strip(cls, v: object) -> object:
        # LLM 经常会在字符串两端塞引号，先剥一下
        if isinstance(v, str):
            return v.strip().strip('"\'')
        return v

# 使用：LLM 返回的 JSON 字符串
raw = '{"intent": "search", "query": "  pydantic v2 ", "confidence": 0.9}'
out = LLMOutput.model_validate_json(raw)
print(out.query)  # "pydantic v2"，已自动 strip
```

`model_validate_json` 比 `json.loads` + `model_validate` 快，因为 pydantic-core 直接在 Rust 里 parse，省了一次 Python 对象构造。处理大量 LLM 输出时差距明显。

### pydantic-settings：配置即类型

不要再用 `os.environ.get("OPENAI_API_KEY", "")` 散落各处。用 BaseSettings 一次性收口：

```python
# src/askbot/settings.py
from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # 自动从 .env 读，环境变量优先级更高
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="ASKBOT_",  # 避免和系统变量冲突
        extra="ignore",
    )

    openai_api_key: SecretStr  # SecretStr 在 repr 时会被打码
    openai_base_url: str = "https://api.openai.com/v1"
    model: str = "gpt-4o-mini"
    request_timeout: float = 30.0
    max_concurrency: int = Field(default=8, ge=1, le=64)
    log_level: str = "INFO"

# 单例模式：模块加载时校验一次环境，缺啥立刻爆，不拖到第一次调用才发现
settings = Settings()  # type: ignore[call-arg]
```

这样跑 `python -c "from askbot.settings import settings"` 如果 `ASKBOT_OPENAI_API_KEY` 没设，立刻 ValidationError——比线上跑半小时才报错友好得多。

**但注意一个反直觉的副作用**：CLI 工具一定要保证 `askbot --help` 在没设环境变量时也能跑（用户第一次安装就跑 `--help` 的场景太多）。eager 单例会让 `from askbot.cli import app` 触发 `from askbot.client import chat` → `from askbot.settings import settings` → `Settings()` 校验 → 没设 key 直接挂掉，连 `--help` 都看不到。生产做法二选一：

```python
# 选项 A：lazy 单例（推荐）
from functools import lru_cache

@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]

# 调用端用 get_settings().model 而非 settings.model
```

```python
# 选项 B：保留 eager，但在 cli 入口前用 try/except 捕获
# 仅当真正进入命令时才让 ValidationError 抛出
```

askbot 后续代码里出于行文简洁仍用 `settings = Settings()`，**生产项目请改成 lazy 模式**——这点容易在 review 时被忽略。

`.env` 不要提交到 git。新人入职给一份 `.env.example`：

```
ASKBOT_OPENAI_API_KEY=sk-xxx
ASKBOT_MODEL=gpt-4o-mini
```

### 多环境配置：dev / staging / prod

生产代码很少只跑一个环境。pydantic-settings 支持按环境切 .env 文件：

```python
import os
from pydantic_settings import BaseSettings, SettingsConfigDict

env = os.getenv("APP_ENV", "dev")  # 启动时读

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", f".env.{env}"),  # 后者覆盖前者
        env_prefix="ASKBOT_",
        extra="ignore",
    )
    # ...
```

`.env` 放公共默认值（提交到仓库），`.env.dev` `.env.staging` `.env.prod` 放环境特异值（不提交）。线上环境其实大多用 K8s ConfigMap + Secret 注入环境变量，根本不需要 .env 文件，但研发本机仍然有用。

### Secrets 不要进日志

`SecretStr` 在 print 和 repr 时会被打码：

```python
from pydantic import SecretStr
s = SecretStr("sk-very-secret")
print(s)            # SecretStr('**********')
print(s.get_secret_value())  # sk-very-secret，需要时显式取
```

structlog 的 default renderer 会调 repr，所以 `log.info("...", token=settings.openai_api_key)` 不会泄露明文。但你要是写 `log.info("...", token=settings.openai_api_key.get_secret_value())`，就是自己作死。code review 看到 `.get_secret_value()` 出现在日志参数里要立刻拦下。

### 嵌套配置：把相关字段聚合

服务一旦上规模，settings 可能有几十个字段，平铺一团乱。分组：

```python
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict

class LLMConfig(BaseModel):
    model: str = "gpt-4o-mini"
    timeout: float = 30.0
    max_concurrency: int = 8

class RedisConfig(BaseModel):
    url: str = "redis://localhost:6379/0"
    pool_size: int = 10

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="ASKBOT_",
        env_nested_delimiter="__",  # 关键：用 __ 区隔层级
        extra="ignore",
    )
    llm: LLMConfig = LLMConfig()
    redis: RedisConfig = RedisConfig()

# 环境变量这样写：
# ASKBOT_LLM__MODEL=gpt-4o
# ASKBOT_LLM__TIMEOUT=60
# ASKBOT_REDIS__URL=redis://prod:6379/1
```

`env_nested_delimiter="__"` 是 pydantic-settings 的标准做法。CI、K8s、docker-compose 里写起来直观，工程师一眼看懂哪个字段属于哪个组件。

---

## 2.4 异步编程：调 LLM API 的标准姿势

> **一句话先记住**：你的代码要同时调 50 个 LLM API。如果一个一个等，要等 50×3 秒；如果同时发出去等结果，就 3 秒。这就叫「异步」。`async / await` 是 Python 内置语法，本节教你怎么把这件事写对而不死锁。

> **难度提示**：如果你从没写过 `async def`，这一节会比前几节难一档。建议读完「为什么必须 async」「三个易错概念」「async/await 入门 60 秒」三小节先把感觉建立起来；TPM 限流、token bucket 那部分第一遍可以跳过，等你真要做高并发批量请求时再回来。
>
> **async 是什么**：Python 处理「等」的一种方式。普通函数等网络响应时是傻等（这一秒别的事都做不了），`async` 函数等的时候会让出 CPU 给其他任务用，等响应来了再回来。LLM 调用大部分时间在等网络，所以 async 收益巨大。语法上多了 `async def` 和 `await` 两个关键字。

### 为什么必须 async

LLM API 的调用是 IO 密集型——99% 时间在等网络。同步代码一次只能等一个请求；async 代码同样的进程能同时等 50 个。在 RAG、批量评测、多 Agent 并行这些场景里，async 不是优化，是基本功。

Python 3.13 的 free-threading（无 GIL）按 PEP 703 走 Phase I（实验性非默认）；2025 年 6 月 PEP 779 通过后 3.14 进入 Phase II（官方支持仍非默认），距 Phase III 默认构建还有几年。但对 IO 密集场景几乎没收益（GIL 在 IO 时本来就释放），LLM 应用的并发依旧靠 async。

什么时候考虑 free-threading？「CPU 密集 + 多核」的混合负载——本地推理（llama.cpp 绑定）、不走 GPU 的小批量向量计算、PDF/HTML 解析。3.13 单线程开销约 40%，3.14 已缩到 10%。生产建议：在 CI 加 free-threaded 矩阵，观察哪些第三方包不兼容；主要风险是带 C 扩展的包（torch、numpy、cryptography）需要专门 wheel。

### 三个易错概念先讲清

- **协程对象不是任务**：`fetch(1)` 返回的是协程对象，没运行；要 `await fetch(1)` 才执行。`asyncio.gather(fetch(1), fetch(2))` 把它们包装成 task 并发执行。
- **同步函数和协程函数不能混调**：`def foo()` 不能 `await bar()`；想在同步代码里调 async，唯一姿势是 `asyncio.run(bar())`，但只能在程序入口调一次。
- **`asyncio.run` 不可重入**：在 Jupyter 里直接 `asyncio.run(...)` 会报「event loop is already running」。Jupyter 用 `await` 直接顶层调用即可（IPython 7+ 支持）。

### async/await 入门 60 秒

```python
import asyncio

async def fetch(i: int) -> int:
    await asyncio.sleep(1)  # 假装在等 API
    return i

async def main() -> None:
    # gather：同时启动所有任务，全部完成再返回
    results = await asyncio.gather(*(fetch(i) for i in range(5)))
    print(results)  # [0, 1, 2, 3, 4]，总耗时约 1 秒（不是 5 秒）

asyncio.run(main())
```

`asyncio.gather` 之外还有 `asyncio.as_completed`（谁先好谁先返回）和 Python 3.11+ 的 `TaskGroup`（结构化并发，异常更可靠）。生产代码优先 TaskGroup：

```python
async def main() -> None:
    async with asyncio.TaskGroup() as tg:
        # 任意一个抛异常，TaskGroup 会取消其它任务，统一抛出 ExceptionGroup
        tasks = [tg.create_task(fetch(i)) for i in range(5)]
    print([t.result() for t in tasks])
```

### Semaphore 限流：调 LLM 的命

LLM API 都有 RPM（每分钟请求数）和 TPM（每分钟 token 数）双限制。最简单的保护是一个并发上限：

```python
import asyncio
from collections.abc import Awaitable, Callable
from typing import TypeVar

T = TypeVar("T")

class Limiter:
    """并发限流器：保证同一时刻最多 N 个任务在跑。
    
    生产经验值（2026）：OpenAI Tier1 给 10–20，Anthropic 给 20，Gemini 60。
    超过容易触发 429，再加 tenacity 退避。
    """
    def __init__(self, max_concurrency: int) -> None:
        self._sem = asyncio.Semaphore(max_concurrency)

    async def run(self, coro_fn: Callable[[], Awaitable[T]]) -> T:
        async with self._sem:
            return await coro_fn()

async def example() -> None:
    limiter = Limiter(max_concurrency=8)
    prompts = [f"q{i}" for i in range(100)]
    async with asyncio.TaskGroup() as tg:
        # 100 个任务全部排队，最多 8 个同时进 API
        tasks = [tg.create_task(limiter.run(lambda p=p: ask(p))) for p in prompts]
    for t in tasks:
        print(t.result())
```

`lambda p=p:` 用默认参数把当前 p 冻结进 lambda 自己的作用域——直接 `lambda: ask(p)` 由于 Python 闭包延迟绑定，所有 lambda 真正被调用时去查的是 list 循环结束后的最后一个 p 值。这是 async 新手最常踩的坑之一。更直接的写法是把限流逻辑下沉到调用本身，调用端就不再需要 lambda：

```python
sem = asyncio.Semaphore(8)
async def ask_limited(p: str) -> str:
    async with sem:
        return await ask(p)

async with asyncio.TaskGroup() as tg:
    tasks = [tg.create_task(ask_limited(p)) for p in prompts]
```

第二种写法在 askbot 的实际代码里就是这么做的。

### TPM vs RPM：单 Semaphore 不够用

LLM API 通常有两个限制：每分钟请求数（RPM）和每分钟 token 数（TPM）。如果你 10 个 slot 跑 10 个超长 prompt，可能 RPM 还远没满 TPM 已经爆了。完整解法需要 token-aware 限流：

```python
import asyncio
from collections import deque
import time

class TokenBucket:
    """简易令牌桶：按 token 数限流，比单纯 RPM 更准。"""
    def __init__(self, capacity: int, refill_per_sec: float) -> None:
        self.capacity = capacity
        self.tokens = float(capacity)
        self.refill = refill_per_sec
        self.last = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self, n: int) -> None:
        async with self._lock:
            while True:
                now = time.monotonic()
                self.tokens = min(self.capacity, self.tokens + (now - self.last) * self.refill)
                self.last = now
                if self.tokens >= n:
                    self.tokens -= n
                    return
                # 还差多少 token，等多久
                wait = (n - self.tokens) / self.refill
                await asyncio.sleep(wait)

# 用法：OpenAI gpt-4o-mini Tier1 是 200K TPM，约 3333 tokens/sec
tpm_bucket = TokenBucket(capacity=200_000, refill_per_sec=3333)

async def ask_with_tpm(prompt: str, est_tokens: int) -> str:
    await tpm_bucket.acquire(est_tokens)  # 先估算消耗，再上锁
    return await ask(prompt)
```

生产里 token 估算可以用 `tiktoken`（OpenAI）或 `transformers` 的 tokenizer。本章不展开实现，但记住这个问题，第 11 章讲 Tokenizer、第 22 章讲成本控制时会回头处理。

### httpx AsyncClient：唯一推荐的 HTTP 库

```python
import httpx

# 单例 client，进程级别复用连接池。每次新建 client 会重建 TLS、解析 DNS，性能差几个数量级。
_client: httpx.AsyncClient | None = None

def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=5.0),  # 总 30s，建连 5s
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
            http2=True,  # 跨平台开 HTTP/2，对长连接 LLM API 友好
            headers={"User-Agent": "askbot/0.1"},
        )
    return _client

async def call(url: str, payload: dict) -> dict:
    r = await get_client().post(url, json=payload)
    r.raise_for_status()  # 4xx/5xx 抛异常
    return r.json()
```

httpx 的 timeout 有 4 个维度（connect / read / write / pool），不写就是各 5 秒，遇到大模型流式输出很容易被截断。LLM 调用建议 read 至少 60 秒，长上下文模型（128K 输入）建议 read 设到 300 秒。

### requests 党的迁移指南

httpx 的同步 API 和 requests 几乎一模一样（`httpx.get(url).json()` 直接平移）。迁移分两步：第一步把 `import requests` 改 `import httpx`，零成本；第二步把热路径换成 `async with httpx.AsyncClient() as c`。不要一上来就 async 全家桶，循序渐进风险更低。

---

## 2.5 错误处理与重试：tenacity + 幂等

> **一句话先记住**：LLM API 会随机出错——超时、限流、网络抖动。生产代码不能让一次抖动毁掉用户请求。本节教你怎么写「错了自动重试 N 次，连续失败就熔断，过 60 秒再恢复」。

> **本节核心**：调 LLM API 经常会失败（限流、超时、5xx），但失败方式不一样——有些该重试、有些重试只是浪费钱。这一节教你正确区分，并用 `tenacity` 这个库（重试装饰器，一行 `@retry` 给函数加重试逻辑）优雅地实现。
>
> **幂等是什么**：同一个操作做 N 次和做 1 次效果一样，就叫「幂等」。「读数据」天然幂等；「发邮件」「扣钱」不幂等——重试会发两份。重试前必须先确认是不是幂等。

### 重试不是加几个 try

LLM API 失败模式太多了：

- 429（限流，应等待重试）
- 5xx（服务端错，应短退避重试）
- 408 / read timeout（网络抖动，重试）
- 400（请求错，**不**重试，重试只是浪费钱）
- 401（鉴权错，**不**重试）

手写很容易漏一个 case 或者退避策略太激进。tenacity 把这些抽象成装饰器：

```python
import logging
import httpx
from tenacity import (
    retry, stop_after_attempt, wait_exponential_jitter,
    retry_if_exception, before_sleep_log,
)

logger = logging.getLogger(__name__)  # tenacity 的 before_sleep_log 只吃 stdlib logger

def is_retryable(exc: BaseException) -> bool:
    """只重试可恢复错误。这个函数是核心：少了重试不到，多了在烧钱。"""
    if isinstance(exc, httpx.HTTPStatusError):
        # response 在 raise_for_status 后才有，普通 4xx 也走这里
        return exc.response.status_code in {408, 429, 500, 502, 503, 504}
    # 网络层错误（DNS、连接拒绝、读超时）一律可重试
    return isinstance(exc, (httpx.TimeoutException, httpx.NetworkError))

@retry(
    stop=stop_after_attempt(4),                      # 最多 4 次（首次 + 3 次重试）
    wait=wait_exponential_jitter(initial=1, max=20), # 1s, 2s, 4s + 抖动，避免雪崩
    retry=retry_if_exception(is_retryable),          # 注意是 retry_if_exception 不是 _type
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,                                    # 用尽次数后抛出最后一次异常
)
async def call_llm(url: str, payload: dict) -> dict:
    r = await get_client().post(url, json=payload)
    r.raise_for_status()  # 4xx/5xx 抛 HTTPStatusError，由 is_retryable 决定是否重试
    return r.json()
```

`retry_if_exception(is_retryable)` 比 `retry_if_exception_type` 更灵活——它接受一个判定函数，能根据异常的属性（比如 status code）做区分。光看类型是不够的，401 和 429 都是 `HTTPStatusError`，但只有后者该重试。

`wait_exponential_jitter` 的 jitter（抖动）很重要——10 个客户端同时被限流，如果都用确定性退避，10 秒后又会同时打过去。加随机就分散开了。这就是著名的「thundering herd」问题。

### 幂等：重试的前提

重试一个非幂等操作会出大事。「给用户发邮件」这种操作重试就会发两份。做法是：

1. 给每次请求生成一个 `idempotency_key`（UUID），服务端去重。
2. LLM 调用本身是幂等的（你传一样的 prompt，付一样的钱），但你的下游（写库、扣费）必须显式做幂等。

OpenAI / Anthropic API 都支持 `Idempotency-Key` header，重试同一 key 在 24h 内只扣一次费用：

```python
import uuid
headers = {"Idempotency-Key": str(uuid.uuid4())}
# 重试时复用同一个 key，必须由调用方持有
```

### 断路器：上游挂了就别再打

如果 LLM 服务整体宕机，你重试只是雪上加霜。断路器会在连续失败 N 次后「跳闸」，一段时间内所有请求快速失败，给上游恢复时间：

```python
# pip install pybreaker
import pybreaker

# 5 次失败后跳闸，60 秒后半开尝试
llm_breaker = pybreaker.CircuitBreaker(fail_max=5, reset_timeout=60)

@llm_breaker
async def call_llm_protected(url: str, payload: dict) -> dict:
    return await call_llm(url, payload)
```

实战经验：retry + breaker + timeout 三件套缺一不可。Timeout 防单次卡死，retry 处理瞬时错，breaker 处理持续错。三者顺序也有讲究——从外到内应该是 breaker → retry → timeout：breaker 在最外层快速短路，retry 在中间做重试，timeout 在每次实际请求上做兜底。装饰器叠起来就是相反的顺序：

> **生产提醒**：上面这套对一次性 completion 适用，对**流式输出完全不适用**——流式响应中途断开时，前 200 token 已经流到用户屏幕上了，盲目 retry 会从头开始再吐一遍，前端要么显示两段文字、要么需要 client 端 dedupe。生产流式必须：(1) retry 只在拿到第一个 token 之前生效，之后失败就向用户报错；(2) tenacity 的 `before_sleep` 和 asyncio cancellation 互动有坑——`CancelledError` 不能被吞，否则上游 deadline 失效；(3) Idempotency-Key 在 5xx 之外也要带，否则网络抖动重试可能扣两次费；(4) 429 的 retry 一定要看 `Retry-After` header，盲目指数退避在限流场景下会让恢复时间更慢。

```python
@llm_breaker        # 最外层
@retry(...)         # 中间
async def call():   # timeout 在 httpx client 配置里
    ...
```

### 429 不要只看 status code

LLM 厂商的 429 几乎都带一个 `Retry-After`（秒数）或者 `x-ratelimit-reset-tokens` / `x-ratelimit-reset-requests` header，告诉你限流窗口什么时候重置。光用 tenacity 的指数退避在两端都会翻车——退避过短继续撞 429，退避过长浪费 SLA。生产代码必须读 header：

```python
import httpx
from tenacity import wait_base

class WaitFromRetryAfter(wait_base):
    """优先用上游返回的 Retry-After，没有就退化为指数退避。"""
    def __init__(self, fallback: wait_base) -> None:
        self.fallback = fallback

    def __call__(self, retry_state) -> float:
        exc = retry_state.outcome.exception()
        if isinstance(exc, httpx.HTTPStatusError):
            ra = exc.response.headers.get("retry-after")
            if ra:
                try:
                    return float(ra)
                except ValueError:
                    pass  # HTTP date 格式很少见，懒得处理
            # OpenAI 风格的 token 桶 reset 时间
            reset = exc.response.headers.get("x-ratelimit-reset-tokens")
            if reset and reset.endswith("ms"):
                return float(reset[:-2]) / 1000
        return self.fallback(retry_state)
```

把这个 wait 策略接到 `@retry(wait=...)` 里，配合 fallback 是 `wait_exponential_jitter`，就有了「上游说什么我听什么、上游没说我自己估」的健壮组合。

### 多模型降级链：429/5xx 不是世界末日

生产 LLM 客户端通常不止一个上游。一个真实的「降级链」长这样：

```
首选：GPT-5 (高质量、高延迟)
  ↓ 429 / 5xx
备选：GPT-5-mini (中等质量、快)
  ↓ 429 / 5xx
兜底：本地 vLLM Qwen3-72B (永远有容量)
```

简化代码：

```python
from collections.abc import Callable, Awaitable
from typing import TypeVar
import httpx
import structlog

log = structlog.get_logger()  # 2.6 节会统一初始化；这里先占位让示例自洽
T = TypeVar("T")

async def with_fallback(
    primaries: list[Callable[[], Awaitable[T]]],
) -> T:
    """按顺序尝试，前一个挂了就降级到下一个。最后一个挂了直接抛。"""
    last_exc: Exception | None = None
    for fn in primaries:
        try:
            return await fn()
        except (httpx.HTTPStatusError, httpx.NetworkError) as e:
            last_exc = e
            log.warning("llm.fallback", from_=fn.__name__, reason=str(e))
            continue
    assert last_exc is not None
    raise last_exc

# 使用
resp = await with_fallback([
    lambda: call_gpt5(prompt),
    lambda: call_gpt5_mini(prompt),
    lambda: call_local_vllm(prompt),
])
```

进阶：根据**错误类型**决定降级粒度。配额耗尽（429）就切下一个 provider；模型质量需要（5xx）可能要排查；prompt 太长（400）所有 provider 都救不了，直接报错。配合 21 章的 vLLM 自托管做兜底，是生产 LLM 应用最常见的稳定性兜底架构。

### 多 API key 轮换

单个 key 的 RPM/TPM 是死限。一旦业务跑大就要用多 key 池：

```python
import itertools
import httpx

keys_list = [k1, k2, k3]              # 实际从 settings / secret manager 注入
keys = itertools.cycle(keys_list)

async def call_with_key_pool(payload: dict) -> dict:
    for _ in range(len(keys_list)):
        key = next(keys)
        try:
            return await call_llm_with_key(payload, key=key)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                continue  # 这个 key 挂了，换下一个
            raise
    raise RuntimeError("all keys rate-limited")
```

实战里会再加一层「key 健康度评分」——某个 key 连续 429 N 次就降权，过段时间再尝试。本书第 24 章讲 LLMOps 时再展开。

### 错误信息要友好

最后一个容易忽视的点：错误返给用户/上游时，要把内部细节打码。LLM API 4xx 错误常常带着 prompt 片段、internal request id，这些不能直接 echo 出去。

```python
class LLMError(Exception):
    """对外暴露的统一错误，不带敏感字段。"""
    pass

try:
    return await call_llm(...)
except httpx.HTTPStatusError as e:
    log.exception("llm.fail", status=e.response.status_code)
    raise LLMError(f"upstream returned {e.response.status_code}") from e
```

`from e` 保留链路，运维能查到根因；上游业务看到的是 LLMError 这个安全的 surface。

---

## 2.6 日志与可观测：上线第一天就要有

> **一句话先记住**：调一次 LLM 出问题，你需要知道：用户问了什么、模型回了什么、第几次重试失败、花了多少 token。本节教你怎么写一种「机器能查询的 JSON 日志」，而不是 print 大法。

> **本节核心**：上线后出了问题，你只能靠日志找原因。「结构化日志」就是把每条日志写成 JSON 字典而不是字符串，这样可以用工具按字段筛选、聚合、报警——比 `print` 强一百倍。「可观测」泛指日志 + tracing（追踪一次请求经过的所有环节） + metrics（指标），是生产服务的基本盘。
>
> **OTel = OpenTelemetry**：行业标准的可观测协议，所有主流监控平台都支持。这一节最后会讲怎么接，看不懂可以跳到 2.7，等第 24 章再回来。

### loguru vs structlog 怎么选

- **loguru**：脚本、原型、CLI 工具。一行 `from loguru import logger`，开箱有颜色有缩进，开发体验最佳。
- **structlog**：生产服务。强制结构化（每条日志是 dict），跑出来直接进 ELK / Loki / Datadog 不用解析。性能也比 loguru 好 25%。

askbot 是 CLI 但也是工程级范例，我们用 structlog。

### structlog 配置一次终身受益

```python
# src/askbot/log.py
import logging
import sys
import structlog

def setup_logging(level: str = "INFO", json_output: bool = False) -> None:
    """开发环境用彩色控制台；生产容器用 JSON 输出，方便 Loki 抓取。"""
    timestamper = structlog.processors.TimeStamper(fmt="iso")
    
    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,  # 自动注入 request_id 等上下文
        structlog.processors.add_log_level,
        timestamper,
    ]

    if json_output:
        processors = shared_processors + [structlog.processors.JSONRenderer()]
    else:
        processors = shared_processors + [
            structlog.dev.ConsoleRenderer(colors=sys.stderr.isatty()),
        ]

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, level.upper())
        ),
        cache_logger_on_first_use=True,
    )

log = structlog.get_logger()
```

用法：

```python
log.info("llm.request.start", model="gpt-4o-mini", prompt_len=512)
# JSON 输出：
# {"event": "llm.request.start", "model": "gpt-4o-mini", "prompt_len": 512,
#  "level": "info", "timestamp": "2026-05-08T10:00:00Z"}
```

事件名（第一个参数）建议用 `domain.action.phase` 三段式（`llm.request.start` / `llm.request.success`），后面查日志可以按 prefix 过滤。这是从 Stripe 工程博客学来的习惯，特别耐用。

### 几条结构化日志的实操规则

实际写日志时这几个习惯能让排障速度差一倍：

- **不要 f-string**：写 `log.info("user not found", user_id=uid)`，不要 `log.info(f"user {uid} not found")`。前者 user_id 是独立字段可以聚合统计，后者要正则。
- **error 必带原因**：`log.error("db.query.fail", reason="connection_refused", host=host)`，reason 用枚举值，便于 alert。
- **不要 log 全量 prompt**：长 prompt 会撑爆日志存储，也容易把用户隐私 PII 写进去。只 log 长度和摘要哈希。
- **请求级 ID 必有**：每个 LLM 请求一个 `request_id`（UUID，截前 8 位即可），从入口贯穿到底层。下面会演示怎么用 ContextVar 做。
- **错误当一等公民**：`log.exception` 会自动带上完整 traceback，不要 `log.error(str(e))` 把 traceback 丢了。

### 给 LLM 调用埋点

```python
import time
import structlog
from contextvars import ContextVar

request_id_var: ContextVar[str] = ContextVar("request_id", default="")

async def call_llm_observed(url: str, payload: dict) -> dict:
    log = structlog.get_logger().bind(
        request_id=request_id_var.get(),
        model=payload.get("model"),
    )
    t0 = time.perf_counter()
    log.info("llm.request.start", prompt_tokens=len(str(payload)))
    try:
        resp = await call_llm(url, payload)
        log.info(
            "llm.request.success",
            latency_ms=int((time.perf_counter() - t0) * 1000),
            usage=resp.get("usage"),
        )
        return resp
    except Exception as e:
        log.exception("llm.request.fail", error=str(e))
        raise
```

`bind()` 把字段绑到当前 logger 实例，下游每条日志都自带这些字段，不用每次手写 `model=...`。`ContextVar` 让 request_id 在 async 任务中正确传递（task-local），不会因为 `gather` 串台。

### OpenTelemetry 简介：你迟早要接

structlog 解决了「日志可搜索」，但分布式系统还需要「跨服务追踪」。OTel 是事实标准，给所有 LLM 调用打一个 span，能在 Jaeger / Tempo / Datadog 里看到完整调用链：

```python
# pip install opentelemetry-api opentelemetry-sdk opentelemetry-instrumentation-httpx
from opentelemetry import trace
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor

HTTPXClientInstrumentor().instrument()  # 自动给所有 httpx 调用打 span
tracer = trace.get_tracer(__name__)

async def call_llm_traced(url: str, payload: dict) -> dict:
    with tracer.start_as_current_span("llm.chat") as span:
        span.set_attribute("gen_ai.system", "openai")  # 遵循 OTel GenAI 语义约定
        span.set_attribute("gen_ai.request.model", payload["model"])
        resp = await call_llm(url, payload)
        usage = resp.get("usage", {})
        span.set_attribute("gen_ai.usage.input_tokens", usage.get("prompt_tokens", 0))
        span.set_attribute("gen_ai.usage.output_tokens", usage.get("completion_tokens", 0))
        return resp
```

OTel 在 2024–2025 年专门为 GenAI 设了语义约定（`gen_ai.*` 属性），遵循它能直接被各种可观测平台识别、画图。本章不展开，第 24 章 LLMOps「可观测、评估与持续改进」会细讲。

### 把 OTel context 自动注入到 structlog

structlog 的 processor 链可以自动把当前 trace_id / span_id 写进每条日志：

```python
from opentelemetry import trace
import structlog

def add_otel_context(logger, method_name, event_dict):
    span = trace.get_current_span()
    ctx = span.get_span_context()
    if ctx.is_valid:
        event_dict["trace_id"] = format(ctx.trace_id, "032x")
        event_dict["span_id"] = format(ctx.span_id, "016x")
    return event_dict

# 加到 setup_logging 的 shared_processors 里
shared_processors = [
    structlog.contextvars.merge_contextvars,
    add_otel_context,            # <- 新增
    structlog.processors.add_log_level,
    structlog.processors.TimeStamper(fmt="iso"),
]
```

效果：所有日志自动带 trace_id，在 Grafana 里点一条日志就能跳到对应的 trace，跨服务排查瞬间提速。

### 异步 + tenacity + structlog 三件套的并发坑

把这三个组合起来时，有几个反复踩到的细节：

1. **tenacity 的 `before_sleep_log` 只吃 stdlib logger**，所以重试日志默认走 `logging.Logger`，绕过 structlog 的 ContextVar 注入——重试一旦发生，那条「retry attempt 2 in 4s」日志里没有 `request_id`，跨重试关联失败。修法是写一个自定义 `before_sleep` 回调，从 ContextVar 显式取值：
   ```python
   def _before_sleep(rs):
       log.warning("llm.retry",
                   request_id=request_id_var.get(),
                   attempt=rs.attempt_number,
                   sleep=rs.next_action.sleep)
   ```
2. **ContextVar 在 `asyncio.gather` / `TaskGroup` 里是按 task 拷贝的**——主任务里 `request_id_var.set("abc")` 后再 `gather(fetch1(), fetch2())`，两个子任务都看得到 `"abc"`；但子任务内部再 `set("xyz")` 不会污染主任务。这是好事，但容易让人误以为「为什么主任务读不到我子任务设的值」。规则：set 永远只往「当前 task 的 context 副本」里写。
3. **限流 + 重试 + 日志的顺序敏感**。如果你把 `_post`（带重试）放在 `async with sem` 外面，重试期间会持续占着 sem 槽位（其实没占），导致并发计数失真；如果把 sem 放在 `_post` 内部，每次重试都重新 acquire 锁——也不对（重试本来就该串行下去）。askbot 的写法是「sem 在 chat 里、重试在 \_post 里、chat 调 \_post」，sem 包住整个生命周期含重试。这是正确的；但很多新手会把 sem 放进 `_post` 顶部，重试 4 次会把锁释放再争抢 4 次，并发模型瞬间崩溃。
4. **httpx 的连接池 + Semaphore 二者的关系**。Semaphore 是上层任务并发数闸门，httpx 的 `Limits.max_connections=100` 是底层 TCP 连接数上限。两个数不要写成同一个值——sem=8 时连接池配 20 是常见做法（连接池给重试和串行场景留 buffer）。
5. **OTel span 跨重试不丢**。tenacity 重试时整个被装饰函数会被多次调用，每次都进入 `with tracer.start_as_current_span(...)`——你会看到一次逻辑请求在 Jaeger 里有多个 span，但都挂在同一个 parent。如果想把多次重试合并成一个 span，要把 span 创建放在重试装饰器外面，重试内部只 `add_event`。两种风格各有取舍，团队约定即可。

把这五条贴到 review checklist 里，能少一半生产 P0。

---

## 2.7 项目结构：src/ 布局与 monorepo

### 为什么是 src/

```
askbot/
├── pyproject.toml
├── README.md
├── .env.example
├── .gitignore
├── src/
│   └── askbot/              # 真正的包
│       ├── __init__.py
│       ├── __main__.py      # 让 python -m askbot 能跑
│       ├── cli.py
│       ├── client.py
│       ├── log.py
│       ├── settings.py
│       └── types.py
└── tests/
    ├── conftest.py
    └── test_client.py
```

为什么不直接 `askbot/__init__.py` 放根目录？因为根目录在 `sys.path` 里，`pytest` 会在你**没装包**的情况下也能 import 它。听起来像优点，实际上你在测的是一个未打包的状态，发布出去的 wheel 可能根本 import 不了。src/ 布局强制你 `pip install -e .`，测的就是真实状态。

具体的故障场景：在根目录布局下，开发时一切正常，但你忘了把某个新模块写到 `[tool.hatch.build.targets.wheel] packages` 里。本地 import 找得到（因为 sys.path 包含项目根），CI 跑测试也找得到，结果 wheel 装到生产环境一运行就 ImportError。src/ 布局让本地等同于「假装已经装过」，第一时间暴露这种打包缺漏。

### __main__.py 让模块即程序

```python
# src/askbot/__main__.py
from askbot.cli import app

if __name__ == "__main__":
    app()
```

这样 `python -m askbot --help` 可用，`uv run askbot` 也可用。

### Monorepo：什么时候考虑

单体仓库装多个 Python 包的场景：你有一个核心库（`askbot-core`）、一个 CLI（`askbot-cli`）、一个 HTTP 服务（`askbot-server`）。uv workspace 直接支持：

```toml
# 根 pyproject.toml
[tool.uv.workspace]
members = ["packages/*"]

[tool.uv.sources]
askbot-core = { workspace = true }
```

完整的多包工程结构会在后续章节真正搭中台与服务时再回头看。本章保持单包简单。

### 包内分层：什么放哪里

askbot 虽然小，分层依然清晰：

| 文件 | 职责 | 依赖 |
|------|------|------|
| `types.py` | Pydantic 数据模型（领域对象） | 仅 pydantic |
| `settings.py` | 配置 | pydantic-settings |
| `log.py` | 日志初始化 | structlog |
| `client.py` | LLM 调用核心（HTTP + 重试 + 限流 + 埋点） | 上面三者 + httpx + tenacity |
| `cli.py` | 用户接口 | client + typer |
| `__main__.py` | 入口胶水 | cli |

**依赖方向永远是单向的**：cli 可以依赖 client，client 不能反过来依赖 cli。如果 client 里出现 `from askbot.cli import ...`，立刻警觉，多半是滥用了 cli 里的某个 helper，要么把 helper 下沉到 client，要么放到一个新模块 `utils.py`。

这就是经典的「整洁架构」在小项目里的体现。规模再大一点（多个入口：CLI + HTTP server + RPC），就该把 `client.py` 往下拆成 `domain/` `infra/` 两层，但 askbot 这个体量没必要。

### __init__.py 暴露什么

```python
# src/askbot/__init__.py
"""askbot：极简 LLM CLI。

公开 API：
- chat(req) -> ChatResponse
- ChatRequest, ChatResponse, Message
"""
from askbot.cli import main
from askbot.client import chat
from askbot.types import ChatRequest, ChatResponse, Message

__all__ = ["main", "chat", "ChatRequest", "ChatResponse", "Message"]
__version__ = "0.1.0"
```

`__all__` 是给 `from askbot import *` 用的（生产代码不会这么写，但是给 IDE 自动补全和类型检查器看的信号——这是「公开 API」）。任何不在 `__all__` 里的名字，外部依赖它就要做好被随时 break 的心理准备。

---

## 2.8 测试：pytest + asyncio + httpx mock

### 基础设施

`pyproject.toml` 加测试配置：

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"   # 不用每个 async test 都加 @pytest.mark.asyncio
addopts = "-ra --strict-markers --tb=short"
```

`asyncio_mode = "auto"` 在 pytest-asyncio 0.23+ 之后就可用。新手最常见报错「coroutine was never awaited」基本都是没装/没开 pytest-asyncio。

### 测试金字塔：写多少测试

LLM 应用的测试金字塔（从下往上数量递减）：

1. **单元测试（70%）**：纯函数、Pydantic 模型校验、prompt 模板渲染。无网络无文件，毫秒级。
2. **集成测试（25%）**：mock 掉 LLM 后跑完整调用链，包括重试、限流、日志。秒级。
3. **端到端测试（5%）**：真实打 LLM API，用便宜的模型（gpt-4o-mini / Haiku）。CI 上跑「金丝雀」用例集，分钟级。

很多团队跳过第 2 层，直接 1 + 3，结果端到端跑得慢、不稳定。第 2 层用 mock 跑全链路是性价比最高的位置。

### Mock LLM：pytest-httpx 是首选

不要真的去打 OpenAI API 跑测试——慢、烧钱、不确定。pytest-httpx 拦截所有 httpx 请求，返回你预设的响应：

```python
# tests/test_client.py
import pytest
from pytest_httpx import HTTPXMock
from askbot.client import call_llm

@pytest.mark.asyncio
async def test_call_llm_success(httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        url="https://api.openai.com/v1/chat/completions",
        method="POST",
        json={
            "choices": [{"message": {"content": "hi"}}],
            "model": "gpt-4o-mini",
            "usage": {"prompt_tokens": 5, "completion_tokens": 2},
        },
    )
    resp = await call_llm("https://api.openai.com/v1/chat/completions", {"model": "gpt-4o-mini"})
    assert resp["choices"][0]["message"]["content"] == "hi"

@pytest.mark.asyncio
async def test_call_llm_retries_on_429(httpx_mock: HTTPXMock) -> None:
    # 前两次 429，第三次成功——验证重试逻辑
    httpx_mock.add_response(status_code=429, json={"error": "rate limited"})
    httpx_mock.add_response(status_code=429, json={"error": "rate limited"})
    httpx_mock.add_response(status_code=200, json={"ok": True})
    resp = await call_llm("https://api.openai.com/v1/chat/completions", {})
    assert resp == {"ok": True}
```

测重试这一块最容易翻车的地方是 tenacity 的退避把测试拉到 30 秒以上。最稳的解决方式是用 `retry_with` 在测试现场重新生成一个零退避版本：

```python
from tenacity import wait_fixed
fast = _post.retry_with(wait=wait_fixed(0))
await fast(payload)
```

也可以用 `enabled=False` 直接关掉重试只测一次正常路径。生产代码不要污染重试装饰器，测试再去包一层。

### Snapshot 测试：LLM 输出不可重复怎么办

LLM 输出不稳定，断言精确字符串没意义。两种思路：

1. **断言结构而非内容**：用 Pydantic 校验返回符合 Schema，校验关键字段不为空。
2. **断言不变量**：摘要长度 < 原文，翻译结果含目标语言常见字符等。

```python
@pytest.mark.asyncio
async def test_summary_invariants(httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(json={
        "choices": [{"message": {"content": "短摘要"}}],
        "usage": {"prompt_tokens": 100, "completion_tokens": 5},
    })
    summary = await summarize("一段长文章" * 100)
    assert len(summary) < 100  # 摘要必须比原文短
    assert summary.strip()      # 非空
```

正经的 LLM 评测（不变量、LLM-as-judge、人工标注）放第 24 章 LLMOps。本章关心的是「我的代码本身有没有 bug」，mock 完全够。

### Snapshot 测试 syrupy

对于复杂结构的输出（比如 prompt 模板渲染、tool schema 生成），`syrupy` 这个库提供 jest 风格的 snapshot：

```python
# uv add --dev syrupy
def test_tool_schema_snapshot(snapshot):
    schema = WeatherQuery.model_json_schema()
    assert schema == snapshot  # 第一次跑会保存，之后跑会比对
```

第一次运行 `pytest --snapshot-update` 把当前输出固化到 `__snapshots__/` 目录。之后只要 schema 变化测试就红，强迫你 review 变更是否符合预期。Pydantic 升级时这个能救命——v2.10 改过几次默认 schema 输出格式。

### conftest.py：测试公共件

```python
# tests/conftest.py
import pytest
from pydantic_settings import SettingsConfigDict

@pytest.fixture(autouse=True)
def _override_settings(monkeypatch):
    """每个测试都用确定的 fake key，避免读到真实 .env。"""
    monkeypatch.setenv("ASKBOT_OPENAI_API_KEY", "sk-fake-for-test")
    monkeypatch.setenv("ASKBOT_LOG_LEVEL", "WARNING")  # 测试时少噪音

@pytest.fixture
def fake_chat_response():
    """复用率高的测试数据放 fixture。"""
    return {
        "choices": [{"message": {"role": "assistant", "content": "hi"}}],
        "model": "gpt-4o-mini",
        "usage": {"prompt_tokens": 10, "completion_tokens": 1, "total_tokens": 11},
    }
```

`autouse=True` 让这个 fixture 自动应用到所有测试，不用每个测试都加参数。`monkeypatch` 在测试结束后自动恢复环境，不污染其他测试。

### 性能测试不在本章

很多团队把 pytest 当成万能锤。LLM 应用的性能（吞吐、延迟）测试更适合 `locust` 或 `k6`，端到端跑真实负载。本章只覆盖单测和集成测，性能测试见第 21 章模型部署的阶梯压测、第 22 章性能优化与成本控制。

---

## 2.9 把 askbot 拼起来

到这里所有零件都有了，把它们组装成一个能跑的 CLI。

### src/askbot/client.py

```python
import asyncio
import time
import uuid
from contextvars import ContextVar
from typing import Any

import httpx
import structlog
from tenacity import (
    retry, stop_after_attempt, wait_exponential_jitter,
    retry_if_exception, before_sleep_log,
)
import logging

from askbot.settings import settings
from askbot.types import ChatRequest, ChatResponse

log = structlog.get_logger()
request_id_var: ContextVar[str] = ContextVar("request_id", default="")

# 进程级别复用 client（连接池、HTTP/2 连接复用）
_client: httpx.AsyncClient | None = None
# 全局并发闸门
_sem: asyncio.Semaphore | None = None

def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            base_url=settings.openai_base_url,
            timeout=httpx.Timeout(settings.request_timeout, connect=5.0),
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
            headers={
                "Authorization": f"Bearer {settings.openai_api_key.get_secret_value()}",
                "User-Agent": "askbot/0.1",
            },
            http2=True,
        )
    return _client

def _get_sem() -> asyncio.Semaphore:
    global _sem
    if _sem is None:
        _sem = asyncio.Semaphore(settings.max_concurrency)
    return _sem

def _is_retryable(exc: BaseException) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code in {408, 429, 500, 502, 503, 504}
    return isinstance(exc, (httpx.TimeoutException, httpx.NetworkError))

@retry(
    stop=stop_after_attempt(4),
    wait=wait_exponential_jitter(initial=1, max=20),
    retry=retry_if_exception(_is_retryable),
    before_sleep=before_sleep_log(logging.getLogger("askbot"), logging.WARNING),
    reraise=True,
)
async def _post(payload: dict[str, Any]) -> dict[str, Any]:
    """带重试的底层 POST。所有重试策略集中在这里，业务函数只管语义。"""
    r = await _get_client().post("/chat/completions", json=payload)
    r.raise_for_status()
    return r.json()

async def chat(req: ChatRequest) -> ChatResponse:
    rid = str(uuid.uuid4())[:8]
    request_id_var.set(rid)
    blog = log.bind(request_id=rid, model=req.model)
    
    async with _get_sem():  # 限流，超过 max_concurrency 自动排队
        t0 = time.perf_counter()
        blog.info("llm.request.start", n_messages=len(req.messages))
        try:
            raw = await _post(req.model_dump(exclude_none=True))
            choice = raw["choices"][0]["message"]
            usage = raw.get("usage", {})
            resp = ChatResponse(
                content=choice["content"],
                model=raw["model"],
                usage_prompt_tokens=usage.get("prompt_tokens", 0),
                usage_completion_tokens=usage.get("completion_tokens", 0),
            )
            blog.info(
                "llm.request.success",
                latency_ms=int((time.perf_counter() - t0) * 1000),
                in_tokens=resp.usage_prompt_tokens,
                out_tokens=resp.usage_completion_tokens,
            )
            return resp
        except httpx.HTTPStatusError as e:
            blog.error("llm.request.fail",
                       status=e.response.status_code, body=e.response.text[:200])
            raise

async def aclose() -> None:
    """进程退出前关连接池。CLI 短命可以省，长进程必须。"""
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
```

### src/askbot/cli.py

```python
import asyncio
import typer

from askbot.client import chat, aclose
from askbot.log import setup_logging
from askbot.settings import settings
from askbot.types import ChatRequest, Message

app = typer.Typer(help="askbot — minimal LLM CLI", no_args_is_help=True)

@app.command()
def ask(
    prompt: str = typer.Argument(..., help="The question."),
    system: str = typer.Option("You are a concise assistant.", help="System prompt."),
    model: str | None = typer.Option(None, help=f"Override default ({settings.model})."),
    json_log: bool = typer.Option(False, "--json-log", help="JSON log output."),
) -> None:
    """问 LLM 一个问题，stdout 输出回答。"""
    setup_logging(level=settings.log_level, json_output=json_log)
    
    async def _run() -> None:
        try:
            resp = await chat(ChatRequest(
                model=model or settings.model,
                messages=[
                    Message(role="system", content=system),
                    Message(role="user", content=prompt),
                ],
            ))
            typer.echo(resp.content)
        finally:
            await aclose()
    
    asyncio.run(_run())

@app.command()
def batch(
    file: typer.FileText = typer.Argument(..., help="Each line is a prompt."),
    json_log: bool = typer.Option(False, "--json-log"),
) -> None:
    """从文件读多行，每行作为一个 prompt 并发问。演示限流 + gather。"""
    setup_logging(level=settings.log_level, json_output=json_log)
    prompts = [line.strip() for line in file if line.strip()]
    
    async def _run() -> None:
        try:
            async with asyncio.TaskGroup() as tg:
                tasks = [
                    tg.create_task(chat(ChatRequest(
                        model=settings.model,
                        messages=[Message(role="user", content=p)],
                    )))
                    for p in prompts
                ]
            for p, t in zip(prompts, tasks, strict=True):
                typer.echo(f"Q: {p}")
                typer.echo(f"A: {t.result().content}\n")
        finally:
            await aclose()
    
    asyncio.run(_run())

def main() -> None:
    app()
```

### src/askbot/__init__.py

和 2.7 节的版本一致，对外暴露 main + 主要数据模型 + chat 函数：

```python
from askbot.cli import main
from askbot.client import chat
from askbot.types import ChatRequest, ChatResponse, Message

__all__ = ["main", "chat", "ChatRequest", "ChatResponse", "Message"]
__version__ = "0.1.0"
```

### 这段代码踩过的坑（why 注释）

为什么连接池和 semaphore 都用全局变量懒加载？因为 module 顶层执行时 settings 还没读环境变量校验完成。如果你写 `_client = httpx.AsyncClient(...)` 在 module 顶层，导入这个模块的人哪怕只想 `from askbot.client import ChatRequest`，也会触发 client 创建。懒加载让代价只在真正调用时付。

为什么 `_post` 和 `chat` 分两层？职责分离：`_post` 只管「带重试的发包」，`chat` 管「构造请求 + 限流 + 埋点 + 解包」。这样测 `_post` 时只测重试逻辑，测 `chat` 时只测业务逻辑。如果合在一起，测试 fixture 会写得很臃肿。

为什么 `aclose()` 是显式的？asyncio.run 退出时虽然会清理 task，但 httpx 的 keep-alive 连接需要主动关闭，否则 stderr 会飘一行 `unclosed connector` 警告——CLI 用户看到这个会困惑。生产服务一般用 FastAPI 的 lifespan event 关连接池。

为什么 `model_dump(exclude_none=True)`？OpenAI API 对很多字段「不传」和「传 null」语义不同。`max_tokens=None` 显式传 null 可能被解释为「最少」，传 `exclude_none` 跳过它，让服务端用默认值。这是 Pydantic 序列化要小心的地方。

### 跑起来

```bash
# 装当前项目（editable，改代码立刻生效）
uv sync

# 设置 key
export ASKBOT_OPENAI_API_KEY=sk-xxx

# 单次问
uv run askbot ask "Explain Pydantic v2 in one sentence."

# 批量
echo -e "What is uv?\nWhat is ruff?\nWhat is pydantic?" > qs.txt
uv run askbot batch qs.txt --json-log
```

### 跑测试

```bash
uv run pytest                    # 跑全部
uv run pytest -k chat            # 只跑名字含 chat 的
uv run pytest --cov=askbot       # 覆盖率（需要 pytest-cov）
uv run pytest -x                 # 第一个失败立刻停
```

新项目第一周就把 coverage 阈值定到 70% 以上写进 CI，越往后补越累。LLM 应用可能很多代码是 prompt 模板/数据处理，覆盖率到 80%+ 完全不难。

### debug 时的小工具

```python
# 临时用，绝不进生产代码
import asyncio

async def main() -> None:
    asyncio.get_running_loop().set_debug(True)   # 打印慢任务、未 await 的协程
    # ... 业务

asyncio.run(main())
```

更省事的姿势是直接环境变量 `PYTHONASYNCIODEBUG=1`，`asyncio.run` 会自动开 debug。最常见用途：找出谁在 async 里偷偷调阻塞 IO，会被警告 `Executing took x seconds`。注意 Python 3.12+ 已废弃在线程外调用 `get_event_loop()`，所以早期教程里那种顶层 `asyncio.get_event_loop().set_debug(True)` 写法在新版本会 DeprecationWarning。

---

## 2.10 打包与分发

### 构建 wheel

```bash
uv build
# 产出 dist/askbot-0.1.0-py3-none-any.whl 和 .tar.gz
# 装到别的环境验证
uv pip install dist/askbot-0.1.0-py3-none-any.whl
askbot ask "hi"
```

发到 PyPI（需要先 `uv publish --token ...` 或配置 token）：

```bash
uv publish
```

### Docker：多阶段 + uv

为什么多阶段？因为构建环境需要编译器、缓存、源码，运行环境只需要 Python 解释器和 wheel。两者分离能把镜像从 1.5 GB 砍到 200 MB 以下。

```dockerfile
# syntax=docker/dockerfile:1.7

# ---- Builder ----
FROM python:3.13-slim AS builder

# uv 官方镜像直接提供二进制，pin 版本保证可复现（写本书时是 0.11.x，按需更新）
COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /uvx /bin/

# 这两个变量是官方推荐：编译为 .pyc，避免运行时 IO；用 copy 而非 hardlink，跨 layer 安全
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app

# 第一层：先装依赖（不含项目代码）。pyproject.toml + uv.lock 不变就命中缓存
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev

# 第二层：再拷源码 + 装项目本身
COPY src ./src
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-editable

# ---- Runtime ----
FROM python:3.13-slim AS runtime

# 非 root 用户：被 RCE 时少一层风险
RUN useradd -r -u 10001 -m appuser

# 只拷贝构建好的 venv，不带源码、不带 uv 二进制
COPY --from=builder --chown=appuser:appuser /app/.venv /app/.venv

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

USER appuser
WORKDIR /app

ENTRYPOINT ["askbot"]
CMD ["--help"]
```

构建：

```bash
docker build -t askbot:0.1.0 .
docker images askbot   # 期望 < 250 MB
docker run --rm -e ASKBOT_OPENAI_API_KEY=sk-xxx askbot:0.1.0 ask "hi"
```

### .dockerignore（不写会很惨）

```
.venv
.git
__pycache__
*.pyc
.pytest_cache
.mypy_cache
.ruff_cache
dist
.env
```

不加这个文件，Docker 会把 `.venv`（几百 MB）也送进 build context，构建慢到怀疑人生，还可能把 `.env` 里的密钥打进镜像。

### 镜像瘦身的几个常见骗局

不要用 alpine。`python:3.13-alpine` 看似 50 MB 很诱人，但 alpine 用 musl libc 不是 glibc，pydantic、numpy、pyarrow 这些有 C 扩展的包要么没预编译 wheel、要么要重新编译十几分钟。slim 用的是 Debian glibc，wheel 兼容率 99%，是 2026 年的事实标准。

不要 `RUN pip install --upgrade pip`。slim 已经带了较新的 pip，且我们用 uv 安装，根本不走 pip。多一步 RUN 多一层 layer。

不要把 model 权重塞镜像。GB 级文件用启动时下载 + 持久卷（K8s PVC / docker volume），镜像本身只装代码。否则镜像体积爆炸，CI 推拉慢半小时起。

### 这个 Dockerfile 在 CI 里能直接跑吗

不能直接抄进 CI 就完。两个隐藏前提，文档不写 CI 一定会翻车：

1. **BuildKit 必须开**。`# syntax=docker/dockerfile:1.7` directive 与 `RUN --mount=type=cache,...` 都依赖 BuildKit。
   - **GitHub Actions**：用 `docker/build-push-action@v5` 默认就是 buildx，OK。
   - **GitLab CI**：默认 `docker:dind` runner 不开 BuildKit，需要在 job env 里 `DOCKER_BUILDKIT: "1"`，或者切到 buildx executor / kaniko。
   - **本机 Docker Desktop / Docker 23+**：默认 BuildKit，OK。
   忘了开的症状：构建失败报「unknown flag: --mount」或者直接忽略 `# syntax`。
2. **builder 与 runtime 的 Python 版本必须严格一致**。venv 里 `bin/python` 是个软链接指向构建时的 `/usr/local/bin/python3.13`；如果 runtime 换成 `python:3.12-slim`，运行时 venv 直接坏，`askbot --help` 报 `bad interpreter`。两个 stage 都钉到 `python:3.13-slim`，并通过参数复用：
   ```dockerfile
   ARG PY_VERSION=3.13
   FROM python:${PY_VERSION}-slim AS builder
   # ...
   FROM python:${PY_VERSION}-slim AS runtime
   ```
   这样 `docker build --build-arg PY_VERSION=3.14` 一处改全镜像跟随。

3. **uv 镜像 tag 要 pin 到具体 patch 版本**。`ghcr.io/astral-sh/uv:0.11` 是滚动 tag，半年后 `0.11.x` 内部行为变了你的镜像就跟着变。生产请写 `:0.11.5`，跟随项目升级时一并 review。

### 镜像扫描

CI 里加一步 trivy 扫描，及时发现 base image 的 CVE：

```bash
# 在 GitHub Actions / GitLab CI 里
trivy image --severity HIGH,CRITICAL askbot:0.1.0
```

`python:3.13-slim` 的 Debian base 大概每月 1-2 个 CVE 出现，定期 rebuild 是必需的。生产团队通常做法：每周自动重建一次基础镜像 + 重新部署。

---

## 2.11 pre-commit：让坏代码出不了门

```yaml
# .pre-commit-config.yaml
# rev 写当前最新稳定版即可，pre-commit autoupdate 会自动同步
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.15.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v2.0.0
    hooks:
      - id: mypy
        additional_dependencies:
          - pydantic>=2.9
          - types-requests
        args: [--strict]
```

```bash
uv tool install pre-commit
pre-commit install
```

之后每次 `git commit` 自动跑 ruff + mypy，不通过就拦下来。新人 onboarding 第一天就配，后面省一万次「忘了 format」的 review 评论。

### CI 里也跑一遍

pre-commit 是本地保护，但有的人会 `git commit --no-verify` 绕过。CI 里再跑一遍：

```yaml
# .github/workflows/ci.yml
name: ci
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
        with:
          enable-cache: true
      - run: uv sync --frozen
      - run: uv run ruff check .
      - run: uv run ruff format --check .
      - run: uv run mypy src
      - run: uv run pytest
```

`astral-sh/setup-uv@v3` 是官方 action，自带 cache，CI 跑 `uv sync` 一般 5–10 秒。比 pip 缓存快一个数量级。

---

## 2.12 章节小结与下一步

### 这章核心收获（你现在应该会的）

读完本章并把 askbot 跟着敲一遍，你应该能：

1. 用 `uv init` 起一个新项目、用 `uv add` 装依赖、看懂 `pyproject.toml` 里 `[project]` `[dependency-groups]` `[tool.ruff]` `[tool.mypy]` 各管什么。
2. 知道 `ruff check` 和 `mypy --strict` 在干嘛、怎么把它们配进项目、出红线时怎么修。
3. 用 Pydantic 写一个数据模型类，从外部 JSON 反序列化为有类型保证的对象、生成 JSON Schema 喂给 LLM。
4. 看到 `async def`、`await`、`asyncio.gather`、`TaskGroup`、`Semaphore` 不再发懵；至少能照着 askbot 的代码写一个并发调 LLM 的小脚本。
5. 用 `@retry` 装饰器给一个 LLM 调用加退避重试，并且知道哪些错误不该重试（401、400）。
6. 用 structlog 写出每条带 `request_id` 的结构化日志，CI 上跑 `pytest` + `pytest-httpx mock` 替换掉真实网络请求。
7. 写一个多阶段 Dockerfile，最终镜像 < 250 MB；会配 pre-commit + GitHub Actions CI。

如果上面 7 条里有 3 条以上你看完仍然没把握，**不要着急往后翻**——回到对应小节把 askbot 那段代码自己敲一遍，跑通比读懂更重要。本章每一节后面给的命令都能直接 copy 跑。

### 读不下去怎么办

- **不知道哪些可以跳**：翻回章节速览下面的「本章三档读法」——必读 6 节先走通，选读 / 进阶用到再回来。
- **被术语劝退**：回到章首的「术语速查」，每次卡住就回去看一眼那张表。
- **代码看不懂**：照着敲，跑起来。看代码不如跑代码。Python 工具链最大的好处是「报错信息能直接 Google」。
- **类型系统/装饰器晕了**：跳过 2.2 后半段（PEP 695、ParamSpec），先把 askbot 跑通；这部分等你做项目卡了再回头。
- **Pydantic 一上来一堆概念**：先抓住「`Model.model_validate(payload)` 把脏 JSON 变干净对象、`Model.model_json_schema()` 反向生成 Schema 喂 LLM」这两句话，其它都是细节。
- **async 完全没感觉**：去廖雪峰或 Real Python 找一篇 `asyncio` 入门通读一遍再回来，本章不是 async 教学。
- **Docker 没装过**：先去看官方 Get Started（<https://docs.docker.com/get-started/>），10 分钟够用，2.10 节可以放到那之后再读。

往下走，第 03 章会补一层"看模型不再发怵"的数学直觉：cosine similarity 在 RAG 里到底测的是什么、softmax/温度采样在调什么、KL 散度为什么是 RLHF 的命门、AdamW 那几个超参各自管什么。代码全部跑得起来，最后用不到 50 行从零写一个 self-attention 收尾。askbot 这条主线会在第 14 章 Prompt 工程化、第 15 章 LangChain/LlamaIndex 实战回来——目前它只是一个套了壳子的 HTTP 客户端，有了工程地基才方便长肉。

### 一些没展开但值得知道的事

- **uv tool install**：装命令行工具到全局，不污染当前项目（替代 `pipx`）。
- **rye / hatch**：另外两个 PEP 621 系工具，活跃度不及 uv，但 hatch 作为 build backend 很常见。
- **mypy 替代品**：pyright（微软，编辑器内更快）、ty（Astral 自家，2026 处于 beta、用 0.0.x 版本号、目标年内 1.0）、pyrefly（Meta）。新项目可以观望，老项目老老实实 mypy。
- **logfire**：Pydantic 出的可观测平台，结合 structlog + OTel，本章不展开，第 24 章 LLMOps 会聊。
- **anyio**：跨 asyncio / trio 的统一接口，FastAPI、httpx 内部都在用。如果你想写一个能在多种 event loop 上跑的库，研究一下；自己写应用通常直接 asyncio 就行。
- **rich**：终端漂亮输出（表格、进度条、Markdown 渲染）。askbot 的输出本章故意保持原始 print，后续做交互式 CLI / 流式 token 渲染时会引入 rich。
- **uvloop**：用 libuv 替换 asyncio 默认 selector，吞吐 +30%。FastAPI/uvicorn 默认开。CLI 短命进程没必要。
- **freezegun / time-machine**：测试里冻结时间。涉及超时、缓存 TTL 的代码必备。
- **hypothesis**：基于属性的测试（property-based testing）。Pydantic 模型的边界测试可以让 hypothesis 自动生成奇怪输入，发现你想不到的 bug。

### 一份「不要这么做」清单

最后留几条踩过坑的禁忌，新人最常翻车：

1. **`async def` 里调阻塞 IO**。`requests.get(...)`、`open(...).read()` 这些会卡死整个事件循环。改成 httpx + aiofiles，或者实在不行 `await asyncio.to_thread(...)`。
2. **全局可变状态当配置**。`MODEL = "gpt-4o"` 写在模块顶层，测试里改不了。改用 settings 对象 + 依赖注入。
3. **裸 except**。`except Exception:` 没记日志没重抛，bug 直接吞了。要么 `except Exception as e: log.exception(...); raise`，要么干脆写具体异常。
4. **mypy 局部 `# type: ignore`**。带个理由：`# type: ignore[no-untyped-call]  # third-party lib without stubs`。半年后回头看你会感谢自己。
5. **测试依赖网络**。任何测试需要 OPENAI_API_KEY 才能跑，CI 立刻翻车。所有外部 IO 必须 mock。
6. **打印日志靠 `print`**。生产容器 stdout 是结构化采集的，print 没有 level、没有时间戳，下游解析不了。
7. **Dockerfile 里 `RUN pip install`**。一行 pip 一层 layer，慢且大。统一用 uv sync + cache mount。
8. **uv.lock 不进 git**。lock 不进版本控制等于没锁，CI 装出来的版本和本地不一致，复现 bug 要哭。`requirements.txt` 时代有些团队习惯不锁，到 uv 时代必须锁。
9. **测试里跑真实 LLM**。一次 PR 跑 100 个测试、每个 0.5 美元——加起来一个月烧几千刀。测试只跑 mock，端到端用 nightly job 限流跑。

### 给自己留的练习

学完本章建议自己动手：

1. **加一个 `--stream` 选项**：让 askbot 支持流式输出。需要改 client.py 用 `httpx.AsyncClient.stream()`，CLI 端逐 token 打印。
2. **加一个 `embed` 子命令**：调 OpenAI Embeddings API，打印向量维度和前 10 个值。复习 Pydantic 模型嵌套。
3. **写一份 GitHub Actions**：在 PR 上跑 ruff + mypy + pytest，main 分支跑 docker build 并 push 到 GHCR。
4. **配置 logfire 或 Grafana Tempo**：把 OTel trace 导出去，看一次 chat 的完整调用链。

把这些做完，第 02 章的内容就吃透了。

工程地基铺到这儿就算齐了：uv 管依赖、ruff/mypy 卡风格与类型、Pydantic 卡边界、async + tenacity 顶住 IO 与抖动、structlog 留 trace、pytest + Docker 收尾交付。地基之上，要写出能调对模型、能解释 loss、能调采样的人，少不了一层数学直觉——下一章不是要把你训成数学家，而是补够"看到 cosine 知道在测什么、看到 softmax 知道温度在调什么、看到 KL 知道 RLHF 的 reference 在约束谁"的程度。线代、微积分、概率、信息论、优化、几何、采样七块，每节配可跑代码，末尾从零写一个 self-attention 把概念串起来。数学焦虑型读者只读速记盒和代码块也能过关。下一章见。

---

## 参考资料

- [uv vs pip vs Poetry: Which Python Package Manager Wins in 2026?](https://www.danilchenko.dev/posts/uv-vs-pip-vs-poetry/)
- [Best Python Package Managers in 2026](https://scopir.com/posts/best-python-package-managers-2026/)
- [Python Dependency Management in 2026 - Cuttlesoft](https://cuttlesoft.com/blog/2026/01/27/python-dependency-management-in-2026/)
- [Python support for free threading — Python 3.14 docs](https://docs.python.org/3/howto/free-threading-python.html)
- [Python Free-Threading Guide](https://py-free-threading.github.io/)
- [Python GIL vs No-GIL: FastAPI benchmarks](https://medium.com/@kevaldekivadiya2415/python-gil-vs-no-gil-real-fastapi-benchmarks-with-free-threaded-python-3-13-b5751f8d57a2)
- [Ruff: A Complete Guide to Python's Fastest Linter and Formatter](https://pydevtools.com/handbook/explanation/ruff-complete-guide/)
- [Ruff documentation](https://docs.astral.sh/ruff/)
- [Pydantic v2 documentation](https://docs.pydantic.dev/latest/)
- [Pydantic JSON Schema concepts](https://docs.pydantic.dev/latest/concepts/json_schema/)
- [PEP 695 – Type Parameter Syntax](https://peps.python.org/pep-0695/)
- [HTTPX documentation](https://www.python-httpx.org/)
- [Tenacity async support](https://tenacity.readthedocs.io/en/latest/api.html#asyncio)
- [PyBreaker — circuit breaker for Python](https://github.com/danielfm/pybreaker)
- [structlog documentation](https://www.structlog.org/en/stable/)
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- [Using uv in Docker — official guide](https://docs.astral.sh/uv/guides/integration/docker/)
- [Optimal Dockerfile for Python with uv — Depot](https://depot.dev/docs/container-builds/how-to-guides/optimal-dockerfiles/python-uv-dockerfile)
- [pytest-asyncio docs](https://pytest-asyncio.readthedocs.io/)
- [pytest-httpx docs](https://github.com/Colin-b/pytest_httpx)
- [Limit concurrency with semaphore in Python asyncio — Redowan](https://rednafi.com/python/limit-concurrency-with-semaphore/)
- [Building Resilient AI Systems with Circuit Breakers](https://markaicode.com/circuit-breaker-resilient-ai-systems/)
- [Production-Ready FastAPI Project Structure (2026 Guide)](https://dev.to/thesius_code_7a136ae718b7/production-ready-fastapi-project-structure-2026-guide-b1g)
