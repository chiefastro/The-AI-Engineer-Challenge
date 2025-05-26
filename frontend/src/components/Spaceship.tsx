import { useEffect, useRef } from 'react';

interface SpaceshipProps {
  isMoving: boolean;
  position: number;
  style?: React.CSSProperties;
  className?: string;
  isExploding?: boolean;
}

export const Spaceship = ({ isMoving, position, style, className, isExploding }: SpaceshipProps) => {
  const shipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shipRef.current) {
      shipRef.current.style.transform = `translateX(${position}px)`;
    }
  }, [position]);

  return (
    <div
      ref={shipRef}
      className={`absolute bottom-0 left-0 spaceship ${className || ''}`}
      style={{ width: '48px', height: '48px', ...style }}
    >
      {isExploding ? (
        <div className="explosion">
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="animate-explosion"
          >
            {/* Explosion particles */}
            <circle cx="24" cy="24" r="24" fill="#ff0044" opacity="0.8" />
            <circle cx="24" cy="24" r="16" fill="#ff8800" opacity="0.6" />
            <circle cx="24" cy="24" r="8" fill="#ffff00" opacity="0.4" />
            {/* Explosion rays */}
            {[...Array(8)].map((_, i) => (
              <line
                key={i}
                x1="24"
                y1="24"
                x2={24 + Math.cos(i * Math.PI / 4) * 24}
                y2={24 + Math.sin(i * Math.PI / 4) * 24}
                stroke="#ff0044"
                strokeWidth="2"
                className="animate-explosion-ray"
              />
            ))}
          </svg>
        </div>
      ) : (
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
      )}
    </div>
  );
}; 