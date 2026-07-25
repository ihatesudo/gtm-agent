  ### How GCP Vertex AI Auth Works: Local vs Server

   Environment                      | How Authentication Works         | Requires gcloud CLI?
  ----------------------------------|----------------------------------|----------------------------------
   Local Machine                    | Uses Application Default         | Yes (used once locally to
                                    | Credentials (ADC) located at     | generate ADC)
                                    | ~/.config/gcloud/application_def |
                                    | ault_credentials.json (created   |
                                    | when you run gcloud auth         |
                                    | application-default login).      |
   Production Server (Cloudflare /  | Uses a GCP Service Account Key.  | No CLI required
   Render / Docker / Appwrite)      | You pass the JSON key string via |
                                    | environment variable             |
                                    | GOOGLE_APPLICATION_CREDENTIALS.  |
  ──────
  ### How to Use Your $300 GCP Trial Credits on a Server (No ADC CLI Needed)

  When deploying to a server, you don't use gcloud auth. Here is how you use your GCP Trial Credits in
  production:

  1. Create a Service Account in GCP Console:
      • Go to GCP Console → IAM & Admin → Service Accounts https://console.cloud.google.com/iam-
      admin/serviceaccounts.
      • Click Create Service Account (e.g., mastra-agent-sa).
      • Assign the role: Vertex AI User.
  2. Download Key JSON:
      • Click your new Service Account → Keys tab → Add Key → Create new key (JSON).
  3. Set Server Environment Variables:
  Set the following variables in your server environment (or Cloudflare / Render / .env):
    GENAI_PROVIDER=vertex
    GOOGLE_GENAI_USE_VERTEXAI=true
    GOOGLE_CLOUD_PROJECT=project-babe4c82-37e1-4f22-ac0
    GOOGLE_CLOUD_LOCATION=us-central1
    GOOGLE_APPLICATION_CREDENTIALS={"type":"service_account","project_id":"project-babe4c82-37e1-4f22-ac0",
  ...}


  The Google SDK automatically reads GOOGLE_APPLICATION_CREDENTIALS on the server and consumes your $300
  GCP Trial Credits without needing any gcloud CLI!
  ──────
  ### Summary of Recommended Options

  1. For GCP Trial Credits ($300): Use GENAI_PROVIDER=vertex with local ADC on Mac, and
  GOOGLE_APPLICATION_CREDENTIALS (Service Account JSON) on your server.
  2. For Zero-Config Simplicity: Use GENAI_PROVIDER=openrouter with OPENROUTER_API_KEY. It works
  identically on both local and server with zero GCP Service Account setup!