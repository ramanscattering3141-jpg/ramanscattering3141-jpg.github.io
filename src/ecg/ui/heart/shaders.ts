// GLSL for the 3-D heart. Everything is evaluated in the anatomy's rest frame (engine body frame,
// cm): activation/repolarisation times come from 3-D textures sampled with trilinear filtering, so
// wavefronts are smooth at any zoom and on the cut-away face.

export const COMMON = /* glsl */ `
precision highp sampler3D;
uniform float uT;
uniform sampler3D uVcur;
uniform sampler3D uVprev;
uniform sampler3D uAcur;
uniform sampler3D uAprev;
uniform sampler3D uInfo;
uniform float uVcurT;
uniform float uVprevT;
uniform float uAcurT;
uniform float uAprevT;
uniform vec3 uGmin;
uniform vec3 uGsize;
uniform float uACont;
uniform float uVCont;
uniform float uFlT0;
uniform float uFlCL;
uniform float uFlDir;
uniform vec3 uTVc;
uniform vec3 uE1;
uniform vec3 uE2;
uniform vec3 uB;
uniform vec3 uAx;
uniform vec3 uSx;
uniform float uApexU;
uniform vec3 uCentre;

vec3 gridTC(vec3 p) { return (p - uGmin) / uGsize; }

// Absolute (activation, repolarisation) times at p for the beat in progress.
vec2 actRep(vec3 p, bool atrial) {
  vec3 tc = gridTC(p);
  if (atrial) {
    vec2 c = texture(uAcur, tc).rg;
    float a = uAcurT + c.x;
    if (uT >= a) return vec2(a, uAcurT + c.y);
    vec2 q = texture(uAprev, tc).rg;
    return vec2(uAprevT + q.x, uAprevT + q.y);
  }
  vec2 c = texture(uVcur, tc).rg;
  float a = uVcurT + c.x;
  if (uT >= a) return vec2(a, uVcurT + c.y);
  vec2 q = texture(uVprev, tc).rg;
  return vec2(uVprevT + q.x, uVprevT + q.y);
}

// Time since local activation in a continuous atrial rhythm (flutter: macro-re-entry around the
// tricuspid annulus; fibrillation: wandering wavelets), and its action-potential duration.
vec2 atrialContinuous(vec3 p) {
  if (uACont < 1.5) {
    vec3 v = p - uTVc;
    float ang = atan(dot(v, uE2), dot(v, uE1));
    float ph = fract((uT - uFlT0) / uFlCL - uFlDir * ang / 6.2831853);
    return vec2(ph * uFlCL, 0.62 * uFlCL);
  }
  float q = sin(0.045 * uT + 2.6 * p.x) + sin(0.052 * uT + 2.2 * p.y + 1.0) + sin(0.061 * uT + 2.9 * p.z + 2.0);
  float ph = fract(q * 0.21 + 0.017 * uT);
  return vec2(ph * 150.0, 95.0);
}
vec2 ventContinuous(vec3 p) {
  float q = sin(0.04 * uT + 1.9 * p.x) + sin(0.047 * uT + 1.6 * p.y + 1.0) + sin(0.055 * uT + 2.2 * p.z + 2.0);
  float ph = fract(q * 0.19 + 0.0055 * uT);
  return vec2(ph * 180.0, 120.0);
}
`;

