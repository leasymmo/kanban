import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Home,
  Lock,
  RotateCcw,
  Shield,
  Users,
  X,
} from 'lucide-react';
import { Property, Sprint, User } from '../types';
import { useModalDialog } from '../hooks/useModalDialog';
import { Button } from './ui';
import { AdminSprintsTab } from './admin/AdminSprintsTab';
import { AdminUsersTab } from './admin/AdminUsersTab';
import { AdminPropertiesTab } from './admin/AdminPropertiesTab';
import { AdminSystemTab } from './admin/AdminSystemTab';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  users: User[];
  sprints: Sprint[];
  properties: Property[];
  currentSprintId: number | null;
  onSprintReopened: (sprintId: number) => Promise<void>;
  onSprintUpdated: (sprintId: number, data: Partial<Sprint>) => Promise<void>;
  onSprintDeleted: (sprintId: number) => Promise<void>;
  onUserCreated: (newUser: User) => void;
  onUserUpdated: (updatedUser: User) => void;
  onUserDeleted: (deletedUserId: number) => void;
  onPropertyCreated: (newProperty: Property) => void;
  onPropertyUpdated: (updatedProperty: Property) => void;
  onPropertyStatusChanged: (updatedProperty: Property) => Promise<void>;
  onPropertiesReordered: (orderedProperties: Property[]) => void;
}

type AdminTab = 'sprints' | 'users' | 'properties' | 'system';

/**
 * Panneau d'Administration Liquid Glass modulaire (Sprints, Associés, Hébergements, Système).
 */
