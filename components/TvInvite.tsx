"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardHeader } from "@/components/ui";

/** Large join QR for the big screen — players scan straight off the TV. */
export function TvInvite({ joinCode }: { joinCode: string }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(`${window.location.origin}/join/${joinCode}`);
  }, [joinCode]);

  return (
    <Card>
      <CardHeader title="Take a Seat" subtitle="Scan to join from your phone" />
      <div className="flex flex-col items-center gap-4 px-5 py-6">
        <div className="rounded-lg border border-brass-dim/40 bg-cream p-4 shadow-[0_6px_24px_rgba(0,0,0,0.5)]">
          {url ? (
            <QRCodeSVG value={url} size={210} bgColor="#ece3d0" fgColor="#0b0907" />
          ) : (
            <div className="h-[210px] w-[210px]" />
          )}
        </div>
        <p className="font-display text-4xl tracking-[0.35em] text-brass">{joinCode}</p>
      </div>
    </Card>
  );
}
