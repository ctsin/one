import { useCallback, useEffect, useRef } from "react";
import { getToken } from "./auth";
import type { Message } from "../components/chat/types";

export type WsEvent =
  | { type: "message"; message: Message }
  | { type: "presence"; online: string[] };

export function useWebSocket(onEvent: (event: WsEvent) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  // Keep onEvent stable across renders without re-connecting
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let active = true;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (!active) return;
      const token = getToken();
      if (!token) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${protocol}//${window.location.host}/api/ws?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data as string) as {
            type: string;
            msgType?: string;
            id?: string;
            senderId?: string;
            content?: string;
            mediaKey?: string;
            contentType?: string;
            createdAt?: string;
            online?: string[];
          };

          if (
            data.type === "message" &&
            data.id &&
            data.senderId &&
            data.createdAt
          ) {
            const msgType = (data.msgType ?? "text") as
              | "text"
              | "image"
              | "video"
              | "file";

            if (msgType === "text") {
              if (!data.content) return;
              onEventRef.current({
                type: "message",
                message: {
                  id: data.id,
                  senderId: data.senderId,
                  content: data.content,
                  type: "text",
                  createdAt: data.createdAt,
                },
              });
            } else {
              if (!data.mediaKey) return;
              onEventRef.current({
                type: "message",
                message: {
                  id: data.id,
                  senderId: data.senderId,
                  content: null,
                  type: msgType,
                  mediaKey: data.mediaKey,
                  createdAt: data.createdAt,
                },
              });
            }
          } else if (data.type === "presence" && Array.isArray(data.online)) {
            onEventRef.current({ type: "presence", online: data.online });
          }
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (active) {
          retryTimeout = setTimeout(connect, 3000);
        }
      };

      // Browser closes the WebSocket automatically after an error;
      // onclose fires next, which schedules a reconnect if needed.
      ws.onerror = () => {};
    }

    connect();

    return () => {
      active = false;
      if (retryTimeout !== null) clearTimeout(retryTimeout);
      const ws = wsRef.current;
      wsRef.current = null;
      if (!ws) return;
      // Null out handlers first so no retry is triggered and no error handler
      // calls close() again.
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.CONNECTING) {
        // Deferring close avoids the "closed before established" browser warning
        // caused by React StrictMode's double-invocation of effects in development.
        ws.onopen = () => ws.close();
      } else {
        ws.close();
      }
    };
  }, []);

  const send = useCallback((content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "message", content }));
    }
  }, []);

  const sendMedia = useCallback((mediaKey: string, contentType: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: "media", mediaKey, contentType }),
      );
    }
  }, []);

  return { send, sendMedia };
}
