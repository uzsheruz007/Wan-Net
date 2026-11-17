'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import { scadaAudio } from './ScadaAudio';
import type { ScadaScenarioId, ScadaState } from './scada-types';

/**
 * 3D SCADA / ICS kiber-fizik poligon sahnasi. Har bir ssenariy (suv tozalash, elektr podstansiyasi,
 * kimyoviy reaktor) haqiqiy 3D obyekt sifatida quriladi. Fizik holat (state.physical / coils) har
 * kadrda sahnani boshqaradi: suv sathi, nasos aylanishi, harorat yog'dusi, bug', uchqunlar.
 * Klapan/uzgichlarni sichqoncha bilan bosish mumkin (raycast -> onCoilToggle).
 */

interface Props {
  state: ScadaState;
  onCoilToggle: (coilId: number, currentVal: number) => void;
}

const BG = 0x04080c;
const C_CYAN = 0x38bdf8;
const C_GREEN = 0x34d399;
const C_RED = 0xff4060;
const C_AMBER = 0xfbbf24;
const C_STEEL = 0x8b9aa8;

interface SceneObj {
  group: THREE.Group;
  clickTargets: THREE.Object3D[];
  labels: CSS2DObject[];
  update: (s: ScadaState, t: number, dt: number) => void;
  dispose: () => void;
}

// ------------------------------------------------------------------ yordamchilar

function makeLabel(title: string): { el: HTMLDivElement; obj: CSS2DObject } {
  const el = document.createElement('div');
  el.className = 'scada3d-label';
  el.innerHTML = `<b>${title}</b><span></span>`;
  const obj = new CSS2DObject(el);
  return { el, obj };
}

function setLabel(el: HTMLDivElement, sub: string, alert = false) {
  const span = el.querySelector('span');
  if (span) span.textContent = sub;
  el.classList.toggle('is-alert', alert);
}

/** Quvur (tube) ikki yoki undan ortiq nuqta orqali */
function makePipe(points: THREE.Vector3[], radius: number, color: number): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0);
  const geo = new THREE.TubeGeometry(curve, Math.max(16, points.length * 12), radius, 14, false);
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness: 0.35 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

/** Quvur bo'ylab yuguruvchi yorug' paketlar (oqim ko'rsatkichi) */
class FlowPackets {
  points: THREE.Points;
  private curve: THREE.CatmullRomCurve3;
  private count: number;
  private offsets: Float32Array;
  constructor(pts: THREE.Vector3[], count: number, color: number) {
    this.curve = new THREE.CatmullRomCurve3(pts);
    this.count = count;
    this.offsets = new Float32Array(count);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    for (let i = 0; i < count; i++) this.offsets[i] = i / count;
    const m = new THREE.PointsMaterial({
      color,
      size: 0.32,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
  }
  update(dt: number, speed: number, visible: boolean) {
    this.points.visible = visible;
    if (!visible) return;
    const pos = this.points.geometry.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < this.count; i++) {
      this.offsets[i] = (this.offsets[i] + dt * speed) % 1;
      this.curve.getPoint(this.offsets[i], v);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
  }
  dispose() {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}

/** Bug'/tutun zarralari (reaktor relief, uchqun) */
class Particles {
  points: THREE.Points;
  private count: number;
  private vel: Float32Array;
  private life: Float32Array;
  private origin: THREE.Vector3;
  private spread: number;
  private rise: number;
  constructor(origin: THREE.Vector3, count: number, color: number, size: number, spread: number, rise: number) {
    this.count = count;
    this.origin = origin.clone();
    this.spread = spread;
    this.rise = rise;
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    for (let i = 0; i < count; i++) this.life[i] = Math.random();
    const m = new THREE.PointsMaterial({
      color,
      size,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
  }
  update(dt: number, active: boolean) {
    this.points.visible = active;
    if (!active) return;
    const pos = this.points.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < this.count; i++) {
      this.life[i] -= dt * 0.6;
      if (this.life[i] <= 0) {
        this.life[i] = 1;
        pos.setXYZ(i, this.origin.x + (Math.random() - 0.5) * this.spread, this.origin.y, this.origin.z + (Math.random() - 0.5) * this.spread);
        this.vel[i * 3] = (Math.random() - 0.5) * 0.6;
        this.vel[i * 3 + 1] = this.rise * (0.6 + Math.random() * 0.8);
        this.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
      }
      pos.setXYZ(
        i,
        pos.getX(i) + this.vel[i * 3] * dt,
        pos.getY(i) + this.vel[i * 3 + 1] * dt,
        pos.getZ(i) + this.vel[i * 3 + 2] * dt,
      );
    }
    pos.needsUpdate = true;
  }
  dispose() {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}

/** Qo'l g'ildiragi (valve handwheel) — bosiladigan klapan */
function makeHandwheel(color: number): THREE.Group {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.11, 12, 28),
    new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.4, emissive: color, emissiveIntensity: 0.25 }),
  );
  ring.castShadow = true;
  g.add(ring);
  for (let i = 0; i < 4; i++) {
    const spoke = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 1.12, 8),
      new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.4 }),
    );
    spoke.rotation.z = (i * Math.PI) / 2;
    g.add(spoke);
  }
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.3, 12),
    new THREE.MeshStandardMaterial({ color: 0x0a1016, metalness: 0.8, roughness: 0.3 }),
  );
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  return g;
}

