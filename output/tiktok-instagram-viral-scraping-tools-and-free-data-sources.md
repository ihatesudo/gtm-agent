# TikTok / Instagram 公开爆款挖掘：CLI 抓取工具 + 免费数据源调研

> **角色**：Social-Ads/Content
> **配套文档**：[solo-consultant-content-teardown-and-positioning.md](./solo-consultant-content-teardown-and-positioning.md) 第 6 节的「同款拆解」选题引擎，需要持续的数据输入——本文回答"这些数据具体从哪拿、要不要花钱、有没有封号风险"。
> **数据来源**：2026 年公开工具文档/项目仓库/官方开发者站,详见文末 Sources

---

## 0. 先说结论

**没有一个免费 CLI 工具能稳定拿到"完整、实时、不违反 ToS"的 TikTok/Instagram 有机内容 metadata——这三个条件永远只能满足两个。** 你要在下面三条路线里选:

| 路线 | 免费 | 稳定/合规 | 完整(含点赞/评论数) |
|---|---|---|---|
| A. 官方免费数据源(Creative Center / Ad Library) | ✓ | ✓ | ✗(只有趋势,没有单条内容明细) |
| B. 非官方开源 CLI(yt-dlp / TikTokApi / instaloader) | ✓ | ✗(有封号/被 TikTok 改接口打断风险) | ✓(能拿到,但字段会变) |
| C. 商业抓取 API(Apify 等) | ✗(usage-based 计费,有免费额度) | ✓(别人帮你扛封号风险) | ✓ |

**给一人公司的建议**:选题调研用 A(零成本零风险,够用),需要精细拆解某几条爆款的完整数据(评论内容、精确点赞数)时,用 C 花小钱买 100-200 条的抓取额度,不要自己维护 B——B 类工具需要持续修 cookie/token,维护成本比订阅费贵。

---

## 1. CLI/开源抓取工具清单(路线 B)

### TikTok

| 工具 | 类型 | 能拿到什么 | 现状(2026) | 风险 |
|---|---|---|---|---|
| **yt-dlp** | CLI,免费开源 | `--write-info-json` 导出单条视频的 caption、hashtag、音乐信息、创作者信息;支持 `--batch-file` 批量处理导出 CSV | 项目活跃维护,但 view/like 等互动字段**不保证稳定**——TikTok 改接口时字段会消失或错位,抓取后务必人工核对 | 低(只读公开页面,无需登录) |
| **TikTokApi**(davidteather) | Python 库 | 视频/账号/评论的结构化数据,包括点赞、评论数 | 2026 年 4 月仍在更新,但需要从浏览器 cookie 里手动取 `ms_token`,TikTok 改版时经常失效,需要跟着仓库更新 | 中(需要登录态 cookie,滥用会被限流) |
| **tiktok-scraper**(社区 npm 包/yt-dlp 封装) | CLI | 类似 yt-dlp,部分封装了更友好的批量命令 | 多个社区维护版本质量参差,建议先看 GitHub 最近 commit 时间再用 | 低-中 |

### Instagram

| 工具 | 类型 | 能拿到什么 | 现状(2026) | 风险 |
|---|---|---|---|---|
| **Instaloader** | CLI,开源,GitHub 1.3 万+ star | 公开账号的图片/视频/文字+结构化 metadata,是目前维护最好的选项 | 2026 年 7 月仍有提交,活跃 | **高**——2023 年后 Instagram 几乎所有内容都要求登录才能看,登录态抓取有被限流/封号风险,官方文档自己都提醒 |
| **gallery-dl** | CLI,多平台(含 TikTok/Twitter等) | 图片/视频下载为主,metadata 相对简略 | 需要用 `--cookies-from-browser chrome` 传入浏览器 cookie 才能绕开登录墙 | 高,同上 |
| **insta-dl**(subzeroid, 2026 新项目) | 异步 CLI | 账号/帖子/reels/stories/评论,插件化后端(可接 HikerAPI/aiograpi) | 较新,设计上更现代(异步+可插拔),适合想要评论数据的场景 | 取决于所接后端是否付费 |

**匿名(不登录)抓取的现实限制**:Instagram 的公开 JSON 接口在**几次匿名请求后就会返回 429**,想稳定跑,要么登录(有风险),要么走商业代理池(路线 C)。

---

## 2. 免费/官方数据源(路线 A——推荐日常选题优先用这个)

