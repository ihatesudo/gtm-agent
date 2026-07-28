"""Tests for the ASCII animation module.

Animations are pure functions of a frame index, so they're tested as such —
no terminal, no sleeping, no I/O. The spinner context manager is tested with
captured stderr to verify the non-interactive path.
"""

from __future__ import annotations

import io
from contextlib import redirect_stderr

import pytest

from marketing_agent import asciimotion


# ---------------------------------------------------------------------------
# Frame data + lookup
# ---------------------------------------------------------------------------

class TestFrames:
    def test_known_animations_exist(self):
        for name in ("dots", "ascii", "pulse", "bar"):
            seq = asciimotion.frames(name)
            assert isinstance(seq, tuple)
            assert len(seq) > 1
            assert all(isinstance(f, str) for f in seq)

    def test_unknown_animation_raises(self):
        with pytest.raises(KeyError, match="Unknown animation"):
            asciimotion.frames("nonexistent")

    def test_no_duplicate_frames(self):
        # Each animation's frames should be distinct (otherwise it's not animating).
        for name in ("dots", "ascii", "pulse", "bar"):
            seq = asciimotion.frames(name)
            assert len(seq) == len(set(seq)), f"{name} has duplicate frames"

    def test_bar_animation_fills_progressively(self):
        bars = asciimotion.frames("bar")
        # Each frame should be one character longer (more filled) than the last.
        for i in range(1, len(bars)):
            assert bars[i].count(asciimotion._BAR_FULL) == bars[i - 1].count(asciimotion._BAR_FULL) + 1

    def test_ascii_animation_is_pure_ascii(self):
        # The "ascii" spinner must contain no unicode (for terminals without it).
        for f in asciimotion.frames("ascii"):
            assert f.isascii(), f"frame {f!r} is not pure ASCII"


class TestFrameIndexing:
    def test_frame_returns_correct_element(self):
        seq = asciimotion.frames("ascii")
        assert asciimotion.frame("ascii", 0) == seq[0]
        assert asciimotion.frame("ascii", 1) == seq[1]

    def test_frame_wraps_with_modulo(self):
        seq = asciimotion.frames("ascii")
        n = len(seq)
        # Index beyond length wraps around.
        assert asciimotion.frame("ascii", n) == seq[0]
        assert asciimotion.frame("ascii", n + 1) == seq[1]
        assert asciimotion.frame("ascii", 2 * n) == seq[0]

    def test_cycle_is_infinite(self):
        gen = asciimotion.cycle("ascii")
        seq = asciimotion.frames("ascii")
        # Pull more frames than exist to confirm it cycles.
        produced = [next(gen) for _ in range(len(seq) * 3)]
        assert produced[:len(seq)] == list(seq)
        assert produced[len(seq):2 * len(seq)] == list(seq)


# ---------------------------------------------------------------------------
# progress_bar
# ---------------------------------------------------------------------------

class TestProgressBar:
    def test_zero_is_empty(self):
        bar = asciimotion.progress_bar(0.0)
        assert asciimotion._BAR_FULL not in bar
        assert "0%" in bar

    def test_full_is_complete(self):
        bar = asciimotion.progress_bar(1.0)
        assert asciimotion._BAR_EMPTY not in bar
        assert "100%" in bar

    def test_half(self):
        bar = asciimotion.progress_bar(0.5)
        assert "50%" in bar

    def test_clamps_above_one(self):
        bar = asciimotion.progress_bar(1.5)
        assert "100%" in bar

    def test_clamps_below_zero(self):
        bar = asciimotion.progress_bar(-0.5)
        assert "0%" in bar

    def test_label_prefix(self):
        bar = asciimotion.progress_bar(0.3, label="SEO")
        assert bar.startswith("SEO ")


# ---------------------------------------------------------------------------
# banner
# ---------------------------------------------------------------------------

class TestBanner:
    def test_banner_contains_logo_text(self):
        b = asciimotion.banner(color=False)
        assert "GTM" in b or "marketing" in b.lower() or "__" in b

    def test_color_banner_has_ansi_codes(self):
        b = asciimotion.banner(color=True)
        assert "\033[" in b  # ANSI escape sequence present

    def test_plain_banner_no_ansi(self):
        b = asciimotion.banner(color=False)
        assert "\033[" not in b


# ---------------------------------------------------------------------------
# spinner (non-interactive path only — TTY path needs a real terminal)
# ---------------------------------------------------------------------------

class TestSpinner:
    def test_non_interactive_prints_static_label(self, monkeypatch):
        # Force non-interactive: stderr not a TTY.
        class FakeStream:
            def isatty(self):
                return False
            def write(self, s):
                pass
            def flush(self):
                pass
        monkeypatch.setattr(asciimotion.sys, "stderr", FakeStream())

        err = io.StringIO()
        with redirect_stderr(err):
            with asciimotion.spinner("loading"):
                pass
        output = err.getvalue()
        assert "loading" in output

    def test_no_color_env_prints_static_label(self, monkeypatch):
        # TTY but NO_COLOR set → still non-animated.
        class FakeTTY:
            def isatty(self):
                return True
            def write(self, s):
                pass
            def flush(self):
                pass
        monkeypatch.setattr(asciimotion.sys, "stderr", FakeTTY())
        monkeypatch.setenv("NO_COLOR", "1")

        err = io.StringIO()
        with redirect_stderr(err):
            with asciimotion.spinner("thinking"):
                pass
        assert "thinking" in err.getvalue()
