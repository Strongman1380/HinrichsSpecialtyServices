import React from 'react';
import { cn } from '../../lib/utils';

interface MarceloCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Elevation level */
  depth?: 1 | 2 | 3;
  /** Enable the signature premium lift on hover */
  hoverLift?: boolean;
  /** Use when the card contains interactive content that needs its own hover states */
  interactive?: boolean;
}

/**
 * MarceloCard
 *
 * High-quality card component following HSS Marcelo principles.
 * Always has clear depth and refined hover behavior.
 */
export const MarceloCard = React.forwardRef<HTMLDivElement, MarceloCardProps>(
  ({ className, depth = 2, hoverLift = true, interactive = false, children, ...props }, ref) => {
    const depthClass = {
      1: 'depth-1',
      2: 'depth-2',
      3: 'depth-3',
    }[depth];

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl bg-white border border-[var(--border)] transition-all duration-300',
          depthClass,
          hoverLift && 'hover-lift',
          interactive && 'cursor-pointer',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

MarceloCard.displayName = 'MarceloCard';
