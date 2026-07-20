"""Deployable Reflex interface for the Marketing Agent.

The existing agent and its LangGraph tools remain the source of truth.  This
module only replaces the terminal REPL with a browser UI.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import reflex as rx
from langchain_core.messages import HumanMessage

from marketing_agent import roles_loader, skills_loader
from marketing_agent.agent import build_agent


DIRECTOR = "director"
APPWRITE_ENDPOINT = os.environ.get("APPWRITE_ENDPOINT", "").strip().rstrip("/")
APPWRITE_PROJECT_ID = os.environ.get("APPWRITE_PROJECT_ID", "").strip()
APPWRITE_CONFIG = json.dumps({"endpoint": APPWRITE_ENDPOINT, "projectId": APPWRITE_PROJECT_ID})
AUTH_BRIDGE_SCRIPT = Path(__file__).with_name("appwrite_auth.js").read_text()


def _auth_script(call: str) -> str:
    """Run an Appwrite browser call without depending on page-script timing."""
    return (
        "(async () => {"
        "if (!window.GTMAuth) {"
        + AUTH_BRIDGE_SCRIPT
        + "}"
        "const deadline = Date.now() + 10000;"
        "while (!window.GTMAuth) {"
        "if (Date.now() >= deadline) throw new Error('Appwrite authentication scripts did not load. Refresh and try again.');"
        "await new Promise((resolve) => setTimeout(resolve, 50));"
        "}"
        f"return window.GTMAuth.{call};"
        "})()"
    )


def _text_from_chunk(chunk: object) -> str:
    """Return only user-facing text from a LangChain streaming chunk.

    Reasoning blocks are intentionally excluded. The UI shows tool progress,
    while keeping model internals out of the persisted chat transcript.
    """
    content = getattr(chunk, "content", "")
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    text: list[str] = []
    for block in content:
        if isinstance(block, str):
            text.append(block)
        elif isinstance(block, dict) and block.get("type") == "text":
            value = block.get("text", "")
            if value:
                text.append(value)
    return "".join(text)


class MarketingState(rx.State):
    """Per-browser-session chat state."""

    prompt: str = ""
    active_role: str = DIRECTOR
    active_skill: str = ""
    language: str = "zh"
    messages: list[tuple[str, str]] = []
    activity: list[str] = []
    is_running: bool = False
    error: str = ""
    login_email: str = ""
    login_message: str = ""
    user_id: str = ""
    user_email: str = ""

    @rx.var
    def is_authenticated(self) -> bool:
        return bool(self.user_id)

    @rx.var
    def role_options(self) -> list[str]:
        return [DIRECTOR, *[role.name for role in roles_loader.list_roles()]]

    @rx.var
    def skill_options(self) -> list[str]:
        return ["", *[skill.name for skill in skills_loader.list_skills()]]

    @rx.var
    def role_label(self) -> str:
        return "Director" if self.active_role == DIRECTOR else self.active_role

    @rx.var
    def skill_label(self) -> str:
        return self.active_skill or "No playbook"

    @rx.var
    def language_label(self) -> str:
        return "中文" if self.language == "zh" else "English"

    @rx.event
    def clear_chat(self) -> None:
        if not self.is_running:
            self.messages = []
            self.activity = []
            self.error = ""

    @rx.event
    def set_role(self, role: str) -> None:
        self.active_role = role

    @rx.event
    def set_skill(self, skill: str) -> None:
        self.active_skill = skill

    @rx.event
    def set_language(self, language: str) -> None:
        self.language = "en" if language == "en" else "zh"

    @rx.event
    def set_prompt(self, prompt: str) -> None:
        self.prompt = prompt

    @rx.event
    def set_login_email(self, email: str) -> None:
        self.login_email = email

    def _verify_appwrite_jwt(self, jwt: str) -> dict[str, str]:
        """Validate a browser-issued Appwrite JWT before trusting its identity."""
        if not APPWRITE_ENDPOINT or not APPWRITE_PROJECT_ID:
            raise RuntimeError("Appwrite is not configured. Set APPWRITE_ENDPOINT and APPWRITE_PROJECT_ID.")
        request = Request(
            f"{APPWRITE_ENDPOINT}/account",
            headers={
                "X-Appwrite-Project": APPWRITE_PROJECT_ID,
                "X-Appwrite-JWT": jwt,
            },
        )
        try:
            with urlopen(request, timeout=10) as response:  # nosec B310 - endpoint is deployer config
                payload = json.loads(response.read())
        except HTTPError as exc:
            raise RuntimeError("Your sign-in session could not be verified. Please request a new link.") from exc
        except URLError as exc:
            raise RuntimeError("Could not reach Appwrite. Check APPWRITE_ENDPOINT.") from exc
        return {"id": payload["$id"], "email": payload["email"]}

    @rx.event
    def start_magic_link(self):
        email = self.login_email.strip().lower()
        if not APPWRITE_ENDPOINT or not APPWRITE_PROJECT_ID:
            self.login_message = "Appwrite is not configured yet. Add APPWRITE_ENDPOINT and APPWRITE_PROJECT_ID."
            return
        if "@" not in email:
            self.login_message = "Enter a valid email address."
            return
        self.login_message = "Sending your sign-in link…"
        script = _auth_script(
            f"sendMagicLink({json.dumps(email)}, window.location.origin + '/auth/callback')"
        )
        return rx.call_script(script, callback=MarketingState.magic_link_sent)

    @rx.event
    def magic_link_sent(self, result: dict) -> None:
        if result.get("ok"):
            self.login_message = "Check your inbox for a secure sign-in link."
        else:
            self.login_message = str(result.get("error") or "Could not send the sign-in link.")

    @rx.event
    def accept_appwrite_identity(self, identity: dict) -> None:
        if not identity.get("ok", True):
            return
        try:
            verified = self._verify_appwrite_jwt(str(identity.get("jwt", "")))
        except RuntimeError as exc:
            self.login_message = str(exc)
            return
        self.user_id = verified["id"]
        self.user_email = verified["email"]
        self.login_message = ""

    @rx.event
    def restore_session(self):
        if APPWRITE_ENDPOINT and APPWRITE_PROJECT_ID:
            return rx.call_script(_auth_script("restoreSession()"), callback=MarketingState.accept_appwrite_identity)

    @rx.event
    def complete_magic_link(self):
        if APPWRITE_ENDPOINT and APPWRITE_PROJECT_ID:
            return rx.call_script(_auth_script("finishMagicLink()"), callback=MarketingState.finish_identity)

    @rx.event
    def finish_identity(self, identity: dict):
        if not identity.get("ok", True):
            self.login_message = str(identity.get("error") or "Could not complete sign-in. Request a new link and try again.")
            return
        self.accept_appwrite_identity(identity)
        if self.user_id:
            return rx.redirect("/")

    @rx.event
    def sign_out(self):
        self.user_id = ""
        self.user_email = ""
        self.messages = []
        self.activity = []
        return rx.call_script(_auth_script("signOut()"), callback=MarketingState.logout_complete)

    @rx.event
    def logout_complete(self, _result: dict):
        return rx.redirect("/login")

    @rx.event(background=True)
    async def send_message(self) -> AsyncIterator[None]:
        """Run LangGraph without blocking the browser session."""
        async with self:
            task = self.prompt.strip()
            if not self.user_id:
                self.error = "Sign in before sending a brief."
                return
            if not task or self.is_running:
                return
            role = None if self.active_role == DIRECTOR else self.active_role
            skill = self.active_skill or None
            language = self.language
            self.messages = [*self.messages, ("user", task), ("assistant", "")]
            self.prompt = ""
            self.error = ""
            self.activity = ["Starting the marketing team…" if language == "en" else "正在启动营销团队…"]
            self.is_running = True

        answer = ""
        try:
            agent = build_agent(include_thoughts=False, skill=skill, role=role, language=language)
            async for event in agent.astream_events(
                {"messages": [HumanMessage(content=task)]}, version="v2"
            ):
                kind = event["event"]
                if kind == "on_chat_model_stream":
                    answer += _text_from_chunk(event["data"].get("chunk"))
                    if answer:
                        async with self:
                            self.messages = [*self.messages[:-1], ("assistant", answer)]
                elif kind == "on_tool_start":
                    name = event.get("name", "tool")
                    async with self:
                        self.activity = [*self.activity, f"Using {name}…" if language == "en" else f"正在使用 {name}…"]
                elif kind == "on_tool_end":
                    name = event.get("name", "tool")
                    async with self:
                        self.activity = [*self.activity, f"Finished {name}." if language == "en" else f"已完成 {name}。"]
        except Exception as exc:  # Surface configuration/API failures in the app.
            async with self:
                self.error = str(exc)
                if not answer:
                    self.messages = self.messages[:-1]
        finally:
            async with self:
                self.is_running = False
                self.activity = [*self.activity, "Done." if language == "en" else "已完成。"]
        yield


def message_bubble(message: tuple[str, str]) -> rx.Component:
    is_user = message[0] == "user"
    return rx.box(
        rx.text(rx.cond(is_user, "You", "Marketing team"), weight="bold", size="2"),
        rx.markdown(message[1]),
        align_self=rx.cond(is_user, "flex-end", "flex-start"),
        background=rx.cond(is_user, "#E4F6EE", "#FFFFFF"),
        border="1px solid #DCE4E0",
        border_radius="16px",
        box_shadow="0 1px 2px rgba(15, 23, 42, 0.05)",
        max_width="90%",
        padding="1rem",
        width="fit-content",
    )


def sidebar() -> rx.Component:
    return rx.box(
        rx.vstack(
            rx.box(
                rx.text("GTM", color="#42B883", weight="bold", size="6"),
                rx.text("Marketing Agent", weight="bold", size="5"),
                rx.text("A focused, specialist-led marketing team.", color="#60706A", size="2"),
                spacing="1",
            ),
            rx.divider(),
            rx.text("WORKING AS", weight="bold", color="#60706A", size="1"),
            rx.select(
                MarketingState.role_options,
                value=MarketingState.active_role,
                on_change=MarketingState.set_role,
                width="100%",
            ),
            rx.text("PLAYBOOK", weight="bold", color="#60706A", size="1"),
            rx.select(
                MarketingState.skill_options,
                value=MarketingState.active_skill,
                on_change=MarketingState.set_skill,
                placeholder="No playbook",
                width="100%",
            ),
            rx.text("RESPONSE LANGUAGE", weight="bold", color="#60706A", size="1"),
            rx.select(
                ["zh", "en"],
                value=MarketingState.language,
                on_change=MarketingState.set_language,
                width="100%",
            ),
            rx.spacer(),
            rx.text(MarketingState.user_email, color="#60706A", size="1"),
            rx.button("Sign out", on_click=MarketingState.sign_out, variant="ghost", width="100%"),
            rx.button("Clear conversation", on_click=MarketingState.clear_chat, variant="soft", width="100%"),
            rx.text("Agent outputs can save to the server's output/ folder.", color="#60706A", size="1"),
            height="100%",
            padding="1.25rem",
            spacing="4",
        ),
        background="#F6F9F7",
        border_right="1px solid #DCE4E0",
        height="100vh",
        width="280px",
        position="fixed",
        display=["none", "none", "block"],
    )


def chat_screen() -> rx.Component:
    return rx.box(
        sidebar(),
        rx.vstack(
            rx.hstack(
                rx.box(
                    rx.heading("Command your marketing team", size="6"),
                    rx.text(
                        "Director base · ", MarketingState.role_label,
                        " · ", MarketingState.skill_label,
                        color="#60706A", size="2",
                    ),
                ),
                rx.spacer(),
                rx.badge("Live", color_scheme="green"),
                width="100%",
                align="center",
            ),
            rx.cond(
                MarketingState.messages.length() > 0,
                rx.vstack(rx.foreach(MarketingState.messages, message_bubble), width="100%", spacing="4"),
                rx.center(
                    rx.vstack(
                        rx.heading("Brief the team", size="7"),
                        rx.text("Ask for strategy, campaigns, copy, SEO, lifecycle work, and more."),
                        rx.text("Try: “Create a 90-day North America launch plan for my B2B SaaS.”", color="#60706A", size="2"),
                        align="center",
                        spacing="3",
                    ),
                    flex="1",
                ),
            ),
            rx.cond(
                MarketingState.activity.length() > 0,
                rx.box(
                    rx.text("Activity", weight="bold", size="2"),
                    rx.foreach(MarketingState.activity, lambda item: rx.text("• ", item, color="#60706A", size="2")),
                    background="#F6F9F7", border_radius="12px", padding="0.75rem", width="100%",
                ),
            ),
            rx.cond(MarketingState.error != "", rx.callout(MarketingState.error, icon="triangle_alert", color_scheme="red", width="100%")),
            rx.hstack(
                rx.text_area(
                    value=MarketingState.prompt,
                    on_change=MarketingState.set_prompt,
                    placeholder="Describe the outcome, audience, constraints, and deadline…",
                    min_height="96px",
                    flex="1",
                ),
                rx.button(
                    "Working…",
                    "Send brief",
                    on_click=MarketingState.send_message,
                    loading=MarketingState.is_running,
                    disabled=MarketingState.is_running,
                    align_self="flex-end",
                    color_scheme="green",
                ),
                width="100%",
                align="end",
            ),
            min_height="100vh",
            max_width="980px",
            margin_left=["0", "0", "280px"],
            margin_right="auto",
            padding=["1.25rem", "2rem", "2.5rem"],
            width=["100%", "100%", "calc(100% - 280px)"],
            spacing="5",
        ),
        rx.script("window.GTM_APPWRITE_CONFIG = " + APPWRITE_CONFIG + ";"),
        rx.script(AUTH_BRIDGE_SCRIPT),
        background="#FCFDFC",
        min_height="100vh",
    )


def login_page() -> rx.Component:
    return rx.center(
        rx.vstack(
            rx.text("GTM", color="#42B883", weight="bold", size="6"),
            rx.heading("Sign in to your marketing team", size="7"),
            rx.text("We’ll email you a one-time sign-in link. No password or Google account needed."),
            rx.input(
                value=MarketingState.login_email,
                on_change=MarketingState.set_login_email,
                debounce_timeout=0,
                placeholder="you@company.com",
                type="email",
                width="100%",
            ),
            rx.button("Email me a sign-in link", on_click=MarketingState.start_magic_link, width="100%", color_scheme="green"),
            rx.cond(MarketingState.login_message != "", rx.callout(MarketingState.login_message, width="100%")),
            rx.text("Appwrite Magic URL authentication", color="#60706A", size="1"),
            width="min(440px, 100%)",
            padding="2rem",
            spacing="4",
        ),
        rx.script("window.GTM_APPWRITE_CONFIG = " + APPWRITE_CONFIG + ";"),
        rx.script(AUTH_BRIDGE_SCRIPT),
        min_height="100vh",
        background="#F6F9F7",
        padding="1rem",
    )


def callback_page() -> rx.Component:
    return rx.center(
        rx.vstack(
            rx.spinner(size="3"),
            rx.heading("Signing you in…", size="6"),
            rx.text("Verifying your secure link."),
            rx.cond(MarketingState.login_message != "", rx.callout(MarketingState.login_message, width="100%")),
            width="min(440px, 100%)",
            align="center",
            spacing="4",
        ),
        rx.script("window.GTM_APPWRITE_CONFIG = " + APPWRITE_CONFIG + ";"),
        rx.script(AUTH_BRIDGE_SCRIPT),
        min_height="100vh",
        background="#F6F9F7",
    )


def chat_page() -> rx.Component:
    """Root route. Rendering chat controls is gated by verified session state."""
    return rx.cond(
        MarketingState.is_authenticated,
        chat_screen(),
        rx.center(
            rx.vstack(
                rx.heading("Sign in required", size="7"),
                rx.text("Use a passwordless email link to access your marketing workspace."),
                rx.button("Go to sign in", on_click=rx.redirect("/login"), color_scheme="green"),
                align="center",
                spacing="4",
            ),
            min_height="100vh",
            background="#F6F9F7",
        ),
    )


app = rx.App()
app.add_page(chat_page, route="/", title="GTM Marketing Agent", description="Your deployable AI marketing team", on_load=MarketingState.restore_session)
app.add_page(login_page, route="/login", title="Sign in · GTM Marketing Agent")
app.add_page(callback_page, route="/auth/callback", title="Signing in · GTM Marketing Agent", on_load=MarketingState.complete_magic_link)
