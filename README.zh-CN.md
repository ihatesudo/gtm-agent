# Marketing Agent（营销 Agent）

[English](README.md) · **简体中文**

> **一个不把所有事都做得半吊子的 AI——它跑的是一整支营销团队。**

大多数营销 AI 都是一个"通才"：问它 SEO，还行；问它投广告，还行；让它写新品发布邮件，也……还行。结果就是每个渠道都浅尝辄止。

这个项目押注另一种思路。它不是一个人生扛所有活，而是把自己组织成**一支真正的营销团队**：一位负责统筹的 Growth Lead（增长负责人），加上六位专家——搜索、社交、SEO、B2B、生命周期等等——每位都有自己的口吻、直觉、打法手册和工具箱。你跟它对话，就像给代理公司下 brief：说清目标，对的人就会接手。

它面向创始人、营销人和增长团队——想要随时调用的专家级思考（策略、文案、投放、SEO、生命周期流程），又不想付七份工资，也不想在聊天框里来回复制粘贴。

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
| 💭 | **实时思维流** | 逐 token 看着 agent 思考，或关掉只看最终答案。 |
| 💾 | **产出落盘** | 最终文案、策略、关键词表存成 `output/` 里的文件——不会在聊天滚动里丢失。 |
| 🔍 | **有据可查，不瞎编** | 实时信息（价格、竞品动态、关键词热度）先搜索再下结论。 |
| 🇨🇳 | **中文优先** | 说你的语言；专业、具体、直击要点。 |
| 🔌 | **自带模型** | Google Vertex AI（ADC）或 Gemini Developer API（API key），随你选。 |
| 🪶 | **精简、可改** | 纯 LangGraph + Gemini，没有重型框架。加一个角色或技能，只需丢一个文件。 |

---

## 团队成员

| 角色 | 为之而生 |
|------|-----------|
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

---

## 快速开始

```bash
make setup     # uv sync — 安装依赖
make auth      # 一次性：gcloud application-default login（启用 Vertex AI）
make run       # 交互式 REPL
```

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

项目还早期。团队这个比喻是地基，下面是接下来的方向。

**近期**
- **真正的平台执行，而不只是指南。** 今天这 100+ 集成是 agent 会读的 how-to 参考。下一步是"动手"——启动一条 Google Ads 投放、发一个 Klaviyo 流、拉取实时 GA4 数据——在可选的 API key 背后实现。
- **会真正委派的 Director。** 现在切换角色是手动的。目标是让 Director 读完 brief，自己判断需要哪位（或哪几位）专家，自动把活派下去——再把各自的产出缝合成一份交付物。
- **项目记忆。** 让团队记住你的产品、理想客户、品牌口吻和过往投放，省得每次会话都重新解释背景。

**中期**
- **更多席位。** 品牌/创意、产品营销、数据分析、公关、合作——随着手册成熟，持续扩充这支队伍。
- **评测与自我改进。** 一套带评分的营销任务集，让每个角色的产出是被衡量、而不是被感觉的。
- **Web UI。** 给非工程师一个比终端更友好的前端——侧边栏选角色，看着团队干活。

**远期 / 探索中**
- **人在回路检查点**——任何要花钱或触达客户的事，先让人过目。
- **多语言扩展**——在中文优先之外。
- **"营销顾问团"实时模式**——在你拍板前，多位顾问实时辩论一个决策。

欢迎想法与贡献——已建部分的设计思路见 `docs/superpowers/specs/`。

---

## 各模块如何拼合

- `marketing_agent/agent.py` —— LangGraph ReAct agent。`SYSTEM_PROMPT` 是 Director 人设；`build_agent(role=, skill=)` 组合 **Director 基底 + 角色 persona + 技能手册**。
- `marketing_agent/tools.py` —— 7 个可调用工具（`web_search`、`save_asset`、`read_asset`、`list_assets`、`list_skills`、`read_skill_reference`、`read_tool_guide`）。
- `roles/` —— 每个角色一个 YAML（kimi-cli 风格）。`roles/TOOLS.md` = 完整工具清单 + 各角色常用平台集成。
- `marketing_agent/roles_loader.py` / `skills_loader.py` —— 从磁盘解析并供给角色/技能。
- `skills/` —— 47 个营销技能手册。
- `tools/REGISTRY.md` —— ~100 个平台集成指南（按需加载）。

### 约定

- 实时信息（价格、新闻、竞品动态）→ 一律先 `web_search`。
- 最终长篇交付物 → `save_asset` 写入 `output/`（kebab-case `.md`）。
- 平台 how-to → `read_tool_guide`（如 `google-ads.md`）。

## 收尾

```bash
make clean     # 删除 .venv 与构建产物
```
