import React, { useState, useRef, useEffect } from 'react';
import { User, Sprint } from '../types';
import { SprintSelector } from './SprintSelector';
import {
  CheckSquare, HelpCircle, Users, Shield, UserCheck, Eye,
  LogOut, ChevronDown
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
  onOpenAdminPanel
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-blue-500/20 text-blue-200 border border-blue-500/30">
          <UserCheck className="w-2.5 h-2.5" strokeWidth={2} /> Écriture
        </span>
      );
    }
    if (role === 'read') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-500/20 text-slate-200 border border-slate-500/30">
          <Eye className="w-2.5 h-2.5" strokeWidth={2} /> Lecture
        </span>
      );
    }
    return null;
  };

  return (
    <header className="bg-slate-900/70 backdrop-blur-xl border-b border-white/[0.08] text-white sticky top-0 z-30 shadow-glass-sm pt-[env(safe-area-inset-top)]">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-8">

        {/* Ligne principale */}
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 lg:gap-4">

          {/* Logo & Sélecteur de Sprint */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-900/30 font-black text-white text-base sm:text-lg ring-1 ring-white/20">
                C
              </div>
              <div className="hidden lg:block leading-tight">
                <h1 className="font-bold text-sm sm:text-base tracking-tight text-white flex items-center gap-1.5">
                  Carré d'Hôtes
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    Studio
                  </span>
                </h1>
                <p className="text-[11px] text-slate-400 font-medium">Sprint & Pilotage Conciergerie</p>
              </div>
            </div>

            <span aria-hidden="true" className="hidden sm:block h-6 w-px bg-white/10 shrink-0" />

            <SprintSelector
              sprints={sprints}
              currentSprintId={currentSprintId}
              onSelectSprint={onSelectSprint}
              isReadOnly={isReadOnly}
            />
          </div>

          {/* Navigation principale (Tablette md+ & Desktop) */}
          <nav
            aria-label="Navigation principale"
            className="hidden md:flex items-center gap-1 bg-slate-950/50 p-1 rounded-xl border border-white/[0.1] backdrop-blur-md shrink-0 shadow-inner"
          >
            <button
              type="button"
              onClick={() => onChangeTab('tasks')}
              aria-current={activeTab === 'tasks' ? 'page' : undefined}
              className={`flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                activeTab === 'tasks'
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md shadow-cyan-500/25 ring-1 ring-white/20'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
              <span>Tâches</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeTab('questions')}
              aria-current={activeTab === 'questions' ? 'page' : undefined}
              className={`flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                activeTab === 'questions'
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md shadow-cyan-500/25 ring-1 ring-white/20'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
              <span>Questions</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeTab('meeting')}
              aria-current={activeTab === 'meeting' ? 'page' : undefined}
              className={`flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                activeTab === 'meeting'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25 ring-1 ring-white/20'
                  : 'text-amber-300 hover:text-white hover:bg-amber-400/10'
              }`}
            >
              <Users className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
              <span className="lg:hidden">Réunion</span>
              <span className="hidden lg:inline">Mode Réunion</span>
            </button>
          </nav>

          {/* Profil Associé & Menu Popover */}
          <div className="relative shrink-0" ref={menuRef}>
            {currentUser && (
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-expanded={isMenuOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 bg-slate-900/60 hover:bg-slate-800/80 py-1 pl-1 pr-2 sm:py-1 sm:pl-1.5 sm:pr-3 rounded-full border border-white/[0.12] hover:border-cyan-400/40 backdrop-blur-md transition-all text-xs cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 shadow-glass-sm"
                title="Options du compte"
              >
                <div
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs shrink-0 ring-2 ring-white/20 group-hover:ring-cyan-400/50 transition-all"
                  style={{ backgroundColor: currentUser.avatar_color || '#0284C7' }}
                >
                  {currentUser.initials}
                </div>

                <span className="hidden sm:inline font-semibold text-xs text-slate-100">
                  {currentUser.name}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-300 transition-transform duration-150 ${
                    isMenuOpen ? 'rotate-180' : ''
                  }`}
                  strokeWidth={2}
                />
              </button>
            )}

            {/* Menu Popover */}
            {isMenuOpen && currentUser && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-1.5rem)] bg-slate-900/90 backdrop-blur-2xl border border-white/[0.12] rounded-2xl shadow-glass-modal py-2 z-50 text-white animate-fade-in"
              >
                {/* En-tête profil */}
                <div className="px-4 py-3 border-b border-white/[0.08] flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs shrink-0 ring-1 ring-white/20"
                    style={{ backgroundColor: currentUser.avatar_color || '#0284C7' }}
                  >
                    {currentUser.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs text-white truncate">{currentUser.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{currentUser.email}</p>
                    {getSecondaryRoleBadge(currentUser.role) && (
                      <div className="mt-1">{getSecondaryRoleBadge(currentUser.role)}</div>
                    )}
                  </div>
                </div>

                <div className="py-1">
                  {currentUser.role === 'admin' && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenAdminPanel?.();
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-purple-200 hover:text-white hover:bg-purple-600/25 transition-colors cursor-pointer text-left"
                    >
                      <Shield className="w-4 h-4 text-purple-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="leading-tight">Panneau d'Administration</p>
                        <p className="text-[11px] font-normal text-slate-400">Sprints, associés & logements</p>
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
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer text-left"
                  >
                    <LogOut className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>Se déconnecter</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Barre de navigation mobile (<md) intégrée */}
        <nav
          aria-label="Navigation mobile"
          className="md:hidden flex items-center gap-1 py-1.5 border-t border-white/[0.08] -mx-3 sm:-mx-5 px-3 sm:px-5 bg-slate-900/90 backdrop-blur-lg"
        >
          <button
            type="button"
            onClick={() => onChangeTab('tasks')}
            aria-current={activeTab === 'tasks' ? 'page' : undefined}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 min-h-[40px] rounded-xl text-xs font-bold transition-all active:scale-[0.98] cursor-pointer ${
              activeTab === 'tasks'
                ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Tâches</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('questions')}
            aria-current={activeTab === 'questions' ? 'page' : undefined}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 min-h-[40px] rounded-xl text-xs font-bold transition-all active:scale-[0.98] cursor-pointer ${
              activeTab === 'questions'
                ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Questions</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('meeting')}
            aria-current={activeTab === 'meeting' ? 'page' : undefined}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 min-h-[40px] rounded-xl text-xs font-bold transition-all active:scale-[0.98] cursor-pointer ${
              activeTab === 'meeting'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                : 'text-amber-300 hover:text-white hover:bg-amber-400/10'
            }`}
          >
            <Users className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Réunion</span>
          </button>
        </nav>

      </div>
    </header>
  );
};
