import React from 'react';

interface Props {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE = {
  sm: 'w-8 h-8 text-[12px]',
  md: 'w-10 h-10 text-[14px]',
  lg: 'w-14 h-14 text-[18px]',
};

export const Avatar: React.FC<Props> = ({ name, size = 'md', className = '' }) => {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      className={`rounded-full glass-subtle flex items-center justify-center font-medium text-sky-900 flex-shrink-0 ${SIZE[size]} ${className}`}
    >
      {initials}
    </div>
  );
};
