import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { HDRI, animateRobot, useGlassModel } from './model';
import { createGlass } from './glass';

/** A soft cyan glow behind the case, so the glass has light to bend. */
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(127,227,240,0.5)');
  grd.addColorStop(0.4, 'rgba(60,120,135,0.22)');
  grd.addColorStop(1, 'rgba(11,15,17,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Case() {
  const model = useGlassModel();
  const rig = useRef<THREE.Group>(null!);
  const aim = useRef(new THREE.Vector2());
  const glow = useMemo(() => glowTexture(), []);
  const glass = useMemo(() => createGlass(), []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    // The cursor is measured against this canvas (not the window), every frame so scrolling
    // counts too. Outside the canvas the values go past ±1: the case keeps turning toward the
    // cursor anywhere on the page, within limits.
    const r = state.gl.domElement.getBoundingClientRect();
    if (client.seen && r.width > 0) {
      _p.set(
        THREE.MathUtils.clamp(((client.x - r.left) / r.width) * 2 - 1, -2.5, 2.5),
        THREE.MathUtils.clamp(-((client.y - r.top) / r.height) * 2 + 1, -2.5, 2.5),
      );
    } else _p.set(0, 0);
    aim.current.lerp(_p, 1 - Math.pow(0.04, dt));
    const ax = THREE.MathUtils.clamp(aim.current.x / 2.5, -1, 1), ay = THREE.MathUtils.clamp(aim.current.y / 2.5, -1, 1);
    rig.current.rotation.set(0.28 - ay * 0.38 + Math.sin(t * 0.5) * 0.03, -0.35 + ax * 0.6 + Math.sin(t * 0.35) * 0.06, 0);
    rig.current.position.y = Math.sin(t * 0.8) * 0.05;
    animateRobot(model, _p, state.camera, t, dt);
  });

  return (
    <>
      {/* Sized so the glow fades out fully inside the canvas (no visible square edge). */}
      <mesh position={[0, 0, -3.5]} scale={5.4} renderOrder={-1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={glow} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={rig}>
        <mesh geometry={model.shellGeo} matrix={model.shellMatrix} matrixAutoUpdate={false}
          material={glass.material} renderOrder={3} />
        <primitive object={model.robot} />
      </group>
    </>
  );
}
const _p = new THREE.Vector2();
/** Last cursor position in window coordinates. */
const client = { x: 0, y: 0, seen: false };

/** The glass case in the final call-to-action panel: centred, following the cursor. */
export default function Showcase() {
  const wrap = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  // Render only while the panel is on screen and the tab is visible.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let onScreen = false;
    const sync = () => setActive(onScreen && document.visibilityState === 'visible');
    const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); });
    io.observe(el);
    document.addEventListener('visibilitychange', sync);
    const onMove = (e: PointerEvent) => { client.x = e.clientX; client.y = e.clientY; client.seen = true; };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  return (
    <div ref={wrap} className="showcase" aria-hidden="true">
      <Canvas dpr={[1, 1.5]} frameloop={active ? 'always' : 'never'} camera={{ fov: 30, position: [0, 0.1, 7.4] }}
        gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.25} />
        <directionalLight position={[-3, 6, 4]} intensity={1.6} />
        <pointLight position={[4.5, 1.5, -2.5]} intensity={18} distance={12} color="#ff7a40" />
        <pointLight position={[3, -1, 5]} intensity={6} distance={14} color="#cfe9ec" />
        <Suspense fallback={null}>
          <Environment files={HDRI} environmentIntensity={0.9} />
          <Case />
        </Suspense>
      </Canvas>
    </div>
  );
}
