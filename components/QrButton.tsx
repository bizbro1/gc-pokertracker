"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui";

/** Header button that pops the join QR code up in a modal. */
export function QrButton({ joinCode }: { joinCode: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(`${window.location.origin}/join/${joinCode}`);
  }, [joinCode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <Button variant="outline" size="md" onClick={() => setOpen(true)}>
        QR code
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/80 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex flex-col items-center gap-5 rounded-xl border hairline bg-gradient-to-b from-espresso to-coal px-10 py-8 shadow-[0_20px_60px_rgba(0,0,0,0.7)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs uppercase tracking-[0.3em] text-cream-dim">
              Players scan to take a seat
            </p>
            <div className="rounded-lg border border-brass-dim/40 bg-cream p-4 shadow-[0_6px_24px_rgba(0,0,0,0.5)]">
              {url ? (
                <QRCodeSVG value={url} size={260} bgColor="#ece3d0" fgColor="#0b0907" />
              ) : (
                <div className="h-[260px] w-[260px]" />
              )}
            </div>
            <p className="font-display text-4xl tracking-[0.35em] text-brass">{joinCode}</p>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={copy} disabled={!url}>
                {copied ? "Copied" : "Copy invite link"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
