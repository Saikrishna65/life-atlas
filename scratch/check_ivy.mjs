import sharp from "sharp";

async function checkIvy() {
  const meta = await sharp("public/textures/foliage/ivy_diffuse.png").metadata();
  console.log("ivy_diffuse.png:", meta.width, meta.height, meta.channels, meta.hasAlpha);
}

checkIvy();
