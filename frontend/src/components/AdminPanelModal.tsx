import React, { useState } from 'react';
import { User, Sprint } from '../types';
import {
  X, Shield, RotateCcw, Edit2, Trash2, Plus, Check,
  AlertCircle, Calendar, Users, CheckCircle2, Clock, Lock,
  Unlock, Key, Mail, UserPlus, Info, Palette, Eye, UserCheck
} from 'lucide-react';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  users: User[];
  sprints: Sprint[];
  currentSprintId: number | null;
  onSprintReopened: (sprintId: number) => Promise<void>;
  onSprintUpdated: (sprintId: number, data: Partial<Sprint>) => Promise<void>;
  onSprintDeleted: (sprintId: number) => Promise<void>;
  onUserCreated: (newUser: User) => void;
  onUserUpdated: (updatedUser: User) => void;
  onUserDeleted: (deletedUserId: number) => void;
  apiCreateUser: (data: any) => Promise<any>;
  apiUpdateUser: (id: number, data: any) => Promise<any>;
  apiDeleteUser: (id: number) => Promise<any>;
}

const PRESET_COLORS = [
  '#2563EB', '#7C3AED', '#059669', '#D97706',
  '#EC4899', '#06B6D4', '#6366F1', '#EF4444',
];

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  users,
  sprints,
  currentSprintId,
  onSprintReopened,
  onSprintUpdated,
  onSprintDeleted,
  onUserCreated,
  onUserUpdated,
  onUserDeleted,
  apiCreateUser,
  apiUpdateUser,
  apiDeleteUser
}) => {
  const [activeTab, setActiveTab] = useState<'sprints' | 'users' | 'system'>('sprints');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sprint Edit State
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [sprintFormData, setSprintFormData] = useState({
    name: '',
    number: 1,
    notes: '',
    started_at: ''
  });
  const [sprintToReopen, setSprintToReopen] = useState<Sprint | null>(null);
  const [sprintToDelete, setSprintToDelete] = useState<Sprint | null>(null);

  // User Manager State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'write',
    avatar_color: '#2563EB',
    initials: ''
  });
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);

  if (!isOpen) return null;

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 4500);
  };

  // --- SPRINT HANDLERS ---
  const handleStartEditSprint = (s: Sprint) => {
    setEditingSprint(s);
    setSprintFormData({
      name: s.name,
      number: s.number,
      notes: s.notes || '',
      started_at: s.started_at ? s.started_at.split(' ')[0] : ''
    });
  };

  const handleSaveSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSprint) return;
    setActionLoading(true);
    try {
      await onSprintUpdated(editingSprint.id, {
        name: sprintFormData.name.trim(),
        number: Number(sprintFormData.number),
        notes: sprintFormData.notes.trim(),
        started_at: sprintFormData.started_at || undefined
      });
      showFeedback('success', `Le sprint « ${sprintFormData.name} » a été mis à jour.`);
      setEditingSprint(null);
    } catch (err: any) {
      showFeedback('error', err?.message || 'Erreur lors de la mise à jour du sprint.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReopenSprint = async () => {
    if (!sprintToReopen) return;
    setActionLoading(true);
    try {
      await onSprintReopened(sprintToReopen.id);
      showFeedback('success', `Le sprint Point ${sprintToReopen.number} (« ${sprintToReopen.name} ») a été réouvert avec succès ! Il est de nouveau actif et modifiable.`);
      setSprintToReopen(null);
    } catch (err: any) {
      showFeedback('error', err?.message || 'Impossible de réouvrir ce sprint.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDeleteSprint = async () => {
    if (!sprintToDelete) return;
    setActionLoading(true);
    try {
      await onSprintDeleted(sprintToDelete.id);
      showFeedback('success', `Le sprint « ${sprintToDelete.name} » a été supprimé.`);
      setSprintToDelete(null);
    } catch (err: any) {
      showFeedback('error', err?.message || 'Impossible de supprimer ce sprint.');
    } finally {
      setActionLoading(false);
    }
  };

  // --- USER HANDLERS ---
  const handleStartCreateUser = () => {
    setEditingUser(null);
    setIsCreatingUser(true);
    setUserFormData({
      name: '',
      email: '',
      password: '',
      role: 'write',
      avatar_color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)],
      initials: ''
    });
  };

  const handleStartEditUser = (u: User) => {
    setIsCreatingUser(false);
    setEditingUser(u);
    setUserFormData({
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
      avatar_color: u.avatar_color || '#2563EB',
      initials: u.initials || ''
    });
  };

  const handleNameChange = (name: string) => {
    let initials = userFormData.initials;
    if (!editingUser) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        initials = (parts[0][0] + parts[1][0]).toUpperCase();
      } else if (name.length >= 2) {
        initials = name.slice(0, 2).toUpperCase();
      }
    }
    setUserFormData(prev => ({ ...prev, name, initials }));
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormData.name.trim() || !userFormData.email.trim()) {
      showFeedback('error', 'Le nom et l\'email sont requis.');
      return;
    }
    if (isCreatingUser && !userFormData.password.trim()) {
      showFeedback('error', 'Le mot de passe est obligatoire pour la création.');
      return;
    }

    setActionLoading(true);
    try {
      if (isCreatingUser) {
        const res = await apiCreateUser(userFormData);
        onUserCreated(res.user);
        showFeedback('success', `Associé « ${res.user.name} » créé avec succès.`);
        setIsCreatingUser(false);
      } else if (editingUser) {
        const payload: any = {
          name: userFormData.name.trim(),
          email: userFormData.email.trim(),
          role: userFormData.role,
          avatar_color: userFormData.avatar_color,
          initials: userFormData.initials.trim().toUpperCase()
        };
        if (userFormData.password.trim()) {
          payload.password = userFormData.password.trim();
        }
        const res = await apiUpdateUser(editingUser.id, payload);
        onUserUpdated(res.user);
        showFeedback('success', `Profil de « ${res.user.name} » mis à jour.`);
        setEditingUser(null);
      }
    } catch (err: any) {
      showFeedback('error', err?.message || 'Erreur lors de l\'enregistrement de l\'utilisateur.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deletingUserId) return;
    setActionLoading(true);
    try {
      await apiDeleteUser(deletingUserId);
      onUserDeleted(deletingUserId);
      showFeedback('success', 'Utilisateur supprimé avec succès.');
      setDeletingUserId(null);
    } catch (err: any) {
      showFeedback('error', err?.message || 'Impossible de supprimer cet utilisateur.');
    } finally {
      setActionLoading(false);
    }
  };

  const activeSprint = sprints.find(s => s.status === 'active');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 sm:p-6 text-white flex items-center justify-between shrink-0 border-b border-indigo-900/50">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black tracking-tight">Panneau d'Administration</h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Carré d'Hôtes
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Contrôle central des Sprints, réouverture des points fermés par erreur & gestion des associés.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 pt-3 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            onClick={() => {
              setActiveTab('sprints');
              setEditingSprint(null);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'sprints'
                ? 'bg-white text-indigo-700 border-indigo-600 shadow-2xs'
                : 'text-slate-500 border-transparent hover:text-slate-800'
            }`}
          >
            <RotateCcw className="w-4 h-4 text-indigo-600" />
            Gestion des Sprints ({sprints.length})
          </button>

          <button
            onClick={() => {
              setActiveTab('users');
              setIsCreatingUser(false);
              setEditingUser(null);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'users'
                ? 'bg-white text-purple-700 border-purple-600 shadow-2xs'
                : 'text-slate-500 border-transparent hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4 text-purple-600" />
            Associés & Droits ({users.length})
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'system'
                ? 'bg-white text-slate-900 border-slate-800 shadow-2xs'
                : 'text-slate-500 border-transparent hover:text-slate-800'
            }`}
          >
            <Info className="w-4 h-4 text-slate-700" />
            Sécurité & État du Système
          </button>
        </div>

        {/* Message Feedback */}
        {feedbackMessage && (
          <div className={`mx-6 mt-4 p-3.5 rounded-2xl flex items-center justify-between text-xs font-medium animate-fade-in ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-red-50 text-red-900 border border-red-200'
          }`}>
            <div className="flex items-center gap-2.5">
              {feedbackMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">
          
          {/* ======================================================== */}
          {/* TAB 1 : GESTION DES SPRINTS (AVEC RÉOUVERTURE) */}
          {/* ======================================================== */}
          {activeTab === 'sprints' && (
            <div className="space-y-6">
              
              {/* Info banner sur la réouverture */}
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 flex items-start gap-3.5">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div className="text-xs leading-relaxed text-indigo-950">
                  <h4 className="font-bold text-sm text-indigo-900 mb-0.5">
                    Réouverture d'un sprint clôturé par erreur
                  </h4>
                  <p>
                    Si un sprint a été fermé accidentellement ou trop tôt, cliquez sur le bouton <span className="font-bold text-indigo-700">« Réouvrir »</span> en face du sprint concerné. Le statut repassera immédiatement en <span className="font-bold text-emerald-700">actif</span>, ce qui déverrouillera toutes les modifications (tâches, sous-tâches, questions) pour l'ensemble des associés.
                  </p>
                </div>
              </div>

              {/* Formulaire d'édition d'un sprint */}
              {editingSprint && (
                <div className="bg-slate-50 border-2 border-indigo-200 rounded-2xl p-4 sm:p-5 animate-fade-in shadow-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                    <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                      <Edit2 className="w-4 h-4 text-indigo-600" />
                      Modifier les informations du sprint : {editingSprint.name}
                    </h3>
                    <button
                      onClick={() => setEditingSprint(null)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveSprint} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Numéro du sprint
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={sprintFormData.number}
                          onChange={(e) => setSprintFormData(prev => ({ ...prev, number: parseInt(e.target.value) || 1 }))}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Nom public du sprint
                        </label>
                        <input
                          type="text"
                          required
                          value={sprintFormData.name}
                          onChange={(e) => setSprintFormData(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                          placeholder="Ex: Point 14 — 24 Nov 2026"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Date de début
                        </label>
                        <input
                          type="date"
                          value={sprintFormData.started_at}
                          onChange={(e) => setSprintFormData(prev => ({ ...prev, started_at: e.target.value }))}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Remarques / Notes de réunion
                        </label>
                        <input
                          type="text"
                          value={sprintFormData.notes}
                          onChange={(e) => setSprintFormData(prev => ({ ...prev, notes: e.target.value }))}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                          placeholder="Notes de clôture..."
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingSprint(null)}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Enregistrer les modifications
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Confirmation Réouverture Modal / Dialog */}
              {sprintToReopen && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 animate-fade-in shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-600 text-white rounded-xl shrink-0">
                      <RotateCcw className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-sm text-amber-950">
                        Confirmer la réouverture du {sprintToReopen.name} ?
                      </h4>
                      <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                        Ce sprint redeviendra le <strong>sprint actif en cours</strong>. Les tâches, sous-tâches et questions associées ne seront plus en lecture seule et pourront être modifiées librement par les associés.
                      </p>
                      <div className="flex items-center gap-2 mt-4">
                        <button
                          onClick={handleConfirmReopenSprint}
                          disabled={actionLoading}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          Oui, réouvrir ce sprint
                        </button>
                        <button
                          onClick={() => setSprintToReopen(null)}
                          className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs rounded-xl cursor-pointer"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Confirmation Suppression Modal / Dialog */}
              {sprintToDelete && (
                <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 sm:p-5 animate-fade-in shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-red-600 text-white rounded-xl shrink-0">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-sm text-red-950">
                        Supprimer le sprint {sprintToDelete.name} ?
                      </h4>
                      <p className="text-xs text-red-900 mt-1 leading-relaxed">
                        Cette action supprimera définitivement le sprint ainsi que les tâches et questions qui y sont attachées. Cette action est irréversible.
                      </p>
                      <div className="flex items-center gap-2 mt-4">
                        <button
                          onClick={handleConfirmDeleteSprint}
                          disabled={actionLoading}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                        >
                          Confirmer la suppression
                        </button>
                        <button
                          onClick={() => setSprintToDelete(null)}
                          className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs rounded-xl cursor-pointer"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Liste de tous les Sprints */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-slate-800 flex items-center justify-between">
                  <span>Tous les Sprints enregistrés ({sprints.length})</span>
                  <span className="text-xs font-normal text-slate-500">
                    Sprint en cours : <strong className="text-emerald-700">{activeSprint ? activeSprint.name : 'Aucun'}</strong>
                  </span>
                </h3>

                <div className="space-y-2.5">
                  {sprints.map((s) => {
                    const isActive = s.status === 'active';
                    const isSelected = s.id === currentSprintId;

                    return (
                      <div
                        key={s.id}
                        className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isActive
                            ? 'bg-emerald-50/50 border-emerald-300 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-xs ${
                            isActive
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {s.number}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-sm text-slate-900">{s.name}</h4>
                              
                              {isActive ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <Unlock className="w-3 h-3 text-emerald-600" />
                                  Sprint Actif (En cours)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                  <Lock className="w-3 h-3 text-slate-400" />
                                  Clôturé (Lecture seule)
                                </span>
                              )}

                              {isSelected && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
                                  Affiché à l'écran
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Débuté le {new Date(s.started_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                              {s.closed_at && (
                                <span className="flex items-center gap-1 text-slate-400">
                                  <Clock className="w-3 h-3" />
                                  Clôturé le {new Date(s.closed_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                                </span>
                              )}
                              {s.closed_by_name && (
                                <span className="text-slate-400">
                                  par {s.closed_by_name}
                                </span>
                              )}
                            </div>

                            {s.notes && (
                              <p className="text-[11px] text-slate-600 mt-1 italic">
                                « {s.notes} »
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Actions Administrateur sur le Sprint */}
                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          {/* BOUTON CLÉ : RÉOUVRIR LE SPRINT */}
                          {!isActive && (
                            <button
                              type="button"
                              onClick={() => setSprintToReopen(s)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all shadow-2xs hover:shadow-xs cursor-pointer"
                              title="Réouvrir ce sprint fermé par erreur pour autoriser de nouveau les modifications"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Réouvrir ce sprint</span>
                            </button>
                          )}

                          {/* Modifier */}
                          <button
                            type="button"
                            onClick={() => handleStartEditSprint(s)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                            title="Modifier les détails du sprint"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Supprimer (si plus d'un sprint) */}
                          {sprints.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setSprintToDelete(s)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                              title="Supprimer ce sprint"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2 : GESTION DES ASSOCIÉS & COMPTES */}
          {/* ======================================================== */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <h3 className="font-bold text-base text-slate-800">Associés & Gestion des Rôles</h3>
                  <p className="text-xs text-slate-500">
                    Ajoutez un associé, modifiez ses autorisations ou réinitialisez son mot de passe.
                  </p>
                </div>
                {!isCreatingUser && !editingUser && (
                  <button
                    onClick={handleStartCreateUser}
                    className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    Nouvel associé
                  </button>
                )}
              </div>

              {/* Formulaire Utilisateur (Création ou Édition) */}
              {(isCreatingUser || editingUser) && (
                <div className="bg-slate-50 border-2 border-purple-200 rounded-2xl p-4 sm:p-5 animate-fade-in shadow-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                    <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-purple-600" />
                      {isCreatingUser ? 'Créer un nouvel associé' : `Modifier l'associé : ${editingUser?.name}`}
                    </h4>
                    <button
                      onClick={() => {
                        setIsCreatingUser(false);
                        setEditingUser(null);
                      }}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveUser} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Nom complet
                        </label>
                        <input
                          type="text"
                          required
                          value={userFormData.name}
                          onChange={(e) => handleNameChange(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                          placeholder="Ex: Alexandre Carré"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Adresse email (identifiant)
                        </label>
                        <input
                          type="email"
                          required
                          value={userFormData.email}
                          onChange={(e) => setUserFormData(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                          placeholder="alexandre@carredhotes.fr"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Rôle & Autorisations
                        </label>
                        <select
                          value={userFormData.role}
                          onChange={(e) => setUserFormData(prev => ({ ...prev, role: e.target.value }))}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                        >
                          <option value="admin">Administrateur (Complet)</option>
                          <option value="write">Écriture (Associé)</option>
                          <option value="read">Lecture seule</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Initiales pour avatar
                        </label>
                        <input
                          type="text"
                          maxLength={3}
                          value={userFormData.initials}
                          onChange={(e) => setUserFormData(prev => ({ ...prev, initials: e.target.value.toUpperCase() }))}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white uppercase font-bold text-center"
                          placeholder="AC"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          {isCreatingUser ? 'Mot de passe initial' : 'Nouveau mot de passe (optionnel)'}
                        </label>
                        <input
                          type="password"
                          value={userFormData.password}
                          onChange={(e) => setUserFormData(prev => ({ ...prev, password: e.target.value }))}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                          placeholder={isCreatingUser ? 'Définir un mot de passe' : 'Laisser vide pour ne pas changer'}
                        />
                      </div>
                    </div>

                    {/* Palette de couleur avatar */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        <Palette className="w-3.5 h-3.5 text-slate-500" />
                        Couleur de l'avatar :
                      </label>
                      <div className="flex items-center gap-2 flex-wrap">
                        {PRESET_COLORS.map(c => (
                          <button
                            type="button"
                            key={c}
                            onClick={() => setUserFormData(prev => ({ ...prev, avatar_color: c }))}
                            className={`w-7 h-7 rounded-full border-2 transition-all cursor-pointer ${
                              userFormData.avatar_color === c ? 'border-slate-900 scale-110 shadow-md ring-2 ring-purple-300' : 'border-transparent hover:scale-105'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingUser(false);
                          setEditingUser(null);
                        }}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="px-5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {isCreatingUser ? 'Créer le compte' : 'Sauvegarder'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Confirmation Suppression Utilisateur */}
              {deletingUserId && (
                <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 animate-fade-in shadow-xs flex items-start gap-3">
                  <div className="p-2 bg-red-600 text-white rounded-xl shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-sm text-red-950">Confirmer la suppression de cet associé ?</h4>
                    <p className="text-xs text-red-900 mt-1">
                      Les tâches créées par cet utilisateur seront automatiquement réattribuées à votre compte administrateur.
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={handleConfirmDeleteUser}
                        disabled={actionLoading}
                        className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                      >
                        Supprimer définitivement
                      </button>
                      <button
                        onClick={() => setDeletingUserId(null)}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs rounded-xl cursor-pointer"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Liste des utilisateurs */}
              <div className="space-y-2.5">
                {users.map((u) => {
                  const isCurrent = currentUser?.id === u.id;
                  const isLastAdmin = u.role === 'admin' && users.filter(usr => usr.role === 'admin').length <= 1;

                  return (
                    <div
                      key={u.id}
                      className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-xs shrink-0"
                          style={{ backgroundColor: u.avatar_color || '#2563EB' }}
                        >
                          {u.initials}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-sm text-slate-900 truncate">{u.name}</h4>
                            {isCurrent && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
                                C'est vous
                              </span>
                            )}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                              u.role === 'admin'
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : u.role === 'write'
                                ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                              {u.role === 'admin' ? <Shield className="w-2.5 h-2.5" /> : u.role === 'write' ? <UserCheck className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                              {u.role === 'admin' ? 'Administrateur' : u.role === 'write' ? 'Écriture' : 'Lecture'}
                            </span>
                          </div>

                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {u.email}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleStartEditUser(u)}
                          className="p-2 text-slate-500 hover:text-purple-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                          title="Modifier le compte ou changer le mot de passe"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {!isLastAdmin && (
                          <button
                            onClick={() => setDeletingUserId(u.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                            title="Supprimer ce compte"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3 : SÉCURITÉ & STATUT SYSTÈME */}
          {/* ======================================================== */}
          {activeTab === 'system' && (
            <div className="space-y-5">
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <span className="text-slate-500 font-medium">Sprints enregistrés</span>
                  <div className="text-xl font-black text-slate-900 mt-1">{sprints.length}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <span className="text-slate-500 font-medium">Associés inscrits</span>
                  <div className="text-xl font-black text-slate-900 mt-1">{users.length}</div>
                </div>
                <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200">
                  <span className="text-emerald-700 font-medium">Sprint Actif</span>
                  <div className="text-xl font-black text-emerald-800 mt-1">
                    {activeSprint ? `Point ${activeSprint.number}` : 'Aucun'}
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3">
                <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-purple-600" />
                  Règles & Sécurité actives sur l'API
                </h4>

                <ul className="text-xs text-slate-600 space-y-2 leading-relaxed">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Mise en avant des tâches (étoile)</strong> : réservée strictement au propriétaire de la tâche (ou administrateur). Seules ces tâches sont affichées par défaut en réunion hebdomadaire.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Bascule & Réouverture</strong> : seul un administrateur peut clôturer ou réouvrir un sprint fermé par erreur.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Anti force-brute</strong> : limitation automatique des tentatives de mot de passe par IP (max 10 tentatives échouées / 10 minutes).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Hachage fort</strong> : cryptographie des mots de passe gérée via BCRYPT et sessions révoquées à la déconnexion.</span>
                  </li>
                </ul>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>Connecté en tant qu'administrateur : <strong>{currentUser?.name}</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold cursor-pointer transition-colors"
          >
            Fermer le panneau
          </button>
        </div>

      </div>
    </div>
  );
};
