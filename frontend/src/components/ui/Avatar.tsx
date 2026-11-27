import React from 'react';
import { ensureWhiteTextContrast } from '../../utils/color';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

export interface AvatarProps {
  initials: string;
  name?: string;
  color?: string;
  size?: AvatarSize;
  className?: string;
}

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-[11px]',
  lg: 'w-10 h-10 text-[13px]',
};

/**
 * Avatar circulaire avec anneau translucide interne et contraste WCAG AA garanti sur les initiales.
 */
export const Avatar: React.FC<AvatarProps> = ({
  initials,
  name,
  color = '#007AFF',
  size = 'sm',
  className = '',
}) => {
  const accessibleBg = ensureWhiteTextContrast(color, '#007AFF');
  return (
    <span
      title={name}
      aria-label={name || initials}
      className={`inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0 select-none ring-1 ring-white/35 shadow-xs ${SIZE_CLASSES[size]} ${className}`.trim()}
      style={{ backgroundColor: accessibleBg }}
    >
      {initials}
    </span>
  );
};
