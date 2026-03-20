<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Ndovera Monorepo

This repository has been reorganized into a **monorepo** containing four packages:

- `packages/web` – the React/Vite frontend application (School Portal)
- `packages/server` – the Express/SQLite backend API (School API)
- `packages/super-admin` – the React/Vite admin dashboard for global system ops
- `packages/super-admin-server` – the backend API for system-wide operations

## Getting Started

From the root directory run:

```sh
npm install
npm run dev      # starts both server and web in parallel
```

You can also run individual workspaces:

```sh
npm run dev:web
npm run dev:server
```

---

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/8c11f1f7-5713-43ed-a136-6040414a923f

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
