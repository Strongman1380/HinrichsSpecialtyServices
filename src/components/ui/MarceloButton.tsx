import React from 'react';
import { cn } from '../../lib/utils';

interface MarceloButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  asChild?: boolean;
}

/**
 * MarceloButton
 *
 * Premium button following HSS Marcelo design language.
 * Uses layered shadows, refined transitions, and strong hover states.
 */
export const MarceloButton = React.forwardRef<HTMLButtonElement, MarceloButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2';

    const variants = {
      primary: 'bg-gradient-to-r from-[#1a78e6] to-[#3ba6ff] text-white shadow-[0_4px_20px_rgba(26,120,230,0.35)] hover:shadow-[0_8px_30px_rgba(26,120,230,0.45)] hover:scale-[1.02] active:scale-[0.985]',
      secondary: 'bg-white text-[#132e54] border border-[#e2e8f0] shadow-sm hover:shadow-md hover:border-[#cbd5e1]',
      outline: 'border-2 border-[#132e54] text-[#132e54] hover:bg-[#132e54] hover:text-white',
    };

    const sizes = {
      sm: 'px-5 py-2 text-sm',
      md: 'px-6 py-3 text-base',
      lg: 'px-8 py-4 text-lg',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

MarceloButton.displayName = 'MarceloButton';
