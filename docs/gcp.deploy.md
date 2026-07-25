# GCP Vertex AI Deployment & Service Account Guide

This guide explains how to configure and deploy `gtm-agent` with **Google Cloud Vertex AI** to consume your **$300 GCP Free Trial Credits** without paying for Google AI Studio API keys.

---

## 1. Authentication Architecture: Local vs. Production Server

| Environment | How Authentication Works | Requires `gcloud` CLI? |
| :--- | :--- | :--- |
| **Local Development** (Mac / PC) | Uses **Application Default Credentials (ADC)** located at `~/.config/gcloud/application_default_credentials.json`. | Yes (run once locally) |
| **Production Server** (Cloudflare / Render / Docker / Appwrite) | Uses a **GCP Service Account Key**. Pass the JSON key string via `GOOGLE_APPLICATION_CREDENTIALS`. | **No CLI required** |

---

## 2. Step-by-Step: Creating a Service Account in GCP

To authenticate requests on server deployments without interactive `gcloud` logins:

1. **Open GCP Service Accounts**:
   - Navigate to [GCP Console → IAM & Admin → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts).

2. **Create Service Account**:
   - Click **Create Service Account** and name it (e.g., `mastra-agent-sa`).
   - Assign the role **Vertex AI User** (`roles/aiplatform.user`).
   - *(Tip: If `Vertex AI User` doesn't appear in the dropdown search, filter by Role ID `aiplatform.user`, or use `Vertex AI Administrator` / `Editor`).*

3. **Generate Key JSON**:
   - Click your new Service Account → **Keys** tab → **Add Key** → **Create new key (JSON)**.
   - Save the downloaded `.json` key file.

---

## 3. Environment Configuration

### Local Development (`.env`)
Run ADC login once:
```bash
gcloud auth application-default login
```
Set in `.env`:
```env
GENAI_PROVIDER=vertex
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
```

### Production Server Setup
On your server (or Cloudflare / Render secrets), configure:
```env
GENAI_PROVIDER=vertex
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS='{"type":"service_account","project_id":"your-project-id","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"mastra-agent-sa@your-project-id.iam.gserviceaccount.com",...}'
```

> 💡 **Formatting Tip**: Enclose `GOOGLE_APPLICATION_CREDENTIALS` in single quotes `'...'` as a single-line string so line breaks inside `private_key` do not break `.env` parsing.

---

## 4. Summary

- **Local Machine**: Uses local ADC tokens (`gcloud auth application-default login`).
- **Production Server**: Uses the Service Account JSON string in `GOOGLE_APPLICATION_CREDENTIALS`.
- Both approaches consume your **$300 GCP Free Trial Credits** on Vertex AI seamlessly!