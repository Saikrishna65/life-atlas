"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ImagePlus, RotateCcw, Smartphone } from "lucide-react";
import { AppIcons, supportsAppIcons, type IconSummary } from "@/lib/app-icons/native";
import { defaultDesign, drawIcon, iconApps, iconColors, validIconLabel, type IconDesign, type IconModule, type IconShape, type IconStyle } from "@/lib/app-icons/design";
import { decodeIconPhoto } from "@/lib/app-icons/image";
import "./app-icons.css";
const subscribe = () => () => {};
export default function AppIconSettings() {
  const native = useSyncExternalStore(subscribe, supportsAppIcons, () => false);
  const [design, setDesign] = useState<IconDesign>(() => defaultDesign("atlas"));
  const [label, setLabel] = useState("Atlas");
  const [photo, setPhoto] = useState<ImageBitmap | null>(null);
  const [summaries, setSummaries] = useState<IconSummary[]>([]);
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const sequence = useRef(0);
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const summary = summaries.find((app) => app.module === design.module);
  const installed = design.module !== "video" || summary?.installed === true;
  useEffect(() => {
    let active = true;
    if (canvas.current) {
      try { drawIcon(canvas.current, design, photo || undefined); }
      catch { queueMicrotask(() => { if (active) setError("This image could not be previewed. Choose another image."); }); }
    }
    return () => { active = false; };
  }, [design, photo]);
  useEffect(() => () => photo?.close(), [photo]);
  useEffect(() => { const gate = sequence; return () => { gate.current++; }; }, []);
  useEffect(() => {
    if (!native) return;
    let active = true;
    const request = sequence.current;
    AppIcons.getSettings().then((settings) => {
      if (active) { setSupported(settings.supported); setSummaries(settings.apps); }
    }).catch(() => { if (active) setError("Icon settings could not load. Reopen this page to retry."); });
    AppIcons.getIcon({ module: "atlas" }).then(async (saved) => {
      const image = saved.pngBase64 && saved.design?.source !== "preset" ? await decode(saved.pngBase64) : null;
      if (active && sequence.current === request) { setLabel(saved.label); setDesign({ ...defaultDesign(saved.module), ...saved.design }); setPhoto(image); }
      else image?.close();
    }).catch(() => {});
    return () => { active = false; };
  }, [native]);
  async function decode(encoded: string) {
    const response = await fetch(`data:image/png;base64,${encoded}`);
    return createImageBitmap(await response.blob());
  }
  function remember(saved: IconSummary) {
    setSummaries((previous) => [...previous.filter((app) => app.module !== saved.module), saved]);
  }
  async function chooseModule(module: IconModule) {
    const request = ++sequence.current;
    setDesign(defaultDesign(module)); setPhoto(null);
    setLabel(iconApps.find((app) => app.id === module)!.name);
    setError(""); setNotice("");
    if (!native) return;
    setBusy(true);
    try {
      const saved = await AppIcons.getIcon({ module });
      const image = saved.pngBase64 && saved.design?.source !== "preset" ? await decode(saved.pngBase64) : null;
      if (request === sequence.current) { setLabel(saved.label); setDesign({ ...defaultDesign(saved.module), ...saved.design }); setPhoto(image); remember(saved); }
      else image?.close();
    } catch { if (request === sequence.current) setError("The saved icon could not load. Choose another app and retry."); }
    finally { if (request === sequence.current) setBusy(false); }
  }
  async function choosePhoto(selected?: File) {
    if (!selected) return;
    if (!/^image\/(jpeg|png|webp)$/.test(selected.type) || selected.size > 15 * 1024 * 1024) {
      setError("Choose a JPEG, PNG or WebP image under 15 MB."); return;
    }
    const request = ++sequence.current;
    setBusy(true); setError(""); setNotice("");
    try {
      // Decode a bounded derivative; do not keep a full-resolution photo in the WebView.
      const image = await decodeIconPhoto(selected);
      if (image.width < 1 || image.height < 1 || image.height > 16384) { image.close(); throw Error(); }
      if (request === sequence.current) {
        setPhoto(image); setDesign((value) => ({ ...value, zoom: 1, x: 0.5, y: 0.5 }));
      } else image.close();
    } catch { if (request === sequence.current) setError("This photo could not be opened. Try a different JPEG, PNG or WebP."); }
    finally { if (request === sequence.current) setBusy(false); }
  }
  function preset(style: IconStyle) {
    sequence.current++; setPhoto(null); setNotice("");
    setDesign((value) => ({ ...value, style, zoom: 1, x: 0.5, y: 0.5 }));
  }
  async function apply(pin: boolean) {
    if (!canvas.current || !validIconLabel(label) || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const pngBase64 = canvas.current.toDataURL("image/png").split(",")[1];
      const saved = await AppIcons.saveIcon({ module: design.module, label: label.trim(), pngBase64, design: { style: design.style, shape: design.shape, color: design.color, source: photo ? "photo" : "preset" } });
      remember(saved);
      if (pin) {
        const result = await AppIcons.pinIcon({ module: design.module });
        setNotice(result.updated ? "Your existing home-screen icon was updated. Your launcher may take a moment to refresh it."
          : result.requested ? "Confirm Add on your phone’s home-screen prompt."
          : "Your launcher does not support pinning. The icon is saved; you can try another launcher.");
      } else setNotice(saved.updated ? "Saved. Your existing home-screen icon was updated." : "Saved on this device. Tap Add to home screen when you’re ready.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The icon could not be saved. Try again."); }
    finally { setBusy(false); }
  }
  async function reset() {
    setBusy(true); setError(""); setNotice("");
    try {
      const saved = await AppIcons.resetIcon({ module: design.module });
      remember(saved); setPhoto(null); setDesign(defaultDesign(design.module)); setLabel(saved.label);
      setNotice("Original icon restored. Existing home-screen shortcuts refresh when your launcher applies the change.");
    } catch { setError("The icon could not be reset. Try again."); }
    finally { setBusy(false); }
  }
  const change = (key: "zoom" | "x" | "y", value: number) => setDesign((previous) => ({ ...previous, [key]: value }));
  return <section className="atlas-icon-settings" aria-labelledby="icon-settings-title">
    <div className="ai-heading"><Smartphone size={23}/><div><h2 id="icon-settings-title">A little more you.</h2><p>Make a home-screen icon for the Atlas app you open most.</p></div></div>
    <div className="ai-apps" role="group" aria-label="Choose an app">{iconApps.map((app) => <button key={app.id} disabled={busy} aria-pressed={app.id === design.module} onClick={() => void chooseModule(app.id)}>{app.name}</button>)}</div>
    <div className="ai-workspace">
      <div className="ai-preview-panel"><span>HOME SCREEN PREVIEW</span><div className="ai-phone">
        <div className="ai-preview-icon"><canvas ref={canvas} width={512} height={512} aria-label={`${label || "Atlas"} icon preview`} role="img"
          onPointerDown={(event) => { if (!photo || busy) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: design.x, y: design.y, startX: event.clientX, startY: event.clientY }; }}
          onPointerMove={(event) => { const start = drag.current; if (!start) return; const scale = event.currentTarget.getBoundingClientRect().width; setDesign((value) => ({ ...value, x: Math.max(0, Math.min(1, start.x - (event.clientX - start.startX) / scale)), y: Math.max(0, Math.min(1, start.y - (event.clientY - start.startY) / scale)) })); }}
          onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}/><strong>{label || "Atlas"}</strong></div>
        <div className="ai-phone-dock" aria-hidden="true"><i/><i/><i/><i/></div>
      </div><p>{photo ? "Drag the picture or use the crop sliders." : "Live preview. Your launcher may apply its own icon mask."}</p></div>
      <div className="ai-editor">
        <fieldset disabled={busy}><legend>Icon style</legend><div className="ai-options">{(["solid", "light", "outline"] as IconStyle[]).map((style) => <button key={style} aria-pressed={!photo && design.style === style} onClick={() => preset(style)}>{style === "solid" ? "Signature" : style === "light" ? "Light" : "Outline"}</button>)}</div></fieldset>
        {!photo && <fieldset disabled={busy}><legend>Color</legend><div className="ai-colors">{iconColors.map((color, i) => <button key={color} style={{ backgroundColor: color }} aria-label={["Forest", "Graphite", "Ocean", "Plum", "Terracotta", "Gold"][i]} aria-pressed={design.color === color} onClick={() => setDesign((value) => ({ ...value, color }))}/>)}</div></fieldset>}
        <fieldset disabled={busy}><legend>Shape</legend><div className="ai-options">{(["rounded", "circle", "square"] as IconShape[]).map((shape) => <button key={shape} aria-pressed={design.shape === shape} onClick={() => setDesign((value) => ({ ...value, shape }))}>{shape === "rounded" ? "Soft square" : shape === "circle" ? "Circle" : "Square"}</button>)}</div></fieldset>
        <input ref={file} className="ai-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const selected = event.target.files?.[0]; event.target.value = ""; void choosePhoto(selected); }}/>
        <button className="ai-photo-button" disabled={busy} onClick={() => file.current?.click()}><ImagePlus size={18}/>{photo ? "Choose another photo" : "Use my own photo"}</button>
        {photo && <fieldset disabled={busy} className="ai-crop"><legend>Crop your picture</legend>{([['zoom', 'Zoom', 1, 3], ['x', 'Horizontal position', 0, 1], ['y', 'Vertical position', 0, 1]] as const).map(([key, title, min, max]) => <label key={key}>{title}<input aria-label={title} type="range" min={min} max={max} step={0.01} value={design[key]} onChange={(event) => change(key, Number(event.target.value))}/></label>)}<button onClick={() => setDesign((value) => ({ ...value, zoom: 1, x: 0.5, y: 0.5 }))}>Center picture</button></fieldset>}
        <label className="ai-label">Name beneath the icon<input value={label} disabled={busy} maxLength={64} onChange={(event) => setLabel(event.target.value)} autoComplete="off"/></label>
        {!validIconLabel(label) && <p className="ai-error">Use 1–32 characters without control characters.</p>}
        {!installed && native && <p>Install Atlas Video from Atlas Apps before adding its icon.</p>}
        <div className="ai-actions"><button disabled={!native || busy || !validIconLabel(label)} onClick={() => void apply(false)}>{busy ? "Working…" : "Save icon"}</button><button disabled={!native || !supported || !installed || busy || !validIconLabel(label)} onClick={() => void apply(true)}>Add to home screen</button><button className="ai-reset" disabled={!native || busy} onClick={() => void reset()}><RotateCcw size={15}/>Restore original</button></div>
      </div>
    </div>
    {error && <p className="ai-error" role="alert">{error}</p>}{notice && <p className="ai-notice" role="status">{notice}</p>}
    <p className="ai-explanation">{native ? "These settings change Atlas home-screen shortcuts. App-drawer icons stay unchanged. Updates depend on your launcher; some launchers add a shortcut badge. Photos stay on this device as a small icon without EXIF metadata." : "You can preview designs here. Saving and adding icons requires the updated Atlas Android app."}</p>
  </section>;
}
