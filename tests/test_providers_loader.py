import pytest

from marketing_agent.providers_loader import (
    PROVIDERS_DIR,
    find_provider,
    list_providers,
    load_provider,
    refresh_providers,
)

# Ensure a clean state for each test module load.
refresh_providers()


def test_providers_dir_exists():
    assert PROVIDERS_DIR.is_dir()


def test_list_providers_returns_all():
    providers = list_providers()
    assert len(providers) >= 3
    names = [p.name for p in providers]
    assert "gemini" in names
    assert "deepseek" in names
    assert "glm" in names


@pytest.mark.parametrize(
    "query, expected_name",
    [
        ("deepseek", "deepseek"),
        ("DeepSeek", "deepseek"),
        ("deep", "deepseek"),
        ("g", None),  # ambiguous — matches gemini and glm
        ("glm", "glm"),
        ("gemini", "gemini"),
    ],
)
def test_find_provider(query, expected_name):
    result = find_provider(query)
    if expected_name is None:
        assert result is None
    else:
        assert result is not None
        assert result.name == expected_name


def test_find_provider_not_found():
    assert find_provider("nonexistent") is None
    assert find_provider("") is None


def test_all_providers_have_required_fields():
    for p in list_providers():
        assert p.name, f"provider {p.name} missing name"
        assert p.title, f"provider {p.name} missing title"
        assert p.api_key_env, f"provider {p.name} missing api_key_env"
        assert isinstance(p.capabilities, dict)


def test_gemini_has_expected_fields():
    gemini = find_provider("gemini")
    assert gemini is not None
    assert gemini.capabilities.get("thinking") is True
    assert gemini.capabilities.get("vision") is True


def test_deepseek_has_expected_fields():
    ds = find_provider("deepseek")
    assert ds is not None
    assert ds.base_url == "https://api.deepseek.com"
    assert ds.model == "deepseek-v4-pro"
    assert ds.api_key_env == "DEEPSEEK_API_KEY"
    assert ds.capabilities.get("thinking") is True
    assert ds.capabilities.get("vision") is False


def test_glm_has_expected_fields():
    glm = find_provider("glm")
    assert glm is not None
    assert glm.base_url == "https://open.bigmodel.cn/api/paas/v4/"
    assert glm.model == "glm-5.2"
    assert glm.api_key_env == "GLM_API_KEY"
    assert glm.capabilities.get("thinking") is True
    assert glm.capabilities.get("vision") is True


def test_load_provider_returns_matching():
    ds = load_provider("deepseek")
    assert ds.name == "deepseek"
    assert ds.base_url == "https://api.deepseek.com"


def test_load_provider_raises_on_unknown():
    with pytest.raises(KeyError, match="nonexistent"):
        load_provider("nonexistent")


def test_load_provider_round_trip():
    for p in list_providers():
        loaded = load_provider(p.name)
        assert loaded == p
