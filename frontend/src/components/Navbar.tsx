import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User, Sprint } from '../types';
import { SprintSelector } from './SprintSelector';
import { Avatar, Badge } from './ui';
import { useModalDialog } from '../hooks/useModalDialog';
import {
  CheckSquare, HelpCircle, Users, Shield, UserCheck, Eye,
  LogOut, ChevronDown, Sun, Moon, Menu, X, Lock
} from 'lucide-react';

interface NavbarProps {
  currentUser: User | null;
  sprints: Sprint[];
  currentSprintId: number | null;
  onSelectSprint: (id: number) => void;
  isReadOnly: boolean;
  activeTab: 'tasks' | 'questions' | 'meeting';
  onChangeTab: (tab: 'tasks' | 'questions' | 'meeting') => void;
  onLogout: () => void;
  onOpenAdminPanel?: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  sprints,
  currentSprintId,
  onSelectSprint,
  isReadOnly,
  activeTab,
  onChangeTab,
  onLogout,
  onOpenAdminPanel,
  theme = 'light',
  onToggleTheme
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileCenterOpen, setIsMobileCenterOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const mobileCenterRef = useModalDialog<HTMLDivElement>({
    isOpen: isMobileCenterOpen,
    onClose: () => setIsMobileCenterOpen(false),
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const getSecondaryRoleBadge = (role?: string) => {
    if (role === 'write') {
      return (
        <Badge variant="accent">
          <UserCheck className="w-2.5 h-2.5" strokeWidth={2} /> Écriture
        </Badge>
      );
    }
    if (role === 'read') {
      return (
        <Badge variant="neutral">
          <Eye className="w-2.5 h-2.5" strokeWidth={2} /> Lecture
        </Badge>
      );
    }
    return null;
  };

  const navItems: Array<{
    id: 'tasks' | 'questions' | 'meeting';
    label: string;
    mobileLabel: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'tasks',
      label: 'Tâches',
      mobileLabel: 'Tâches',
      icon: <CheckSquare className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
    },
    {
      id: 'questions',
      label: 'Questions',
      mobileLabel: 'Questions',
      icon: <HelpCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
    },
    {
      id: 'meeting',
      label: 'Vue Réunion',
      mobileLabel: 'Réunion',
      icon: <Users className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
    }
  ];

  const activeSprint = sprints.find((s) => s.id === currentSprintId) || null;
  const activeNavItem = navItems.find((item) => item.id === activeTab) || navItems[0];

  return (
    <header className="cdh-pwa-header sticky top-0 z-30 px-2 sm:px-5 lg:px-8 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]">
      <div className="max-w-7xl mx-auto cdh-glass-chrome rounded-cdh-xl px-2.5 sm:px-4 transition-colors">
        {/* Barre mobile ultra-compacte (<md) — 1 seule ligne pour maximiser l'espace des tâches */}
        <div className="md:hidden flex items-center justify-between h-11 gap-2">
          <button
            type="button"
            onClick={() => setIsMobileCenterOpen(true)}
            className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer active:opacity-80"
            aria-label="Ouvrir le menu principal"
          >
            <div className="w-7 h-7 rounded-[9px] bg-gradient-to-b from-[#0A84FF] to-[#007AFF] flex items-center justify-center shadow-sm font-bold text-white text-xs ring-1 ring-white/25 shrink-0">
              C
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold text-[13.5px] tracking-[-0.015em] text-[var(--cdh-text-primary)] shrink-0">
                {activeNavItem.mobileLabel}
              </span>
              {activeSprint && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--cdh-text-tertiary)] truncate">
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{activeSprint.name}</span>
                  {isReadOnly && <Lock className="w-2.5 h-2.5 text-[var(--cdh-warning)] shrink-0" strokeWidth={2.25} />}
                </span>
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setIsMobileCenterOpen(true)}
            aria-expanded={isMobileCenterOpen}
            aria-haspopup="dialog"
            aria-label="Ouvrir le centre de contrôle"
            className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 min-h-[34px] rounded-full bg-[var(--cdh-surface-control)] hover:bg-[var(--cdh-surface-control-hover)] border border-[var(--cdh-border-hairline)] transition-all active:scale-95 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cdh-border-focus)]"
          >
            {currentUser && (
              <Avatar
                initials={currentUser.initials}
                name={currentUser.name}
                color={currentUser.avatar_color || '#007AFF'}
                size="xs"
              />
            )}
            <Menu className="w-4 h-4 text-[var(--cdh-text-primary)]" strokeWidth={2} />
          </button>
        </div>

        {/* Barre principale Tablette (md+) & Desktop (inchangée) */}
        <div className="hidden md:flex items-center justify-between h-14 gap-2 lg:gap-4">
          {/* Logo & Sélecteur de Sprint */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 rounded-[10px] bg-gradient-to-b from-[#0A84FF] to-[#007AFF] flex items-center justify-center shadow-sm font-bold text-white text-sm ring-1 ring-white/25">
                C
              </div>
              <div className="hidden lg:block leading-tight">
                <h1 className="font-semibold text-[14px] tracking-[-0.015em] text-[var(--cdh-text-primary)]">
                  Carré d'Hôtes
                </h1>
                <p className="text-[11px] text-[var(--cdh-text-tertiary)] font-medium">
                  Kanban &amp; Sprints
                </p>
              </div>
            </div>

            <span aria-hidden="true" className="hidden sm:block h-5 w-px bg-[var(--cdh-border-hairline)] shrink-0" />

            <SprintSelector
              sprints={sprints}
              currentSprintId={currentSprintId}
              onSelectSprint={onSelectSprint}
              isReadOnly={isReadOnly}
            />
          </div>

          {/* Segmented Control (Tablette md+ & Desktop) */}
          <nav
            aria-label="Navigation principale"
            className="hidden md:flex items-center gap-1 bg-[var(--cdh-surface-control)] p-1 rounded-cdh-md shrink-0"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangeTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-1.5 lg:gap-2 px-3 lg:px-3.5 py-1.5 rounded-cdh-sm text-[12.5px] font-semibold transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cdh-border-focus)] ${
                    isActive
                      ? 'bg-[var(--cdh-surface-card-hover)] text-[var(--cdh-text-primary)] shadow-cdh-card'
                      : 'text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)]'
                  }`}
                >
                  <span className={isActive ? 'text-[var(--cdh-accent)]' : ''}>{item.icon}</span>
                  <span className="lg:hidden">{item.mobileLabel}</span>
                  <span className="hidden lg:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Actions droite : Thème + Profil Associé */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
                title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--cdh-surface-control)] hover:bg-[var(--cdh-surface-control-hover)] text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)] transition-all active:scale-95 cursor-pointer"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4" strokeWidth={2} />
                ) : (
                  <Moon className="w-4 h-4" strokeWidth={2} />
                )}
              </button>
            )}

            <div className="relative" ref={menuRef}>
              {currentUser && (
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  aria-expanded={isMenuOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 bg-[var(--cdh-surface-control)] hover:bg-[var(--cdh-surface-control-hover)] py-1 pl-1 pr-2 sm:pr-2.5 rounded-full border border-[var(--cdh-border-hairline)] transition-all text-xs cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cdh-border-focus)]"
                  title="Options du compte"
                >
                  <Avatar
                    initials={currentUser.initials}
                    name={currentUser.name}
                    color={currentUser.avatar_color || '#007AFF'}
                    size="sm"
                    className="sm:w-7 sm:h-7"
                  />

                  <span className="hidden sm:inline font-semibold text-[12.5px] text-[var(--cdh-text-primary)]">
                    {currentUser.name}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-[var(--cdh-text-tertiary)] group-hover:text-[var(--cdh-text-primary)] transition-transform duration-150 ${
                      isMenuOpen ? 'rotate-180' : ''
                    }`}
                    strokeWidth={2}
                  />
                </button>
              )}

              {/* Menu Popover Liquid Glass */}
              {isMenuOpen && currentUser && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-1.5rem)] cdh-glass-overlay rounded-cdh-xl py-2 z-50 animate-fade-in"
                >
                  <div className="px-4 py-3 border-b border-[var(--cdh-border-hairline)] flex items-center gap-3">
                    <Avatar
                      initials={currentUser.initials}
                      name={currentUser.name}
                      color={currentUser.avatar_color || '#007AFF'}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[13px] text-[var(--cdh-text-primary)] truncate">
                        {currentUser.name}
                      </p>
                      <p className="text-[11px] text-[var(--cdh-text-secondary)] truncate">
                        {currentUser.email}
                      </p>
                      {getSecondaryRoleBadge(currentUser.role) && (
                        <div className="mt-1.5">{getSecondaryRoleBadge(currentUser.role)}</div>
                      )}
                    </div>
                  </div>

                  <div className="p-1.5 space-y-0.5">
                    {currentUser.role === 'admin' && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsMenuOpen(false);
                          onOpenAdminPanel?.();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-cdh-sm text-[12.5px] font-medium text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-accent-soft)] transition-colors cursor-pointer text-left"
                      >
                        <Shield className="w-4 h-4 text-[var(--cdh-secondary)] shrink-0" strokeWidth={2} />
                        <div className="min-w-0">
                          <p className="leading-tight font-semibold">Administration</p>
                          <p className="text-[11px] text-[var(--cdh-text-secondary)]">
                            Sprints, associés &amp; logements
                          </p>
                        </div>
                      </button>
                    )}

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-cdh-sm text-[12.5px] font-semibold text-[var(--cdh-danger)] hover:bg-[var(--cdh-danger-soft)] transition-colors cursor-pointer text-left"
                    >
                      <LogOut className="w-4 h-4 shrink-0" strokeWidth={2} />
                      <span>Se déconnecter</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Control Center Liquid Glass sur Mobile (<md) */}
      {isMobileCenterOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-50 md:hidden flex flex-col items-center px-2.5 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] pb-4 bg-[var(--cdh-backdrop-scrim)] backdrop-blur-[10px] animate-backdrop-in"
            onClick={() => setIsMobileCenterOpen(false)}
          >
            <div
              ref={mobileCenterRef}
              role="dialog"
              aria-modal="true"
              aria-label="Centre de contrôle"
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md cdh-glass-overlay rounded-cdh-2xl p-3.5 space-y-3 animate-modal-in focus:outline-none max-h-[calc(100dvh-1.5rem)] overflow-y-auto"
            >
              {/* En-tête du Control Center */}
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--cdh-border-hairline)]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-[10px] bg-gradient-to-b from-[#0A84FF] to-[#007AFF] flex items-center justify-center shadow-sm font-bold text-white text-sm ring-1 ring-white/25 shrink-0">
                    C
                  </div>
                  <div className="min-w-0 leading-tight">
                    <p className="font-semibold text-[14px] text-[var(--cdh-text-primary)] truncate">
                      Carré d'Hôtes
                    </p>
                    <p className="text-[11px] text-[var(--cdh-text-tertiary)] font-medium">
                      Menu principal
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileCenterOpen(false)}
                  aria-label="Fermer le menu principal"
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--cdh-surface-control)] hover:bg-[var(--cdh-surface-control-hover)] text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)] active:scale-95 transition-all cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>

              {/* Tuiles Navigation (Tâches / Questions / Réunion) */}
              <nav aria-label="Navigation mobile" className="grid grid-cols-3 gap-2">
                {navItems.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onChangeTab(item.id);
                        setIsMobileCenterOpen(false);
                      }}
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 min-h-[64px] rounded-cdh-lg text-[12px] font-semibold transition-all active:scale-95 cursor-pointer border ${
                        isActive
                          ? 'bg-[var(--cdh-accent)] text-white border-transparent shadow-sm'
                          : 'bg-[var(--cdh-surface-control)] text-[var(--cdh-text-primary)] border-[var(--cdh-border-hairline)] hover:bg-[var(--cdh-surface-control-hover)]'
                      }`}
                    >
                      <span className={isActive ? 'text-white' : 'text-[var(--cdh-accent)]'}>
                        {item.icon}
                      </span>
                      <span>{item.mobileLabel}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Tuile Semaine / Sprint + Thème */}
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <SprintSelector
                    sprints={sprints}
                    currentSprintId={currentSprintId}
                    onSelectSprint={onSelectSprint}
                    isReadOnly={isReadOnly}
                    fullWidth
                  />
                </div>
                {onToggleTheme && (
                  <button
                    type="button"
                    onClick={onToggleTheme}
                    aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
                    className="flex items-center justify-center gap-1.5 px-3 min-h-[38px] rounded-cdh-md bg-[var(--cdh-surface-control)] hover:bg-[var(--cdh-surface-control-hover)] border border-[var(--cdh-border-hairline)] text-[12px] font-semibold text-[var(--cdh-text-primary)] transition-all active:scale-95 cursor-pointer shrink-0"
                  >
                    {theme === 'dark' ? (
                      <>
                        <Sun className="w-4 h-4 text-[var(--cdh-warning)]" strokeWidth={2} />
                        <span>Clair</span>
                      </>
                    ) : (
                      <>
                        <Moon className="w-4 h-4 text-[var(--cdh-accent)]" strokeWidth={2} />
                        <span>Sombre</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Compte & Actions */}
              {currentUser && (
                <div className="pt-2 border-t border-[var(--cdh-border-hairline)] space-y-2">
                  <div className="flex items-center gap-3 px-2 py-1.5 rounded-cdh-lg bg-[var(--cdh-surface-control)]">
                    <Avatar
                      initials={currentUser.initials}
                      name={currentUser.name}
                      color={currentUser.avatar_color || '#007AFF'}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[13px] text-[var(--cdh-text-primary)] truncate">
                        {currentUser.name}
                      </p>
                      <p className="text-[11px] text-[var(--cdh-text-secondary)] truncate">
                        {currentUser.email}
                      </p>
                    </div>
                    {getSecondaryRoleBadge(currentUser.role)}
                  </div>

                  <div className="grid grid-cols-1 gap-1.5">
                    {currentUser.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsMobileCenterOpen(false);
                          onOpenAdminPanel?.();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-cdh-md text-[12.5px] font-semibold text-[var(--cdh-text-primary)] bg-[var(--cdh-surface-control)] hover:bg-[var(--cdh-accent-soft)] transition-colors cursor-pointer text-left"
                      >
                        <Shield className="w-4 h-4 text-[var(--cdh-secondary)] shrink-0" strokeWidth={2} />
                        <div className="min-w-0 flex-1">
                          <p className="leading-tight">Administration</p>
                          <p className="text-[11px] font-normal text-[var(--cdh-text-secondary)]">
                            Sprints, associés &amp; logements
                          </p>
                        </div>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileCenterOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-cdh-md text-[12.5px] font-semibold text-[var(--cdh-danger)] bg-[var(--cdh-danger-soft)] hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 shrink-0" strokeWidth={2} />
                      <span>Se déconnecter</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </header>
  );
};
