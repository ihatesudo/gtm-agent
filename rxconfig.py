"""Reflex configuration for the Marketing Agent web app."""

import reflex as rx
from reflex_base.plugins.sitemap import SitemapPlugin


config = rx.Config(
    app_name="marketing_agent_web",
    # Appwrite Sites serves the static frontend while Render hosts this backend.
    # HTTP polling avoids relying on a cross-origin WebSocket upgrade through
    # the free Render proxy; Reflex still maintains normal state events.
    transport="polling",
    plugins=[
        rx.plugins.RadixThemesPlugin(
            theme=rx.theme(appearance="light", accent_color="green", radius="large")
        )
    ],
    # This is an authenticated app; its login/callback routes should not be
    # published in a search-engine sitemap.
    disable_plugins=[SitemapPlugin],
)
