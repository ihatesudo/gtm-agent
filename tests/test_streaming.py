"""Tests for streaming logic — _iter_blocks capability awareness."""

from marketing_agent.__main__ import _iter_blocks


class FakeGeminiChunk:
    """Simulates a Gemini chunk with optional thinking/text blocks."""
    def __init__(self, thinking=None, text=None):
        blocks = []
        if thinking is not None:
            blocks.append({"type": "thinking", "thinking": thinking})
        if text is not None:
            blocks.append({"type": "text", "text": text})
        self.content = blocks


class FakeTextChunk:
    """Simulates a plain string-text chunk (OpenAI-compatible)."""
    def __init__(self, text):
        self.content = text


def test_gemini_thinking_block_preserved():
    caps = None
    blocks = _iter_blocks(FakeGeminiChunk(thinking="hmm", text="answer"), caps)
    assert ("thinking", "hmm") in blocks
    assert ("text", "answer") in blocks


def test_thinking_block_suppressed_when_not_supported():
    caps = {"thinking": False, "tools": True, "vision": False}
    blocks = _iter_blocks(FakeGeminiChunk(thinking="hmm", text="answer"), caps)
    assert ("thinking", "hmm") not in blocks
    assert ("text", "answer") in blocks


def test_thinking_block_preserved_when_supported():
    caps = {"thinking": True, "tools": True, "vision": False}
    blocks = _iter_blocks(FakeGeminiChunk(thinking="hmm", text="answer"), caps)
    assert ("thinking", "hmm") in blocks
    assert ("text", "answer") in blocks


def test_plain_text_without_capabilities():
    blocks = _iter_blocks(FakeTextChunk("hello world"))
    assert blocks == [("text", "hello world")]


def test_empty_chunk():
    assert _iter_blocks(FakeTextChunk("")) == []
    assert _iter_blocks(FakeGeminiChunk()) == []
