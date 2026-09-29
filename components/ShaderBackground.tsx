"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export type ShaderVariant = "home" | "features";

/** Full-screen triangle: positions are already in clip space. */
const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const COMMON = /* glsl */ `
varying vec2 vUv;
uniform float uTime;
uniform vec2 uResolution;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
`;

const HOME_FRAGMENT = /* glsl */ `${COMMON}
void main() {
  vec2 p = (vUv - 0.5) * vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
  float t = uTime * 0.12;

  float n = noise(p * 2.4 + vec2(t, -t * 0.6));
  n += 0.5 * noise(p * 5.2 - vec2(t * 1.4, t * 0.9));
  n /= 1.5;

  vec3 base = vec3(0.016, 0.020, 0.030);
  vec3 ice = vec3(0.69, 0.89, 1.0);
  float band = smoothstep(0.44, 0.96, n + 0.24 * sin(p.y * 3.0 + t * 2.0));
  float vign = smoothstep(1.30, 0.12, length(p * vec2(0.9, 1.3)));

  vec3 col = base + ice * band * 0.30 * vign;
  col += vec3(0.09, 0.13, 0.19) * (1.0 - vign) * 0.65;

  gl_FragColor = vec4(col, 1.0);
}
`;

const FEATURES_FRAGMENT = /* glsl */ `${COMMON}
void main() {
  vec2 p = (vUv - 0.5) * vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
  float t = uTime * 0.09;

  float n = noise(p * 1.7 - vec2(t * 0.8, t));
  n += 0.6 * noise(p * 4.1 + vec2(t * 1.1, -t * 0.7));
  n /= 1.6;

  vec3 base = vec3(0.022, 0.026, 0.038);
  vec3 glow = vec3(0.55, 0.72, 0.95);
  float band = smoothstep(0.40, 0.92, n + 0.20 * sin(p.x * 2.4 - t * 1.6));
  float vign = smoothstep(1.35, 0.10, length(p * vec2(1.05, 1.15)));

  vec3 col = base + glow * band * 0.26 * vign;
  col += vec3(0.06, 0.09, 0.15) * (1.0 - vign) * 0.7;

  gl_FragColor = vec4(col, 1.0);
}
`;

const FRAGMENTS: Record<ShaderVariant, string> = {
  home: HOME_FRAGMENT,
  features: FEATURES_FRAGMENT,
};

/**
 * Procedural background: slow ice-blue aurora on black.
 *
 * Falls back to the CSS radial gradient painted by `.shader-host` when WebGL
 * is unavailable, pauses when the tab is hidden, renders a single static frame
 * for `prefers-reduced-motion`, and disposes all GPU resources on unmount.
 */
export default function ShaderBackground({
  variant = "home",
}: {
  variant?: ShaderVariant;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return; // CSS fallback stays visible.
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(host.clientWidth || window.innerWidth, host.clientHeight || window.innerHeight);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.Camera();

    const uniforms = {
      uTime: { value: 0 },
      uResolution: {
        value: new THREE.Vector2(
          host.clientWidth || window.innerWidth,
          host.clientHeight || window.innerHeight,
        ),
      },
    };

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENTS[variant],
      uniforms,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);

    let frame = 0;
    let running = true;
    let time = 0;

    const renderFrame = () => {
      uniforms.uTime.value = time;
      renderer.render(scene, camera);
    };

    const loop = () => {
      if (!running) return;
      time += 0.05;
      renderFrame();
      frame = requestAnimationFrame(loop);
    };

    const onResize = () => {
      const width = host.clientWidth || window.innerWidth;
      const height = host.clientHeight || window.innerHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      uniforms.uResolution.value.set(width, height);
      if (reduced) renderFrame();
    };

    const onVisibility = () => {
      if (reduced) return;
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(frame);
      } else if (!running) {
        running = true;
        frame = requestAnimationFrame(loop);
      }
    };

    const onContextLost = (event: Event) => {
      event.preventDefault();
      running = false;
      cancelAnimationFrame(frame);
    };

    const onContextRestored = () => {
      if (reduced) {
        renderFrame();
        return;
      }
      running = true;
      frame = requestAnimationFrame(loop);
    };

    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);
    renderer.domElement.addEventListener("webglcontextrestored", onContextRestored);

    if (reduced) {
      renderFrame();
    } else {
      frame = requestAnimationFrame(loop);
    }

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, [variant]);

  return <div ref={hostRef} className="shader-host" aria-hidden="true" />;
}
