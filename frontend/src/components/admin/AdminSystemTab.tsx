import React from 'react';
import { CheckCircle2, Home, Lock, RotateCcw, Users } from 'lucide-react';
import { Sprint } from '../../types';

interface AdminSystemTabProps {
  sprintsCount: number;
  activeSprint?: Sprint;
  usersCount: number;
  activePropertiesCount: number;
  totalPropertiesCount: number;
}

/**
 * Onglet d'état système et règles de sécurité.
 */
export const AdminSystemTab: React.FC<AdminSystemTabProps> = ({
  sprintsCount,
  activeSprint,
  usersCount,
  activePropertiesCount,
  totalPropertiesCount,
}) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="cdh-surface-card rounded-cdh-xl p-4 border border-[var(--cdh-border-subtle)] space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--cdh-text-tertiary)] flex items-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5 text-[var(--cdh-accent)]" strokeWidth={2} />
            Sprints
          </div>
          <div className="text-2xl font-bold text-[var(--cdh-text-primary)]">{sprintsCount}</div>
          <div className="text-[12px] text-[var(--cdh-text-secondary)]">
            Actif : Point {activeSprint?.number ?? '—'}
          </div>
        </div>

        <div className="cdh-surface-card rounded-cdh-xl p-4 border border-[var(--cdh-border-subtle)] space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--cdh-text-tertiary)] flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[var(--cdh-accent)]" strokeWidth={2} />
            Associés
          </div>
          <div className="text-2xl font-bold text-[var(--cdh-text-primary)]">{usersCount}</div>
          <div className="text-[12px] text-[var(--cdh-text-secondary)]">Comptes actifs</div>
        </div>

        <div className="cdh-surface-card rounded-cdh-xl p-4 border border-[var(--cdh-border-subtle)] space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--cdh-text-tertiary)] flex items-center gap-1.5">
            <Home className="w-3.5 h-3.5 text-[var(--cdh-accent)]" strokeWidth={2} />
            Hébergements
          </div>
          <div className="text-2xl font-bold text-[var(--cdh-text-primary)]">
            {activePropertiesCount} / {totalPropertiesCount}
          </div>
          <div className="text-[12px] text-[var(--cdh-text-secondary)]">Actifs sur le tableau</div>
        </div>
      </div>

      <div className="cdh-glass-column rounded-cdh-xl p-4 border border-[var(--cdh-border-subtle)] space-y-2.5">
        <h3 className="font-semibold text-[13.5px] text-[var(--cdh-text-primary)] flex items-center gap-2">
          <Lock className="w-4 h-4 text-[var(--cdh-accent)]" strokeWidth={2} />
          Règles de sécurité
        </h3>
        <ul className="space-y-2 text-[12.5px] text-[var(--cdh-text-secondary)]">
          <li className="flex items-start gap-2">
            <CheckCircle2
              className="w-4 h-4 text-[var(--cdh-success)] shrink-0 mt-0.5"
              strokeWidth={1.75}
            />
            <span>
              <strong className="text-[var(--cdh-text-primary)]">Clôture & Réouverture</strong> :
              seul un administrateur peut clôturer ou réouvrir un sprint.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2
              className="w-4 h-4 text-[var(--cdh-success)] shrink-0 mt-0.5"
              strokeWidth={1.75}
            />
            <span>
              <strong className="text-[var(--cdh-text-primary)]">Anti force-brute</strong> :
              limitation par IP à 10 tentatives échouées sur 10 minutes.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2
              className="w-4 h-4 text-[var(--cdh-success)] shrink-0 mt-0.5"
              strokeWidth={1.75}
            />
            <span>
              <strong className="text-[var(--cdh-text-primary)]">Sessions & hachage</strong> :
              mots de passe chiffrés via BCRYPT et jetons révoqués à la déconnexion.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
};
