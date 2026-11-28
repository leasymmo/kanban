import React, { useState } from 'react';
import { Calendar, Clock, Edit2, Lock, RotateCcw, Trash2, Unlock } from 'lucide-react';
import { Sprint } from '../../types';
import { Badge, Button, DatePicker, Input, useConfirm } from '../ui';

interface AdminSprintsTabProps {
  sprints: Sprint[];
  currentSprintId: number | null;
  actionLoading: boolean;
  onSprintReopened: (sprintId: number) => Promise<void>;
  onSprintUpdated: (sprintId: number, data: Partial<Sprint>) => Promise<void>;
  onSprintDeleted: (sprintId: number) => Promise<void>;
  onFeedback: (type: 'success' | 'error', text: string) => void;
  setActionLoading: (loading: boolean) => void;
}

/**
 * Onglet d'administration des sprints : édition, réouverture et suppression sécurisée.
 */
export const AdminSprintsTab: React.FC<AdminSprintsTabProps> = ({
  sprints,
  currentSprintId,
  actionLoading,
  onSprintReopened,
  onSprintUpdated,
  onSprintDeleted,
  onFeedback,
  setActionLoading,
}) => {
  const confirm = useConfirm();
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    number: 1,
    notes: '',
    started_at: '',
  });

  const handleStartEdit = (s: Sprint) => {
    setEditingSprint(s);
    setFormData({
      name: s.name,
      number: s.number,
      notes: s.notes || '',
      started_at: s.started_at ? s.started_at.substring(0, 10) : '',
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSprint) return;
    const cleanName = formData.name.trim();
    if (!cleanName) {
      onFeedback('error', 'Le nom du sprint est obligatoire.');
      return;
    }
    setActionLoading(true);
    try {
      await onSprintUpdated(editingSprint.id, {
        name: cleanName,
        number: Number(formData.number),
        notes: formData.notes.trim(),
        started_at: formData.started_at || undefined,
      });
      onFeedback('success', `Le sprint « ${cleanName} » a été mis à jour.`);
      setEditingSprint(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la mise à jour du sprint.';
      onFeedback('error', msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopen = async (s: Sprint) => {
    const ok = await confirm({
      title: `Réouvrir Point ${s.number} — ${s.name} ?`,
      message:
        'Ce sprint redeviendra actif et modifiable. Le sprint actuellement actif passera en lecture seule.',
      confirmLabel: 'Réouvrir ce sprint',
      cancelLabel: 'Annuler',
      variant: 'warning',
    });
    if (!ok) return;

    setActionLoading(true);
    try {
      await onSprintReopened(s.id);
      onFeedback(
        'success',
        `Le sprint Point ${s.number} (« ${s.name} ») a été réouvert et redevient actif.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Impossible de réouvrir ce sprint.';
      onFeedback('error', msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (s: Sprint) => {
    const ok = await confirm({
      title: `Supprimer Point ${s.number} — ${s.name} ?`,
      message:
        'Cette action est irréversible et supprimera définitivement toutes les tâches associées à ce sprint.',
      confirmLabel: 'Supprimer définitivement',
      cancelLabel: 'Annuler',
      variant: 'danger',
    });
    if (!ok) return;

    setActionLoading(true);
    try {
      await onSprintDeleted(s.id);
      onFeedback('success', `Le sprint « ${s.name} » a été supprimé.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Impossible de supprimer ce sprint.';
      onFeedback('error', msg);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-[12.5px] text-[var(--cdh-text-secondary)]">
        Gérez le sprint actif, modifiez les métadonnées ou réouvrez un sprint clôturé par erreur.
      </p>

      {editingSprint && (
        <form
          onSubmit={handleSave}
          className="cdh-glass-column rounded-cdh-xl p-4 space-y-3.5 border border-[var(--cdh-border-subtle)]"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[13.5px] font-semibold text-[var(--cdh-text-primary)] flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-[var(--cdh-accent)]" strokeWidth={2} />
              Modifier Point {editingSprint.number}
            </h3>
            <Button size="sm" variant="ghost" disabled={actionLoading} onClick={() => setEditingSprint(null)}>
              Annuler
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Numéro"
              type="number"
              min={1}
              required
              value={formData.number}
              onChange={(e) => setFormData({ ...formData, number: Number(e.target.value) })}
            />
            <div className="sm:col-span-2">
              <Input
                label="Nom du sprint"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-[12px] font-semibold text-[var(--cdh-text-secondary)]">
                Date de début
              </label>
              <DatePicker
                value={formData.started_at}
                onChange={(val) => setFormData({ ...formData, started_at: val })}
                placeholder="Date de début"
              />
            </div>

            <Input
              label="Notes de réunion"
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Résumé ou contexte…"
            />
          </div>

          <div className="pt-2.5 border-t border-[var(--cdh-border-hairline)] flex justify-end gap-2">
            <Button variant="ghost" size="sm" disabled={actionLoading} onClick={() => setEditingSprint(null)}>
              Annuler
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={actionLoading}>
              Enregistrer
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-2.5">
        {sprints.map((s) => {
          const isActive = s.status === 'active';
          const isSelected = s.id === currentSprintId;

          return (
            <div
              key={s.id}
              className={`cdh-surface-card rounded-cdh-xl p-3.5 sm:p-4 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isActive
                  ? 'border-[var(--cdh-success-accent)]/45'
                  : 'border-[var(--cdh-border-subtle)]'
              }`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-cdh-md flex items-center justify-center font-bold text-[13px] shrink-0 ${
                    isActive
                      ? 'bg-[var(--cdh-success-soft)] text-[var(--cdh-success)]'
                      : 'bg-[var(--cdh-surface-control)] text-[var(--cdh-text-secondary)]'
                  }`}
                >
                  {s.number}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-[14px] text-[var(--cdh-text-primary)]">
                      {s.name}
                    </h4>

                    {isActive ? (
                      <Badge variant="success" pill>
                        <Unlock className="w-3 h-3" strokeWidth={2.25} />
                        Actif
                      </Badge>
                    ) : (
                      <Badge variant="neutral" pill>
                        <Lock className="w-3 h-3" strokeWidth={2.25} />
                        Clôturé
                      </Badge>
                    )}

                    {isSelected && <Badge variant="accent">Affiché</Badge>}
                  </div>

                  <div className="flex items-center gap-3 text-[12px] text-[var(--cdh-text-secondary)] mt-1 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-[var(--cdh-text-tertiary)]" strokeWidth={1.75} />
                      {new Date(s.started_at).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    {s.closed_at && (
                      <span className="inline-flex items-center gap-1 text-[var(--cdh-text-tertiary)]">
                        <Clock className="w-3 h-3" strokeWidth={1.75} />
                        Clôturé le{' '}
                        {new Date(s.closed_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                        })}
                        {s.closed_by_name ? ` par ${s.closed_by_name}` : ''}
                      </span>
                    )}
                  </div>

                  {s.notes && (
                    <p className="text-[11.5px] text-[var(--cdh-text-tertiary)] mt-1 italic truncate">
                      « {s.notes} »
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                {!isActive && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={actionLoading}
                    onClick={() => handleReopen(s)}
                    leftIcon={<RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />}
                    title="Réouvrir ce sprint pour autoriser de nouveau les modifications"
                  >
                    Réouvrir
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  disabled={actionLoading}
                  onClick={() => handleStartEdit(s)}
                  aria-label={`Modifier ${s.name}`}
                  title="Modifier les détails du sprint"
                >
                  <Edit2 className="w-4 h-4" strokeWidth={1.75} />
                </Button>

                {sprints.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={actionLoading}
                    onClick={() => handleDelete(s)}
                    aria-label={`Supprimer ${s.name}`}
                    title="Supprimer ce sprint"
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
