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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <Shield className="w-2.5 h-2.5" strokeWidth={2} /> Admin
          </span>
        );
      case 'write':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <UserCheck className="w-2.5 h-2.5" strokeWidth={2} /> Écriture
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-500/20 text-slate-300 border border-slate-500/30">
            <Eye className="w-2.5 h-2.5" strokeWidth={2} /> Lecture
          </span>
        );
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        
        {/* Ligne principale (Desktop & Mobile) */}
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
          
          {/* Logo & Sélecteur de Sprint */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20 font-black text-white text-base sm:text-lg">
                C
              </div>
              <div className="hidden xs:block">
                <h1 className="font-bold text-xs sm:text-base leading-tight tracking-tight">Kanban Board</h1>
                <p className="text-[10px] sm:text-xs text-slate-400 font-medium hidden sm:block">Dashboard Hebdomadaire</p>
              </div>
            </div>

            {/* Sélecteur de Sprint */}
            <SprintSelector
              sprints={sprints}
              currentSprintId={currentSprintId}
              onSelectSprint={onSelectSprint}
              isReadOnly={isReadOnly}
            />
          </div>

          {/* Navigation Tabs (Desktop sm+) */}
          <nav className="hidden sm:flex items-center gap-1 bg-slate-800/60 p-1 rounded-xl border border-slate-700/60">
            <button
              onClick={() => onChangeTab('tasks')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'tasks'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Tâches
            </button>

            <button
              onClick={() => onChangeTab('questions')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'questions'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              Questions
            </button>

            <button
              onClick={() => onChangeTab('meeting')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'meeting'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Vue Réunion
            </button>
          </nav>

          {/* Bouton Raccourci Espace Administrateur (Desktop) */}
          {currentUser?.role === 'admin' && (
            <button
              type="button"
              onClick={() => onOpenAdminPanel?.()}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-600/20 text-purple-300 border border-purple-500/40 hover:bg-purple-600/30 hover:text-white transition-all cursor-pointer shadow-xs"
              title="Ouvrir le panneau d'administration des sprints et des utilisateurs"
            >
              <Shield className="w-3.5 h-3.5 text-purple-400" strokeWidth={2.25} />
              <span>Admin</span>
            </button>
          )}

          {/* Profil Associé & Dropdown avec Déconnexion et Admin */}
          <div className="relative shrink-0" ref={menuRef}>
            {currentUser && (
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-2 bg-slate-800/90 hover:bg-slate-800 py-1 px-2 sm:py-1.5 sm:px-3 rounded-xl border border-slate-700/80 hover:border-slate-600 transition-all text-xs cursor-pointer group focus:outline-none"
                title="Options du compte"
              >
                <div
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs shrink-0 ring-2 ring-white/10 group-hover:ring-white/30 transition-all"
                  style={{ backgroundColor: currentUser.avatar_color || '#2563EB' }}
                >
                  {currentUser.initials}
                </div>
                
                <div className="hidden md:flex flex-col text-left">
                  <span className="font-semibold text-xs leading-none text-white flex items-center gap-1">
                    {currentUser.name}
                    <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
                  </span>
                  <span className="mt-0.5">{getRoleBadge(currentUser.role)}</span>
                </div>
              </button>
            )}

            {/* Menu Popover */}
            {isMenuOpen && currentUser && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl py-2 z-50 text-white animate-fade-in">
                
                {/* En-tête profil */}
                <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs shrink-0"
                    style={{ backgroundColor: currentUser.avatar_color || '#2563EB' }}
                  >
                    {currentUser.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs text-white truncate">{currentUser.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{currentUser.email}</p>
                    <div className="mt-1">{getRoleBadge(currentUser.role)}</div>
                  </div>
                </div>

                <div className="py-1">
                  {/* Option Admin : Panneau d'administration */}
                  {currentUser.role === 'admin' && (
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenAdminPanel?.();
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-purple-300 hover:text-white hover:bg-purple-600/20 transition-colors cursor-pointer text-left"
                    >
                      <Shield className="w-4 h-4 text-purple-400" />
                      <span>Panneau d'Administration</span>
                    </button>
                  )}

                  {/* Option Déconnexion */}
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer text-left"
                  >
                    <LogOut className="w-4 h-4 text-red-400" />
                    <span>Se déconnecter</span>
                  </button>
                </div>

              </div>
            )}
          </div>

        </div>

        {/* Barre de navigation mobile (<sm) intégrée */}
        <div className="sm:hidden flex items-center justify-around py-1.5 border-t border-slate-800/80 -mx-3 px-3 bg-slate-900/95">
          <button
            onClick={() => onChangeTab('tasks')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'tasks'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" strokeWidth={2.25} />
            Tâches
          </button>

          <button
            onClick={() => onChangeTab('questions')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'questions'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" strokeWidth={2.25} />
            Questions
          </button>

          <button
            onClick={() => onChangeTab('meeting')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'meeting'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" strokeWidth={2.25} />
            Réunion
          </button>

          {currentUser?.role === 'admin' && (
            <button
              onClick={() => onOpenAdminPanel?.()}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold text-purple-300 hover:text-white"
            >
              <Shield className="w-3.5 h-3.5" strokeWidth={2.25} />
              Admin
            </button>
          )}
        </div>

      </div>
    </header>
  );
};
