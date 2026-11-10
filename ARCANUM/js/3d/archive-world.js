import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* ==========================================================================
   ARCANUM — archive landmarks (v2)
   Procedural 3D study models: real geometry, masonry textures with bump,
   per-civilization sky + lighting, orbit camera with inertia and zoom.
   ========================================================================== */

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const c255 = (v) => Math.max(0, Math.min(255, v)) | 0;
const rgb = (c, k = 1) => `rgb(${c255(c[0] * k)},${c255(c[1] * k)},${c255(c[2] * k)})`;

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* -------------------------------------------------------------------------
   Textures & materials
   ------------------------------------------------------------------------- */
function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}
function finishTexture(canvas, srgb) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
function wrapped(size, fn) {
  for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) fn(ox, oy);
}

// Block masonry: staggered courses, per-block tint, mortar joints, grain, chips.
function masonryTextures(o, rnd) {
  const { size = 512, base = [190, 165, 125], mortar = [92, 78, 60], rows = 8, cols = 3, vary = .1, grain = 1 } = o;
  const [cc, cx] = makeCanvas(size);
  const [bc, bx] = makeCanvas(size);
  cx.fillStyle = rgb(mortar); cx.fillRect(0, 0, size, size);
  bx.fillStyle = '#000'; bx.fillRect(0, 0, size, size);
  const rh = size / rows, gap = Math.max(2, size / 200);
  for (let r = 0; r < rows; r++) {
    const weights = Array.from({ length: cols }, () => .65 + rnd() * .7);
    const sum = weights.reduce((a, b) => a + b, 0);
    let x = rnd() * size;
    for (let i = 0; i < cols; i++) {
      const w = weights[i] / sum * size;
      const k = 1 + (rnd() - .5) * 2 * vary;
      const warm = (rnd() - .5) * 10;
      const g = 150 + rnd() * 60 | 0;
      for (const ox of [0, -size]) {
        cx.fillStyle = `rgb(${c255(base[0] * k + warm)},${c255(base[1] * k)},${c255(base[2] * k - warm)})`;
        cx.fillRect(x + ox + gap / 2, r * rh + gap / 2, w - gap, rh - gap);
        bx.fillStyle = `rgb(${g},${g},${g})`;
        bx.fillRect(x + ox + gap / 2, r * rh + gap / 2, w - gap, rh - gap);
      }
      x = (x + w) % size;
    }
  }
  const n = size * size / 18 | 0;
  for (let i = 0; i < n; i++) {
    const px = rnd() * size, py = rnd() * size, s = rnd() * 2.2 + .4, light = rnd() > .5;
    cx.fillStyle = light ? `rgba(255,244,220,${rnd() * .10 * grain})` : `rgba(30,22,14,${rnd() * .12 * grain})`;
    cx.fillRect(px, py, s, s);
    if (i % 3 === 0) { const g = light ? 255 : 0; bx.fillStyle = `rgba(${g},${g},${g},${rnd() * .25})`; bx.fillRect(px, py, s, s); }
  }
  for (let i = 0; i < 26; i++) { // weathering streaks
    cx.fillStyle = `rgba(50,38,24,${rnd() * .05})`;
    cx.fillRect(rnd() * size, rnd() * size, rnd() * 3 + 1, rnd() * 90 + 20);
  }
  return { map: finishTexture(cc, true), bump: finishTexture(bc, false) };
}

function stoneMat(o, rnd, tile = 2) {
  const { map, bump } = masonryTextures(o, rnd);
  map.repeat.set(1 / tile, 1 / tile);
  bump.repeat.copy(map.repeat);
  return new THREE.MeshStandardMaterial({
    map, bumpMap: bump, bumpScale: o.bumpScale ?? 2, roughness: o.roughness ?? .92, metalness: 0
  });
}

// Veined marble with a soft polish.
function marbleMat(rnd, rx, ry, tint = [232, 224, 206]) {
  const size = 512;
  const [c, x] = makeCanvas(size);
  const [b, bx] = makeCanvas(size);
  x.fillStyle = rgb(tint); x.fillRect(0, 0, size, size);
  bx.fillStyle = '#808080'; bx.fillRect(0, 0, size, size);
  for (let i = 0; i < 46; i++) {
    const px = rnd() * size, py = rnd() * size, r = 30 + rnd() * 90;
    const col = rnd() > .5 ? '255,248,232' : '150,138,120';
    wrapped(size, (ox, oy) => {
      const g = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, r);
      g.addColorStop(0, `rgba(${col},.16)`); g.addColorStop(1, `rgba(${col},0)`);
      x.fillStyle = g; x.fillRect(px + ox - r, py + oy - r, r * 2, r * 2);
    });
  }
  for (let i = 0; i < 16; i++) {
    x.strokeStyle = `rgba(${110 + rnd() * 30 | 0},${100 + rnd() * 30 | 0},${95 + rnd() * 20 | 0},${.06 + rnd() * .12})`;
    x.lineWidth = .5 + rnd() * 1.6;
    x.beginPath();
    let px = rnd() * size, py = rnd() * size;
    x.moveTo(px, py);
    for (let s = 0; s < 5; s++) {
      px += (rnd() - .3) * 120; py += (rnd() - .5) * 90;
      x.quadraticCurveTo(px - 30 + rnd() * 60, py - 30 + rnd() * 60, px, py);
    }
    x.stroke();
  }
  for (let i = 0; i < 9000; i++) {
    x.fillStyle = `rgba(${rnd() > .5 ? '255,250,240' : '70,60,50'},${rnd() * .05})`;
    x.fillRect(rnd() * size, rnd() * size, 1.5, 1.5);
  }
  const map = finishTexture(c, true), bump = finishTexture(b, false);
  map.repeat.set(rx, ry); bump.repeat.set(rx, ry);
  return new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: .5, roughness: .55, metalness: 0 });
}

