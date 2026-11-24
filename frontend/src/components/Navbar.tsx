import React, { useState, useRef, useEffect } from 'react';
import { User, Sprint } from '../types';
import { SprintSelector } from './SprintSelector';
import {
  CheckSquare, HelpCircle, Users, Shield, UserCheck, Eye,
  LogOut, UserCog, ChevronDown
} from 'lucide-react';

interface NavbarProps {
  currentUser: User | null;
  allUsers: User[];
  sprints: Sprint[];
  currentSprintId: number | null;
  onSelectSprint: (id: number) => void;
  isReadOnly: boolean;
  activeTab: 'tasks' | 'questions' | 'meeting';
  onChangeTab: (tab: 'tasks' | 'questions' | 'meeting') => void;
  onSwitchUser?: (userId: number) => void;
  onLogout: () => void;
  onOpenUserManager?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  allUsers,
  sprints,
  currentSprintId,
  onSelectSprint,
  isReadOnly,
  activeTab,
  onChangeTab,
  onSwitchUser,
  onLogout,
  onOpenUserManager
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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <Shield className="w-3 h-3" /> Admin
          </span>
        );
      case 'write':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <UserCheck className="w-3 h-3" /> Écriture
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-slate-500/20 text-slate-300 border border-slate-500/30">
            <Eye className="w-3 h-3" /> Lecture
          </span>
        );
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Titre */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20 font-black text-white text-lg">
                C
              </div>
              <div>
                <h1 className="font-bold text-base leading-tight tracking-tight">Kanban Board</h1>
                <p className="text-xs text-slate-400 font-medium">Dashboard Hebdomadaire</p>
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

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-800/60 p-1 rounded-xl border border-slate-700/60">
            <button
              onClick={() => onChangeTab('tasks')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'tasks'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              Tâches
            </button>

            <button
              onClick={() => onChangeTab('questions')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'questions'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              Questions
            </button>

            <button
              onClick={() => onChangeTab('meeting')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'meeting'
                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              Vue Réunion
            </button>
          </nav>

          {/* Profil Associé & Dropdown avec Déconnexion et Admin */}
          <div className="relative" ref={menuRef}>
            {currentUser && (
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-2.5 bg-slate-800/90 hover:bg-slate-800 py-1.5 px-3 rounded-xl border border-slate-700/80 hover:border-slate-600 transition-all text-sm cursor-pointer group focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                title="Options du compte"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs shrink-0 ring-2 ring-white/10 group-hover:ring-white/30 transition-all"
                  style={{ backgroundColor: currentUser.avatar_color || '#2563EB' }}
                >
                  {currentUser.initials}
                </div>
                
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-xs leading-none text-white flex items-center gap-1.5">
                    {currentUser.name}
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
                  </span>
                  <span className="mt-1">{getRoleBadge(currentUser.role)}</span>
                </div>
              </button>
            )}

            {/* Menu Popover */}
            {isMenuOpen && currentUser && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl py-2 z-50 text-white">
                
                {/* En-tête profil */}
                <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-xs shrink-0"
                    style={{ backgroundColor: currentUser.avatar_color || '#2563EB' }}
                  >
                    {currentUser.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-white truncate">{currentUser.name}</p>
                    <p className="text-xs text-slate-400 truncate">{currentUser.email}</p>
                    <div className="mt-1">{getRoleBadge(currentUser.role)}</div>
                  </div>
                </div>

                <div className="py-1">
                  {/* Option Admin : Gestion des utilisateurs */}
                  {currentUser.role === 'admin' && onOpenUserManager && (
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenUserManager();
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer text-left"
                    >
                      <UserCog className="w-4 h-4 text-purple-400" />
                      <span>Gestion des utilisateurs</span>
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
      </div>
    </header>
  );
};
