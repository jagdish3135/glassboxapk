import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Html, Line, PerformanceMonitor, useProgress } from '@react-three/drei';
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import { BlendFunction, type ChromaticAberrationEffect } from 'postprocessing';
import * as THREE from 'three';
import { loadBus, story } from '../story';
import { cursorBus, ringPos } from '../../lib/cursorBus';
import { MagnifierEffect } from './Magnifier';
import { HDRI, animateRobot, useGlassModel } from './model';
import { createGlass } from './glass';


const LABELS = ['manifest', 'activities', 'screens', 'network'];
const CYAN = '#7fe3f0';
const SIGNAL = '#ff5a1f';
const INK = '#0b0f11';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const smooth = (t: number) => t * t * (3 - 2 * t);
const { lerp } = THREE.MathUtils;

interface Layout {
  hero: THREE.Vector3;
  heroScale: number;
  nodes: THREE.Vector3[];
  nodeSize: THREE.Vector3;
  deck: THREE.Vector3;
  slideSize: THREE.Vector3;
  zoom: number;
}

function makeLayout(mobile: boolean): Layout {
  return mobile
    ? {
      hero: new THREE.Vector3(0, -2.8, 0),
      heroScale: 0.62,
      nodes: [[-0.92, 0.95], [0.92, 0.95], [-0.92, -0.35], [0.92, -0.35]].map(([x, y]) => new THREE.Vector3(x, y, 0)),
      nodeSize: new THREE.Vector3(1.5, 1.0, 0.07),
      deck: new THREE.Vector3(0, 0.45, 0),
      slideSize: new THREE.Vector3(2.3, 1.3, 0.035),
      zoom: 1.5,
    }
    : {
      hero: new THREE.Vector3(1.95, 0, 0),
      heroScale: 1,
      nodes: [-2.1, -0.1, 1.9, 3.9].map((x) => new THREE.Vector3(x, 0.45, 0)),
      nodeSize: new THREE.Vector3(1.55, 1.0, 0.07),
      deck: new THREE.Vector3(1.8, 0.15, 0),
      slideSize: new THREE.Vector3(2.7, 1.52, 0.035),
      zoom: 1,
    };
}

/** Reports real asset-loading progress to the DOM loader. */
function Progress() {
  const { progress } = useProgress();
  useEffect(() => { loadBus.emit(progress * 0.98); }, [progress]);
  return null;
}
function Ready() {
  useEffect(() => { loadBus.emit(100); }, []);
  return null;
}

/** A slide face for each slab, drawn once on a canvas: title, system map, two flow steps. */
function slideTexture(i: number) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 288;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f6f3ed'; g.fillRect(0, 0, 512, 288);
  g.fillStyle = '#141414'; g.fillRect(0, 0, 512, 34);
  g.fillStyle = '#ff5a1f'; g.fillRect(16, 13, 8, 8);
  g.fillStyle = '#e9ede9'; g.font = '500 14px monospace';
  g.fillText(`GLASSBOX REPORT · ${String(i + 1).padStart(2, '0')} / 04`, 34, 22);
  g.fillStyle = '#141414';
  g.font = 'bold 40px Georgia, serif';
  const titles = ['FoodDash', 'System map', 'Login · step 04', 'Place order · 09'];
  g.fillText(titles[i], 24, 92);
  g.fillStyle = 'rgba(20,20,20,0.14)';
  [124, 142, 160].forEach((y, k) => g.fillRect(24, y, k === 2 ? 180 : 260, 8));
  if (i === 0) {
    g.fillStyle = '#141414'; g.fillRect(24, 196, 140, 64);
    g.fillStyle = '#ff5a1f'; g.fillRect(176, 196, 140, 64);
    g.fillStyle = '#d9d4c8'; g.fillRect(328, 196, 140, 64);
  } else {
    const boxes = i === 1 ? [[300, 60], [400, 60], [300, 140], [400, 140], [350, 214]] : [[300, 120], [420, 120]];
    g.strokeStyle = '#ff5a1f'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(boxes[0][0] + 40, boxes[0][1] + 20); boxes.slice(1).forEach(([x, y]) => g.lineTo(x + 40, y + 20)); g.stroke();
    boxes.forEach(([x, y]) => { g.fillStyle = '#0c1012'; g.fillRect(x, y, 80, 40); g.strokeStyle = '#7fe3f0'; g.lineWidth = 2; g.strokeRect(x, y, 80, 40); });
    g.fillStyle = '#141414'; g.fillRect(24, 220, 210, 30);
    g.fillStyle = '#ffd2c0'; g.font = '14px monospace'; g.fillText(i === 1 ? '13 nodes · 8 flows' : 'AuthApi.verify()', 34, 240);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A soft radial glow behind the box, so the glass has light to bend. */
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(127,227,240,0.55)');
  grd.addColorStop(0.35, 'rgba(60,120,135,0.25)');
  grd.addColorStop(1, 'rgba(11,15,17,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Reused scratch objects (no allocations per frame).
const _q = new THREE.Quaternion();
const _qRig = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _id = new THREE.Quaternion();
const EDGE_GEO = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));