export const DEFORM = /* glsl */ `
uniform float uMotion;
uniform float uAmpV;
uniform float uAmpA;
uniform vec3 uRAc;
uniform vec3 uLAc;
uniform float uIsch;
uniform float uLvP;

float contraction(vec2 ar) {
  float tau = uT - ar.x;
  if (tau < 0.0 || ar.x > 1.0e7) return 0.0;
  float apd = ar.y - ar.x;
  float rise = smoothstep(12.0, 150.0, tau);
  float relax = 1.0 - smoothstep(apd + 10.0, apd + 140.0, tau);
  return rise * relax;
}

vec3 deform(vec3 p, float region, float depth) {
  if (uMotion < 0.5 || region < 0.5) return p;
  if (region > 4.5) {
    vec3 c = region < 5.5 ? uRAc : uLAc;
    if (uACont > 0.5) {
      float w = uACont > 1.5 ? 0.03 * sin(0.07 * uT + 3.0 * p.x) * sin(0.055 * uT + 2.6 * p.y) : 0.0;
      return p + normalize(p - c) * w;
    }
    float e = contraction(actRep(p, true)) * uAmpA;
    return c + (p - c) * (1.0 - 0.12 * e);
  }
  if (uVCont > 0.5) {
    float w = 0.035 * sin(0.05 * uT + 2.3 * p.x) * sin(0.043 * uT + 2.0 * p.y + 1.0);
    return p + normalize(p - uCentre) * w;
  }
  float zone = floor(texture(uInfo, gridTC(p)).g * 255.0 + 0.5);
  float e = contraction(actRep(p, false)) * uAmpV;
  if (zone > 1.5) e = uIsch > 2.5 && uIsch < 3.5 ? -0.35 * uLvP : 0.0;
  else if (zone > 0.5 && uIsch > 0.5 && uIsch < 2.5) e *= 0.25;
  float u = dot(p - uB, uAx);
  if (uIsch > 3.5 && region < 2.5) e *= u > uApexU * 0.42 ? 0.06 : 1.3;
  vec3 axisPt = uB + uAx * u;
  vec3 q;
  if (region > 2.5) q = p - uSx * (e * 0.36 * (0.55 + 0.45 * (1.0 - depth)));
  else q = axisPt + (p - axisPt) * (1.0 - e * (0.10 + 0.17 * (1.0 - depth)));
  return q + uAx * (e * 0.085 * max(0.0, uApexU - u));
}
`;

export const MYO_VERT = /* glsl */ `
${COMMON}
${DEFORM}
attribute float aRegion;
attribute float aDepth;
varying vec3 vRest;
varying vec3 vWorld;
varying vec3 vNormalV;
varying vec3 vViewPos;
flat varying float vRegion;
varying float vDepth;
void main() {
  vRest = position;
  vRegion = aRegion;
  vDepth = aDepth;
  vec3 q = deform(position, aRegion, aDepth);
  vec4 wp = modelMatrix * vec4(q, 1.0);
  vWorld = wp.xyz;
  vec4 mv = viewMatrix * wp;
  vViewPos = mv.xyz;
  vNormalV = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}
`;

