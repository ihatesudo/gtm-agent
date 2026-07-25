  1. Missing Standard Environment Variable Names:
  Mastra Studio and the underlying Vercel AI SDK (@ai-sdk/google) look specifically for GOOGLE_API_KEY or
  GOOGLE_GENERATIVE_AI_API_KEY when initializing Google Gemini models (google/gemini-*). In .env, your key
  was named GEMINI_API_KEY.
  2. Filtered prepare-local-worker-env.mjs Script:
  The script mastra/scripts/prepare-local-worker-env.mjs was hardcoded to extract only GEMINI_API_KEY,
  TURSO_DATABASE_URL, and TURSO_AUTH_TOKEN into .mastra/output/.dev.vars. Because it did not forward
  GOOGLE_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY, Mastra Studio saw empty keys in process.env and flagged
  the warning.
  ──────
  ### Fixes Applied

  • **Updated prepare-local-worker-env.mjs**:
  Automatically aliases GEMINI_API_KEY to GOOGLE_API_KEY and GOOGLE_GENERATIVE_AI_API_KEY if missing, and
  passes all .env variables directly into .mastra/output/.dev.vars.
  • **Updated .env**:
  Added GOOGLE_API_KEY and GOOGLE_GENERATIVE_AI_API_KEY.
  ──────
  ### Regarding GCP Vertex AI & Trial Credits

  │ Is using GCP Vertex AI with trial credits the right way?

  1. For Local & Cloudflare Worker Development (Recommended: Google AI Studio API Key)
      • Google AI Studio (GOOGLE_API_KEY) provides free tier access (up to 15 requests/min for Gemini 2.5
      Flash/Pro) without needing any GCP billing or IAM service accounts.
      • It works instantly in mastra dev, wrangler dev, and local React/Vite servers without needing
      filesystem credentials.
  2. Why GCP Vertex AI (GENAI_PROVIDER=vertex / ADC) Was Hanging
      • Vertex AI relies on Google Cloud Application Default Credentials (ADC), which reads ~/.
      config/gcloud/application_default_credentials.json on your Mac.
      • When running inside Cloudflare Workers (wrangler dev), the edge runtime sandbox blocks local
      filesystem access, preventing it from reading your ADC file and causing the connection to hang.
      • To use Vertex AI in production/workers, you would need to export a GCP Service Account JSON key
      into environment variables instead of using local gcloud auth.
  Verdict: Using GENAI_PROVIDER=api with GOOGLE_API_KEY is the simplest, most reliable, and free option
  for local agent development.

  