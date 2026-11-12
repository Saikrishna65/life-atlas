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
          vertexShader: `uniform float uTime; uniform vec2 uPointer; uniform float uState; varying vec3 vNormal; varying vec3 vPosition;
void main(){vNormal=normalize(normalMatrix*normal);float wave=sin(position.x*5.+uTime*.5)*sin(position.y*4.-uTime*.4)*sin(position.z*5.+uTime*.3);vec3 p=position+normal*wave*(.045+uState*.035);vPosition=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
          fragmentShader: `uniform float uTime;uniform vec2 uPointer;uniform float uState;varying vec3 vNormal;varying vec3 vPosition;
void main(){vec3 n=normalize(vNormal);float fresnel=pow(1.-max(dot(n,vec3(0.,0.,1.)),0.),2.2);float flow=sin(vPosition.y*18.+sin(vPosition.x*8.+uTime*.3)*2.+uTime*.4);float bands=smoothstep(.5,1.,flow);vec3 dark=vec3(.018,.052,.075);vec3 teal=vec3(.28,.64,.65);vec3 cream=vec3(.91,.83,.63);float light=max(dot(n,normalize(vec3(-.6+uPointer.x*.5,.8+uPointer.y*.5,1.))),0.);vec3 color=mix(dark,teal,light*.4+bands*.16);color=mix(color,cream,fresnel*.9);color+=pow(max(dot(reflect(normalize(vec3(-1.,1.,1.)),n),vec3(0.,0.,-1.)),0.),28.)*.4;gl_FragColor=vec4(color,1.);}`,
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
          color: 0x88b7b4,
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
          color: 0xc3d2c4,
          size: 0.016,
          transparent: true,
          opacity: 0.65,
        });
        const particles = new THREE.Points(particleGeometry, particleMaterial);
        scene.add(particles);
        let frame = 0,
          visible = false;
        const started = performance.now();
        const render = (time: number) => {
          frame = 0;
          if (disposed) return;
          const t = reduced.matches ? 0 : (time - started) / 1000;
          uniforms.uTime.value = t;
          uniforms.uState.value +=
            (stateRef.current === "thinking"
              ? 1
              : stateRef.current === "response"
                ? 0.4
                : 0) - uniforms.uState.value;
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
        container.addEventListener("pointermove", pointer);
        container.addEventListener("pointerleave", leave);
        document.addEventListener("visibilitychange", visibility);
        reduced.addEventListener("change", request);
        cleanup = () => {
          cancelAnimationFrame(frame);
          resize.disconnect();
          observer.disconnect();
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
