# Deployment TODO

- [x] Local deployment preparation is complete: `Dockerfile`, `render.yaml`, and the Appwrite Sites build targets are present and the Docker image/static export were verified.
- [x] Restart Codex so the Render MCP is available in the new session.
- [ ] Deploy `render.yaml` through Render MCP and wait for the backend URL. The Render service has been created at `https://marketing-agent-api-ib4z.onrender.com`, but its first build failed because GitHub `main` does not yet contain `Dockerfile`.
- [ ] Push commit `382d715` (`add render and reflex backend`) to `origin/main`, then redeploy `srv-d9f3phfavr4c73c3qlk0`. The configured GitHub credentials currently receive HTTP 403 when pushing to `ihatesudo/gtm-agent`.
- [ ] In Render, set `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `APPWRITE_ENDPOINT`, and `APPWRITE_PROJECT_ID`.
- [ ] Create an Appwrite **Static Site** and copy its `*.appwrite.network` URL.
- [ ] Add that Appwrite Sites hostname as a **Web platform** in the Appwrite project.
- [ ] In Render, set `REFLEX_CORS_ALLOWED_ORIGINS` to the Appwrite Site URL.
- [ ] Build the frontend:

  ```bash
  make hosting-build BACKEND_URL=https://your-api.onrender.com SITE_URL=https://your-site.appwrite.network
  ```

- [ ] Install/login to Appwrite CLI and initialise the Site configuration; set its output path to `.web/build/client`.
- [ ] Deploy the frontend:

  ```bash
  make appwrite-deploy BACKEND_URL=https://your-api.onrender.com SITE_URL=https://your-site.appwrite.network
  ```

- [ ] Open the Appwrite Site, complete a Magic Link sign-in, and send a test brief.
