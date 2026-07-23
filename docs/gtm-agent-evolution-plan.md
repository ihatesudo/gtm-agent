# GTM Agent 演进计划：从 Query-Response 到 Campaign Orchestrator

## 现状诊断

### 架构全景

```
skills/ (47 playbooks) ─┐
roles/ (7 YAML roles) ──┤
tools/ (100+ guides) ───┤
                         ├── CLI: Python + LangGraph create_react_agent
                         │       marketing_agent/agent.py → build_agent() → create_react_agent()
                         │
                         └── Web: TypeScript + 自写 ReAct loop → OpenRouter API
                                 workers/backend/src/agent.ts → runAgent() → callLLM()
```

核心问题：**两套独立的 agent 实现，都是 stateless query-response 架构。**

### 具体症状

#### CLI（marketing_agent/__main__.py）

每轮对话：

```python
def run_once(user_input, ...):
    agent = build_agent(...)          # ← 每次重建编译图
    asyncio.run(_stream_run(agent, user_input, ...))

# _stream_run 内部：
{"messages": [HumanMessage(content=user_input)]}  # ← 只传当前消息
```

- 无 `messages` 列表跨轮累积
- `build_agent()` 每次都被调用（`create_react_agent` 重新编译）
- 无 session id，无 checkpointer

#### Web（workers/backend/src/agent.ts）

```typescript
export async function* runAgent(message, params, env) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message },       // ← 每次 GC，从头开始
  ];
  // ... tool loop ...
}
```

- 比 CLI 更严重：连单次调用的历史都不跨轮
- 自写 ReAct loop（非 LangGraph），15 轮 tool call 上限硬编码
- WebSocket handler 只存了 `role/skill/language` 三个变量，无任何消息历史

#### 共同表现

以你的例子为例：

```
用户: show me how you promote organise Hermes skills for red note
Agent: 什么是 Red Note？（不认小红书）
用户: 小红书
Agent: 目标是什么？（追问，没利用已澄清的信息）
用户: 3
Agent: 你好！有什么可以帮助你的吗？（完全重置，零上下文）
```

每一行对话都是全新会话。Agent 不知道前面说了什么，不知道"red note"已经被澄清为小红书，不知道用户选的是哪个选项。

---

### 根因：架构目标错位

| 当前在做 | 应该在做 |
|---------|---------|
| Query-Response 引擎 | Campaign Orchestrator |
| 单次输入 → 单次回答 | 业务目标 → 多步计划 → 执行 → 跟踪 |
| 无状态 | Session 级状态 |
| 手动切角色 | Director 自动委派 |
| 每 session 忘记一切 | 跨 session 记住项目 |

README Future Plan 里写的三个"近期目标"：
- **"A Director that actually delegates"**
- **"Project memory"**
- **"Real platform execution"**

这三个恰好就是 GTM Agent 和普通 chatbot 的分界线。但目前架构一个都没开始做。

---

## 成熟方案：LangGraph 原生能力

LangGraph 已经在依赖里。它有所有你需要的拼图，只是没用上：

| 能力 | LangGraph 原生方案 | 实现成本 |
|------|-------------------|---------|
| 跨轮对话 | `checkpointer` (MemorySaver / SqliteSaver) | ~3 行参数 |
| 计划状态跟踪 | `StateGraph` + 自定义 state schema | ~100 行新代码 |
| Director 委派 | `SubGraph`（角色子图） | 框架一级支持 |
| 跨 session 记忆 | `BaseStore`（SQLite / Postgres） | 内置抽象 |

**不需要 CrewAI、AutoGen、Semantic Kernel 等额外框架。** LangGraph 本身就是那个成熟方案。

### Checkpointer 原理

```python
from langgraph.checkpoint.memory import MemorySaver

checkpointer = MemorySaver()
agent = create_react_agent(
    model=model,
    tools=tools,
    prompt=prompt,
    checkpointer=checkpointer,  # ← 这行就够了
)

# 第一次调用
await agent.ainvoke(
    {"messages": [HumanMessage("hello")]},
    config={"configurable": {"thread_id": "session-1"}}
)

# 第二次调用——agent 自动记得之前的消息
await agent.ainvoke(
    {"messages": [HumanMessage("我刚才说了什么？")]},
    config={"configurable": {"thread_id": "session-1"}}  # ← 同一个 thread_id
)
# → "你说了 hello"
```