// Ground: soft tonal patches, speckle, optional wind ripples or rock strata.
function groundMat(rnd, { base = [190, 160, 110], tile = 6, ripples = false, strata = false, bump = 1.5 } = {}) {
  const size = 512;
  const [c, x] = makeCanvas(size);
  const [b, bx] = makeCanvas(size);
  x.fillStyle = rgb(base); x.fillRect(0, 0, size, size);
  bx.fillStyle = '#808080'; bx.fillRect(0, 0, size, size);
  for (let i = 0; i < 70; i++) {
    const px = rnd() * size, py = rnd() * size, r = 20 + rnd() * 70;
    const col = rnd() > .5 ? '255,236,204' : '40,30,20';
    wrapped(size, (ox, oy) => {
      const g = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, r);
      g.addColorStop(0, `rgba(${col},.14)`); g.addColorStop(1, `rgba(${col},0)`);
      x.fillStyle = g; x.fillRect(px + ox - r, py + oy - r, r * 2, r * 2);
    });
  }
  const n = size * size / 6 | 0;
  for (let i = 0; i < n; i++) {
    const light = rnd() > .5;
    x.fillStyle = light ? `rgba(255,240,215,${rnd() * .10})` : `rgba(30,22,14,${rnd() * .12})`;
    const s = rnd() * 1.8 + .4, px = rnd() * size, py = rnd() * size;
    x.fillRect(px, py, s, s);
    if (i % 2 === 0) { bx.fillStyle = `rgba(${light ? 255 : 0},${light ? 255 : 0},${light ? 255 : 0},${rnd() * .3})`; bx.fillRect(px, py, s, s); }
  }
  if (ripples) {
    for (let j = 0; j < 60; j++) {
      const y0 = rnd() * size, amp = 3 + rnd() * 6, k = [2, 3, 4, 5][rnd() * 4 | 0], ph = rnd() * TAU, light = rnd() > .5;
      x.strokeStyle = light ? 'rgba(255,240,210,.07)' : 'rgba(60,40,20,.08)';
      bx.strokeStyle = light ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.18)';
      x.lineWidth = bx.lineWidth = 1.2;
      for (const ctx of [x, bx]) {
        ctx.beginPath();
        for (let px = 0; px <= size; px += 8) { const py = y0 + Math.sin(px / size * TAU * k + ph) * amp; px ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.stroke();
      }
    }
  }
  if (strata) {
    for (let j = 0; j < 38; j++) {
      const y0 = rnd() * size, h = 2 + rnd() * 10, light = rnd() > .5;
      x.fillStyle = light ? `rgba(255,240,215,${.05 + rnd() * .07})` : `rgba(40,30,20,${.06 + rnd() * .08})`;
      x.fillRect(0, y0, size, h);
      bx.fillStyle = light ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.25)';
      bx.fillRect(0, y0, size, h);
    }
  }
  const map = finishTexture(c, true), bm = finishTexture(b, false);
  map.repeat.set(1 / tile, 1 / tile); bm.repeat.copy(map.repeat);
  return new THREE.MeshStandardMaterial({ map, bumpMap: bm, bumpScale: bump, roughness: 1, metalness: 0 });
}

/* -------------------------------------------------------------------------
   Geometry helpers (all UVs are in world units; texture repeat = 1 / tile)
   ------------------------------------------------------------------------- */
function texBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i;
    uv.setXY(k, uv.getX(k) * dims[f][0], uv.getY(k) * dims[f][1]);
  }
  return g;
}

