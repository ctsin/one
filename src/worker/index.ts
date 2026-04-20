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

// Upload file to R2 — multipart/form-data with a "file" field
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 25 MB

app.post("/api/upload", async (c) => {
  const payload = c.get("jwtPayload");
  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: "invalid multipart body" }, 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return c.json({ error: "missing file" }, 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return c.json({ error: "file too large (max 25 MB)" }, 413);
  }

  const contentType = file.type || "application/octet-stream";
  const key = crypto.randomUUID();

  await c.env.MEDIA.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType },
    customMetadata: { uploadedBy: payload.sub, fileName: file.name },
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
    })
    .from(messages)
    .orderBy(asc(messages.createdAt))
    .limit(50);
  return c.json({ messages: rows });
});

export default app;
