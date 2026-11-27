import React from 'react';
import { CDH_GLASS_LAYERS, GlassLayer } from '../../design-system/tokens';

export interface GlassSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Couche hiérarchique du Design System (canvas, column, card, chrome, overlay). */
  layer?: GlassLayer;
  as?: 'div' | 'section' | 'aside' | 'header' | 'nav' | 'article';
}

/**
 * Conteneur de surface Apple Liquid Glass respectant la hiérarchie de transparence Carré d'Hôtes.
 */
export const GlassSurface: React.FC<GlassSurfaceProps> = ({
  layer = 'card',
  as: Component = 'div',
  className = '',
  children,
  ...rest
}) => {
  const layerClass = CDH_GLASS_LAYERS[layer];
  return (
    <Component className={`${layerClass} ${className}`.trim()} {...rest}>
      {children}
    </Component>
  );
};