// Truncated rectangular pyramid (four sloped faces + top), flat shaded, world UVs.
function frustumGeo(hbx, hbz, htx, htz, h, v0 = 0) {
  const B = [[-hbx, -hbz], [hbx, -hbz], [hbx, hbz], [-hbx, hbz]];
  const T = [[-htx, -htz], [htx, -htz], [htx, htz], [-htx, htz]];
  const pos = [], uv = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4, a = B[i], b = B[j], c = T[j], d = T[i];
    const lb = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const lt = Math.hypot(c[0] - d[0], c[1] - d[1]);
    const slant = Math.hypot(h, (lb - lt) / 2);
    const P = [[a[0], 0, a[1]], [b[0], 0, b[1]], [c[0], h, c[1]], [d[0], h, d[1]]];
    const U = [[0, v0], [lb, v0], [(lb + lt) / 2, v0 + slant], [(lb - lt) / 2, v0 + slant]];
    for (const k of [0, 2, 1, 0, 3, 2]) { pos.push(...P[k]); uv.push(...U[k]); }
  }
  if (htx > .001) {
    const Tp = T.map((p) => [p[0], h, p[1]]);
    for (const k of [0, 3, 2, 0, 2, 1]) { pos.push(...Tp[k]); uv.push(Tp[k][0], Tp[k][2]); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

function archGeo(hw, hh) {
  const s = new THREE.Shape();
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, hh);
  s.absarc(0, hh, hw, 0, Math.PI, false);
  s.lineTo(-hw, 0);
  return new THREE.ShapeGeometry(s, 12);
}

function put(parent, geo, material, x = 0, y = 0, z = 0, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = receive;
  parent.add(m);
  return m;
}
// Box standing on baseY, centred on (cx, cz).
function slab(parent, mat, cx, baseY, cz, w, h, d) {
  return put(parent, texBox(w, h, d), mat, cx, baseY + h / 2, cz);
}
function strip(parent, mat, x0, z0, x1, z1, w, h, y = 0) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const m = put(parent, texBox(w, h, len), mat, (x0 + x1) / 2, y + h / 2, (z0 + z1) / 2);
  m.rotation.y = Math.atan2(x1 - x0, z1 - z0);
  return m;
}
function instances(parent, geo, material, list, { cast = true, receive = true } = {}) {
  const mesh = new THREE.InstancedMesh(geo, material, list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  list.forEach((t, i) => {
    p.set(t.x || 0, t.y || 0, t.z || 0);
    e.set(t.rx || 0, t.ry || 0, t.rz || 0);
    q.setFromEuler(e);
    s.set(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = cast; mesh.receiveShadow = receive; mesh.frustumCulled = false;
  parent.add(mesh);
  return mesh;
}
function terrain(size, seg, mat, heightFn) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    p.setY(i, heightFn(p.getX(i), p.getZ(i)));
    uv.setXY(i, p.getX(i), p.getZ(i));
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}
function scatterTrees(root, rnd, o) {
  const { count, rMin, rMax, y = 0, trunkH = 1.6, crownR = .8, crownSy = 1, hue = .25, trunkMat, crownMat } = o;
  const trunks = [], crowns = [];
  for (let i = 0; i < count; i++) {
    const a = rnd() * TAU, r = rMin + rnd() * (rMax - rMin), s = .7 + rnd() * .7;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    trunks.push({ x, y: y + trunkH * s / 2, z, sx: s, sy: s, sz: s });
    crowns.push({ x, y: y + trunkH * s + crownR * crownSy * s * .45, z, sx: s * (.9 + rnd() * .3), sy: s * crownSy, sz: s * (.9 + rnd() * .3), ry: rnd() * TAU });
  }
  instances(root, new THREE.CylinderGeometry(.07, .11, trunkH, 6), trunkMat, trunks);
  const crownMesh = instances(root, new THREE.IcosahedronGeometry(crownR, 1), crownMat, crowns);
  const col = new THREE.Color();
  for (let i = 0; i < count; i++) {
    col.setHSL(hue + (rnd() - .5) * .04, .28 + rnd() * .15, .15 + rnd() * .09);
    crownMesh.setColorAt(i, col);
  }
  crownMesh.instanceColor.needsUpdate = true;
}
function matte(color, roughness = .9, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
}

/* =========================================================================
   EGYPT — Giza plateau
   ========================================================================= */
function steppedPyramid(root, mat, capMat, x, z, half, height, courses, capFrac = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const ch = height / courses, drop = half / courses, parts = [];
  const nBody = capFrac ? Math.round(courses * (1 - capFrac)) : courses;
  for (let i = 0; i < nBody; i++) {
    const hb = half * (1 - i / courses);
    const ht = half * (1 - (i + 1) / courses) + drop * .22; // small ledge between courses
    const geo = frustumGeo(hb, hb, ht, ht, ch, ((i * 5) % 12) / 6);
    geo.translate(0, i * ch, 0);
    parts.push(geo);
  }
  put(g, mergeGeometries(parts), mat);
  if (capFrac) { // smooth casing still clinging to the summit, as on Khafre
    const hb = half * (1 - nBody / courses);
    const geo = frustumGeo(hb, hb, .012, .012, height - nBody * ch, 0);
    geo.translate(0, nBody * ch, 0);
    put(g, geo, capMat);
  }
  root.add(g);
  return g;
}

function buildSphinx(root, mat, dark) {
  const s = new THREE.Group();
  const rb = (w, h, d, r, seg = 4) => new RoundedBoxGeometry(w, h, d, seg, r);
  put(s, rb(1.05, .72, 2.6, .24), mat, 0, .55, -.55);                              // body
  for (const sx of [-1, 1]) put(s, new THREE.SphereGeometry(.5, 24, 16), mat, sx * .28, .5, -1.45).scale.set(1, .9, 1.15); // haunches
  for (const sx of [-1, 1]) put(s, rb(.3, .26, 1.45, .1, 3), mat, sx * .34, .2, 1.1); // forepaws
  put(s, rb(.95, .95, .7, .25), mat, 0, .9, .55);                                   // chest
  put(s, new THREE.CylinderGeometry(.3, .4, .55, 24), mat, 0, 1.45, .78);           // neck
  put(s, new THREE.SphereGeometry(.3, 32, 24), mat, 0, 1.82, .9).scale.set(.88, 1.12, .95); // face
  put(s, rb(.09, .16, .12, .03, 2), mat, 0, 1.76, 1.17);                            // nose
  const cap = put(s, new THREE.SphereGeometry(.36, 32, 20, 0, TAU, 0, Math.PI * .62), dark, 0, 1.88, .86); // nemes crown
  cap.scale.set(1.1, 1, 1.08);
  for (const sx of [-1, 1]) {                                                       // lappets
    const l = put(s, rb(.13, .78, .34, .04, 3), dark, sx * .34, 1.45, .9);
    l.rotation.z = -sx * .1;
  }
  put(s, rb(.5, .9, .16, .05, 3), dark, 0, 1.55, .55);
  root.add(s);
  return s;
}

function buildEgypt(root, rnd) {
  const lime = stoneMat({ base: [203, 178, 134], mortar: [120, 102, 76], rows: 12, cols: 3, vary: .08, bumpScale: 3 }, rnd, 2);
  const casing = stoneMat({ base: [230, 211, 174], mortar: [190, 170, 136], rows: 10, cols: 5, vary: .04, bumpScale: 1.2, roughness: .8 }, rnd, 2);
  const dark = stoneMat({ base: [128, 106, 80], mortar: [76, 62, 46], rows: 6, cols: 3, vary: .12 }, rnd, 2);

  // The three great pyramids, offset like the real plateau, plus the queens' pyramids.
  steppedPyramid(root, lime, casing, -2.7, -0.8, 2.45, 4.3, 32);
  steppedPyramid(root, lime, casing, 2.5, -3.4, 2.0, 3.65, 28, .2);
  steppedPyramid(root, lime, casing, 6.1, -0.2, 1.2, 2.1, 18);
  for (const qx of [.7, 1.6, 2.5]) steppedPyramid(root, lime, casing, qx, .75, .42, .72, 8);

  // Mastaba cemetery west of Khufu.
  const mast = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) {
    const g = frustumGeo(.38, .28, .30, .20, .34);
    g.translate(-5.95 - r * .95, 0, -4 + c * 1.2);
    mast.push(g);
  }
  put(root, mergeGeometries(mast), lime);

  // Great Sphinx in its enclosure, valley temple and causeway.
  const sp = buildSphinx(root, lime, dark);
  sp.scale.setScalar(1.25); sp.position.set(-.6, 0, 3.7);
  slab(root, dark, -.6, 0, 4.0, 3.2, .12, 4.6);  // sunken-court floor
  slab(root, lime, -2.2, .1, 4.0, .22, .38, 4.6);
  slab(root, lime, -.6, .1, 6.45, 3.4, .38, .22);
  slab(root, lime, 1.0, .1, 4.0, .22, .38, 4.6);
  slab(root, lime, 3.0, 0, 5.1, 1.7, .85, 1.3);
  slab(root, dark, 3.0, .12, 5.78, .5, .52, .06);
  strip(root, casing, 2.4, -1.35, 3.0, 4.4, .9, .1);

  // Weathered stones strewn over the plateau.
  const rocks = [];
  for (let i = 0; i < 70; i++) {
    const a = rnd() * TAU, r = 8 + rnd() * 7, s = .1 + rnd() * .3;
    rocks.push({ x: Math.cos(a) * r, y: s * .1, z: Math.sin(a) * r, sx: s * 1.3, sy: s * .55, sz: s, ry: rnd() * TAU, rx: rnd() * .4 });
  }
  instances(root, new THREE.DodecahedronGeometry(1, 0), lime, rocks);

  const sand = groundMat(rnd, { base: [208, 168, 108], tile: 6, ripples: true, bump: 2.4 });
  root.add(terrain(240, 220, sand, (x, z) => {
    const r = Math.hypot(x, z), k = smooth(8.5, 28, r);
    const n = Math.sin(x * .19 + 1.3) * Math.cos(z * .15) * .9 + Math.sin((x * .7 + z) * .09 + 2) * 1.4 + Math.sin(x * .045) * Math.cos(z * .06 + 1) * 2.4;
    return -.03 + k * (n * .6 + Math.max(0, r - 14) * .05);
  }));
}

/* =========================================================================
   GREECE — the Parthenon on the Acropolis
   ========================================================================= */
function doricColumnGeo(R, h) {
  const shaft = new THREE.CylinderGeometry(R * .8, R, h, 120, 8, true);
  const p = shaft.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = (y + h / 2) / h, ang = Math.atan2(z, x);
    const f = (((ang / TAU) * 20) % 1 + 1) % 1;            // position across one flute
    const scoop = 1 - Math.pow(f * 2 - 1, 2);               // 0 at the arris, 1 mid-flute
    const r = Math.hypot(x, z) * (1 + .035 * Math.sin(Math.PI * t)) * (1 - .055 * scoop); // entasis + fluting
    p.setXYZ(i, Math.cos(ang) * r, y + h / 2, Math.sin(ang) * r);
  }
  const fluted = toCreasedNormals(shaft, .6);
  const echinus = new THREE.CylinderGeometry(R * 1.5, R * .9, .14, 40).translate(0, h + .07, 0).toNonIndexed();
  const abacus = new THREE.BoxGeometry(R * 3.05, .12, R * 3.05).translate(0, h + .2, 0).toNonIndexed();
  return mergeGeometries([fluted, echinus, abacus]);
}

function buildGreece(root, rnd) {
  const W = 4.9, L = 11.2; // Parthenon proportions: 8 x 17 columns, ratio ~ 9:4
  const block = stoneMat({ base: [228, 218, 198], mortar: [172, 162, 144], rows: 5, cols: 2, vary: .04, grain: .6, bumpScale: 1.4, roughness: .7 }, rnd, 2);
  const marbleWall = marbleMat(rnd, 1 / 2, 1 / 2);
  const marbleCol = marbleMat(rnd, 2, 1);
  const blue = matte(0x2e3b5c, .7), terracotta = matte(0x8f4d3b, .8), shade = matte(0x6f6a64, .9);

  // Crepidoma: three steps.
  const steps = [[6.5, 12.8], [6.05, 12.35], [5.6, 11.9]];
  steps.forEach(([w, l], i) => slab(root, block, 0, i * .2, 0, w, .2, l));
  const base = .6;

  // Peristyle: 46 outer columns + 12 inner portico columns, shared fluted geometry.
  const colGeo = doricColumnGeo(.19, 2.12);
  const cols = [];
  for (let k = 0; k < 8; k++) for (const s of [-1, 1]) cols.push({ x: -W / 2 + k * W / 7, y: base, z: s * L / 2 });
  for (let k = 1; k < 16; k++) for (const s of [-1, 1]) cols.push({ x: s * W / 2, y: base, z: -L / 2 + k * L / 16 });
  for (let k = 0; k < 6; k++) for (const s of [-1, 1]) cols.push({ x: -1.5 + k * .6, y: base, z: s * 4.95, sx: .8, sy: .8, sz: .8 });
  instances(root, colGeo, marbleCol, cols);

  // Cella.
  slab(root, block, 0, base, 0, 3.4, 2.95, 8.4);
  for (const s of [-1, 1]) slab(root, block, 0, base + 1.9, s * 4.95, 3.5, .3, .4);

  // Entablature: architrave, metope frieze with triglyphs, cornice.
  const ring = (mat, y, h, t, ex = 0) => {
    for (const s of [-1, 1]) {
      slab(root, mat, 0, y, s * L / 2, W + t + ex, h, t);
      slab(root, mat, s * W / 2, y, 0, t, h, L - t);
    }
  };
  const ay = base + 2.38;
  ring(block, ay, .3, .44);
  const fy = ay + .3;
  ring(terracotta, fy, .34, .44);
  const trig = [];
  for (let k = 0; k <= 14; k++) for (const s of [-1, 1]) trig.push({ x: -W / 2 + k * W / 14, y: fy + .17, z: s * (L / 2 + .23) });
  for (let k = 1; k < 32; k++) for (const s of [-1, 1]) trig.push({ x: s * (W / 2 + .23), y: fy + .17, z: -L / 2 + k * L / 32, ry: Math.PI / 2 });
  instances(root, new THREE.BoxGeometry(.14, .3, .05), blue, trig);
  const cy = fy + .34;
  ring(block, cy, .12, .66);

  // Gabled roof as a triangular prism, recessed tympanum and pedimental sculpture.
  const roofY = cy + .12, hw = (W + .7) / 2, ph = .82, Lr = L + .7;
  const tri = new THREE.Shape([new THREE.Vector2(-hw, 0), new THREE.Vector2(hw, 0), new THREE.Vector2(0, ph)]);
  const roof = new THREE.ExtrudeGeometry(tri, { depth: Lr, bevelEnabled: false });
  roof.translate(0, 0, -Lr / 2);
  put(root, roof, marbleWall, 0, roofY, 0);
  const tym = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-hw * .8, .06), new THREE.Vector2(hw * .8, .06), new THREE.Vector2(0, ph - .16)]));
  for (const s of [-1, 1]) {
    const t = put(root, tym, shade, 0, roofY, s * (Lr / 2 + .004), { cast: false });
    if (s < 0) t.rotation.y = Math.PI;
    const figs = [];
    for (let i = -4; i <= 4; i++) {
      const tall = 1 - Math.abs(i) / 5;
      figs.push({ x: i * .46 * s, y: roofY + .12 + (.1 + tall * .12), z: s * (Lr / 2 + .07), sx: 1, sy: .5 + tall * .7, sz: .7, rz: i === -4 || i === 4 ? Math.PI / 2.3 : 0 });
    }
    instances(root, new THREE.CapsuleGeometry(.07, .22, 4, 8), block, figs, { receive: false });
  }
  put(root, new THREE.ConeGeometry(.12, .3, 4), block, 0, roofY + ph + .1, 0).rotation.y = Math.PI / 4; // acroterion

  // Fallen drums scattered at the edge of the platform.
  const drums = [];
  for (let i = 0; i < 6; i++) {
    const a = rnd() * TAU, r = 6.6 + rnd() * .9;
    drums.push({ x: Math.cos(a) * r * .55, y: .2, z: Math.sin(a) * r * 1.0, rz: Math.PI / 2, ry: rnd() * TAU });
  }
  instances(root, new THREE.CylinderGeometry(.2, .2, .26, 20), marbleCol, drums);

  // The Acropolis rock and the plain below.
  const rock = groundMat(rnd, { base: [158, 144, 120], tile: 3, strata: true, bump: 3.5 });
  const hill = new THREE.CylinderGeometry(8.4, 14.5, 3.6, 120, 14, false);
  const hp = hill.attributes.position, huv = hill.attributes.uv;
  for (let i = 0; i < hp.count; i++) {
    const x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i), ang = Math.atan2(z, x);
    const f = 1 + .07 * Math.sin(ang * 5 + y * 1.3) + .05 * Math.sin(ang * 11 - y * 2.1) + .03 * Math.sin(ang * 23 + y * 3);
    hp.setXYZ(i, x * f, y, z * f);
    huv.setXY(i, huv.getX(i) * TAU * 11, huv.getY(i) * 3.6);
  }
  hill.computeVertexNormals();
  put(root, hill, rock, 0, -.03 - 1.8, 0);
  const plain = groundMat(rnd, { base: [118, 108, 72], tile: 6, bump: 1.6 });
  root.add(terrain(240, 120, plain, (x, z) => -3.45 + smooth(14, 60, Math.hypot(x, z)) * (Math.sin(x * .13) * Math.cos(z * .11) * 1.2 + 1)));

  // Olive groves on the plain.
  scatterTrees(root, rnd, {
    count: 70, rMin: 16, rMax: 38, y: -3.4, trunkH: 1.1, crownR: .9, crownSy: .7, hue: .22,
    trunkMat: matte(0x4a3b2a), crownMat: matte(0xffffff, .95)
  });
}

