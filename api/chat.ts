type ChatRole = "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

declare const process: {
  env: Record<string, string | undefined>;
};

type VercelRequest = {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-20b";
const FRIENDLY_ERROR =
  "Sorry, I’m having trouble connecting right now. Please try again in a moment.";
const SYSTEM_PROMPT = `You are Arrow Puzzle AI, the official intelligent assistant for Arrow Puzzle.

Help players understand and enjoy Arrow Puzzle. Answer clearly, naturally, accurately, and concisely.

For gameplay questions, explain things in simple language with useful examples. For hints, start with a small hint instead of the complete solution unless the user explicitly asks for the full solution. Never pretend to know a specific level layout without enough level information. If information is missing, ask the player to describe the arrows, grid, and blocked spaces instead of inventing facts.

Keep the conversation relevant to Arrow Puzzle. Be friendly, professional, and helpful. Use numbered steps when appropriate. Avoid unnecessary technical language, invented mechanics, invented levels, and invented features.`;

const requestLog = new Map<string, number[]>();

function clientKey(request: VercelRequest) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return request.socket?.remoteAddress || "unknown";
}

function isRateLimited(key: string) {
  const now = Date.now();
  const recent = (requestLog.get(key) || []).filter(
    (timestamp) => now - timestamp < 60_000,
  );
  if (recent.length >= 20) {
    requestLog.set(key, recent);
    return true;
  }
  recent.push(now);
  requestLog.set(key, recent);
  return false;
}

function parseMessages(body: unknown): ChatMessage[] | null {
  if (!body || typeof body !== "object" || !("messages" in body)) return null;
  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 30) {
    return null;
  }

  const valid = messages.every(
    (message): message is ChatMessage =>
      Boolean(message) &&
      typeof message === "object" &&
      "role" in message &&
      "content" in message &&
      (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string" &&
      message.content.trim().length > 0 &&
      message.content.length <= 12_000,
  );

  return valid ? messages : null;
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const messages = parseMessages(request.body);
  if (!messages) {
    response.status(400).json({ error: "Please send a valid chat message." });
    return;
  }

  if (isRateLimited(clientKey(request))) {
    response
      .status(429)
      .json({ error: "You have reached the chat limit. Please try again shortly." });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    response.status(500).json({ error: FRIENDLY_ERROR });
    return;
  }

  const model = process.env.GROQ_MODEL || DEFAULT_MODEL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const groqResponse = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        temperature: 0.4,
        max_tokens: 700,
      }),
      signal: controller.signal,
    });

    if (!groqResponse.ok) {
      response
        .status(groqResponse.status === 429 ? 429 : 500)
        .json({
          error:
            groqResponse.status === 429
              ? "The assistant is busy right now. Please try again in a moment."
              : FRIENDLY_ERROR,
        });
      return;
    }

    const payload: unknown = await groqResponse.json();
    const content =
      typeof payload === "object" &&
      payload !== null &&
      "choices" in payload &&
      Array.isArray(payload.choices) &&
      payload.choices.length > 0 &&
      typeof payload.choices[0] === "object" &&
      payload.choices[0] !== null &&
      "message" in payload.choices[0] &&
      typeof payload.choices[0].message === "object" &&
      payload.choices[0].message !== null &&
      "content" in payload.choices[0].message &&
      typeof payload.choices[0].message.content === "string"
        ? payload.choices[0].message.content.trim()
        : "";

    if (!content) {
      response.status(500).json({ error: FRIENDLY_ERROR });
      return;
    }

    response.status(200).json({
      message: { role: "assistant", content },
      model,
    });
  } catch {
    response.status(500).json({ error: FRIENDLY_ERROR });
  } finally {
    clearTimeout(timeout);
  }
}