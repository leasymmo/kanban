import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Edit2,
  GripVertical,
  Home,
  Plus,
  PowerOff,
  RotateCcw,
} from 'lucide-react';
import { Property } from '../../types';
import { api } from '../../api/client';
import { ensureWhiteTextContrast } from '../../utils/color';
import { Badge, Button, Input, useConfirm } from '../ui';
import { ADMIN_PRESET_COLORS, ColorSwatchPicker } from './ColorSwatchPicker';

interface AdminPropertiesTabProps {
  properties: Property[];
  actionLoading: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onPropertyCreated: (newProperty: Property) => void;
  onPropertyUpdated: (updatedProperty: Property) => void;
  onPropertyStatusChanged: (updatedProperty: Property) => Promise<void>;
  onPropertiesReordered: (orderedProperties: Property[]) => void;
  onFeedback: (type: 'success' | 'error', text: string) => void;
  setActionLoading: (loading: boolean) => void;
}

/**
 * Onglet d'administration des hébergements : création, édition, réordonnancement drag-and-drop et archivage sécurisé.
 */
export const AdminPropertiesTab: React.FC<AdminPropertiesTabProps> = ({
  properties,
  actionLoading,
  scrollContainerRef,
  onPropertyCreated,
  onPropertyUpdated,
  onPropertyStatusChanged,
  onPropertiesReordered,
  onFeedback,
  setActionLoading,
}) => {
  const confirm = useConfirm();
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    color: '#3B82F6',
  });

  // Désactivation avec résolution des tâches en cours
  const [deactivatingProperty, setDeactivatingProperty] = useState<Property | null>(null);
  const [pendingTasks, setPendingTasks] = useState<{ id: number; title: string }[]>([]);

  // Drag & Drop Hébergements (Pointer Events)
  const [draggedPropertyId, setDraggedPropertyId] = useState<number | null>(null);
  const [dropPropertyTarget, setDropPropertyTarget] = useState<{
    id: number;
    position: 'before' | 'after';
  } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const activeDragRef = useRef<{ id: number; startY: number; isDragging: boolean } | null>(null);
  const dropTargetRef = useRef<{ id: number; position: 'before' | 'after' } | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  const startPointerDrag = useCallback(
    (e: React.PointerEvent, propertyId: number) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.stopPropagation();

      dragCleanupRef.current?.();
      activeDragRef.current = {
        id: propertyId,
        startY: e.clientY,
        isDragging: false,
      };
      dropTargetRef.current = null;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const drag = activeDragRef.current;
        if (!drag) return;

        if (!drag.isDragging) {
          if (Math.abs(moveEvent.clientY - drag.startY) < 4) return;
          drag.isDragging = true;
          document.body.style.userSelect = 'none';
          setDraggedPropertyId(drag.id);
        }

        const scrollBox = scrollContainerRef.current;
        if (scrollBox) {
          const boxRect = scrollBox.getBoundingClientRect();
          if (moveEvent.clientY < boxRect.top + 36) {
            scrollBox.scrollTop -= 10;
          } else if (moveEvent.clientY > boxRect.bottom - 36) {
            scrollBox.scrollTop += 10;
          }
        }

        const listEl = listRef.current;
        if (!listEl) return;

        const siblingEls = Array.from(listEl.querySelectorAll<HTMLElement>('[data-property-row]'))
          .filter((el) => Number(el.dataset.propertyRow) !== drag.id)
          .map((el) => ({
            id: Number(el.dataset.propertyRow),
            rect: el.getBoundingClientRect(),
          }))
          .filter((item) => item.id > 0)
          .sort((a, b) => a.rect.top - b.rect.top);

        if (siblingEls.length === 0) {
          dropTargetRef.current = null;
          setDropPropertyTarget(null);
          return;
        }

        let nextTarget: { id: number; position: 'before' | 'after' } = {
          id: siblingEls[siblingEls.length - 1].id,
          position: 'after',
        };

        for (const item of siblingEls) {
          const midpoint = item.rect.top + item.rect.height / 2;
          if (moveEvent.clientY < midpoint) {
            nextTarget = { id: item.id, position: 'before' };
            break;
          }
        }

        const prev = dropTargetRef.current;
        if (!prev || prev.id !== nextTarget.id || prev.position !== nextTarget.position) {
          dropTargetRef.current = nextTarget;
          setDropPropertyTarget(nextTarget);
        }
      };

      const cleanup = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
        document.body.style.userSelect = '';
        dragCleanupRef.current = null;
      };

      const handlePointerUp = async () => {
        const drag = activeDragRef.current;
        const target = dropTargetRef.current;

        activeDragRef.current = null;
        dropTargetRef.current = null;
        setDraggedPropertyId(null);
        setDropPropertyTarget(null);
        cleanup();

        if (!drag?.isDragging || !target) return;

        const activeProps = properties.filter((p) => Number(p.is_active) === 1);
        const inactiveProps = properties.filter((p) => Number(p.is_active) !== 1);
        const fromIdx = activeProps.findIndex((p) => p.id === drag.id);
        const targetIdx = activeProps.findIndex((p) => p.id === target.id);
        if (fromIdx === -1 || targetIdx === -1) return;

        const reorderedActive = [...activeProps];
        const [moved] = reorderedActive.splice(fromIdx, 1);
        const adjustedTargetIdx = reorderedActive.findIndex((p) => p.id === target.id);
        const insertIdx = target.position === 'after' ? adjustedTargetIdx + 1 : adjustedTargetIdx;
        reorderedActive.splice(insertIdx, 0, moved);

        const nextAll = [...reorderedActive, ...inactiveProps].map((p, idx) => ({
          ...p,
          position: idx + 1,
        }));

        const previousProps = properties;
        onPropertiesReordered(nextAll);

        try {
          const res = await api.reorderProperties(nextAll.map((p) => p.id));
          if (res?.properties) {
            onPropertiesReordered(res.properties);
          }
        } catch (err: unknown) {
          onPropertiesReordered(previousProps);
          const msg =
            err instanceof Error
              ? err.message
              : "Erreur lors de la sauvegarde de l'ordre des hébergements.";
          onFeedback('error', msg);
        }
      };

      dragCleanupRef.current = cleanup;
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    },
    [properties, onPropertiesReordered, onFeedback, scrollContainerRef]
  );

  const handleStartCreate = () => {
    setEditingProperty(null);
    setDeactivatingProperty(null);
    setIsCreating(true);
    setFormData({
      name: '',
      code: '',
      color: ADMIN_PRESET_COLORS[Math.floor(Math.random() * ADMIN_PRESET_COLORS.length)],
    });
  };

  const handleStartEdit = (p: Property) => {
    setIsCreating(false);
    setDeactivatingProperty(null);
    setEditingProperty(p);
    setFormData({
      name: p.name,
      code: p.code || '',
      color: p.color || '#3B82F6',
    });
  };

  const handleNameChange = (name: string) => {
    let code = formData.code;
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
    setFormData((prev) => ({ ...prev, name, code }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      onFeedback('error', "Le nom de l'hébergement est obligatoire.");
      return;
    }

    setActionLoading(true);
    try {
      if (isCreating) {
        const res = await api.createProperty({
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          color: formData.color,
        });
        onPropertyCreated(res.property);
        onFeedback('success', res.message);
        setIsCreating(false);
      } else if (editingProperty) {
        const res = await api.updateProperty(editingProperty.id, {
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          color: formData.color,
        });
        onPropertyUpdated(res.property);
        onFeedback('success', res.message);
        setEditingProperty(null);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Erreur lors de l'enregistrement de l'hébergement.";
      onFeedback('error', msg);
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDeactivate = async (p: Property, pendingAction?: 'detach' | 'delete') => {
    setActionLoading(true);
    try {
      const res = await api.deactivateProperty(p.id, pendingAction);
      await onPropertyStatusChanged(res.property);
      onFeedback('success', res.message);
      setDeactivatingProperty(null);
      setPendingTasks([]);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Impossible de désactiver cet hébergement.';
      onFeedback('error', msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestDeactivate = async (p: Property) => {
    setIsCreating(false);
    setEditingProperty(null);
    setActionLoading(true);
    try {
      const res = await api.getPropertyPendingTasks(p.id);
      const tasks = res.tasks.map((t) => ({ id: t.id, title: t.title }));
      setActionLoading(false);

      if (tasks.length === 0) {
        const ok = await confirm({
          title: `Désactiver « ${p.name} » ?`,
          message:
            'Aucune tâche en cours. Les tâches terminées restent conservées dans les archives.',
          confirmLabel: 'Désactiver',
          cancelLabel: 'Annuler',
          variant: 'warning',
        });
        if (ok) {
          await confirmDeactivate(p);
        }
        return;
      }

      setDeactivatingProperty(p);
      setPendingTasks(tasks);
    } catch (err: unknown) {
      setActionLoading(false);
      const msg =
        err instanceof Error ? err.message : 'Impossible de vérifier les tâches en cours.';
      onFeedback('error', msg);
    }
  };

  const handleReactivate = async (p: Property) => {
    setActionLoading(true);
    try {
      const res = await api.reactivateProperty(p.id);
      await onPropertyStatusChanged(res.property);
      onFeedback('success', res.message);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Impossible de réactiver cet hébergement.';
      onFeedback('error', msg);
    } finally {
      setActionLoading(false);
    }
  };

  const renderFormCard = (mode: 'create' | 'edit', title: string, onCancel: () => void) => (
    <form
      onSubmit={handleSave}
      className="cdh-glass-column rounded-cdh-xl p-4 space-y-3.5 border border-[var(--cdh-border-subtle)]"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[13.5px] font-semibold text-[var(--cdh-text-primary)] flex items-center gap-2">
          {mode === 'create' ? (
            <Plus className="w-4 h-4 text-[var(--cdh-accent)]" strokeWidth={2} />
          ) : (
            <Edit2 className="w-4 h-4 text-[var(--cdh-accent)]" strokeWidth={2} />
          )}
          {title}
        </h3>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <Input
            label="Nom du logement *"
            type="text"
            required
            placeholder="Ex: Loft du Jardin"
            value={formData.name}
            onChange={(e) => handleNameChange(e.target.value)}
          />
        </div>
        <Input
          label="Code court"
          type="text"
          maxLength={6}
          placeholder="Ex: LJ"
          value={formData.code}
          onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
          className="uppercase font-semibold"
        />
      </div>

      <ColorSwatchPicker
        label="Couleur de badge"
        value={formData.color}
        onChange={(color) => setFormData({ ...formData, color })}
      />

      <div className="pt-2.5 border-t border-[var(--cdh-border-hairline)] flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" variant="primary" size="sm" isLoading={actionLoading}>
          {mode === 'create' ? 'Créer' : 'Enregistrer'}
        </Button>
      </div>
    </form>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-[12.5px] text-[var(--cdh-text-secondary)]">
          Glissez les logements actifs pour définir leur ordre d&apos;affichage. Les archives
          restent consultables.
        </p>

        {!isCreating && !editingProperty && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleStartCreate}
            leftIcon={<Plus className="w-3.5 h-3.5" strokeWidth={2} />}
            className="self-start sm:self-auto shrink-0"
          >
            Nouvel hébergement
          </Button>
        )}
      </div>

      {isCreating &&
        renderFormCard('create', 'Ajouter un hébergement', () => setIsCreating(false))}

      {deactivatingProperty && pendingTasks.length > 0 && (
        <div className="rounded-cdh-xl p-4 border border-[var(--cdh-warning-accent)]/40 bg-[var(--cdh-warning-soft)] space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="w-5 h-5 text-[var(--cdh-warning)] shrink-0 mt-0.5"
              strokeWidth={2}
            />
            <div className="min-w-0 flex-1 space-y-2">
              <h4 className="font-semibold text-[13.5px] text-[var(--cdh-text-primary)]">
                Désactiver « {deactivatingProperty.name} »
              </h4>
              <p className="text-[12.5px] text-[var(--cdh-text-secondary)]">
                <strong>{pendingTasks.length}</strong> tâche(s) en cours sont liées à ce logement.
                Choisissez comment les traiter :
              </p>

              <ul className="max-h-32 overflow-y-auto space-y-1">
                {pendingTasks.map((t) => (
                  <li
                    key={t.id}
                    className="cdh-surface-card rounded-cdh-sm px-2.5 py-1.5 text-[12px] font-medium text-[var(--cdh-text-primary)] border border-[var(--cdh-border-hairline)] truncate"
                  >
                    #{t.id} — {t.title}
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  variant="secondary"
                  isLoading={actionLoading}
                  onClick={() => confirmDeactivate(deactivatingProperty, 'detach')}
                >
                  Détacher les tâches et archiver
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  isLoading={actionLoading}
                  onClick={() => confirmDeactivate(deactivatingProperty, 'delete')}
                >
                  Supprimer les tâches et archiver
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDeactivatingProperty(null);
                    setPendingTasks([]);
                  }}
                >
                  Annuler
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div ref={listRef} className="space-y-2.5">
        {properties.map((p) => {
          const isActive = Number(p.is_active) === 1;
          const isEditingThis = editingProperty?.id === p.id;
          const isDragged = draggedPropertyId === p.id;
          const isDropBefore =
            isActive && dropPropertyTarget?.id === p.id && dropPropertyTarget.position === 'before';
          const isDropAfter =
            isActive && dropPropertyTarget?.id === p.id && dropPropertyTarget.position === 'after';

          const badgeBg = ensureWhiteTextContrast(p.color, '#3B82F6');

          return (
            <div key={p.id} className="relative space-y-2">
              {isDropBefore && (
                <div className="pointer-events-none absolute -top-1.5 left-0 right-0 z-10 h-1 rounded-full bg-[var(--cdh-accent)]" />
              )}

              <div
                data-property-row={isActive ? p.id : undefined}
                className={`cdh-surface-card rounded-cdh-xl p-3.5 sm:p-4 border transition-all flex items-center justify-between gap-3 ${
                  isDragged
                    ? 'opacity-45 scale-[0.99] border-[var(--cdh-accent)]'
                    : isActive
                    ? 'border-[var(--cdh-border-subtle)]'
                    : 'border-[var(--cdh-border-hairline)] opacity-75'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isActive && (
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        startPointerDrag(e, p.id);
                      }}
                      className="p-1 -ml-1 text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control)] rounded-cdh-sm cursor-grab active:cursor-grabbing shrink-0 touch-none transition-colors"
                      title="Maintenir et glisser pour réordonner"
                      aria-label={`Réordonner ${p.name}`}
                    >
                      <GripVertical className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  )}

                  <div
                    className={`w-9 h-9 rounded-cdh-md flex items-center justify-center text-white shrink-0 ring-1 ring-white/25 ${
                      isActive ? '' : 'grayscale opacity-70'
                    }`}
                    style={{ backgroundColor: badgeBg }}
                  >
                    <Home className="w-4 h-4" strokeWidth={2} />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4
                        className={`font-semibold text-[14px] truncate ${
                          isActive
                            ? 'text-[var(--cdh-text-primary)]'
                            : 'text-[var(--cdh-text-secondary)]'
                        }`}
                      >
                        {p.name}
                      </h4>
                      {p.code && <Badge variant="neutral">{p.code}</Badge>}
                      {isActive ? (
                        <Badge variant="success" pill>
                          Actif
                        </Badge>
                      ) : (
                        <Badge variant="neutral" pill>
                          <Archive className="w-2.5 h-2.5" strokeWidth={2} />
                          Archivé
                        </Badge>
                      )}
                    </div>
                    {!isActive && p.deleted_at && (
                      <p className="text-[11.5px] text-[var(--cdh-text-tertiary)] mt-0.5">
                        Désactivé le{' '}
                        {new Date(p.deleted_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant={isEditingThis ? 'secondary' : 'ghost'}
                    onClick={() => (isEditingThis ? setEditingProperty(null) : handleStartEdit(p))}
                    aria-label={`Modifier ${p.name}`}
                    title="Modifier cet hébergement"
                  >
                    <Edit2 className="w-4 h-4" strokeWidth={1.75} />
                  </Button>

                  {isActive ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={actionLoading}
                      onClick={() => handleRequestDeactivate(p)}
                      leftIcon={<PowerOff className="w-3.5 h-3.5 text-[var(--cdh-warning)]" strokeWidth={2} />}
                      title="Désactiver cet hébergement"
                    >
                      Désactiver
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={actionLoading}
                      onClick={() => handleReactivate(p)}
                      leftIcon={<RotateCcw className="w-3.5 h-3.5 text-[var(--cdh-success)]" strokeWidth={2} />}
                      title="Réactiver cet hébergement"
                    >
                      Réactiver
                    </Button>
                  )}
                </div>
              </div>

              {isEditingThis &&
                renderFormCard(
                  'edit',
                  `Modifier : ${p.name}`,
                  () => setEditingProperty(null)
                )}

              {isDropAfter && (
                <div className="pointer-events-none absolute -bottom-1.5 left-0 right-0 z-10 h-1 rounded-full bg-[var(--cdh-accent)]" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
