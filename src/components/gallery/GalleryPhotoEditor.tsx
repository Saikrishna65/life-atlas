"use client";
import { useState, useRef, useEffect } from "react";
import { RotateCcw, RotateCw, FlipHorizontal, Undo2 } from "lucide-react";
import { gallerySource } from "@/lib/gallery/actions";
import { editGeometry } from "@/lib/gallery/edit-geometry";
import { Modal } from "@/components/world/primitives";
import { R2, storageError } from "@/lib/r2/native";
import { useGalleryBack } from "@/lib/gallery/navigation";
import { originalRecipe, type PhotoRecipe } from "@/lib/gallery/media-tools";
export default function GalleryPhotoEditor({
  id,
  source,
  onClose,
  onSaved,
}: {
  id: string;
  source: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [recipe, setRecipe] = useState<PhotoRecipe>({ ...originalRecipe }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useGalleryBack(true, onClose, 140);
  const [previewSource, setPreviewSource] = useState(source);
  const retried = useRef(false);
  const image = useRef<HTMLImageElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 }),
    [loaded, setLoaded] = useState(false);
  const geometry = editGeometry(dimensions.width, dimensions.height, recipe);
  useEffect(() => {
    const photo = image.current,
      target = canvas.current;
    if (!photo || !target || !loaded) return;
    const geometry = editGeometry(
        photo.naturalWidth,
        photo.naturalHeight,
        recipe,
      ),
      scale = Math.min(
        1,
        1000 / Math.max(geometry.cropWidth, geometry.cropHeight),
      );
    target.width = Math.max(1, Math.round(geometry.cropWidth * scale));
    target.height = Math.max(1, Math.round(geometry.cropHeight * scale));
    const ctx = target.getContext("2d");
    if (!ctx) return;
    ctx.filter = `contrast(${recipe.contrast}) brightness(${recipe.brightness})`;
    ctx.translate(target.width / 2, target.height / 2);
    ctx.scale(scale * (recipe.flip ? -1 : 1), scale);
    ctx.rotate(geometry.angle);
    ctx.translate(-geometry.centerX, -geometry.centerY);
    ctx.drawImage(photo, 0, 0);
  }, [recipe, loaded]);
  const update = (patch: Partial<PhotoRecipe>) =>
    setRecipe((v) => ({
      ...v,
      ...patch,
      ...(patch.angle === undefined
        ? {}
        : { angle: ((((patch.angle + 180) % 360) + 360) % 360) - 180 }),
    }));
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await R2.editGalleryPhoto({ id, recipe });
      window.dispatchEvent(new Event("atlas:gallery-analysis"));
      window.dispatchEvent(new Event("atlas:gallery-restored"));
      onSaved();
    } catch (e) {
      setError(storageError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Edit a copy"
      className="pg-dialog gallery-editor"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <header>
        <h2>Make it yours.</h2>
        <button
          disabled={busy}
          onClick={() => setRecipe({ ...originalRecipe })}
        >
          <Undo2 size={17} />
          Reset
        </button>
      </header>
      <div
        className="ge-preview"
        style={{
          aspectRatio: geometry.aspect,
          width: `min(100%,calc(44dvh * ${geometry.aspect}))`,
          margin: "0 auto",
        }}
        onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return;
          const r = e.currentTarget.getBoundingClientRect();
          update({
            x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
            y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
          });
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={image}
          src={previewSource}
          alt=""
          hidden
          onLoad={(e) => {
            setDimensions({
              width: e.currentTarget.naturalWidth,
              height: e.currentTarget.naturalHeight,
            });
            setLoaded(true);
          }}
          onError={() => {
            if (retried.current) {
              setError(
                "This file cannot be previewed here. Your original is unchanged; try another editor.",
              );
              return;
            }
            retried.current = true;
            void R2.getDeviceThumbnail({ id })
              .then((result) => setPreviewSource(gallerySource(result.path)))
              .catch(() =>
                setError(
                  "This file cannot be previewed here. Your original is unchanged; try another editor.",
                ),
              );
          }}
        />
        <canvas ref={canvas} role="img" aria-label="Editing preview" />
        <i />
      </div>
      <div className="ge-rotations">
        <button
          aria-label="Rotate left"
          disabled={busy}
          onClick={() => update({ angle: (recipe.angle - 90) % 360 })}
        >
          <RotateCcw />
        </button>
        <button
          aria-label="Rotate right"
          disabled={busy}
          onClick={() => update({ angle: (recipe.angle + 90) % 360 })}
        >
          <RotateCw />
        </button>
        <button
          aria-label="Flip horizontally"
          disabled={busy}
          onClick={() => update({ flip: !recipe.flip })}
        >
          <FlipHorizontal />
        </button>
      </div>
      <label>
        Crop
        <select
          aria-label="Crop proportions"
          value={recipe.aspect}
          disabled={busy}
          onChange={(e) => update({ aspect: +e.target.value })}
        >
          <option value="0">Original proportions</option>
          <option value="1">Square</option>
          <option value={4 / 3}>4:3</option>
          <option value={3 / 4}>Portrait 3:4</option>
          <option value={16 / 9}>Wide 16:9</option>
        </select>
      </label>
      {(
        [
          { key: "zoom", label: "Crop zoom", min: 1, max: 3 },
          { key: "brightness", label: "Brightness", min: 0.5, max: 1.5 },
          { key: "contrast", label: "Contrast", min: 0.5, max: 1.5 },
        ] as const
      ).map((control) => (
        <label key={control.key}>
          {control.label}
          <input
            disabled={busy}
            type="range"
            min={control.min}
            max={control.max}
            step=".01"
            value={recipe[control.key]}
            onChange={(e) => update({ [control.key]: +e.target.value })}
          />
        </label>
      ))}
      <label>
        Straighten
        <input
          disabled={busy}
          type="range"
          min="-10"
          max="10"
          step=".25"
          value={recipe.angle - Math.round(recipe.angle / 90) * 90}
          onChange={(e) =>
            update({
              angle: Math.round(recipe.angle / 90) * 90 + +e.target.value,
            })
          }
        />
      </label>
      <p>
        Drag the preview to position the crop. Save creates a JPEG copy up to
        3072 pixels (6 MP), without location tags. Your full-resolution original
        stays unchanged; the saved copy links back to it.
      </p>
      {error && <p role="alert">{error}</p>}
      <button
        className="pg-primary"
        disabled={busy || !loaded}
        onClick={() => void save()}
      >
        {busy ? "Saving copy…" : "Save edited copy"}
      </button>
    </Modal>
  );
}
