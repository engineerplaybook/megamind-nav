# Engineer Playbook — Common Nav

Shared navigation component for engineerplaybook.io. Served as both a Next.js app and a universal web component.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI Library:** React 19
- **Design System:** `@engineerplaybook/design-system` (shared tokens + components)
- **Web Component Build:** Vite + `vite-plugin-webcomponent`
- **Navigation:** Shadow DOM encapsulated `<engineering-playbook-nav>` custom element

## How It Works

The nav is built **twice**:
1. **Vite** bundles `src/main.tsx` into a vanilla web component (`public/common-nav.js`)
2. **Next.js** builds the app shell (`app/`) for SSR and fallback pages

The web component is loaded via `<script>` in every other app's layout and renders inside a shadow DOM `<engineering-playbook-nav>` element.

## Development

```bash
npm install
npm run dev     # http://localhost:5174
```

The Vite web component is auto-built before the Next.js dev server starts.

## Build

```bash
npm run build    # vite build && next build
npm run lint
```

## Routes

| Path | Description |
|------|-------------|
| `/` | Nav standalone (debugging) |

## Deployment

Deploys independently to Vercel. Gateway routes `engineerplaybook.io/nav/*` here.

Other apps reference it via `NEXT_PUBLIC_COMMON_NAV_URL` env var:

```bash
vercel deploy
```
