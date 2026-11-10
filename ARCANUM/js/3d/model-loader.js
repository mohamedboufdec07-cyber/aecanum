import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// Milestone 02+: load licensed .glb/.gltf historical models into a scene.
const loader = new GLTFLoader();

export function loadGLTF(url) {
  return new Promise((resolve, reject) => {
    loader.load(url, (gltf) => resolve(gltf), undefined, reject);
  });
}
