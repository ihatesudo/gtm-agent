"""Regression checks for the browser-side Appwrite Magic Link flow.

These tests deliberately inspect the shipped source because the browser bridge is
compiled into the static Reflex export. They catch broken UI-to-state bindings
before an Appwrite Sites deployment is created.
"""

from __future__ import annotations

import ast
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WEB_APP = ROOT / "marketing_agent_web" / "marketing_agent_web.py"
AUTH_BRIDGE = ROOT / "marketing_agent_web" / "appwrite_auth.js"


class MagicLinkContractTests(unittest.TestCase):
    def test_email_input_updates_login_state(self) -> None:
        """Typing an email must reach ``start_magic_link`` before button click."""
        module = ast.parse(WEB_APP.read_text())
        login_page = next(
            node for node in module.body if isinstance(node, ast.FunctionDef) and node.name == "login_page"
        )
        inputs = [
            node
            for node in ast.walk(login_page)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and isinstance(node.func.value, ast.Name)
            and node.func.value.id == "rx"
            and node.func.attr == "input"
        ]
        self.assertTrue(inputs, "login_page must render an email input")
        self.assertTrue(
            any(
                any(
                    keyword.arg == "on_change"
                    and isinstance(keyword.value, ast.Attribute)
                    and keyword.value.attr == "set_login_email"
                    for keyword in call.keywords
                )
                for call in inputs
            ),
            "the email input must bind on_change to MarketingState.set_login_email",
        )
        self.assertTrue(
            any(
                any(
                    keyword.arg == "debounce_timeout"
                    and isinstance(keyword.value, ast.Constant)
                    and keyword.value.value == 0
                    for keyword in call.keywords
                )
                for call in inputs
            ),
            "the email input must not debounce state updates before the sign-in click",
        )

    def test_magic_link_errors_return_to_reflex(self) -> None:
        """A browser rejection must clear the Sending state with a useful error."""
        bridge = AUTH_BRIDGE.read_text()
        app = WEB_APP.read_text()
        self.assertIn("async sendMagicLink(email, callbackUrl)", bridge)
        self.assertIn('this.request("/account/tokens/magic-url"', bridge)
        self.assertNotIn("window.Appwrite", bridge)
        self.assertIn("catch (error)", bridge)
        self.assertIn("return { ok: false, error:", bridge)
        self.assertIn("result.get(\"error\")", app)

    def test_callback_uses_the_token_session_endpoint_and_returns_errors(self) -> None:
        """Opening a Magic URL must exchange its token for a session once."""
        bridge = AUTH_BRIDGE.read_text()
        app = WEB_APP.read_text()
        self.assertIn('this.request("/account/sessions/token"', bridge)
        self.assertNotIn("/account/sessions/magic-url", bridge)
        self.assertIn("async finishMagicLink()", bridge)
        self.assertIn('return { ok: false, error:', bridge)
        self.assertIn('identity.get("error")', app)

    def test_auth_calls_wait_for_deferred_browser_scripts(self) -> None:
        """Initial page hydration must not race or depend on page script timing."""
        app = WEB_APP.read_text()
        self.assertIn("def _auth_script(call: str)", app)
        self.assertIn('"if (!window.GTMAuth) {"', app)
        self.assertIn("+ AUTH_BRIDGE_SCRIPT", app)
        self.assertIn("while (!window.GTMAuth)", app)
        self.assertIn("AUTH_BRIDGE_SCRIPT", app)
        self.assertNotIn('rx.script(src=rx.asset("appwrite_auth.js"', app)
        self.assertIn('_auth_script("restoreSession()")', app)
        self.assertIn("_auth_script(\n            f\"sendMagicLink", app)


if __name__ == "__main__":
    unittest.main()
