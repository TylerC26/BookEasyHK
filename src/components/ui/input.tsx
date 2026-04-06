'use client';

import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-xs font-medium text-[#3D3D3D]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'w-full h-9 px-3.5 rounded-lg border bg-white text-[#111111] text-sm placeholder:text-[#D1D5DB] transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]',
            error ? 'border-[#EF4444]' : 'border-[#E5E7EB]',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-[#EF4444]">{error}</p>}
        {hint && !error && <p className="text-xs text-[#6B7280]">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
export { Input };
