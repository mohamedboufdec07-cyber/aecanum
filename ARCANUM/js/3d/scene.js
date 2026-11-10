import * as THREE from "three";
import { addCinematicLighting } from "./lighting.js";
import { createGoldenArtifact } from "./artifact-viewer.js";
import { attachPointerControls } from "./controls.js";

export function initArtifactScene(canvas) {
  if (!canvas) return null;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
  renderer.setSize(canvas.clientWidth || 600, canvas.clientHeight || 600, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x21160f, 0.055);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 7.2);
  addCinematicLighting(scene);

  const artifact = createGoldenArtifact();
  scene.add(artifact);

  // A subtle floor halo, not a physical floor plane.
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(1.8, 64),
    new THREE.MeshBasicMaterial({ color: 0x9a6b35, transparent: true, opacity: 0.075, depthWrite: false })
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = -2.05;
  scene.add(halo);

  // Floating dust motes.
  const count = 420;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 8;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 7;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 4;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({
    color: 0xe0c58f, size: 0.016, transparent: true, opacity: 0.48,
    sizeAttenuation: true, depthWrite: false
  }));
  scene.add(dust);

  const controls = attachPointerControls(canvas.parentElement, artifact, camera);
  const clock = new THREE.Clock();
  let frame = 0;
  let width = 0, height = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  function animate() {
    frame = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    artifact.rotation.y += 0.0022;
    artifact.position.y = Math.sin(t * 0.8) * 0.10;
    artifact.rotation.z = Math.sin(t * 0.35) * 0.035;
    dust.rotation.y = t * 0.012;
    dust.position.y = Math.sin(t * 0.18) * 0.08;
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  return {
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
    }
  };
}
