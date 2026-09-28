import { Router, type IRouter, type Request } from "express";
import { SendChatMessageBody, SendChatMessageResponse } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { ARROW_PUZZLE_SYSTEM_PROMPT } from "../lib/arrow-puzzle-prompt";

const router: IRouter = Router();

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-20b";
const MAX_REQUESTS_PER_WINDOW = 20;
const RATE_WINDOW_MS = 60_000;
const requestLog = new Map<string, number[]>();

function getClientKey(req: Request) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0].trim();
  }
  return req.ip || "unknown";
}

function isRateLimited(key: string) {
  const now = Date.now();
  const recent = (requestLog.get(key) ?? []).filter(
    (timestamp) => now - timestamp < RATE_WINDOW_MS,
  );

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    requestLog.set(key, recent);
    return true;
  }

  recent.push(now);
  requestLog.set(key, recent);
  return false;
}

router.post("/chat", async (req, res) => {
  const parsed = SendChatMessageBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Please send a valid chat message." });
    return;
  }

  if (isRateLimited(getClientKey(req))) {
    res
      .status(429)
      .json({ error: "You have reached the chat limit. Please try again shortly." });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    logger.error("GROQ_API_KEY is not configured");
    res.status(500).json({
      error: "Sorry, I’m having trouble connecting right now. Please try again in a moment.",
    });
    return;
  }

  const model = process.env.GROQ_MODEL || DEFAULT_MODEL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: ARROW_PUZZLE_SYSTEM_PROMPT },
          ...parsed.data.messages,
        ],
        temperature: 0.4,
        max_tokens: 700,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const providerError = await response.text();
      logger.warn(
        {
          status: response.status,
          model,
          providerMessage: providerError.slice(0, 240),
        },
        "Groq response was not successful",
      );
      res.status(response.status === 429 ? 429 : 500).json({
        error:
          response.status === 429
            ? "The assistant is busy right now. Please try again in a moment."
            : "Sorry, I’m having trouble connecting right now. Please try again in a moment.",
      });
      return;
    }

    const payload: unknown = await response.json();
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
      logger.warn({ model }, "Groq response did not include message content");
      res.status(500).json({
        error: "Sorry, I’m having trouble connecting right now. Please try again in a moment.",
      });
      return;
    }

    const result = SendChatMessageResponse.parse({
      message: { role: "assistant", content },
      model,
    });
    res.json(result);
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError";
    logger.error({ err: error, isAbort, model }, "Groq request failed");
    res.status(500).json({
      error: "Sorry, I’m having trouble connecting right now. Please try again in a moment.",
    });
  } finally {
    clearTimeout(timeout);
  }
});

export default router;