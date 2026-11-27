import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User, Sprint, Property } from '../types';
import { api } from '../api/client';
import { useModalDialog } from '../hooks/useModalDialog';
import {
  X, Shield, RotateCcw, Edit2, Trash2, Plus, Check,
  AlertCircle, Calendar, Users, CheckCircle2, Clock, Lock,
  Unlock, UserPlus, Info, Palette, Eye, UserCheck, Home, PowerOff, Archive, GripVertical
} from 'lucide-react';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  users: User[];
  sprints: Sprint[];
  properties: Property[];
  currentSprintId: number | null;
  onSprintReopened: (sprintId: number) => Promise<void>;
  onSprintUpdated: (sprintId: number, data: Partial<Sprint>) => Promise<void>;
  onSprintDeleted: (sprintId: number) => Promise<void>;
  onUserCreated: (newUser: User) => void;
  onUserUpdated: (updatedUser: User) => void;
  onUserDeleted: (deletedUserId: number) => void;
  onPropertyCreated: (newProperty: Property) => void;
  onPropertyUpdated: (updatedProperty: Property) => void;
  onPropertyStatusChanged: (updatedProperty: Property) => Promise<void>;
  onPropertiesReordered: (orderedProperties: Property[]) => void;
}

const PRESET_COLORS = [
  '#1C69E3', '#7A4FD9', '#03875B', '#AB5803',
  '#C32777', '#13808A', '#5A5CE2', '#CC2827',
];

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  users,
  sprints,
  properties,
  currentSprintId,
  onSprintReopened,
  onSprintUpdated,
  onSprintDeleted,
  onUserCreated,
  onUserUpdated,
  onUserDeleted,
  onPropertyCreated,
  onPropertyUpdated,
  onPropertyStatusChanged,
  onPropertiesReordered
}) => {
  const [activeTab, setActiveTab] = useState<'sprints' | 'users' | 'properties' | 'system'>('sprints');
  const [actionLoading, setActionLoading] = useState(false);
  const dialogRef = useModalDialog({
    isOpen,
    onClose,
    canClose: !actionLoading
  });
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

  // Properties Manager State
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [isCreatingProperty, setIsCreatingProperty] = useState(false);
  const [propertyFormData, setPropertyFormData] = useState({
    name: '',
    code: '',
    color: '#3B82F6'
  });
  const [deactivatingProperty, setDeactivatingProperty] = useState<Property | null>(null);
  const [pendingPropertyTasks, setPendingPropertyTasks] = useState<{ id: number; title: string }[]>([]);
  const [loadingPendingTasks, setLoadingPendingTasks] = useState(false);

  // Drag & Drop Hébergements (Pointer Events)
  const [draggedPropertyId, setDraggedPropertyId] = useState<number | null>(null);
  const [dropPropertyTarget, setDropPropertyTarget] = useState<{ id: number; position: 'before' | 'after' } | null>(null);
  const propertiesScrollRef = useRef<HTMLDivElement>(null);
  const propertiesListRef = useRef<HTMLDivElement>(null);
  const activePropDragRef = useRef<{ id: number; startY: number; isDragging: boolean } | null>(null);
  const dropPropTargetRef = useRef<{ id: number; position: 'before' | 'after' } | null>(null);
  const propDragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      propDragCleanupRef.current?.();
    };
  }, []);

  const showFeedback = useCallback((type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 4500);
  }, []);

  const startPropertyPointerDrag = useCallback(
    (e: React.PointerEvent, propertyId: number) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.stopPropagation();

      propDragCleanupRef.current?.();
      activePropDragRef.current = {
        id: propertyId,
        startY: e.clientY,
        isDragging: false
      };
      dropPropTargetRef.current = null;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const drag = activePropDragRef.current;
        if (!drag) return;

        if (!drag.isDragging) {
          if (Math.abs(moveEvent.clientY - drag.startY) < 4) {
            return;
          }
          drag.isDragging = true;
          document.body.style.userSelect = 'none';
          setDraggedPropertyId(drag.id);
        }

        const scrollBox = propertiesScrollRef.current;
        if (scrollBox) {
          const boxRect = scrollBox.getBoundingClientRect();
          if (moveEvent.clientY < boxRect.top + 36) {
            scrollBox.scrollTop -= 10;
          } else if (moveEvent.clientY > boxRect.bottom - 36) {
            scrollBox.scrollTop += 10;
          }
        }

        const listEl = propertiesListRef.current;
        if (!listEl) return;

        const siblingEls = Array.from(listEl.querySelectorAll<HTMLElement>('[data-property-row]'))
          .filter(el => Number(el.dataset.propertyRow) !== drag.id)
          .map(el => ({
            id: Number(el.dataset.propertyRow),
            rect: el.getBoundingClientRect()
          }))
          .filter(item => item.id > 0)
          .sort((a, b) => a.rect.top - b.rect.top);

        if (siblingEls.length === 0) {
          dropPropTargetRef.current = null;
          setDropPropertyTarget(null);
          return;
        }

        let nextTarget: { id: number; position: 'before' | 'after' } = {
          id: siblingEls[siblingEls.length - 1].id,
          position: 'after'
        };

        for (const item of siblingEls) {
          const midpoint = item.rect.top + item.rect.height / 2;
          if (moveEvent.clientY < midpoint) {
            nextTarget = { id: item.id, position: 'before' };
            break;
          }
        }

        const prev = dropPropTargetRef.current;
        if (!prev || prev.id !== nextTarget.id || prev.position !== nextTarget.position) {
          dropPropTargetRef.current = nextTarget;
          setDropPropertyTarget(nextTarget);
        }
      };

      const cleanup = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
        document.body.style.userSelect = '';
        propDragCleanupRef.current = null;
      };

      const handlePointerUp = async () => {
        const drag = activePropDragRef.current;
        const target = dropPropTargetRef.current;

        activePropDragRef.current = null;
        dropPropTargetRef.current = null;
        setDraggedPropertyId(null);
        setDropPropertyTarget(null);
        cleanup();

        if (!drag?.isDragging || !target) return;

        const activeProps = properties.filter(p => Number(p.is_active) === 1);
        const inactiveProps = properties.filter(p => Number(p.is_active) !== 1);
        const fromIdx = activeProps.findIndex(p => p.id === drag.id);
        const targetIdx = activeProps.findIndex(p => p.id === target.id);
        if (fromIdx === -1 || targetIdx === -1) return;

        const reorderedActive = [...activeProps];
        const [moved] = reorderedActive.splice(fromIdx, 1);
        const adjustedTargetIdx = reorderedActive.findIndex(p => p.id === target.id);
        const insertIdx = target.position === 'after' ? adjustedTargetIdx + 1 : adjustedTargetIdx;
        reorderedActive.splice(insertIdx, 0, moved);

        const nextAll = [...reorderedActive, ...inactiveProps].map((p, idx) => ({
          ...p,
          position: idx + 1
        }));

        const previousProps = properties;
        onPropertiesReordered(nextAll);

        try {
          const res = await api.reorderProperties(nextAll.map(p => p.id));
          if (res?.properties) {
            onPropertiesReordered(res.properties);
          }
        } catch (err: any) {
          onPropertiesReordered(previousProps);
          showFeedback('error', err?.message || "Erreur lors de la sauvegarde de l'ordre des hébergements.");
        }
      };

      propDragCleanupRef.current = cleanup;
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    },
    [properties, onPropertiesReordered, showFeedback]
  );

  if (!isOpen) return null;

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
        const res = await api.createUser(userFormData);
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
        const res = await api.updateUser(editingUser.id, payload);
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
      await api.deleteUser(deletingUserId);
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
  const activePropertiesCount = properties.filter(p => Number(p.is_active) === 1).length;

  // --- PROPERTY HANDLERS ---
  const handleStartCreateProperty = () => {
    setEditingProperty(null);
    setDeactivatingProperty(null);
    setIsCreatingProperty(true);
    setPropertyFormData({
      name: '',
      code: '',
      color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]
    });
  };

  const handleStartEditProperty = (p: Property) => {
    setIsCreatingProperty(false);
    setDeactivatingProperty(null);
    setEditingProperty(p);
    setPropertyFormData({
      name: p.name,
      code: p.code || '',
      color: p.color || '#3B82F6'
    });
  };

  const handlePropertyNameChange = (name: string) => {
    let code = propertyFormData.code;
    if (!editingProperty) {
      const parts = name.trim().split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        code = (parts[0][0] + parts[1][0]).toUpperCase();
      } else if (name.trim().length >= 2) {
        code = name.trim().slice(0, 2).toUpperCase();
      } else {
        code = name.trim().toUpperCase();
      }
    }
    setPropertyFormData(prev => ({ ...prev, name, code }));
  };

  const handleSaveProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyFormData.name.trim()) {
      showFeedback('error', "Le nom de l'hébergement est obligatoire.");
      return;
    }

    setActionLoading(true);
    try {
      if (isCreatingProperty) {
        const res = await api.createProperty({
          name: propertyFormData.name.trim(),
          code: propertyFormData.code.trim().toUpperCase(),
          color: propertyFormData.color
        });
        onPropertyCreated(res.property);
        showFeedback('success', res.message);
        setIsCreatingProperty(false);
      } else if (editingProperty) {
        const res = await api.updateProperty(editingProperty.id, {
          name: propertyFormData.name.trim(),
          code: propertyFormData.code.trim().toUpperCase(),
          color: propertyFormData.color
        });
        onPropertyUpdated(res.property);
        showFeedback('success', res.message);
        setEditingProperty(null);
      }
    } catch (err: any) {
      showFeedback('error', err?.message || "Erreur lors de l'enregistrement de l'hébergement.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestDeactivateProperty = async (p: Property) => {
    setIsCreatingProperty(false);
    setEditingProperty(null);
    setDeactivatingProperty(p);
    setPendingPropertyTasks([]);
    setLoadingPendingTasks(true);
    try {
      const res = await api.getPropertyPendingTasks(p.id);
      setPendingPropertyTasks(res.tasks.map(t => ({ id: t.id, title: t.title })));
    } catch (err: any) {
      showFeedback('error', err?.message || 'Impossible de vérifier les tâches en cours.');
      setDeactivatingProperty(null);
    } finally {
      setLoadingPendingTasks(false);
    }
  };

  const handleConfirmDeactivateProperty = async (pendingAction?: 'detach' | 'delete') => {
    if (!deactivatingProperty) return;
    setActionLoading(true);
    try {
      const res = await api.deactivateProperty(deactivatingProperty.id, pendingAction);
      await onPropertyStatusChanged(res.property);
      showFeedback('success', res.message);
      setDeactivatingProperty(null);
      setPendingPropertyTasks([]);
    } catch (err: any) {
      showFeedback('error', err?.message || "Impossible de désactiver cet hébergement.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivateProperty = async (p: Property) => {
    setActionLoading(true);
    try {
      const res = await api.reactivateProperty(p.id);
      await onPropertyStatusChanged(res.property);
      showFeedback('success', res.message);
    } catch (err: any) {
      showFeedback('error', err?.message || "Impossible de réactiver cet hébergement.");
    } finally {
      setActionLoading(false);
    }
  };

  const renderPropertyFormCard = (mode: 'create' | 'edit', heading: string, onCancel: () => void) => (
    <div className={`bg-slate-50 border-2 border-brand-200 rounded-3xl p-4 sm:p-5 animate-fade-in shadow-xs ${
      mode === 'edit' ? 'ml-2 sm:ml-4' : ''
    }`}>
      <div className="flex items-center justify-between pb-3 border-b border-black/[0.12] mb-4">
        <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
          <Home className="w-4 h-4 text-brand-600" strokeWidth={2.25} />
          {heading}
        </h4>
        <button
          type="button"
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          <X className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </div>

      <form onSubmit={handleSaveProperty} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nom de l'hébergement *
            </label>
            <input
              type="text"
              required
              value={propertyFormData.name}
              onChange={(e) => handlePropertyNameChange(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-black/[0.12] rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white"
              placeholder="Ex: Chez Denise, Studio Mel..."
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Code court
            </label>
            <input
              type="text"
              maxLength={10}
              value={propertyFormData.code}
              onChange={(e) => setPropertyFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
              className="w-full px-3 py-2 text-xs border border-black/[0.12] rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white uppercase font-bold text-center"
              placeholder="CD"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-slate-500" strokeWidth={2.25} />
            Couleur du badge :
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            {PRESET_COLORS.map(c => (
              <button
                type="button"
                key={c}
                onClick={() => setPropertyFormData(prev => ({ ...prev, color: c }))}
                className={`w-7 h-7 rounded-full border-2 transition-all cursor-pointer ${
                  propertyFormData.color === c
                    ? 'border-slate-900 scale-110 shadow-md ring-2 ring-brand-300'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              value={propertyFormData.color}
              onChange={(e) => setPropertyFormData(prev => ({ ...prev, color: e.target.value }))}
              className="w-8 h-8 rounded-lg border border-black/[0.12] cursor-pointer p-0.5 bg-white"
              title="Couleur personnalisée"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.12]">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={actionLoading}
            className="px-5 py-2 text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" strokeWidth={2.25} />
            {mode === 'create' ? "Créer l'hébergement" : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[var(--cdh-backdrop-scrim)] backdrop-blur-[6px] flex items-end sm:items-center justify-center p-0 sm:p-6 animate-backdrop-in"
      onClick={() => !actionLoading && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-panel-modal-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="cdh-glass-overlay rounded-t-cdh-2xl sm:rounded-cdh-2xl max-w-5xl w-full overflow-hidden flex flex-col max-h-[92dvh] animate-sheet-up sm:animate-modal-in focus:outline-none"
      >
        
        {/* Header Modal */}
        <div className="bg-slate-900 p-4 sm:p-6 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-brand-600 flex items-center justify-center shadow-sm ring-1 ring-white/15">
              <Shield className="w-6 h-6 text-white" strokeWidth={2.25} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="admin-panel-modal-title" className="text-lg sm:text-xl font-black tracking-tight">Panneau d'Administration</h2>
                <span className="text-[11px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30">
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
            aria-label="Fermer le panneau d'administration"
            className="p-2 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            title="Fermer"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-50 border-b border-black/[0.12] px-3 sm:px-5 pt-2 flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
          <button
            onClick={() => {
              setActiveTab('sprints');
              setEditingSprint(null);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'sprints'
                ? 'bg-white text-slate-900 border-brand-600'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <RotateCcw className="w-4 h-4 text-brand-600" strokeWidth={2.25} />
            Gestion des Sprints ({sprints.length})
          </button>

          <button
            onClick={() => {
              setActiveTab('users');
              setIsCreatingUser(false);
              setEditingUser(null);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'users'
                ? 'bg-white text-slate-900 border-brand-600'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4 text-brand-600" strokeWidth={2.25} />
            Associés & Droits ({users.length})
          </button>

          <button
            onClick={() => {
              setActiveTab('properties');
              setIsCreatingProperty(false);
              setEditingProperty(null);
              setDeactivatingProperty(null);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'properties'
                ? 'bg-white text-slate-900 border-brand-600'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <Home className="w-4 h-4 text-brand-600" strokeWidth={2.25} />
            Hébergements ({activePropertiesCount})
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'system'
                ? 'bg-white text-slate-900 border-slate-800'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <Info className="w-4 h-4 text-slate-700" strokeWidth={2.25} />
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
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={1.75} />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" strokeWidth={1.75} />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        )}

        {/* Body Content */}
        <div ref={propertiesScrollRef} className="p-5 sm:p-6 overflow-y-auto flex-1">
          
          {/* ======================================================== */}
          {/* TAB 1 : GESTION DES SPRINTS (AVEC RÉOUVERTURE) */}
          {/* ======================================================== */}
          {activeTab === 'sprints' && (
            <div className="space-y-6">
              
              {/* Info banner sur la réouverture */}
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-3xl p-4 flex items-start gap-3.5">
                <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-xs shrink-0 mt-0.5">
                  <RotateCcw className="w-4 h-4" strokeWidth={2} />
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
                <div className="bg-slate-50 border-2 border-indigo-200 rounded-3xl p-4 sm:p-5 animate-fade-in shadow-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-black/[0.12] mb-4">
                    <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                      <Edit2 className="w-4 h-4 text-indigo-600" strokeWidth={2.25} />
                      Modifier les informations du sprint : {editingSprint.name}
                    </h3>
                    <button
                      onClick={() => setEditingSprint(null)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" strokeWidth={1.75} />
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
                          className="w-full px-3 py-2 text-xs border border-black/[0.12] rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
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
                          className="w-full px-3 py-2 text-xs border border-black/[0.12] rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
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
                          className="w-full px-3 py-2 text-xs border border-black/[0.12] rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
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
                          className="w-full px-3 py-2 text-xs border border-black/[0.12] rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                          placeholder="Notes de clôture..."
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingSprint(null)}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" strokeWidth={2.25} />
                        Enregistrer les modifications
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Confirmation Réouverture Modal / Dialog */}
              {sprintToReopen && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-4 sm:p-5 animate-fade-in shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-600 text-white rounded-lg shrink-0">
                      <RotateCcw className="w-5 h-5" strokeWidth={2} />
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
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
                        >
                          <Unlock className="w-3.5 h-3.5" strokeWidth={2.25} />
                          Oui, réouvrir ce sprint
                        </button>
                        <button
                          onClick={() => setSprintToReopen(null)}
                          className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs rounded-lg cursor-pointer"
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
                <div className="bg-red-50 border-2 border-red-300 rounded-3xl p-4 sm:p-5 animate-fade-in shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-red-600 text-white rounded-lg shrink-0">
                      <Trash2 className="w-5 h-5" strokeWidth={2} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-sm text-red-950">
                        Supprimer le sprint {sprintToDelete.name} ?
                      </h4>
                      <p className="text-xs text-red-900 mt-1 leading-relaxed">
                        Cette action supprimera définitivement le sprint ainsi que ses questions. Les tâches exclusives à ce sprint seront supprimées (celles également présentes dans d'autres sprints resteront conservées). Cette action est irréversible.
                      </p>
                      <div className="flex items-center gap-2 mt-4">
                        <button
                          onClick={handleConfirmDeleteSprint}
                          disabled={actionLoading}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer"
                        >
                          Confirmer la suppression
                        </button>
                        <button
                          onClick={() => setSprintToDelete(null)}
                          className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs rounded-lg cursor-pointer"
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
                        className={`p-4 rounded-3xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isActive
                            ? 'bg-emerald-50/50 border-emerald-300 shadow-xs'
                            : 'bg-white border-black/[0.12] hover:border-black/[0.22]'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 shadow-xs ${
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
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                                  <Unlock className="w-3 h-3 text-emerald-700" strokeWidth={2.25} />
                                  Sprint Actif (En cours)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-black/[0.12]">
                                  <Lock className="w-3 h-3 text-slate-500" strokeWidth={2.25} />
                                  Clôturé (Lecture seule)
                                </span>
                              )}

                              {isSelected && (
                                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-brand-50 text-brand-800 border border-brand-200">
                                  Affiché à l'écran
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" strokeWidth={1.5} />
                                Débuté le {new Date(s.started_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                              {s.closed_at && (
                                <span className="flex items-center gap-1 text-slate-400">
                                  <Clock className="w-3 h-3" strokeWidth={1.5} />
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
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all shadow-2xs hover:shadow-xs cursor-pointer"
                              title="Réouvrir ce sprint fermé par erreur pour autoriser de nouveau les modifications"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-indigo-600" strokeWidth={2.25} />
                              <span>Réouvrir ce sprint</span>
                            </button>
                          )}

                          {/* Modifier */}
                          <button
                            type="button"
                            onClick={() => handleStartEditSprint(s)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Modifier les détails du sprint"
                          >
                            <Edit2 className="w-4 h-4" strokeWidth={1.75} />
                          </button>

                          {/* Supprimer (si plus d'un sprint) */}
                          {sprints.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setSprintToDelete(s)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Supprimer ce sprint"
                            >
                              <Trash2 className="w-4 h-4" strokeWidth={1.75} />
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
              
              <div className="flex items-center justify-between pb-3 border-b border-black/[0.12]">
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
                    <UserPlus className="w-4 h-4" strokeWidth={2.25} />
                    Nouvel associé
                  </button>
                )}
              </div>

              {/* Formulaire Utilisateur (Création ou Édition) */}
              {(isCreatingUser || editingUser) && (
                <div className="bg-slate-50 border-2 border-purple-200 rounded-3xl p-4 sm:p-5 animate-fade-in shadow-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-black/[0.12] mb-4">
                    <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-purple-600" strokeWidth={2.25} />
                      {isCreatingUser ? 'Créer un nouvel associé' : `Modifier l'associé : ${editingUser?.name}`}
                    </h4>
                    <button
                      onClick={() => {
                        setIsCreatingUser(false);
                        setEditingUser(null);
                      }}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" strokeWidth={1.75} />
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
                          className="w-full px-3 py-2 text-xs border border-black/[0.12] rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
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
                          className="w-full px-3 py-2 text-xs border border-black/[0.12] rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
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
                          className="w-full px-3 py-2 text-xs border border-black/[0.12] rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
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
                          className="w-full px-3 py-2 text-xs border border-black/[0.12] rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white uppercase font-bold text-center"
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
                          className="w-full px-3 py-2 text-xs border border-black/[0.12] rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                          placeholder={isCreatingUser ? 'Définir un mot de passe' : 'Laisser vide pour ne pas changer'}
                        />
                      </div>
                    </div>

                    {/* Palette de couleur avatar */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        <Palette className="w-3.5 h-3.5 text-slate-500" strokeWidth={2.25} />
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

                    <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.12]">
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingUser(false);
                          setEditingUser(null);
                        }}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="px-5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" strokeWidth={2.25} />
                        {isCreatingUser ? 'Créer le compte' : 'Sauvegarder'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Confirmation Suppression Utilisateur */}
              {deletingUserId && (
                <div className="bg-red-50 border-2 border-red-300 rounded-3xl p-4 animate-fade-in shadow-xs flex items-start gap-3">
                  <div className="p-2 bg-red-600 text-white rounded-lg shrink-0">
                    <Trash2 className="w-4 h-4" strokeWidth={2} />
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
                        className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer"
                      >
                        Supprimer définitivement
                      </button>
                      <button
                        onClick={() => setDeletingUserId(null)}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs rounded-lg cursor-pointer"
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
                      className="p-3.5 sm:p-4 rounded-3xl border border-black/[0.12] bg-white hover:border-black/[0.22] transition-all flex items-center justify-between gap-3"
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
                              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-brand-50 text-brand-800 border border-brand-200">
                                C'est vous
                              </span>
                            )}
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                              u.role === 'admin'
                                ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                : u.role === 'write'
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border border-black/[0.12]'
                            }`}>
                              {u.role === 'admin' ? <Shield className="w-2.5 h-2.5" strokeWidth={2.25} /> : u.role === 'write' ? <UserCheck className="w-2.5 h-2.5" strokeWidth={2.25} /> : <Eye className="w-2.5 h-2.5" strokeWidth={2.25} />}
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
                          className="p-2 text-slate-500 hover:text-purple-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Modifier le compte ou changer le mot de passe"
                        >
                          <Edit2 className="w-4 h-4" strokeWidth={1.75} />
                        </button>

                        {!isCurrent && !isLastAdmin && (
                          <button
                            onClick={() => setDeletingUserId(u.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Supprimer ce compte"
                          >
                            <Trash2 className="w-4 h-4" strokeWidth={1.75} />
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
          {/* TAB 3 : GESTION DES HÉBERGEMENTS (SOFT DELETE) */}
          {/* ======================================================== */}
          {activeTab === 'properties' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/[0.12]">
                <div>
                  <h3 className="font-bold text-base text-slate-800">Hébergements / Logements</h3>
                  <p className="text-xs text-slate-500">
                    Ajoutez, modifiez ou désactivez un hébergement tout en préservant l'historique des sprints passés.
                  </p>
                </div>
                {!isCreatingProperty && !editingProperty && (
                  <button
                    onClick={handleStartCreateProperty}
                    className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4" strokeWidth={2.25} />
                    Nouvel hébergement
                  </button>
                )}
              </div>

              <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-3.5 flex items-start gap-3 text-xs text-blue-950">
                <Archive className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" strokeWidth={1.5} />
                <span>
                  Pour préserver l'historique des sprints archivés, les hébergements ne peuvent pas être supprimés définitivement : ils sont <strong>désactivés</strong>. Glissez-déposez les poignées à gauche des hébergements actifs pour définir leur ordre d'affichage dans toute l'application.
                </span>
              </div>

              {/* Formulaire Création Hébergement (en haut de liste) */}
              {isCreatingProperty &&
                renderPropertyFormCard('create', 'Ajouter un nouvel hébergement', () => setIsCreatingProperty(false))}

              {/* Dialogue de confirmation de désactivation (soft delete) avec gestion des tâches en cours */}
              {deactivatingProperty && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-4 sm:p-5 animate-fade-in shadow-xs space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-600 text-white rounded-lg shrink-0">
                      <PowerOff className="w-4 h-4" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-amber-950">
                        Désactiver l'hébergement « {deactivatingProperty.name} » ?
                      </h4>

                      {loadingPendingTasks ? (
                        <p className="text-xs text-amber-800 mt-1.5">
                          Vérification des tâches non réalisées sur le sprint en cours...
                        </p>
                      ) : pendingPropertyTasks.length > 0 ? (
                        <div className="mt-2 space-y-2.5">
                          <p className="text-xs text-amber-900">
                            <strong>{pendingPropertyTasks.length}</strong> tâche{pendingPropertyTasks.length > 1 ? 's' : ''} non réalisée{pendingPropertyTasks.length > 1 ? 's' : ''} est/sont encore affiliée{pendingPropertyTasks.length > 1 ? 's' : ''} à cet hébergement dans le sprint en cours :
                          </p>

                          <ul className="bg-white/90 border border-amber-200 rounded-xl p-3 space-y-1.5 max-h-44 overflow-y-auto">
                            {pendingPropertyTasks.map(t => (
                              <li key={t.id} className="text-xs font-semibold text-slate-800 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                <span className="break-words">{t.title}</span>
                              </li>
                            ))}
                          </ul>

                          <p className="text-[11px] text-amber-900">
                            Choisissez comment traiter ces tâches dans le sprint en cours avant la désactivation :
                          </p>

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleConfirmDeactivateProperty('detach')}
                              className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer transition-colors"
                            >
                              Passer les tâches à traiter (Sans logement)
                            </button>
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleConfirmDeactivateProperty('delete')}
                              className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer transition-colors"
                            >
                              Supprimer ces tâches du sprint en cours
                            </button>
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => {
                                setDeactivatingProperty(null);
                                setPendingPropertyTasks([]);
                              }}
                              className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs rounded-lg cursor-pointer"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 space-y-3">
                          <p className="text-xs text-amber-900">
                            Aucune tâche non réalisée n'est rattachée à cet hébergement dans le sprint en cours. Il restera visible dans les sprints archivés où il a été utilisé.
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleConfirmDeactivateProperty()}
                              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer"
                            >
                              Confirmer la désactivation
                            </button>
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => setDeactivatingProperty(null)}
                              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs rounded-lg cursor-pointer"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Liste des hébergements (actifs réordonnables en drag & drop + désactivés) */}
              <div ref={propertiesListRef} className="space-y-2.5">
                {properties.map((p) => {
                  const isActive = Number(p.is_active) === 1;
                  const isEditingThis = editingProperty?.id === p.id;
                  const isDragged = draggedPropertyId === p.id;
                  const isDropBefore = dropPropertyTarget?.id === p.id && dropPropertyTarget?.position === 'before';
                  const isDropAfter = dropPropertyTarget?.id === p.id && dropPropertyTarget?.position === 'after';

                  return (
                    <div
                      key={p.id}
                      {...(isActive ? { 'data-property-row': p.id } : {})}
                      className={`relative space-y-2 transition-opacity ${
                        isDragged ? 'opacity-40' : ''
                      }`}
                    >
                      {isDropBefore && (
                        <div className="pointer-events-none absolute -top-1.5 left-0 right-0 z-10 h-1 rounded-full bg-brand-500 shadow-xs" />
                      )}

                      <div
                        onPointerDown={(e) => {
                          if (!isActive) return;
                          const target = e.target as HTMLElement;
                          if (target.closest('button, input, select, textarea, a')) return;
                          startPropertyPointerDrag(e, p.id);
                        }}
                        className={`p-3.5 sm:p-4 rounded-3xl border transition-all flex items-center justify-between gap-3 select-none ${
                          isEditingThis
                            ? 'bg-brand-50/30 border-brand-300 ring-1 ring-brand-200'
                            : isActive
                            ? 'bg-white border-black/[0.12] hover:border-black/[0.22]'
                            : 'bg-slate-50/80 border-black/[0.12] opacity-80'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          {isActive && (
                            <button
                              type="button"
                              onPointerDown={(e) => {
                                e.preventDefault();
                                startPropertyPointerDrag(e, p.id);
                              }}
                              className="p-1 -ml-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-grab active:cursor-grabbing shrink-0 touch-none"
                              title="Maintenir et glisser pour réordonner"
                            >
                              <GripVertical className="w-4 h-4" strokeWidth={1.75} />
                            </button>
                          )}

                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-xs shrink-0 ${
                              isActive ? '' : 'grayscale opacity-70'
                            }`}
                            style={{ backgroundColor: p.color || '#3B82F6' }}
                          >
                            <Home className="w-5 h-5" strokeWidth={2} />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className={`font-bold text-sm truncate ${isActive ? 'text-slate-900' : 'text-slate-600'}`}>
                                {p.name}
                              </h4>
                              {p.code && (
                                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-black/[0.12]">
                                  {p.code}
                                </span>
                              )}
                              {isActive ? (
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200">
                                  Actif
                                </span>
                              ) : (
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 border border-black/[0.12]">
                                  Désactivé
                                </span>
                              )}
                            </div>
                            {!isActive && p.deleted_at && (
                              <p className="text-[11px] text-slate-600 mt-0.5">
                                Désactivé le {new Date(p.deleted_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => (isEditingThis ? setEditingProperty(null) : handleStartEditProperty(p))}
                            className={`p-2 rounded-lg transition-colors cursor-pointer ${
                              isEditingThis
                                ? 'text-brand-700 bg-brand-100'
                                : 'text-slate-500 hover:text-brand-600 hover:bg-slate-100'
                            }`}
                            title="Modifier cet hébergement"
                          >
                            <Edit2 className="w-4 h-4" strokeWidth={1.75} />
                          </button>

                          {isActive ? (
                            <button
                              type="button"
                              onClick={() => handleRequestDeactivateProperty(p)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                              title="Désactiver cet hébergement (soft delete)"
                            >
                              <PowerOff className="w-3.5 h-3.5" strokeWidth={2} />
                              <span>Désactiver</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleReactivateProperty(p)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                              title="Réactiver cet hébergement"
                            >
                              <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
                              <span>Réactiver</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Card d'édition affichée juste en dessous du logement modifié */}
                      {isEditingThis &&
                        renderPropertyFormCard('edit', `Modifier l'hébergement : ${p.name}`, () => setEditingProperty(null))}

                      {isDropAfter && (
                        <div className="pointer-events-none absolute -bottom-1.5 left-0 right-0 z-10 h-1 rounded-full bg-brand-500 shadow-xs" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4 : SÉCURITÉ & STATUT SYSTÈME */}
          {/* ======================================================== */}
          {activeTab === 'system' && (
            <div className="space-y-5">
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-slate-50 p-4 rounded-2xl border border-black/[0.12]">
                  <span className="text-slate-500 font-medium">Sprints enregistrés</span>
                  <div className="text-xl font-black text-slate-900 mt-1">{sprints.length}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-black/[0.12]">
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

              <div className="bg-slate-50 rounded-2xl p-5 border border-black/[0.12] space-y-3">
                <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-purple-600" strokeWidth={2.25} />
                  Règles & Sécurité actives sur l'API
                </h4>

                <ul className="text-xs text-slate-600 space-y-2 leading-relaxed">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" strokeWidth={1.5} />
                    <span><strong>Mise en avant des tâches (étoile)</strong> : réservée strictement au propriétaire de la tâche (ou administrateur). Seules ces tâches sont affichées par défaut en réunion hebdomadaire.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" strokeWidth={1.5} />
                    <span><strong>Bascule & Réouverture</strong> : seul un administrateur peut clôturer ou réouvrir un sprint fermé par erreur.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" strokeWidth={1.5} />
                    <span><strong>Anti force-brute</strong> : limitation automatique des tentatives de mot de passe par IP (max 10 tentatives échouées / 10 minutes).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" strokeWidth={1.5} />
                    <span><strong>Hachage fort</strong> : cryptographie des mots de passe gérée via BCRYPT et sessions révoquées à la déconnexion.</span>
                  </li>
                </ul>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-6 py-3 border-t border-black/[0.12] flex items-center justify-between text-xs text-slate-500 shrink-0">
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
