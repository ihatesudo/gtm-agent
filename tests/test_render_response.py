"""Tests for newline preservation in _stream_run response rendering.

The specific response under test is the Notion competitive-teardown onboarding
message, which contains:
  - Paragraph breaks (\\n\\n)
  - Markdown bullet list items starting with '* '
  - Bold markers (**Product:**, **Target Audience:**, etc.)
  - A trailing newline

We simulate the agent yielding on_chat_model_stream events and capture every
sys.stdout.write call to reconstruct the rendered text.  The suite checks that
newlines are preserved whether the text arrives as one big chunk or split across
many small chunks.
"""

from __future__ import annotations

import asyncio
import io
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from marketing_agent.__main__ import _stream_run

# ---------------------------------------------------------------------------
# The exact response string the user reported as potentially broken.
# ---------------------------------------------------------------------------

NOTION_RESPONSE = (
    "Hi there! I'm ready to help you analyze Notion as if it were your client "
    "and produce a competitive teardown. To start, I need a bit more information. "
    "Could you please provide me with the following details?\n"
    "* **Product:** (You've already mentioned Notion)\n"
    "* **Target Audience:** Who is Notion primarily trying to reach? "
    "(e.g., individuals, teams, specific industries, company sizes)\n"
    "* **Market:** What specific market does Notion operate in? "
    "(e.g., productivity software, project management, knowledge management, "
    "collaboration tools)\n"
    "* **Budget:** What is the hypothetical budget for this analysis and the "
    "subsequent recommendations?\n"
    "* **Timeline:** Do you have a specific timeline in mind for this analysis "
    "and for the execution of the recommendations?\n"
    "Once I have these details, I can begin the competitive teardown. I'll focus "
    "on positioning, pricing, GTM motion, content gaps, and then provide 3 "
    "high-impact recommendations with execution steps, all in a detailed memo "
    "format. In the meantime, I can start by doing some initial research on "
    "Notion and its competitors. Would you like me to proceed with that? "
)

