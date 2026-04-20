import { useState } from "react";
import { Pencil, Check, X, WifiOff } from "lucide-react";

interface HeaderProps {
  appName?: string;
  other: { name: string; online: boolean };
  myName: string;
  isConnected: boolean;
  onNameSave: (name: string) => Promise<void>;
}

export function Header({
  appName = "One",
  other,
  myName,
  isConnected,
  onNameSave,
}: HeaderProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(myName);
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setDraft(myName);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  async function commitEdit() {
    const name = draft.trim();
    if (!name || name === myName) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onNameSave(name);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commitEdit();
    if (e.key === "Escape") cancelEdit();
  }

  return (
    <header className="flex items-center justify-between border-b border-border bg-background px-4 py-3 shrink-0">
      {/* Left: app name + optional "me" name editor */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-lg font-semibold tracking-tight text-foreground shrink-0">
          {appName}
        </span>
        {!editing ? (
          <button
            onClick={startEdit}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            title="Edit your name"
          >
            <span className="truncate">{myName}</span>
            <Pencil className="h-3 w-3 shrink-0" />
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={saving}
              className="w-28 rounded border border-input bg-background px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              onClick={commitEdit}
              disabled={saving || !draft.trim()}
              className="text-muted-foreground hover:text-foreground disabled:opacity-40"
              title="Save"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={cancelEdit}
              disabled={saving}
              className="text-muted-foreground hover:text-foreground"
              title="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Right: disconnected badge + other user presence */}
      <div className="flex items-center gap-3 shrink-0">
        {!isConnected && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <WifiOff className="h-3 w-3" />
            reconnecting…
          </span>
        )}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {other.online && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                other.online ? "bg-green-500" : "bg-muted-foreground/30"
              }`}
            />
          </span>
          <span className="text-sm text-foreground">{other.name}</span>
        </div>
      </div>
    </header>
  );
}
