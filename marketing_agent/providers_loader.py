from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import yaml

_ROOT = Path(__file__).resolve().parent.parent
PROVIDERS_DIR = _ROOT / "providers"


@dataclass(frozen=True)
class Provider:
    name: str
    title: str
    description: str
    base_url: str
    model: str
    api_key_env: str
    capabilities: dict[str, bool] = field(default_factory=dict)
    currency: str = "CNY"
    website: str = ""


def _as_str(val: object) -> str:
    return str(val).strip() if val is not None else ""


def _as_bool_dict(val: object) -> dict[str, bool]:
    if not isinstance(val, dict):
        return {}
    return {str(k): bool(v) for k, v in val.items()}


def _parse_provider_yaml(path: Path) -> Provider | None:
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except (OSError, yaml.YAMLError):
        return None
    block = data.get("provider") if isinstance(data, dict) else None
    if not isinstance(block, dict):
        return None
    name = _as_str(block.get("name")) or path.stem
    return Provider(
        name=name,
        title=_as_str(block.get("title")) or name,
        description=_as_str(block.get("description")),
        base_url=_as_str(block.get("base_url")),
        model=_as_str(block.get("model")),
        api_key_env=_as_str(block.get("api_key_env")),
        capabilities=_as_bool_dict(block.get("capabilities")),
        currency=_as_str(block.get("currency")) or "CNY",
        website=_as_str(block.get("website")),
    )


@lru_cache(maxsize=1)
def _providers_tuple() -> tuple[Provider, ...]:
    if not PROVIDERS_DIR.is_dir():
        return ()
    providers = [
        p for p in (_parse_provider_yaml(p) for p in sorted(PROVIDERS_DIR.glob("*.yaml"))) if p
    ]
    return tuple(sorted(providers, key=lambda p: p.name))


def refresh_providers() -> None:
    _providers_tuple.cache_clear()


def list_providers() -> list[Provider]:
    return list(_providers_tuple())


def find_provider(query: str) -> Provider | None:
    if not query:
        return None
    q = query.strip().lower()
    providers = list_providers()
    for p in providers:
        if p.name.lower() == q:
            return p
    prefix_hits = [p for p in providers if p.name.lower().startswith(q)]
    if len(prefix_hits) == 1:
        return prefix_hits[0]
    return None


def load_provider(name: str) -> Provider:
    """Load a single provider by name. Raises KeyError if not found."""
    provider = find_provider(name)
    if provider is None:
        raise KeyError(f"Unknown provider: {name!r}")
    return provider
