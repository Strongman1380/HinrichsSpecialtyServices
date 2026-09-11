import React from 'react';
import { cn } from '../../lib/utils';

interface MarceloFrameProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Controls the depth/elevation of the frame */
  depth?: 1 | 2 | 3;
  /** Adds premium hover lift effect */
  hoverLift?: boolean;
  /** Removes the default padding (use when nesting) */
  noPadding?: boolean;
}

/**
 * MarceloFrame
 *
 * The signature container from the HSS Marcelo Design System.
 * Enforces 60px margins, layered depth, and premium framing.
 *
 * Use this as the main wrapper for most content sections.
 */
export const MarceloFrame = React.forwardRef<HTMLDivElement, MarceloFrameProps>(
  ({ className, depth = 2, hoverLift = false, noPadding = false, children, ...props }, ref) => {
    const depthClass = {
      1: 'depth-1',
      2: 'depth-2',
      3: 'depth-3',
    }[depth];

    return (
      <div
        ref={ref}
        className={cn(
          'marcelo-frame',
          depthClass,
          hoverLift && 'hover-lift',
          noPadding && 'p-0',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

MarceloFrame.displayName = 'MarceloFrame';
