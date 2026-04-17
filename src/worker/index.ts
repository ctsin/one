import { Hono } from "hono";
import { jwt, sign } from "hono/jwt";

const app = new Hono<{ Bindings: Env }>();

// Public: sign in
app.post("/api/auth/signin", async (c) => {
  const { phone } = await c.req.json<{ phone: string }>();
  if (!phone) return c.json({ error: "phone required" }, 400);

  const user = await c.env.DB.prepare(
    "SELECT id, phone, name FROM users WHERE phone = ?",
  )
    .bind(phone)
    .first<{ id: string; phone: string; name: string }>();

  if (!user) return c.json({ error: "user not found" }, 401);

  const token = await sign(
    { sub: user.id, name: user.name, iat: Math.floor(Date.now() / 1000) },
    c.env.JWT_SECRET,
  );

  return c.json({ token, user: { id: user.id, name: user.name } });
});

// JWT middleware for all other /api/* routes
app.use("/api/*", (c, next) => jwt({ secret: c.env.JWT_SECRET })(c, next));

app.get("/api/me", (c) => {
  const payload = c.get("jwtPayload");
  return c.json({ sub: payload.sub, name: payload.name });
});

export default app;
