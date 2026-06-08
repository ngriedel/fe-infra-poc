# Feature Overview

A plain-language tour of the choices that make up this app, and why each one is
worth having. Nothing technically dense here — just the "what" and the "why it's
good".

---

## Workspace & tooling

### Nx monorepo
- One repo holds every frontend, BFF, and shared library — one place to clone, build, and reason about.
- Shared code is shared for real (one copy), not copy-pasted between projects.
- Nx only rebuilds/tests what actually changed, so CI and local builds stay fast as the app grows.
- Enforced module boundaries (tags like `scope:shared`) stop apps from importing each other's internals by accident.

### pnpm
- Fast installs and a single, space-efficient `node_modules` across the whole monorepo.
- Strict dependency resolution catches "works on my machine" issues early.

### TypeScript end-to-end
- The same language and types flow from the database-facing BFF all the way to the UI.
- Mistakes get caught while typing, not in production.

### ESLint + Prettier
- Consistent formatting and catch-common-mistakes linting, applied the same way everywhere.

### Jest + Playwright
- Jest for fast unit tests; Playwright for real browser end-to-end tests.
- Confidence that things work both in isolation and as a user actually sees them.

---

## Frontend

### Angular (signal-based)
- Modern reactive model built on signals — state updates are explicit and easy to follow.
- Less boilerplate than older patterns, and the UI updates only what truly changed.

### Zoneless Angular
- Drops the old change-detection engine (zone.js) in favour of signals doing the work.
- Less background overhead, snappier UI, and a smaller bundle.

### Headless UI (Spartan)
- Accessible, unstyled component behaviour (menus, dialogs, etc.) that we skin ourselves.
- We get correct, accessible interactions for free without fighting someone else's visual style.

### Tailwind
- Style straight in the markup with small utility classes — fast to build, easy to tweak.
- No giant pile of custom CSS files to maintain or fight specificity in.

### Signal Forms (+ input masking)
- Forms built on the same signal model as the rest of the app — reactive and consistent.
- Maskito handles nicely formatted inputs (numbers, etc.) so users type less and fat-finger less.

---

## Shared design system

### Shared UI components
- Buttons, form fields, and friends live in one library used by every frontend.
- Build a component once, every app benefits; fix a bug once, it's fixed everywhere.
- Apps look and behave consistently without each team re-inventing the basics.

### Shared design tokens
- Colours, spacing, typography defined once as tokens and consumed everywhere.
- Rebrand or theme tweaks happen in one place instead of hunting through every app.

### Shared Figma pipeline *(future)*
- Design tokens flow straight from Figma into code, so design and code never drift apart.
- Designers change a value in Figma; developers pick it up without manual copying.

---

## Backend (per-frontend BFFs)

### A BFF (Backend-for-Frontend) for each frontend
- Each frontend gets its own small backend tailored to exactly what it needs.
- The browser only ever talks to its own BFF, locked down to that one origin.
- Sensitive things (tokens, secrets) live on the server, never in the browser.

### Fastify
- Lightweight, fast web framework with a clean plugin system for the BFFs.

### Shared BFF core
- Every BFF starts from one shared baseline: security headers, CORS, sessions, error handling, logging.
- New BFFs get all the safe defaults for free and behave identically.

### Secure session cookies
- Login state is kept in an encrypted, http-only cookie — the browser can't read or tamper with it.
- No tokens floating around in JavaScript for an attacker to steal.

### Zod contracts (shared)
- Request/response shapes are defined once and shared between frontend and BFF.
- Bad data is rejected at the door, and both sides always agree on the shape.
- Config (env vars) is validated at startup, so a misconfigured service refuses to boot instead of failing later.

### Centralised error format
- Every BFF returns errors in the same tidy `{ code, message }` shape.
- Frontends handle errors one consistent way, no matter which BFF they came from.

### Structured logging
- Machine-readable logs in production, pretty logs in development.

---

## Authentication

### Shared auth libraries (SSO + OTP)
- The actual login flows live in shared libraries, not copy-pasted into each backend.
- **SSO (single sign-on)** for staff/agent apps — one corporate login, swap-in ready for Azure/Entra.
- **OTP / magic-link** for customer apps — simple email-code login, no passwords to manage.
- A new frontend picks the method it needs in a couple of lines; the security-sensitive code stays in one reviewed place.
- The "who is this user" mapping is injected per app, so each app stays in control of its own roles without forking the shared flow.

---

## Things worth calling out that are easy to miss

- **Dev proxies** — in development each frontend transparently forwards API calls to its BFF, so there's no CORS pain while building.
- **Fail-fast config** — services validate their settings on startup and refuse to run if something's missing or wrong.
- **Clear separation of "shared" vs "app-specific"** — shared building blocks are obvious and reusable; app-specific quirks stay in the app.
- **Documented decisions** — the `docs/` folder records the reasoning behind the bigger choices (sessions, latency, design tokens, Angular upgrade), so the "why" isn't lost.