function Story({ mobile }: { mobile: boolean }) {
  const L = useMemo(() => makeLayout(mobile), [mobile]);
  const { size } = useThree();
  // The glass case and the Android robot inside it (shared with the final panel's showcase).
  const model = useGlassModel();
  const { shellGeo, shellMatrix, robot } = model;

  const rig = useRef<THREE.Group>(null!);
  const shell = useRef<THREE.Mesh>(null!);
  const glass = useMemo(() => createGlass(), []);
  const pkg = useRef<THREE.Group>(null!);
  const slabs = useRef<(THREE.Group | null)[]>([]);
  const slabMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const edges = useRef<(THREE.LineBasicMaterial | null)[]>([]);
  const faces = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const glow = useRef<THREE.Mesh>(null!);
  const slides = useMemo(() => LABELS.map((_, i) => slideTexture(i)), []);
  const glowMap = useMemo(() => glowTexture(), []);
  // Labels go into the fixed canvas layer (the default would be the scrolling #root, off screen).
  const portal = useMemo(() => ({ current: document.querySelector<HTMLElement>('.l-canvas')! }), []);
  const shellWrap = useRef<THREE.Group>(null!);
  const labelGroups = useRef<(THREE.Group | null)[]>([]);
  const labels = useRef<(HTMLSpanElement | null)[]>([]);
  const lines = useRef<({ geometry: THREE.InstancedBufferGeometry; material: THREE.Material & { opacity: number } } | null)[]>([]);
  const packets = useRef<(THREE.Mesh | null)[]>([]);
  const mouse = useRef(new THREE.Vector2());
  const aim = useRef(new THREE.Vector2());

  // Flow lines between the nodes: three forward arcs and one response arc back.
  const curves = useMemo(() => {
    const n = L.nodes;
    const arc = (a: THREE.Vector3, b: THREE.Vector3, lift: number) => {
      const mid = a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(0, lift, 0.35));
      return new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
    };
    const up = mobile ? 0.45 : 0.9;
    return [arc(n[0], n[1], up), arc(n[1], n[2], up), arc(n[2], n[3], up), arc(n[3], n[1], mobile ? -0.9 : -1.25)];
  }, [L, mobile]);
  const curvePts = useMemo(() => curves.map((c) => c.getPoints(64)), [curves]);

  const slabColor = useMemo(() => new THREE.Color('#d4f2f6'), []);

  useFrame((state, dt) => {
    const p = story.p;
    const t = state.clock.elapsedTime;
    mouse.current.lerp(state.pointer, 1 - Math.pow(0.002, dt));
    const mx = mouse.current.x, my = mouse.current.y;

    const crack = smooth(seg(p, 0.3, 1.0));
    const fan = smooth(seg(p, 1.15, 2.0));
    const draw = seg(p, 2.05, 2.85);
    const deck = smooth(seg(p, 3.0, 3.75));
    const flip = seg(p, 3.55, 4.55);
    const reform = smooth(seg(p, 4.5, 4.95));

    // ---- Camera: driven by the scroll timeline, with gentle mouse parallax.
    const cam = state.camera;
    const zf = L.zoom;
    cam.position.set(story.camX * (mobile ? 0 : 1) + mx * 0.35, story.camY + my * 0.22, story.camZ * zf);
    cam.lookAt(story.camX * (mobile ? 0 : 0.7), story.camY * 0.6, 0);

    // ---- The glass box rig: a 3/4 view that turns to face the cursor wherever it is on screen
    // (eased, with a slow idle drift), then settles into the exploded view as the box cracks.
    aim.current.lerp(state.pointer, 1 - Math.pow(0.04, dt));
    const ax = aim.current.x, ay = aim.current.y;
    // The case turns up to ~35° (beyond that its back wall goes edge-on); the head turns the rest.
    const heroRotY = -0.5 + ax * 0.6 + Math.sin(t * 0.35) * 0.08;
    const heroRotX = 0.3 - ay * 0.38 + Math.sin(t * 0.5) * 0.03;
    _e.set(lerp(heroRotX, 0.42, crack), lerp(heroRotY, -0.62, crack), 0);
    rig.current.rotation.copy(_e);
    rig.current.position.copy(L.hero).add(_v.set(0, Math.sin(t * 0.8) * 0.06 * (1 - crack), 0));
    rig.current.scale.setScalar(L.heroScale);
    _qRig.setFromEuler(_e);

    const shellFade = Math.max(1 - smooth(seg(crack, 0.08, 0.5)), reform);
    const burst = 1 + smooth(seg(crack, 0.05, 0.55)) * 0.28 * (1 - reform);
    shellWrap.current.visible = shellFade > 0.01;
    shellWrap.current.scale.setScalar(burst);
    glass.setFade(shellFade);
    const pkgScale = Math.max(1 - smooth(seg(crack, 0.25, 0.85)), reform);
    pkg.current.scale.setScalar(Math.max(pkgScale, 0.0001));
    pkg.current.visible = pkgScale > 0.01;

    if (crack > 0.08 && cursorBus.get().inspect) cursorBus.set({ inspect: false });

    // ---- The robot looks at the cursor and waves while you inspect it; it stands still once the box cracks.
    animateRobot(model, state.pointer, cam, t, dt, crack, cursorBus.get().inspect ? 1 : 0);

    // The glow follows the box and dims while the story moves to the nodes and the deck.
    glow.current.position.set(rig.current.position.x, rig.current.position.y, -4);
    (glow.current.material as THREE.MeshBasicMaterial).opacity = 0.85 * Math.max(1 - fan * 0.75, reform);

    // ---- Slabs: stacked inside the box → exploded layers → flow nodes → slides that flip.
    for (let i = 0; i < 4; i++) {
      const g = slabs.current[i], mesh = slabMeshes.current[i], lg = labelGroups.current[i];
      if (!g || !mesh || !lg) continue;

      // Stage A (inside the box, rig space) → stage B (exploded, rig space).
      const yA = 0.75 - i * 0.5, yB = 1.25 - i * 0.82;
      _v.set(0, lerp(yA, yB, crack), 0).applyQuaternion(_qRig).multiplyScalar(L.heroScale).add(rig.current.position);
      const sx = lerp(1.96, 2.25, crack), sy = lerp(0.48, 0.07, crack), sz = lerp(1.96, 1.7, crack);

      // Stage C: flow node facing the camera.
      g.position.copy(_v).lerp(L.nodes[i], fan);
      _q.copy(_qRig).slerp(_id, fan);
      let nx = lerp(sx * L.heroScale, L.nodeSize.x, fan);
      let ny = lerp(sy * L.heroScale, L.nodeSize.y, fan);
      let nz = lerp(sz * L.heroScale, L.nodeSize.z, fan);

      // Stage D: a slide in the deck, then flipping like a page (it fades as it goes over the top).
      let flipped = 0;
      if (deck > 0) {
        const dz = 0.2 - i * 0.07;
        _v2.copy(L.deck).add(_v.set(i * 0.05, -i * 0.04, dz));
        g.position.lerp(_v2, deck);
        nx = lerp(nx, L.slideSize.x, deck);
        ny = lerp(ny, L.slideSize.y, deck);
        nz = lerp(nz, L.slideSize.z, deck);
        // Flip-chart: each slide turns up and over its top edge, front slide first.
        // The last slide stays put: it's the one the deck ends on.
        const ft = i === 3 ? 0 : smooth(seg(flip, i * 0.2, i * 0.2 + 0.42));
        flipped = smooth(seg(ft, 0.45, 0.95));
        if (ft > 0) {
          const th = Math.PI * ft, h = ny * 0.5;
          g.position.y += h - h * Math.cos(th);
          g.position.z += -h * Math.sin(th) * 0.9 + 0.08 * Math.sin(th);
          _q.setFromEuler(_e.set(th, 0, 0));
        } else {
          _q.slerp(_id, deck);
        }
      }
      g.quaternion.copy(_q);
      mesh.scale.set(nx, ny, nz);

      // Fade in when the box cracks; fade out when the box re-forms.
      const vis = smooth(seg(crack, 0.12, 0.45)) * (1 - reform) * (1 - flipped);
      const mat = mesh.material as THREE.MeshPhysicalMaterial;
      mat.opacity = vis * 0.4;
      g.visible = vis > 0.01;
      const edge = edges.current[i];
      if (edge) edge.opacity = vis * lerp(0.55, 0.95, fan);
      // The slide face: a faint card while it's a node, solid paper once it's a slide.
      const face = faces.current[i];
      if (face) face.opacity = vis * Math.max(fan * 0.2 * (1 - deck), deck);

      // Labels sit beside the exploded layers, then on the face of each node; gone in the deck.
      lg.position.set(lerp(nx * 0.5 + 0.55, 0, fan), lerp(0, ny * 0.5 - 0.22, fan), lerp(0, nz * 0.5 + 0.02, fan));
      const el = labels.current[i];
      if (el) el.style.opacity = String(vis * (1 - smooth(seg(deck, 0, 0.4))) * smooth(seg(crack, 0.5, 0.9)));
    }

    // ---- Flow lines draw in, packets travel, everything clears for the deck.
    const lineVis = (1 - smooth(seg(deck, 0, 0.5))) * (draw > 0 ? 1 : 0);
    for (let k = 0; k < 4; k++) {
      const ln = lines.current[k];
      if (ln) {
        const local = clamp01(draw * 4 - k * 0.85);
        ln.geometry.instanceCount = Math.floor(64 * local);
        ln.material.opacity = lineVis;
      }
      const pk = packets.current[k];
      if (pk) {
        const on = draw > 0.55 && lineVis > 0.05;
        pk.visible = on;
        if (on) {
          pk.position.copy(curves[k].getPointAt((t * 0.32 + k * 0.27) % 1));
          pk.scale.setScalar(lineVis);
        }
      }
    }
  });

  const onOver = () => { if (story.p < 0.15) cursorBus.set({ inspect: true }); };
  const onOut = () => cursorBus.set({ inspect: false });

  return (
    <group>
      <mesh ref={glow} scale={mobile ? 9 : 12} renderOrder={-1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={glowMap} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={rig}>
        <group ref={shellWrap}>
          <mesh ref={shell} geometry={shellGeo} matrix={shellMatrix} matrixAutoUpdate={false}
            material={glass.material} renderOrder={3} onPointerOver={onOver} onPointerOut={onOut} />
        </group>
        <group ref={pkg}><primitive object={robot} /></group>
      </group>

      {LABELS.map((label, i) => (
        <group key={label} ref={(el) => { slabs.current[i] = el; }} visible={false}>
          <mesh ref={(el) => { slabMeshes.current[i] = el; }} renderOrder={2}>
            <boxGeometry args={[1, 1, 1]} />
            {/* Clear-coated glass without a transmission pass (no second render of the scene). */}
            <meshPhysicalMaterial color={slabColor} roughness={0.12} metalness={0} clearcoat={1} clearcoatRoughness={0.05}
              envMapIntensity={1.2} transparent opacity={0} depthWrite={false} />
            <lineSegments geometry={EDGE_GEO}>
              <lineBasicMaterial ref={(el) => { edges.current[i] = el; }} color={CYAN} transparent opacity={0} toneMapped={false} />
            </lineSegments>
            <mesh position={[0, 0, 0.51]}>
              <planeGeometry args={[0.98, 0.98]} />
              <meshBasicMaterial ref={(el) => { faces.current[i] = el; }} map={slides[i]} transparent opacity={0} depthWrite={false} />
            </mesh>
          </mesh>
          <group ref={(el) => { labelGroups.current[i] = el; }}>
            <Html center portal={portal} zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
              <span ref={(el) => { labels.current[i] = el; }} className="slab-label" aria-hidden="true">
                <i>{String(i + 1).padStart(2, '0')}</i>{label}
              </span>
            </Html>
          </group>
        </group>
      ))}

      {curvePts.map((pts, k) => (
        <Line key={k} ref={(el) => { lines.current[k] = el as never; }} points={pts}
          color={k === 3 ? '#2fd3a7' : CYAN} lineWidth={mobile ? 1.6 : 2} transparent opacity={0} toneMapped={false} />
      ))}
      {curves.map((_, k) => (
        <mesh key={k} ref={(el) => { packets.current[k] = el; }} visible={false}>
          <sphereGeometry args={[0.065, 16, 12]} />
          <meshBasicMaterial color={k === 3 ? '#2fd3a7' : SIGNAL} toneMapped={false} />
        </mesh>
      ))}
      <Ready />
      {/* keep the lens sized from the same radius the DOM ring uses */}
      <LensSize width={size.width} />
    </group>
  );
}

