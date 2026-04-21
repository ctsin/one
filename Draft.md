# One — Development Plan

## Core Objective
Build a real-time messaging application ("One") using a modern, type-safe stack on Cloudflare's edge infrastructure. This project emphasizes Test-Driven Development (TDD), shared code between frontend and backend, and robust authentication.

## Tech Stack & Learning Goals

- **Frontend**: React (TypeScript), Vite, Tailwind CSS, shadcn/ui.
- **Backend**: Hono, Cloudflare Workers.
- **Data Storage**:
  - **D1**: Relational data (users, messages).
  - **R2**: Media storage (images, videos, files).
- **Real-time**: Durable Objects with WebSocket Hibernation.
- **Testing**: Vitest (Unit/Integration), Playwright (E2E).
- **Learning Objective**: Document Cloudflare Wrangler best practices in a `/learn/` directory.

---

## Shared Types Strategy
- Create `src/shared/` for Zod schemas and TypeScript interfaces.
- Share validation logic between `src/web/` and `src/worker/`.

## Authentication & Authorization
- **Sign-in**: Phone-number based with JWT (`hono/jwt`).
- **Registration**: 
  - Root admin user pre-registers other users via an internal tool/script.
  - System generates a one-time setup link for password initialization.
- **Local Dev**: Use `00` for admin, `11` for standard user.
- **Prod**: Specific real-world numbers for admin/users.

---

## Phased Implementation Plan

### Phase 0 — Infrastructure & TDD Setup
1. **Scaffold /src/shared**: Initialize Zod schemas for User and Message.
2. **Configure Testing**:
   - Install `vitest`, `@testing-library/react`, `playwright`.
   - Setup test environments for both Hono (Worker) and React (Web).
3. **Cloudflare Setup**:
   - Configure `wrangler.json` with D1, R2, and DO bindings.
   - Run `npm run cf-typegen`.
4. **Learning Task**: Create `/learn/wrangler-setup.md`.

### Phase 1 — Authentication (TDD)
1. **Red**: Write tests for `POST /api/auth/signin` and JWT verification middleware.
2. **Green**: Implement D1 `users` table and Hono auth routes.
3. **Refactor**: Optimize database queries and middleware logic.
4. **Admin Flow**: Implement the one-time setup link logic.

### Phase 2 — Core Messaging (TDD)
1. **Red**: Write tests for the `ChatRoom` Durable Object (mocking WebSockets).
2. **Green**: Implement DO with WebSocket Hibernation and D1 persistence.
3. **Shared Logic**: Integrate Zod schemas for message validation.

### Phase 3 — Frontend UI & E2E
1. **Theme**: Apply "modern minimal" theme via shadcn/ui.
2. **Components**: Build `MessageBubble`, `ChatWindow`, `AuthForm`.
3. **E2E Tests**: Use Playwright to verify the full login-to-message flow.

### Phase 4 — Media Handling
1. **Upload API**: Implement R2 multipart uploads with auth.
2. **Rendering**: Add support for images/videos in the chat UI.
3. **Learning Task**: Create `/learn/r2-optimization.md`.

### Phase 5 — Polish & Deployment
1. **Presence**: Online/offline indicators.
2. **Receipts**: Delivered/Read status.
3. **Deploy**: Final `wrangler deploy` to `three.ctsin.dev`.

---

## D1 Schema (Draft)

```sql
CREATE TABLE users (
  id         TEXT PRIMARY KEY,
  phone      TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  role       TEXT DEFAULT 'user', -- 'admin' | 'user'
  is_active  INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE messages (
  id         TEXT PRIMARY KEY,
  sender_id  TEXT NOT NULL REFERENCES users(id),
  type       TEXT NOT NULL DEFAULT 'text', -- 'text' | 'image' | 'video'
  content    TEXT,
  media_key  TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```
