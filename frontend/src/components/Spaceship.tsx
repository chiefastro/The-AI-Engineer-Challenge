import { useEffect, useRef } from 'react';

interface SpaceshipProps {
  isMoving: boolean;
  position: number;
  style?: React.CSSProperties;
}

export const Spaceship = ({ isMoving, position, style }: SpaceshipProps) => {
  const shipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shipRef.current) {
      shipRef.current.style.transform = `translateX(${position}px)`;
    }
  }, [position]);

  return (
    <div
      ref={shipRef}
      className="absolute bottom-0 left-0"
      style={{ width: '48px', height: '48px', ...style }}
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={isMoving ? 'animate-pulse' : ''}
      >
        {/* Body */}
        <rect x="20" y="10" width="8" height="20" fill="#fff" stroke="#00f0ff" strokeWidth="2" />
        {/* Cockpit */}
        <rect x="22" y="14" width="4" height="8" fill="#00f0ff" stroke="#fff" strokeWidth="1" />
        {/* Wings */}
        <polygon points="12,30 24,24 36,30 24,28" fill="#ff0044" stroke="#fff" strokeWidth="2" />
        {/* Left fin */}
        <rect x="16" y="28" width="4" height="10" fill="#fff" stroke="#00f0ff" strokeWidth="1" />
        {/* Right fin */}
        <rect x="28" y="28" width="4" height="10" fill="#fff" stroke="#00f0ff" strokeWidth="1" />
        {/* Nose */}
        <polygon points="24,4 22,10 26,10" fill="#ff0044" stroke="#fff" strokeWidth="1" />
        {/* Engine flames */}
        <polygon points="22,38 24,48 26,38" fill="#ff0" stroke="#ff0044" strokeWidth="1" />
      </svg>
    </div>
  );
}; 