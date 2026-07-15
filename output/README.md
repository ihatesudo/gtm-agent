# Output Gallery · 产出案例

> **EN** — These are **real, unedited deliverables** the marketing agent produced in
> actual runs (saved via the `save_asset` tool). They're here so you can judge the
> output quality directly — not a demo reel. The agent writes in Chinese by design
> (Chinese-first); the structure and depth are what travel across languages.
>
> **中文** — 下面是营销 agent 在**真实运行中产出的成品**（通过 `save_asset` 落盘，未经修饰）。
> 放在这里是为了让你直接判断产出质量，而不是看广告。Agent 默认用中文（中文优先）；
> 其结构与分析深度是跨语言通用的。

---

## Examples · 案例

### 1. [大模型代码战役：Kimi Code vs. MiniMax 增长策略深度对比](./kimi-vs-minimax-coding-growth-analysis.md)

| | |
|---|---|
| **EN** | A Director-level competitive growth analysis — positioning, target audiences, mindshare, and go-to-market playbooks for two coding-model products. Demonstrates the research-then-strategy depth, with comparison tables and actionable recommendations. |
| **中文** | 一份总监级的竞品增长分析：定位、目标受众、品牌心智，以及两款代码大模型的推广打法。展示了"先调研、再出策略"的深度，含对比表与可落地建议。 |
| **Role · 角色** | Director / Growth Lead |
| **Skills · 技能** | competitor-profiling, marketing-plan, product-marketing |

### 2. [TikTok 爆款园艺产品与增长营销策略指南](./tiktok-viral-gardening-products-guide.md)

| | |
|---|---|
| **EN** | A social-ads / content specialist's guide to a viral TikTok category — market insight, product teardowns, content formulas, and an e-commerce conversion path. Shows channel-native thinking (the first 3 seconds, #GardenTok aesthetics, ASMR). |
| **中文** | 社交/内容专家的 TikTok 爆款品类指南：市场洞察、单品拆解、内容公式与电商转化路径。体现渠道原生思维（前 3 秒、#GardenTok 美学、ASMR）。 |
| **Role · 角色** | Social Ads / Content |
| **Skills · 技能** | social, content-strategy, tiktok-marketing |

---

## Reproduce · 如何复现

```bash
make ask MSG="深度对比 Kimi Code 与 MiniMax OpenCode 的增长与推广策略"
make role NAME=social-ads MSG="TikTok 园艺爆款产品的增长营销策略指南"
```

New runs write to this same `output/` folder as kebab-case `.md` files. Use
`list_assets` / `read_asset` (in the REPL) to browse them.
新一次运行会以 kebab-case `.md` 写入同一 `output/` 目录；在 REPL 里用
`list_assets` / `read_asset` 浏览。
