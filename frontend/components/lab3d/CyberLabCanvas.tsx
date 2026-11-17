'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import { cyberAudio } from './CyberAudio';
import { type AttackKind, type CameraPreset, NODE_ORDER, NODES, type NodeId, type ScenarioId, getScenarioNodes } from './scenario';

/**
 * 3D kiber-poligon: data-markaz uslubidagi sahna. Tugunlar — server shkaflari, ular orasidagi kabel bo'ylab
 * paketlar yuradi. Hujumlar soat bo'yicha (setInterval emas) render siklida o'ynaladi.
 */

interface Props {
  activeNode: NodeId;
  onSelectNode: (id: NodeId) => void;
  cameraPreset: CameraPreset;
  /** Har yangi hujumda o'zgaradigan kalit: bir xil hujum ketma-ket ham qayta o'ynaladi */
  attack: { kind: AttackKind; key: number } | null;
  onAttackFinish?: () => void;
  thermalMode?: boolean;
  scenario?: ScenarioId;
}

const BG = 0x05090d;
const RED = new THREE.Color(0xff3355);
const GREEN = new THREE.Color(0x34d399);
const CYAN = new THREE.Color(0x38bdf8);

const POS: Record<NodeId, THREE.Vector3> = {
  attacker: new THREE.Vector3(-12, 0, 5),
  defender: new THREE.Vector3(2.5, 0, 5.5),
  gateway: new THREE.Vector3(-6, 0, 1.5),
  waf: new THREE.Vector3(-0.5, 0, 1.5),
  web: new THREE.Vector3(5, 0, -1.5),
  db: new THREE.Vector3(10.5, 0, -4),
};

const ACCENT: Record<NodeId, THREE.Color> = {
  attacker: new THREE.Color(0xff3355),
  defender: new THREE.Color(0x38bdf8),
  gateway: new THREE.Color(0x2dd4bf),
  waf: new THREE.Color(0xa78bfa),
  web: new THREE.Color(0x34d399),
  db: new THREE.Color(0xfbbf24),
};

const ATTACK_ORDER: NodeId[] = ['attacker', 'gateway', 'waf', 'web', 'db'];

/** [kamera, nishon] */
const CAMERAS: Record<CameraPreset, [[number, number, number], [number, number, number]]> = {
  overview: [[-1.5, 15.5, 17.5], [-0.8, 0.6, 0.2]],
  attacker: [[-15.8, 4.2, 10.8], [-12, 1.3, 4.6]],
  defender: [[-0.2, 4.5, 10.8], [2.5, 1.3, 5.5]],
  waf: [[-4.5, 3.4, 7.5], [-0.5, 1.4, 1.5]],
  web: [[8.8, 3.8, 4.2], [5, 1.3, -1.5]],
  db: [[15.2, 4.6, 2.6], [10.2, 1.5, -4]],
  map: [[-0.5, 30, 3], [-0.5, 0, 0]],
};

/** Tik ekran: zanjir ekranda pastdan tepaga (hujumchi pastda, baza tepada) */
const PORTRAIT: Partial<Record<CameraPreset, [[number, number, number], [number, number, number]]>> = {
  overview: [[-25.5, 20.5, 6.8], [-1.6, 0.5, 0.6]],
  map: [[-4, 34, 0.6], [-0.6, 0, 0.4]],
};

const PACKET_Y = 0.16;
const MAX_PACKETS = 220;

// ---------------- geometriya yordamchilari ----------------

/** Kabel yo'li: polda to'g'ri burchakli (kabel lotogi kabi) */
function linkPoints(a: NodeId, b: NodeId): THREE.Vector3[] {
  const A = POS[a];
  const B = POS[b];
  const midX = (A.x + B.x) / 2;
  return [
    new THREE.Vector3(A.x, PACKET_Y, A.z),
    new THREE.Vector3(midX, PACKET_Y, A.z),
    new THREE.Vector3(midX, PACKET_Y, B.z),
    new THREE.Vector3(B.x, PACKET_Y, B.z),
  ];
}

function polyline(points: THREE.Vector3[]): THREE.CurvePath<THREE.Vector3> {
  const path = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 0; i < points.length - 1; i++) {
    if (points[i].distanceToSquared(points[i + 1]) > 1e-6) path.add(new THREE.LineCurve3(points[i], points[i + 1]));
  }
  return path;
}

/** Tugunlar zanjiri bo'ylab yo'l: ['attacker', 'gateway', 'waf'] */
function route(chain: NodeId[]): THREE.CurvePath<THREE.Vector3> {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < chain.length - 1; i++) {
    const seg = linkPoints(chain[i], chain[i + 1]);
    pts.push(...(i === 0 ? seg : seg.slice(1)));
  }
  return polyline(pts);
}

