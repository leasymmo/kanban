import React, { useState } from 'react';
import { User } from '../types';
import {
  X, UserPlus, Shield, UserCheck, Eye, Edit2, Trash2,
  Check, AlertCircle, Key, Mail, User as UserIcon, Palette
} from 'lucide-react';

interface UserManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  currentUser: User | null;
  onUserCreated: (newUser: User) => void;
  onUserUpdated: (updatedUser: User) => void;
  onUserDeleted: (deletedUserId: number) => void;
  apiCreateUser: (data: any) => Promise<any>;
  apiUpdateUser: (id: number, data: any) => Promise<any>;
  apiDeleteUser: (id: number) => Promise<any>;
}

const PRESET_COLORS = [
  '#2563EB', // Bleu
  '#7C3AED', // Violet
  '#059669', // Émeraude
  '#D97706', // Ambre
  '#EC4899', // Rose
  '#06B6D4', // Cyan
  '#6366F1', // Indigo
  '#EF4444', // Rouge
];

export const UserManagerModal: React.FC<UserManagerModalProps> = ({
  isOpen,
  onClose,
  users,
  currentUser,
  onUserCreated,
  onUserUpdated,
  onUserDeleted,
  apiCreateUser,
  apiUpdateUser,
  apiDeleteUser
}) => {
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Formulaire
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'write',
    avatar_color: '#2563EB',
    initials: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setEditingUser(null);
    setIsCreating(true);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'write',
      avatar_color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)],
      initials: ''
    });
    setError(null);
    setSuccessMessage(null);
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
      initials: u.initials || ''
    });
    setError(null);
    setSuccessMessage(null);
  };

  const handleCancelForm = () => {
    setIsCreating(false);
    setEditingUser(null);
    setError(null);
  };

  const handleNameChange = (name: string) => {
    let initials = formData.initials;
    if (isCreating || !initials) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        initials = (parts[0][0] + parts[1][0]).toUpperCase();
      } else if (name.length > 0) {
        initials = name.slice(0, 2).toUpperCase();
      }
    }
    setFormData({ ...formData, name, initials });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!formData.name.trim() || !formData.email.trim()) {
      setError('Le nom et l\'adresse email sont obligatoires.');
      return;
    }

    if (isCreating && !formData.password.trim()) {
      setError('Le mot de passe est obligatoire pour créer un compte.');
      return;
    }

    setIsLoading(true);
    try {
      if (isCreating) {
        const res = await apiCreateUser(formData);
        if (res.success && res.user) {
          onUserCreated(res.user);
          setSuccessMessage(`L'utilisateur ${res.user.name} a été créé.`);
          setIsCreating(false);
        } else {
          setError(res.error || 'Erreur lors de la création.');
        }
      } else if (editingUser) {
        const payload: any = { ...formData };
        if (!payload.password) delete payload.password; // Conserver l'ancien mot de passe
        const res = await apiUpdateUser(editingUser.id, payload);
        if (res.success && res.user) {
          onUserUpdated(res.user);
          setSuccessMessage(`L'utilisateur ${res.user.name} a été mis à jour.`);
          setEditingUser(null);
        } else {
          setError(res.error || 'Erreur lors de la mise à jour.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (userToDelete: User) => {
    if (userToDelete.id === currentUser?.id) {
      alert("Vous ne pouvez pas supprimer votre propre compte.");
      return;
    }

    if (!window.confirm(`Confirmez-vous la suppression définitive du compte de ${userToDelete.name} ? Ses tâches créées seront réattribuées à votre compte.`)) {
      return;
    }

    setDeletingId(userToDelete.id);
    setError(null);
    try {
      const res = await apiDeleteUser(userToDelete.id);
      if (res.success) {
        onUserDeleted(userToDelete.id);
        setSuccessMessage(`Compte de ${userToDelete.name} supprimé avec succès.`);
      } else {
        setError(res.error || 'Erreur lors de la suppression.');
      }
    } catch (err: any) {
      setError(err.message || 'Impossible de supprimer cet utilisateur.');
    } finally {
      setDeletingId(null);
    }
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200">
            <Shield className="w-3 h-3" /> Admin
          </span>
        );
      case 'write':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
            <UserCheck className="w-3 h-3" /> Écriture (Associé)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <Eye className="w-3 h-3" /> Lecture
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Configuration des Utilisateurs</h2>
              <p className="text-xs text-slate-400">Gérez les associés, accès et mots de passe du Kanban</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Formulaire Ajout / Édition */}
          {(isCreating || editingUser) ? (
            <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900">
                  {isCreating ? 'Ajouter un nouvel associé / utilisateur' : `Modifier l'utilisateur : ${editingUser?.name}`}
                </h3>
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="text-xs text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
                >
                  Annuler
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Nom */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Nom complet *
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        placeholder="Ex: Adrien"
                        required
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Adresse email *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="adrien@carredhotes.fr"
                        required
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                      />
                    </div>
                  </div>

                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  
                  {/* Rôle */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Rôle d'accès *
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                    >
                      <option value="admin">Admin (Tous pouvoirs)</option>
                      <option value="write">Écriture (Associé)</option>
                      <option value="read">Lecture seule</option>
                    </select>
                  </div>

                  {/* Mot de passe */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      {isCreating ? 'Mot de passe *' : 'Nouveau mot de passe'}
                    </label>
                    <div className="relative">
                      <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder={isCreating ? 'Mot de passe' : 'Laisser vide pour ne pas changer'}
                        required={isCreating}
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                      />
                    </div>
                  </div>

                  {/* Initiales */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Initiales (2 lettres)
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={formData.initials}
                      onChange={(e) => setFormData({ ...formData, initials: e.target.value.toUpperCase() })}
                      placeholder="AD"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white uppercase font-bold"
                    />
                  </div>

                </div>

                {/* Couleur de l'avatar */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-slate-500" />
                    Couleur du profil :
                  </label>
                  <div className="flex items-center gap-2">
                    {PRESET_COLORS.map((col) => (
                      <button
                        type="button"
                        key={col}
                        onClick={() => setFormData({ ...formData, avatar_color: col })}
                        className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                          formData.avatar_color === col ? 'ring-2 ring-offset-2 ring-slate-900 scale-110 shadow-xs' : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: col }}
                      />
                    ))}
                    <input
                      type="color"
                      value={formData.avatar_color}
                      onChange={(e) => setFormData({ ...formData, avatar_color: e.target.value })}
                      className="w-7 h-7 rounded-full border-0 cursor-pointer p-0 ml-2"
                      title="Couleur personnalisée"
                    />
                  </div>
                </div>

                {/* Bouton de sauvegarde */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCancelForm}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {isLoading ? 'Enregistrement...' : isCreating ? 'Créer l\'utilisateur' : 'Mettre à jour'}
                  </button>
                </div>

              </form>
            </div>
          ) : (
            /* Bouton Ajouter */
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {users.length} utilisateur{users.length > 1 ? 's' : ''} configuré{users.length > 1 ? 's' : ''}
              </span>
              <button
                onClick={handleStartCreate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-xs transition-colors cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Ajouter un utilisateur
              </button>
            </div>
          )}

          {/* Liste des utilisateurs */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
            {users.map((u) => {
              const isMe = u.id === currentUser?.id;
              return (
                <div key={u.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/70 transition-colors">
                  
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs shrink-0"
                      style={{ backgroundColor: u.avatar_color || '#2563EB' }}
                    >
                      {u.initials}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{u.name}</span>
                        {isMe && (
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">
                            Vous
                          </span>
                        )}
                        {getRoleBadge(u.role)}
                      </div>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleStartEdit(u)}
                      className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors cursor-pointer"
                      title="Modifier cet utilisateur"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      disabled={isMe || deletingId === u.id}
                      onClick={() => handleDelete(u)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isMe
                          ? 'text-slate-300 cursor-not-allowed'
                          : 'text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer'
                      }`}
                      title={isMe ? "Vous ne pouvez pas supprimer votre propre compte" : "Supprimer cet utilisateur"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                </div>
              );
            })}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Seuls les administrateurs peuvent accéder à ce panneau.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>

      </div>

    </div>
  );
};
