import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { BlurredIconSwap } from './BlurredIconSwap';
import { ensureWhiteTextContrast } from '../utils/color';
import { Lock, Mail, Eye, EyeOff, LogIn, Shield, UserCheck, AlertCircle } from 'lucide-react';

interface LoginPageProps {
  users: User[];
  onLoginSuccess: (user: User, token: string) => void;
  onLoginSubmit: (emailOrId: string | number, password: string) => Promise<any>;
}

export const LoginPage: React.FC<LoginPageProps> = ({ users, onLoginSuccess, onLoginSubmit }) => {
  const [selectedUser, setSelectedUser] = useState<User | null>(users[0] || null);
  const [customEmail, setCustomEmail] = useState('');
  const [isManualMode, setIsManualMode] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isManualMode && !selectedUser && users.length > 0) {
      setSelectedUser(users[0]);
    }
  }, [users, isManualMode, selectedUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailOrId = isManualMode ? customEmail.trim() : (selectedUser?.id || customEmail.trim());

    if (!emailOrId) {
      setError('Veuillez sélectionner ou saisir votre identifiant.');
      return;
    }

    if (!password) {
      setError('Veuillez saisir votre mot de passe.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await onLoginSubmit(emailOrId, password);
      if (res?.success && res?.user) {
        onLoginSuccess(res.user, res.token);
      } else {
        setError(res?.error || 'Échec de la connexion.');
      }
    } catch (err: any) {
      setError(err?.message || 'Identifiants incorrects.');
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleBadge = (role?: string) => {
    if (role === 'admin') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
          <Shield className="w-3 h-3" strokeWidth={2.25} /> Admin
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-black/[0.10]">
        <UserCheck className="w-3 h-3" strokeWidth={2.25} /> Associé
      </span>
    );
  };

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      
      {/* Halos ambiants Frosted Glass */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Carte Centrale */}
      <div className="w-full max-w-md glass-panel rounded-3xl shadow-glass-modal border border-white/[0.12] overflow-hidden relative z-10">
        
        {/* En-tête avec branding */}
        <div className="bg-slate-950/60 border-b border-white/[0.08] px-6 py-8 text-white text-center relative overflow-hidden backdrop-blur-md">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white font-black text-2xl shadow-lg shadow-cyan-900/30 ring-1 ring-white/20 mb-3">
            C
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center justify-center gap-1.5">
            Carré d'Hôtes
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              Studio
            </span>
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-1">Dashboard Kanban & Réunions Hebdomadaires</p>
        </div>

        {/* Corps du formulaire */}
        <div className="p-6 sm:p-8">
          
          <div className="mb-6">
            <h2 className="text-base font-bold text-white">Connexion sécurisée</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Sélectionnez votre compte associé ou connectez-vous par email.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 flex items-start gap-2.5 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" strokeWidth={1.75} />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            
            {!isManualMode ? (
              /* Sélecteur visuel d'associé */
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                  Choisissez votre compte :
                </label>
                <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5">
                  {users.map((u) => {
                    const isSelected = selectedUser?.id === u.id;
                    return (
                      <button
                        type="button"
                        key={u.id}
                        onClick={() => {
                          setSelectedUser(u);
                          setError(null);
                        }}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-cyan-400 bg-cyan-500/20 shadow-md ring-2 ring-cyan-400/30'
                            : 'border-white/[0.1] hover:border-white/[0.2] hover:bg-white/[0.08] bg-slate-900/60'
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs shrink-0 ring-1 ring-white/20"
                          style={{ backgroundColor: ensureWhiteTextContrast(u.avatar_color) }}
                        >
                          {u.initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate leading-tight">{u.name}</p>
                          <div className="mt-0.5">{getRoleBadge(u.role)}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setIsManualMode(true);
                      setSelectedUser(null);
                    }}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer transition-colors"
                  >
                    Se connecter avec une autre adresse email →
                  </button>
                </div>
              </div>
            ) : (
              /* Champ Email manuel */
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Adresse email :
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsManualMode(false);
                      if (users.length > 0) setSelectedUser(users[0]);
                    }}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer transition-colors"
                  >
                    ← Choisir un associé
                  </button>
                </div>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
                  <input
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="nom@carredhotes.fr"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/[0.12] bg-slate-900/60 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400"
                  />
                </div>
              </div>
            )}

            {/* Champ Mot de passe */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Mot de passe :
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Votre mot de passe"
                  required
                  autoFocus
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-white/[0.12] bg-slate-900/60 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1.5 rounded-lg cursor-pointer"
                >
                  <BlurredIconSwap
                    active={showPassword}
                    activeIcon={<EyeOff className="w-4 h-4" strokeWidth={1.75} />}
                    inactiveIcon={<Eye className="w-4 h-4" strokeWidth={1.75} />}
                  />
                </button>
              </div>
            </div>

            {/* Bouton de validation */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 active:scale-[0.99] transition-all shadow-lg shadow-cyan-500/25 border border-white/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Connexion en cours...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" strokeWidth={2.25} />
                  Accéder au Kanban
                </>
              )}
            </button>

          </form>

        </div>

      </div>

      {/* Footer discret */}
      <p className="text-center text-xs text-slate-500 mt-6 relative z-10">
        Carré d'Hôtes &copy; {new Date().getFullYear()} &mdash; Espace réservé aux associés
      </p>

    </div>
  );
};
