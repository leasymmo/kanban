import React from 'react';

interface BlurredIconSwapProps {
  active: boolean;
  activeIcon: React.ReactNode;
  inactiveIcon: React.ReactNode;
  className?: string;
}

/**
 * Bascule entre deux icônes avec un flou de 4 px pendant la transition.
 */
export const BlurredIconSwap: React.FC<BlurredIconSwapProps> = ({
  active,
  activeIcon,
  inactiveIcon,
  className = ''
}) => (
  <span className={`inline-grid place-items-center shrink-0 ${className}`}>
    <span
      className={`col-start-1 row-start-1 inline-flex items-center justify-center transition-all duration-200 ${
        active
          ? 'opacity-100 blur-0 scale-100'
          : 'opacity-0 blur-[4px] scale-90 pointer-events-none'
      }`}
    >
      {activeIcon}
    </span>
    <span
      className={`col-start-1 row-start-1 inline-flex items-center justify-center transition-all duration-200 ${
        !active
          ? 'opacity-100 blur-0 scale-100'
          : 'opacity-0 blur-[4px] scale-90 pointer-events-none'
      }`}
    >
      {inactiveIcon}
    </span>
  </span>
);
