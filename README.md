# AI Virtual Receptionist

An AI-powered virtual receptionist that **answers customer questions**, **captures leads**, **books appointments**, and **routes conversations to the right department** — 24/7. Built as a multi-tenant full-stack web app.

## Architecture

```
┌──────────────────────────────────────────────┐
│              Frontend (Next.js 14)             │
│   Landing │ Dashboard │ Inbox │ KB │ Leads     │
│   Appointments │ Analytics │ Settings          │
└──────────────────────┬───────────────────────┘
                       │ REST + WebSocket (Socket.io)
┌──────────────────────▼───────────────────────┐
│              Backend (NestJS)                  │
│   Auth │ Chat │ RAG (pgvector) │ Receptionist  │
│   Leads │ Appointments │ Routing │ WebSocket   │
└──────────────────────┬───────────────────────┘
                       │ SQL
┌──────────────────────▼───────────────────────┐
│       Postgres + pgvector (Neon/Supabase)      │
│  users │ companies │ conversations │ messages   │
│  knowledge_documents │ knowledge_chunks(1536d) │
│  leads │ appointments │ departments             │
└──────────────────────────────────────────────┘
```

## Features

- **RAG Knowledge Base** — upload docs, auto-chunk, embed into `pgvector`, retrieve with cosine similarity, answer with citations.
- **AI Answers 24/7** — OpenRouter LLM with a receptionist system prompt.
- **Lead Capture** — the AI detects and saves visitor contact info (name, email, phone) into your pipeline.
- **Appointments** — visitors can book meetings in chat; the AI parses relative dates ("tomorrow at 14:00") and saves appointments.
- **Department Routing** — intent classification routes each conversation to Sales / Support / Billing (configurable).
- **Real-Time Chat** — Socket.io messaging, typing indicators, human handoff & takeover.
- **Embeddable Widget** — lightweight vanilla-JS snippet for any website.
- **Analytics** — conversations, AI vs human ratio, leads, appointments.

## Tech Stack

| Component   | Technology                                        |
|-------------|---------------------------------------------------|
| Frontend    | Next.js 14, TailwindCSS, TypeScript, Socket.io-client |
| Backend     | NestJS, TypeScript, Socket.io                     |
| Database    | Postgres + pgvector (works with Neon & Supabase)  |
| LLM         | OpenRouter (`google/gemini-2.5-flash` default)    |
| Embeddings  | OpenAI `text-embedding-3-small` (with deterministic local fallback when no key) |

## Quick Start

### Prerequisites
- Node.js 18+
- A Postgres database with the `pgvector` extension (Neon or Supabase both support it)
- An OpenRouter API key

### 1. Backend

```bash
cd backend
cp .env.example .env
# Add DATABASE_URL, OPENROUTER_API_KEY (+ optional OPENAI_API_KEY)
npm install
npm run dev
```

The schema and seed data are applied automatically on startup (tables + pgvector index + demo content).

### 2. Frontend

```bash
cd frontend
cp .env.example .env  # NEXT_PUBLIC_API_URL=http://localhost:4000
npm install
npm run dev
```

### 3. Widget (optional)

```bash
cd widget
npm run build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- WebSocket: ws://localhost:4000

## Usage

1. **Register a company** → you get an admin dashboard with seeded departments (Sales / Support / Billing).
2. **Add knowledge base docs** → content is chunked, embedded and stored in `pgvector`.
3. **Embed the widget** on a site (copy from Settings) or use the chat preview.
4. Visitors can ask questions (RAG answers), leave their email/phone (lead captured), or book a meeting (appointment saved).
5. **Inbox** → take over any conversation and chat with the visitor live.
6. **Leads / Appointments** → manage everything the AI captured.

### Widget embed

```html
<script src="http://localhost:4000/widget.js"
  data-api-url="http://localhost:4000"
  data-ws-url="http://localhost:4000"
  data-company-id="YOUR_COMPANY_ID"
  data-title="Support">
</script>
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Register company + admin (seeds default departments) |
| POST | `/auth/login` | Login, get tokens |
| POST | `/auth/refresh` | Refresh access token |
| GET | `/conversations` | List company conversations |
| POST | `/conversations` | Create conversation (public) |
| GET/POST | `/conversations/:id/messages` | Get / send messages |
| PATCH | `/conversations/:id/assign` `/resolve` | Assign agent / resolve |
| GET/POST | `/knowledge-base` | List / create docs (auto-chunk + embed) |
| DELETE/POST | `/knowledge-base/:id` `/reindex` | Delete / re-index doc |
| POST | `/knowledge-base/search` | Semantic KB search |
| POST | `/ai/query` | Receptionist response (structured intent/lead/appointment) |
| GET/POST | `/leads`, PATCH `/leads/:id/status` | Manage leads |
| GET/POST | `/appointments`, PATCH `/appointments/:id/status` | Manage appointments |
| GET/POST/PATCH/DELETE | `/departments` | Configure routing departments |
| GET | `/analytics/summary` | Dashboard metrics |

## WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `joinConversation` | Client → Server | Join a conversation room |
| `sendMessage` | Client → Server | Send a chat message (triggers AI) |
| `typing` | Bidirectional | Typing indicator |
| `newMessage` | Server → Client | New message received |
| `aiThinking` | Server → Client | AI is typing |
| `aiResponse` | Server → Client | AI reply + `intent`, `department`, `lead`, `appointment` |
| `takeover` | Server → Client | Agent took over from AI |

## Environment Variables

See `backend/.env.example` for the full list. Key ones:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Postgres + pgvector connection string |
| `OPENROUTER_API_KEY` | Yes | LLM provider |
| `OPENROUTER_MODEL` | No | Default `google/gemini-2.5-flash` |
| `OPENAI_API_KEY` | No | Embeddings; falls back to local hashing if empty |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Yes | Auth secrets |

---

Built by [djaouad frih](https://djaouad.tech) — [djaouad.tech](https://djaouad.tech)
