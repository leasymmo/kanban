import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { BlurredIconSwap } from './BlurredIconSwap';
import { Avatar, Badge, Button } from './ui';
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
        <Badge variant="accent">
          <Shield className="w-2.5 h-2.5" strokeWidth={2.25} /> Admin
        </Badge>
      );
    }
    return (
      <Badge variant="neutral">
        <UserCheck className="w-2.5 h-2.5" strokeWidth={2.25} /> Associé
      </Badge>
    );
  };

  return (
    <div className="min-h-dvh cdh-canvas-bg flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md cdh-glass-overlay rounded-cdh-2xl overflow-hidden animate-modal-in">
        {/* En-tête Apple-style lumineux */}
        <div className="px-6 pt-8 pb-6 text-center border-b border-[var(--cdh-border-hairline)]">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-[16px] bg-gradient-to-b from-[#0A84FF] to-[#007AFF] text-white font-bold text-2xl shadow-md ring-1 ring-white/30 mb-3.5">
            C
          </div>
          <h1 className="text-[20px] font-bold tracking-[-0.02em] text-[var(--cdh-text-primary)]">
            Carré d'Hôtes
          </h1>
          <p className="text-[12.5px] text-[var(--cdh-text-secondary)] font-medium mt-1">
            Espace Kanban &amp; Réunions Hebdomadaires
          </p>
        </div>

        <div className="p-6 sm:p-7">
          {error && (
            <div className="mb-5 p-3.5 rounded-cdh-md bg-[var(--cdh-danger-soft)] border border-[var(--cdh-danger-accent)]/25 text-[var(--cdh-danger)] flex items-start gap-2.5 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2} />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isManualMode ? (
              <div>
                <label className="block text-[11.5px] font-semibold text-[var(--cdh-text-secondary)] uppercase tracking-wider mb-2.5">
                  Sélectionner un associé
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
                        className={`flex items-center gap-2.5 p-2.5 rounded-cdh-lg border text-left transition-all cursor-pointer active:scale-[0.98] ${
                          isSelected
                            ? 'border-[var(--cdh-accent)] bg-[var(--cdh-accent-soft)] ring-2 ring-[var(--cdh-accent-soft)]'
                            : 'border-[var(--cdh-border-hairline)] bg-[var(--cdh-surface-card)] hover:bg-[var(--cdh-surface-card-hover)]'
                        }`}
                      >
                        <Avatar
                          initials={u.initials}
                          name={u.name}
                          color={u.avatar_color}
                          size="md"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-semibold text-[var(--cdh-text-primary)] truncate leading-tight">
                            {u.name}
                          </p>
                          <div className="mt-1">{getRoleBadge(u.role)}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setIsManualMode(true);
                      setSelectedUser(null);
                    }}
                    className="text-xs text-[var(--cdh-accent)] hover:underline font-medium cursor-pointer"
                  >
                    Se connecter avec une autre adresse email →
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11.5px] font-semibold text-[var(--cdh-text-secondary)] uppercase tracking-wider">
                    Adresse email
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsManualMode(false);
                      if (users.length > 0) setSelectedUser(users[0]);
                    }}
                    className="text-xs text-[var(--cdh-accent)] hover:underline font-medium cursor-pointer"
                  >
                    ← Choisir un associé
                  </button>
                </div>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[var(--cdh-text-tertiary)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
                  <input
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="nom@carredhotes.fr"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-cdh-md bg-[var(--cdh-surface-input)] border border-[var(--cdh-border-subtle)] text-sm text-[var(--cdh-text-primary)] placeholder:text-[var(--cdh-text-tertiary)] focus:outline-none focus:border-[var(--cdh-border-focus)] focus:ring-[3px] focus:ring-[var(--cdh-accent-soft)]"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11.5px] font-semibold text-[var(--cdh-text-secondary)] uppercase tracking-wider mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[var(--cdh-text-tertiary)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Votre mot de passe"
                  required
                  autoFocus
                  className="w-full pl-10 pr-10 py-2.5 rounded-cdh-md bg-[var(--cdh-surface-input)] border border-[var(--cdh-border-subtle)] text-sm text-[var(--cdh-text-primary)] placeholder:text-[var(--cdh-text-tertiary)] focus:outline-none focus:border-[var(--cdh-border-focus)] focus:ring-[3px] focus:ring-[var(--cdh-accent-soft)]"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-text-primary)] p-1.5 rounded-lg cursor-pointer"
                >
                  <BlurredIconSwap
                    active={showPassword}
                    activeIcon={<EyeOff className="w-4 h-4" strokeWidth={1.75} />}
                    inactiveIcon={<Eye className="w-4 h-4" strokeWidth={1.75} />}
                  />
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              leftIcon={<LogIn className="w-4 h-4" strokeWidth={2.25} />}
              className="w-full"
            >
              {isLoading ? 'Connexion en cours…' : 'Accéder au Kanban'}
            </Button>
          </form>
        </div>
      </div>

      <p className="text-center text-xs text-[var(--cdh-text-tertiary)] mt-6">
        Carré d'Hôtes &copy; {new Date().getFullYear()} &mdash; Espace réservé aux associés
      </p>
    </div>
  );
};
