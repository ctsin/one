import { FileDown } from "lucide-react";
import { getToken } from "@/lib/auth";
import type { Message } from "./types";

interface MessageBubbleProps {
  message: Message;
  isSent: boolean;
}

function mediaUrl(key: string) {
  return `/api/media/${encodeURIComponent(key)}?token=${encodeURIComponent(getToken() ?? "")}`;
}

export function MessageBubble({ message, isSent }: MessageBubbleProps) {
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const bubble = isSent
    ? "rounded-br-sm bg-primary text-primary-foreground"
    : "rounded-bl-sm bg-secondary text-secondary-foreground";
  const timeColor = isSent
    ? "text-primary-foreground/60"
    : "text-muted-foreground";

  return (
    <div className={`flex ${isSent ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${bubble}`}>
        {message.type === "text" && (
          <p className="whitespace-pre-wrap wrap-break-word leading-relaxed">
            {message.content}
          </p>
        )}

        {message.type === "image" && message.mediaKey && (
          <img
            src={mediaUrl(message.mediaKey)}
            alt="shared image"
            className="max-w-full rounded-lg"
            loading="lazy"
          />
        )}

        {message.type === "video" && message.mediaKey && (
          <video
            src={mediaUrl(message.mediaKey)}
            controls
            className="max-w-full rounded-lg"
          />
        )}

        {message.type === "file" && message.mediaKey && (
          <a
            href={mediaUrl(message.mediaKey)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 underline underline-offset-2"
          >
            <FileDown className="h-4 w-4 shrink-0" />
            <span className="truncate">{message.mediaKey}</span>
          </a>
        )}

        <p className={`mt-1 text-[10px] ${timeColor}`}>{time}</p>
      </div>
    </div>
  );
}
