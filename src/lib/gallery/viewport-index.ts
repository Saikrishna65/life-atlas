/** An interval index for positioned tiles. Query cost depends on the visible window. */
export class GalleryViewportIndex<T extends { y: number; height: number }> {
  private sorted: { item: T; order: number; bottom: number }[];
  private bottoms: Float64Array;
  constructor(items: readonly T[]) {
    this.sorted = items
      .map((item, order) => ({ item, order, bottom: item.y + item.height }))
      .filter(
        (value) =>
          Number.isFinite(value.item.y) &&
          Number.isFinite(value.item.height) &&
          value.item.height >= 0,
      )
      .sort((a, b) => a.item.y - b.item.y || a.order - b.order);
    this.bottoms = new Float64Array(Math.max(1, this.sorted.length * 4));
    if (this.sorted.length) this.build(1, 0, this.sorted.length - 1);
  }
  private build(node: number, start: number, end: number): number {
    if (start === end) return (this.bottoms[node] = this.sorted[start].bottom);
    const middle = (start + end) >>> 1;
    return (this.bottoms[node] = Math.max(
      this.build(node * 2, start, middle),
      this.build(node * 2 + 1, middle + 1, end),
    ));
  }
  query(top: number, height: number, overscan = 600) {
    const found: typeof this.sorted = [];
    const before = Number.isFinite(top) ? top : 0;
    const margin = Number.isFinite(overscan) ? Math.max(0, overscan) : 0;
    const low = before - margin,
      high =
        before + Math.max(0, Number.isFinite(height) ? height : 0) + margin;
    let visited = 0;
    const visit = (node: number, start: number, end: number) => {
      visited++;
      if (this.bottoms[node] < low || this.sorted[start].item.y > high) return;
      if (start === end) {
        found.push(this.sorted[start]);
        return;
      }
      const middle = (start + end) >>> 1;
      visit(node * 2, start, middle);
      visit(node * 2 + 1, middle + 1, end);
    };
    if (this.sorted.length) visit(1, 0, this.sorted.length - 1);
    found.sort((a, b) => a.order - b.order);
    return { items: found.map((value) => value.item), visited };
  }
}
