import React from 'react';
import { User, Sprint } from '../types';
import { SprintSelector } from './SprintSelector';
import { CheckSquare, HelpCircle, Users, Shield, UserCheck, Eye, LogOut } from 'lucide-react';

interface NavbarProps {
  currentUser: User | null;
  allUsers: User[];
  sprints: Sprint[];
  currentSprintId: number | null;
  onSelectSprint: (id: number) => void;
  isReadOnly: boolean;
  activeTab: 'tasks' | 'questions' | 'meeting';
  onChangeTab: (tab: 'tasks' | 'questions' | 'meeting') => void;
  onSwitchUser: (userId: number) => void;
  onLogout: () => void;
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
  onLogout
}) => {
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

          {/* Profil Associé & Switcher */}
          <div className="flex items-center gap-3">
            {currentUser && (
              <div className="flex items-center gap-2.5 bg-slate-800/80 py-1.5 px-3 rounded-lg border border-slate-700 text-sm">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white shadow"
                  style={{ backgroundColor: currentUser.avatar_color }}
                >
                  {currentUser.initials}
                </div>
                
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-xs leading-none text-white">{currentUser.name}</span>
                  <span className="mt-1">{getRoleBadge(currentUser.role)}</span>
                </div>

                {/* Sélecteur rapide d'associé pour tester et naviguer entre comptes */}
                <div className="border-l border-slate-700 pl-2 ml-1">
                  <select
                    value={currentUser.id}
                    onChange={(e) => onSwitchUser(Number(e.target.value))}
                    className="bg-transparent text-xs text-slate-300 hover:text-white focus:outline-none cursor-pointer"
                    title="Changer de compte d'associé"
                  >
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.id} className="bg-slate-900 text-white">
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
