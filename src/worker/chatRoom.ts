import { DurableObject } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, isNull, ne } from "drizzle-orm";
import { messages } from "../db/schema";

interface ConnectionState {
  userId: string;
  name: string;
}

function mimeToMessageType(contentType: string): "image" | "video" | "file" {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  return "file";
}

export class ChatRoom extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") ?? "";
    const name = url.searchParams.get("name") ?? "User";

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ userId, name } satisfies ConnectionState);

    // Mark undelivered messages sent by the other user as delivered now that
    // this user has connected.
    await this.markPendingDelivered(userId);

    // Notify all connected clients (including the new one) of updated presence
    this.broadcastPresence();

    return new Response(null, { status: 101, webSocket: client });
  }

  /** Mark messages sent by others (not userId) that haven't been delivered yet. */
  private async markPendingDelivered(userId: string): Promise<void> {
    const db = drizzle(this.env.DB);
    await db
      .update(messages)
      .set({ deliveredAt: new Date().toISOString() })
      .where(and(isNull(messages.deliveredAt), ne(messages.senderId, userId)));
  }

  /** Returns true if there is at least one other user currently connected. */
  private otherIsOnline(senderId: string): boolean {
    return this.ctx.getWebSockets().some((ws) => {
      if (ws.readyState !== WebSocket.OPEN) return false;
      const st = ws.deserializeAttachment() as ConnectionState | null;
      return st?.userId && st.userId !== senderId;
    });
  }

  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    if (typeof message !== "string") return;

    const state = ws.deserializeAttachment() as ConnectionState | null;
    if (!state?.userId) return;

    let data: {
      type: string;
      content?: string;
      mediaKey?: string;
      contentType?: string;
    };
    try {
      data = JSON.parse(message);
    } catch {
      return;
    }

    if (data.type === "message" && data.content?.trim()) {
      const id = crypto.randomUUID();
      const content = data.content.trim();
      const createdAt = new Date().toISOString();
      const deliveredAt = this.otherIsOnline(state.userId) ? createdAt : null;

      const db = drizzle(this.env.DB);
      await db.insert(messages).values({
        id,
        senderId: state.userId,
        type: "text",
        content,
        createdAt,
        deliveredAt,
      });

      const outgoing = JSON.stringify({
        type: "message",
        msgType: "text",
        id,
        senderId: state.userId,
        content,
        createdAt,
        deliveredAt,
      });

      for (const client of this.ctx.getWebSockets()) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(outgoing);
        }
      }
    } else if (
      data.type === "media" &&
      typeof data.mediaKey === "string" &&
      data.mediaKey
    ) {
      const msgType = mimeToMessageType(data.contentType ?? "");
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const deliveredAt = this.otherIsOnline(state.userId) ? createdAt : null;

      const db = drizzle(this.env.DB);
      await db.insert(messages).values({
        id,
        senderId: state.userId,
        type: msgType,
        content: null,
        mediaKey: data.mediaKey,
        createdAt,
        deliveredAt,
      });

      const outgoing = JSON.stringify({
        type: "message",
        msgType,
        id,
        senderId: state.userId,
        mediaKey: data.mediaKey,
        contentType: data.contentType,
        createdAt,
        deliveredAt,
      });

      for (const client of this.ctx.getWebSockets()) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(outgoing);
        }
      }
    }
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
  ): Promise<void> {
    // compat_date 2025-10-08 is before 2026-04-07, so we must close manually
    ws.close(code, reason);
    this.broadcastPresence();
  }

  async webSocketError(_ws: WebSocket, _error: unknown): Promise<void> {
    // runtime logs the error; nothing extra needed
  }

  private broadcastPresence(): void {
    const sockets = this.ctx.getWebSockets();
    const online = sockets
      .filter((ws) => ws.readyState === WebSocket.OPEN)
      .map(
        (ws) => (ws.deserializeAttachment() as ConnectionState | null)?.userId,
      )
      .filter((id): id is string => Boolean(id));

    const msg = JSON.stringify({ type: "presence", online });
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  }
}
