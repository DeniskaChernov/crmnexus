import React from 'react';
import { cn } from '../ui/utils';
import { Button, type ButtonProps } from '../ui/button';

export interface TaskLabPillProps extends ButtonProps {
  tone?: 'default' | 'dark' | 'lime' | 'outline';
}

const toneClass: Record<NonNullable<TaskLabPillProps['tone']>, string> = {
  default: 'tasklab-pill bg-white text-neutral-900 border border-neutral-200 hover:bg-neutral-50',
  dark: 'tasklab-pill bg-neutral-900 text-white hover:bg-neutral-800',
  lime: 'tasklab-pill bg-[var(--tasklab-lime)] text-neutral-900 hover:opacity-90',
  outline: 'tasklab-pill border border-neutral-200 bg-transparent text-neutral-700 hover:bg-neutral-50',
};

export function TaskLabPill({ tone = 'default', className, ...props }: TaskLabPillProps) {
  return <Button className={cn(toneClass[tone], className)} {...props} />;
}
