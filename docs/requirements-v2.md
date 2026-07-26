# GTM Agent v2 — 需求指令与执行纲领 (Requirements & Execution Charter)

> 本文件为用户原始指令的固化存档（save 到 docs），后续每一部分「先规划再做」都以此为纲领。
> 开发顺序遵循 **MVP ROI**：先修 Bug 与直接提升 UX 可用性/专业感的事项，用 **TDD** 推进，步步为营不猜测。
> **改动范围限定：只改 `mastra/` 目录下的文件。**

---

## 0. 角色与工作方式 (Working Agreement)

- **大局优先**：每一部分先规划（写计划/TODO），再落地。从 MVP ROI 出发排序，优先 Bug 和「用户关心的 UX 可用性、专业感」。
- **TDD 驱动**：使用项目 TDD skill 推进；先写测试再写实现，绿后再重构。
- **不猜测**：遇到不确定的事实先调查（读代码、查依赖 dist、查 API），再下结论。
- **只改 `mastra/`**：根目录的 Python / 其他目录本次不动。
- **只读 dist / node_modules**：绝不修改生成或第三方文件（见 AGENTS.md）。

---

## 1. 原始指令（逐条）

### 1.1 产品能力目标
1. **多轮对话**：已基于 Mastra Memory + LibSQL/Turso 实现；需补「历史持久化」的测试覆盖。
2. **FAQ 知识库检索**：新增能力，让 Agent 能命中常见营销/GTM 问答（RAG / 关键词检索）。
3. **自动识别用户意图**：当前为 Director prompt 涌现式路由。需要更稳定、可观测的意图识别与模型选择。
4. **模型选择固化（OpenRouter）**：
   - **不能只用 `openrouter/auto`**（这是付费路由 alias，会路由到付费模型，并非 free）。
   - 需**固化**到当前 free 模型中、社区使用量 top3、稳定的若干个（带 `:free` 后缀，具备 tools 能力）。
   - 「只看当下 free」：以 OpenRouter `/v1/models` 实时查询结果为准。
5. **对话历史持久化 + 测试**：前端 localStorage + 后端 Mastra Memory(Turso) 都需有测试守护。
6. **管理后台**：可查看对话记录与用户满意度（CSAT），新增只读视图即可。

### 1.2 UX 改进（专业感 / 可用性）
7. **Dropdown 升级**：当前是原生 `<select>`，过于简陋。参考国内 chat 组件（豆包/Kimi/通义），每个 item **hover 显示详情**（模型描述、上下文长度、特点）。Agent / Model / Thinking 三个下拉都要升级。
8. **Tab 键焦点流转**：支持 `Tab` 逐个聚焦控件（textarea → send button → 各 dropdown），符合可访问性。

### 1.3 Bug
9. **Textarea 高度受限 Bug**：开启对话后，`ChatView` 的 textarea 高度反而被限制（`maxHeight:150` 内联 + JS 裁到 140，且 `flex:1` 干扰）。参考主页 `WelcomeView` 的修复方式（按 children height 自适应，`minHeight/maxHeight` 一致），统一自适应逻辑。

### 1.4 调查
10. **Mastra Studio / Playground 开源状态**：调查其是否开源、license，以判断是否可参考其 dist 中的 JS（注意 minified、只读）。

### 1.5 调试基础设施（为 Agent 自纠错）
11. **录屏 / 截图**：能对运行中的 Web 应用截图（必要时录屏），便于发现/复现 UI 问题。
12. **Server log 输出到 console**：把 mastra dev 的服务端日志打到 console，方便 Agent 查看、纠错。
   - 参考：项目 `mastra/ui/scripts/integration-test.mjs` 已有「spawn dev server + 转发 stderr」的做法；外部 `webapp-testing` skill 提供 Playwright 截图方案。

---

## 2. 现状速查 (Baseline — from code exploration)

- **引擎**：Mastra (TS)，Director + 5 Specialists，Cloudflare Worker 部署，LibSQL/Turso 存储，R2 资产。
- **模型解析**：`mastra/src/mastra/model.ts`
  - `resolveModelForChoice('openrouter')` → `openrouter/auto`（**问题点：非 free**）。
  - 动态回退：有 GCP SA → Vertex（消耗 trial credits），否则 OpenRouter。
