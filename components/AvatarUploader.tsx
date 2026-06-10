"use client";

import { useRef, useState, useTransition } from "react";
import { uploadAvatar } from "@/lib/actions";

const MAX_DIM = 384;

/** Downscale on the phone so uploads are tiny regardless of camera resolution. */
async function shrinkToJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not process image"))),
      "image/jpeg",
      0.85
    );
  });
}

export function AvatarUploader({ sessionId }: { sessionId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onPick(file: File | undefined) {
    if (!file) return;
    setError(null);
    let blob: Blob;
    try {
      blob = await shrinkToJpeg(file);
    } catch {
      setError("Could not read that image");
      return;
    }
    const formData = new FormData();
    formData.set("file", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
    startTransition(async () => {
      const res = await uploadAvatar(sessionId, formData);
      if (!res.ok && res.error) setError(res.error);
    });
  }

  return (
    <div className="text-center">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void onPick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className="text-[10px] uppercase tracking-[0.2em] text-cream-dim underline-offset-4 hover:text-brass transition disabled:opacity-50 cursor-pointer"
      >
        {pending ? "Uploading\u2026" : "Change photo"}
      </button>
      {error && <p className="mt-1 text-[11px] text-loss">{error}</p>}
    </div>
  );
}
