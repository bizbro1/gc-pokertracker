"use client";

import { useTransition } from "react";
import { startSession, endSession, deleteSession } from "@/lib/actions";
import { Button } from "@/components/ui";
import { SessionStatus } from "@/lib/types";

export function StatusControls({ sessionId, status }: { sessionId: string; status: SessionStatus }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      {status === "setup" && (
        <Button
          size="md"
          disabled={pending}
          onClick={() => startTransition(async () => void (await startSession(sessionId)))}
        >
          Start the game
        </Button>
      )}
      {status === "active" && (
        <Button
          size="md"
          variant="outline"
          disabled={pending}
          onClick={() => {
            if (confirm("End the session? Cash everyone out first.")) {
              startTransition(async () => void (await endSession(sessionId)));
            }
          }}
        >
          End session
        </Button>
      )}
      {status !== "active" && (
        <Button
          size="md"
          variant="danger"
          disabled={pending}
          onClick={() => {
            if (confirm("Delete this session and everything in it? This cannot be undone.")) {
              startTransition(async () => deleteSession(sessionId));
            }
          }}
        >
          Delete
        </Button>
      )}
    </div>
  );
}
