# Deployment TODO

- [x] Local deployment preparation is complete: `Dockerfile`, `render.yaml`, and the Appwrite Sites build targets are present and the Docker image/static export were verified.
- [x] Restart Codex so the Render MCP is available in the new session.
- [x] Deploy `render.yaml` through Render MCP and wait for the backend URL: `https://marketing-agent-api-ib4z.onrender.com` (`/ping` returns `pong`).
- [x] Push the deployment commit to `origin/main` and redeploy Render service `srv-d9f3phfavr4c73c3qlk0`.
- [ ] In Render, set `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `APPWRITE_ENDPOINT`, and `APPWRITE_PROJECT_ID`.
- [ ] Create an Appwrite **Static Site** and copy its `*.appwrite.network` URL.
- [ ] Add that Appwrite Sites hostname as a **Web platform** in the Appwrite project.
- [x] In Render, set `REFLEX_CORS_ALLOWED_ORIGINS` to `https://6a5e42400007e2d2f98c.appwrite.network`.
- [x] Build the frontend for `https://marketing-agent-api-ib4z.onrender.com` and `https://6a5e42400007e2d2f98c.appwrite.network`; output is in `.web/build/client`.

  ```bash
  make hosting-build BACKEND_URL=https://your-api.onrender.com SITE_URL=https://your-site.appwrite.network
  ```

- [x] Install/login to Appwrite CLI and initialise the Site configuration; it deploys the repository's `.web/build/client` output.
- [ ] Deploy the frontend:

  ```bash
  make appwrite-deploy BACKEND_URL=https://your-api.onrender.com SITE_URL=https://your-site.appwrite.network
  ```

- [ ] Open the Appwrite Site, complete a Magic Link sign-in, and send a test brief.