# Lines that MUST appear in the rendered output after joining all writes.
REQUIRED_LINES = [
    "* **Product:** (You've already mentioned Notion)",
    "* **Target Audience:** Who is Notion primarily trying to reach?",
    "* **Market:** What specific market does Notion operate in?",
    "* **Budget:** What is the hypothetical budget for this analysis",
    "* **Timeline:** Do you have a specific timeline in mind",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_text_event(text: str) -> dict:
    """Build a fake on_chat_model_stream event carrying a plain-string chunk."""

    class _Chunk:
        content = text

    return {"event": "on_chat_model_stream", "data": {"chunk": _Chunk()}}


def _split_into_chunks(text: str, size: int) -> list[dict]:
    """Return a list of events, each carrying *size* characters of *text*."""
    return [_make_text_event(text[i : i + size]) for i in range(0, len(text), size)]


async def _fake_agent(events: list[dict]):
    """Async generator that yields pre-built events, usable as astream_events."""
    for ev in events:
        yield ev


def _run_stream(events: list[dict]) -> str:
    """
    Run _stream_run with a mocked agent that yields *events*.
    Captures all sys.stdout.write calls and returns their concatenation.
    """
    captured = io.StringIO()

    agent = MagicMock()
    agent.astream_events = MagicMock(return_value=_fake_agent(events))

    with patch("sys.stdout", captured):
        asyncio.run(
            _stream_run(
                agent=agent,
                user_input="analyze Notion",
                show_thinking=False,
                color=False,
            )
        )

    return captured.getvalue()


# ---------------------------------------------------------------------------
# Tests: single chunk
# ---------------------------------------------------------------------------


def test_single_chunk_preserves_all_newlines():
    """When the full response arrives in one chunk, every \\n must survive."""
    output = _run_stream([_make_text_event(NOTION_RESPONSE)])

    # Each bullet must appear on its own line.
    for expected_line in REQUIRED_LINES:
        assert expected_line in output, (
            f"Expected line not found in rendered output:\n"
            f"  missing: {expected_line!r}\n"
            f"  output:  {output!r}"
        )


def test_single_chunk_bullet_newlines_are_newlines():
    """Markdown list bullets (\\n* ) must each be on their own line.

    We look for the sequence '\\n* ' in the output which unambiguously identifies
    a list-item bullet.  We do NOT check standalone '* ' inside bold markers
    (**text**) since those are intra-word and are not newline-separated.
    """
    output = _run_stream([_make_text_event(NOTION_RESPONSE)])

    # Count '\n* ' sequences — one per bullet in the original text.
    expected_bullets = NOTION_RESPONSE.count("\n* ")
    assert expected_bullets > 0, "NOTION_RESPONSE has no bullet lines to test"

    actual_bullets = output.count("\n* ")
    assert actual_bullets == expected_bullets, (
        f"Expected {expected_bullets} bullet lines (\\n* ) in output, "
        f"found {actual_bullets}.\n"
        f"output: {output!r}"
    )


# ---------------------------------------------------------------------------
# Tests: chunked delivery (simulates real streaming)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("chunk_size", [1, 5, 10, 50])
def test_chunked_delivery_preserves_newlines(chunk_size: int):
    """
    Regardless of chunk size the assembled text must contain every required
    bullet line intact — newlines must not be dropped or merged.
    """
    events = _split_into_chunks(NOTION_RESPONSE, chunk_size)
    output = _run_stream(events)

    for expected_line in REQUIRED_LINES:
        assert expected_line in output, (
            f"chunk_size={chunk_size}: expected line not found:\n"
            f"  missing: {expected_line!r}\n"
            f"  output:  {output!r}"
        )


def test_newline_split_across_chunks():
    """
    Regression: if a \\n arrives in its own 1-character chunk, it must still
    appear in the output and not be discarded.
    """
    # Split "line1\nline2" so the \\n is its own chunk.
    text = "line1\nline2"
    events = [
        _make_text_event("line1"),
        _make_text_event("\n"),
        _make_text_event("line2"),
    ]
    output = _run_stream(events)
    assert "line1\nline2" in output, (
        f"Newline split across chunks was lost. output={output!r}"
    )


def test_double_newline_paragraph_break():
    """
    A \\n\\n paragraph break split across two chunks must be preserved.
    """
    events = [
        _make_text_event("paragraph one\n"),
        _make_text_event("\n"),
        _make_text_event("paragraph two"),
    ]
    output = _run_stream(events)
    assert "paragraph one\n\nparagraph two" in output, (
        f"Double-newline paragraph break was lost. output={output!r}"
    )


# ---------------------------------------------------------------------------
# Tests: full response character-level fidelity
# ---------------------------------------------------------------------------


def test_full_response_character_fidelity_single_chunk():
    """The text portion of the output must contain the complete response verbatim.

    _stream_run prepends '\\n🤖 ' once via open_text() and appends a final '\\n'
    via close_think()/end write.  After stripping those framing bytes the
    inner text must be byte-for-byte identical to NOTION_RESPONSE.
    """
    output = _run_stream([_make_text_event(NOTION_RESPONSE)])

    # The prefix written by open_text() is '\n🤖 ' (1 NL + robot + space).
    # Strip it from the front, then strip the trailing '\n' added at the end.
    prefix = "\n🤖 "
    assert output.startswith(prefix), (
        f"Expected output to start with {prefix!r}, got {output[:20]!r}"
    )
    text_part = output[len(prefix):].rstrip("\n")
    assert text_part.rstrip() == NOTION_RESPONSE.rstrip(), (
        "Rendered text does not match the expected response verbatim.\n"
        f"expected: {NOTION_RESPONSE.rstrip()!r}\n"
        f"got:      {text_part.rstrip()!r}"
    )


def test_full_response_character_fidelity_char_by_char():
    """Character-by-character chunking must produce the same text as single chunk."""
    events = _split_into_chunks(NOTION_RESPONSE, 1)
    output_chunked = _run_stream(events)

    output_single = _run_stream([_make_text_event(NOTION_RESPONSE)])

    # Both must contain the same lines (order-invariant for safety, but they
    # should be identical since write order is deterministic).
    assert output_chunked == output_single, (
        "Character-by-character streaming produced different output than single-chunk.\n"
        f"single:  {output_single!r}\n"
        f"chunked: {output_chunked!r}"
    )
