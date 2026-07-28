"""ASCII animations for the CLI REPL.

Small, dependency-free terminal animations used as transition/loading flourishes
so the agent feels alive while thinking or switching context. All animations
are pure functions of a frame index — making them trivial to unit-test without
any terminal or time dependency.

Design:
- Each animation is a list of frame strings. ``frame(name, i)`` returns frame ``i``
  (wrapping with modulo), so tests assert on exact strings, no sleeping.
- ``spinner()`` is a context manager that spins a frame sequence on stderr while
  a block runs; it clears the line on exit. Respects ``NO_COLOR`` / non-TTY by
  rendering the static first frame only (no flicker on pipes/logs).
- ``banner()`` prints the startup ASCII logo.

Nothing here blocks or depends on the network/agent — safe to import anywhere.
"""

from __future__ import annotations

import itertools
import os
import sys
import threading
import time
from contextlib import contextmanager
from typing import Iterator

# ---------------------------------------------------------------------------
# Frame data (pure data → easy to test)
# ---------------------------------------------------------------------------

# A classic braille dot spinner — compact, works in any terminal.
_DOTS: tuple[str, ...] = ("⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏")

# ASCII-only spinner for terminals without braille/unicode box support.
_ASCII_DOTS: tuple[str, ...] = ("|", "/", "-", "\\")

# A "thinking" pulse — three dots that grow.
_PULSE: tuple[str, ...] = ("·  ", "·· ", "···", " ··", "  ·", "   ")

# Loading bar segments — a fixed-width progress bar that fills left to right.
_BAR_WIDTH = 12
_BAR_EMPTY = "░"
_BAR_FULL = "█"
_BARS: tuple[str, ...] = tuple(
    (_BAR_FULL * i).ljust(_BAR_WIDTH, _BAR_EMPTY) for i in range(_BAR_WIDTH + 1)
)

# The startup banner.
_BANNER = r"""
  __  __       _    _              _                    _
 |  \/  | __ _| | _(_) ___ _ __   | |__   ___ _ __ ___ (_) ___ ___
 | |\/| |/ _` | |/ / |/ _ \ '_ \  | '_ \ / _ \ '__/ _ \| |/ __/ __|
 | |  | | (_| |   <| |  __/ | | | | | | |  __/ | | (_) | | (__\__ \
 |_|  |_|\__,_|_|\_\_|\___|_| |_| |_| |_|\___|_|  \___/|_|\___|___/
"""

_ANIMATIONS: dict[str, tuple[str, ...]] = {
    "dots": _DOTS,
    "ascii": _ASCII_DOTS,
    "pulse": _PULSE,
    "bar": _BARS,
}


def frames(name: str) -> tuple[str, ...]:
    """Return the frame tuple for a named animation. Raises KeyError if unknown."""
    if name not in _ANIMATIONS:
        raise KeyError(f"Unknown animation {name!r}. Known: {sorted(_ANIMATIONS)}")
    return _ANIMATIONS[name]


def frame(name: str, i: int) -> str:
    """Return frame ``i`` of animation ``name`` (wraps with modulo)."""
    seq = frames(name)
    return seq[i % len(seq)]


def cycle(name: str) -> Iterator[str]:
    """Infinite iterator over an animation's frames (for live use)."""
    return itertools.cycle(frames(name))


# ---------------------------------------------------------------------------
# Terminal-aware rendering
# ---------------------------------------------------------------------------

@contextmanager
def spinner(label: str = "thinking", name: str = "dots", interval: float = 0.08):
    """Spin an animation on stderr while a block runs, then clear it.

    Renders the label + current frame, updating in place via carriage return.
    In a non-TTY/NO_COLOR context, it prints the label once (no animation) so
    logs stay clean.
    """
    # Non-interactive: emit a single static line, no flicker.
    if not (sys.stderr.isatty() and os.environ.get("NO_COLOR") is None):
        sys.stderr.write(f"  {label}…\n")
        sys.stderr.flush()
        yield
        return

    stop = threading.Event()

    def _spin() -> None:
        for i in itertools.count():
            if stop.is_set():
                break
            sys.stderr.write(f"\r  {label} {frame(name, i)} ")
            sys.stderr.flush()
            time.sleep(interval)

    t = threading.Thread(target=_spin, daemon=True)
    t.start()
    try:
        yield
    finally:
        stop.set()
        t.join(timeout=interval * 2)
        # Clear the spinner line.
        sys.stderr.write("\r" + " " * (len(label) + 6) + "\r")
        sys.stderr.flush()


def banner(color: bool = True) -> str:
    """Return the startup banner string. ``color`` toggles ANSI cyan."""
    out = _BANNER
    if color:
        return f"\033[36m{out}\033[0m"
    return out


def progress_bar(fraction: float, width: int = _BAR_WIDTH, label: str = "") -> str:
    """Render a one-shot progress bar string for ``fraction`` in [0, 1]."""
    fraction = max(0.0, min(1.0, fraction))
    filled = round(fraction * width)
    bar = _BAR_FULL * filled + _BAR_EMPTY * (width - filled)
    pct = round(fraction * 100)
    prefix = f"{label} " if label else ""
    return f"{prefix}[{bar}] {pct}%"
