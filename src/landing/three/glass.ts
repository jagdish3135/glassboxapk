import * as THREE from 'three';

export interface Glass {
  material: THREE.MeshPhysicalMaterial;
  /** 0 → 1: fades the whole case (used when the box cracks and re-forms). */
  setFade: (v: number) => void;
}

/**
 * Thin display-case glass without a transmission pass: the faces stay almost clear, the edges and
 * grazing angles brighten (a Fresnel term on alpha and colour), and studio reflections ride on top.
 * The robot behind it stays sharp, and it costs one transparent draw instead of a second render
 * of the whole scene.
 */
export function createGlass(): Glass {
  const material = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.04,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.1,
    transparent: true,
    opacity: 0.025,
    depthWrite: false,
  });
  const uniforms = {
    uFade: { value: 1 },
    uRim: { value: new THREE.Color('#bfeff5') },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = `uniform float uFade;\nuniform vec3 uRim;\n${shader.fragmentShader}`.replace(
      '#include <opaque_fragment>',
      /* glsl */ `
      float glassFres = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 4.0);
      outgoingLight += uRim * glassFres * 0.35;
      diffuseColor.a = clamp(diffuseColor.a + glassFres * 0.42, 0.0, 1.0) * uFade;
      #include <opaque_fragment>`,
    );
  };
  material.customProgramCacheKey = () => 'glassbox-case';
  return {
    material,
    setFade: (v) => {
      uniforms.uFade.value = v;
      material.visible = v > 0.005;
    },
  };
}
