import React from 'react';

interface MoonIconProps {
  size?: number;
  className?: string;
}

export function MoonIcon({ size = 24, className }: MoonIconProps): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Half-moon / eclipse — the core visual metaphor */}
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.12" />
      <path
        d="M12 2 A10 10 0 0 1 12 22 Z"
        fill="currentColor"
        opacity="0.75"
      />
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.5" />
    </svg>
  );
}
