import React from 'react';

interface LogoProps {
  className?: string;
  color?: string;
  width?: number;
}

export const Logo: React.FC<LogoProps> = ({ className = '', color = '#6B87E0', width = 26 }) => {
  return (
    <svg
      className={className}
      width={width}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M 18 28 C 10 22, 5 16, 5 11 C 5 7, 8 4, 12 4 C 15 4, 17 6, 18 8 C 19 6, 21 4, 24 4 C 28 4, 31 7, 31 11 C 31 15, 29 18, 26 20 L 27.5 20 L 29 12 L 30.5 24 L 32 17 L 33 20 H 35 C 38 20, 30 28, 18 28 Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
};

export default Logo;
