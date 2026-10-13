import sharp from "sharp";

async function cropDoor() {
  const meta = await sharp("public/images/hero_stage1_actual.png").metadata();
  console.log("Full screenshot size:", meta.width, meta.height);

  // Door is in center x: 740 to 1160 (width 420), y: 320 to 860 (height 540)
  await sharp("public/images/hero_stage1_actual.png")
    .extract({ left: 740, top: 320, width: 420, height: 560 })
    .toFile("scratch/actual_door_crop.png");

  console.log("actual_door_crop.png successfully generated!");
}

cropDoor();