function LensSize({ width }: { width: number }) {
  useEffect(() => { cursorBus.set({ lensRadius: width < 900 ? 52 : 64 }); }, [width]);
  return null;
}

function Effects() {
  const magnifier = useMemo(() => new MagnifierEffect(), []);
  const ca = useRef<ChromaticAberrationEffect>(null);
  const caOffset = useMemo(() => new THREE.Vector2(0.00015, 0.00015), []);
  const strength = useRef(0);

  useFrame((state, dt) => {
    const u = magnifier.uniforms;
    const target = cursorBus.get().inspect ? 1 : 0;
    strength.current += (target - strength.current) * (1 - Math.pow(0.0001, dt));
    u.get('uStrength')!.value = strength.current;
    // Centre the zoom on the ring as drawn (it trails the pointer), so lens and ring line up.
    (u.get('uCenter')!.value as THREE.Vector2).set(ringPos.x / state.size.width, 1 - ringPos.y / state.size.height);
    u.get('uRadius')!.value = cursorBus.get().lensRadius / state.size.height;
    u.get('uAspect')!.value = state.size.width / state.size.height;
    ca.current?.offset.set(story.aberration, story.aberration);
  });

  return (
    <EffectComposer multisampling={0}>
      <primitive object={magnifier} />
      <Bloom mipmapBlur intensity={0.65} luminanceThreshold={0.8} luminanceSmoothing={0.25} />
      <ChromaticAberration ref={ca as never} offset={caOffset} radialModulation={false} modulationOffset={0} />
      <Noise opacity={0.025} premultiply blendFunction={BlendFunction.SOFT_LIGHT} />
      <Vignette offset={0.3} darkness={0.6} />
    </EffectComposer>
  );
}

