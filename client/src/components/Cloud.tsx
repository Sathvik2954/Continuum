import React from 'react';

interface CloudProps {
  className?: string;
  color?: string;
  width?: number;
}

export const Cloud: React.FC<CloudProps> = ({ className = '', color = '#6B87E0', width = 26 }) => {
  return (
    <svg
      className={className}
      width={width}
      viewBox="0 0 46 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 20 Q2 20 2 17 Q2 14 5 14 Q5 10 9 10 Q10 7 14 7 Q19 7 20 12 Q23 10 27 12 Q30 10 34 12 Q36 9 39 11 Q42 11 42 14 Q44 15 44 17 Q44 20 41 20 Z"
        stroke={color}
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default Cloud;
