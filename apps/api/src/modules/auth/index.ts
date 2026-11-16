import { Elysia } from "elysia";
import { cookieOptions, authPlugin, SESSION_COOKIE, STATE_COOKIE } from "../../plugins/auth";
import { authorizeUrl, frontendUrl, logoutUrl, newState, ssoConfigProblem, userFromCode } from "./service";

// Same routes as TekSso's backend-for-frontend contract; APP_URL/auth/callback is the redirect URI registered in TekSso.
export const authModule = new Elysia({ prefix: "/auth" })
  .use(authPlugin)
  .get("/login", ({ cookie, query, redirect, status }) => {
    const problem = ssoConfigProblem();
    if (problem) return status(503, { message: problem });
    const state = newState();
    cookie[STATE_COOKIE]!.set({ ...cookieOptions, maxAge: 600, value: { state, returnTo: query.return_to } });
    return redirect(authorizeUrl(state));
  })
  .get("/callback", async ({ cookie, query, redirect }) => {
    const oauth = cookie[STATE_COOKIE]!.value as { state: string; returnTo?: string } | undefined;
    cookie[STATE_COOKIE]!.remove();
    if (query.error || !oauth || query.state !== oauth.state || !query.code) return redirect(frontendUrl("/?sso_error=1"));
    try {
      const user = await userFromCode(query.code);
      cookie[SESSION_COOKIE]!.set({ ...cookieOptions, maxAge: 60 * 60 * 8, value: { id: user.id } });
      return redirect(frontendUrl(oauth.returnTo));
    } catch (e) {
      console.error(e);
      return redirect(frontendUrl("/?sso_error=1"));
    }
  })
  .get("/logout", ({ cookie, redirect }) => {
    cookie[SESSION_COOKIE]!.remove();
    return redirect(ssoConfigProblem() ? frontendUrl("/") : logoutUrl()); // no TekSso session to end when login was never configured
  })
  .get("/logged-out", ({ redirect }) => redirect(frontendUrl("/")))
  .get("/me", ({ user }) => user, { role: true });
