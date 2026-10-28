export const SKY_VERTEX_SHADER = `
  varying vec3 vWorldDir;
  void main() {
    vWorldDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const SKY_FRAGMENT_SHADER = `
  varying vec3 vWorldDir;
  uniform vec3 uSunDir;
  uniform float uTime;

  // 3D Simplex / Gradient Noise for natural organic clouds
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  // Multi-octave Fractal Brownian Motion for natural organic clouds
  float fbm(vec3 p) {
    float total = 0.0;
    float amp = 0.52;
    float freq = 1.0;
    for (int i = 0; i < 4; i++) {
      total += snoise(p * freq) * amp;
      freq *= 2.15;
      amp *= 0.48;
    }
    return total;
  }

  void main() {
    vec3 dir = normalize(vWorldDir);
    float z = dir.z;

    vec3 cZenith = vec3(0.07, 0.35, 0.72);
    vec3 cMidSky = vec3(0.24, 0.58, 0.92);
    vec3 cLowSky = vec3(0.56, 0.79, 0.98);
    vec3 cHorizon = vec3(0.82, 0.90, 0.97);
    vec3 cGround  = vec3(0.55, 0.65, 0.59);

    vec3 skyColor;
    if (z >= 0.0) {
      float h = pow(z, 0.65);
      if (h < 0.25) {
        skyColor = mix(cHorizon, cLowSky, h / 0.25);
      } else if (h < 0.70) {
        skyColor = mix(cLowSky, cMidSky, (h - 0.25) / 0.45);
      } else {
        skyColor = mix(cMidSky, cZenith, (h - 0.70) / 0.30);
      }
    } else {
      float d = clamp(-z * 18.0, 0.0, 1.0);
      skyColor = mix(cHorizon, cGround, d);
    }

    float cosTheta = dot(dir, uSunDir);
    if (cosTheta > 0.0) {
      float forwardScatter = pow(cosTheta, 3.8) * 0.28;
      vec3 sunHaze = vec3(1.0, 0.88, 0.68) * forwardScatter;
      float corona = pow(cosTheta, 28.0) * 0.65;
      vec3 coronaColor = vec3(1.0, 0.94, 0.78) * corona;
      float disc = smoothstep(0.9992, 0.9998, cosTheta);
      vec3 discColor = vec3(1.0, 1.0, 0.95) * (disc * 3.5);
      skyColor += sunHaze + coronaColor + discColor;
    }

    if (z > 0.015) {
      float cloudDist = 1.0 / max(0.08, z);
      vec2 cloudCoord = dir.xy * cloudDist * 0.42;
      vec3 p = vec3(cloudCoord * 0.95, uTime * 0.003 + 12.4);

      float n = fbm(p);
      float nFiner = snoise(vec3(cloudCoord * 2.8, uTime * 0.006));
      float cloudShape = n * 0.80 + nFiner * 0.20;

      float coverage = 0.08;
      float density = smoothstep(coverage, coverage + 0.42, cloudShape);
      float horizonFade = smoothstep(0.015, 0.18, z);
      density *= horizonFade;

      if (density > 0.001) {
        float sunIllum = max(0.0, dot(dir, uSunDir));
        vec3 cloudHighlight = mix(vec3(1.0, 0.98, 0.94), vec3(1.0, 0.92, 0.75), pow(sunIllum, 2.0));
        vec3 cloudShadow = mix(vec3(0.68, 0.78, 0.88), vec3(0.78, 0.85, 0.92), z);
        float lightDiff = clamp(cloudShape * 1.5 + sunIllum * 0.35, 0.0, 1.0);
        vec3 cloudFinalColor = mix(cloudShadow, cloudHighlight, lightDiff);
        skyColor = mix(skyColor, cloudFinalColor, density * 0.88);
      }
    }

    if (z >= -0.015 && z < 0.075) {
      float azimuth = atan(dir.y, dir.x);
      float ridge1 = 0.012 + sin(azimuth * 3.7 + 1.2) * 0.010 
                           + sin(azimuth * 8.3 - 0.4) * 0.007 
                           + cos(azimuth * 19.1 + 2.1) * 0.004
                           + sin(azimuth * 37.0) * 0.002;
      
      if (z < ridge1) {
        float mHeight = clamp((ridge1 - z) / ridge1, 0.0, 1.0);
        vec3 farMtnColor = mix(vec3(0.48, 0.62, 0.76), vec3(0.38, 0.50, 0.64), mHeight);
        float mtnFog = smoothstep(0.0, 0.035, ridge1 - z);
        skyColor = mix(skyColor, farMtnColor, mtnFog * 0.75);
      }

      float ridge2 = 0.006 + sin(azimuth * 5.2 + 2.8) * 0.006 
                           + cos(azimuth * 12.7 + 1.1) * 0.003
                           + sin(azimuth * 27.5) * 0.0015;
      if (z < ridge2) {
        float fHeight = clamp((ridge2 - z) / max(0.001, ridge2), 0.0, 1.0);
        vec3 nearMtnColor = mix(vec3(0.42, 0.54, 0.58), vec3(0.32, 0.44, 0.46), fHeight);
        float nearFog = smoothstep(0.0, 0.02, ridge2 - z);
        skyColor = mix(skyColor, nearMtnColor, nearFog * 0.82);
      }
    }

    gl_FragColor = vec4(skyColor, 1.0);
  }
`;

