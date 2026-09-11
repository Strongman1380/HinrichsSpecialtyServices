import React from 'react';
import { cn } from '../../lib/utils';

interface MarceloSectionProps extends React.HTMLAttributes<HTMLElement> {
  /** Adds the signature Marcelo frame wrapper inside */
  framed?: boolean;
  /** Vertical padding level */
  padding?: 'sm' | 'md' | 'lg';
}

/**
 * MarceloSection
 *
 * Standardized section wrapper with optional Marcelo framing.
 * Enforces consistent rhythm and optional content frame.
 */
export const MarceloSection = React.forwardRef<HTMLElement, MarceloSectionProps>(
  ({ className, framed = false, padding = 'lg', children, ...props }, ref) => {
    const paddingClasses = {
      sm: 'py-12 md:py-16',
      md: 'py-16 md:py-20',
      lg: 'py-20 md:py-24',
    };

    return (
      <section
        ref={ref}
        className={cn('section', paddingClasses[padding], className)}
        {...props}
      >
        {framed ? (
          <div className="marcelo-frame">
            {children}
          </div>
        ) : (
          children
        )}
      </section>
    );
  }
);

MarceloSection.displayName = 'MarceloSection';
