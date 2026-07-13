import React from 'react';
import { cn } from '../ui/utils';

type TaskLabCardVariant = 'default' | 'dark' | 'lime' | 'dashed';

const variantClass: Record<TaskLabCardVariant, string> = {
  default: 'tasklab-card',
  dark: 'tasklab-card-dark',
  lime: 'tasklab-card-lime',
  dashed: 'tasklab-card-dashed',
};

export interface TaskLabCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: TaskLabCardVariant;
}

export function TaskLabCard({ variant = 'default', className, children, ...props }: TaskLabCardProps) {
  return (
    <div className={cn(variantClass[variant], className)} {...props}>
      {children}
    </div>
  );
}
