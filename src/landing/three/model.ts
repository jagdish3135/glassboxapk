import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const BASE = import.meta.env.BASE_URL;
export const GLB = `${BASE}landing/glassbox.glb`;
// 512 x 256 is plenty for reflections, and a quarter of the 1k file's size.
export const HDRI = `${BASE}landing/studio_small_09_512.hdr`;

export interface GlassModel {
  /** The glass case (rendered separately with MeshTransmissionMaterial). */
  shellGeo: THREE.BufferGeometry;
  shellMatrix: THREE.Matrix4;
  /** The Android robot inside the case. */
  robot: THREE.Group;
  /** Head pivot (dome, antennae, eyes) at the base of the dome; it looks at the cursor. */
  head: THREE.Group | null;
  /** Arms, with their origin at the shoulder so rotating them swings from there. */
  arms: THREE.Object3D[];
}

/** Loads the glass box GLB and splits it into the shell and the robot (one clone per caller). */
export function useGlassModel(): GlassModel {
  // Meshopt-compressed: the decoder ships inside the JS bundle, no extra WASM download.
  const gltf = useGLTF(GLB, false, true);
  return useMemo(() => {
    const root = gltf.scene.clone(true);
    root.updateMatrixWorld(true);
    let geo: THREE.BufferGeometry | null = null;
    const matrix = new THREE.Matrix4();
    const drop: THREE.Object3D[] = [];
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat.name === 'Glass') { geo = m.geometry; matrix.copy(m.matrixWorld); drop.push(m); return; }
      if (mat.name === 'Eyes') { mat.toneMapped = false; mat.emissiveIntensity = 2.2; }
      if (mat.name === 'Android') { mat.envMapIntensity = 1.15; mat.roughness = 0.34; }
    });
    drop.forEach((m) => m.parent?.remove(m));

    const head = new THREE.Group();
    const dome = root.getObjectByName('Head');
    if (dome) {
      const box = new THREE.Box3().setFromObject(dome);
      head.position.set((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2);
      root.add(head);
      root.updateMatrixWorld(true);
      ['Head', 'AntennaL', 'AntennaR', 'EyeL', 'EyeR'].forEach((n) => {
        const part = root.getObjectByName(n);
        if (part) head.attach(part);
      });
    }
    const arms = ['ArmL', 'ArmR'].map((n) => root.getObjectByName(n)).filter(Boolean) as THREE.Object3D[];
    const robot = new THREE.Group();
    robot.add(root);
    return { shellGeo: geo as unknown as THREE.BufferGeometry, shellMatrix: matrix, robot, head: dome ? head : null, arms };
  }, [gltf]);
}

// Scratch objects for animateRobot (no allocations per frame).
const _ray = new THREE.Raycaster();
const _plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -2.2);
const _target = new THREE.Vector3();
const _prev = new THREE.Quaternion();
const _look = new THREE.Quaternion();
const _id = new THREE.Quaternion();

/**
 * The robot comes alive: its head eases toward the point under the cursor, its arms sway, and
 * the right arm waves while `wave` is on. `rest` (0..1) blends everything back to standing still.
 */
export function animateRobot(m: GlassModel, pointer: THREE.Vector2, camera: THREE.Camera, t: number, dt: number, rest = 0, wave = 0) {
  if (m.head) {
    _ray.setFromCamera(pointer, camera);
    if (_ray.ray.intersectPlane(_plane, _target)) {
      _prev.copy(m.head.quaternion);
      m.head.lookAt(_target);
      _look.copy(m.head.quaternion).slerp(_id, rest);
      m.head.quaternion.copy(_prev).slerp(_look, 1 - Math.pow(0.003, dt));
    }
  }
  const [left, right] = m.arms;
  const sway = Math.sin(t * 1.3) * 0.14 * (1 - rest);
  if (left) left.rotation.x = sway;
  if (right) {
    right.rotation.x = -sway * (1 - wave);
    // Raise the arm out to the side (around the forward axis) and wave it.
    const target = wave * (2.3 + Math.sin(t * 9) * 0.35);
    right.rotation.z += (target - right.rotation.z) * (1 - Math.pow(0.002, dt));
  }
}

useGLTF.preload(GLB, false, true);
