'use client';

import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

export default function CustomCursor() {
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  const isHovering = useRef(false);
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  // Dot tracks nearly instantly — high stiffness, low damping
  const springConfig = { damping: 18, stiffness: 2500 };
  const springX = useSpring(cursorX, springConfig);
  const springY = useSpring(cursorY, springConfig);

  // Ring trails slightly behind for the "aura" effect but stays snappy
  const ringSpringConfig = { damping: 22, stiffness: 600 };
  const ringX = useSpring(cursorX, ringSpringConfig);
  const ringY = useSpring(cursorY, ringSpringConfig);

  useEffect(() => {
    const moveCursor = (e: MouseEvent) => {
      cursorX.set(e.clientX - 6);
      cursorY.set(e.clientY - 6);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInteractive =
        target.tagName === 'A' ||
        target.tagName === 'BUTTON' ||
        target.closest('a') ||
        target.closest('button') ||
        target.getAttribute('role') === 'button' ||
        target.style.cursor === 'pointer' ||
        getComputedStyle(target).cursor === 'pointer';

      if (isInteractive && ringRef.current) {
        ringRef.current.classList.add('hovering');
      } else if (ringRef.current) {
        ringRef.current.classList.remove('hovering');
      }
    };

    window.addEventListener('mousemove', moveCursor);
    window.addEventListener('mouseover', handleMouseOver);
    return () => {
      window.removeEventListener('mousemove', moveCursor);
      window.removeEventListener('mouseover', handleMouseOver);
    };
  }, [cursorX, cursorY]);

  return (
    <>
      <motion.div
        ref={dotRef}
        className="cursor-dot"
        style={{ x: springX, y: springY }}
      />
      <motion.div
        ref={ringRef}
        className="cursor-ring"
        style={{
          x: ringX,
          y: ringY,
          translateX: '-50%',
          translateY: '-50%',
          top: '20px',
          left: '20px',
        }}
      />
    </>
  );
}
