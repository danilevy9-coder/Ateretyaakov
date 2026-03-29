'use client';

import { useRef, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// ── Particle Field ──────────────────────────────────────────────
function ParticleField() {
  const meshRef = useRef<THREE.Points>(null);
  const { mouse, viewport } = useThree();
  const count = 2200;

  const { positions, velocities, originalPositions } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const originalPositions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const x = (Math.random() - 0.5) * 14;
      const y = (Math.random() - 0.5) * 10;
      const z = (Math.random() - 0.5) * 8;
      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;
      originalPositions[i3] = x;
      originalPositions[i3 + 1] = y;
      originalPositions[i3 + 2] = z;
      velocities[i3] = (Math.random() - 0.5) * 0.002;
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.002;
      velocities[i3 + 2] = 0;
    }
    return { positions, velocities, originalPositions };
  }, [count]);

  // Gold + white color mix
  const colors = useMemo(() => {
    const cols = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const isGold = Math.random() > 0.55;
      if (isGold) {
        cols[i3] = 0.83;   // R
        cols[i3 + 1] = 0.69; // G
        cols[i3 + 2] = 0.22; // B
      } else {
        const brightness = 0.5 + Math.random() * 0.5;
        cols[i3] = brightness;
        cols[i3 + 1] = brightness;
        cols[i3 + 2] = brightness;
      }
    }
    return cols;
  }, [count]);

  const sizes = useMemo(() => {
    const s = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      s[i] = Math.random() * 3 + 0.5;
    }
    return s;
  }, [count]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const time = clock.getElapsedTime();
    const posArray = meshRef.current.geometry.attributes.position.array as Float32Array;
    const mx = mouse.x * viewport.width * 0.4;
    const my = mouse.y * viewport.height * 0.4;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // Gentle drift + sin wave
      posArray[i3] =
        originalPositions[i3] +
        Math.sin(time * 0.3 + i * 0.005) * 0.15 +
        (mx - posArray[i3]) * 0.0008;
      posArray[i3 + 1] =
        originalPositions[i3 + 1] +
        Math.cos(time * 0.2 + i * 0.007) * 0.12 +
        (my - posArray[i3 + 1]) * 0.0008;
    }
    meshRef.current.geometry.attributes.position.needsUpdate = true;
    meshRef.current.rotation.y = Math.sin(time * 0.05) * 0.06;
    meshRef.current.rotation.x = Math.cos(time * 0.04) * 0.04;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
          count={count}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          args={[sizes, 1]}
          count={count}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        vertexColors
        transparent
        opacity={0.7}
        sizeAttenuation
        size={0.04}
        depthWrite={false}
      />
    </points>
  );
}

// ── Ambient Light Orbs ────────────────────────────────────────
function AmbientOrbs() {
  const orb1 = useRef<THREE.Mesh>(null);
  const orb2 = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (orb1.current) {
      orb1.current.position.x = Math.sin(t * 0.4) * 3;
      orb1.current.position.y = Math.cos(t * 0.3) * 2;
    }
    if (orb2.current) {
      orb2.current.position.x = Math.cos(t * 0.25) * 4;
      orb2.current.position.y = Math.sin(t * 0.35) * 2.5;
    }
  });

  return (
    <>
      <mesh ref={orb1} position={[2, 1, -3]}>
        <sphereGeometry args={[1.8, 32, 32]} />
        <meshBasicMaterial
          color="#D4AF37"
          transparent
          opacity={0.04}
        />
      </mesh>
      <mesh ref={orb2} position={[-2, -1, -4]}>
        <sphereGeometry args={[2.2, 32, 32]} />
        <meshBasicMaterial
          color="#1a3352"
          transparent
          opacity={0.06}
        />
      </mesh>
    </>
  );
}

// ── Main Canvas Export ────────────────────────────────────────
export default function HeroCanvas() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 65 }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      }}
      dpr={[1, 1.5]}
      className="absolute inset-0"
      style={{ background: 'transparent' }}
    >
      <ParticleField />
      <AmbientOrbs />
    </Canvas>
  );
}
