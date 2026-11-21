"use client";
import { useEffect, useRef, useState } from "react";
import { X, Copy, Scissors, Share2, Download } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Modal } from "@/components/world/primitives";
import { R2, storageError } from "@/lib/r2/native";
import { useGalleryBack } from "@/lib/gallery/navigation";
import "./gallery-extraction.css";
export default function GalleryExtraction({
  id,
  source,
  point,
  onClose,
}: {
  id: string;
  source: string;
  point: { x: number; y: number };
  onClose: () => void;
}) {
  const [ocr, setOcr] =
      useState<Awaited<ReturnType<typeof R2.extractGalleryText>>>(),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("Reading text"),
    [sticker, setSticker] =
      useState<Awaited<ReturnType<typeof R2.createGallerySticker>>>(),
    [tab, setTab] = useState<"text" | "sticker">("text"),
    [consent, setConsent] = useState(false);
  const [at, setAt] = useState(point),
    [aspect, setAspect] = useState(1);
  const field = useRef<HTMLTextAreaElement>(null),
    alive = useRef(true);
  useGalleryBack(true, onClose, 150);
  useEffect(() => {
    alive.current = true;
    void R2.extractGalleryText({ id })
      .then((result) => {
        if (!alive.current) return;
        setOcr(result);
        const chosen = result.blocks.find(
          (b) =>
            point.x >= b.left &&
            point.x <= b.left + b.width &&
            point.y >= b.top &&
            point.y <= b.top + b.height,
        );
        setText(chosen?.text || result.text);
      })
      .catch((e) => {
        if (alive.current) setError(storageError(e));
      })
      .finally(() => {
        if (alive.current) setBusy("");
      });
    return () => {
      alive.current = false;
    };
  }, [id, point]);
  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      if (alive.current) setError(storageError(e));
    } finally {
      if (alive.current) setBusy("");
    }
  }
  return (
    <Modal title="Text and stickers" onClose={onClose} className="gextract">
      <header>
        <h2>Text & stickers</h2>
        <button aria-label="Close extraction" onClick={onClose}>
          <X />
        </button>
      </header>
      <nav aria-label="Extraction type">
        <button aria-pressed={tab === "text"} onClick={() => setTab("text")}>
          <Copy size={17} />
          Text
        </button>
        <button
          aria-pressed={tab === "sticker"}
          onClick={() => setTab("sticker")}
        >
          <Scissors size={17} />
          Sticker
        </button>
      </nav>
      <div
        className={`gextract-preview ${sticker && tab === "sticker" ? "is-cutout" : ""}`}
        style={{
          aspectRatio: aspect,
          width: `min(100%, calc(38dvh * ${aspect}))`,
        }}
        onClick={(event) => {
          if (tab !== "sticker" || sticker) return;
          const r = event.currentTarget.getBoundingClientRect();
          setAt({
            x: (event.clientX - r.left) / r.width,
            y: (event.clientY - r.top) / r.height,
          });
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={
            tab === "sticker" && sticker
              ? Capacitor.convertFileSrc(sticker.path)
              : source
          }
          alt={
            sticker && tab === "sticker"
              ? "Extracted subject on a transparent background"
              : "Original photo"
          }
          onLoad={(e) => {
            if (!sticker)
              setAspect(
                e.currentTarget.naturalWidth / e.currentTarget.naturalHeight,
              );
          }}
        />
        {tab === "text" &&
          ocr?.blocks.map((block, i) => (
            <button
              key={i}
              aria-label={`Select text: ${block.text}`}
              title={block.text}
              style={{
                left: `${block.left * 100}%`,
                top: `${block.top * 100}%`,
                width: `${block.width * 100}%`,
                height: `${block.height * 100}%`,
              }}
              onClick={() => setText(block.text)}
            />
          ))}
        {tab === "sticker" && !sticker && (
          <span
            className="gextract-target"
            style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%` }}
          >
            +
          </span>
        )}
      </div>
      {tab === "text" ? (
        <>
          <p>
            Tap highlighted text, or select words below. English recognition
            stays on this device.
          </p>
          <textarea
            ref={field}
            aria-label="Recognised text"
            readOnly
            value={text}
            placeholder={busy ? "Reading…" : "No readable text found."}
          />
          <div className="gextract-actions">
            <button
              disabled={!text || !!busy}
              onClick={() =>
                void run("Copying", async () => {
                  const input = field.current,
                    selection =
                      input && input.selectionEnd > input.selectionStart
                        ? text.slice(input.selectionStart, input.selectionEnd)
                        : text;
                  await navigator.clipboard.writeText(selection);
                  setNotice("Text copied.");
                })
              }
            >
              <Copy size={17} />
              Copy text
            </button>
            <button disabled={!ocr} onClick={() => setText(ocr?.text || "")}>
              All text
            </button>
          </div>
        </>
      ) : (
        <>
          <p>
            {sticker
              ? "A separate transparent PNG. Your original is unchanged."
              : "Tap the person, pet or foreground object you want to lift. Cutout quality varies by photo."}
          </p>
          {!sticker && (
            <>
              <label>
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />{" "}
                Allow on-device subject extraction. Google Play services may
                download its model on first use.
              </label>
              <button
                disabled={!!busy || !consent}
                onClick={() =>
                  void run("Lifting subject", async () => {
                    const value = await R2.createGallerySticker({
                      id,
                      ...at,
                      consent: true,
                    });
                    if (alive.current) setSticker(value);
                  })
                }
              >
                <Scissors size={17} />
                Lift subject
              </button>
            </>
          )}
          {sticker && (
            <div className="gextract-actions">
              <button
                disabled={!!busy}
                onClick={() =>
                  void run("Copying", async () => {
                    await R2.copyGallerySticker({ token: sticker.token });
                    setNotice(
                      "Copied. Paste into an app that supports images.",
                    );
                  })
                }
              >
                <Copy size={17} />
                Copy sticker
              </button>
              <button
                disabled={!!busy}
                onClick={() =>
                  void run("Saving", async () => {
                    await R2.saveGallerySticker({ token: sticker.token });
                    setNotice("Saved to Pictures / Atlas Stickers.");
                  })
                }
              >
                <Download size={17} />
                Save PNG
              </button>
              <button
                disabled={!!busy}
                onClick={() =>
                  void run("Sharing", () =>
                    R2.shareGallerySticker({ token: sticker.token }),
                  )
                }
              >
                <Share2 size={17} />
                Share
              </button>
              <button
                disabled={!!busy}
                onClick={() =>
                  void run("Opening WhatsApp", () =>
                    R2.shareGallerySticker({
                      token: sticker.token,
                      target: "whatsapp",
                    }),
                  )
                }
              >
                WhatsApp
              </button>
              <button disabled={!!busy} onClick={() => setSticker(undefined)}>
                Try another subject
              </button>
            </div>
          )}
        </>
      )}
      {busy && <p role="status">{busy}…</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </Modal>
  );
}
