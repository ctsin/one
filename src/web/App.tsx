import { useState } from "react";
import { SignIn } from "@/components/SignIn";
import { Chat } from "@/components/chat/Chat";

function App() {
  const [authed, setAuthed] = useState(false);

  if (!authed) {
    return <SignIn onSuccess={() => setAuthed(true)} />;
  }

  return <Chat />;
}

export default App;
