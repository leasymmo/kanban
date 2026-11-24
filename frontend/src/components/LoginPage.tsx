import React, { useState } from 'react';
import { User } from '../types';
import { Lock, Mail, Eye, EyeOff, LogIn, Shield, UserCheck, AlertCircle, Sparkles } from 'lucide-react';

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
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-700 border border-purple-500/20">
          <Shield className="w-2.5 h-2.5" /> Admin
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-700 border border-blue-500/20">
        <UserCheck className="w-2.5 h-2.5" /> Associé
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col items-center justify-center p-4 sm:p-6">
      
      {/* Carte Centrale */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden">
        
        {/* En-tête avec branding */}
        <div className="bg-slate-900 px-6 py-8 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-brand-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />

          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white font-black text-2xl shadow-lg shadow-brand-500/30 mb-3">
            C
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">Carré d'Hôtes</h1>
          <p className="text-xs text-slate-400 font-medium mt-1">Dashboard Kanban & Réunions Hebdomadaires</p>
        </div>

        {/* Corps du formulaire */}
        <div className="p-6 sm:p-8">
          
          <div className="mb-6">
            <h2 className="text-base font-bold text-slate-900">Connexion sécurisée</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Sélectionnez votre compte associé ou connectez-vous par email.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-2.5 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            
            {!isManualMode ? (
              /* Sélecteur visuel d'associé */
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                  Choisissez votre compte :
                </label>
                <div className="grid grid-cols-2 gap-2.5">
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
                            ? 'border-brand-600 bg-brand-50/70 shadow-xs ring-2 ring-brand-500/20'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 bg-white'
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs shrink-0"
                          style={{ backgroundColor: u.avatar_color || '#2563EB' }}
                        >
                          {u.initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 truncate leading-tight">{u.name}</p>
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
                    className="text-[11px] text-brand-600 hover:text-brand-700 font-semibold cursor-pointer"
                  >
                    Se connecter avec une autre adresse email →
                  </button>
                </div>
              </div>
            ) : (
              /* Champ Email manuel */
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Adresse email :
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsManualMode(false);
                      if (users.length > 0) setSelectedUser(users[0]);
                    }}
                    className="text-[11px] text-brand-600 hover:text-brand-700 font-semibold cursor-pointer"
                  >
                    ← Choisir un associé
                  </button>
                </div>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="nom@carredhotes.fr"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
              </div>
            )}

            {/* Champ Mot de passe */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Mot de passe :
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Votre mot de passe"
                  required
                  autoFocus
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Bouton de validation */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-brand-600 hover:bg-brand-700 active:scale-[0.99] transition-all shadow-md shadow-brand-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Connexion en cours...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Accéder au Kanban
                </>
              )}
            </button>

          </form>

          {/* Indication mot de passe initial */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-slate-500">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Mot de passe initial : <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">password123</code>
            </span>
          </div>

        </div>

      </div>

      {/* Footer discrets */}
      <p className="text-center text-xs text-slate-400 mt-6">
        Carré d'Hôtes &copy; {new Date().getFullYear()} &mdash; Espace réservé aux associés
      </p>

    </div>
  );
};
