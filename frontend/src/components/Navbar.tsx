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
    <header className="bg-slate-900/95 backdrop-blur-md border-b border-white/[0.08] text-white sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-8">

        {/* Ligne principale */}
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 lg:gap-4">

          {/* Logo & Sélecteur de Sprint */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-brand-600 flex items-center justify-center shadow-sm shadow-brand-900/30 font-black text-white text-base sm:text-lg ring-1 ring-white/15">
                C
              </div>
              <div className="hidden lg:block leading-tight">
                <h1 className="font-bold text-sm sm:text-base tracking-tight text-white">Kanban Board</h1>
                <p className="text-[11px] text-slate-400 font-medium">Carré d'Hôtes</p>
              </div>
            </div>

            <span aria-hidden="true" className="hidden sm:block h-6 w-px bg-slate-800 shrink-0" />

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
            className="hidden md:flex items-center gap-1 bg-slate-800/75 p-1 rounded-xl border border-white/[0.08] shrink-0"
          >
            <button
              type="button"
              onClick={() => onChangeTab('tasks')}
              aria-current={activeTab === 'tasks' ? 'page' : undefined}
              className={`flex items-center gap-1.5 lg:gap-2 px-2.5 lg:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                activeTab === 'tasks'
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
              <span>Tâches</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeTab('questions')}
              aria-current={activeTab === 'questions' ? 'page' : undefined}
              className={`flex items-center gap-1.5 lg:gap-2 px-2.5 lg:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                activeTab === 'questions'
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
              <span>Questions</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeTab('meeting')}
              aria-current={activeTab === 'meeting' ? 'page' : undefined}
              className={`flex items-center gap-1.5 lg:gap-2 px-2.5 lg:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                activeTab === 'meeting'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <Users className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
              <span className="lg:hidden">Réunion</span>
              <span className="hidden lg:inline">Vue Réunion</span>
            </button>
          </nav>

          {/* Profil Associé & Menu Popover (avec Panneau d'administration & Déconnexion) */}
          <div className="relative shrink-0" ref={menuRef}>
            {currentUser && (
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-expanded={isMenuOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-800 py-1 pl-1 pr-2 sm:py-1 sm:pl-1.5 sm:pr-3 rounded-full border border-white/[0.1] hover:border-white/[0.2] transition-all text-xs cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                title="Options du compte"
              >
                <div
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs shrink-0 ring-2 ring-white/15 group-hover:ring-white/30 transition-all"
                  style={{ backgroundColor: currentUser.avatar_color || '#2563EB' }}
                >
                  {currentUser.initials}
                </div>

                <span className="hidden sm:inline font-semibold text-xs text-slate-100">
                  {currentUser.name}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-transform duration-150 ${
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
                className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700/90 rounded-2xl shadow-2xl py-2 z-50 text-white animate-fade-in"
              >
                {/* En-tête profil */}
                <div className="px-4 py-3 border-b border-slate-700/80 flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs shrink-0"
                    style={{ backgroundColor: currentUser.avatar_color || '#2563EB' }}
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
                        <p className="text-[11px] font-normal text-slate-300">Sprints, associés & logements</p>
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
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer text-left"
                  >
                    <LogOut className="w-4 h-4 text-red-400 shrink-0" />
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
          className="md:hidden flex items-center gap-1 py-1.5 border-t border-white/[0.08] -mx-3 sm:-mx-5 px-3 sm:px-5 bg-slate-900/95"
        >
          <button
            type="button"
            onClick={() => onChangeTab('tasks')}
            aria-current={activeTab === 'tasks' ? 'page' : undefined}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 min-h-[42px] rounded-lg text-xs font-bold transition-all active:scale-[0.98] cursor-pointer ${
              activeTab === 'tasks'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" strokeWidth={2.25} />
            <span>Tâches</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('questions')}
            aria-current={activeTab === 'questions' ? 'page' : undefined}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 min-h-[42px] rounded-lg text-xs font-bold transition-all active:scale-[0.98] cursor-pointer ${
              activeTab === 'questions'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" strokeWidth={2.25} />
            <span>Questions</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('meeting')}
            aria-current={activeTab === 'meeting' ? 'page' : undefined}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 min-h-[42px] rounded-lg text-xs font-bold transition-all active:scale-[0.98] cursor-pointer ${
              activeTab === 'meeting'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" strokeWidth={2.25} />
            <span>Réunion</span>
          </button>
        </nav>

      </div>
    </header>
  );
};