export default function Scene({ active, mobile, eventSource }: { active: boolean; mobile: boolean; eventSource: HTMLElement }) {
  // Start sharp; drop to 1x if the frame rate can't keep up (and come back when it can).
  const maxDpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75);
  const [dpr, setDpr] = useState(maxDpr);
  // If the GPU struggles even at 1x, drop the post-effects too (bloom, grain, lens).
  const [low, setLow] = useState(false);
  return (
    <Canvas
      dpr={dpr}
      frameloop={active ? 'always' : 'never'}
      camera={{ fov: 35, position: [0, 0, 9], near: 0.1, far: 60 }}
      gl={{ antialias: !mobile, powerPreference: 'high-performance' }}
      eventSource={eventSource}
      eventPrefix="client"
      aria-hidden="true"
    >
      <color attach="background" args={[INK]} />
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(maxDpr)} flipflops={3}
        onFallback={() => { setDpr(1); setLow(true); }} />
      {/* Studio light, as in the poster: a soft key from above-left, an orange rim behind, a low fill. */}
      <ambientLight intensity={0.2} />
      <directionalLight position={[-3, 6, 4]} intensity={1.6} />
      <pointLight position={[4.5, 1.5, -2.5]} intensity={18} distance={12} color="#ff7a40" />
      <pointLight position={[4, -2, 4]} intensity={5} distance={14} color="#cfe9ec" />
      <Progress />
      <Suspense fallback={null}>
        <Environment files={HDRI} environmentIntensity={0.9} />
        <Story mobile={mobile} />
        {!mobile && !low && <Effects />}
      </Suspense>
    </Canvas>
  );
}