/* =========================================================================
   ROME — the Colosseum (ruined on one side, torch-lit at dusk)
   ========================================================================= */
function ellipsePts(a, b, t0, t1, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n; pts.push(new THREE.Vector2(a * Math.cos(t), b * Math.sin(t))); }
  return pts;
}
// Elliptical ring (or arc) extruded upward. Shape y maps to world -z.
function ringGeo(ao, bo, ai, bi, H, t0 = 0, t1 = TAU) {
  const full = (t1 - t0) >= TAU - 1e-6;
  const n = Math.max(10, Math.round(120 * (t1 - t0) / TAU));
  const outer = ellipsePts(ao, bo, t0, t1, n), inner = ellipsePts(ai, bi, t0, t1, n);
  let shape;
  if (full) { shape = new THREE.Shape(outer); shape.holes.push(new THREE.Path(inner)); }
  else shape = new THREE.Shape([...outer, ...inner.reverse()]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: H, bevelEnabled: false, curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  return g;
}

function triumphalArch(root, stone, openMat, x, z, ry) {
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.y = ry;
  slab(g, stone, 0, 0, 0, 1.9, 1.25, .6);
  slab(g, stone, 0, 1.25, 0, 2.0, .08, .68);
  slab(g, stone, 0, 1.33, 0, 1.7, .32, .5);
  const main = archGeo(.26, .5), side = archGeo(.13, .3);
  for (const s of [-1, 1]) {
    const m = put(g, main, openMat, 0, 0, s * .302, { cast: false }); if (s < 0) m.rotation.y = Math.PI;
    for (const sx of [-1, 1]) { const q = put(g, side, openMat, sx * .66, 0, s * .302, { cast: false }); if (s < 0) q.rotation.y = Math.PI; }
  }
  root.add(g);
}

function buildRome(root, rnd) {
  const A = 4.9, B = 4.0, GC = -.7; // semi-axes, centre angle of the collapsed side
  const trav = stoneMat({ base: [214, 196, 160], mortar: [150, 132, 100], rows: 7, cols: 5, vary: .07, bumpScale: 2.4 }, rnd, 1.6);
  const travDark = stoneMat({ base: [176, 154, 118], mortar: [100, 84, 62], rows: 6, cols: 4, vary: .1, bumpScale: 2.4 }, rnd, 1.6);
  const seatA = stoneMat({ base: [190, 168, 132], mortar: [120, 102, 76], rows: 3, cols: 7, vary: .08 }, rnd, 1.2);
  const seatB = stoneMat({ base: [166, 144, 110], mortar: [100, 84, 62], rows: 3, cols: 7, vary: .08 }, rnd, 1.2);
  const sandMat = groundMat(rnd, { base: [206, 178, 124], tile: 1.4, bump: 1 });
  const openMat = new THREE.MeshStandardMaterial({ color: 0x1b1109, roughness: 1, emissive: 0xff8a3a, emissiveIntensity: .3, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

  const tierY = [0, .82, 1.6, 2.34], tierH = [.82, .78, .74, .66], gaps = [.5, .95, 1.2, 1.35];
  const angDiff = (t, c) => Math.abs(Math.atan2(Math.sin(t - c), Math.cos(t - c)));

  // Outer shell: four storeys, each receding slightly, progressively more broken.
  for (let L = 0; L < 4; L++) {
    const sc = 1 - L * .012, ao = A * sc, bo = B * sc;
    const arc = ringGeo(ao, bo, ao * .93, bo * .93, tierH[L], GC + gaps[L], GC + TAU - gaps[L]);
    arc.translate(0, tierY[L], 0);
    put(root, arc, L % 2 ? travDark : trav);
  }

  // Arched openings, engaged half-columns and attic windows (instanced).
  const openGeo = archGeo(.125, .4), winGeo = new THREE.PlaneGeometry(.1, .2);
  const decals = [], wins = [], pil = [];
  const addBays = (sc, L, N, gap, windows = false) => {
    const a = A * sc, b = B * sc;
    for (let k = 0; k < N; k++) {
      const t = (k + .5) / N * TAU, tp = k / N * TAU;
      const place = (tt) => {
        const x = a * Math.cos(tt), z = -b * Math.sin(tt);
        let nx = x / (a * a), nz = z / (b * b); const nl = Math.hypot(nx, nz); nx /= nl; nz /= nl;
        return { x, z, nx, nz, ry: Math.atan2(nx, nz) };
      };
      if (angDiff(t, GC) > gap) {
        const p = place(t);
        if (windows) { if (k % 2 === 0) wins.push({ x: p.x + p.nx * .012, y: tierY[L] + .24, z: p.z + p.nz * .012, ry: p.ry }); }
        else decals.push({ x: p.x + p.nx * .012, y: tierY[L] + .12, z: p.z + p.nz * .012, ry: p.ry });
      }
      if (angDiff(tp, GC) > gap) {
        const p = place(tp);
        pil.push({ x: p.x + p.nx * .012, y: tierY[L] + tierH[L] / 2, z: p.z + p.nz * .012, sy: tierH[L] * .96 });
      }
    }
  };
  for (let L = 0; L < 3; L++) addBays(1 - L * .012, L, 64, gaps[L]);
  addBays(1 - 3 * .012, 3, 64, gaps[3], true);
  instances(root, openGeo, openMat, decals, { cast: false });
  instances(root, winGeo, openMat, wins, { cast: false });
  instances(root, new THREE.CylinderGeometry(.045, .045, 1, 8), trav, pil);

  // Inner structural wall, visible through the collapsed side.
  put(root, ringGeo(A * .80, B * .80, A * .73, B * .73, 2.7), trav);
  decals.length = 0; wins.length = 0; pil.length = 0;
  for (let L = 0; L < 3; L++) addBays(.80, L, 48, -1);
  instances(root, openGeo, openMat, decals, { cast: false });

  // Cavea: stepped seating rings falling toward the arena.
  const Aa = 2.3, Ba = 1.45, sa = A * .73, sb = B * .73, rings = 8;
  for (let i = 0; i < rings; i++) {
    const u0 = i / rings, u1 = (i + 1) / rings;
    const H = lerp(2.05, .62, Math.pow((i + .5) / rings, .85));
    put(root, ringGeo(lerp(sa, Aa, u0), lerp(sb, Ba, u0), lerp(sa, Aa, u1), lerp(sb, Ba, u1), H), i % 2 ? seatB : seatA, 0, 0, 0, { cast: false });
  }
  put(root, ringGeo(Aa + .12, Ba + .12, Aa, Ba, .62), travDark);

  // Arena floor with an open hypogeum.
  const floor = new THREE.Shape(ellipsePts(Aa, Ba, 0, TAU, 96));
  floor.holes.push(new THREE.Path([new THREE.Vector2(-1.55, -.42), new THREE.Vector2(-1.55, .38), new THREE.Vector2(1.35, .38), new THREE.Vector2(1.35, -.42)]));
  const floorGeo = new THREE.ShapeGeometry(floor); floorGeo.rotateX(-Math.PI / 2);
  put(root, floorGeo, sandMat, 0, .32, 0, { cast: false });
  const pit = new THREE.PlaneGeometry(2.9, .8); pit.rotateX(-Math.PI / 2);
  put(root, pit, travDark, -.1, .05, -.02, { cast: false });
  for (const zz of [-.34, -.12, .12, .34]) slab(root, travDark, -.1, .05, zz, 2.9, .27, .04);
  for (let i = 0; i < 10; i++) slab(root, travDark, -1.45 + i * .3, .05, 0, .04, .27, .8);

  // Pavement ring, triumphal arch, torch glow, umbrella pines.
  put(root, ringGeo(A * 1.2, B * 1.2, A * 1.0, B * 1.0, .06), trav, 0, 0, 0, { cast: false });
  triumphalArch(root, trav, openMat, -7.6, 3.6, .55);
  const glow = new THREE.PointLight(0xff9a50, 10, 9);
  glow.position.set(0, 1.2, 0); root.add(glow);
  scatterTrees(root, rnd, {
    count: 22, rMin: 11, rMax: 26, trunkH: 1.9, crownR: .95, crownSy: .42, hue: .27,
    trunkMat: matte(0x5a4630), crownMat: matte(0xffffff, .95)
  });
  const dirt = groundMat(rnd, { base: [96, 86, 60], tile: 5, bump: 1.4 });
  root.add(terrain(240, 120, dirt, (x, z) => -.03 + smooth(12, 40, Math.hypot(x, z)) * Math.sin(x * .12) * Math.cos(z * .1) * .8));

  return { update: (t) => { glow.intensity = 10 + Math.sin(t * 7) * 1.2 + Math.sin(t * 13.3) * .8; } };
}

/* =========================================================================
   MESOPOTAMIA — the Ziggurat of Ur
   ========================================================================= */
function frondGeo() {
  const g = new THREE.PlaneGeometry(.34, 1.7, 1, 8);
  g.translate(0, .85, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / 1.7;
    p.setZ(i, -t * t * .9);
    p.setX(i, p.getX(i) * (1 - t * .85));
  }
  g.computeVertexNormals();
  return g;
}
function makePalm() {
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(.14, 1, .05), new THREE.Vector3(.06, 2, .12), new THREE.Vector3(.1, 2.7, .12)]);
  const trunk = new THREE.TubeGeometry(curve, 12, .09, 7);
  const top = curve.getPoint(1), fronds = [], o = new THREE.Object3D();
  o.rotation.order = 'YXZ';
  for (let k = 0; k < 10; k++) {
    o.rotation.set(.75 + (k % 3) * .22, k * TAU / 10, 0);
    o.position.copy(top); o.updateMatrix();
    fronds.push(frondGeo().applyMatrix4(o.matrix));
  }
  return { trunk, leaves: mergeGeometries(fronds) };
}

function flight(root, mat, x0, z0, x1, z1, y1, w, n) {
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), ry = Math.atan2(dx, dz), sh = y1 / n, run = len / n;
  for (let i = 0; i < n; i++) {
    const t = (i + .5) / n, h = (i + 1) * sh;
    put(root, texBox(w, h, run * 1.02), mat, x0 + dx * t, h / 2, z0 + dz * t).rotation.y = ry;
  }
}

