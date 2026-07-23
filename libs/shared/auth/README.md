# shared/auth

Shared frontend auth for AIC's OIDC apps (`agent`, `dealer`, `broker`).

Wraps the BFF session contract behind a small Angular surface:

- `AuthService` — session state as signals (`user`, `isAuthenticated`), `refresh()`
  (reads `GET /api/auth/session`), `beginLogin(returnTo)` (full-page redirect to the
  BFF's `/api/auth/login`), and `logout()`.
- `requireAuth` — a `CanActivateFn` that lets authenticated users through, otherwise
  refreshes once and redirects to `/login`.

The browser never sees a token — the BFF owns the OIDC flow and issues a session
cookie. Each app keeps its own branded login page that calls `auth.beginLogin()`.

Consumed via the `@aic/shared/auth` path alias.
