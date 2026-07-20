/* Browser-only Appwrite bridge. The endpoint and project ID are public config;
 * never put an Appwrite API key in this file or in a browser environment value. */
window.GTMAuth = {
  configured() {
    return Boolean(window.GTM_APPWRITE_CONFIG?.endpoint && window.GTM_APPWRITE_CONFIG?.projectId);
  },

  account() {
    if (!this.configured()) throw new Error("Appwrite is not configured yet.");
    if (!window.Appwrite) throw new Error("The Appwrite SDK did not load. Refresh and try again.");
    const client = new window.Appwrite.Client()
      .setEndpoint(window.GTM_APPWRITE_CONFIG.endpoint)
      .setProject(window.GTM_APPWRITE_CONFIG.projectId);
    return new window.Appwrite.Account(client);
  },

  async sendMagicLink(email, callbackUrl) {
    await this.account().createMagicURLToken({
      userId: window.Appwrite.ID.unique(),
      email,
      url: callbackUrl,
    });
    return { ok: true };
  },

  async finishMagicLink() {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get("userId");
    const secret = params.get("secret");
    if (!userId || !secret) throw new Error("This sign-in link is incomplete or has already been used.");
    const account = this.account();
    await account.createSession({ userId, secret });
    const [user, token] = await Promise.all([account.get(), account.createJWT()]);
    return { jwt: token.jwt, userId: user.$id, email: user.email };
  },

  async restoreSession() {
    const account = this.account();
    const [user, token] = await Promise.all([account.get(), account.createJWT()]);
    return { jwt: token.jwt, userId: user.$id, email: user.email };
  },

  async signOut() {
    await this.account().deleteSession({ sessionId: "current" });
    return { ok: true };
  },
};
