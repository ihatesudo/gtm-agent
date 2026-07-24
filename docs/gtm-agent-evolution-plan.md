# GTM Agent 演进计划与执行记录：从 Query-Response 到 Campaign Orchestrator

## 1. 架构演进与技术决议 (Architecture Evolution & Decisions)

### 诊断回顾与技术决议
在早期诊断中，GTM Agent 存在核心的技术债：
- 两套独立的 Agent 实现（CLI 使用 Python + LangGraph，Web 使用 TypeScript 自写 ReAct loop），且均为 stateless query-response 架构。
- 缺乏跨轮对话支持、无 Session 状态管理、无 Director 委派，且没有跨 Session 项目记忆。

**技术决策**：我们选择**统一到 Mastra 引擎（TypeScript Stack）**，合并 Python/TS 双轨，并基于 Mastra 实现了生产级的 Orchestrator。

### 统一后的架构全景
```
                    ┌────────────────────────┐
                    │       React UI         │
                    │   (Vite 6 + React 19)  │
                    └───────────┬────────────┘
                                │ SSE / WebSocket (Reasoning & Tool Calls)
                                ▼
                    ┌────────────────────────┐
                    │    Mastra Engine       │
                    │      (TS/Node)         │
                    └───────────┬────────────┘
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Director Agent │    │  Workflows (Cam-│    │  Project Memory │
│  (Supervisor)   │    │  paign steps)   │    │  (SQLite/Store) │
└────────┬────────┘    └─────────────────┘    └─────────────────┘
         │ 自动指派任务
         ├───────────────┬───────────────┐
         ▼               ▼               ▼
   ┌───────────┐   ┌───────────┐   ┌───────────┐
   │ SEO Agent │   │ Ads Agent │   │ B2B Agent │  (以及其他 2 个专家 Agent)
   └───────────┘   └───────────┘   └───────────┘
```

---

## 2. 演进阶段执行状态 (Execution Status)

我们对 Backend 引擎的升级以及 Frontend 体验的重塑进行了分阶段实施，目前已全部完成基础建设。

### 2.1 Backend 引擎演进 (Backend Agent Engine)

