import { useCallback, useEffect, useState } from "react";
import { getToken, getUser, setAuth } from "@/lib/auth";
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
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [myName, setMyName] = useState(me.name);

  // Load message history on mount
  useEffect(() => {
    const token = getToken();
    fetch("/api/messages", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load messages");
        return res.json();
      })
      .then((data) => {
        const { messages: history } = data as { messages: Message[] };
        setMessages(history ?? []);
      })
      .catch((err: unknown) => {
        setHistoryError(
          err instanceof Error ? err.message : "Failed to load messages",
        );
      })
      .finally(() => setHistoryLoading(false));
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

  const { send, sendMedia, isConnected } = useWebSocket(handleWsEvent);

  async function handleNameSave(name: string) {
    const token = getToken();
    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { token: string; name: string };
    setAuth(data.token, { id: me.id, name: data.name });
    setMyName(data.name);
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header
        other={{ name: other.name, online: otherOnline }}
        myName={myName}
        isConnected={isConnected}
        onNameSave={handleNameSave}
      />
      <MessageList
        messages={messages}
        me={me}
        loading={historyLoading}
        error={historyError}
      />
      <MessageInput
        onSend={send}
        onSendMedia={sendMedia}
        disabled={!isConnected}
      />
    </div>
  );
}