LangGraph 的 checkpointer 在每次 `invoke` 后自动保存 `messages` 列表。下次同 `thread_id` 调用时自动恢复。

---

## 关键架构决策

你当前是两套 agent 实现（Python + TypeScript）。这是最大的技术债。

### 选项 A：统一到 Python/LangGraph（推荐）

```
当前:
  CLI → Python LangGraph
  Web → TypeScript 自写 ReAct

建议:
  CLI ─┐
        ├─→ Python LangGraph (checkpointer + StateGraph + store)
  Web ──┘   
         ↑
  Cloudflare Worker（薄层：WebSocket + auth + proxy）
```

- 所有 agent 逻辑统一在 Python
- Web 后端的 `agent.ts` 去掉自写 ReAct，改为调 Python agent
- Worker 只负责：WebSocket 管理、会话元数据转发、静态资源托管
- 改动 web 前端不影响 agent 能力

### 选项 B：LangGraph 双语言实现

- CLI: Python LangGraph
- Web: LangGraph.js (npm `@langchain/langgraph`)
- 共享同样的 state schema + 设计模式
- 各自独立部署

选项 A 对当前代码改动更小（不需要重写 web agent），也符合 README 里已经规划的 Render 部署路径。

---

## 分阶段实施计划

### Phase 0 — Checkpointer：修复多轮对话（1-2 天）

**目标**：CLI 能做到跨轮记住上下文，Web 能做到 WebSocket 生命周期内记住。

**CLI 改动**（`marketing_agent/agent.py` + `__main__.py`）：

1. `agent.py` `build_agent()` 加 `checkpointer=MemorySaver()`
2. `__main__.py` `repl()` 缓存 agent 实例（配置不变不重建）
3. 每个 REPL session 生成 `thread_id`，后续所有调用复用

**Web 改动**（`workers/backend/src/agent.ts` + `index.ts`）：

4. `runAgent()` 改为接收外部 `messages` 数组参数，不再内部新建
5. `index.ts` WebSocket handler 在 closure 里持有 `messages` 数组
6. 每次 user message 追加到 `messages`，传给 `runAgent()`

**结果验证**：

```
> show me how to promote Hermes skills for red note
Agent: 您说的是小红书（Red Note / 小红书）...我来设计一个推广方案
> 3
Agent: 好的，我们选择方案3，开始执行第一步...
```

不再有"Red Note 是什么？""目标是什么？""你好"式的断片。

---

### Phase 1 — StateGraph + 计划管理（1 周）

**目标**：Agent 能对复杂 GTM 目标进行多步规划并跟踪进度。

**改动**：

1. 从 `create_react_agent` 升级到 `StateGraph`，自定义 state：

```python
class GTMState(TypedDict):
    messages: Annotated[list, add_messages]  # 对话历史
    plan: list[str]                          # 当前战役计划步骤
    current_step: int                        # 当前执行到哪一步
    completed_steps: list[str]               # 已完成步骤
    project_context: dict                    # 产品/ICP/品牌信息
```

2. 新增 Director 规划节点：

```
用户输入 → should_plan?(gate) → 是 → plan_node(生成多步计划)
                               → 否 → execute_node(直接回答/执行)

plan_node 输出计划后 → 等待用户确认 → execute_node
execute_node 完成后 → 检查 plan 是否完成 → 未完成 → 执行下一步
                                        → 完成 → summarize
```

3. Agent 可以看到 `current_step`，知道自己在计划中的位置

**结果**：

```
用户: 我的 SaaS 要做北美冷启动，给我 90 天获客计划
Agent: 好的，我计划分 3 个阶段：

Phase 1 (Day 1-30): 市场调研 + SEO 基础建设
Phase 2 (Day 31-60): 付费投放启动 + 内容营销
Phase 3 (Day 61-90): 邮件序列 + 销售赋能

先从 Phase 1 开始？第一周要做的是竞品关键词分析和技术 SEO 审计。
```

