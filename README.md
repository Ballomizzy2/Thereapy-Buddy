# Therapy Buddy (MVP)

Minimal voice-based therapy buddy with a GPT wrapper.

## Setup

1. Copy `.env.local.example` to `.env.local` and set `OPENAI_API_KEY`.
2. Install deps and run:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Features

- Voice input via Web Speech API (Chrome recommended)
- Streaming responses from `/api/chat`
- Text-to-Speech via `speechSynthesis`
- Thin GPT wrapper in `lib/gpt.ts`

## Safety

This is not medical advice. If you are in crisis, contact local emergency services or trusted support immediately.
