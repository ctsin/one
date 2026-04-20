interface HeaderProps {
  appName?: string;
  other: { name: string; online: boolean };
}

export function Header({ appName = "One", other }: HeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-background px-4 py-3 shrink-0">
      <span className="text-lg font-semibold tracking-tight text-foreground">
        {appName}
      </span>
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
    </header>
  );
}
