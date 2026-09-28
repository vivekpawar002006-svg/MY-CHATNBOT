# Arrow Puzzle AI

Arrow Puzzle AI is a professional game assistant for Arrow Puzzle. It helps players understand the rules, think through difficult boards, request graduated hints, and troubleshoot gameplay without inventing level details.

## Features

- Secure server-side Groq integration
- Configurable Groq model with a fast default
- Guided hints before complete solutions
- Local chat history with new-chat and clear-chat controls
- Responsive mobile and desktop interface
- Suggested prompts, retry, stop, copy, timestamps, loading state, and keyboard shortcuts
- Markdown-aware assistant responses
- Input validation, request limits, timeouts, and provider-safe error messages

## Tech stack

- React, TypeScript, Vite, Tailwind CSS
- Express API server in `artifacts/api-server`
- OpenAPI contract and generated client hooks
- Groq Chat Completions API
- pnpm workspace

## Install dependencies

From the repository root:

```bash
pnpm install
```

## Environment variables

Copy the example values into your environment. Never commit a real key.

```bash
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-20b
```

`GROQ_API_KEY` is required by the API server. `GROQ_MODEL` is optional; the server uses `openai/gpt-oss-20b` when it is not set.

On Replit, add `GROQ_API_KEY` as a Secret. Add `GROQ_MODEL` as a normal environment variable if you want to override the default.

## Run locally

The normal Replit workflows start both services. To run them manually in separate terminals:

```bash
pnpm --filter @workspace/api-server run dev
PORT=20304 BASE_PATH=/ pnpm --filter @workspace/arrow-puzzle-ai run dev
```

The frontend calls `/api/chat`, which is served by the API server. The Groq key is only read by the server and is never bundled into browser code.

## Groq integration

The secure route is:

```text
browser -> POST /api/chat -> Express API server -> Groq -> browser
```

The server-side system prompt lives in `artifacts/api-server/src/lib/arrow-puzzle-prompt.ts`. The route and validation live in `artifacts/api-server/src/routes/chat.ts`.

## Vercel deployment

This workspace is structured so the Vite frontend can be built as a static Vercel output and `/api/chat` can run as a Vercel serverless function from `api/chat.ts`.

1. Import the repository into Vercel.
2. Use the repository root as the project root.
3. Set the build command to:

   ```bash
   PORT=20304 BASE_PATH=/ pnpm --filter @workspace/arrow-puzzle-ai run build
   ```

4. Set the output directory to:

   ```text
   artifacts/arrow-puzzle-ai/dist/public
   ```

5. Add `GROQ_API_KEY` in Vercel Project Settings → Environment Variables.
6. Add `GROQ_MODEL` there as well if you want to use a different Groq-supported model.
7. Deploy.

If you host the Express API separately instead, point the frontend API base at that service and keep the same `/api/chat` contract. Do not put `GROQ_API_KEY` in a `VITE_` variable or any client-side file.

## Security notes

- API keys are read only from server environment variables.
- User input is validated and bounded before it reaches Groq.
- Conversation history is capped at 30 messages.
- Requests are rate-limited per client key and time out after 30 seconds.
- Provider responses and credentials are not returned in user-facing errors.
- LocalStorage is used only for browser chat history; no account data is collected.

## Future improvements

- Screenshot upload and board analysis
- Optional accounts and synced history
- Level metadata and solution-aware hints
- Voice input
- Gameplay statistics and leaderboards
- Admin-managed game knowledge and model selection