/** Elektr avtomatik uzgichi (breaker) — qoldiq + ko'taradigan richag */
function makeBreaker(): { group: THREE.Group; lever: THREE.Mesh } {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.3, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x11202b, metalness: 0.5, roughness: 0.5 }),
  );
  body.castShadow = true;
  g.add(body);
  const lever = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.6, 0.16),
    new THREE.MeshStandardMaterial({ color: C_GREEN, metalness: 0.4, roughness: 0.4, emissive: C_GREEN, emissiveIntensity: 0.5 }),
  );
  lever.position.set(0, 0.25, 0.34);
  g.add(lever);
  return { group: g, lever };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

// ------------------------------------------------------------------ 1. SUV TOZALASH

function buildWater(getCoil: (id: number) => number): SceneObj {
  const group = new THREE.Group();
  const clickTargets: THREE.Object3D[] = [];
  const labels: CSS2DObject[] = [];

  // Asosiy havza (shisha bak)
  const basin = new THREE.Group();
  basin.position.set(0, 0, 0);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0a1822,
    metalness: 0,
    roughness: 0.06,
    transmission: 0.78,
    transparent: true,
    opacity: 0.22,
    thickness: 0.4,
    side: THREE.DoubleSide,
  });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x22323e, metalness: 0.8, roughness: 0.35 });
  const BW = 5, BH = 4, BD = 4;
  const shell = new THREE.Mesh(new THREE.BoxGeometry(BW, BH, BD), glassMat);
  shell.position.y = BH / 2;
  basin.add(shell);
  // qovurg'alar (frame)
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(BW, BH, BD)),
    new THREE.LineBasicMaterial({ color: 0x3a5464 }),
  );
  edges.position.y = BH / 2;
  basin.add(edges);
  // suv hajmi
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    metalness: 0.1,
    roughness: 0.25,
    transparent: true,
    opacity: 0.92,
    emissive: 0x0284c7,
    emissiveIntensity: 0.55,
  });
  const water = new THREE.Mesh(new THREE.BoxGeometry(BW - 0.3, 1, BD - 0.3), waterMat);
  basin.add(water);
  group.add(basin);

  // Kirish nasosi (chapda)
  const pumpGroup = new THREE.Group();
  pumpGroup.position.set(-5.2, 0.9, 0);
  const pumpHousing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.9, 1.1, 24),
    new THREE.MeshStandardMaterial({ color: 0x2b3a46, metalness: 0.85, roughness: 0.3 }),
  );
  pumpHousing.castShadow = true;
  pumpGroup.add(pumpHousing);
  const impeller = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.08, 0.22),
      new THREE.MeshStandardMaterial({ color: C_CYAN, metalness: 0.7, roughness: 0.3, emissive: C_CYAN, emissiveIntensity: 0.4 }),
    );
    blade.rotation.y = (i * Math.PI * 2) / 5;
    impeller.add(blade);
  }
  impeller.position.y = 0.62;
  pumpGroup.add(impeller);
  group.add(pumpGroup);

  // Kirish quvuri + oqim
  const inPipe = makePipe([new THREE.Vector3(-5.2, 1.5, 0), new THREE.Vector3(-5.2, 2.6, 0), new THREE.Vector3(-2.3, 2.6, 0)], 0.18, C_STEEL);
  group.add(inPipe);
  const inFlow = new FlowPackets([new THREE.Vector3(-5.2, 1.5, 0), new THREE.Vector3(-5.2, 2.6, 0), new THREE.Vector3(-2.3, 2.6, 0)], 14, 0xe0f2fe);
  group.add(inFlow.points);

  // NaOH dozator tanki (tepada)
  const lyeTank = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 1.4, 20),
    new THREE.MeshStandardMaterial({ color: 0x4a1d3a, metalness: 0.4, roughness: 0.5, emissive: 0xec4899, emissiveIntensity: 0.15 }),
  );
  lyeTank.position.set(1.6, 5.2, 0);
  lyeTank.castShadow = true;
  group.add(lyeTank);
  const lyeDrip = new Particles(new THREE.Vector3(1.6, 4.4, 0), 24, 0xf472b6, 0.14, 0.1, -2.2);
  group.add(lyeDrip.points);

  // Chiqish quvuri -> shahar (o'ngda)
  const outPipe = makePipe([new THREE.Vector3(2.3, 1.3, 0), new THREE.Vector3(5.5, 1.3, 0), new THREE.Vector3(5.5, 0.6, 2.2)], 0.2, C_STEEL);
  group.add(outPipe);
  const outFlow = new FlowPackets([new THREE.Vector3(2.3, 1.3, 0), new THREE.Vector3(5.5, 1.3, 0), new THREE.Vector3(5.5, 0.6, 2.2)], 16, 0x7dd3fc);
  group.add(outFlow.points);

  // Shahar bloklari
  const city = new THREE.Group();
  city.position.set(6.2, 0, 3.2);
  const cityMat = new THREE.MeshStandardMaterial({ color: 0x1b2a36, metalness: 0.3, roughness: 0.7, emissive: 0x0b3b2a, emissiveIntensity: 0.3 });
  for (let i = 0; i < 4; i++) {
    const h = 1 + Math.random() * 1.6;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, h, 0.7), cityMat);
    b.position.set((i % 2) * 0.95, h / 2, Math.floor(i / 2) * 0.95);
    b.castShadow = true;
    city.add(b);
  }
  group.add(city);

  // Klapanlar (handwheel) — bosiladigan
  const vPositions: [number, number, number, number][] = [
    [1, -5.2, 2.1, 0],  // pump coil 1
    [2, 1.6, 6.2, 0],   // lye coil 2
    [3, 5.5, 2.3, 0],   // distribution coil 3
    [4, 0, 0.7, 2.6],   // drain coil 4
  ];
  const wheels: Record<number, THREE.Group> = {};
  for (const [id, x, y, z] of vPositions) {
    const w = makeHandwheel(C_STEEL);
    w.position.set(x, y, z);
    w.scale.setScalar(0.7);
    w.userData.coil = id;
    w.traverse((o) => (o.userData.coil = id));
    group.add(w);
    wheels[id] = w;
    clickTargets.push(w);
  }

  // Telemetriya yorlig'i
  const tl = makeLabel('AquaPure Havza');
  tl.obj.position.set(0, 4.6, 0);
  group.add(tl.obj);
  labels.push(tl.obj);
  const cityLabel = makeLabel('Shahar');
  cityLabel.obj.position.set(6.6, 2.6, 3.2);
  group.add(cityLabel.obj);
  labels.push(cityLabel.obj);

  let spin = 0;
  return {
    group,
    clickTargets,
    labels,
    update(s, t, dt) {
      const p = s.physical;
      const level = (p.level ?? 45) / 100;
      const ph = p.ph ?? 7.4;
      const pumpOn = getCoil(1) === 1;
      const lyeOn = getCoil(2) === 1;
      const distOn = getCoil(3) === 1;
      const drainOn = getCoil(4) === 1;

      // suv sathi
      const wh = Math.max(0.05, level * (BH - 0.3));
      water.scale.y = wh;
      water.position.y = wh / 2 + 0.15;
      // pH rangi: toza moviy -> ishqoriy pushti/binafsha
      let col = 0x0ea5e9;
      if (ph > 9) col = 0xc026d3;
      else if (ph > 8) col = 0x7c3aed;
      else if (ph < 6) col = 0xe11d48;
      (water.material as THREE.MeshStandardMaterial).color.setHex(col);
      (water.material as THREE.MeshStandardMaterial).emissive.setHex(col);

      // nasos aylanishi
      spin += dt * (pumpOn ? 9 : 0);
      impeller.rotation.y = spin;
      (pumpHousing.material as THREE.MeshStandardMaterial).emissive.setHex(pumpOn ? 0x0a3a4a : 0x000000);

      inFlow.update(dt, 0.6, pumpOn);
      outFlow.update(dt, 0.5, distOn);
      lyeDrip.update(dt, lyeOn);

      // klapan holati: ON -> yashil nur, OFF -> xira
      for (const [id, w] of Object.entries(wheels)) {
        const on = getCoil(Number(id)) === 1;
        w.rotation.z = lerp(w.rotation.z, on ? 0 : Math.PI / 4, dt * 6);
        w.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
          if (m && m.emissive) m.emissiveIntensity = on ? 0.6 : 0.1;
        });
      }

      // shahar rangi: zaharli bo'lsa qizil
      const toxic = ph > 9 && distOn;
      city.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m && m.emissive) m.emissive.setHex(toxic ? 0x7f1d1d : 0x0b3b2a);
      });

      setLabel(tl.el, `Sath ${(level * 100).toFixed(0)}% · pH ${ph.toFixed(1)}`, ph > 9.5);
      setLabel(cityLabel.el, toxic ? '☣ ZAHARLI SUV' : 'Toza suv', toxic);
    },
    dispose() {
      inFlow.dispose();
      outFlow.dispose();
      lyeDrip.dispose();
    },
  };
}

