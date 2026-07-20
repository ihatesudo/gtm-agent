/* Browser-only Appwrite bridge. The endpoint and project ID are public config;
 * never put an Appwrite API key in this file or in a browser environment value. */
window.GTMAuth = {
  configured() {
    return Boolean(window.GTM_APPWRITE_CONFIG?.endpoint && window.GTM_APPWRITE_CONFIG?.projectId);
  },

  async request(path, { method = "GET", body } = {}) {
    if (!this.configured()) throw new Error("Appwrite is not configured yet.");
    const response = await fetch(window.GTM_APPWRITE_CONFIG.endpoint + path, {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-Appwrite-Project": window.GTM_APPWRITE_CONFIG.projectId,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || "Appwrite request failed.");
    return payload;
  },

  async sendMagicLink(email, callbackUrl) {
    try {
      await this.request("/account/tokens/magic-url", { method: "POST", body: {
        userId: "unique()",
        email,
        url: callbackUrl,
      }});
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || "Could not send the sign-in link." };
    }
  },

  async finishMagicLink() {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get("userId");
    const secret = params.get("secret");
    if (!userId || !secret) throw new Error("This sign-in link is incomplete or has already been used.");
    await this.request("/account/sessions/magic-url", { method: "POST", body: { userId, secret } });
    const [user, token] = await Promise.all([this.request("/account"), this.request("/account/jwt", { method: "POST" })]);
    return { jwt: token.jwt, userId: user.$id, email: user.email };
  },

  async restoreSession() {
    const [user, token] = await Promise.all([this.request("/account"), this.request("/account/jwt", { method: "POST" })]);
    return { jwt: token.jwt, userId: user.$id, email: user.email };
  },

  async signOut() {
    await this.request("/account/sessions/current", { method: "DELETE" });
    return { ok: true };
  },
};
