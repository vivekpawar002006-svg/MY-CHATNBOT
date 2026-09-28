---
name: Groq model availability
description: Default Groq model choices should be checked against the live account catalog.
---

Use a model returned by the configured Groq account’s `/openai/v1/models` endpoint rather than assuming a model from older examples; model access can vary by account and deprecated IDs return `model_not_found`.

**Why:** The commonly used `llama-3.3-70b-versatile` ID was unavailable for this project’s key, while `openai/gpt-oss-20b` was available and worked.

**How to apply:** When adding or changing Groq defaults, validate the ID against the account’s current model list and keep the model override configurable with `GROQ_MODEL`.