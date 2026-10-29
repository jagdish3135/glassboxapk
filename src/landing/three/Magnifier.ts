import { Effect } from 'postprocessing';
import { Uniform, Vector2 } from 'three';

// A round lens that zooms the rendered frame under the cursor. It runs inside the
// postprocessing chain, so it costs one UV remap per pixel and no extra render target.
const fragmentShader = /* glsl */ `
uniform vec2 uCenter;
uniform float uRadius;
uniform float uZoom;
uniform float uStrength;
uniform float uAspect;

float lensMask(vec2 uv) {
  vec2 d = uv - uCenter;
  d.x *= uAspect;
  return 1.0 - smoothstep(uRadius * 0.9, uRadius, length(d));
}

void mainUv(inout vec2 uv) {
  float m = lensMask(uv) * uStrength;
  uv = mix(uv, uCenter + (uv - uCenter) / uZoom, m);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 d = uv - uCenter;
  d.x *= uAspect;
  float r = length(d);
  // A faint glass rim, brighter on the top-left like a lens catching light.
  float rim = smoothstep(uRadius * 0.86, uRadius * 0.98, r) * (1.0 - smoothstep(uRadius * 0.98, uRadius * 1.02, r));
  float sheen = clamp(0.5 - d.x / uRadius * 0.5 + d.y / uRadius * 0.5, 0.0, 1.0);
  outputColor = vec4(inputColor.rgb + vec3(0.55, 0.9, 0.95) * rim * (0.25 + 0.35 * sheen) * uStrength, inputColor.a);
}
`;

export class MagnifierEffect extends Effect {
  constructor() {
    super('MagnifierEffect', fragmentShader, {
      uniforms: new Map<string, Uniform>([
        ['uCenter', new Uniform(new Vector2(0.5, 0.5))],
        ['uRadius', new Uniform(0.08)],
        ['uZoom', new Uniform(1.55)],
        ['uStrength', new Uniform(0)],
        ['uAspect', new Uniform(1)],
      ]),
    });
  }
}
