"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button, Card, CardHeader } from "@/components/ui";

export function InvitePanel({ joinCode, disabled }: { joinCode: string; disabled?: boolean }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(`${window.location.origin}/join/${joinCode}`);
  }, [joinCode]);

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card>
      <CardHeader
        title="The Invitation"
        subtitle={disabled ? "Session has ended" : "Players scan to take a seat"}
      />
      <div className="flex flex-col items-center gap-4 px-5 py-6">
        <div className={disabled ? "opacity-30" : ""}>
          <div className="rounded-lg border border-brass-dim/40 bg-cream p-3 shadow-[0_6px_24px_rgba(0,0,0,0.5)]">
            {url ? (
              <QRCodeSVG value={url} size={168} bgColor="#ece3d0" fgColor="#0b0907" />
            ) : (
              <div className="h-[168px] w-[168px]" />
            )}
          </div>
        </div>
        <p className="font-display text-3xl tracking-[0.35em] text-brass">{joinCode}</p>
        {!disabled && (
          <Button variant="outline" size="sm" onClick={copy} disabled={!url}>
            {copied ? "Copied" : "Copy invite link"}
          </Button>
        )}
      </div>
    </Card>
  );
}
