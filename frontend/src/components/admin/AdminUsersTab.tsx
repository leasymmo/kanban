import React, { useState } from 'react';
import { Edit2, Eye, Shield, Trash2, UserCheck, UserPlus } from 'lucide-react';
import { User } from '../../types';
import { api } from '../../api/client';
import { Avatar, Badge, Button, Input, useConfirm } from '../ui';
import { ADMIN_PRESET_COLORS, ColorSwatchPicker } from './ColorSwatchPicker';

interface AdminUsersTabProps {
  users: User[];
  currentUser: User | null;
  actionLoading: boolean;
  onUserCreated: (newUser: User) => void;
  onUserUpdated: (updatedUser: User) => void;
  onUserDeleted: (deletedUserId: number) => void;
  onFeedback: (type: 'success' | 'error', text: string) => void;
  setActionLoading: (loading: boolean) => void;
}

/**
 * Onglet d'administration des associés : création, modification des rôles et suppression.
 */
export const AdminUsersTab: React.FC<AdminUsersTabProps> = ({
  users,
  currentUser,
  actionLoading,
  onUserCreated,
  onUserUpdated,
  onUserDeleted,
  onFeedback,
  setActionLoading,
}) => {
  const confirm = useConfirm();
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'write',
    avatar_color: '#2563EB',
    initials: '',
  });

  const resetForm = () => {
    setEditingUser(null);
    setIsCreating(false);
  };

  const handleStartCreate = () => {
    setEditingUser(null);
    setIsCreating(true);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'write',
      avatar_color: ADMIN_PRESET_COLORS[Math.floor(Math.random() * ADMIN_PRESET_COLORS.length)],
      initials: '',
    });
  };

  const handleStartEdit = (u: User) => {
    setIsCreating(false);
    setEditingUser(u);
    setFormData({
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
      avatar_color: u.avatar_color || '#2563EB',
      initials: u.initials || '',
    });
  };

  const handleNameChange = (name: string) => {
    let initials = formData.initials;
    if (!editingUser) {
      const parts = name.trim().split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        initials = (parts[0][0] + parts[1][0]).toUpperCase();
      } else if (name.trim().length >= 2) {
        initials = name.trim().slice(0, 2).toUpperCase();
      }
    }
    setFormData((prev) => ({ ...prev, name, initials }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formData.name.trim();
    const cleanEmail = formData.email.trim();
    if (!cleanName || !cleanEmail) {
      onFeedback('error', "Le nom et l'email sont requis.");
      return;
    }
    if (isCreating && formData.password.length < 6) {
      onFeedback('error', 'Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (!isCreating && formData.password !== '' && formData.password.length < 6) {
      onFeedback('error', 'Le nouveau mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setActionLoading(true);
    try {
      if (isCreating) {
        const res = await api.createUser({
          name: cleanName,
          email: cleanEmail,
          password: formData.password,
          role: formData.role,
          avatar_color: formData.avatar_color,
          initials: formData.initials.trim().toUpperCase(),
        });
        onUserCreated(res.user);
        onFeedback('success', `Associé « ${res.user.name} » créé avec succès.`);
        setIsCreating(false);
      } else if (editingUser) {
        const payload: Partial<User> & { password?: string } = {
          name: cleanName,
          email: cleanEmail,
          role: formData.role as User['role'],
          avatar_color: formData.avatar_color,
          initials: formData.initials.trim().toUpperCase(),
        };
        if (formData.password !== '') {
          payload.password = formData.password;
        }
        const res = await api.updateUser(editingUser.id, payload);
        onUserUpdated(res.user);
        onFeedback('success', `Profil de « ${res.user.name} » mis à jour.`);
        setEditingUser(null);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Erreur lors de l'enregistrement de l'utilisateur.";
      onFeedback('error', msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (u: User) => {
    const ok = await confirm({
      title: `Supprimer ${u.name} ?`,
      message:
        'Ses tâches existantes seront conservées mais deviendront non assignées. Cette action est irréversible.',
      confirmLabel: 'Supprimer ce compte',
      cancelLabel: 'Annuler',
      variant: 'danger',
    });
    if (!ok) return;

    setActionLoading(true);
    try {
      await api.deleteUser(u.id);
      onUserDeleted(u.id);
      onFeedback('success', `Compte de « ${u.name} » supprimé.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Impossible de supprimer cet utilisateur.';
      onFeedback('error', msg);
    } finally {
      setActionLoading(false);
    }
  };

  const adminCount = users.filter((usr) => usr.role === 'admin').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-[12.5px] text-[var(--cdh-text-secondary)]">
          Gérez les accès, rôles et couleurs d&apos;avatar des associés.
        </p>

        {!isCreating && !editingUser && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleStartCreate}
            leftIcon={<UserPlus className="w-3.5 h-3.5" strokeWidth={2} />}
            className="self-start sm:self-auto shrink-0"
          >
            Nouvel associé
          </Button>
        )}
      </div>

      {(isCreating || editingUser) && (
        <form
          onSubmit={handleSave}
          className="cdh-glass-column rounded-cdh-xl p-4 space-y-3.5 border border-[var(--cdh-border-subtle)]"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[13.5px] font-semibold text-[var(--cdh-text-primary)] flex items-center gap-2">
              {isCreating ? (
                <UserPlus className="w-4 h-4 text-[var(--cdh-accent)]" strokeWidth={2} />
              ) : (
                <Edit2 className="w-4 h-4 text-[var(--cdh-accent)]" strokeWidth={2} />
              )}
              {isCreating ? 'Créer un associé' : `Modifier : ${editingUser?.name}`}
            </h3>
            <Button size="sm" variant="ghost" disabled={actionLoading} onClick={resetForm}>
              Annuler
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Nom complet *"
              type="text"
              required
              placeholder="Ex: Julien Martin"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
            />
            <Input
              label="Email *"
              type="email"
              required
              placeholder="julien@carredhotes.fr"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label={isCreating ? 'Mot de passe *' : 'Nouveau mot de passe'}
              type="password"
              required={isCreating}
              placeholder={isCreating ? 'Minimum 6 caractères' : 'Laisser vide pour conserver'}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />

            <div className="space-y-1.5">
              <label className="block text-[12px] font-semibold text-[var(--cdh-text-secondary)]">
                Rôle *
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full rounded-cdh-md bg-[var(--cdh-surface-input)] border border-[var(--cdh-border-subtle)] px-3 py-2 text-[13.5px] text-[var(--cdh-text-primary)] transition-all duration-150 focus:outline-none focus:border-[var(--cdh-border-focus)] focus:ring-[3px] focus:ring-[var(--cdh-accent-soft)] cursor-pointer"
              >
                <option value="write">Écriture (Associé)</option>
                <option value="admin">Administrateur</option>
                <option value="read">Lecture seule</option>
              </select>
            </div>

            <Input
              label="Initiales (max 3)"
              type="text"
              maxLength={3}
              required
              value={formData.initials}
              onChange={(e) => setFormData({ ...formData, initials: e.target.value.toUpperCase() })}
              className="uppercase font-semibold"
            />
          </div>

          <ColorSwatchPicker
            label="Couleur de l'avatar"
            value={formData.avatar_color}
            onChange={(avatar_color) => setFormData({ ...formData, avatar_color })}
          />

          <div className="pt-2.5 border-t border-[var(--cdh-border-hairline)] flex justify-end gap-2">
            <Button variant="ghost" size="sm" disabled={actionLoading} onClick={resetForm}>
              Annuler
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={actionLoading}>
              {isCreating ? 'Créer le compte' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-2.5">
        {users.map((u) => {
          const isCurrent = currentUser?.id === u.id;
          const isLastAdmin = u.role === 'admin' && adminCount <= 1;

          return (
            <div
              key={u.id}
              className="cdh-surface-card rounded-cdh-xl p-3.5 sm:p-4 border border-[var(--cdh-border-subtle)] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar
                  initials={u.initials}
                  name={u.name}
                  color={u.avatar_color || '#2563EB'}
                  size="lg"
                />

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-[14px] text-[var(--cdh-text-primary)] truncate">
                      {u.name}
                    </h4>

                    {isCurrent && <Badge variant="accent">Vous</Badge>}

                    {u.role === 'admin' ? (
                      <Badge variant="accent" pill>
                        <Shield className="w-2.5 h-2.5" strokeWidth={2.25} />
                        Admin
                      </Badge>
                    ) : u.role === 'write' ? (
                      <Badge variant="success" pill>
                        <UserCheck className="w-2.5 h-2.5" strokeWidth={2.25} />
                        Écriture
                      </Badge>
                    ) : (
                      <Badge variant="neutral" pill>
                        <Eye className="w-2.5 h-2.5" strokeWidth={2.25} />
                        Lecture
                      </Badge>
                    )}
                  </div>

                  <p className="text-[12px] text-[var(--cdh-text-secondary)] truncate mt-0.5">
                    {u.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={actionLoading}
                  onClick={() => handleStartEdit(u)}
                  aria-label={`Modifier ${u.name}`}
                  title="Modifier le compte ou changer le mot de passe"
                >
                  <Edit2 className="w-4 h-4" strokeWidth={1.75} />
                </Button>

                {!isCurrent && !isLastAdmin && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={actionLoading}
                    onClick={() => handleDelete(u)}
                    aria-label={`Supprimer ${u.name}`}
                    title="Supprimer ce compte"
                    className="hover:text-[var(--cdh-danger)] hover:bg-[var(--cdh-danger-soft)]"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
