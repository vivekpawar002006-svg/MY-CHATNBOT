# Arrow Puzzle AI

Arrow Puzzle AI is a responsive game assistant that helps Arrow Puzzle players understand mechanics, think through boards, and request useful hints.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/arrow-puzzle-ai run dev` — run the web app
- `pnpm run typecheck` — full typecheck across all packages
- `PORT=20304 BASE_PATH=/ pnpm --filter @workspace/arrow-puzzle-ai run build` — build the web app
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `GROQ_API_KEY` — server-side Groq credential
- Optional env: `GROQ_MODEL` — Groq model override

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/arrow-puzzle-ai/src/App.tsx` — responsive chat experience and local history
- `artifacts/arrow-puzzle-ai/src/index.css` — Arrow Puzzle AI visual theme
- `artifacts/api-server/src/routes/chat.ts` — validated Groq proxy endpoint
- `artifacts/api-server/src/lib/arrow-puzzle-prompt.ts` — editable assistant system prompt
- `lib/api-spec/openapi.yaml` — source of truth for `/api/chat`
- `lib/api-client-react/src/generated/` — generated frontend API hooks

## Architecture decisions

- The browser only calls the shared `/api/chat` endpoint; Groq credentials never enter the Vite bundle.
- Chat history stays local for the first version so the app works without accounts or a database.
- The API sends only user and assistant turns while injecting the editable game-specific system prompt server-side.
- The OpenAPI contract remains the source of truth for generated client and validation code.

## Product

- Players can start and revisit local chats, ask suggested or freeform questions, copy assistant replies, retry failures, and stop waiting states.
- The assistant is instructed to give small hints first and avoid inventing levels or mechanics.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
