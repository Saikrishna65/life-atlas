import sharp from "sharp";

async function cropIvyFromRef() {
  // reference_door.png size is 360x420
  // Left ivy is around x: 50 to 140, y: 180 to 380
  await sharp("scratch/reference_door.png")
    .extract({ left: 60, top: 180, width: 80, height: 180 })
    .toFile("scratch/ref_left_ivy.png");

  // Top ivy is around x: 150 to 320, y: 0 to 60
  await sharp("scratch/reference_door.png")
    .extract({ left: 140, top: 0, width: 180, height: 60 })
    .toFile("scratch/ref_top_ivy.png");

  // Right ivy is around x: 260 to 330, y: 0 to 160
  await sharp("scratch/reference_door.png")
    .extract({ left: 260, top: 0, width: 70, height: 160 })
    .toFile("scratch/ref_right_ivy.png");

  console.log("Crops created!");
}

cropIvyFromRef();
