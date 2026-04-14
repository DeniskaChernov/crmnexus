import type { Hono } from "hono";
import { signUserToken, verifyBearer } from "../jwt.ts";

export function registerAuthRoutes(app: Hono) {
  app.post("/make-server-f9553289/auth/login", async (c) => {
    try {
      const { email, password } = await c.req.json();
      if (!email || !password) return c.json({ error: "Email and password required" }, 400);
      const { verifyUserPassword } = await import("../authAdmin.ts");
      const user = await verifyUserPassword(email, password);
      if (!user) return c.json({ error: "Invalid credentials" }, 401);
      const token = await signUserToken(user);
      return c.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          user_metadata: { name: user.name, role: user.role },
        },
      });
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  app.get("/make-server-f9553289/auth/me", async (c) => {
    try {
      const auth = c.req.header("authorization");
      if (!auth?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401);
      const payload = await verifyBearer(auth.slice(7));
      return c.json({
        user: {
          id: payload.sub,
          email: payload.email,
          user_metadata: { name: payload.name, role: payload.role },
        },
      });
    } catch {
      return c.json({ error: "Unauthorized" }, 401);
    }
  });
}
