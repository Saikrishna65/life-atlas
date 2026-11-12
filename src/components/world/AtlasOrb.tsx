"use client";
import { useEffect, useRef } from "react";
export default function AtlasOrb({
  state,
}: {
  state: "idle" | "thinking" | "response";
}) {
  const root = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    const container = root.current;
    if (!container) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    import("three")
      .then((THREE) => {
        if (disposed) return;
        let renderer: InstanceType<typeof THREE.WebGLRenderer>;
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("webgl2", {
          alpha: true,
          antialias: window.devicePixelRatio < 2,
          powerPreference: "low-power",
        });
        if (!context) return;
        try {
          renderer = new THREE.WebGLRenderer({
            canvas,
            context,
            alpha: true,
            antialias: window.devicePixelRatio < 2,
            powerPreference: "low-power",
          });
        } catch {
          return;
        }
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 30);
        camera.position.z = 4.7;
        renderer.setPixelRatio(
          Math.min(
            window.devicePixelRatio,
            window.innerWidth < 768 ? 1.25 : 1.75,
          ),
        );
        renderer.setClearColor(0, 0);
        container.appendChild(renderer.domElement);
        renderer.domElement.setAttribute("aria-hidden", "true");
        container.dataset.ready = "true";
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
        const uniforms = {
          uTime: { value: 0 },
          uPointer: { value: new THREE.Vector2(0, 0) },
          uState: { value: 0 },
        };
        const material = new THREE.ShaderMaterial({
          uniforms,
          vertexShader: `uniform float uTime;uniform float uState;varying vec3 vNormal;varying vec3 vPosition;varying vec3 vView;
void main(){float drift=sin(position.x*3.2+sin(position.y*2.8+uTime*.28))*sin(position.y*3.8-uTime*.23)*sin(position.z*3.1+uTime*.19);vec3 p=position+normal*drift*(.028+uState*.055);vec4 view=modelViewMatrix*vec4(p,1.);vView=-view.xyz;vPosition=p;vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*view;}`,
          fragmentShader: `uniform float uTime;uniform vec2 uPointer;uniform float uState;varying vec3 vNormal;varying vec3 vPosition;varying vec3 vView;
void main(){vec3 n=normalize(vNormal);vec3 v=normalize(vView);vec3 l=normalize(vec3(-.7+uPointer.x*.5,.9+uPointer.y*.5,1.2));float fresnel=pow(1.-max(dot(n,v),0.),2.7);vec3 p=vPosition;float warp=sin(p.x*3.8+sin(p.z*3.+uTime*.23)*1.7)+cos(p.y*3.2-sin(p.x*2.5-uTime*.18));float flow=smoothstep(-.3,.9,warp);vec3 ink=vec3(.015,.048,.19);vec3 cobalt=vec3(.055,.22,.8);vec3 pearl=vec3(.88,.94,1.);float diffuse=max(dot(n,l),0.);float spec=pow(max(dot(n,normalize(l+v)),0.),65.);float ribbon=pow(max(sin(p.y*2.3+p.x*1.7+warp*.6+uTime*.12),0.),9.);vec3 color=mix(ink,cobalt,.25+flow*.55);color=mix(color,pearl,pow(diffuse,3.)*.67+ribbon*.27);color+=pearl*spec*.95;color=mix(color,pearl,fresnel*.78);color+=vec3(.02,.07,.24)*uState;gl_FragColor=vec4(color,1.);}`,
        });
        const geometry = new THREE.SphereGeometry(
          1.12,
          window.innerWidth < 768 ? 48 : 80,
          48,
        );
        const orb = new THREE.Mesh(geometry, material);
        scene.add(orb);
        const ringGeometry = new THREE.TorusGeometry(1.58, 0.0025, 4, 128);
        const ringMaterial = new THREE.MeshBasicMaterial({
          color: 0x5b87ff,
          transparent: true,
          opacity: 0.25,
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = 1.2;
        ring.rotation.z = 0.4;
        scene.add(ring);
        const count = 80,
          positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          const a = i * 2.39996,
            r = 1.7 + (i % 7) * 0.045;
          positions[i * 3] = Math.cos(a) * r;
          positions[i * 3 + 1] = Math.sin(a) * r;
          positions[i * 3 + 2] = Math.sin(i * 0.7) * 0.6;
        }
        const particleGeometry = new THREE.BufferGeometry();
        particleGeometry.setAttribute(
          "position",
          new THREE.BufferAttribute(positions, 3),
        );
        const particleMaterial = new THREE.PointsMaterial({
          color: 0xdce7ff,
          size: 0.016,
          transparent: true,
          opacity: 0.65,
        });
        const particles = new THREE.Points(particleGeometry, particleMaterial);
        scene.add(particles);
        let frame = 0,
          visible = false;
        const started = performance.now();
        let impulse = 0;
        const render = (time: number) => {
          frame = 0;
          if (disposed) return;
          const t = reduced.matches ? 0 : (time - started) / 1000;
          uniforms.uTime.value = t;
          const targetState =
            (stateRef.current === "thinking"
              ? 1
              : stateRef.current === "response"
                ? 0.4
                : 0) +
            impulse * 0.6;
          uniforms.uState.value += (targetState - uniforms.uState.value) * 0.1;
          impulse *= 0.92;
          orb.rotation.y = t * 0.05 + uniforms.uPointer.value.x * 0.15;
          orb.rotation.x = uniforms.uPointer.value.y * 0.1;
          ring.rotation.z = 0.4 + t * 0.025;
          particles.rotation.z = -t * 0.015;
          renderer.render(scene, camera);
          if (visible && !document.hidden && !reduced.matches)
            frame = requestAnimationFrame(render);
        };
        const request = () => {
          if (!frame) frame = requestAnimationFrame(render);
        };
        const resize = new ResizeObserver(() => {
          const w = container.clientWidth,
            h = container.clientHeight;
          renderer.setSize(w, h);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          request();
        });
        resize.observe(container);
        const observer = new IntersectionObserver(
          ([entry]) => {
            visible = entry.isIntersecting;
            if (visible) request();
            else {
              cancelAnimationFrame(frame);
              frame = 0;
            }
          },
          { threshold: 0.05 },
        );
        observer.observe(container);
        const pointer = (e: PointerEvent) => {
          const rect = container.getBoundingClientRect();
          uniforms.uPointer.value.set(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -(((e.clientY - rect.top) / rect.height) * 2 - 1),
          );
          request();
        };
        const leave = () => {
          uniforms.uPointer.value.set(0, 0);
          request();
        };
        const visibility = () => {
          if (document.hidden) {
            cancelAnimationFrame(frame);
            frame = 0;
          } else if (visible) request();
        };
        const touch = () => {
          impulse = 1;
          request();
        };
        container.addEventListener("pointerdown", touch, { passive: true });
        container.addEventListener("pointermove", pointer);
        container.addEventListener("pointerleave", leave);
        document.addEventListener("visibilitychange", visibility);
        reduced.addEventListener("change", request);
        cleanup = () => {
          cancelAnimationFrame(frame);
          resize.disconnect();
          observer.disconnect();
          container.removeEventListener("pointerdown", touch);
          container.removeEventListener("pointermove", pointer);
          container.removeEventListener("pointerleave", leave);
          document.removeEventListener("visibilitychange", visibility);
          reduced.removeEventListener("change", request);
          geometry.dispose();
          material.dispose();
          ringGeometry.dispose();
          ringMaterial.dispose();
          particleGeometry.dispose();
          particleMaterial.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };
      })
      .catch(() => {});
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);
  return (
    <div
      className="atlas-orb"
      ref={root}
      role="img"
      aria-label="Interactive Atlas orb. Move a pointer or touch to shift its light."
    >
      <div className="orb-css-fallback" />
      <span className="orb-coordinate">
        ATLAS / A LITTLE CURIOSITY, GIVEN FORM
      </span>
    </div>
  );
}