export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  users,
  sprints,
  properties,
  currentSprintId,
  onSprintReopened,
  onSprintUpdated,
  onSprintDeleted,
  onUserCreated,
  onUserUpdated,
  onUserDeleted,
  onPropertyCreated,
  onPropertyUpdated,
  onPropertyStatusChanged,
  onPropertiesReordered,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('sprints');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const dialogRef = useModalDialog({
    isOpen,
    onClose,
    canClose: !actionLoading,
  });

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const showFeedback = useCallback((type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text });
    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedbackMessage(null);
    }, 4500);
  }, []);

  if (!isOpen) return null;

  const activeSprint = sprints.find((s) => s.status === 'active');
  const activePropertiesCount = properties.filter((p) => Number(p.is_active) === 1).length;

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode; count?: number }[] = [
    {
      id: 'sprints',
      label: 'Sprints',
      icon: <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />,
      count: sprints.length,
    },
    {
      id: 'users',
      label: 'Associés',
      icon: <Users className="w-3.5 h-3.5" strokeWidth={2} />,
      count: users.length,
    },
    {
      id: 'properties',
      label: 'Hébergements',
      icon: <Home className="w-3.5 h-3.5" strokeWidth={2} />,
      count: properties.length,
    },
    {
      id: 'system',
      label: 'Système',
      icon: <Lock className="w-3.5 h-3.5" strokeWidth={2} />,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 pb-[var(--cdh-vv-bottom,0px)] sm:p-4 bg-[var(--cdh-backdrop-scrim)] backdrop-blur-[6px] animate-backdrop-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !actionLoading) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-panel-title"
        tabIndex={-1}
        className="cdh-glass-overlay w-full max-w-4xl h-[min(92dvh,calc(var(--cdh-vv-height,100dvh)-16px))] sm:h-auto sm:max-h-[90vh] flex flex-col rounded-t-cdh-2xl sm:rounded-cdh-2xl overflow-hidden animate-sheet-up sm:animate-modal-in focus:outline-none"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--cdh-border-hairline)] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-cdh-md bg-[var(--cdh-accent-soft)] text-[var(--cdh-accent)] flex items-center justify-center shrink-0">
              <Shield className="w-4.5 h-4.5" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h2
                id="admin-panel-title"
                className="text-[16px] font-bold tracking-[-0.015em] text-[var(--cdh-text-primary)] truncate"
              >
                Panneau d&apos;Administration
              </h2>
              <p className="text-[12px] text-[var(--cdh-text-secondary)] truncate">
                Sprints, associés, hébergements et sécurité
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={actionLoading}
            aria-label="Fermer le panneau d'administration"
            className="p-2 rounded-full text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control)] transition-colors cursor-pointer disabled:opacity-45 shrink-0"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* Navigation par Segmented Control Apple */}
        <div className="px-5 py-2.5 border-b border-[var(--cdh-border-hairline)] shrink-0 overflow-x-auto no-scrollbar">
          <div
            role="tablist"
            aria-label="Sections d'administration"
            className="inline-flex sm:grid sm:grid-cols-4 gap-1 p-1 rounded-cdh-md bg-[var(--cdh-surface-control)] border border-[var(--cdh-border-hairline)] min-w-max sm:min-w-0 w-full"
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-cdh-sm text-[12.5px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[var(--cdh-surface-card-hover)] text-[var(--cdh-text-primary)] shadow-cdh-card'
                      : 'text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)]'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {typeof tab.count === 'number' && (
                    <span
                      className={`text-[11px] font-bold px-1.5 py-0.2 rounded-full ${
                        isActive
                          ? 'bg-[var(--cdh-accent-soft)] text-[var(--cdh-accent)]'
                          : 'bg-[var(--cdh-surface-input)] text-[var(--cdh-text-tertiary)]'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bannière de Feedback */}
        {feedbackMessage && (
          <div
            role="status"
            className={`mx-5 mt-3.5 px-3.5 py-2.5 rounded-cdh-md flex items-center gap-2.5 text-[12.5px] font-medium border shrink-0 ${
              feedbackMessage.type === 'success'
                ? 'bg-[var(--cdh-success-soft)] text-[var(--cdh-success)] border-[var(--cdh-success-accent)]/30'
                : 'bg-[var(--cdh-danger-soft)] text-[var(--cdh-danger)] border-[var(--cdh-danger-accent)]/30'
            }`}
          >
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={2} />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={2} />
            )}
            <span className="flex-1 text-[var(--cdh-text-primary)]">{feedbackMessage.text}</span>
            <button
              type="button"
              onClick={() => setFeedbackMessage(null)}
              aria-label="Masquer le message"
              className="p-1 rounded-full text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-text-primary)] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
        )}

        {/* Contenu principal */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-5">
          {activeTab === 'sprints' && (
            <AdminSprintsTab
              sprints={sprints}
              currentSprintId={currentSprintId}
              actionLoading={actionLoading}
              onSprintReopened={onSprintReopened}
              onSprintUpdated={onSprintUpdated}
              onSprintDeleted={onSprintDeleted}
              onFeedback={showFeedback}
              setActionLoading={setActionLoading}
            />
          )}

          {activeTab === 'users' && (
            <AdminUsersTab
              users={users}
              currentUser={currentUser}
              actionLoading={actionLoading}
              onUserCreated={onUserCreated}
              onUserUpdated={onUserUpdated}
              onUserDeleted={onUserDeleted}
              onFeedback={showFeedback}
              setActionLoading={setActionLoading}
            />
          )}

          {activeTab === 'properties' && (
            <AdminPropertiesTab
              properties={properties}
              actionLoading={actionLoading}
              scrollContainerRef={scrollContainerRef}
              onPropertyCreated={onPropertyCreated}
              onPropertyUpdated={onPropertyUpdated}
              onPropertyStatusChanged={onPropertyStatusChanged}
              onPropertiesReordered={onPropertiesReordered}
              onFeedback={showFeedback}
              setActionLoading={setActionLoading}
            />
          )}

          {activeTab === 'system' && (
            <AdminSystemTab
              sprintsCount={sprints.length}
              activeSprint={activeSprint}
              usersCount={users.length}
              activePropertiesCount={activePropertiesCount}
              totalPropertiesCount={properties.length}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:py-3 border-t border-[var(--cdh-border-hairline)] bg-[var(--cdh-surface-control)] flex items-center justify-between gap-3 text-[12px] text-[var(--cdh-text-secondary)] shrink-0">
          <span className="truncate">
            Administrateur :{' '}
            <strong className="text-[var(--cdh-text-primary)]">{currentUser?.name}</strong>
          </span>
          <Button variant="primary" size="sm" onClick={onClose} disabled={actionLoading}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
};
