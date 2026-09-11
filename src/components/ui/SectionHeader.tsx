import React from 'react';
import { cn } from '../../lib/utils';

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
  className?: string;
}

/**
 * SectionHeader
 *
 * Consistent, high-quality section header following Marcelo principles.
 * Uses the refined eyebrow + strong title + restrained subtitle pattern.
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  eyebrow,
  title,
  subtitle,
  align = 'left',
  className,
}) => {
  return (
    <div className={cn(
      'mb-10',
      align === 'center' && 'text-center',
      className
    )}>
      {eyebrow && (
        <div className="inline-block mb-3 px-3 py-1 text-xs font-semibold tracking-[0.12em] uppercase text-[#f58220] bg-[#fef3e8] rounded-md">
          {eyebrow}
        </div>
      )}
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-[#132e54] mb-4">
        {title}
      </h2>
      {subtitle && (
        <p className="text-lg text-[#475569] max-w-2xl mx-auto">
          {subtitle}
        </p>
      )}
    </div>
  );
};
