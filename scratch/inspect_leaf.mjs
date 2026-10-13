import sharp from "sharp";

async function inspectLeaf() {
  const meta = await sharp("C:/Users/HP/.gemini/antigravity-ide/brain/03f73338-fa87-45a3-9070-151616055b61/botanical_ivy_leaf_1791868334298.jpg").metadata();
  console.log("Leaf artifact size:", meta.width, meta.height);
}

inspectLeaf();
