/** Exact original comparison, bounded to two 1 MiB chunks even for large lossless files. */
export async function equalAudioBytes(a: Blob, b: Blob): Promise<boolean> {
  if (a.size !== b.size) return false;
  for (let offset = 0; offset < a.size; offset += 1048576) {
    const [x, y] = await Promise.all([
      a.slice(offset, offset + 1048576).arrayBuffer(),
      b.slice(offset, offset + 1048576).arrayBuffer(),
    ]);
    const left = new Uint8Array(x),
      right = new Uint8Array(y);
    for (let i = 0; i < left.length; i++)
      if (left[i] !== right[i]) return false;
  }
  return true;
}