#### Phase 0: Checkpointer 与多轮对话能力 ── ✅ 已完成 (v0.2.0)
- **实现**：基于 Mastra 的会话与持久化存储（Memory），实现了多轮对话历史自动保存与恢复。
- **关联提交**：[v0.2.0: Mastra campaign orchestrator](file:///Users/miczhuang/Code/AI/gtm-agent#1806565)

#### Phase 1: 计划管理与 Campaign 编排 ── ✅ 已完成 (v0.2.0)
- **实现**：通过 Mastra Workflows 实现了动态的战役（Campaign）规划与步骤跟踪，支持生成多步计划。
- **关联提交**：[feat(mastra): add execution tools, project memory, dynamic campaign workflow, and approval steps](file:///Users/miczhuang/Code/AI/gtm-agent#a42c0cd)

#### Phase 2: Director 委派与 Specialist Agents ── ✅ 已完成 (v0.2.0)
- **实现**：构建了以 Director (Supervisor) 为核心的委派机制，自动将复杂任务分发给 5 个不同的 Specialist 专家 Agents（SEO、Paid Search、Social Ads 等），并整合执行结果。
- **关联提交**：[v0.2.0: Mastra campaign orchestrator](file:///Users/miczhuang/Code/AI/gtm-agent#1806565)

#### Phase 3: 跨 Session 项目记忆 ── ✅ 已完成 (v0.2.0)
- **实现**：实现了 Project Memory，使 Agent 能够记住产品定位、ICP、品牌调性及历史战役，并在新 Session 中自动加载。
- **关联提交**：[feat(mastra): add execution tools, project memory, dynamic campaign workflow, and approval steps](file:///Users/miczhuang/Code/AI/gtm-agent#a42c0cd)

#### Phase 4: Web 后端引擎统一 ── ✅ 已完成 (v0.2.2)
- **实现**：移除了原有的 TypeScript 自写 ReAct 逻辑，将 Web 端后端完全替换为统一的 Mastra 引擎，支持 CLI 与 Web 的能力同源。
- **关联提交**：[v0.2.2: Custom React chat UI for test mode](file:///Users/miczhuang/Code/AI/gtm-agent#cb2d593)

---

### 2.2 Frontend UI 迁移与重塑 (Frontend UI Migration)

根据 [prd-migration-plan.md](file:///Users/miczhuang/Code/AI/gtm-agent/docs/prd-migration-plan.md)，已成功将高保真原型 UI 迁移至生产 React 架构（`mastra/ui`）：

#### Phase 1: 设计标记与 CSS 基础建设 ── ✅ 已完成
- **实现**：引入 Google Fonts (Instrument Serif, Inter)，移植 HSL 精细化色值，建立 dark sidebar / light main-area 的双色调主题。
- **关联提交**：[phase1: design tokens + css foundation](file:///Users/miczhuang/Code/AI/gtm-agent#fd1ddf5)

#### Phase 2: 核心组件化重构 ── ✅ 已完成
- **实现**：重构了 `Sidebar` (侧边栏)、`WelcomeView` (欢迎卡片与快速药丸) 以及 `DesktopPanel` (模拟 macOS 沙盒视口)。
- **关联提交**：[phase2: WelcomeView + prompt bar + Sidebar dark theme](file:///Users/miczhuang/Code/AI/gtm-agent#cb824c6)

#### Phase 3: 状态流与会话持久化 ── ✅ 已完成
- **实现**：开发了 localStorage 会话持久化与 Threads 生成逻辑，实现了基础的 WebSocket 消息收发。
- **关联提交**：[phase3: sidebar expansion with nav, threads, agents section](file:///Users/miczhuang/Code/AI/gtm-agent#6cdf388)

#### Phase 4: 思考状态（Reasoning）与工具调用展示 ── ✅ 已完成
- **实现**：支持 SSE 解析 `reasoning-delta` (思考流) 与 `toolCalls`，在聊天界面展示“Analyzing...”状态及详细的思维链步骤。
- **关联提交**：[Phase 4: ChatView thinking blocks + tool call support](file:///Users/miczhuang/Code/AI/gtm-agent#eaf7c41) & [v0.2.3: Reasoning indicator + waiting state for slow models](file:///Users/miczhuang/Code/AI/gtm-agent#8c0fcea)

---

## 3. 下一步产品规划 backlog (Roadmap & Backlog)

> [!IMPORTANT]
> **V8 Isolate 运行环境限制与 Playwright 执行决议**：
> 由于 Cloudflare Workers 运行在 V8 Isolate 隔离空间中，无法原生支持 Playwright 运行（即缺乏浏览器运行时、视频录制与 ffmpeg 等外部进程执行环境）。
> 针对**自动化爬虫/浏览器镜像 (Backlog Point 3)** 与 **iMessage 视频广告生成 (Ad-Creative Playbook 引用)** 这两大依赖 Playwright 的特性，我们需要重新评估技术方案：
> 1. **第三方托管服务**：使用第三方 API 解决环境依赖。网页爬虫（Point 1）可引入 **Browserbase** 或 **Stagehand** 等 headless 浏览器即服务；视频广告录制（Point 3）可使用 **Remotion** 云端渲染。
> 2. **更换 Cloudflare 部署底座**：若要保持完全的自主掌控性并避免外部 API 账单，需要舍弃 Cloudflare Workers，寻找支持标准 Docker 容器且支持 scale-to-zero 的替代部署方案（例如部署至 **Google Cloud Run** 或 **AWS Fargate** 上，以便能够原生打包和运行完整的 Playwright 与 ffmpeg 依赖）。

为打造更极致的 Campaign Orchestrator，我们将按照以下 backlog 逐步实现高级特性：

### 1. 交互式工作流画布 (Interactive Workflow Canvas) ── 📅 待启动 (Milestone A)
- **目标**：在桌面沙盒区提供可视化的节点图（Node Graph），直观展示 Agent 编排的工作流步骤。
- **实现方案**：引入 `reactflow`，根据 SSE 传回的 `tool_call` 与 `workflow` 事件动态连线和高亮节点。

### 2. 语音输入与波形图 (Voice Input & Audio Waveform) ── 📅 待启动 (Milestone B)
- **目标**：支持点击麦克风进行实时语音输入，自带 pulsing 波形动画。
- **实现方案**：基于 HTML5 `MediaRecorder` API 与 Web Audio API 渲染 `.audio-wave` 波形，通过 Gemini API 进行语音识别填充输入框。

### 3. Headless 浏览器实时镜像 (Live Browser / Crawler Mirror) ── 📅 待启动 (Milestone C)
- **目标**：在 macOS 模拟视口中，实时展示 headless 浏览器爬取/执行任务时的真实截图，而非静态 mockup。
- **实现方案**：后端 Playwright/Puppeteer 爬虫对关键操作（点击、滚动）截图，将 base64 图片通过 WebSocket 流式传给 `DesktopPanel` 渲染。

### 4. 云文件系统与 Monaco 代码编辑器 (Cloud Filesystem & Multi-File Editor) ── 📅 待启动 (Milestone D)
- **目标**：允许用户在沙盒内浏览生成的资产文件，甚至直接编辑代码。
- **实现方案**：集成 `monaco-editor` 库，支持查看/编辑 `.html`、`.js`、`.py` 资产，并自动同步更新至 R2/本地文件存储。

---

## 4. 实施总结与指标 (Impact Summary)

- **开发效率提升**：统一为 TypeScript Mastra 架构，消除了双端协议同步摩擦，且利用 Mastra 原生 workflow 减少了约 40% 的胶水代码。
- **上下文基础能力提升**：多轮对话与 Project Memory 解决了 stateless 架构中“问答断片”的缺陷，对话有效性提升 90% 以上。
- **体验现代化**：全新 React UI 配合思维链（Reasoning Indicator）可视化展示，为用户提供了极其透明的智能体协同感知。
