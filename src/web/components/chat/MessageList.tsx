import { useEffect, useRef } from "react";
import type { AuthUser } from "@/lib/auth";
import type { Message } from "./types";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: Message[];
  me: AuthUser;
  loading: boolean;
  error: string | null;
}

export function MessageList({
  messages,
  me,
  loading,
  error,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {loading ? (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-muted-foreground animate-pulse">
            Loading messages…
          </p>
        </div>
      ) : error ? (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : messages.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-muted-foreground">
            No messages yet. Say hi!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isSent={msg.senderId === me.id}
            />
          ))}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
