import { useState } from "react";
import { SignIn } from "@/components/SignIn";
import { getUser } from "@/lib/auth";

function App() {
  const [authed, setAuthed] = useState(false);

  if (!authed) {
    return <SignIn onSuccess={() => setAuthed(true)} />;
  }

  const user = getUser()!;
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <p className="text-foreground">
        Welcome, {user.name}! (Chat coming in Phase 2)
      </p>
    </div>
  );
}

export default App;
