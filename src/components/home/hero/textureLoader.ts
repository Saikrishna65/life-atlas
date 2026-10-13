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

export interface MasterDoorMaterialMaps extends PBRMaterialMaps {
  aoMap: THREE.Texture;
  metalnessMap: THREE.Texture;
}

/**
 * Loads the photorealistic master door PBR texture set (exact match to reference artwork)
 */
export function loadMasterDoorTextures(): MasterDoorMaterialMaps {
  const map = textureLoader.load("/textures/door/door_master_diff.jpg");
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.ClampToEdgeWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;

  const normalMap = textureLoader.load("/textures/door/door_master_nor.jpg");
  normalMap.wrapS = THREE.ClampToEdgeWrapping;
  normalMap.wrapT = THREE.ClampToEdgeWrapping;

  const roughnessMap = textureLoader.load("/textures/door/door_master_rough.jpg");
  roughnessMap.wrapS = THREE.ClampToEdgeWrapping;
  roughnessMap.wrapT = THREE.ClampToEdgeWrapping;

  const aoMap = textureLoader.load("/textures/door/door_master_ao.jpg");
  aoMap.wrapS = THREE.ClampToEdgeWrapping;
  aoMap.wrapT = THREE.ClampToEdgeWrapping;

  const metalnessMap = textureLoader.load("/textures/door/door_master_metal.jpg");
  metalnessMap.wrapS = THREE.ClampToEdgeWrapping;
  metalnessMap.wrapT = THREE.ClampToEdgeWrapping;

  return { map, normalMap, roughnessMap, aoMap, metalnessMap };
}

/**
 * Loads weathered white painted wood specifically tuned for the door:
 * High-resolution photorealistic antique peeling white paint with authentic cracks.
 */
export function loadWhiteWeatheredWoodTextures(): PBRMaterialMaps {
  const map = textureLoader.load("/textures/wood/weathered_white_diff.jpg");
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const normalMap = textureLoader.load("/textures/wood/weathered_white_nor.jpg");
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;

  const roughnessMap = textureLoader.load("/textures/wood/weathered_white_rough.jpg");
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;

  return { map, normalMap, roughnessMap };
}

/**
 * Loads high-res foliage textures with transparent alpha
 */
export function loadFoliageTextures(): {
  ivyMap: THREE.Texture;
  ivyTendrilMap: THREE.Texture;
  ivyLeafLargeMap: THREE.Texture;
  ivyLeafYoungMap: THREE.Texture;
  ivyLeafCenterMap: THREE.Texture;
  daisyMap: THREE.Texture;
} {
  const ivyMap = textureLoader.load("/textures/foliage/ivy_diffuse.png");
  ivyMap.colorSpace = THREE.SRGBColorSpace;

  const ivyTendrilMap = textureLoader.load("/textures/foliage/ivy_tendril_full.png");
  ivyTendrilMap.colorSpace = THREE.SRGBColorSpace;

  const ivyLeafLargeMap = textureLoader.load("/textures/foliage/ivy_single_large.png");
  ivyLeafLargeMap.colorSpace = THREE.SRGBColorSpace;

  const ivyLeafYoungMap = textureLoader.load("/textures/foliage/ivy_single_young.png");
  ivyLeafYoungMap.colorSpace = THREE.SRGBColorSpace;

  const ivyLeafCenterMap = textureLoader.load("/textures/foliage/ivy_leaf_center.png");
  ivyLeafCenterMap.colorSpace = THREE.SRGBColorSpace;

  const daisyMap = textureLoader.load("/textures/foliage/daisy_diffuse.png");
  daisyMap.colorSpace = THREE.SRGBColorSpace;

  return { 
    ivyMap, 
    ivyTendrilMap, 
    ivyLeafLargeMap, 
    ivyLeafYoungMap, 
    ivyLeafCenterMap, 
    daisyMap 
  };
}