---

### Phase 2 — Director 委派 SubGraph（2 周）

**目标**：Director 自动识别需要哪个专家，派活，收结果，缝合。

**改动**：

1. 每个角色（seo, social-ads, lifecycle 等）包装为 `StateGraph` subgraph
2. 每个 subgraph 有自己独立的 system prompt（角色 persona）
3. Director graph 根据 `plan` 当前步骤路由到对应 subgraph
4. Subgraph 执行结果写回父 state

```
Director Graph
├── plan_node: 分解任务
├── route_node: 判断当前步骤 → 哪个角色
│   ├── → SEO SubGraph (关键词研究)
│   ├── → Social SubGraph (创意策略)
│   └── → Email SubGraph (邮件序列)
├── stitch_node: 整合各专家产出
└── → 回到 route_node 或完成
```

**结果**：Director 不再需要手动 `/role seo` 切换。

---

### Phase 3 — 跨 Session 项目记忆（1 周）

**目标**：Agent 记住产品名、ICP、品牌调性、过往战役，新 session 不用重新解释。

**改动**：

1. 用 LangGraph `BaseStore` 或 SQLite 做持久化
2. 定义记忆 schema：

```python
class ProjectMemory(BaseModel):
    project_id: str
    product_name: str
    icp_description: str
    brand_voice: str
    past_campaigns: list[dict] = []
    created_at: datetime
    updated_at: datetime
```

3. Session 启动时自动加载匹配的 `ProjectMemory` 到 `project_context`
4. 新增 `save_context` / `load_context` 工具

**结果**：

```
Session 1:
用户: 我们做 AI 笔记应用，叫 MemoMind，目标用户是知识工作者

Session 2 (明天):
用户: 帮我写新品发布文案
Agent: 好的，MemoMind 的 AI 笔记应用，面向知识工作者。
上次我们确定了产品定位是"第二大脑"。这次发布的目标是什么？
```

---

### Phase 4 — Web 后端统一（1-2 周）

**目标**：Web 和 CLI 共享同一个 agent 引擎。

**改动**：

1. Python 端加一个轻量 HTTP API（FastAPI 或 `asyncio` server）
2. 端点：`POST /agent` → 接受 `{message, session_id, role, skill}` → stream 返回
3. Cloudflare Worker `agent.ts` 去掉自写 ReAct，改为 SSE 或 WebSocket 代理到 Python
4. Worker 只负责：登录、WebSocket 管理、静态资源

```
Browser → Cloudflare Worker (auth + WS proxy)
              ↓
          Render/Python (FastAPI + LangGraph agent)
              ↓
          OpenRouter/Gemini
```

---

## 实施建议

| 阶段 | 工期 | 优先级 | 是否阻塞后续 |
|------|------|--------|-------------|
| Phase 0: Checkpointer | 1-2 天 | P0 | 是，所有后续依赖 |
| Phase 1: StateGraph + 计划 | 1 周 | P1 | 否，可与 P0 并行设计 |
| Phase 2: Director 委派 | 2 周 | P2 | 依赖 P1 |
| Phase 3: 项目记忆 | 1 周 | P2 | 可与 P2 并行 |
| Phase 4: Web 统一 | 1-2 周 | P3 | 依赖 P0-P3 |

**建议顺序**：
1. 先做 Phase 0（今晚可验收）
2. 然后做架构决策：统一引擎（选项 A）还是双实现（选项 B）
3. 决策后做 Phase 1 + Phase 3（可并行）
4. 再做 Phase 2（最复杂）
5. 最后 Phase 4（非紧急）

---

## 附录：LangGraph 文档参考

- [LangGraph Checkpointer](https://langchain-ai.github.io/langgraph/concepts/persistence/)
- [LangGraph State Schema](https://langchain-ai.github.io/langgraph/concepts/state/)
- [LangGraph Subgraphs](https://langchain-ai.github.io/langgraph/concepts/subgraphs/)
- [LangGraph Store (Memory)](https://langchain-ai.github.io/langgraph/concepts/memory/)
- [Plan-and-Execute Pattern](https://langchain-ai.github.io/langgraph/tutorials/plan-and-execute/)
