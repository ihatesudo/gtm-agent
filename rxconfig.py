"""Reflex configuration for the Marketing Agent web app."""

import reflex as rx
from reflex_base.plugins.sitemap import SitemapPlugin


config = rx.Config(
    app_name="marketing_agent_web",
    plugins=[
        rx.plugins.RadixThemesPlugin(
            theme=rx.theme(appearance="light", accent_color="green", radius="large")
        )
    ],
    # This is an authenticated app; its login/callback routes should not be
    # published in a search-engine sitemap.
    disable_plugins=[SitemapPlugin],
)
