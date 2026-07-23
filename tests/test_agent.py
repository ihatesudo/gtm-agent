"""Tests for agent.py — model factory with multi-provider support."""

import os

import pytest
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI

from marketing_agent.agent import build_model


def test_build_model_default_is_gemini(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "sk-test-gemini")
    model = build_model()
    assert isinstance(model, ChatGoogleGenerativeAI)


def test_build_model_gemini_explicit(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "sk-test-gemini")
    model = build_model(provider="gemini")
    assert isinstance(model, ChatGoogleGenerativeAI)


def test_build_model_with_deepseek(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-test-key")
    model = build_model(provider="deepseek")
    assert isinstance(model, ChatOpenAI)
    assert model.model == "deepseek-v4-pro"
    assert "api.deepseek.com" in str(model.openai_api_base)


def test_build_model_with_glm(monkeypatch):
    monkeypatch.setenv("GLM_API_KEY", "sk-test-glm")
    model = build_model(provider="glm")
    assert isinstance(model, ChatOpenAI)
    assert model.model == "glm-5.2"
    assert "open.bigmodel.cn" in str(model.openai_api_base)


def test_build_model_deepseek_missing_key(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="DEEPSEEK_API_KEY"):
        build_model(provider="deepseek")


def test_build_model_unknown_provider():
    with pytest.raises(KeyError, match="nonexistent"):
        build_model(provider="nonexistent")