- **意图**：无独立分类器，靠 Director system prompt 中的工具表 + 黑名单（见 `agents/director.ts`，已有回归测试 `src/__tests__/agents.test.ts`）。
- **UI**：`ui/src/`，`ChatView.tsx`(930 行) 为核心；`WelcomeView.tsx` 的 textarea 自适应是参考正确实现（`autoResize` + `minHeight 64 / maxHeight 200`）。
- **持久化**：`App.tsx` localStorage（threads / msgs）；后端 Mastra Memory。
- **测试**：vitest；`agents.test.ts`（agent 配置回归）、`ChatView.test.tsx`（渲染/Markdown）。

### 2.1 当前 OpenRouter free 模型（2026-07-26 实时 `/v1/models`，共 15 个 `:free`）

带 tools 能力、上下文较大、相对稳定的候选（按上线时间倒序）：

| model id | name | context | tools |
|---|---|---|---|
| `nvidia/nemotron-3-ultra-550b-a55b:free` | Nemotron 3 Ultra | 1,000,000 | ✓ |
| `google/gemma-4-31b-it:free` | Gemma 4 31B | 262,144 | ✓ |
| `google/gemma-4-26b-a4b-it:free` | Gemma 4 26B A4B | 262,144 | ✓ |
| `nvidia/nemotron-3-super-120b-a12b:free` | Nemotron 3 Super | 262,144 | ✓ |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | Nemotron 3 Nano Omni | 256,000 | ✓ |
| `openai/gpt-oss-20b:free` | gpt-oss-20b | 131,072 | ✓ |
| `cohere/north-mini-code:free` | North Mini Code | 256,000 | ✓ |

> 「社区使用量 top3」需结合 OpenRouter 排行榜；将选定 3 个并固化到 `resolveModelForChoice`（每个 UI 选项映射到**具体 free 模型 id**，而非 `auto`）。

### 2.2 Mastra Studio 开源调查（初步）
- Mastra 框架本体：MIT License（`github.com/mastra-ai/mastra`）。
- `mastra dev` 启动的 Studio / Playground 为本地开发仪表盘（可视化 agents/workflows）。
- **注意**：dist 下 JS 多为压缩/minified，**只读参考**，不可修改（见 AGENTS.md）。

---

## 3. MVP ROI 排序（执行顺序）

> 原则：Bug 先行 → 高频可见 UX → 后端能力 → 管理后台。每一步都用 TDD，绿了再进下一步。

| # | 事项 | 类型 | ROI 理由 | 涉及文件（mastra/） |
|---|---|---|---|---|
| **P0-1** | Textarea 高度 Bug 修复 | Bug | 每次对话都踩，体验直接劣化 | `ui/src/components/ChatView.tsx` |
| **P0-2** | 调试基建：dev server log→console + 截图流程 | Infra | 解锁后续所有 UI 自纠错 | 新脚本 + 复用 webapp-testing |
| **P1-1** | OpenRouter 模型固化（替换 `openrouter/auto`） | 后端/模型 | 免费 + 稳定是可用性前提 | `src/mastra/model.ts` |
| **P1-2** | Dropdown 升级（hover 详情 + Tab 焦点流转） | UX/专业感 | 国内 chat 体验标配，可见度高 | `ui/src/components/ChatView.tsx`（+WelcomeView 复用） |
| **P2-1** | 对话历史持久化测试 | 测试守护 | 防止回归（localStorage + Turso） | `ui/src/__tests__/`, `src/__tests__/` |
| **P2-2** | 意图识别可观测化（日志 + 可选 classifier） | 后端 | 提升路由稳定性 | `src/mastra/agents/`, middleware |
| **P2-3** | FAQ 知识库检索（轻量 RAG / 关键词） | 后端能力 | 直接增强回答价值 | `src/mastra/tools/` + 数据源 |
| **P3-1** | 管理后台（对话记录 + 满意度只读视图） | 运营 | MVP 可只读即可 | 新 API route + UI 路由 |

---