| 数据源 | 免费吗 | 能看到什么 | 局限 |
|---|---|---|---|
| **TikTok Creative Center**(creative-center.tiktok.com) | 完全免费,不需要商业账号 | 官方数据:趋势 hashtag(带增长率)、趋势音乐(7/30/120 天榜单+趋势图)、**Top Ads 库**(可按行业/地区/目标/形式筛选,能看到正在跑的真实广告创意) | 只有**汇总趋势**,拿不到单条视频的点赞/评论数;不是所有地区/语言都覆盖全 |
| **Meta Ad Library**(公开免费,任何人可查) | 免费 | 任何在 Meta 生态投放的广告(含 Instagram),可看创意、投放时间、大致触达量级(部分地区更详细) | 只有**广告**,看不到有机内容爆款 |
| **TikTok Research API** | 免费,但**门槛高** | 单条视频级别数据,含 1000 次/天默认额度 | 只对**学术机构/非营利组织**开放申请,需要提交研究方案,商业用户/自由职业者/一人公司基本不具备申请资格;数据有 24 小时-7 天延迟 |
| **Meta Content Library** | API/网页界面免费,但计算环境(VDE)2026 年起 $371/月+$1000 启动费 | Instagram/Facebook/Threads 公开内容 | 同样只对学术/非营利资质开放,一人公司大概率不符合资质 |
| **Google Trends**(经 pytrends 或 SerpApi) | pytrends 完全免费(非官方 Python 库,直接查询公开网页接口);SerpApi 有 100 次/月永久免费档 | 搜索热度趋势(可以看某个话题/关键词是不是在涨) | 不是社交平台原生数据,只是搜索兴趣的代理指标 |
| **Social Blade 网页版** | 免费(网页查询) | 输入账号名,看粗略的粉丝增长趋势 | 没有免费 API,想批量查只能人工一个个搜 |

**结论**:官方免费数据源里,**TikTok Creative Center 是你现阶段最该天天用的一个**——它就是官方给你的"免费趋势雷达",覆盖了你选题引擎需要的大部分信号(什么话题在涨、竞品在投什么广告创意),而且完全合规,不存在封号风险。

---

## 3. 商业抓取 API(路线 C——需要精细数据时的补充,不是日常主力)

上一份文档第 6 节的 `reverse-engineering.md` 参考里已经提到 **Apify** 和 **Phantom Buster**,这里补充实际用法:

- **Apify TikTok Comments Scraper**:有 CLI 接口,按用量计费,有免费额度可以先跑几十条测试,能拿到评论文本、用户名、时间戳、点赞数、回复数——如果你想验证"这条爆款的评论区在讨论什么",这是最省事的路径,不用自己维护 token
- **适用场景**:每月你在 Creative Center / IG 手动刷到 3-5 条真正想深挖的爆款时,花几美元的额度精细抓一次,而不是天天全量爬

---

## 4. 合规与风险提醒

- TikTok / Instagram 的服务条款**都明确禁止未授权的自动化抓取**,这不是"要不要绕过"的问题,而是**账号层面**的真实风险:用你的主账号登录去跑抓取脚本,轻则限流,重则封号
- 如果一定要用需要登录的工具(TikTokApi、Instaloader 登录模式),**用小号,不要用你的品牌主账号**,并且把频率降到"人工浏览速度"级别(每次间隔 2 秒以上)
- 官方数据源(Creative Center、Ad Library、Google Trends)完全没有这层风险,应该是默认路径;非官方工具只在"官方数据不够用"时才启动

---

## 5. 落地到「同款拆解」栏目的具体动作

结合上一份策略文档的周更选题引擎,建议的数据工作流:

1. **每周一**:花 15 分钟刷 TikTok Creative Center 的 Trending Hashtags + Top Ads(你所在行业筛选),记录 3-5 个候选话题/创意角度——零成本
2. **每周二**:用 vidIQ(你已有权限的工具)或类似的 outlier 搜索工具,在候选话题里找到 2-3 条真实爆量的视频(有播放量/互动数据支撑,而不是凭感觉挑)
3. **需要评论区洞察时**:对选中的 1-2 条,用 Apify 的少量免费/付费额度精细抓一次评论,提炼受众真实语言
4. **不要**:自己搭 TikTokApi/Instaloader 长期定时任务——维护成本(改 token、防封号)对一人公司来说不划算,除非这将来会成为你要卖给客户的产品能力本身

---

## Sources

- [yt-dlp TikTok metadata 抓取讨论(GitHub)](https://github.com/yt-dlp/yt-dlp/issues/7684)
- [Apify TikTok Comments Scraper CLI](https://apify.com/automation-lab/tiktok-comments-scraper/api/cli)
- [TikTok Creative Center 2026 指南](https://bir.ch/blog/tiktok-creative-center)
- [Instaloader 官方文档/Troubleshooting](https://instaloader.github.io/troubleshooting.html)
- [开源 Instagram 抓取工具对比(Scrapfly, 2026)](https://scrapfly.io/blog/posts/best-open-source-instagram-scrapers)
- [insta-dl 项目(GitHub)](https://github.com/subzeroid/insta-dl)
- [TikTokApi 项目现状(davidteather/TikTok-Api)](https://github.com/davidteather/TikTok-Api)
- [TikTok Research API 官方说明](https://developers.tiktok.com/products/research-api/)
- [TikTok Research API 2026 免费访问与延迟说明](https://www.echotik.live/blog/tiktok-research-api-free-access-guide/)
- [Meta Content Library / Transparency Center](https://transparency.meta.com/researchtools/meta-content-library/)
- [Meta Content Library 2026 VDE 计费更新](https://transparency.meta.com/researchtools/meta-content-library/MCL-API-update-supporting-independent-research/)
- [Google Trends API 现状说明(2026)](https://explodingtopics.com/blog/google-trends-api)
- [Free Alternatives to Social Blade(2026)](https://www.findmymoat.com/free/alternatives/social-blade)