// ------------------------------------------------------------------ 2. ELEKTR PODSTANSIYASI

function buildGrid(getCoil: (id: number) => number): SceneObj {
  const group = new THREE.Group();
  const clickTargets: THREE.Object3D[] = [];
  const labels: CSS2DObject[] = [];

  // Pilon (chapda)
  const pylon = new THREE.Group();
  pylon.position.set(-6.5, 0, 0);
  const steel = new THREE.MeshStandardMaterial({ color: 0x5a6b78, metalness: 0.8, roughness: 0.4 });
  for (const s of [-0.6, 0.6]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 5.2, 8), steel);
    leg.position.set(s, 2.6, 0);
    pylon.add(leg);
  }
  for (const yy of [2.2, 3.4, 4.5]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.12), steel);
    arm.position.set(0, yy, 0);
    pylon.add(arm);
  }
  group.add(pylon);

  // Transformator (ikki g'altak)
  const trafo = new THREE.Group();
  trafo.position.set(-3.6, 1.2, 0);
  const coilA = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.28, 16, 32), new THREE.MeshStandardMaterial({ color: C_CYAN, metalness: 0.7, roughness: 0.3, emissive: C_CYAN, emissiveIntensity: 0.3 }));
  coilA.rotation.y = Math.PI / 2;
  coilA.position.x = -0.4;
  const coilB = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.28, 16, 32), new THREE.MeshStandardMaterial({ color: C_AMBER, metalness: 0.7, roughness: 0.3, emissive: C_AMBER, emissiveIntensity: 0.3 }));
  coilB.rotation.y = Math.PI / 2;
  coilB.position.x = 0.4;
  trafo.add(coilA, coilB);
  const tank = new THREE.Mesh(new THREE.BoxGeometry(2, 1.8, 1.6), new THREE.MeshStandardMaterial({ color: 0x27333d, metalness: 0.6, roughness: 0.5 }));
  tank.position.y = -1.4;
  tank.castShadow = true;
  trafo.add(tank);
  group.add(trafo);

  // Bosh shina (vertikal)
  const busbar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 6, 12),
    new THREE.MeshStandardMaterial({ color: C_CYAN, emissive: C_CYAN, emissiveIntensity: 1, metalness: 0.5, roughness: 0.2 }),
  );
  busbar.position.set(-0.5, 3, 0);
  group.add(busbar);

  // 3 ta fider: shifoxona (Q2), sanoat (Q3), turar-joy (Q4) + asosiy Q1
  interface Feeder { id: number; z: number; color: number; name: string; breaker: THREE.Group; lever: THREE.Mesh; building: THREE.Group; }
  const feeders: Feeder[] = [];
  const buildingDefs: [number, number, number, string][] = [
    [2, 2.2, C_RED, 'Shifoxona'],
    [3, 0, C_CYAN, 'Sanoat'],
    [4, -2.2, C_AMBER, 'Turar-joy'],
  ];
  for (const [id, z, color, name] of buildingDefs) {
    const br = makeBreaker();
    br.group.position.set(1.4, 2.4, z);
    br.group.userData.coil = id;
    br.group.traverse((o) => (o.userData.coil = id));
    group.add(br.group);
    clickTargets.push(br.group);

    const building = new THREE.Group();
    building.position.set(4.4, 0, z);
    const bodyH = 2.2;
    const bmat = new THREE.MeshStandardMaterial({ color: 0x1a2731, metalness: 0.3, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, bodyH, 1.2), bmat);
    body.position.y = bodyH / 2;
    body.castShadow = true;
    building.add(body);
    // derazalar (emissiv)
    const winMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8 });
    for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.05), winMat.clone());
      w.position.set(-0.35 + c * 0.7, 0.5 + r * 0.6, 0.63);
      building.add(w);
    }
    group.add(building);

    const lbl = makeLabel(name);
    lbl.obj.position.set(4.4, bodyH + 0.6, z);
    group.add(lbl.obj);
    labels.push(lbl.obj);
    (building.userData as { label?: HTMLDivElement; name?: string }).label = lbl.el;
    (building.userData as { name?: string }).name = name;

    feeders.push({ id, z, color, name, breaker: br.group, lever: br.lever, building });
  }

  // Q1 asosiy uzgich
  const q1 = makeBreaker();
  q1.group.position.set(-2.1, 2.4, 0);
  q1.group.scale.setScalar(1.15);
  q1.group.userData.coil = 1;
  q1.group.traverse((o) => (o.userData.coil = 1));
  group.add(q1.group);
  clickTargets.push(q1.group);
  const q1label = makeLabel('Q1 Incomer');
  q1label.obj.position.set(-2.1, 3.6, 0);
  group.add(q1label.obj);
  labels.push(q1label.obj);

  // uchqun zarralari (chastota buzilganda)
  const spark = new Particles(new THREE.Vector3(-0.5, 4, 0), 30, 0xfff1a8, 0.12, 0.4, 1.4);
  group.add(spark.points);

  const freqLabel = makeLabel('Tarmoq');
  freqLabel.obj.position.set(-0.5, 6.4, 0);
  group.add(freqLabel.obj);
  labels.push(freqLabel.obj);

  return {
    group,
    clickTargets,
    labels,
    update(s, t, dt) {
      const p = s.physical;
      const freq = p.frequency ?? 50;
      const volt = p.voltage ?? 110;
      const q1on = getCoil(1) === 1;
      const powered = q1on && volt > 20;

      // shina yog'dusi
      const busMat = busbar.material as THREE.MeshStandardMaterial;
      busMat.emissiveIntensity = lerp(busMat.emissiveIntensity, powered ? 1.4 : 0.05, dt * 4);
      busMat.color.setHex(powered ? C_CYAN : 0x334155);
      busMat.emissive.setHex(powered ? C_CYAN : 0x000000);

      // transformator g'altaklari pulsi
      const pulse = powered ? 0.3 + Math.abs(Math.sin(t * 3)) * 0.4 : 0.05;
      (coilA.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
      (coilB.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;

      // Q1 richagi
      q1.lever.rotation.z = lerp(q1.lever.rotation.z, q1on ? 0 : -Math.PI / 2.4, dt * 8);
      (q1.lever.material as THREE.MeshStandardMaterial).color.setHex(q1on ? C_GREEN : C_RED);
      (q1.lever.material as THREE.MeshStandardMaterial).emissive.setHex(q1on ? C_GREEN : C_RED);

      for (const f of feeders) {
        const on = getCoil(f.id) === 1;
        const lit = powered && on;
        f.lever.rotation.z = lerp(f.lever.rotation.z, on ? 0 : -Math.PI / 2.4, dt * 8);
        (f.lever.material as THREE.MeshStandardMaterial).color.setHex(on ? C_GREEN : C_RED);
        (f.lever.material as THREE.MeshStandardMaterial).emissive.setHex(on ? C_GREEN : C_RED);
        f.building.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
          if (m && m.emissive && m !== (f.building.children[0] as THREE.Mesh).material) {
            m.emissiveIntensity = lit ? 0.9 : 0.04;
          }
        });
        const ud = f.building.userData as { label?: HTMLDivElement; name?: string };
        if (ud.label) setLabel(ud.label, lit ? '⚡ Quvvatda' : '⚫ Qorong‘ulik', !lit);
      }

      // uchqun: chastota me'yordan chiqsa
      const unstable = powered && Math.abs(freq - 50) > 0.6;
      spark.update(dt, unstable);

      setLabel(freqLabel.el, `${freq.toFixed(2)} Hz · ${volt.toFixed(0)} kV`, Math.abs(freq - 50) > 0.5 || !powered);
      setLabel(q1label.el, q1on ? 'ULANGAN' : 'UZILGAN', !q1on);
    },
    dispose() {
      spark.dispose();
    },
  };
}

