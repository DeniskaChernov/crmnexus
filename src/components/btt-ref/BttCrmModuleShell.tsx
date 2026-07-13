import React from 'react';
import { Link } from 'react-router-dom';

export interface BttCrmModuleShellProps {
  tag: string;
  title: string;
  subtitle: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
}

export function BttCrmModuleShell({
  tag,
  title,
  subtitle,
  actionLabel,
  actionHref,
  onAction,
  actions,
  children,
  contentClassName,
}: BttCrmModuleShellProps) {
  const actionNode =
    actions ??
    (actionLabel ? (
      actionHref ? (
        <Link to={actionHref}>
          <button type="button">{actionLabel}</button>
        </Link>
      ) : (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )
    ) : null);

  return (
    <div className="btt-module-view">
      <div className="btt-module-hero">
        <div>
          <small>{tag}</small>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {actionNode && <div className="btt-module-hero-actions">{actionNode}</div>}
      </div>
      <div className={contentClassName ? `btt-module-content ${contentClassName}` : 'btt-module-content'}>
        {children}
      </div>
    </div>
  );
}