function buildMesopotamia(root, rnd) {
  const mud = stoneMat({ base: [176, 128, 78], mortar: [118, 84, 50], rows: 16, cols: 9, vary: .1, bumpScale: 2.6 }, rnd, 1.6);
  const fired = stoneMat({ base: [196, 142, 84], mortar: [128, 90, 54], rows: 16, cols: 9, vary: .08, bumpScale: 2.2 }, rnd, 1.6);
  const lapis = matte(0x1f4f8f, .35, { metalness: .1 });
  const doorMat = matte(0x1a120a, 1, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

  // Three battered terraces.
  const tiers = [
    { hb: [3.4, 2.4], ht: [3.15, 2.15], h: 1.5, y: 0 },
    { hb: [2.6, 1.65], ht: [2.4, 1.45], h: 1.25, y: 1.5 },
    { hb: [1.8, 1.0], ht: [1.65, .85], h: 1.0, y: 2.75 }
  ];
  const fb = [], sd = [];
  tiers.forEach((t, i) => {
    const g = frustumGeo(t.hb[0], t.hb[1], t.ht[0], t.ht[1], t.h, i * .6);
    g.translate(0, t.y, 0);
    put(root, g, i === 0 ? mud : fired);
    // Buttresses, tilted to follow each tier's batter.
    const pz = Math.atan((t.hb[1] - t.ht[1]) / t.h), px = Math.atan((t.hb[0] - t.ht[0]) / t.h);
    const bh = t.h / Math.cos(Math.max(pz, px)), mx = (t.hb[0] + t.ht[0]) / 2, mz = (t.hb[1] + t.ht[1]) / 2, yc = t.y + t.h / 2;
    for (let x = -t.hb[0] + .5; x < t.hb[0] - .3; x += .55) {
      fb.push({ x, y: yc, z: mz, rx: -pz, sy: bh });
      fb.push({ x, y: yc, z: -mz, rx: pz, sy: bh });
    }
    for (let z = -t.hb[1] + .45; z < t.hb[1] - .25; z += .55) {
      sd.push({ x: mx, y: yc, z, rz: px, sy: bh });
      sd.push({ x: -mx, y: yc, z, rz: -px, sy: bh });
    }
  });
  instances(root, new THREE.BoxGeometry(.16, 1, .1), fired, fb);
  instances(root, new THREE.BoxGeometry(.1, 1, .16), fired, sd);

  // Summit shrine with lapis-glazed band and doorway.
  slab(root, fired, 0, 3.75, 0, 2.0, .8, 1.1);
  slab(root, lapis, 0, 4.18, 0, 2.08, .07, 1.18);
  slab(root, mud, 0, 4.25, 0, 2.2, .1, 1.3);
  put(root, archGeo(.2, .34), doorMat, 0, 3.75, .556, { cast: false });

  // Three converging staircases and the gate tower on the first terrace.
  flight(root, mud, 0, 5.7, 0, 2.0, 1.5, 1.1, 12);
  for (const s of [-1, 1]) flight(root, mud, s * 3.3, 5.0, s * .95, 2.15, 1.5, .7, 12);
  slab(root, fired, 0, 1.5, 1.75, 1.4, .95, .65);
  slab(root, mud, 0, 2.45, 1.75, 1.5, .08, .75);
  put(root, archGeo(.22, .38), doorMat, 0, 1.5, 2.081, { cast: false });

  // Broken precinct wall (varying heights, entrance gap at the front).
  const walls = [];
  const wall = (x, z, ry) => { const h = .25 + rnd() * .55; if (rnd() > .1) walls.push({ x, y: h / 2, z, sy: h, ry }); };
  for (let x = -7.2; x <= 7.2; x += .8) { if (Math.abs(x) > 1.2) wall(x, 6.4, 0); wall(x, -6.0, 0); }
  for (let z = -5.6; z <= 6; z += .8) { wall(-7.4, z, Math.PI / 2); wall(7.4, z, Math.PI / 2); }
  instances(root, new THREE.BoxGeometry(.78, 1, .4), mud, walls);
  for (const [bx, bz, w, d] of [[-5.1, -3.5, 1.8, 1.2], [5.3, -3.3, 1.6, 1.3], [-5.2, 3.7, 1.6, 1.1]]) {
    slab(root, mud, bx, 0, bz, w, .8, d);
    slab(root, fired, bx, .8, bz, w + .1, .06, d + .1);
  }

  // Date palms outside the precinct.
  const palm = makePalm();
  const bark = matte(0x6b5236, .95), leaf = matte(0x4b6b2f, .8, { side: THREE.DoubleSide });
  for (let i = 0; i < 16; i++) {
    const a = rnd() * TAU, r = 9.5 + rnd() * 8, s = .8 + rnd() * .6;
    const g = new THREE.Group();
    g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); g.rotation.y = rnd() * TAU; g.scale.setScalar(s);
    put(g, palm.trunk, bark); put(g, palm.leaves, leaf);
    root.add(g);
  }

  // Euphrates beyond the city.
  const riv = new THREE.PlaneGeometry(200, 5, 100, 1); riv.rotateX(-Math.PI / 2);
  const rp = riv.attributes.position;
  for (let i = 0; i < rp.count; i++) rp.setZ(i, rp.getZ(i) + Math.sin(rp.getX(i) * .06) * 3 - 15);
  put(root, riv, matte(0x2d5a6b, .12, { metalness: .35 }), 0, .02, 0, { cast: false });

  const earth = groundMat(rnd, { base: [168, 136, 88], tile: 5, bump: 1.8 });
  root.add(terrain(240, 120, earth, (x, z) => -.03 + smooth(12, 40, Math.hypot(x, z)) * Math.sin(x * .1) * Math.cos(z * .12) * 1.1));
}

