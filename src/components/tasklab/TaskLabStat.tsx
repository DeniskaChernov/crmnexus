import React from 'react';
import { cn } from '../ui/utils';
import { TaskLabCard } from './TaskLabCard';

export interface TaskLabStatProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'dark' | 'lime';
  className?: string;
}

export function TaskLabStat({ label, value, hint, icon, variant = 'default', className }: TaskLabStatProps) {
  return (
    <TaskLabCard variant={variant} className={cn('p-5 md:p-6', className)}>
      <div className="flex items-start justify-between mb-2">
        <p className={cn('text-sm font-semibold', variant === 'dark' ? 'text-neutral-400' : 'text-neutral-500')}>
          {label}
        </p>
        {icon}
      </div>
      <p className={cn('text-3xl font-bold tabular-nums', variant === 'dark' ? 'text-white' : 'text-neutral-900')}>
        {value}
      </p>
      {hint && (
        <p className={cn('text-xs mt-1', variant === 'dark' ? 'text-neutral-500' : 'text-neutral-400')}>
          {hint}
        </p>
      )}
    </TaskLabCard>
  );
}