export const MYO_FRAG = /* glsl */ `
${COMMON}
uniform float uMode;
uniform vec4 uCut;
uniform float uCutOn;
uniform vec4 uCutW;
uniform mat4 uInvGroup;
uniform vec3 uLeadAx;
uniform float uVmax;
uniform float uAmax;
uniform float uIschView;
layout(location = 0) out highp vec4 outColor;
varying vec3 vRest;
varying vec3 vWorld;
varying vec3 vNormalV;
varying vec3 vViewPos;
flat varying float vRegion;
varying float vDepth;

const vec3 C_REST = vec3(0.70, 0.43, 0.43);
const vec3 C_REST_A = vec3(0.74, 0.52, 0.50);
const vec3 C_FRONT = vec3(1.0, 0.98, 0.80);
const vec3 C_DEPOL = vec3(1.0, 0.62, 0.13);
const vec3 C_REPOL = vec3(0.32, 0.82, 0.96);
const vec3 C_SCAR = vec3(0.36, 0.36, 0.39);
const vec3 C_INJ = vec3(0.86, 0.32, 0.92);

float apV(float dt, float apd, float kind) {
  float rest = kind > 1.5 ? -80.0 : -86.0;
  if (dt < 0.0 || dt > apd + 400.0) return rest;
  float peak = kind > 1.5 ? 22.0 : 30.0;
  float plateau = kind > 1.5 ? -5.0 : (kind > 0.5 ? 8.0 : 15.0);
  float notch = kind > 1.5 ? 0.0 : (kind > 0.5 ? -2.0 : 10.0);
  float p3 = max(40.0, (kind > 1.5 ? 0.55 : 0.3) * apd);
  if (dt < 1.5) return rest + (peak - rest) * dt / 1.5;
  if (dt < 12.0) return peak + (notch - peak) * (dt - 1.5) / 10.5;
  float p3s = apd - p3;
  if (dt < p3s) { float u = (dt - 12.0) / max(1.0, p3s - 12.0); return notch + (plateau - notch) * min(1.0, u * 3.0) - 12.0 * u * u; }
  if (dt < apd) { float u = (dt - p3s) / p3; float top = plateau - 12.0; return top - (top - rest) * (0.5 - 0.5 * cos(3.14159265 * u)); }
  return rest;
}
vec3 ramp(float u) {
  // 0 deep blue → 1 red, through cyan, green, yellow (activation maps, membrane potential)
  u = clamp(u, 0.0, 1.0);
  vec3 c0 = vec3(0.13, 0.20, 0.58);
  vec3 c1 = vec3(0.12, 0.47, 0.90);
  vec3 c2 = vec3(0.16, 0.78, 0.82);
  vec3 c3 = vec3(0.48, 0.86, 0.36);
  vec3 c4 = vec3(1.00, 0.90, 0.30);
  vec3 c5 = vec3(1.00, 0.55, 0.14);
  vec3 c6 = vec3(0.90, 0.18, 0.15);
  float s = u * 6.0;
  if (s < 1.0) return mix(c0, c1, s);
  if (s < 2.0) return mix(c1, c2, s - 1.0);
  if (s < 3.0) return mix(c2, c3, s - 2.0);
  if (s < 4.0) return mix(c3, c4, s - 3.0);
  if (s < 5.0) return mix(c4, c5, s - 4.0);
  return mix(c5, c6, s - 5.0);
}
// rgb + emissive weight for the "electrical state" palette
vec4 stateColor(float dt, float apd, bool atrial) {
  vec3 rest = atrial ? C_REST_A : C_REST;
  if (dt < 0.0 || dt > apd + 170.0) return vec4(rest, 0.0);
  if (dt < 3.0) return vec4(C_FRONT, 0.85);
  if (dt < 10.0) return vec4(mix(C_FRONT, C_DEPOL, (dt - 3.0) / 7.0), 0.55);
  if (dt < apd - 45.0) return vec4(C_DEPOL, 0.18);
  if (dt < apd + 10.0) return vec4(mix(C_DEPOL, C_REPOL, (dt - apd + 45.0) / 55.0), 0.18);
  return vec4(mix(C_REPOL, rest, (dt - apd - 10.0) / 160.0), 0.15 * (1.0 - (dt - apd - 10.0) / 160.0));
}

void main() {
  if (uCutOn > 0.5 && dot(uCut.xyz, vRest) > uCut.w) discard;
  vec3 P = vRest;
  vec3 N = normalize(vNormalV);
  float region = vRegion;
  float depth = vDepth;
  bool cap = false;
  if (!gl_FrontFacing) {
    if (uCutOn > 0.5) {
      vec3 dir = normalize(vWorld - cameraPosition);
      float den = dot(uCutW.xyz, dir);
      float tt = abs(den) > 1e-5 ? (uCutW.w - dot(uCutW.xyz, cameraPosition)) / den : 0.0;
      vec3 pw = cameraPosition + dir * tt;
      P = (uInvGroup * vec4(pw, 1.0)).xyz;
      cap = true;
      float r = floor(texture(uInfo, gridTC(P)).r * 255.0 + 0.5);
      if (r > 0.5) region = r;
      depth = 0.5;
      N = normalize((viewMatrix * vec4(uCutW.xyz, 0.0)).xyz);
      if (N.z < 0.0) N = -N;
    } else N = -N;
  }
  bool atrial = region > 4.5;
  vec4 inf = texture(uInfo, gridTC(P));
  float zone = floor(inf.g * 255.0 + 0.5);
  float cor = floor(inf.b * 255.0 + 0.5);
  vec2 ar;
  float dt;
  float apd;
  bool cont = atrial ? uACont > 0.5 : uVCont > 0.5;
  if (cont) {
    vec2 c = atrial ? atrialContinuous(P) : ventContinuous(P);
    dt = c.x;
    apd = c.y;
    ar = vec2(uT - dt, uT - dt + apd);
  } else {
    ar = actRep(P, atrial);
    dt = uT - ar.x;
    apd = ar.y - ar.x;
  }
  vec3 base;
  float emis = 0.0;
  if (uMode < 0.5) {
    vec4 sc = stateColor(dt, apd, atrial);
    base = sc.rgb;
    emis = sc.a;
  } else if (uMode < 1.5) {
    float mv = apV(dt, apd, atrial ? 2.0 : (depth > 0.5 ? 1.0 : 0.0));
    base = ramp((mv + 90.0) / 120.0);
    emis = 0.35;
  } else if (uMode < 2.5) {
    float rel = ar.x - (atrial ? uAcurT : uVcurT);
    if (uT < (atrial ? uAcurT : uVcurT)) rel = 1e5;
    if (rel > 4000.0 || rel < -1.0 || cont) base = atrial ? C_REST_A * 0.75 : vec3(0.45, 0.45, 0.48);
    else {
      float mx = atrial ? uAmax : uVmax;
      base = ramp(1.0 - rel / max(1.0, mx));
      float f = rel / 10.0;
      float fw = max(fwidth(f), 1e-3);
      float d = min(fract(f), 1.0 - fract(f));
      base *= 1.0 - 0.5 * (1.0 - smoothstep(0.0, 1.6 * fw, d));
      emis = 0.3;
    }
  } else if (uMode < 3.5) {
    float mv = apV(dt, apd, atrial ? 2.0 : (depth > 0.5 ? 1.0 : 0.0));
    bool inAP = dt >= 0.0 && dt < apd;
    if (inAP && (dt < apd * 0.7 || mv > -60.0)) base = vec3(0.80, 0.16, 0.20);
    else if (dt >= 0.0 && dt < apd + 25.0) base = vec3(1.0, 0.76, 0.18);
    else base = vec3(0.15, 0.66, 0.60);
    emis = 0.25;
  } else if (uMode < 4.5) {
    base = atrial ? vec3(0.55, 0.55, 0.60) : cor < 1.5 ? vec3(0.25, 0.52, 0.96) : cor < 2.5 ? vec3(0.10, 0.72, 0.64) : vec3(0.98, 0.62, 0.11);
  } else {
    float f = dot(normalize(P - uCentre), uLeadAx);
    vec3 neutral = vec3(0.56, 0.52, 0.54);
    base = atrial ? vec3(0.50, 0.50, 0.55) : f > 0.35 ? mix(neutral, vec3(0.10, 0.75, 0.55), min(1.0, (f - 0.35) / 0.45)) : f < -0.35 ? mix(neutral, vec3(0.90, 0.25, 0.55), min(1.0, (-f - 0.35) / 0.45)) : neutral;
  }
  if (!atrial && zone > 1.5 && (uMode < 3.5 || uMode > 4.5)) {
    base = C_SCAR;
    emis = 0.0;
  } else if (!atrial && zone > 0.5 && uIschView > 0.5 && (uMode < 1.5)) {
    float hatch = step(mod(gl_FragCoord.x + gl_FragCoord.y, 9.0), 3.0);
    base = mix(base, C_INJ, 0.35 + 0.35 * hatch);
  }
  vec3 V = normalize(-vViewPos);
  vec3 L = normalize(vec3(0.35, 0.65, 0.9));
  float diff = max(dot(N, L), 0.0);
  float hemi = 0.5 + 0.5 * N.y;
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 36.0) * 0.22;
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.25;
  // Inner (endocardial) surfaces are seen from inside a cavity: darker, so cavities read as hollow.
  float inner = 1.0 - 0.38 * (1.0 - smoothstep(0.08, 0.45, depth));
  vec3 lit = base * (0.26 + 0.16 * hemi + 0.62 * diff) * inner + vec3(spec) + rim * vec3(0.5, 0.6, 0.8);
  vec3 col;
  if (cap) {
    // The cut face: flat and bright, a clean cross-section of the wall.
    col = mix(base * 1.08, base * 1.18 + 0.06, emis);
  } else {
    col = mix(lit, base * 1.02, emis);
  }
  if (!gl_FrontFacing && !cap) col *= 0.7;
  outColor = vec4(col, 1.0);
}
`;

