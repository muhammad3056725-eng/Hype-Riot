// HYPE RIOT GLSL (Blueprint §3): Bayer 4x4 dither transition + CRT
// overlay shaders for the WebGL2 path. The Renderer ships a canvas
// fallback implementing the identical Bayer math when WebGL2 is
// unavailable (low-end devices, test environments).

export const DITHER_TRANSITION_FS = `#version 300 es
precision highp float;
uniform sampler2D uOld;
uniform sampler2D uNew;
uniform float uProgress;
in vec2 vUv;
out vec4 fragColor;
float bayer4(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  int idx = x + y * 4;
  float m[16];
  m[0]=0.0; m[1]=8.0; m[2]=2.0; m[3]=10.0;
  m[4]=12.0; m[5]=4.0; m[6]=14.0; m[7]=6.0;
  m[8]=3.0; m[9]=11.0; m[10]=1.0; m[11]=9.0;
  m[12]=15.0; m[13]=7.0; m[14]=13.0; m[15]=5.0;
  for (int i = 0; i < 16; i++) { if (i == idx) return m[i] / 16.0; }
  return 0.0;
}
void main() {
  vec4 a = texture(uOld, vUv);
  vec4 b = texture(uNew, vUv);
  float t = bayer4(gl_FragCoord.xy);
  fragColor = (t < uProgress) ? b : a;
}
`;

export const CRT_FS = `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform float uScanline; // 0 off, 0.15 subtle, 0.35 arcade
uniform float uTime;
in vec2 vUv;
out vec4 fragColor;
void main() {
  vec2 uv = vUv;
  // gentle barrel curvature
  vec2 d = uv - 0.5;
  uv = uv + d * dot(d, d) * 0.08;
  vec4 c = texture(uScene, uv);
  float scan = 1.0 - uScanline * (0.5 + 0.5 * sin(uv.y * 540.0 * 3.14159));
  float vig = 1.0 - 0.25 * dot(d, d) * 2.0;
  fragColor = vec4(c.rgb * scan * vig, c.a);
}
`;

export const QUAD_VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export function webgl2Available(canvas: HTMLCanvasElement): boolean {
  try {
    return !!canvas.getContext("webgl2");
  } catch {
    return false;
  }
}
