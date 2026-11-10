import * as THREE from "three";

export function addCinematicLighting(scene) {
  scene.add(new THREE.AmbientLight(0x8a7653, 0.75));

  const key = new THREE.PointLight(0xffd58a, 95, 18, 2);
  key.position.set(2.8, 3.2, 3.4);
  scene.add(key);

  const fill = new THREE.PointLight(0x8b4b25, 42, 15, 2);
  fill.position.set(-3, -1.4, 2);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffe0a3, 2.1);
  rim.position.set(-2, 4, -4);
  scene.add(rim);

  const lower = new THREE.PointLight(0x5d2630, 25, 12, 2);
  lower.position.set(0, -3, -1);
  scene.add(lower);
}