export const TRACT_VERT = /* glsl */ `
${COMMON}
${DEFORM}
varying vec2 vUv;
varying vec3 vNormalV;
void main() {
  vUv = uv;
  float r = floor(texture(uInfo, gridTC(position)).r * 255.0 + 0.5);
  vec3 q = deform(position, r, 0.0);
  vNormalV = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(q, 1.0);
}
`;

export const TRACT_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uProg;
uniform float uState;
uniform float uOpacity;
layout(location = 0) out highp vec4 outColor;
varying vec2 vUv;
varying vec3 vNormalV;
void main() {
  vec3 c = uColor;
  float shade = 0.72 + 0.28 * max(normalize(vNormalV).z, 0.0);
  if (uState > 0.5 && uState < 1.5) {
    float d = vUv.x - uProg;
    if (d <= 0.0) c = mix(c, vec3(1.0, 0.97, 0.72), 0.9 * exp(d * 3.5));
    if (abs(d) < 0.05) c = vec3(1.0);
    shade = 1.0;
  } else if (uState > 1.5 && uState < 2.5) {
    c = vec3(1.0, 0.24, 0.30);
    shade = 1.0;
  } else if (uState > 2.5) {
    c = mix(c, vec3(1.0, 0.97, 0.72), 0.5);
  }
  outColor = vec4(c * shade, uOpacity);
}
`;
