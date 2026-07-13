import React from 'react';
import { cn } from '../ui/utils';
import { BttCrmModuleShell } from '../btt-ref/BttCrmModuleShell.tsx';

export interface TaskLabPageProps {
  title: string;
  subtitle?: string;
  tag?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function TaskLabPage({
  title,
  subtitle,
  tag,
  actions,
  children,
  className,
  contentClassName,
}: TaskLabPageProps) {
  return (
    <BttCrmModuleShell
      tag={tag || 'BTT CRM'}
      title={title}
      subtitle={subtitle || ''}
      actions={actions}
      contentClassName={contentClassName}
    >
      <div className={cn('fade-in', className)}>{children}</div>
    </BttCrmModuleShell>
  );
}