// ------------------------------------------------------------------ 3. KIMYOVIY REAKTOR

function buildReactor(getCoil: (id: number) => number): SceneObj {
  const group = new THREE.Group();
  const clickTargets: THREE.Object3D[] = [];
  const labels: CSS2DObject[] = [];

  // Bosimli qozon (vessel) + gumbazli qopqoqlar
  const vessel = new THREE.Group();
  const vesselMat = new THREE.MeshStandardMaterial({ color: 0x2a3844, metalness: 0.9, roughness: 0.25, emissive: 0x000000, emissiveIntensity: 0 });
  const VH = 4;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, VH, 32), vesselMat);
  body.position.y = VH / 2 + 0.6;
  body.castShadow = true;
  vessel.add(body);
  const capTop = new THREE.Mesh(new THREE.SphereGeometry(1.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), vesselMat);
  capTop.position.y = VH + 0.6;
  vessel.add(capTop);
  const capBot = new THREE.Mesh(new THREE.SphereGeometry(1.5, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), vesselMat);
  capBot.position.y = 0.6;
  vessel.add(capBot);
  group.add(vessel);

  // ichki issiqlik yog'dusi (emissiv silindr)
  const glow = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, VH - 0.4, 24),
    new THREE.MeshBasicMaterial({ color: 0xff6b35, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  glow.position.y = VH / 2 + 0.6;
  group.add(glow);

  // Sovutish ko'ylagi (tashqi yarim shaffof silindr)
  const jacket = new THREE.Mesh(
    new THREE.CylinderGeometry(1.75, 1.75, VH - 0.6, 32, 1, true),
    new THREE.MeshStandardMaterial({ color: C_CYAN, metalness: 0.3, roughness: 0.3, transparent: true, opacity: 0.18, side: THREE.DoubleSide, emissive: C_CYAN, emissiveIntensity: 0.4 }),
  );
  jacket.position.y = VH / 2 + 0.6;
  group.add(jacket);

  // Markaziy santrifuga shafti + rotorlar
  const rotor = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, VH + 1.5, 10), new THREE.MeshStandardMaterial({ color: 0x9aa7b2, metalness: 0.9, roughness: 0.2 }));
  shaft.position.y = VH / 2 + 0.6;
  rotor.add(shaft);
  for (let i = 0; i < 3; i++) {
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 0.12, 24),
      new THREE.MeshStandardMaterial({ color: C_CYAN, metalness: 0.6, roughness: 0.3, emissive: C_CYAN, emissiveIntensity: 0.3 }),
    );
    disc.position.y = 1.4 + i * 1.1;
    rotor.add(disc);
  }
  group.add(rotor);

  // Motor bloki (tepada)
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.7, 20), new THREE.MeshStandardMaterial({ color: 0x1c2831, metalness: 0.7, roughness: 0.4 }));
  motor.position.y = VH + 1.6;
  group.add(motor);

  // Relief klapan quvuri (tepa o'ng) + bug'
  const reliefPipe = makePipe([new THREE.Vector3(1.2, VH + 0.6, 0), new THREE.Vector3(2.6, VH + 0.6, 0), new THREE.Vector3(2.6, VH + 1.6, 0)], 0.14, C_STEEL);
  group.add(reliefPipe);
  const steam = new Particles(new THREE.Vector3(2.6, VH + 1.7, 0), 40, 0xdfe9f0, 0.3, 0.3, 2.6);
  group.add(steam.points);

  // Klapanlar: sovutish(1), azot(2), xom-ashyo(3), relief(4)
  const vDefs: [number, number, number, number][] = [
    [1, -2.6, 1.6, 0],  // coolant
    [2, -2.6, 0.5, 1.4],// nitrogen
    [3, 0, 0.3, 2.4],   // feed
    [4, 2.6, VH + 1.7, 0], // relief
  ];
  const wheels: Record<number, THREE.Group> = {};
  for (const [id, x, y, z] of vDefs) {
    const w = makeHandwheel(id === 1 ? C_CYAN : id === 2 ? C_GREEN : id === 4 ? C_RED : C_AMBER);
    w.position.set(x, y, z);
    w.scale.setScalar(0.6);
    w.userData.coil = id;
    w.traverse((o) => (o.userData.coil = id));
    group.add(w);
    wheels[id] = w;
    clickTargets.push(w);
  }

  const tl = makeLabel('Reaktor');
  tl.obj.position.set(0, VH + 2.4, 0);
  group.add(tl.obj);
  labels.push(tl.obj);

  let spin = 0;
  return {
    group,
    clickTargets,
    labels,
    update(s, t, dt) {
      const p = s.physical;
      const rpm = p.rpm ?? 1400;
      const temp = p.temp ?? 95;
      const pressure = p.pressure ?? 18;
      const coolant = getCoil(1) === 1;
      const relief = getCoil(4) === 1;

      // rotor aylanishi
      spin += dt * (rpm / 240);
      rotor.rotation.y = spin;

      // issiqlik yog'dusi (80..260 C)
      const heat = Math.min(1, Math.max(0, (temp - 80) / 180));
      (glow.material as THREE.MeshBasicMaterial).opacity = heat * 0.6;
      const hot = new THREE.Color(0xff6b35).lerp(new THREE.Color(0xff2020), heat);
      (glow.material as THREE.MeshBasicMaterial).color.copy(hot);
      vesselMat.emissive.copy(hot);
      vesselMat.emissiveIntensity = heat * 0.5;

      // sovutish ko'ylagi
      (jacket.material as THREE.MeshStandardMaterial).emissiveIntensity = lerp((jacket.material as THREE.MeshStandardMaterial).emissiveIntensity, coolant ? 0.6 : 0.05, dt * 4);
      (jacket.material as THREE.MeshStandardMaterial).opacity = coolant ? 0.28 : 0.1;

      // bug': relief ochiq yoki bosim yuqori
      steam.update(dt, relief || pressure > 32);

      for (const [id, w] of Object.entries(wheels)) {
        const on = getCoil(Number(id)) === 1;
        w.rotation.z = lerp(w.rotation.z, on ? 0 : Math.PI / 4, dt * 6);
        w.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
          if (m && m.emissive) m.emissiveIntensity = on ? 0.6 : 0.12;
        });
      }

      setLabel(tl.el, `${rpm.toFixed(0)} RPM · ${temp.toFixed(0)}°C · ${pressure.toFixed(0)} Bar`, temp > 180 || pressure > 32);
    },
    dispose() {
      steam.dispose();
    },
  };
}

