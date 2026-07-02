"""营销 agent 使用的工具集合。

所有工具都设计成"真实可用、零额外密钥"：
- web_search: 联网搜索（DuckDuckGo，不需要 API key），用于竞品/市场调研、SEO 取材
- save_asset / read_asset / list_assets: 把文案、策略、关键词清单等产出物落盘到 ./output
"""

from __future__ import annotations

from pathlib import Path

from langchain.tools import tool

# 资产落盘目录（相对仓库根），不存在则创建
OUTPUT_DIR = Path("output").resolve()
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def _safe_path(filename: str) -> Path:
    """防止路径穿越：只允许写到 OUTPUT_DIR 下的文件名。"""
    # 只取文件名部分，丢掉任何目录前缀
    name = Path(filename).name
    if not name:
        raise ValueError(f"非法文件名: {filename!r}")
    p = (OUTPUT_DIR / name).resolve()
    if not str(p).startswith(str(OUTPUT_DIR)):
        raise ValueError(f"路径越界: {filename!r}")
    return p


@tool
def web_search(query: str) -> str:
    """联网搜索最新网页信息，返回若干条结果摘要。

    用于竞品调研、市场趋势、关键词热度、行业数据等需要实时信息的场景。
    传入具体的自然语言检索词，例如 "Notion 2026 定价方案"。

    Args:
        query: 搜索关键词。
    """
    # 延迟导入，避免 DDG 偶发限流或网络异常时整模块加载失败
    from langchain_community.tools import DuckDuckGoSearchRun

    try:
        return DuckDuckGoSearchRun().invoke(query)
    except Exception as exc:  # noqa: BLE001 — 工具内兜底，把错误还给 agent 自行决策
        return f"[web_search 失败: {exc}. 请基于已有知识作答，或换一个检索词重试。]"


@tool
def save_asset(filename: str, content: str) -> str:
    """把一段营销产出（文案、策略文档、关键词清单等）保存成文件。

    文件会写入项目的 output/ 目录。建议用 .md 后缀。
    生成完整产出后调用一次保存即可，不要每段都存。

    Args:
        filename: 文件名，例如 "launch-copy.md"。仅文件名，不要带路径。
        content: 要写入的完整内容。
    """
    path = _safe_path(filename)
    path.write_text(content, encoding="utf-8")
    return f"已保存到 {path}（{len(content)} 字符）"


@tool
def read_asset(filename: str) -> str:
    """读取之前保存过的营销资产文件内容。

    Args:
        filename: output/ 目录下的文件名。
    """
    path = _safe_path(filename)
    if not path.exists():
        return f"[文件不存在: {filename}]"
    return path.read_text(encoding="utf-8")


@tool
def list_assets() -> str:
    """列出 output/ 目录下所有已保存的营销资产文件名。"""
    files = sorted(p.name for p in OUTPUT_DIR.glob("*") if p.is_file())
    if not files:
        return "（暂无已保存资产）"
    return "\n".join(files)


# 导出给 agent 使用
ALL_TOOLS = [web_search, save_asset, read_asset, list_assets]