## 4. 变更记录 (Changelog)

- 2026-07-26：建文件，固化用户 v2 指令，确立 TDD + MVP ROI 执行顺序。
- 2026-07-26 **P0-2 Done** 调试基建：`mastra/scripts/snap.mjs`（headless Chromium 截图 + 镜像 browser console / page error 到 stdout，自动定位 mastra/.debug 下的 playwright）。dev server 日志写到 `/tmp/mastra-dev.log`。
- 2026-07-26 **P0-1 Done** Textarea 高度 Bug 修复（TDD）：
  - 根因：`ChatView.tsx` 的 textarea 设了 `flex: 1`（→`1 1 0%`）+ 内联 `maxHeight:150` + JS 裁到 140；flex 让容器把元素压到内容之下，10 行时实测渲染高 31px。
  - 修复：对齐 `WelcomeView` —— 移除 `flex`，改 `width:100% + minHeight:48/maxHeight:200`，`autoResize()` 由 `scrollHeight` 驱动上限 200，发送后置 `height='auto'`。
  - 测试：`ChatView.test.tsx` 新增 4 条「textarea auto-resize」契约测试（red→green），全套 UI 6 files / 后端 58 tests 全绿；浏览器实测 chat-10 31px→200px。
- 2026-07-26 **P1-1 Done** OpenRouter 模型固化（TDD）：
  - 根因：`resolveModelForChoice('openrouter')` 与 `getAgentModel` 回退都用 `openrouter/auto`，而 `openrouter/auto` 是**付费**路由 alias（会路由到付费模型，烧 credits）；`.env`/`.env.example` 也默认 `openrouter/auto`。
  - 修复（`mastra/src/mastra/model.ts`）：新增 `OPENROUTER_FREE_MODELS`（3 个具体 `:free` slug：`nvidia/nemotron-3-ultra-550b-a55b:free` / `nvidia/nemotron-3-super-120b-a12b:free` / `google/gemma-4-31b-it:free`）+ `resolveOpenRouterModelId()`（强制 `:free`，非 free 的 `OPENROUTER_MODEL` 覆盖直接 throw）。UI `openrouter` 选项与回退路径均改用具体 free 模型。
  - 配置：`.env` / `.env.example` 的 `OPENROUTER_MODEL` 改为 `nvidia/nemotron-3-ultra-550b-a55b:free`。
  - 测试：`model.test.ts` 新增 4 条「OpenRouter free-model pinning」测试（red→green），后端 62 tests 全绿；实机 `/api/agents/director/stream` 流式返回 `modelId: nvidia/nemotron-3-ultra-550b-a55b:free`。
- 2026-07-26 **P1-2 Done** Dropdown 升级 + Tab 焦点流转（TDD）：
  - 新增可复用 `mastra/ui/src/components/Dropdown.tsx`：自定义 Popover（按钮触发 + 浮层 listbox），每个 item **hover 显示详情卡**（模型：上下文/特点/free|paid 标签；Agent：职责意图；Thinking：含义），完整键盘支持（Enter/Space/↓ 开、↑↓ 移动、Enter 选、Esc 关、Tab 自然流转）。打开后焦点自动移到 listbox；保留原生 focus ring（移除 `outline:none`）保证键盘可见性。
  - 新增 `selectorMetadata.ts`：MODEL/THINKING/AGENT 三类下拉的 label + detail（模型含 free 标签与能力描述，标注「openrouter = Nemotron Ultra（free 默认）」）。
  - `ChatView.tsx` + `WelcomeView.tsx`：3 个原生 `<select>` 全部替换为 `<Dropdown>`，两视图一致。
  - Tab 焦点：DOM 顺序 textarea → Agent → Model → Thinking → Send（Send 启用态下），新增 Tab 顺序测试；旧测试更新为新契约。
  - 测试：`Dropdown.test.tsx` 新增 9 条组件契约测试（red→green，含键盘）；`ChatView`/`WelcomeView` 替换为新 trigger 契约 + Tab 顺序测试。全套 UI **7 files / 101 tests 全绿**；浏览器实测两视图下拉 hover 详情卡渲染正常，无 pageerror。