/* =========================================================================
   Sky, per-world configuration
   ========================================================================= */
function makeSky(c) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(c.top) }, mid: { value: new THREE.Color(c.mid) }, hor: { value: new THREE.Color(c.horizon) },
      sunCol: { value: new THREE.Color(c.sunColor) }, sun: { value: new THREE.Vector3(...c.sunDir).normalize() }
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top,mid,hor,sunCol,sun; varying vec3 vDir;
      void main(){
        float h=clamp(vDir.y,-.2,1.);
        vec3 col=mix(hor,mid,smoothstep(0.,.25,h));
        col=mix(col,top,smoothstep(.2,.9,h));
        float s=max(dot(normalize(vDir),sun),0.);
        col+=sunCol*(pow(s,6.)*.25+pow(s,64.)*.6+pow(s,900.)*2.);
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), mat);
  m.frustumCulled = false;
  return m;
}

const WORLDS = {
  egypt: {
    build: buildEgypt, seed: 11, fog: .016, env: .55, exposure: 1.05, shadow: 12,
    sky: { top: '#121c34', mid: '#3b4766', horizon: '#b27d4e', sunColor: '#ffb36a', sunDir: [-.7, .30, .55] },
    hemi: ['#8fa4cf', '#6b4a2b', .8], sun: { color: '#ffc98a', i: 3.4 }, dust: '#e0b36b',
    camera: { radius: 21, theta: .8, phi: 1.08, target: [0, 1.8, .4] }
  },
  greece: {
    build: buildGreece, seed: 22, fog: .014, env: .6, exposure: 1.0, shadow: 14,
    sky: { top: '#16294d', mid: '#4a6f9c', horizon: '#c9b08c', sunColor: '#ffe3b0', sunDir: [.6, .32, .6] },
    hemi: ['#a9c0e6', '#5c4c34', .85], sun: { color: '#ffe2b4', i: 3.3 }, dust: '#f0dcae',
    camera: { radius: 23, theta: .75, phi: 1.12, target: [0, 1.9, 0] }
  },
  rome: {
    build: buildRome, seed: 33, fog: .018, env: .5, exposure: 1.0, shadow: 9,
    sky: { top: '#15172f', mid: '#4b3a5a', horizon: '#c07a52', sunColor: '#ff9d5c', sunDir: [.6, .2, -.55] },
    hemi: ['#8a8fc4', '#4a3322', .75], sun: { color: '#ffb078', i: 3.0 }, dust: '#e8a870',
    camera: { radius: 19, theta: .85, phi: 1.02, target: [0, 1.2, 0] }
  },
  mesopotamia: {
    build: buildMesopotamia, seed: 44, fog: .017, env: .55, exposure: 1.05, shadow: 11,
    sky: { top: '#172a46', mid: '#566e88', horizon: '#d2a874', sunColor: '#ffc47c', sunDir: [-.55, .26, -.6] },
    hemi: ['#9db4d4', '#6a5230', .8], sun: { color: '#ffd29a', i: 3.3 }, dust: '#e6c490',
    camera: { radius: 17, theta: .62, phi: 1.1, target: [0, 1.9, 0] }
  }
};

