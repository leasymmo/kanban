import React from 'react';
import { Avatar, ProgressBar } from '../ui';
import { ensureWhiteTextContrast } from '../../utils/color';

interface MeetingSectionShellProps {
  sectionId?: string;
  dataAnchor?: string;
  avatar?: {
    name: string;
    initials: string;
    color?: string | null;
  };
  customIcon?: React.ReactNode;
  title: string;
  subtitle: string;
  progressPercent?: number;
  badges?: React.ReactNode;
  accentWarning?: boolean;
  children: React.ReactNode;
}

/**
 * Enveloppe Layer 1 (cdh-glass-column) uniforme pour chaque bloc d'intervenant ou pool en Vue Réunion.
 */
export const MeetingSectionShell: React.FC<MeetingSectionShellProps> = ({
  sectionId,
  dataAnchor,
  avatar,
  customIcon,
  title,
  subtitle,
  progressPercent,
  badges,
  accentWarning = false,
  children,
}) => {
  return (
    <section
      id={sectionId}
      data-meeting-anchor={dataAnchor}
      className={`scroll-mt-32 cdh-glass-column rounded-cdh-2xl p-3.5 sm:p-5 space-y-3.5 ${
        accentWarning ? 'border-[var(--cdh-warning-accent)]/35' : ''
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--cdh-border-hairline)]">
        <div className="flex items-center gap-3 min-w-0">
          {customIcon ? (
            customIcon
          ) : avatar ? (
            <Avatar
              initials={avatar.initials}
              name={avatar.name}
              color={ensureWhiteTextContrast(avatar.color, '#4B5563')}
              size="md"
              className="w-10 h-10 text-sm"
            />
          ) : null}

          <div className="min-w-0">
            <h3 className="font-bold text-[16px] sm:text-[17px] tracking-[-0.015em] text-[var(--cdh-text-primary)] leading-tight truncate">
              {title}
            </h3>
            <p className="text-[12px] text-[var(--cdh-text-secondary)] font-medium tabular-nums mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {progressPercent !== undefined && (
            <div className="hidden sm:flex items-center gap-2 w-28">
              <ProgressBar value={progressPercent} label={title} />
              <span className="text-[11px] font-semibold text-[var(--cdh-text-secondary)] tabular-nums">
                {progressPercent}%
              </span>
            </div>
          )}
          {badges}
        </div>
      </div>

      {children}
    </section>
  );
};
