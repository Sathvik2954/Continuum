import React from 'react';

interface Props {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  onClick?: () => void;
  hover?: boolean;
}

export const GlassCard: React.FC<Props> = ({
  children, className = '', elevated = false, onClick, hover = false,
}) => (
  <div
    onClick={onClick}
    className={`
      ${elevated ? 'glass-elevated' : 'glass'} rounded-xl
      ${hover ? 'card-hover cursor-pointer' : ''}
      ${onClick ? 'cursor-pointer' : ''}
      ${className}
    `}
  >
    {children}
  </div>
);
