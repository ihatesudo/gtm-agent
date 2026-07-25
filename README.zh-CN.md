# Marketing Agent（营销 Agent）

[English](README.md) · **简体中文**

> **一个不把所有事都做得半吊子的 AI——它跑的是一整支营销团队。**

[**→ 60 秒快速开始**](#快速开始) · [**→ Mastra 营销引擎**](#mastra-活动编排引擎) · [**→ 看真实产出**](#看真实产出) · [**→ 浏览 150+ 集成**](#接入你的工具栈) · [**→ 认识团队**](#团队成员)

大多数营销 AI 都是一个"通才"：问它 SEO，还行；问它投广告，还行；让它写新品发布邮件，也……还行。结果就是每个渠道都浅尝辄止。

这个项目押注另一种思路。它不是一个人生扛所有活，而是把自己组织成**一支真正的营销团队**：一位负责统筹的 Growth Lead（增长负责人），加上六位专家——搜索、社交、SEO、B2B、生命周期等等——每位都有自己的口吻、直觉、打法手册和工具箱。你跟它对话，就像给代理公司下 brief：说清目标，对的人就会接手。

它面向创始人、营销人和增长团队——想要随时调用的专家级思考（策略、文案、投放、SEO、生命周期流程），又不想付七份工资，也不想在聊天框里来回复制粘贴。

> **别再跟聊天机器人对需求了。开始指挥一支团队。** ↓

---

## 为什么要做成"团队"的形状

一支有战斗力的营销团队，成功从来不是因为某个人在所有事上都天才。它成功是因为工作被**切成了若干领域**，每个领域都由一个专门钻研它的人负责。而"一个 prompt 干所有事"的工具，恰恰缺了这种分工。

所以这个 agent 把分工做得很显式：

- 你有一位 **Director（总监）**，思考预算、渠道和全局。
- 你有**专家**可以切入，需要深度时随时切换——SEO 的人想的是抓取预算和搜索意图；搜索投放的人想的是 ROAS 和否定词；生命周期的人想的是流失曲线和 LTV。
- 产出读起来像是一个真正干这行的人写的，而不是一团文字糊糊。

回报是：回答具体、有立场，最后落到一个明确的下一步，而不是"看情况"。

---

## 能力矩阵

| | 能力 | 实际意味着什么 |
|---|---|---|
| 🎯 | **7 个专家角色** | Director + 搜索投放、社交效果广告、SEO、B2B/LinkedIn、生命周期与留存、Growth Lead。每个都有独立人设、专长与直觉。 |
| 📚 | **47 个技能手册** | 深度、可分步执行的专长——文案、广告、SEO 审计、ABM、流失预防、传奇营销人顾问团等等。 |
| 🧰 | **100+ 平台集成** | 真实营销人用的工具（Google Ads、GA4、Klaviyo、HubSpot、Apollo、Ahrefs……）的参考指南，按需加载。 |
| 🧠 | **分层提示** | Director 基底 → 当前角色 → 当前技能。可以把一个专家和一个手册组合起来，做深度聚焦的执行。 |
| 💾 | **产出落盘** | 最终文案、策略、关键词表存成 `output/` 里的文件——不会在聊天滚动里丢失。 |
| 🔍 | **有据可查，不瞎编** | 实时信息（价格、竞品动态、关键词热度）先搜索再下结论。 |
| 🇨🇳 | **中文优先** | 说你的语言；专业、具体、直击要点。 |
| 🔌 | **自带模型** | OpenRouter（默认）、Vertex AI、Gemini API，或任何 LLM 提供商——随你选。 |
| ⚙️ | **双运行时，同一大脑** | [Python CLI](#快速开始) 适合终端用户 + [Mastra 引擎](#mastra-活动编排引擎) 适合活动流程编排。共享同一套角色、技能和工具集成。 |
| 🧩 | **多轮对话** | Mastra 引擎支持持久聊天会话，带对话历史记忆。 |
| 🏗️ | **活动工作流** | Mastra 引擎执行结构化三步流程：策略 → 执行 → 复盘。 |
| 👔 | **主管委派** | Mastra 引擎的 Director 自动将任务分派给对应专家。 |
| 🧠 | **跨会话记忆** | Mastra 引擎跨会话记住你的产品、ICP、品牌口吻和过往活动。 |

---

## 接入你的工具栈

这就是大多数"营销 AI"止步于文案的地方。**但这个项目带了一整套真实工具箱：**
**64 个即用 CLI** + **90+ 集成指南**，覆盖真实营销人在用的 150+ 平台——
Google Ads、Klaviyo、GA4、Ahrefs、HubSpot、Apollo 等等。
Agent 按需读取使用指南，在你的 API key 加持下还能直接驱动工具本身。
没有厂商锁定，没有围墙花园。

> 💡 **下面列的一切今天就在仓库里**——`tools/clis/` 是零依赖的即用脚本，`tools/integrations/` 是完整参考库。

每个 CLI 遵循相同格式——`{tool} <resource> <action> [options]`，JSON 输出到 stdout，
密钥从环境变量读取。会一个就会所有。
完整资料来源：[`tools/clis/README.md`](./tools/clis/README.md)。
按分类列出的完整清单：

### 💰 广告

| 分类 | 工具 |
|---|---|
| 广告 | [Google Ads](https://ads.google.com) |
| 广告 | [LinkedIn Ads](https://business.linkedin.com/marketing-solutions/ads) |
| 广告 | [Meta Ads](https://www.facebook.com/business/ads) |
| 广告 | [TikTok Ads](https://ads.tiktok.com) |

### 🔍 SEO

| 分类 | 工具 |
|---|---|
| SEO | [Ahrefs](https://ahrefs.com) |
| SEO | [DataForSEO](https://dataforseo.com) |
| SEO | [Google Search Console](https://search.google.com/search-console) |
| SEO | [Keywords Everywhere](https://keywordseverywhere.com) |
| SEO | [SEMrush](https://semrush.com) |
| SEO | [RankParse](https://rankparse.com) |

### ✉️ 邮件 & SMS

| 分类 | 工具 |
|---|---|
| 邮件/CRM | [ActiveCampaign](https://activecampaign.com) |
| 邮件/SMS | [Brevo](https://brevo.com) |
| 邮件 | [Customer.io](https://customer.io) |
| 邮件 | [Kit](https://kit.com) |
| 邮件/SMS | [Klaviyo](https://klaviyo.com) |
| 邮件 | [Mailchimp](https://mailchimp.com) |
| 邮件 | [Postmark](https://postmarkapp.com) |
| 邮件 | [Resend](https://resend.com) |
| 邮件 | [SendGrid](https://sendgrid.com) |
| 新闻邮件 | [Beehiiv](https://beehiiv.com) |
| 推送 | [OneSignal](https://onesignal.com) |

### 📊 数据分析

| 分类 | 工具 |
|---|---|
| 分析 | [Adobe Analytics](https://business.adobe.com/products/analytics) |
| 分析 | [Amplitude](https://amplitude.com) |
| 分析 | [Google Analytics 4](https://analytics.google.com) |
| 分析 | [Mixpanel](https://mixpanel.com) |
| 分析 | [Plausible](https://plausible.io) |
| 分析 | [Segment](https://segment.com) |
| 产品分析 | [Pendo](https://pendo.io) |
| 竞品情报 | [SimilarWeb](https://similarweb.com) |
| CRO | [Hotjar](https://hotjar.com) |
| A/B 测试 | [Optimizely](https://optimizely.com) |

### 🤝 CRM、消息与生命周期

| 分类 | 工具 |
|---|---|
| 消息 | [Intercom](https://intercom.com) |
| CRM | [Close](https://close.com) |
| 销售触达 | [Outreach](https://outreach.io) |

### 🎯 外呼与数据丰富

| 分类 | 工具 |
|---|---|
| 数据丰富 | [Apollo.io](https://apollo.io) |
| 数据丰富 | [Clearbit](https://clearbit.com) |
| 数据丰富 | [Clay](https://clay.com) |
| 数据丰富 | [ZoomInfo](https://zoominfo.com) |
| 邮件外呼 | [Hunter.io](https://hunter.io) |
| 邮件外呼 | [Instantly.ai](https://instantly.ai) |
| 邮件外呼 | [Lemlist](https://lemlist.com) |
| 邮件外呼 | [Snov.io](https://snov.io) |
| 合作 | [Crossbeam](https://crossbeam.com) |
| 开发者拓客 | [GitHub Prospects](https://github.com) |

### ⭐ 评论与社交

| 分类 | 工具 |
|---|---|
| 社交 | [Buffer](https://buffer.com) |
| 评论 | [G2](https://g2.com) |
| 评论 | [Trustpilot](https://trustpilot.com) |

### 🎥 网络研讨会、视频与表单

| 分类 | 工具 |
|---|---|
| 网络研讨会 | [Demio](https://demio.com) |
| 网络研讨会 | [Livestorm](https://livestorm.co) |
| 视频 | [Wistia](https://wistia.com) |
| 表单 | [Typeform](https://typeform.com) |
| 日程 | [Calendly](https://calendly.com) |
| 日程 | [SavvyCal](https://savvycal.com) |

### 💳 支付、推荐与联盟

| 分类 | 工具 |
|---|---|
| 支付 | [Paddle](https://paddle.com) |
| 联盟 | [PartnerStack](https://partnerstack.com) |
| 推荐 | [Mention Me](https://www.mention-me.com) |
| 推荐 | [Rewardful](https://www.getrewardful.com) |
| 推荐 | [Tolt](https://tolt.io) |

### 🔗 链接、搜索与自动化

| 分类 | 工具 |
|---|---|
| 链接 | [Dub.co](https://dub.co) |
| AI 搜索 | [Exa](https://exa.ai) |
| 自动化 | [Zapier](https://zapier.com) |
| 数据集成 | [Coupler](https://coupler.io) |
| 报表 | [Supermetrics](https://supermetrics.com) |

### 🤖 AI 与内容

| 分类 | 工具 |
|---|---|
| AI 内容 | [AirOps](https://airops.com) |

……外加 [`tools/REGISTRY.md`](./tools/REGISTRY.md) 里的 90+ 个集成指南——HubSpot、
Salesforce、Stripe、Shopify、Twilio、PostHog、Clay、ZoomInfo 等等——每当 agent 需要时按需加载。

→ **浏览实时菜单：** `make roles` · `make skills` · [`tools/clis/README.md`](./tools/clis/README.md)

---

## 团队成员

| 角色 | 为之而生 |
|------|----------|
| **Director / Growth Lead** | 全局——策略、预算、归因、下一注押在哪。 |
| **搜索投放（Paid Search）** | 高意向需求。ROAS、转化率、否定词、你花钱买来的那一下点击。 |
| **社交效果广告（Social Ads）** | Meta 与 TikTok 上的注意力。素材即定向、lookalike、前 3 秒。 |
| **SEO** | 复利式自然增长。技术健康、搜索意图、内容缺口、外链。 |
| **B2B / LinkedIn** | 高价值决策者。ABM、目标账户、思想领导力、漫长的销售周期。 |
| **生命周期与留存** | 你已经赢到的客户。邮件/SMS 流、分群、流失、终身价值。 |

会话中随时切换——`--role seo`，再 `/role social-ads`——agent 就会在下一个任务里换成那位专家的口吻。

---

## 看真实产出

别只信功能列表——[`output/`](./output) 目录里放的是**真实运行、未经修饰的成品**。两份值得完整读一遍：

- 📊 **[大模型代码战役：Kimi Code vs. MiniMax 增长策略深度对比](./output/kimi-vs-minimax-coding-growth-analysis.md)**
  —— 一份总监级竞品分析：定位、受众、品牌心智、推广打法，含对比表与可落地建议。
- 🌱 **[TikTok 爆款园艺产品增长营销策略指南](./output/tiktok-viral-gardening-products-guide.md)**
  —— 社交/内容专家的品类拆解：市场洞察、内容公式、电商转化路径，思维原生贴合渠道。

**价值在哪：** 这些不是要点摘要，而是结构化、有立场、拿来即用的文档——平时要等代理公司好几天才有的东西，一条 prompt 就出来了。双语索引见 [`output/README.md`](./output/README.md)。

→ **想要自己的？** 运行 `make run` 然后粘贴一段 brief。第一份交付物几分钟内就落在 `output/` 里。

---

## 快速开始

**三个命令，拿到你的第一份交付物。** 认真的。

```bash
make setup     # uv sync — 安装依赖
make auth      # 一次性：gcloud application-default login（启用 Vertex AI）
make run       # 交互式 REPL
```

纯英文 agent 指令与回复的一键 CLI 模式，加 `--language en`（例如：`uv run python -m marketing_agent --language en --role seo "Audit this site structure"`）。Reflex 应用在侧边栏也有每会话选择器；中文（`zh`）仍是默认。

```bash
uv run python -m marketing_agent --language en --role seo "Audit this site structure"
```

### Mastra 引擎：活动编排

更想要一个结构化活动引擎，支持自动委派和记忆？两条命令：

```bash
cd mastra
cp .env.example .env   # 设置 OPENROUTER_API_KEY
node run.mjs           # 一键生成市场活动方案
```

或者打开 Mastra Studio 使用可视化聊天界面：

```bash
cd mastra && npm run dev   # → http://localhost:4111
```

### Web 应用与免密登录

Reflex 应用通过 `make web` 启动。它使用 Appwrite Magic URL 认证：
用户输入邮箱，收到一次性登录链接。无需 Google OAuth、密码数据库或自定义域名。

1. 创建一个免费的 Appwrite Cloud 项目，开发时添加一个 **Web** 平台指向 `localhost`。部署后，把 Appwrite Sites 的主机名（不是 Render API 主机名）添加为另一个 Web 平台。
2. 将 `.env.example` 复制为 `.env`，从 Appwrite 控制台设置 `APPWRITE_ENDPOINT` 和 `APPWRITE_PROJECT_ID`。这些是公开的客户端配置值；永远不要添加 Appwrite API key。
3. 运行 `make web`。关于免费托管方案，将静态前端部署到 Appwrite Sites，将 Reflex Python 后端部署到 Render，详情如下。

`/auth/callback` 路由会在授予 agent 访问权限前，再次在 Python 服务端验证 Appwrite 浏览器 JWT。Node 集成 CLI 仍然是服务端仓库工具，无法从浏览器执行。

### 生产部署：Appwrite Sites + Render

这是推荐的低成本方案。Appwrite Sites 托管编译后的 Reflex 前端；Render 只托管 Python/WebSocket 后端；Appwrite 仍然管免密登录。你**不需要**自定义域名。

```text
浏览器 → Appwrite Sites（静态 Reflex UI）→ Render（Reflex events/WebSocket）
             └────────────────────────────→ Appwrite Magic URL 认证
```

1. 在 Appwrite Cloud 中创建项目，添加 `localhost` 作为 Web 平台。复制 endpoint（以 `/v1` 结尾）和 project ID。不要创建 API key。
2. 在控制台中创建一个 **Appwrite Site** 作为静态站点。它生成的 `*.appwrite.network` URL 就够了。将该主机名添加为同一 Appwrite 项目的第二个 **Web** 平台；这样 Magic Link 回调才能工作。
3. 将此仓库推送到 GitHub，从附带的 [`render.yaml`](./render.yaml) 创建一个 Render 服务。选择免费计划。在 Render 的环境页设置：`OPENROUTER_API_KEY`、`OPENROUTER_MODEL`、`APPWRITE_ENDPOINT`、`APPWRITE_PROJECT_ID` 和 `REFLEX_CORS_ALLOWED_ORIGINS=https://your-site.appwrite.network`。该文件使用附带的 [`Dockerfile`](./Dockerfile) 启动后端；不需要 Reflex Cloud 账号。
4. Render 部署完成后，复制其 `https://…onrender.com` URL，用两个公开 URL 构建静态前端：

   ```bash
   make hosting-build \
     BACKEND_URL=https://your-api.onrender.com \
     SITE_URL=https://your-site.appwrite.network
   ```

   这将 Render API/WebSocket URL 嵌入到 `.web/build/client` 的导出前端中。
5. 一次性安装 Appwrite CLI、登录并初始化 Site 配置。输出目录/路径提示时，使用 `.web/build/client`。

   ```bash
   npm install -g appwrite-cli
   make appwrite-login
   make appwrite-init
   ```

6. 部署静态站点。每次都传入相同的 URL，因为每次前端构建都必须指向正确的 Render 后端：

   ```bash
   make appwrite-deploy \
     BACKEND_URL=https://your-api.onrender.com \
     SITE_URL=https://your-site.appwrite.network
   ```

7. 打开 Appwrite Site URL 完成 Magic Link 登录。在 Render 免费版上，后端闲置后会休眠，所以首次访问可能需要大约一分钟 UI 才能连接。后续部署使用同样的两个命令：`make hosting-build …` 和 `make appwrite-deploy …`。

旧的 `make release` 目标仍然可用，但本 Appwrite + Render 架构不再使用它们。

> 👉 **第一次来？** 运行 `make run`，然后输入一段真实的 brief——
> *"我的 SaaS 要在北美做冷启动，给我 90 天获客计划"*——然后看 Director 如何分发任务。或者直接跳到某个专家：`make role NAME=seo MSG="..."`。

鉴权二选一（由 `GENAI_PROVIDER` 自动判断）：

- **Vertex AI（默认）：** 通过 `gcloud auth application-default login` 的 ADC。需要在 `.env` 里设 `GOOGLE_CLOUD_PROJECT`。无需 API key。
- **Gemini Developer API：** 在 `.env` 里设 `GENAI_PROVIDER=api` 和 `GEMINI_API_KEY`。

## 运行 agent

```bash
make run                            # 交互式 REPL
make ask MSG="写 3 条广告标题"        # 作为 Director 一次性任务

# 切换到某个专家角色
make role NAME=seo MSG="给我一份技术 SEO 审计清单"
uv run python -m marketing_agent --role paid-search --skill ads "ROAS 目标怎么设"

make roles      # 浏览角色
make skills     # 浏览 47 个技能手册
```

### REPL 命令

```
/roles · /role [name|n] · /role-off     切换专家角色
/skills · /skill [name|n] · /skill-off  切换技能手册
/think · /think-on · /think-off         开关实时思维流
/help · /quit
```

角色与技能在每个任务前都会重新解析，所以切换会在下一个 prompt 生效。

---

## 未来计划

团队这个比喻是地基，下面是接下来的方向。

**v0.2 已完成**
- **会真正委派的 Director。** Mastra 引擎的主管 agent 读取 brief 后，自动判断需要哪位专家，把活派下去——再把各自产出缝合成一份交付物。
- **项目记忆。** 团队跨会话记住你的产品、ICP、品牌口吻和过往活动——不用每次都重新解释背景。
- **活动工作流。** 结构化三步流程（策略 → 执行 → 复盘），带状态追踪和回滚。
- **多轮对话。** 持久聊天会话，完整历史记录。

**近期**
- **真正的平台执行，而不只是指南。** 今天这 100+ 集成是 agent 会读的 how-to 参考。下一步是"动手"——启动一条 Google Ads 投放、发一个 Klaviyo 流、拉取实时 GA4 数据——在可选的 API key 背后实现。
- **CLI → Mastra 桥接。** 一个薄的 CLI 封装，委托给 Mastra HTTP API，这样 `make run` 和 `npm run dev` 变成一个引擎的两个界面。
- **更多席位。** 品牌/创意、产品营销、数据分析、公关、合作——随着手册成熟，持续扩充这支队伍。

**中期**
- **评测与自我改进。** 一套带评分的营销任务集，让每个角色的产出是被衡量、而不是被感觉的。
- **基于 Mastra Studio 的 Web UI。** Mastra Studio 自带开箱即用的聊天 UI——为其定制非工程师友好的界面：角色侧边栏、活动面板、交付物预览。

**远期 / 探索中**
- **人在回路检查点**——任何要花钱或触达客户的事，先让人过目。
- **多语言扩展**——在中文优先之外。
- **"营销顾问团"实时模式**——在你拍板前，多位顾问实时辩论一个决策。

欢迎想法与贡献——已建部分的设计思路见 `docs/superpowers/specs/`。

---

## 双运行时，同一大脑

这个仓库搭载**两个运行时**，共享同一套角色、技能和平台集成：

| | Python CLI | Mastra 引擎 |
|---|---|---|
| **目录** | `marketing_agent/` | `mastra/` |
| **语言** | Python (LangGraph) | TypeScript (Mastra) |
| **最适合** | 快速一次性任务、REPL 会话 | 多轮对话、活动编排、Studio 界面 |
| **记忆** | 仅当次会话 | 跨会话项目记忆 |
| **委派** | 手动 `/role` 切换 | Director 自动路由给专家 |
| **工作流** | — | 结构化活动流程（策略 → 执行 → 复盘） |

### 为什么是两个？

Python CLI 是原来的工作马——一个精简的 LangGraph agent，专注于做好一件事。Mastra 引擎是**未来方向**：它在同一个大脑之上增加了多轮对话、结构化活动工作流、主管委派和跨会话记忆。

两者共享本仓库的 `roles/`、`skills/` 和 `tools/`——营销知识没有分叉。

### Python CLI

```
marketing_agent/agent.py       LangGraph ReAct agent — SYSTEM_PROMPT 就是 Director
marketing_agent/tools.py       7 个可调用工具（web_search、save_asset……）
roles/                         每个角色一个 YAML 文件
skills/                        47 个营销技能手册
tools/REGISTRY.md              ~100 个平台集成指南（按需加载）
```

**约定：**
- 实时信息（价格、新闻、竞品动态）→ 一律先 `web_search`。
- 最终长篇交付物 → `save_asset` 写入 `output/`（kebab-case `.md`）。
- 平台 how-to → `read_tool_guide`（如 `google-ads.md`）。

### Mastra 活动编排引擎（`mastra/`）

一个基于 [Mastra](https://mastra.ai) 的引擎，将相同的营销大脑包装成结构化的活动编排器——可以理解成 CLI 升级成了真正的 AI 团队。

```
mastra/src/mastra/agents/director.ts          主管 agent——将任务分派给专家
mastra/src/mastra/agents/specialists.ts        5 个专家子 agent
mastra/src/mastra/workflows/campaign-workflow.ts  3 步活动流水线
mastra/src/mastra/memory/project-memory.ts     跨会话项目记忆（产品、ICP、口吻、活动）
mastra/src/mastra/tools/gtm-tools.ts           包装 Python 工具的 Mastra 工具层
```

**三种模式：dev · test · prd**：

```bash
cd mastra
cp .env.example .env   # 设置 OPENROUTER_API_KEY

make dev              # Dev:  完整 Studio UI + 热重载        → :4111
make test             # Test: 构建后的 Studio，类生产环境     → :4111
make prd              # Prd:  构建，准备部署 Cloudflare

node run.mjs           # 一键生成活动方案
# 或：make campaign
```

| 模式 | 命令 | 说明 |
|------|------|------|
| **dev** | `make dev` (或 `npm run dev`) | 完整 Studio — agent 管理、工作流、工具、记忆、活动面板。热重载。 |
| **test** | `make test` (或 `npm run test`) | 同一个 Studio，但生产构建——无 dev 工具条、无热重载。更干净、更快。 |
| **prd** | `make prd` (或 `npm run prd`) | 仅构建——产出 `.mastra/output/` 用于部署到 Cloudflare Workers。 |

Mastra 引擎通过一个薄的桥接层在底层调用同样的 Python 工具 CLI。新功能开发在 Mastra 中进行；Python CLI 为习惯终端的用户继续维护。

### 能合并吗？

不能在同一个进程里合并——一个是 Python，一个是 TypeScript。但 **Mastra 引擎是新功能落地的位置**（活动、委派、记忆）。长期愿景是 CLI 委托给 Mastra HTTP API，这样就是一个大脑、两个界面。

现在：
- **想要快速终端对话？** → `make run`
- **想要活动方案、多轮聊天和可视化 Studio？** → `cd mastra && npm run dev`
- **两个都想要？** → 放在同一个仓库里。它们共享角色、技能和工具。无重复。

## 两种模式：开发 vs 部署

Mastra 引擎支持两种运行模式：

### 开发模式 `npm run dev`

- 完整 Mastra Studio 界面
- 可视化 agent 管理、工作流监控、工具调试
- 实时流式推理展示
- 适合日常开发和调试

### 部署/测试模式 `npm run start`

- 精简纯净聊天界面（无 Mastra 品牌图标）
- 仅提供「对话」和「会话目录」核心功能
- 适合生产部署、客户演示、团队测试
- 通过 `MASTRA_TEMPLATES=false MASTRA_EXPERIMENTAL_FEATURES=false` 等环境变量精简 UI

## 清理

```bash
make clean     # 删除 .venv 与构建产物
```

---

## 准备好把营销团队放进你的终端了？

**[→ 60 秒快速开始](#快速开始)** · **[→ Mastra 营销引擎](#mastra-活动编排引擎)** · **[→ 看真实产出](#看真实产出)** · **[→ 探索 150+ 集成](#接入你的工具栈)**

创始人、营销人和增长团队使用这个项目，在没有甲方的情况下交付代理级别的作品。如果它帮你省了一周时间，给仓库点个 ⭐——欢迎贡献、新角色和新手册。
