import { useCallback, useEffect, useState } from "react";
import { getToken, getUser } from "@/lib/auth";
import { useWebSocket, type WsEvent } from "@/lib/useWebSocket";
import { Header } from "./Header";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import type { Message } from "./types";

const OTHER_USER_MAP: Record<string, { name: string }> = {
  u1: { name: "Friend" },
  u2: { name: "Root" },
};

export function Chat() {
  const me = getUser()!;
  const other = OTHER_USER_MAP[me.id] ?? { name: "Friend" };

  const [messages, setMessages] = useState<Message[]>([]);
  const [otherOnline, setOtherOnline] = useState(false);

  // Load message history on mount
  useEffect(() => {
    const token = getToken();
    fetch("/api/messages", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        const { messages: history } = data as { messages: Message[] };
        setMessages(history ?? []);
      })
      .catch(() => {});
  }, []);

  const otherId = me.id === "u1" ? "u2" : "u1";

  const handleWsEvent = useCallback(
    (event: WsEvent) => {
      if (event.type === "message") {
        setMessages((prev) => {
          // Server echoes our own sends back — deduplicate by id
          if (prev.some((m) => m.id === event.message.id)) return prev;
          return [...prev, event.message];
        });
      } else if (event.type === "presence") {
        setOtherOnline(event.online.includes(otherId));
      }
    },
    [otherId],
  );

  const { send, sendMedia } = useWebSocket(handleWsEvent);

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header other={{ name: other.name, online: otherOnline }} />
      <MessageList messages={messages} me={me} />
      <MessageInput onSend={send} onSendMedia={sendMedia} />
    </div>
  );
}
