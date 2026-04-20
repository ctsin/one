import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, SendHorizonal } from "lucide-react";
import { getToken } from "@/lib/auth";

interface MessageInputProps {
  onSend: (content: string) => void;
  onSendMedia: (mediaKey: string, contentType: string) => void;
  disabled?: boolean;
}

export function MessageInput({
  onSend,
  onSendMedia,
  disabled,
}: MessageInputProps) {
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    autoResize();
  }

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    // Reset input so the same file can be re-selected
    fileInputRef.current.value = "";
    if (!file) return;

    setUploadError(null);
    setUploading(true);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "X-Content-Type": file.type || "application/octet-stream",
          "X-File-Name": encodeURIComponent(file.name),
        },
        body: file,
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setUploadError(err.error ?? "Upload failed");
        return;
      }
      const { key, contentType } = (await res.json()) as {
        key: string;
        contentType: string;
      };
      onSendMedia(key, contentType);
    } catch {
      setUploadError("Upload failed — check your connection");
    } finally {
      setUploading(false);
    }
  }

  const busy = disabled || uploading;

  return (
    <div className="flex flex-col border-t border-border bg-background shrink-0">
      {uploadError && (
        <p className="px-4 pt-2 text-xs text-destructive">{uploadError}</p>
      )}
      <div className="flex items-end gap-2 px-4 py-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip"
          className="hidden"
          onChange={handleFileChange}
          disabled={busy}
        />
        <button
          type="button"
          className="mb-0.5 shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          title="Attach file"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip
            className={`h-5 w-5 ${uploading ? "animate-pulse" : ""}`}
          />
        </button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Message…"
          rows={1}
          className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring overflow-hidden"
          disabled={busy}
        />
        <Button
          type="button"
          size="icon"
          className="mb-0.5 shrink-0"
          disabled={!text.trim() || busy}
          onClick={submit}
        >
          <SendHorizonal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
