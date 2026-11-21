/** Picker/import support is broader than any one phone's decoder. Never transcode originals. */
export const audioFormats: Record<string, string> = {
  mp3: "audio/mpeg",
  mp2: "audio/mpeg",
  mp1: "audio/mpeg",
  mpeg: "audio/mpeg",
  mpga: "audio/mpeg",
  m4a: "audio/mp4",
  m4b: "audio/mp4",
  m4p: "audio/mp4",
  mp4: "audio/mp4",
  aac: "audio/aac",
  adts: "audio/aac",
  flac: "audio/flac",
  wav: "audio/wav",
  wave: "audio/wav",
  bwf: "audio/wav",
  rf64: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  spx: "audio/ogg",
  aif: "audio/aiff",
  aiff: "audio/aiff",
  aifc: "audio/aiff",
  alac: "audio/mp4",
  caf: "audio/x-caf",
  ape: "audio/x-ape",
  mac: "audio/x-ape",
  wv: "audio/x-wavpack",
  wma: "audio/x-ms-wma",
  asf: "audio/x-ms-asf",
  dsf: "audio/dsf",
  dff: "audio/dff",
  dsd: "audio/dsd",
  amr: "audio/amr",
  awb: "audio/amr-wb",
  "3gp": "audio/3gpp",
  "3ga": "audio/3gpp",
  "3g2": "audio/3gpp2",
  webm: "audio/webm",
  weba: "audio/webm",
  mka: "audio/x-matroska",
  ac3: "audio/ac3",
  eac3: "audio/eac3",
  ec3: "audio/eac3",
  dts: "audio/vnd.dts",
  dtshd: "audio/vnd.dts.hd",
  au: "audio/basic",
  snd: "audio/basic",
  voc: "audio/x-voc",
  tta: "audio/x-tta",
  tak: "audio/x-tak",
  mpc: "audio/x-musepack",
  mpp: "audio/x-musepack",
  shn: "audio/x-shorten",
  mid: "audio/midi",
  midi: "audio/midi",
  rmi: "audio/midi",
  kar: "audio/midi",
  mod: "audio/x-mod",
  xm: "audio/x-xm",
  it: "audio/x-it",
  s3m: "audio/x-s3m",
  stm: "audio/x-stm",
  mtm: "audio/x-mtm",
  umx: "audio/x-mod",
  mo3: "audio/x-mo3",
};
export const audioFileAccept = [
  "audio/*",
  ...Object.keys(audioFormats).map((ext) => "." + ext),
  "application/ogg",
  "application/x-ogg",
  "video/mp4",
  "video/webm",
].join(",");
export function audioMime(file: {
  name: string;
  type: string;
}): string | undefined {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return (
    audioFormats[ext] ||
    (file.type.startsWith("audio/") ? file.type : undefined)
  );
}
export const decoderNotice =
  "Imported originals are kept unchanged. Playback depends on your phone’s decoder; protected files, tracker music and some specialist formats may not play.";
