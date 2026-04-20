import { Hono } from "hono";
import { jwt, sign, verify } from "hono/jwt";
import { drizzle } from "drizzle-orm/d1";
import { asc, eq } from "drizzle-orm";
import { users, messages } from "../db/schema";
import { ChatRoom } from "./chatRoom";

export { ChatRoom };

const app = new Hono<{ Bindings: Env }>();

// Public: sign in
app.post("/api/auth/signin", async (c) => {
  const { phone } = await c.req.json<{ phone: string }>();
  if (!phone) return c.json({ error: "phone required" }, 400);

  const db = drizzle(c.env.DB);
  const result = await db
    .select({ id: users.id, phone: users.phone, name: users.name })
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);

  const user = result[0];
  if (!user) return c.json({ error: "user not found" }, 401);

  const token = await sign(
    { sub: user.id, name: user.name, iat: Math.floor(Date.now() / 1000) },
    c.env.JWT_SECRET,
  );

  return c.json({ token, user: { id: user.id, name: user.name } });
});

// Serve media from R2 — supports Bearer header OR ?token= query param so
// <img>/<video> tags can load media without fetch + blob URL workarounds.
app.get("/api/media/:key", async (c) => {
  const token =
    c.req.header("Authorization")?.replace("Bearer ", "") ??
    c.req.query("token");
  if (!token) return c.json({ error: "unauthorized" }, 401);
  try {
    await verify(token, c.env.JWT_SECRET);
  } catch {
    return c.json({ error: "invalid token" }, 401);
  }

  const key = c.req.param("key");
  const obj = await c.env.MEDIA.get(key);
  if (!obj) return c.json({ error: "not found" }, 404);

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  const contentType = headers.get("content-type") ?? "application/octet-stream";
  // Inline for images/video; attachment for everything else
  if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
    const fileName = obj.customMetadata?.fileName ?? key;
    headers.set(
      "Content-Disposition",
      `attachment; filename="${fileName.replace(/"/g, "")}"`,
    );
  }
  return new Response(obj.body, { headers });
});

// WebSocket upgrade — token passed as query param (browser WS can't set headers)
app.get("/api/ws", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.json({ error: "unauthorized" }, 401);

  let payload: { sub: string; name: string };
  try {
    payload = (await verify(token, c.env.JWT_SECRET)) as {
      sub: string;
      name: string;
    };
  } catch {
    return c.json({ error: "invalid token" }, 401);
  }

  const id = c.env.CHAT_ROOM.idFromName("singleton");
  const stub = c.env.CHAT_ROOM.get(id);

  // Pass verified identity to the DO via query params on the forwarded request
  const url = new URL(c.req.url);
  url.searchParams.set("userId", payload.sub);
  url.searchParams.set("name", payload.name);

  return stub.fetch(new Request(url.toString(), c.req.raw));
});

// JWT middleware for all other /api/* routes
app.use("/api/*", (c, next) => jwt({ secret: c.env.JWT_SECRET })(c, next));

app.get("/api/me", (c) => {
  const payload = c.get("jwtPayload");
  return c.json({ sub: payload.sub, name: payload.name });
});

// Update current user's display name, returns a fresh JWT
app.patch("/api/users/me", async (c) => {
  const payload = c.get("jwtPayload");
  let body: { name?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid body" }, 400);
  }
  const name = body.name?.trim();
  if (!name) return c.json({ error: "name required" }, 400);

  const db = drizzle(c.env.DB);
  await db.update(users).set({ name }).where(eq(users.id, payload.sub));

  const token = await sign(
    { sub: payload.sub, name, iat: Math.floor(Date.now() / 1000) },
    c.env.JWT_SECRET,
  );
  return c.json({ token, name });
});

// Upload file to R2 — raw body stream with metadata in request headers
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB

app.post("/api/upload", async (c) => {
  const payload = c.get("jwtPayload");
  const body = c.req.raw.body;
  if (!body) return c.json({ error: "missing file" }, 400);

  const contentType =
    c.req.header("x-content-type") ??
    c.req.header("content-type") ??
    "application/octet-stream";
  const fileName = decodeURIComponent(c.req.header("x-file-name") ?? "upload");
  const contentLength = Number(c.req.header("content-length") ?? 0);
  if (contentLength > MAX_UPLOAD_BYTES) {
    return c.json({ error: "file too large (max 100 MB)" }, 413);
  }

  const key = crypto.randomUUID();
  await c.env.MEDIA.put(key, body, {
    httpMetadata: { contentType },
    customMetadata: { uploadedBy: payload.sub, fileName },
  });

  return c.json({ key, contentType });
});

// Message history (most recent 50, oldest first)
app.get("/api/messages", async (c) => {
  const db = drizzle(c.env.DB);
  const rows = await db
    .select({
      id: messages.id,
      senderId: messages.senderId,
      type: messages.type,
      content: messages.content,
      mediaKey: messages.mediaKey,
      createdAt: messages.createdAt,
      deliveredAt: messages.deliveredAt,
    })
    .from(messages)
    .orderBy(asc(messages.createdAt))
    .limit(50);
  return c.json({ messages: rows });
});

export default app;
