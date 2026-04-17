# One — Development Plan

## Answers to Draft Questions

### Can you use Cloudflare services without Hono?

Yes — Cloudflare Workers can export a plain `fetch` handler directly. However, Hono is already set up in the project, is lightweight, and provides nice routing/middleware abstractions. **Recommendation: keep Hono.** It runs natively on Workers with zero overhead.

### Cloudflare Services for Each Data Type

| Data Type | Service | Why |
|---|---|---|
| Users, messages (text), sessions | **D1** (serverless SQLite) | Structured/relational data, querying by timestamp, user, etc. |
| Images, videos, files | **R2** (object storage) | Large binary blobs, S3-compatible, zero egress fees |
| Real-time messaging | **Durable Objects** with WebSocket Hibernation | Persistent WebSocket connections, in-memory coordination between 2 users, auto-hibernation when idle |
| JWT signing secrets | **Worker Secrets** (`wrangler secret put`) | Secure, not checked into code |

### Real-time Approach

Durable Objects with **WebSocket Hibernation** is the best fit. A single Durable Object instance acts as the "chat room." Both users connect via WebSocket; the DO broadcasts messages. Hibernation means you pay nothing when both users are offline.

### JWT in This Scenario

On sign-in (phone number match against D1), the Worker issues a signed JWT (using `hono/jwt` middleware). The frontend stores it in memory/localStorage and sends it as `Authorization: Bearer <token>` on every request including the WebSocket upgrade. The Worker verifies the JWT before accepting connections. The signing secret is stored as a Cloudflare secret.

---

## Phased Plan

### Phase 0 — Project Setup

1. Install dependencies: `shadcn/ui`, `tailwindcss`, `hono/jwt`, etc.
2. Apply the "modern minimal" theme via `pnpm dlx shadcn@latest add https://tweakcn.com/r/themes/modern-minimal.json`
3. Configure Wrangler bindings in `wrangler.json`: D1 database, R2 bucket, Durable Object namespace
4. Run `npx wrangler types` to generate TypeScript types
5. Create D1 database: `npx wrangler d1 create one-db`
6. Create R2 bucket: `npx wrangler r2 bucket create one-media`
7. Set JWT secret: `npx wrangler secret put JWT_SECRET`

### Phase 1 — Authentication

1. **D1 Schema** — `users` table with `id`, `phone`, `name`, `created_at`. Seed with two users (`111`, `222`)
2. **API** `POST /api/auth/signin` — Accepts phone number, validates against D1, returns a signed JWT (HS256 via `hono/jwt`)
3. **Frontend** — Sign-in page: single text input for phone number, submit → store JWT in memory, redirect to chat
4. **Middleware** — Hono JWT middleware on all `/api/*` routes (except `/api/auth/signin`)

### Phase 2 — Chat UI (Static First)

1. **Layout** — Full-height app with:
   - Fixed **header bar** (top): shows app name "One", online user indicator (name + green dot)
   - **Message list** (scrollable center): oldest on top, newest on bottom, auto-scroll to bottom
   - Fixed **input bar** (bottom): text input + send button
2. **Components** — Using shadcn/ui + modern-minimal theme:
   - `MessageBubble` — differentiate sent vs. received
   - `Header` — online users display
   - `MessageInput` — text field + attachment button (for Phase 4)
3. Style with Tailwind CSS, clean and minimal

### Phase 3 — Real-time Messaging (Text)

1. **Durable Object: `ChatRoom`** — single instance for the two-user chat
   - `webSocketMessage()` handler (Hibernation API)
   - Stores messages to D1 on receive, broadcasts to the other connected client
   - Tracks connected users for online status
2. **API** `GET /api/ws` — Upgrades to WebSocket, routes to the ChatRoom DO (after JWT verification)
3. **API** `GET /api/messages` — Paginated message history from D1 (load on app start)
4. **Frontend WebSocket client** — connect on login, send/receive text messages, reconnect on disconnect
5. **Online presence** — DO tracks who's connected, pushes status updates via WebSocket

### Phase 4 — Media Messages (Images, Videos, Files)

1. **API** `POST /api/upload` — Accept multipart upload, store in R2, return a media key
2. **API** `GET /api/media/:key` — Serve file from R2 (with JWT auth or signed URL)
3. **D1 messages table** — `type` column (`text`, `image`, `video`, `file`), `media_key` column
4. **Frontend** — Attachment button in input bar, file picker, upload → send message with media reference
5. **Message rendering** — Inline image/video preview, file download link

### Phase 5 — Polish & Deploy

1. Message timestamps, read receipts (simple "delivered" indicator)
2. User name editing (API `PATCH /api/users/me`, UI settings)
3. Error handling, loading states, empty states
4. `npx wrangler deploy`
5. Configure custom domain `one.ctsin.dev`

---

## D1 Schema (Draft)

```sql
-- users
CREATE TABLE users (
  id         TEXT PRIMARY KEY,
  phone      TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- messages
CREATE TABLE messages (
  id         TEXT PRIMARY KEY,
  sender_id  TEXT NOT NULL REFERENCES users(id),
  type       TEXT NOT NULL DEFAULT 'text',  -- text | image | video | file
  content    TEXT,                           -- text content or null
  media_key  TEXT,                           -- R2 object key or null
  created_at TEXT DEFAULT (datetime('now'))
);

-- seed
INSERT INTO users (id, phone, name) VALUES ('u1', '111', 'Root');
INSERT INTO users (id, phone, name) VALUES ('u2', '222', 'Friend');
```

## Wrangler Bindings (Draft)

```jsonc
// additions to wrangler.json
"d1_databases": [{ "binding": "DB", "database_name": "one-db", "database_id": "<id>" }],
"r2_buckets": [{ "binding": "MEDIA", "bucket_name": "one-media" }],
"durable_objects": { "bindings": [{ "name": "CHAT_ROOM", "class_name": "ChatRoom" }] },
"migrations": [{ "tag": "v1", "new_sqlite_classes": ["ChatRoom"] }]
```

---

## Todo Items (Future)

- [ ] **Email OTP sign-in** — future alternative to phone number
- [ ] **React Native app** — mobile client sharing the same backend API/WebSocket
