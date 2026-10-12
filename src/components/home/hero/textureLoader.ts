import * as THREE from "three";

const textureLoader = new THREE.TextureLoader();

export interface PBRMaterialMaps {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}

/**
 * Loads PBR texture sets from local public/textures directory
 * Sets sRGBColorSpace on albedo maps and enables repeat wrapping.
 */
export function loadPBRTextures(folder: "wood" | "ground" | "bark" | "brick"): PBRMaterialMaps {
  const map = textureLoader.load(`/textures/${folder}/diff.jpg`);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const normalMap = textureLoader.load(`/textures/${folder}/nor.jpg`);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;

  const roughnessMap = textureLoader.load(`/textures/${folder}/rough.jpg`);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;

  return { map, normalMap, roughnessMap };
}

/**
 * Loads weathered white painted wood specifically tuned for the door:
 * Adjusts luminance curves so the paint is crisp chalky weathered white (#f6f4ee)
 * while preserving deep wood grain cracks and chipped edge detail.
 */
export function loadWhiteWeatheredWoodTextures(): PBRMaterialMaps {
  const { map: baseMap, normalMap, roughnessMap } = loadPBRTextures("wood");

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = "/textures/wood/diff.jpg";
  img.onload = () => {
    ctx.drawImage(img, 0, 0, 1024, 1024);
    const imgData = ctx.getImageData(0, 0, 1024, 1024);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // Weathered white paint luminance mapping
      if (lum > 70) {
        // Crisp chalky antique white with subtle warm off-white undertones
        const boost = Math.min(252, lum * 1.50 + 60);
        data[i] = Math.floor(boost);
        data[i + 1] = Math.floor(boost - 5);
        data[i + 2] = Math.floor(boost - 14);
      } else {
        // Deepen aged chipped dark wood underneath
        data[i] = Math.floor(r * 0.70);
        data[i + 1] = Math.floor(g * 0.64);
        data[i + 2] = Math.floor(b * 0.58);
      }
    }

    ctx.putImageData(imgData, 0, 0);
    baseMap.image = canvas;
    baseMap.needsUpdate = true;
  };

  return { map: baseMap, normalMap, roughnessMap };
}
