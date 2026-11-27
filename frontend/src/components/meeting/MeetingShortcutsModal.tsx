import React from 'react';
import { Modal } from '../ui';

interface MeetingShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  showFab: boolean;
  canCreateQuestion: boolean;
  canCloseSprint: boolean;
}

const KeyBadge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="px-1.5 py-0.5 rounded-cdh-xs bg-[var(--cdh-surface-control)] border border-[var(--cdh-border-subtle)] font-mono text-[11px] font-bold text-[var(--cdh-text-primary)]">
    {children}
  </kbd>
);

/**
 * Mémo compact des raccourcis clavier de la Vue Réunion (thématisé Light & Dark).
 */
export const MeetingShortcutsModal: React.FC<MeetingShortcutsModalProps> = ({
  isOpen,
  onClose,
  showFab,
  canCreateQuestion,
  canCloseSprint,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Raccourcis clavier — Vue Réunion"
      maxWidthClass="max-w-md"
    >
      <div className="space-y-4 text-xs">
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--cdh-text-tertiary)]">
            Navigation
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 py-1">
              <span className="text-[var(--cdh-text-primary)] font-medium">Changer d'étape (1, 2, 3)</span>
              <span className="flex items-center gap-1 shrink-0">
                <KeyBadge>1</KeyBadge>
                <KeyBadge>2</KeyBadge>
                <KeyBadge>3</KeyBadge>
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 py-1">
              <span className="text-[var(--cdh-text-primary)] font-medium">Intervenant suivant / précédent</span>
              <span className="flex items-center gap-1 shrink-0">
                <KeyBadge>J</KeyBadge>
                <KeyBadge>K</KeyBadge>
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 py-1">
              <span className="text-[var(--cdh-text-primary)] font-medium">Aller à « À attribuer » (étape 3)</span>
              <KeyBadge>0</KeyBadge>
            </div>
            <div className="flex items-center justify-between gap-3 py-1">
              <span className="text-[var(--cdh-text-primary)] font-medium">Afficher / masquer « Autres tâches » (étape 1)</span>
              <KeyBadge>E</KeyBadge>
            </div>
          </div>
        </div>

        {(showFab || canCreateQuestion || canCloseSprint) && (
          <div className="pt-3 border-t border-[var(--cdh-border-hairline)] space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--cdh-text-tertiary)]">
              Actions en séance
            </p>
            <div className="space-y-1.5">
              {showFab && (
                <div className="flex items-center justify-between gap-3 py-1">
                  <span className="text-[var(--cdh-text-primary)] font-medium">Nouvelle tâche en séance</span>
                  <span className="flex items-center gap-1 shrink-0">
                    <KeyBadge>N</KeyBadge>
                    <KeyBadge>+</KeyBadge>
                    <KeyBadge>=</KeyBadge>
                  </span>
                </div>
              )}
              {canCreateQuestion && (
                <div className="flex items-center justify-between gap-3 py-1">
                  <span className="text-[var(--cdh-text-primary)] font-medium">Poser une question</span>
                  <KeyBadge>Q</KeyBadge>
                </div>
              )}
              {canCloseSprint && (
                <div className="flex items-center justify-between gap-3 py-1">
                  <span className="text-[var(--cdh-text-primary)] font-medium">Valider &amp; Clôturer le sprint</span>
                  <span className="flex items-center gap-1 shrink-0">
                    <KeyBadge>Shift</KeyBadge>
                    <span className="text-[var(--cdh-text-tertiary)]">+</span>
                    <KeyBadge>C</KeyBadge>
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-[var(--cdh-border-hairline)] flex items-center justify-between text-[11px] text-[var(--cdh-text-secondary)]">
          <span>Annuler une édition / Fermer</span>
          <KeyBadge>Échap</KeyBadge>
        </div>
      </div>
    </Modal>
  );
};