/* =========================================================================
   Open / close
   ========================================================================= */
export function openArchiveWorld(civilization) {
  const overlay = document.querySelector('#archiveExperience');
  const canvas = document.querySelector('#archiveCanvas');
  if (!overlay || !canvas) return;
  overlay._cleanup?.(); overlay._cleanup = null;

  overlay.querySelector('[data-world-title]').textContent = civilization.landmark;
  overlay.querySelector('[data-world-civilization]').textContent = civilization.name;
  overlay.querySelector('[data-world-description]').textContent = civilization.landmarkDescription;
  overlay.querySelector('[data-world-period]').textContent = civilization.landmarkPeriod;
  overlay.classList.remove('world-fallback');
  overlay.classList.add('is-opening');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('archive-open');
  requestAnimationFrame(() => overlay.classList.add('is-visible'));

  let renderer, frame, observer;
  try {
    const cfg = WORLDS[civilization.world] || WORLDS.mesopotamia;
    const rnd = seeded(cfg.seed);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = cfg.exposure;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(new THREE.Color(cfg.sky.horizon), cfg.fog);
    scene.add(makeSky(cfg.sky));

    // Image-based lighting from the same sky, so stone picks up believable ambient colour.
    const envScene = new THREE.Scene();
    envScene.add(makeSky(cfg.sky));
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(envScene, .02);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = cfg.env;
    pmrem.dispose();

    const target = new THREE.Vector3(...cfg.camera.target);
    scene.add(new THREE.HemisphereLight(cfg.hemi[0], cfg.hemi[1], cfg.hemi[2]));
    const key = new THREE.DirectionalLight(cfg.sun.color, cfg.sun.i);
    key.position.copy(target).addScaledVector(new THREE.Vector3(...cfg.sky.sunDir).normalize(), 45);
    key.target.position.copy(target);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sh = cfg.shadow;
    Object.assign(key.shadow.camera, { left: -sh, right: sh, top: sh, bottom: -sh, near: 1, far: 100 });
    key.shadow.bias = -.0004; key.shadow.normalBias = .03;
    scene.add(key, key.target);

    const root = new THREE.Group();
    scene.add(root);
    const extras = cfg.build(root, rnd) || {};

    // Drifting dust.
    const DUST = 600, dust = new Float32Array(DUST * 3);
    for (let i = 0; i < DUST; i++) { dust[i * 3] = (Math.random() - .5) * 28; dust[i * 3 + 1] = Math.random() * 9; dust[i * 3 + 2] = (Math.random() - .5) * 28; }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dust, 3));
    const particles = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: cfg.dust, size: .03, transparent: true, opacity: .45, depthWrite: false }));
    scene.add(particles);

    // Orbit camera: drag, inertia, wheel/pinch zoom, idle auto-rotate, fly-in, double-click reset.
    const camera = new THREE.PerspectiveCamera(36, 1, .1, 200);
    const home = { theta: cfg.camera.theta, phi: cfg.camera.phi, radius: cfg.camera.radius };
    const view = { theta: home.theta - .9, phi: home.phi - .3, radius: home.radius * 1.45 };
    let goal = { ...home }, vTheta = 0, vPhi = 0, idle = 0;
    const pts = new Map();
    let pinch = 0;
    const pinchDist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
    const R_MIN = 7, R_MAX = 36;

    const down = (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture?.(e.pointerId);
      canvas.style.cursor = 'grabbing';
      goal = null; idle = 0;
      if (pts.size === 2) pinch = pinchDist();
    };
    const move = (e) => {
      const p = pts.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY; idle = 0;
      if (pts.size === 1) { vTheta = -dx * .0055; vPhi = -dy * .0042; view.theta += vTheta; view.phi += vPhi; }
      else if (pts.size === 2) { const d = pinchDist(); view.radius *= pinch / d; pinch = d; }
    };
    const up = (e) => { pts.delete(e.pointerId); if (!pts.size) canvas.style.cursor = 'grab'; };
    const wheel = (e) => { e.preventDefault(); view.radius *= Math.exp(e.deltaY * .001); goal = null; idle = 0; };
    const reset = () => { goal = { ...home }; vTheta = vPhi = 0; };
    canvas.style.cursor = 'grab';
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', wheel, { passive: false }); canvas.addEventListener('dblclick', reset);

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      renderer.setSize(r.width, r.height, false);
      camera.aspect = r.width / r.height;
      camera.updateProjectionMatrix();
    };
    observer = new ResizeObserver(resize); observer.observe(canvas); resize();

    const clock = new THREE.Clock();
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;
      if (goal) {
        const k = 1 - Math.pow(.04, dt);
        view.theta = lerp(view.theta, goal.theta, k); view.phi = lerp(view.phi, goal.phi, k); view.radius = lerp(view.radius, goal.radius, k);
      } else if (!pts.size) {
        view.theta += vTheta; view.phi += vPhi;
        vTheta *= .92; vPhi *= .92;
        idle += dt;
        if (idle > 3) view.theta += dt * .05; // slow turntable when untouched
      }
      view.phi = Math.min(1.45, Math.max(.45, view.phi));
      view.radius = Math.min(R_MAX, Math.max(R_MIN, view.radius));
      camera.position.set(
        target.x + view.radius * Math.sin(view.phi) * Math.sin(view.theta),
        target.y + view.radius * Math.cos(view.phi),
        target.z + view.radius * Math.sin(view.phi) * Math.cos(view.theta)
      );
      camera.lookAt(target);
      particles.rotation.y = t * .008;
      extras.update?.(t, dt);
      renderer.render(scene, camera);
    };
    animate();

    overlay._cleanup = () => {
      cancelAnimationFrame(frame); observer?.disconnect();
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('wheel', wheel); canvas.removeEventListener('dblclick', reset);
      const free = (o) => {
        o.geometry?.dispose?.();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
          for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose();
          m.dispose();
        });
      };
      scene.traverse(free); envScene.traverse(free);
      envTarget.dispose();
      renderer.dispose();
    };
  } catch (error) {
    console.error('Archive 3D world failed:', error);
    overlay.classList.add('world-fallback');
  }
}

export function closeArchiveWorld() {
  const overlay = document.querySelector('#archiveExperience');
  if (!overlay) return;
  overlay.classList.remove('is-visible');
  overlay.classList.remove('is-opening');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('archive-open');
  overlay._cleanup?.(); overlay._cleanup = null;
}