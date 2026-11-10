import * as THREE from "three";

const brass = new THREE.MeshStandardMaterial({
  color: 0xb98d4d, metalness: 0.82, roughness: 0.31,
  emissive: 0x38230c, emissiveIntensity: 0.11
});
const paleBrass = new THREE.MeshStandardMaterial({
  color: 0xd8b978, metalness: 0.78, roughness: 0.27
});
const darkBronze = new THREE.MeshStandardMaterial({
  color: 0x604321, metalness: 0.72, roughness: 0.42
});
const enamel = new THREE.MeshStandardMaterial({
  color: 0x6b292b, metalness: 0.36, roughness: 0.28,
  emissive: 0x26090a, emissiveIntensity: 0.2
});
const engraving = new THREE.LineBasicMaterial({ color: 0xf0d39a, transparent: true, opacity: 0.88 });

function addLine(parent, points, material = engraving) {
  const geometry = new THREE.BufferGeometry().setFromPoints(
    points.map(([x, y, z = 0]) => new THREE.Vector3(x, y, z))
  );
  const line = new THREE.Line(geometry, material);
  line.material = material;
  parent.add(line);
  return line;
}

function addTickMarks(parent, radius, count, z, innerShort = 0.09) {
  const points = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const length = i % 6 === 0 ? innerShort * 1.9 : i % 3 === 0 ? innerShort * 1.35 : innerShort;
    points.push(
      [Math.cos(a) * (radius - length), Math.sin(a) * (radius - length), z],
      [Math.cos(a) * radius, Math.sin(a) * radius, z]
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points.flat(), 3));
  parent.add(new THREE.LineSegments(geometry, engraving));
}

// A historically inspired brass astrolabe for the scholar's desk.
// This is a decorative interpretation, not a reconstruction of one specific instrument.
export function createGoldenArtifact() {
  const astrolabe = new THREE.Group();

  // Main brass mater, facing the visitor.
  const mater = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.22, 0.12, 128), darkBronze);
  mater.rotation.x = Math.PI / 2;
  astrolabe.add(mater);
  const face = new THREE.Mesh(new THREE.CircleGeometry(1.16, 128), brass);
  face.position.z = 0.071;
  astrolabe.add(face);

  // Outer rim and graduated edge.
  for (const [r, tube, material] of [
    [1.28, 0.055, darkBronze], [1.20, 0.018, paleBrass], [1.07, 0.012, paleBrass], [0.88, 0.014, darkBronze]
  ]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, 160), material);
    ring.position.z = 0.09;
    astrolabe.add(ring);
  }
  addTickMarks(astrolabe, 1.145, 96, 0.105, 0.075);
  addTickMarks(astrolabe, 1.025, 48, 0.108, 0.05);

  // Stereographic rete: a light openwork wheel with a central axis and radial pointers.
  const rete = new THREE.Group();
  rete.position.z = 0.13;
  const reteRing = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.018, 8, 128), paleBrass);
  rete.add(reteRing);
  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.012, 8, 96), darkBronze);
  rete.add(innerRing);
  const spokePoints = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r0 = i % 2 === 0 ? 0.14 : 0.28;
    spokePoints.push([Math.cos(a) * r0, Math.sin(a) * r0, 0], [Math.cos(a) * 0.82, Math.sin(a) * 0.82, 0]);
  }
  const spokeGeometry = new THREE.BufferGeometry();
  spokeGeometry.setAttribute("position", new THREE.Float32BufferAttribute(spokePoints.flat(), 3));
  rete.add(new THREE.LineSegments(spokeGeometry, engraving));

  // Star pointers and small brass bosses.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.22, 4), paleBrass);
    pointer.position.set(Math.cos(a) * 0.69, Math.sin(a) * 0.69, 0.025);
    pointer.rotation.z = a - Math.PI / 2;
    rete.add(pointer);
    const boss = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), darkBronze);
    boss.position.set(Math.cos(a) * 0.87, Math.sin(a) * 0.87, 0.02);
    rete.add(boss);
  }
  astrolabe.add(rete);

  // Rule / alidade across the face, with sighting vanes at either end.
  const alidade = new THREE.Group();
  alidade.position.z = 0.19;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.035, 0.035), paleBrass);
  alidade.add(bar);
  for (const x of [-0.9, 0.9]) {
    const vane = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.2, 0.045), darkBronze);
    vane.position.set(x, 0, 0.015);
    alidade.add(vane);
    const aperture = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), enamel);
    aperture.position.set(x, 0, 0.045);
    alidade.add(aperture);
  }
  astrolabe.add(alidade);

  // Central pivot, decorative pin and engraved cardinal medallions.
  const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.11, 32), darkBronze);
  pivot.rotation.x = Math.PI / 2;
  pivot.position.z = 0.21;
  astrolabe.add(pivot);
  const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 16), enamel);
  jewel.position.z = 0.285;
  astrolabe.add(jewel);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), paleBrass);
    bead.position.set(Math.cos(a) * 0.98, Math.sin(a) * 0.98, 0.13);
    astrolabe.add(bead);
  }

  // Suspension loop and small neck above the circular plate.
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.17, 20), darkBronze);
  neck.position.set(0, 1.31, 0);
  astrolabe.add(neck);
  const suspension = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.035, 12, 64), paleBrass);
  suspension.position.set(0, 1.52, 0);
  astrolabe.add(suspension);
  const topBoss = new THREE.Mesh(new THREE.SphereGeometry(0.065, 14, 12), brass);
  topBoss.position.set(0, 1.22, 0.03);
  astrolabe.add(topBoss);

  // Four tiny edge rivets catch the warm light.
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), paleBrass);
    rivet.position.set(Math.cos(a) * 1.17, Math.sin(a) * 1.17, 0.12);
    astrolabe.add(rivet);
  }

  astrolabe.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  return astrolabe;
}