// ------------------------------------------------------------------ KOMPONENT

export function ScadaCanvas({ state, onCoilToggle }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const toggleRef = useRef(onCoilToggle);

  useEffect(() => {
    stateRef.current = state;
    toggleRef.current = onCoilToggle;
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.className = 'scada3d-canvas';
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute('aria-label', '3D sanoat SCADA sahnasi. Klapan va uzgichlarni bosib boshqaring.');
    host.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.domElement.className = 'scada3d-labels';
    host.appendChild(labelRenderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BG);
    scene.fog = new THREE.FogExp2(BG, 0.028);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.5;

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    camera.position.set(0.5, 8, 15);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 6;
    controls.maxDistance = 40;
    controls.target.set(0, 2.5, 0);
    controls.update();

    // yorug'lik
    scene.add(new THREE.HemisphereLight(0xb6cad8, 0x0a1016, 0.85));
    const key = new THREE.DirectionalLight(0xe6f0ff, 2.1);
    key.position.set(-7, 15, 9);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -16;
    key.shadow.camera.right = 16;
    key.shadow.camera.top = 16;
    key.shadow.camera.bottom = -8;
    key.shadow.bias = -0.0004;
    scene.add(key);
    const rim = new THREE.PointLight(0x38bdf8, 40, 50);
    rim.position.set(8, 6, -6);
    scene.add(rim);

    // pol (grid)
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = floorCanvas.height = 512;
    const fg = floorCanvas.getContext('2d')!;
    fg.fillStyle = '#070d12';
    fg.fillRect(0, 0, 512, 512);
    for (let i = 0; i <= 512; i += 32) {
      fg.strokeStyle = i % 128 === 0 ? '#16303a' : '#0e1a21';
      fg.lineWidth = 1;
      fg.beginPath();
      fg.moveTo(i + 0.5, 0); fg.lineTo(i + 0.5, 512);
      fg.moveTo(0, i + 0.5); fg.lineTo(512, i + 0.5);
      fg.stroke();
    }
    const floorTex = new THREE.CanvasTexture(floorCanvas);
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(10, 10);
    floorTex.colorSpace = THREE.SRGBColorSpace;
    floorTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ map: floorTex, metalness: 0.4, roughness: 0.6, color: 0x5b6b77 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // postprocessing
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.5, 0.82);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      // tor ekranda kamerani uzoqlashtirish
      const dist = camera.aspect < 1 ? 20 : 15;
      const dir = camera.position.clone().sub(controls.target).normalize();
      if (camera.position.distanceTo(controls.target) < 7) camera.position.copy(controls.target).add(dir.multiplyScalar(dist));
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      labelRenderer.setSize(w, h);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    // ssenariy qurilishi (almashganda qayta quriladi)
    let current: SceneObj | null = null;
    let builtScenario: ScadaScenarioId | null = null;
    const getCoil = (id: number) => stateRef.current.coils[id] ?? 0;

    const buildScenario = (id: ScadaScenarioId) => {
      if (current) {
        scene.remove(current.group);
        current.labels.forEach((l) => l.removeFromParent());
        current.group.traverse((o) => {
          const mesh = o as THREE.Mesh;
          mesh.geometry?.dispose?.();
          const mat = mesh.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose?.();
        });
        current.dispose();
      }
      current = id === 'grid' ? buildGrid(getCoil) : id === 'reactor' ? buildReactor(getCoil) : buildWater(getCoil);
      scene.add(current.group);
      builtScenario = id;
    };
    buildScenario(stateRef.current.scenario);

    // raycast tanlash
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downAt = { x: 0, y: 0 };
    const findCoil = (obj: THREE.Object3D | null): number | null => {
      let o: THREE.Object3D | null = obj;
      while (o) {
        if (typeof o.userData.coil === 'number') return o.userData.coil;
        o = o.parent;
      }
      return null;
    };
    const pick = (e: PointerEvent): number | null => {
      if (!current) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(current.clickTargets, true)[0];
      return hit ? findCoil(hit.object) : null;
    };
    const onMove = (e: PointerEvent) => {
      renderer.domElement.style.cursor = pick(e) ? 'pointer' : '';
    };
    const onDown = (e: PointerEvent) => { downAt = { x: e.clientX, y: e.clientY }; };
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
      const coil = pick(e);
      if (coil != null) {
        scadaAudio.playBreakerClick?.();
        toggleRef.current(coil, stateRef.current.coils[coil] ?? 0);
      }
    };
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    // render sikli
    let raf = 0;
    let shake = 0;
    let prevT = performance.now();
    let elapsed = 0;
    const baseTarget = new THREE.Vector3(0, 2.5, 0);
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const now = performance.now();
      const dt = Math.min(0.05, (now - prevT) / 1000);
      prevT = now;
      elapsed += dt;
      const t = elapsed;
      const s = stateRef.current;

      if (s.scenario !== builtScenario) buildScenario(s.scenario);
      current?.update(s, t, reduced ? 0 : dt);

      // falokat: qizil tus + silkinish
      if (s.is_disaster) {
        shake = 0.12;
        bloom.strength = 1.3;
        scene.fog && ((scene.fog as THREE.FogExp2).color.setHex(0x1a0608));
        scene.background instanceof THREE.Color && scene.background.setHex(0x120406);
      } else {
        shake = lerp(shake, 0, dt * 4);
        bloom.strength = lerp(bloom.strength, s.is_tripped ? 0.95 : 0.7, dt * 3);
        scene.fog && ((scene.fog as THREE.FogExp2).color.lerp(new THREE.Color(BG), dt * 3));
        scene.background instanceof THREE.Color && scene.background.lerp(new THREE.Color(BG), dt * 3);
      }
      controls.target.set(baseTarget.x + (Math.random() - 0.5) * shake, baseTarget.y + (Math.random() - 0.5) * shake, baseTarget.z);
      controls.update();

      composer.render();
      labelRenderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      controls.dispose();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else (mat as THREE.Material | undefined)?.dispose?.();
      });
      current?.dispose();
      floorTex.dispose();
      envTex.dispose();
      pmrem.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
      if (labelRenderer.domElement.parentNode === host) host.removeChild(labelRenderer.domElement);
    };
  }, []);

  return <div ref={hostRef} className="scada3d-stage" />;
}