function gridTexture(): THREE.CanvasTexture {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0a1117';
  g.fillRect(0, 0, size, size);
  g.lineWidth = 1;
  for (let i = 0; i <= size; i += 32) {
    g.strokeStyle = i % 128 === 0 ? '#16303a' : '#0f1b22';
    g.beginPath();
    g.moveTo(i + 0.5, 0);
    g.lineTo(i + 0.5, size);
    g.moveTo(0, i + 0.5);
    g.lineTo(size, i + 0.5);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(12, 12);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function screenTexture(lines: string[], accent: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 300;
  const g = c.getContext('2d')!;
  g.fillStyle = '#04100c';
  g.fillRect(0, 0, 512, 300);
  g.font = '500 19px "JetBrains Mono", monospace';
  lines.forEach((line, i) => {
    g.fillStyle = i === 0 ? accent : '#7fdcb5';
    g.globalAlpha = i === 0 ? 1 : 0.75;
    g.fillText(line, 18, 34 + i * 30);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Ekranni nishonga olgan hex-qalqon (WAF): fresnel + olti burchakli to'r + yuguruvchi skan chizig'i */
function shieldMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(0xa78bfa) },
      uIntensity: { value: 0.2 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uIntensity;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vViewDir;
      float hexDist(vec2 p) {
        p = abs(p);
        return max(dot(p, normalize(vec2(1.0, 1.7320508))), p.x);
      }
      void main() {
        vec2 uv = vUv * vec2(9.0, 4.5);
        vec2 r = vec2(1.0, 1.7320508);
        vec2 h = r * 0.5;
        vec2 a = mod(uv, r) - h;
        vec2 b = mod(uv - h, r) - h;
        vec2 gv = dot(a, a) < dot(b, b) ? a : b;
        float edge = 0.5 - hexDist(gv);
        float lines = 1.0 - smoothstep(0.0, 0.025, edge);
        float fres = pow(1.0 - abs(dot(normalize(vNormalW), normalize(vViewDir))), 2.5);
        float scan = 1.0 - smoothstep(0.0, 0.04, abs(fract(vUv.y - uTime * 0.12) - 0.5));
        float fade = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
        float alpha = (lines * 0.35 + fres * 0.5 + scan * 0.18) * fade * uIntensity;
        gl_FragColor = vec4(uColor * (0.6 + lines), alpha);
      }
    `,
  });
}

// ---------------- komponent ----------------

interface Packet {
  path: THREE.CurvePath<THREE.Vector3>;
  start: number;
  duration: number;
  color: THREE.Color;
  /** yo'l oxirida qayerda to'xtash (0..1) */
  end: number;
  alive: boolean;
}

interface NodeVisual {
  outline: THREE.LineBasicMaterial;
  leds: THREE.InstancedMesh;
  ledBase: THREE.Color[];
  label: HTMLDivElement;
  alert: { color: THREE.Color; until: number } | null;
  flash: { color: THREE.Color; at: number } | null;
}

export function CyberLabCanvas({ activeNode, onSelectNode, cameraPreset, attack, onAttackFinish, thermalMode, scenario }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  // Render sikli bilan React o'rtasidagi ko'prik (sahna bir marta quriladi)
  const api = useRef<{
    setActive: (id: NodeId) => void;
    flyTo: (preset: CameraPreset) => void;
    play: (kind: AttackKind) => void;
    setThermal: (thermal: boolean) => void;
    updateScenario: (sc: ScenarioId) => void;
  } | null>(null);
  const callbacks = useRef({ onSelectNode, onAttackFinish });
  useEffect(() => {
    callbacks.current = { onSelectNode, onAttackFinish };
  }, [onSelectNode, onAttackFinish]);
  const initial = useRef({ activeNode, cameraPreset, thermalMode, scenario });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---------- renderer, sahna, kamera ----------
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.className = 'lab3d-canvas';
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute(
      'aria-label',
      "3D tarmoq sxemasi: hujumchi stansiyasi, router, WAF, veb-server va ma'lumotlar bazasi. Tugunni tanlash uchun pastdagi ro'yxatdan foydalaning.",
    );
    host.appendChild(renderer.domElement);

    const labels = new CSS2DRenderer();
    labels.domElement.className = 'lab3d-labels';
    host.appendChild(labels.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BG);
    scene.fog = new THREE.FogExp2(BG, 0.022);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.55;

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    /** Tor (tik) ekranda sahna sig'ishi uchun kamera nishondan uzoqlashadi */
    const framing = (preset: CameraPreset) => {
      const portrait = camera.aspect < 0.9 ? PORTRAIT[preset] : undefined;
      const [p, t] = portrait ?? CAMERAS[preset];
      const target = new THREE.Vector3(...t);
      const pos = new THREE.Vector3(...p);
      const fit = portrait ? 1 : camera.aspect < 1.5 ? Math.min(2.2, 1.5 / camera.aspect) : 1;
      return { pos: pos.sub(target).multiplyScalar(fit).add(target), target };
    };

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.minDistance = 4;
    controls.maxDistance = 60;
    controls.screenSpacePanning = false;
    controls.update();

    // ---------- yorug'lik ----------
    scene.add(new THREE.HemisphereLight(0xb6cad8, 0x0a1016, 0.9));
    const key = new THREE.DirectionalLight(0xe6f0ff, 2.2);
    key.position.set(-8, 16, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -20;
    key.shadow.camera.right = 20;
    key.shadow.camera.top = 14;
    key.shadow.camera.bottom = -14;
    key.shadow.bias = -0.0004;
    key.shadow.radius = 3;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x38bdf8, 0.9);
    rim.position.set(12, 6, -14);
    scene.add(rim);

    // ---------- pol ----------
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(96, 96),
      new THREE.MeshStandardMaterial({ map: gridTexture(), roughness: 0.82, metalness: 0.25 }),
    );
    (floor.material as THREE.MeshStandardMaterial).map!.anisotropy = renderer.capabilities.getMaxAnisotropy();
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // ---------- materiallar ----------
    const cabinetMat = new THREE.MeshStandardMaterial({ color: 0x27323c, metalness: 0.7, roughness: 0.36 });
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x0b1015, metalness: 0.5, roughness: 0.7 });
    const unitMat = new THREE.MeshStandardMaterial({ color: 0x33414c, metalness: 0.6, roughness: 0.42 });
    const platformMat = new THREE.MeshStandardMaterial({ color: 0x141d24, metalness: 0.4, roughness: 0.55 });
    const ledMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const ledGeo = new THREE.BoxGeometry(0.035, 0.022, 0.012);

    const clickable: THREE.Object3D[] = [];
    const visuals = {} as Record<NodeId, NodeVisual>;
    const labelLayer: CSS2DObject[] = [];

    /** Server shkafi: korpus, 1U bloklar va har blokda LED'lar */
    function rack(w: number, h: number, d: number, units: number, palette: number[]) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, 0.035), cabinetMat);
      body.position.y = h / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, h * 0.94), panelMat);
      face.position.set(0, h / 2, d / 2 + 0.002);
      g.add(face);

      const pitch = (h * 0.88) / units;
      const unitGeo = new THREE.BoxGeometry(w * 0.82, pitch * 0.72, 0.03);
      const blocks = new THREE.InstancedMesh(unitGeo, unitMat, units);
      const leds = new THREE.InstancedMesh(ledGeo, ledMat, units * 3);
      const base: THREE.Color[] = [];
      const m = new THREE.Matrix4();
      for (let u = 0; u < units; u++) {
        const y = h * 0.06 + pitch * (u + 0.5);
        m.makeTranslation(0, y, d / 2 + 0.018);
        blocks.setMatrixAt(u, m);
        for (let k = 0; k < 3; k++) {
          const i = u * 3 + k;
          m.makeTranslation(w * 0.28 + k * 0.06, y, d / 2 + 0.036);
          leds.setMatrixAt(i, m);
          const c = new THREE.Color(palette[(u + k) % palette.length]).multiplyScalar(2.2);
          base.push(c);
          leds.setColorAt(i, c);
        }
      }
      blocks.castShadow = true;
      g.add(blocks, leds);
      return { group: g, leds, base };
    }

    function platform(id: NodeId, w: number, d: number) {
      const g = new THREE.Group();
      const slab = new THREE.Mesh(new RoundedBoxGeometry(w, 0.08, d, 2, 0.03), platformMat);
      slab.position.y = 0.04;
      slab.receiveShadow = true;
      g.add(slab);
      const hw = w / 2 + 0.04;
      const hd = d / 2 + 0.04;
      const pts = [
        new THREE.Vector3(-hw, 0.085, -hd),
        new THREE.Vector3(hw, 0.085, -hd),
        new THREE.Vector3(hw, 0.085, hd),
        new THREE.Vector3(-hw, 0.085, hd),
      ];
      const outlineMat = new THREE.LineBasicMaterial({ color: ACCENT[id].clone(), transparent: true, opacity: 0.6 });
      g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), outlineMat));
      return { group: g, outline: outlineMat };
    }

    function label(id: NodeId, height: number, parent: THREE.Object3D) {
      const el = document.createElement('div');
      el.className = 'lab3d-label';
      el.dataset.node = id;
      el.innerHTML = `<b></b><span></span>`;
      (el.firstChild as HTMLElement).textContent = NODES[id].name;
      (el.lastChild as HTMLElement).textContent = NODES[id].ip;
      el.addEventListener('click', () => {
        cyberAudio.playClick(960);
        callbacks.current.onSelectNode(id);
      });
      const obj = new CSS2DObject(el);
      obj.position.set(0, height, 0);
      parent.add(obj);
      labelLayer.push(obj);
      return el;
    }

    function addNode(id: NodeId, build: (g: THREE.Group) => { leds: THREE.InstancedMesh; base: THREE.Color[]; height: number }, size: [number, number]) {
      const g = new THREE.Group();
      g.position.copy(POS[id]);
      const plat = platform(id, size[0], size[1]);
      g.add(plat.group);
      const { leds, base, height } = build(g);
      // Bosish zonasi: ko'rinmas quti (mayda detallarni raycast qilmaslik uchun)
      const hit = new THREE.Mesh(new THREE.BoxGeometry(size[0], height + 0.4, size[1]), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = (height + 0.4) / 2;
      hit.userData.nodeId = id;
      g.add(hit);
      clickable.push(hit);
      scene.add(g);
      visuals[id] = { outline: plat.outline, leds, ledBase: base, label: label(id, height + 0.55, g), alert: null, flash: null };
    }

    // Hujumchi: stol, uch monitor, klaviatura
    addNode(
      'attacker',
      (g) => {
        const desk = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.06, 1.1, 2, 0.02), cabinetMat);
        desk.position.y = 0.95;
        desk.castShadow = true;
        g.add(desk);
        const legGeo = new THREE.BoxGeometry(0.06, 0.92, 0.9);
        for (const x of [-1.2, 1.2]) {
          const leg = new THREE.Mesh(legGeo, cabinetMat);
          leg.position.set(x, 0.47, 0);
          leg.castShadow = true;
          g.add(leg);
        }
        const screens = [
          screenTexture(['$ nmap -sV 10.0.8.0/24', 'PORT     STATE SERVICE', '80/tcp   open  http', '443/tcp  open  https', '3306/tcp filtered'], '#38bdf8'),
          screenTexture(['$ sqlmap -u /api/v1/search', '[*] testing UNION query', '[*] tamper: space2comment', '[+] parameter q injectable'], '#34d399'),
          screenTexture(['$ tail -f exploit.log', 'GET /search?q=1 200', 'GET /search?q=1\' 403', 'GET /search?q=1\'/**/ 200'], '#fbbf24'),
        ];
        const bezelGeo = new RoundedBoxGeometry(0.86, 0.52, 0.04, 2, 0.015);
        const screenGeo = new THREE.PlaneGeometry(0.8, 0.46);
        [-0.9, 0, 0.9].forEach((x, i) => {
          const mon = new THREE.Group();
          const bezel = new THREE.Mesh(bezelGeo, cabinetMat);
          bezel.castShadow = true;
          const screen = new THREE.Mesh(screenGeo, new THREE.MeshBasicMaterial({ map: screens[i], color: new THREE.Color(1.15, 1.15, 1.15) }));
          screen.position.z = 0.022;
          const stand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.05), cabinetMat);
          stand.position.y = -0.35;
          mon.add(bezel, screen, stand);
          mon.position.set(x, 1.33, -0.3 + Math.abs(x) * 0.12);
          mon.rotation.y = -x * 0.32;
          g.add(mon);
        });
        const kb = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.025, 0.28, 2, 0.008), unitMat);
        kb.position.set(0, 0.995, 0.25);
        g.add(kb);
        // LED o'rnida: klaviatura chizig'i
        const leds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.86, 0.006, 0.01), ledMat, 1);
        leds.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, 1.01, 0.39));
        const base = [ACCENT.attacker.clone().multiplyScalar(1.6)];
        leds.setColorAt(0, base[0]);
        g.add(leds);
        return { leds, base, height: 1.65 };
      },
      [3.4, 2.4],
    );

    addNode(
      'defender',
      (g) => {
        const desk = new THREE.Mesh(new RoundedBoxGeometry(2.4, 0.08, 1.3, 3, 0.02), unitMat);
        desk.position.set(0, 0.95, 0);
        desk.castShadow = true;
        g.add(desk);
        [-0.95, 0.95].forEach((x) => {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.95, 12), cabinetMat);
          leg.position.set(x, 0.475, 0);
          leg.castShadow = true;
          g.add(leg);
        });
        const socScreens = [
          screenTexture(['[SOC] SIEM Alert Monitor', 'SURICATA-2000537: SYN Port Sweep', 'MODSEC-942140: SQL Injection Attempt', 'ACTION: Investigate 198.51.100.42'], '#38bdf8'),
          screenTexture(['[SOC] Active Firewall Rules', 'iptables -A INPUT -s 198.51.100.42 -j DROP', 'Virtual Patch: CVE-SQLI-SEARCH [ACTIVE]', 'Network Status: Guarded'], '#34d399'),
        ];
        [-0.52, 0.52].forEach((x, i) => {
          const mon = new THREE.Group();
          const bezel = new THREE.Mesh(new RoundedBoxGeometry(0.85, 0.55, 0.04, 2, 0.01), cabinetMat);
          const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.79, 0.49), new THREE.MeshBasicMaterial({ map: socScreens[i % 2], color: new THREE.Color(1.15, 1.25, 1.4) }));
          screen.position.z = 0.022;
          const stand = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.04), cabinetMat);
          stand.position.y = -0.32;
          mon.add(bezel, screen, stand);
          mon.position.set(x, 1.3, -0.2 + Math.abs(x) * 0.08);
          mon.rotation.y = -x * 0.25;
          g.add(mon);
        });
        const kb = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.02, 0.24, 2, 0.008), unitMat);
        kb.position.set(0, 0.99, 0.2);
        g.add(kb);
        const leds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.76, 0.006, 0.01), ledMat, 1);
        leds.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, 1.01, 0.32));
        const base = [ACCENT.defender.clone().multiplyScalar(1.6)];
        leds.setColorAt(0, base[0]);
        g.add(leds);
        return { leds, base, height: 1.6 };
      },
      [2.8, 2.2],
    );

    addNode(
      'gateway',
      (g) => {
        const r = rack(1.1, 1.5, 0.9, 6, [0x34d399, 0x34d399, 0x38bdf8]);
        g.add(r.group);
        const antGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.55, 8);
        [-0.35, 0.35].forEach((x) => {
          const ant = new THREE.Mesh(antGeo, cabinetMat);
          ant.position.set(x, 1.78, -0.3);
          ant.rotation.z = x * 0.4;
          g.add(ant);
        });
        return { leds: r.leds, base: r.base, height: 2.05 };
      },
      [2.0, 1.8],
    );

    let shield: THREE.Mesh<THREE.CylinderGeometry, THREE.ShaderMaterial>;
    addNode(
      'waf',
      (g) => {
        const r = rack(1.1, 2.1, 1.0, 9, [0xa78bfa, 0x34d399, 0x34d399]);
        g.add(r.group);
        // Qalqon hujumchi tomonga (−x) qaragan yoy
        shield = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 2.8, 64, 1, true, Math.PI * 1.15, Math.PI * 0.7), shieldMaterial());
        shield.position.y = 1.35;
        g.add(shield);
        return { leds: r.leds, base: r.base, height: 2.65 };
      },
      [2.2, 2.0],
    );

    addNode(
      'web',
      (g) => {
        const a = rack(1.0, 2.2, 1.0, 10, [0x34d399, 0x34d399, 0x38bdf8, 0x34d399]);
        const b = rack(1.0, 2.2, 1.0, 10, [0x34d399, 0x38bdf8, 0x34d399]);
        a.group.position.x = -0.56;
        b.group.position.x = 0.56;
        g.add(a.group, b.group);
        // Ikkala shkaf LED'larini bitta ro'yxatga
        const leds = new THREE.InstancedMesh(ledGeo, ledMat, a.leds.count + b.leds.count);
        const m = new THREE.Matrix4();
        const off = new THREE.Matrix4();
        const base: THREE.Color[] = [];
        [a, b].forEach((r, idx) => {
          off.makeTranslation(idx === 0 ? -0.56 : 0.56, 0, 0);
          for (let i = 0; i < r.leds.count; i++) {
            r.leds.getMatrixAt(i, m);
            const j = idx * a.leds.count + i;
            leds.setMatrixAt(j, m.premultiply(off));
            base.push(r.base[i]);
            leds.setColorAt(j, r.base[i]);
          }
          r.group.remove(r.leds);
        });
        g.add(leds);
        return { leds, base, height: 2.75 };
      },
      [2.8, 2.0],
    );

    addNode(
      'db',
      (g) => {
        const r = rack(1.2, 2.3, 1.1, 16, [0xfbbf24, 0x38bdf8, 0x38bdf8, 0x38bdf8]);
        g.add(r.group);
        return { leds: r.leds, base: r.base, height: 2.85 };
      },
      [2.2, 2.0],
    );

    // ---------- kabellar ----------
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x16232c, metalness: 0.3, roughness: 0.6, emissive: 0x0b3a4a, emissiveIntensity: 0.5 });
    const links: [NodeId, NodeId][] = [
      ['attacker', 'gateway'],
      ['gateway', 'waf'],
      ['waf', 'web'],
      ['web', 'db'],
      ['defender', 'waf'],
      ['defender', 'gateway'],
    ];
    const linkPaths = links.map(([a, b]) => {
      const pts = linkPoints(a, b).map((p) => new THREE.Vector3(p.x, 0.05, p.z));
      const tube = new THREE.Mesh(new THREE.TubeGeometry(polyline(pts), 64, 0.035, 6, false), cableMat);
      tube.receiveShadow = true;
      scene.add(tube);
      return { a, b, forward: route([a, b]), back: route([b, a]) };
    });

    // ---------- paketlar (bitta InstancedMesh) ----------
    const packetMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.24, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_PACKETS);
    packetMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    packetMesh.frustumCulled = false;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < MAX_PACKETS; i++) {
      packetMesh.setMatrixAt(i, zero);
      packetMesh.setColorAt(i, CYAN);
    }
    scene.add(packetMesh);
    const packets: Packet[] = [];

    function spawn(path: THREE.CurvePath<THREE.Vector3>, color: THREE.Color, at: number, speed = 5, end = 1) {
      if (packets.length >= MAX_PACKETS) packets.shift();
      packets.push({ path, color, start: at, duration: (path.getLength() * end) / (speed * (reduced ? 0.5 : 1)), end, alive: true });
    }

    // ---------- skan halqasi ----------
    const ringMat = new THREE.MeshBasicMaterial({ color: CYAN.clone().multiplyScalar(1.6), transparent: true, opacity: 0, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 160), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(POS.attacker.x, 0.09, POS.attacker.z);
    scene.add(ring);

    // ---------- postprocessing ----------
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.45, 0.85);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    // ---------- o'lcham ----------
    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // Uzoqroq kamera (tor ekran) — tuman yengilroq
      (scene.fog as THREE.FogExp2).density = camera.aspect < 1.5 ? 0.012 : 0.022;
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      labels.setSize(w, h);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();
    {
      const start = framing(initial.current.cameraPreset);
      camera.position.copy(start.pos);
      controls.target.copy(start.target);
      controls.update();
    }

    // ---------- tanlash (raycast) ----------
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downAt = { x: 0, y: 0 };
    const pick = (e: PointerEvent): NodeId | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      return (raycaster.intersectObjects(clickable, false)[0]?.object.userData.nodeId as NodeId) ?? null;
    };
    let hovered: NodeId | null = null;
    const onMove = (e: PointerEvent) => {
      const id = pick(e);
      if (id === hovered) return;
      hovered = id;
      renderer.domElement.style.cursor = id ? 'pointer' : '';
      NODE_ORDER.forEach((n) => visuals[n].label.classList.toggle('is-hover', n === id));
    };
    const onDown = (e: PointerEvent) => {
      downAt = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      // Sudrab aylantirish bosish hisoblanmaydi
      if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
      const id = pick(e);
      if (id) {
        cyberAudio.playClick(960);
        callbacks.current.onSelectNode(id);
      }
    };
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    // ---------- holat ----------
    let now = 0;
    let active: NodeId = initial.current.activeNode;
    let fly: { from: THREE.Vector3; to: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3; start: number; dur: number } | null = null;
    let fx: { kind: AttackKind; start: number; dur: number; done: boolean; marks: Set<string> } | null = null;
    const shieldState = { color: new THREE.Color(0xa78bfa), boost: 0, boostColor: new THREE.Color() };
    let nextIdle = 0;
    let nextBlink = 0;

    const flash = (id: NodeId, color: THREE.Color) => {
      visuals[id].flash = { color, at: now };
    };
    const alertNode = (id: NodeId, color: THREE.Color | null, seconds = Infinity) => {
      visuals[id].alert = color ? { color, until: now + seconds } : null;
    };
    const shieldHit = (color: THREE.Color, boost = 1) => {
      shieldState.boostColor.copy(color);
      shieldState.boost = boost;
    };

    api.current = {
      setActive(id) {
        active = id;
      },
      flyTo(preset) {
        const { pos: to, target: toT } = framing(preset);
        if (reduced) {
          camera.position.copy(to);
          controls.target.copy(toT);
          return;
        }
        fly = { from: camera.position.clone(), to, fromT: controls.target.clone(), toT, start: now, dur: 1.4 };
      },
      play(kind) {
        const dur = { scan: 2.2, waf_block: 1.7, exploit: 3.4, ddos: 3.0, mitigate: 1.4, counter_block: 2.8 }[kind];
        fx = { kind, start: now, dur, done: false, marks: new Set() };
        if (kind === 'scan') {
          cyberAudio.playScan();
        } else if (kind === 'waf_block') {
          cyberAudio.playAttack();
          spawn(route(['attacker', 'gateway', 'waf']), RED.clone().multiplyScalar(2.4), now, 9);
        } else if (kind === 'exploit') {
          cyberAudio.playAttack();
          const full = route(ATTACK_ORDER);
          for (let i = 0; i < 6; i++) spawn(full, RED.clone().multiplyScalar(2.4), now + i * 0.11, 14);
          shieldHit(new THREE.Color(0xfbbf24), 0.6);
        } else if (kind === 'ddos') {
          cyberAudio.playAlarm();
          const gw = POS.gateway;
          for (let i = 0; i < 90; i++) {
            const ang = Math.PI * 0.55 + Math.random() * Math.PI * 0.9;
            const dist = 16 + Math.random() * 10;
            const from = new THREE.Vector3(gw.x + Math.cos(ang) * dist, PACKET_Y, gw.z + Math.sin(ang) * dist);
            spawn(polyline([from, new THREE.Vector3(gw.x, PACKET_Y, gw.z)]), RED.clone().multiplyScalar(1.8 + Math.random()), now + Math.random() * 2.2, 9 + Math.random() * 5);
          }
          alertNode('gateway', RED);
          alertNode('defender', new THREE.Color(0xf59e0b), 3);
        } else if (kind === 'mitigate') {
          cyberAudio.playShieldDeflect();
          packets.forEach((p) => {
            if (p.color.r > p.color.g) p.alive = false;
          });
          NODE_ORDER.forEach((id) => alertNode(id, null));
          shieldHit(GREEN, 1.2);
          flash('defender', CYAN);
          // SOC Himoyachi markazi Gateway va WAF ga himoya qoidalarini yuboradi
          spawn(route(['defender', 'gateway']), CYAN.clone().multiplyScalar(2.2), now, 12);
          spawn(route(['defender', 'waf']), CYAN.clone().multiplyScalar(2.2), now + 0.12, 12);
          NODE_ORDER.forEach((id) => flash(id, GREEN));
        } else if (kind === 'counter_block') {
          cyberAudio.playAlarm();
          alertNode('defender', new THREE.Color(0xf59e0b), 3);
          alertNode('gateway', RED, 3);
          const counterRoute = route(['defender', 'gateway', 'attacker']);
          for (let i = 0; i < 5; i++) {
            spawn(counterRoute, RED.clone().multiplyScalar(2.8), now + i * 0.1, 14);
          }
        }
      },
      setThermal(thermal: boolean) {
        if (thermal) {
          scene.background = new THREE.Color(0x020208);
          (scene.fog as THREE.FogExp2).color.set(0x040310);
          renderer.toneMappingExposure = 1.7;
        } else {
          scene.background = new THREE.Color(BG);
          (scene.fog as THREE.FogExp2).color.set(BG);
          renderer.toneMappingExposure = 1.3;
        }
      },
      updateScenario(sc: ScenarioId) {
        const scNodes = getScenarioNodes(sc);
        NODE_ORDER.forEach((id) => {
          const v = visuals[id];
          if (v && v.label) {
            const first = v.label.firstChild as HTMLElement;
            const last = v.label.lastChild as HTMLElement;
            if (first && scNodes[id]) first.textContent = scNodes[id].name;
            if (last && scNodes[id]) last.textContent = scNodes[id].ip;
          }
        });
      },
    };
    api.current.setActive(active);
    if (initial.current.scenario) api.current.updateScenario(initial.current.scenario);
    if (initial.current.thermalMode) api.current.setThermal(initial.current.thermalMode);

    // ---------- sikl ----------
    const dummy = new THREE.Object3D();
    const tangent = new THREE.Vector3();
    const tmpColor = new THREE.Color();
    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    io.observe(host);

    let last = performance.now();
    let raf = 0;
    const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

    const frame = (ms: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((ms - last) / 1000, 0.05);
      last = ms;
      if (!visible || document.hidden) return;
      now += dt;

      // Kamera o'tishi (faqat o'tish paytida, keyin foydalanuvchi erkin aylantiradi)
      if (fly) {
        const k = Math.min((now - fly.start) / fly.dur, 1);
        const e = ease(k);
        camera.position.lerpVectors(fly.from, fly.to, e);
        controls.target.lerpVectors(fly.fromT, fly.toT, e);
        if (k >= 1) fly = null;
      }
      controls.update();

      // Fon trafigi: kabellar bo'ylab sokin paketlar
      if (now >= nextIdle) {
        const link = linkPaths[Math.floor(Math.random() * linkPaths.length)];
        spawn(Math.random() < 0.5 ? link.forward : link.back, CYAN.clone().multiplyScalar(0.9), now, 3.2);
        nextIdle = now + (reduced ? 1.2 : 0.32);
      }

      // Hujum ssenariysi
      if (fx && !fx.done) {
        const t = now - fx.start;
        const once = (mark: string, at: number, fn: () => void) => {
          if (t >= at && !fx!.marks.has(mark)) {
            fx!.marks.add(mark);
            fn();
          }
        };
        if (fx.kind === 'scan') {
          const r = 0.5 + t * 13;
          ring.scale.setScalar(r);
          ringMat.opacity = Math.max(0, 0.9 - t / fx.dur);
          NODE_ORDER.forEach((id) => once(`s-${id}`, POS[id].distanceTo(POS.attacker) / 13, () => flash(id, CYAN)));
        } else if (fx.kind === 'waf_block') {
          once('hit', 0.75, () => {
            cyberAudio.playShieldDeflect();
            shieldHit(RED, 1.6);
            flash('waf', RED);
            packets.forEach((p) => {
              if (p.color.r > p.color.g) p.alive = false;
            });
          });
        } else if (fx.kind === 'exploit') {
          const full = route(ATTACK_ORDER).getLength();
          let acc = 0;
          ATTACK_ORDER.forEach((id, i) => {
            if (i > 0) acc += route([ATTACK_ORDER[i - 1], id]).getLength();
            once(`e-${id}`, acc / 14, () => flash(id, RED));
          });
          once('defender-alert', (full * 0.4) / 14, () => alertNode('defender', new THREE.Color(0xf59e0b), 2.5));
          once('db', full / 14, () => alertNode('db', RED, 4));
          once('exfil', full / 14 + 0.25, () => {
            const back = route([...ATTACK_ORDER].reverse());
            for (let i = 0; i < 4; i++) spawn(back, GREEN.clone().multiplyScalar(2.2), now + i * 0.12, 16);
          });
          once('win', fx.dur - 0.2, () => cyberAudio.playVictory());
        } else if (fx.kind === 'ddos') {
          once('ring', 0.4, () => flash('gateway', RED));
        } else if (fx.kind === 'counter_block') {
          once('hit_attacker', 0.9, () => {
            cyberAudio.playShieldDeflect();
            alertNode('attacker', RED, 4);
            flash('attacker', RED);
            shieldHit(RED, 2.0);
          });
        }
        if (t >= fx.dur) {
          fx.done = true;
          ringMat.opacity = 0;
          callbacks.current.onAttackFinish?.();
        }
      }

      // Paketlar
      let n = 0;
      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i];
        const k = (now - p.start) / p.duration;
        if (!p.alive || k > 1) {
          packets.splice(i, 1);
          continue;
        }
        if (k < 0) continue;
        const u = Math.min(k * p.end, 0.9999);
        p.path.getPointAt(u, dummy.position);
        p.path.getTangentAt(u, tangent);
        dummy.lookAt(tangent.add(dummy.position));
        dummy.rotateY(Math.PI / 2);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        packetMesh.setMatrixAt(n, dummy.matrix);
        packetMesh.setColorAt(n, p.color);
        n++;
      }
      for (let i = n; i < packetMesh.count; i++) packetMesh.setMatrixAt(i, zero);
      packetMesh.instanceMatrix.needsUpdate = true;
      if (packetMesh.instanceColor) packetMesh.instanceColor.needsUpdate = true;

      // Qalqon
      shieldState.boost = Math.max(0, shieldState.boost - dt * 1.4);
      shield.material.uniforms.uTime.value = reduced ? 0 : now;
      shield.material.uniforms.uIntensity.value = 0.16 + shieldState.boost;
      tmpColor.copy(shieldState.color).lerp(shieldState.boostColor, Math.min(shieldState.boost, 1));
      shield.material.uniforms.uColor.value.copy(tmpColor);

      // Tugun konturlari, yozuvlar va LED'lar
      const blink = !reduced && now >= nextBlink;
      if (blink) nextBlink = now + 0.12;
      NODE_ORDER.forEach((id) => {
        const v = visuals[id];
        const selected = id === active;
        if (v.alert && now > v.alert.until) v.alert = null;
        const pulse = 0.5 + 0.5 * Math.sin(now * 9);
        tmpColor.copy(ACCENT[id]).multiplyScalar(selected ? 1.9 : 0.75);
        if (v.alert) tmpColor.lerp(v.alert.color.clone().multiplyScalar(2), 0.6 + 0.4 * pulse);
        if (v.flash) {
          const f = 1 - (now - v.flash.at) / 0.9;
          if (f <= 0) v.flash = null;
          else tmpColor.lerp(v.flash.color.clone().multiplyScalar(2.4), f);
        }
        v.outline.color.copy(tmpColor);
        v.outline.opacity = selected || v.alert || v.flash ? 1 : 0.55;
        v.label.classList.toggle('is-active', selected);
        v.label.classList.toggle('is-alert', !!v.alert);

        if (blink) {
          for (let i = 0; i < v.ledBase.length; i++) {
            const r = Math.random();
            if (v.alert) v.leds.setColorAt(i, r < 0.5 ? RED.clone().multiplyScalar(2.4) : tmpColor.setRGB(0.05, 0.02, 0.02));
            else if (r < 0.07) v.leds.setColorAt(i, tmpColor.setRGB(0.04, 0.05, 0.05));
            else v.leds.setColorAt(i, v.ledBase[i]);
          }
          if (v.leds.instanceColor) v.leds.instanceColor.needsUpdate = true;
        }
      });

      composer.render();
      labels.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      controls.dispose();
      labelLayer.forEach((o) => o.removeFromParent());
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        mats.forEach((m) => {
          Object.values(m).forEach((v) => {
            if (v instanceof THREE.Texture) v.dispose();
          });
          m.dispose();
        });
      });
      envTex.dispose();
      pmrem.dispose();
      composer.dispose();
      renderer.dispose();
      // Ochib-yopishda WebGL kontekstlari to'planib qolmasin (brauzer ~16 tadan keyin eskisini o'chiradi)
      renderer.forceContextLoss();
      host.removeChild(renderer.domElement);
      host.removeChild(labels.domElement);
      api.current = null;
    };
  }, []);

  useEffect(() => {
    api.current?.setActive(activeNode);
  }, [activeNode]);

  const firstCamera = useRef(true);
  useEffect(() => {
    // Birinchi render kamerani boshlang'ich joyga qo'yadi, o'tish animatsiyasi kerak emas
    if (firstCamera.current) {
      firstCamera.current = false;
      return;
    }
    api.current?.flyTo(cameraPreset);
  }, [cameraPreset]);

  useEffect(() => {
    if (attack) api.current?.play(attack.kind);
  }, [attack]);

  useEffect(() => {
    if (thermalMode !== undefined) api.current?.setThermal(thermalMode);
  }, [thermalMode]);

  useEffect(() => {
    if (scenario) api.current?.updateScenario(scenario);
  }, [scenario]);

  return <div ref={hostRef} className="lab3d-scene" />;
}
