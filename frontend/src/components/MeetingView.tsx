import React, { useState, useEffect, useRef } from 'react';
import { Sprint, Task, TaskStatus, Question, User, Property } from '../types';
import { buildSubtaskTree, HierarchicalSubtask } from '../utils/subtasks';
import { hasFinalDecision } from '../utils/questions';
import { BlurredIconSwap } from './BlurredIconSwap';
import {
  Users, CheckCircle2, UserPlus,
  Shield, CheckSquare, Square,
  Sparkles, Check, Edit3, Trash2, Star,
  ChevronDown, Plus, AlertTriangle, Keyboard, X, Info
} from 'lucide-react';

interface MeetingViewProps {
  sprint?: Sprint | null;
  tasks: Task[];
  questions: Question[];
  users: User[];
  currentUser: User | null;
  properties: Property[];
  onOpenCloseSprintModal: () => void;
  onUpdateTaskStatus: (taskId: number, status: TaskStatus) => void;
  onAssignTask: (taskId: number, userId: number | null) => void;
  onDeleteTask?: (taskId: number) => void;
  onToggleSubtask: (subtaskId: number) => void;
  onSetQuestionDecision?: (questionId: number, finalAnswer: string) => Promise<void>;
  onEditTask: (task: Task) => void;
  onToggleStar?: (taskId: number) => void;
  onAddNewTask?: (editingPendingTask?: Task | null) => void;
  onAddNewQuestion?: () => void;
  onEditQuestion?: (question: Question) => void;
  hasOpenModal?: boolean;
  isReadOnly: boolean;
}

export const MeetingView: React.FC<MeetingViewProps> = ({
  sprint,
  tasks,
  questions,
  users,
  currentUser,
  properties,
  onOpenCloseSprintModal,
  onUpdateTaskStatus,
  onAssignTask,
  onDeleteTask,
  onToggleSubtask,
  onSetQuestionDecision,
  onEditTask,
  onToggleStar,
  onAddNewTask,
  onAddNewQuestion,
  onEditQuestion,
  hasOpenModal = false,
  isReadOnly
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const [meetingStep, setMeetingStep] = useState<'retro' | 'questions' | 'unassigned'>('retro');

  // Rôles de la réunion (Animateur & Rédacteur) - fidélité au process Carré d'Hôtes
  const [animatorId, setAnimatorId] = useState<number>(() => {
    const stored = localStorage.getItem('meeting_animator_id');
    if (stored) return Number(stored);
    const chris = users.find(u => u.name.toLowerCase().includes('chris'));
    return chris ? chris.id : (users[0]?.id || 1);
  });
  const [scribeId, setScribeId] = useState<number>(() => {
    const stored = localStorage.getItem('meeting_scribe_id');
    if (stored) return Number(stored);
    const max = users.find(u => u.name.toLowerCase().includes('max'));
    return max ? max.id : (users[1]?.id || users[0]?.id || 1);
  });

  const [openProposalDrawers, setOpenProposalDrawers] = useState<{ [questionId: number]: boolean }>({});
  const [expandedAccordions, setExpandedAccordions] = useState<{ [userId: number]: boolean }>({});

  useEffect(() => {
    if (users.length === 0) return;
    if (!users.some(u => u.id === animatorId)) {
      const chris = users.find(u => u.name.toLowerCase().includes('chris'));
      setAnimatorId(chris ? chris.id : users[0].id);
    }
    if (!users.some(u => u.id === scribeId)) {
      const max = users.find(u => u.name.toLowerCase().includes('max'));
      setScribeId(max ? max.id : (users[1]?.id || users[0].id));
    }
  }, [users, animatorId, scribeId]);

  const toggleAccordion = (userId: number) => {
    setExpandedAccordions(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  // Gestion des décisions de réunion (par question — champs texte directs validés via Entrée)
  const [decisionInputs, setDecisionInputs] = useState<{ [questionId: number]: string }>({});
  const [isSubmittingDecision, setIsSubmittingDecision] = useState<{ [questionId: number]: boolean }>({});
  const decisionInputRefs = useRef<{ [questionId: number]: HTMLInputElement | null }>({});

  // Navigation flottante par associé (scroll-spy + ancre directe)
  const [activeAnchor, setActiveAnchor] = useState<number | 'pool' | null>(null);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const lockSpyRef = useRef(false);
  const scrollLockTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!sprint) return;

    const initialKey: number | 'pool' | null =
      meetingStep === 'unassigned' ? 'pool' : (users[0]?.id ?? null);
    setActiveAnchor(initialKey);

    const anchorElements = Array.from(
      document.querySelectorAll<HTMLElement>('[data-meeting-anchor]')
    );

    const observer = new IntersectionObserver(
      (entries) => {
        if (lockSpyRef.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length === 0) return;

        const rawKey = visible[0].target.getAttribute('data-meeting-anchor');
        if (!rawKey) return;
        setActiveAnchor(rawKey === 'pool' ? 'pool' : Number(rawKey));
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: 0 }
    );

    anchorElements.forEach((el) => observer.observe(el));

    const handleScroll = () => {
      if (lockSpyRef.current) return;
      if (window.scrollY < 40) {
        setActiveAnchor(meetingStep === 'unassigned' ? 'pool' : (users[0]?.id ?? null));
        return;
      }
      const nearBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 24;
      if (nearBottom && users.length > 0) {
        setActiveAnchor(users[users.length - 1].id);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
      if (scrollLockTimerRef.current !== null) {
        window.clearTimeout(scrollLockTimerRef.current);
      }
    };
  }, [meetingStep, users, sprint?.id]);

  const scrollToSection = (elementId: string, anchorKey: number | 'pool') => {
    const el = document.getElementById(elementId);
    if (!el) return;

    if (scrollLockTimerRef.current !== null) {
      window.clearTimeout(scrollLockTimerRef.current);
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    lockSpyRef.current = true;
    setActiveAnchor(anchorKey);

    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });

    scrollLockTimerRef.current = window.setTimeout(() => {
      lockSpyRef.current = false;
    }, reduceMotion ? 50 : 650);
  };

  // Séparation des tâches :
  // - pendingAllTasks : toutes les tâches au statut 'pending' (jamais visibles dans l'onglet Tâches)
  // - pendingUnassigned : tâches 'pending' non attribuées (Sous-section 1 : Tâches non-attribuées)
  // - pendingAssigned : tâches 'pending' attribuées (Sous-section 2 : Tâches attribuées, regroupées par associé)
  // - activeSprintTasks : tâches actives du sprint en cours (status !== 'pending')
  const pendingAllTasks = tasks.filter(t => t.status === 'pending');
  const pendingUnassigned = pendingAllTasks.filter(t => !t.assigned_to);
  const pendingAssigned = pendingAllTasks.filter(t => !!t.assigned_to);
  const activeSprintTasks = tasks.filter(t => t.status !== 'pending');
  const doneTasks = activeSprintTasks.filter(t => t.status === 'done');
  const unfinishedSprintTasks = activeSprintTasks.filter(t => t.status !== 'done');
  const undecidedQuestions = questions.filter(q => !hasFinalDecision(q));
  const decidedQuestions = questions.filter(hasFinalDecision);

  if (!sprint) {
    return (
      <div className="bg-white rounded-2xl border border-black/[0.12] p-10 text-center text-slate-500 text-sm">
        Aucun sprint disponible.
      </div>
    );
  }

  const showFab = !isReadOnly && currentUser?.role !== 'read' && !!onAddNewTask && sprint.status !== 'closed';
  const canCreateQuestion = !isReadOnly && currentUser?.role !== 'read' && !!onAddNewQuestion;
  const canCloseSprint = isAdmin && sprint.status !== 'closed';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (hasOpenModal) return;

      if (e.key === 'Escape') {
        if (isShortcutsModalOpen) {
          e.preventDefault();
          setIsShortcutsModalOpen(false);
          return;
        }
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const targetEl = e.target as HTMLElement | null;
      if (targetEl && targetEl.closest('input, textarea, select, [contenteditable="true"]')) {
        return;
      }

      const keyLower = e.key.toLowerCase();

      if (e.key === '?' || keyLower === 'h') {
        e.preventDefault();
        setIsShortcutsModalOpen(prev => !prev);
        return;
      }

      if (isShortcutsModalOpen) return;

      // Étapes de la réunion (compatible AZERTY / QWERTY / pavé numérique)
      if (e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1') {
        e.preventDefault();
        setMeetingStep('retro');
        return;
      }
      if (e.key === '2' || e.code === 'Digit2' || e.code === 'Numpad2') {
        e.preventDefault();
        setMeetingStep('questions');
        return;
      }
      if (e.key === '3' || e.code === 'Digit3' || e.code === 'Numpad3') {
        e.preventDefault();
        setMeetingStep('unassigned');
        return;
      }

      // Retour au bloc « À attribuer » (onglet 3)
      if (meetingStep === 'unassigned' && (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0')) {
        e.preventDefault();
        scrollToSection('meeting-section-unassigned-pool', 'pool');
        return;
      }

      // Navigation intervenant suivant / précédent (J / K)
      if (keyLower === 'j' || keyLower === 'k') {
        const anchors: { elementId: string; key: number | 'pool' }[] = [
          ...(meetingStep === 'unassigned'
            ? [{ elementId: 'meeting-section-unassigned-pool', key: 'pool' as const }]
            : []),
          ...users.map((u) => ({
            elementId: `meeting-section-${meetingStep}-${u.id}`,
            key: u.id
          }))
        ];
        if (anchors.length === 0) return;

        e.preventDefault();
        const currentIdx = anchors.findIndex((a) => a.key === activeAnchor);
        const targetAnchor =
          keyLower === 'j'
            ? anchors[currentIdx === -1 ? 0 : Math.min(currentIdx + 1, anchors.length - 1)]
            : anchors[currentIdx === -1 ? 0 : Math.max(currentIdx - 1, 0)];

        if (targetAnchor) {
          scrollToSection(targetAnchor.elementId, targetAnchor.key);
        }
        return;
      }

      // Déplier / replier l'accordéon « Autres tâches » de l'associé actif (onglet 1)
      if (keyLower === 'e' && meetingStep === 'retro') {
        const targetUserId = typeof activeAnchor === 'number' ? activeAnchor : users[0]?.id;
        if (targetUserId) {
          e.preventDefault();
          toggleAccordion(targetUserId);
        }
        return;
      }

      // Nouvelle tâche en séance : N, + ou = (partageant la même touche clavier)
      if (
        showFab &&
        (keyLower === 'n' || e.key === '+' || e.key === '=' || e.code === 'NumpadAdd')
      ) {
        e.preventDefault();
        onAddNewTask?.(null);
        return;
      }

      // Poser une question : Q
      if (canCreateQuestion && keyLower === 'q') {
        e.preventDefault();
        onAddNewQuestion?.();
        return;
      }

      // Valider la réunion & Clôturer le sprint : Shift + C (Admin uniquement)
      if (canCloseSprint && e.shiftKey && keyLower === 'c') {
        e.preventDefault();
        onOpenCloseSprintModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    hasOpenModal,
    isShortcutsModalOpen,
    meetingStep,
    users,
    activeAnchor,
    showFab,
    canCreateQuestion,
    canCloseSprint,
    onAddNewTask,
    onAddNewQuestion,
    onOpenCloseSprintModal
  ]);

  // Ordre naturel stable pour éviter que les questions ne sautent sous le curseur lors de la saisie au fil de la réunion
  const userIdsSet = new Set(users.map(u => u.id));
  const orderedMeetingQuestions: Question[] = [
    ...users.flatMap((u) => questions.filter(q => q.user_id === u.id)),
    ...questions.filter(q => !userIdsSet.has(q.user_id))
  ];

  const focusNextDecisionInput = (currentQuestionId: number) => {
    const currentIndex = orderedMeetingQuestions.findIndex(q => q.id === currentQuestionId);
    if (currentIndex === -1) return;
    const nextQuestion = orderedMeetingQuestions[currentIndex + 1];
    if (!nextQuestion) return;

    window.setTimeout(() => {
      const nextEl = decisionInputRefs.current[nextQuestion.id];
      if (nextEl) {
        nextEl.focus();
        nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  };

  const handleSelectPropositionAsDecision = (questionId: number, propositionContent: string) => {
    setDecisionInputs(prev => ({ ...prev, [questionId]: propositionContent }));
    window.setTimeout(() => {
      decisionInputRefs.current[questionId]?.focus();
    }, 30);
  };

  const handleSaveDecision = async (questionId: number, advanceToNext: boolean = false) => {
    const existingQuestion = questions.find(q => q.id === questionId);
    const savedAnswer = (existingQuestion?.final_answer || '').trim();
    const text = decisionInputs[questionId] !== undefined
      ? decisionInputs[questionId].trim()
      : savedAnswer;

    if (!text) return;

    // Si déjà enregistrée sans modification, passer directement à la question suivante
    if (text === savedAnswer) {
      if (advanceToNext) {
        focusNextDecisionInput(questionId);
      }
      return;
    }

    if (!onSetQuestionDecision) return;

    setIsSubmittingDecision(prev => ({ ...prev, [questionId]: true }));
    try {
      await onSetQuestionDecision(questionId, text);
      setDecisionInputs(prev => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
      if (advanceToNext) {
        focusNextDecisionInput(questionId);
      }
    } catch {
      // Erreur gérée par la notification globale ; le brouillon reste en place
    } finally {
      setIsSubmittingDecision(prev => ({ ...prev, [questionId]: false }));
    }
  };

  // Rendu récursif des sous-tâches dans la rétrospective
  const renderRetroSubtasks = (nodes: HierarchicalSubtask[], canEditThis: boolean) => {
    const depthBorders = [
      '',
      'border-l-2 border-indigo-300 ml-2.5 pl-2',
      'border-l-2 border-amber-300 ml-2.5 pl-2',
      'border-l-2 border-emerald-300 ml-2.5 pl-2'
    ];

    return (
      <div className="space-y-1">
        {nodes.map(node => (
          <div key={node.id} className={node.depth > 0 ? depthBorders[node.depth] || 'ml-2 pl-2 border-l' : ''}>
            <div
              onClick={() => canEditThis && onToggleSubtask(node.id)}
              className={`flex items-center gap-1.5 text-[11px] text-slate-600 ${
                canEditThis ? 'cursor-pointer hover:text-slate-900' : 'cursor-default'
              }`}
            >
              <BlurredIconSwap
                active={!!node.is_done}
                activeIcon={<CheckSquare className="w-3.5 h-3.5 text-emerald-600" strokeWidth={1.75} />}
                inactiveIcon={<Square className="w-3.5 h-3.5 text-slate-300" strokeWidth={1.75} />}
              />
              <span className={node.is_done ? 'line-through text-slate-400' : 'font-medium'}>
                {node.title}
              </span>
            </div>
            {node.children && node.children.length > 0 && (
              <div className="mt-1">
                {renderRetroSubtasks(node.children, canEditThis)}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Enveloppe pleine largeur harmonisée pour chaque intervenant en séance
  const renderAssociateSection = (
    person: { id: number | string; name: string; initials: string; avatar_color?: string | null },
    subtitle: string,
    badges: React.ReactNode,
    children: React.ReactNode,
    sectionId?: string,
    dataAnchor?: string
  ) => (
    <section
      key={person.id}
      id={sectionId}
      data-meeting-anchor={dataAnchor}
      className="scroll-mt-28 sm:scroll-mt-20 bg-white rounded-[28px] sm:rounded-[32px] p-4 sm:p-5 border border-black/[0.12] shadow-xs space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-black/[0.12]">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-xs shrink-0"
            style={{ backgroundColor: person.avatar_color || '#4B5563' }}
          >
            {person.initials}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-base text-slate-800 leading-tight truncate">{person.name}</h3>
            <p className="text-xs text-slate-500 font-medium">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {badges}
        </div>
      </div>

      {children}
    </section>
  );

  // Carte de question binaire & épurée : champ textarea de décision directement accessible pour chaque question
  const renderQuestionCard = (q: Question) => {
    const answers = q.answers || [];
    const hasFinalAnswer = hasFinalDecision(q);
    const savedAnswer = (q.final_answer || '').trim();
    const currentInput = decisionInputs[q.id] !== undefined ? decisionInputs[q.id] : (q.final_answer || '');
    const trimmedInput = currentInput.trim();
    const isDirty = decisionInputs[q.id] !== undefined && trimmedInput !== savedAnswer;
    const canArbitrate = !isReadOnly && (q.can_decide ?? (currentUser?.role !== 'read' && (isAdmin || currentUser?.role === 'write')));
    const canModifyQuestion = !isReadOnly && (q.can_edit !== undefined ? !!q.can_edit : (isAdmin || (currentUser?.role === 'write' && currentUser?.id === q.user_id)));
    const showProposals = !hasFinalAnswer || !!openProposalDrawers[q.id];

    return (
      <div
        key={q.id}
        className={`p-3 sm:p-4 rounded-xl border transition-all space-y-2.5 ${
          hasFinalAnswer ? 'bg-emerald-50/35 border-emerald-300/80' : 'bg-slate-50/75 border-black/[0.12]'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2 flex-wrap">
              <span
                className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md shrink-0 mt-0.5 ${
                  hasFinalAnswer
                    ? 'bg-emerald-100 text-emerald-900'
                    : 'bg-amber-100 text-amber-900'
                }`}
              >
                {hasFinalAnswer ? 'Décidée' : 'À trancher'}
              </span>
              <h4 className="text-sm font-bold break-words leading-snug text-slate-900">
                {q.title}
              </h4>
            </div>
            {q.details && (
              <p className="mt-1 text-xs text-slate-600 leading-relaxed whitespace-pre-line break-words">
                {q.details}
              </p>
            )}
          </div>

          {canModifyQuestion && onEditQuestion && (
            <button
              type="button"
              onClick={() => onEditQuestion(q)}
              className="min-w-[34px] min-h-[34px] sm:min-w-[30px] sm:min-h-[30px] flex items-center justify-center text-slate-600 hover:text-indigo-700 bg-white hover:bg-indigo-50 border border-black/[0.12] hover:border-indigo-300 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Modifier la question"
              aria-label={`Modifier la question : ${q.title}`}
            >
              <Edit3 className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          )}
        </div>

        {/* Zone directe de réponse définitive : champ texte classique + validation Entrée */}
        {canArbitrate ? (
          <div className="p-2.5 rounded-lg bg-white border border-black/[0.12] focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/20 space-y-1.5 transition-all">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label
                htmlFor={`meeting-decision-${q.id}`}
                className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5"
              >
                <CheckCircle2
                  className={`w-3.5 h-3.5 shrink-0 ${hasFinalAnswer ? 'text-emerald-600' : 'text-slate-400'}`}
                  strokeWidth={2.25}
                />
                <span>Réponse définitive</span>
                <span className="hidden sm:inline font-normal text-[10px] text-slate-400">
                  (Entrée ↵ pour valider & passer à la suivante)
                </span>
              </label>
              <div className="flex items-center gap-2">
                {hasFinalAnswer && !isDirty && (
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                    Enregistrée ✓
                  </span>
                )}
                {isDirty && hasFinalAnswer && (
                  <button
                    type="button"
                    onClick={() =>
                      setDecisionInputs(prev => {
                        const next = { ...prev };
                        delete next[q.id];
                        return next;
                      })
                    }
                    className="text-[11px] font-medium text-slate-600 hover:text-slate-800 cursor-pointer"
                  >
                    Annuler
                  </button>
                )}
                {hasFinalAnswer && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.confirm('Effacer la réponse définitive pour remettre cette question à trancher ?')) {
                        try {
                          await onSetQuestionDecision?.(q.id, '');
                          setDecisionInputs(prev => {
                            const next = { ...prev };
                            delete next[q.id];
                            return next;
                          });
                        } catch {
                          // Erreur gérée par la notification globale
                        }
                      }
                    }}
                    className="text-[11px] text-red-700 hover:text-red-800 font-semibold cursor-pointer"
                  >
                    Effacer
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <input
                id={`meeting-decision-${q.id}`}
                ref={(el) => {
                  decisionInputRefs.current[q.id] = el;
                }}
                type="text"
                aria-label={`Réponse définitive pour : ${q.title}`}
                placeholder="Saisissez la réponse définitive et appuyez sur Entrée..."
                value={currentInput}
                onChange={(e) => setDecisionInputs(prev => ({ ...prev, [q.id]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveDecision(q.id, true);
                  }
                }}
                className="flex-1 min-w-0 min-h-[38px] sm:min-h-[34px] px-2.5 py-1.5 bg-slate-50/60 focus:bg-white border border-black/[0.12] rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400"
              />

              {(!hasFinalAnswer || isDirty) && (
                <button
                  type="button"
                  disabled={!trimmedInput || isSubmittingDecision[q.id]}
                  onClick={() => handleSaveDecision(q.id, true)}
                  className="min-h-[38px] sm:min-h-[34px] px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                >
                  <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={2.25} />
                  <span>
                    {isSubmittingDecision[q.id]
                      ? '...'
                      : hasFinalAnswer
                      ? 'Mettre à jour'
                      : 'Acter'}
                  </span>
                </button>
              )}
            </div>
          </div>
        ) : hasFinalAnswer ? (
          <div className="px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 border-l-4 border-l-emerald-600 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-emerald-950">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" strokeWidth={2.25} />
              <span>Réponse définitive</span>
            </div>
            <p className="mt-1 text-slate-900 font-semibold whitespace-pre-line break-words pl-5 leading-relaxed">
              {q.final_answer}
            </p>
          </div>
        ) : (
          <p className="text-xs italic text-slate-500">Aucune réponse définitive saisie.</p>
        )}

        {/* Propositions indicatives (repliées par défaut si la question est déjà tranchée) */}
        {answers.length > 0 && (
          <div className="pt-2 border-t border-black/[0.08] space-y-1.5">
            {hasFinalAnswer ? (
              <button
                type="button"
                aria-expanded={showProposals}
                onClick={() => setOpenProposalDrawers(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-150 ${showProposals ? 'rotate-180' : ''}`}
                  strokeWidth={2}
                />
                <span>Propositions indicatives ({answers.length})</span>
              </button>
            ) : (
              <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                Propositions indicatives ({answers.length})
              </p>
            )}

            {showProposals && (
              <div className="space-y-1">
                {answers.map((ans) => (
                  <div
                    key={ans.id}
                    className="px-2.5 py-2 bg-white rounded-lg border border-black/[0.10] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1 flex items-baseline gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-800 shrink-0">
                        <span
                          className="w-4 h-4 rounded-full inline-flex items-center justify-center font-bold text-[8px] text-white shrink-0 translate-y-0.5"
                          style={{ backgroundColor: ans.user_color || '#4F46E5' }}
                        >
                          {ans.user_initials}
                        </span>
                        <span>{ans.user_name} :</span>
                      </span>
                      <span className="text-slate-700 break-words">{ans.content}</span>
                    </div>

                    {canArbitrate && (
                      <button
                        type="button"
                        onClick={() => handleSelectPropositionAsDecision(q.id, ans.content)}
                        aria-label={`Retenir la proposition de ${ans.user_name} comme décision finale pour : ${q.title}`}
                        className="self-end sm:self-auto px-2.5 py-1 text-xs sm:text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200/80 rounded-lg flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                        title="Retenir cette proposition comme réponse définitive"
                      >
                        <Sparkles className="w-3 h-3 text-indigo-500" strokeWidth={2} />
                        <span>Retenir</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`space-y-6 ${
        users.length > 0 ? 'lg:pl-16 min-[1440px]:pl-0 pb-[calc(6rem+env(safe-area-inset-bottom))]' : showFab ? 'pb-[calc(6rem+env(safe-area-inset-bottom))]' : ''
      } ${showFab ? 'lg:pb-24' : 'lg:pb-6'}`}
    >
      
      {/* Header spécial Réunion Hebdomadaire (Responsive) */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-[32px] sm:rounded-[36px] p-5 sm:p-6 text-white shadow-xl border border-indigo-900/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold uppercase tracking-wider mb-2">
              <Users className="w-3.5 h-3.5" strokeWidth={2.25} />
              Réunion hebdomadaire de l'équipe
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-3 flex-wrap">
              {sprint.name}
              {isReadOnly && (
                <span className="text-xs bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-md font-bold border border-amber-500/30">
                  Sprint clôturé (Archive)
                </span>
              )}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Support interactif pour animer la réunion, apporter les décisions définitives aux questions, et acter la bascule du sprint.
            </p>
          </div>

          {/* Bouton de Clôture / Bascule */}
          <div className="flex items-center gap-3 shrink-0">
            {sprint.status === 'closed' ? (
              <div className="text-xs text-slate-300 bg-slate-800/80 px-4 py-2.5 rounded-xl border border-slate-700">
                🔒 Sprint validé et archivé
              </div>
            ) : isAdmin ? (
              <button
                onClick={onOpenCloseSprintModal}
                aria-keyshortcuts="Shift+c"
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-brand-600 hover:from-indigo-600 hover:to-brand-700 text-white font-bold text-xs sm:text-sm shadow-xl shadow-brand-500/25 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <CheckCircle2 className="w-5 h-5 text-indigo-200" strokeWidth={2.25} />
                Valider la réunion & Clôturer le sprint
              </button>
            ) : (
              <div className="text-xs text-slate-300 bg-slate-800/80 px-4 py-2.5 rounded-xl border border-slate-700 flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-400" strokeWidth={1.75} />
                Seul un administrateur peut clôturer le sprint
              </div>
            )}
          </div>
        </div>

        {/* Chiffres clés du sprint (Responsive grid) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-6 pt-6 border-t border-slate-800/80 text-xs">
          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
            <span className="text-slate-400 font-medium">Tâches totales</span>
            <div className="text-lg font-bold text-white mt-0.5">{activeSprintTasks.length}</div>
          </div>
          <div className="bg-emerald-950/40 p-3 rounded-xl border border-emerald-800/40">
            <span className="text-emerald-400 font-medium">Tâches terminées ✅</span>
            <div className="text-lg font-bold text-emerald-300 mt-0.5">{doneTasks.length}</div>
          </div>
          <div className="bg-amber-950/40 p-3 rounded-xl border border-amber-800/40">
            <span className="text-amber-400 font-medium">En cours / À reporter 🚧</span>
            <div className="text-lg font-bold text-amber-300 mt-0.5">{unfinishedSprintTasks.length}</div>
          </div>
          <div className="bg-purple-950/40 p-3 rounded-xl border border-purple-800/40">
            <span className="text-purple-400 font-medium">À attribuer en réunion</span>
            <div className="text-lg font-bold text-purple-300 mt-0.5">{pendingUnassigned.length}</div>
          </div>
        </div>

        {/* Rôles de la réunion hebdomadaire (Fidélité au rituel du document de réunion) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-4 border-t border-slate-800/80 text-xs">
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            {/* Animateur */}
            <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/70 rounded-xl px-3 py-1.5 shadow-2xs">
              <span className="text-[11px] text-indigo-300 font-bold uppercase tracking-wider flex items-center gap-1">
                🎤 Animateur :
              </span>
              <select
                value={animatorId}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setAnimatorId(val);
                  localStorage.setItem('meeting_animator_id', String(val));
                }}
                className="bg-slate-700 border border-slate-600 rounded-md px-1.5 py-0.5 text-white font-bold text-xs focus:outline-none cursor-pointer"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id} className="bg-slate-800 text-white">
                    {u.name}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400 hidden sm:inline">(Garant du temps & parole)</span>
            </div>

            {/* Rédacteur */}
            <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/70 rounded-xl px-3 py-1.5 shadow-2xs">
              <span className="text-[11px] text-purple-300 font-bold uppercase tracking-wider flex items-center gap-1">
                ✍️ Rédacteur :
              </span>
              <select
                value={scribeId}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setScribeId(val);
                  localStorage.setItem('meeting_scribe_id', String(val));
                }}
                className="bg-slate-700 border border-slate-600 rounded-md px-1.5 py-0.5 text-white font-bold text-xs focus:outline-none cursor-pointer"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id} className="bg-slate-800 text-white">
                    {u.name}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400 hidden sm:inline">(Note décisions & actions)</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsShortcutsModalOpen(true)}
            aria-keyshortcuts="? h"
            title="Afficher les raccourcis clavier (?)"
            className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/70 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <Keyboard className="w-3.5 h-3.5 text-indigo-300" strokeWidth={1.75} />
            <span>Raccourcis</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-600/80 text-[10px] font-mono text-slate-300">?</kbd>
          </button>
        </div>

      </div>

      {/* Barre d'étapes de la réunion (Responsive horizontal scroll on mobile) */}
      <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-black/[0.12] shadow-xs overflow-x-auto">
        <button
          onClick={() => setMeetingStep('retro')}
          aria-keyshortcuts="1"
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            meetingStep === 'retro'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px]">1</span>
          <span>Rétrospective par Associé</span>
          <span className="text-[10px] opacity-75 font-normal px-1.5 py-0.5 rounded bg-black/20">15 min</span>
        </button>

        <button
          onClick={() => setMeetingStep('questions')}
          aria-keyshortcuts="2"
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            meetingStep === 'questions'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px]">2</span>
          <span>Revue des Questions & Décisions</span>
          <span className="text-[10px] opacity-75 font-normal px-1.5 py-0.5 rounded bg-black/20">30 min</span>
          <span className="px-1.5 py-0.5 rounded-full bg-indigo-500 text-white text-[10px]">{undecidedQuestions.length}</span>
        </button>

        <button
          onClick={() => setMeetingStep('unassigned')}
          aria-keyshortcuts="3"
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            meetingStep === 'unassigned'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px]">3</span>
          <span>Plan d'Action & Tâches orphelines</span>
          <span className="text-[10px] opacity-75 font-normal px-1.5 py-0.5 rounded bg-black/20">10 min</span>
          <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px]">
            {pendingUnassigned.length + pendingAssigned.length}
          </span>
        </button>
      </div>

      {/* Contenu de l'étape active */}

      {/* ÉTAPE 1 : Rétrospective par associé (pleine largeur pour la prise de parole) */}
      {meetingStep === 'retro' && (
        <div className="space-y-4">
          {users.map((user) => {
            const userTasks = activeSprintTasks.filter(t => t.assigned_to === user.id);
            const userDone = userTasks.filter(t => t.status === 'done');
            const userPending = userTasks.filter(t => t.status !== 'done');
            const retroStatusOrder: Partial<Record<Task['status'], number>> = {
              done: 0,
              in_progress: 1,
              blocked: 2,
              todo: 3
            };
            const userStarred = userTasks.filter(t => !!t.is_starred);
            const userUnstarred = userTasks
              .filter(t => !t.is_starred)
              .sort((a, b) => (retroStatusOrder[a.status] ?? 4) - (retroStatusOrder[b.status] ?? 4));
            const canEditThis = !isReadOnly && (isAdmin || (currentUser?.role === 'write' && currentUser?.id === user.id));
            const isAccordionOpen = !!expandedAccordions[user.id];

            const renderRetroTask = (t: Task, isHighlighted: boolean) => {
              const hierarchicalSubtasks = buildSubtaskTree(t.subtasks || []);
              const canEditTask = !isReadOnly && (t.can_edit !== undefined ? !!t.can_edit : canEditThis);
              const canStarTask = !isReadOnly && !!t.can_star;

              return (
                <div
                  key={t.id}
                  className={`p-3.5 sm:p-4 rounded-xl border text-xs transition-all ${
                    isHighlighted
                      ? 'bg-amber-50/40 border-amber-300 ring-1 ring-amber-300/60 shadow-2xs'
                      : t.status === 'done'
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : t.status === 'blocked'
                      ? 'bg-red-50/40 border-red-200'
                      : 'bg-slate-50 border-black/[0.12]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      {/* Toggle rapide statut en séance */}
                      {canEditTask ? (
                        <button
                          type="button"
                          onClick={() => onUpdateTaskStatus(t.id, t.status === 'done' ? 'in_progress' : 'done')}
                          className="mt-0.5 text-slate-400 hover:text-emerald-600 transition-colors shrink-0 cursor-pointer"
                          title="Marquer fait / en cours"
                        >
                          <BlurredIconSwap
                            active={t.status === 'done'}
                            activeIcon={<CheckCircle2 className="w-4 h-4 text-emerald-600" strokeWidth={1.75} />}
                            inactiveIcon={<Square className="w-4 h-4 text-slate-400" strokeWidth={1.75} />}
                          />
                        </button>
                      ) : (
                        <span className="mt-0.5 shrink-0">
                          {t.status === 'done'
                            ? '✅'
                            : t.status === 'blocked'
                            ? '❌'
                            : t.status === 'in_progress'
                            ? '🚧'
                            : '⏳'}
                        </span>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Étoile interactive si autorisé */}
                          {(canStarTask || !!t.is_starred) && (
                            <button
                              type="button"
                              disabled={!canStarTask}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (canStarTask && onToggleStar) {
                                  onToggleStar(t.id);
                                }
                              }}
                              className={`p-0.5 rounded transition-all shrink-0 ${
                                t.is_starred
                                  ? `text-amber-500 ${canStarTask ? 'hover:text-amber-600 cursor-pointer' : 'cursor-default'}`
                                  : canStarTask
                                  ? 'text-slate-300 hover:text-amber-400 cursor-pointer'
                                  : 'hidden'
                              }`}
                              title={t.is_starred ? (canStarTask ? 'Mise en avant activée (cliquer pour retirer)' : 'Mise en avant pour la réunion') : 'Mettre en avant pour la réunion'}
                            >
                              <Star className={`w-3.5 h-3.5 ${t.is_starred ? 'fill-amber-400 text-amber-500' : 'text-slate-300'}`} strokeWidth={1.75} />
                            </button>
                          )}

                          <span className={`text-sm font-semibold text-slate-800 break-words leading-snug ${t.status === 'done' ? 'line-through text-slate-400' : ''}`}>
                            {t.title}
                          </span>

                          {t.property_name && (
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded text-white shrink-0"
                              style={{ backgroundColor: t.property_color || '#3B82F6' }}
                            >
                              {t.property_name}
                            </span>
                          )}
                        </div>

                        {t.description && (
                          <p className="mt-1.5 text-slate-600 text-xs leading-relaxed break-words">
                            <span className="text-brand-600 font-bold mr-1">→</span>
                            {t.description}
                          </p>
                        )}

                        {/* Sous-tâches hiérarchiques jusqu'à 4 niveaux */}
                        {t.subtasks && t.subtasks.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-black/[0.12]">
                            {renderRetroSubtasks(hierarchicalSubtasks, canEditTask)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Statut sélecteur rapide pour la réunion */}
                    {canEditTask && (
                      <select
                        value={t.status}
                        onChange={(e) => onUpdateTaskStatus(t.id, e.target.value as TaskStatus)}
                        className="text-xs font-semibold border border-black/[0.12] rounded-lg px-2 py-1 bg-white text-slate-700 cursor-pointer shrink-0"
                      >
                        <option value="todo">⏳ À faire</option>
                        <option value="in_progress">🚧 En cours</option>
                        <option value="blocked">❌ Bloqué</option>
                        <option value="done">✅ Fait</option>
                      </select>
                    )}
                  </div>
                </div>
              );
            };

            return renderAssociateSection(
              user,
              `${userDone.length}/${userTasks.length} terminée${userDone.length > 1 ? 's' : ''}`,
              <>
                {userStarred.length > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-500 text-amber-600" strokeWidth={2.25} />
                    {userStarred.length} mise{userStarred.length > 1 ? 's' : ''} en avant
                  </span>
                )}
                <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-slate-100 text-slate-700">
                  {userPending.length} en cours
                </span>
              </>,
              <div className="space-y-3">
                {userStarred.length > 0 ? (
                  <div className="space-y-2.5">
                    {userStarred.map(t => renderRetroTask(t, true))}
                  </div>
                ) : (
                  <div className="px-4 py-3 border border-dashed border-black/[0.15] bg-slate-50/70 rounded-xl text-center">
                    <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-700">
                      <Star className="w-3.5 h-3.5 text-amber-500" strokeWidth={2} />
                      <span>Aucune tâche mise en avant avec l'étoile</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {userUnstarred.length > 0
                        ? `Dépliez ci-dessous pour afficher les ${userUnstarred.length} autre${userUnstarred.length > 1 ? 's' : ''} tâche${userUnstarred.length > 1 ? 's' : ''} de ${user.name}.`
                        : 'Aucune tâche assignée sur ce sprint.'}
                    </p>
                  </div>
                )}

                {/* Accordéon pour les autres tâches non mises en avant */}
                {userUnstarred.length > 0 && (
                  <div className="pt-2 border-t border-black/[0.12]">
                    <button
                      type="button"
                      onClick={() => toggleAccordion(user.id)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors border border-black/[0.12] cursor-pointer group"
                    >
                      <span className="flex items-center gap-2">
                        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isAccordionOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
                        <span>Autres tâches ({userUnstarred.length})</span>
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-700 uppercase tracking-wider">
                        {isAccordionOpen ? 'Masquer' : 'Afficher'}
                      </span>
                    </button>

                    {isAccordionOpen && (
                      <div className="mt-2.5 space-y-2.5 animate-fade-in">
                        {userUnstarred.map(t => renderRetroTask(t, false))}
                      </div>
                    )}
                  </div>
                )}
              </div>,
              `meeting-section-retro-${user.id}`,
              String(user.id)
            );
          })}
        </div>
      )}

      {/* ÉTAPE 2 : Revue des questions regroupées par associé (pleine largeur pour la prise de parole) */}
      {meetingStep === 'questions' && (
        <div className="space-y-4">
          {/* Barre d'en-tête synthétique */}
          <div className="bg-white rounded-[28px] sm:rounded-[32px] px-4 py-3 sm:px-5 sm:py-3.5 border border-black/[0.12] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <h3 className="font-bold text-base text-slate-800">Revue des Questions & Décisions</h3>
              <p className="text-xs text-slate-600">
                Regroupées par associé pour acter les réponses définitives en séance.
              </p>
              {(sprint.status === 'closed' || isReadOnly) && (
                <p className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-black/[0.08] text-[11px] text-slate-700 font-medium">
                  <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" strokeWidth={2} />
                  <span>
                    Sprint clôturé : les propositions indicatives préparatoires ne sont pas conservées ; seules les réponses définitives sont archivées.
                  </span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900">
                {undecidedQuestions.length} à trancher
              </span>
              {decidedQuestions.length > 0 && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900">
                  {decidedQuestions.length} décidée{decidedQuestions.length > 1 ? 's' : ''}
                </span>
              )}
              {canCreateQuestion && (
                <button
                  type="button"
                  onClick={onAddNewQuestion}
                  aria-keyshortcuts="q"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2.25} />
                  <span>Poser une question</span>
                  <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-700/80 border border-indigo-400/40 text-[10px] font-mono text-indigo-100">
                    Q
                  </kbd>
                </button>
              )}
            </div>
          </div>

          {users.map((user) => {
            const userQuestions = questions.filter(q => q.user_id === user.id);
            const userUndecided = userQuestions.filter(q => !hasFinalDecision(q));
            const userDecided = userQuestions.filter(hasFinalDecision);

            return renderAssociateSection(
              user,
              userQuestions.length === 0
                ? 'Aucune question posée'
                : `${userQuestions.length} question${userQuestions.length > 1 ? 's' : ''} · ${userDecided.length} décidée${userDecided.length > 1 ? 's' : ''}`,
              <>
                {userUndecided.length > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-amber-100 text-amber-900">
                    {userUndecided.length} à trancher
                  </span>
                )}
                {userDecided.length > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-emerald-100 text-emerald-900">
                    {userDecided.length} décidée{userDecided.length > 1 ? 's' : ''}
                  </span>
                )}
                {userQuestions.length === 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-slate-100 text-slate-600">
                    0 question
                  </span>
                )}
              </>,
              userQuestions.length > 0 ? (
                <div className="space-y-2">
                  {userQuestions.map(renderQuestionCard)}
                </div>
              ) : (
                <p className="py-2 text-center text-xs text-slate-600 font-medium">
                  Aucune question à aborder pour {user.name}.
                </p>
              ),
              `meeting-section-questions-${user.id}`,
              String(user.id)
            );
          })}

          {(() => {
            const userIds = new Set(users.map(u => u.id));
            const orphanQuestions = questions.filter(q => !userIds.has(q.user_id));
            if (orphanQuestions.length === 0) return null;
            const orphanUndecided = orphanQuestions.filter(q => !hasFinalDecision(q));
            const orphanDecided = orphanQuestions.filter(hasFinalDecision);

            return renderAssociateSection(
              { id: 'other-questions', name: 'Autres participants', initials: '?', avatar_color: '#64748B' },
              `${orphanQuestions.length} question${orphanQuestions.length > 1 ? 's' : ''}`,
              <>
                {orphanUndecided.length > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-amber-100 text-amber-900">
                    {orphanUndecided.length} à trancher
                  </span>
                )}
                {orphanDecided.length > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-emerald-100 text-emerald-900">
                    {orphanDecided.length} décidée{orphanDecided.length > 1 ? 's' : ''}
                  </span>
                )}
              </>,
              <div className="space-y-2">
                {orphanQuestions.map(renderQuestionCard)}
              </div>
            );
          })()}
        </div>
      )}

      {/* ÉTAPE 3 : Plan d'Action & Tâches orphelines (Tâches au statut 'pending') */}
      {meetingStep === 'unassigned' && (
        <div className="space-y-4">
          {/* Sous-section 1 : Tâches non-attribuées */}
          <section
            id="meeting-section-unassigned-pool"
            data-meeting-anchor="pool"
            className="scroll-mt-28 sm:scroll-mt-20 bg-white rounded-[28px] sm:rounded-[32px] p-4 sm:p-5 border border-black/[0.12] shadow-xs space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-black/[0.12]">
              <div>
                <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-amber-600" strokeWidth={2.25} />
                  <span>Tâches non-attribuées</span>
                </h3>
                <p className="text-xs text-slate-500">
                  En attente d'un responsable. Attribuez-les en un clic pour les planifier sur le Point {sprint.number + 1}.
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                  {pendingUnassigned.length} à attribuer
                </span>
              </div>
            </div>

            <div className="px-3.5 py-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-2 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" strokeWidth={1.5} />
              <span>
                <strong>À la clôture du sprint</strong> : si elles restent non attribuées, ces tâches seront conservées sur le Point {sprint.number + 1} au statut <strong>pending</strong>.
              </span>
            </div>

            {pendingUnassigned.length > 0 ? (
              <div className="space-y-3">
                {pendingUnassigned.map((t) => (
                  <div
                    key={t.id}
                    className="p-3.5 sm:p-4 rounded-xl border border-amber-200/90 bg-amber-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                          <UserPlus className="w-3 h-3" strokeWidth={2.25} /> À attribuer
                        </span>

                        {t.property_name && (
                          <span
                            className="text-[11px] font-bold px-2 py-0.5 rounded text-white"
                            style={{ backgroundColor: t.property_color || '#3B82F6' }}
                          >
                            {t.property_name}
                          </span>
                        )}

                        {t.priority === 'high' && (
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                            Urgent
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-sm text-slate-800 break-words leading-snug">{t.title}</h4>
                      {t.description && (
                        <p className="text-xs text-slate-600 mt-1 break-words leading-relaxed">
                          <span className="text-brand-600 font-bold mr-1">→</span>
                          {t.description}
                        </p>
                      )}
                      {t.subtasks && t.subtasks.length > 0 && (
                        <ul className="mt-2 space-y-1 pl-2 border-l-2 border-amber-200">
                          {t.subtasks.map(st => (
                            <li key={st.id} className="text-[11px] text-slate-600 font-medium">
                              • {st.title}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
                      {isAdmin && !isReadOnly && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-slate-500 mr-0.5">Attribuer :</span>
                          {users.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => onAssignTask(t.id, u.id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white border border-black/[0.12] text-slate-700 hover:border-black/[0.22] hover:bg-slate-50 transition-all flex items-center gap-1.5 cursor-pointer"
                              title={`Attribuer à ${u.name}`}
                            >
                              <span
                                className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                style={{ backgroundColor: u.avatar_color }}
                              >
                                {u.initials}
                              </span>
                              <span>{u.name}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {!isReadOnly && (t.can_edit || t.can_delete) && (
                        <div className="flex items-center gap-1 self-end sm:self-auto">
                          {t.can_edit && onAddNewTask && (
                            <button
                              type="button"
                              onClick={() => onAddNewTask(t)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg cursor-pointer transition-colors"
                              title="Modifier cette tâche"
                            >
                              <Edit3 className="w-4 h-4" strokeWidth={1.75} />
                            </button>
                          )}
                          {t.can_delete && onDeleteTask && (
                            <button
                              type="button"
                              onClick={() => onDeleteTask(t.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg cursor-pointer transition-colors"
                              title="Supprimer cette tâche"
                            >
                              <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-3 px-4 border border-dashed border-black/[0.12] rounded-xl text-center text-xs text-slate-400 font-medium">
                Aucune tâche non attribuée en attente.
              </div>
            )}
          </section>

          {/* Sous-section 2 : Tâches attribuées (pleine largeur par associé pour relecture en séance) */}
          <div className="bg-white rounded-[28px] sm:rounded-[32px] px-5 py-4 border border-black/[0.12] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-600" strokeWidth={2.25} />
                <span>Tâches attribuées (Plan d'action Point {sprint.number + 1})</span>
              </h3>
              <p className="text-xs text-slate-500">
                Regroupées par associé sur toute la largeur pour relire ce que chacun aura à réaliser la semaine prochaine.
              </p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-violet-100 text-violet-800 self-start sm:self-auto shrink-0">
              {pendingAssigned.length} planifiée{pendingAssigned.length > 1 ? 's' : ''}
            </span>
          </div>

          {users.map((u) => {
            const userPending = pendingAssigned.filter(t => t.assigned_to === u.id);

            return renderAssociateSection(
              u,
              userPending.length === 0
                ? `Aucune tâche prévue pour le Point ${sprint.number + 1}`
                : `${userPending.length} tâche${userPending.length > 1 ? 's' : ''} pour le Point ${sprint.number + 1}`,
              <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                userPending.length > 0 ? 'bg-violet-100 text-violet-800' : 'bg-slate-100 text-slate-500'
              }`}>
                {userPending.length} planifiée{userPending.length > 1 ? 's' : ''}
              </span>,
              userPending.length > 0 ? (
                <div className="space-y-2.5">
                  {userPending.map((t) => (
                    <div
                      key={t.id}
                      className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-black/[0.12] space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-100 text-violet-800 border border-violet-200 flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5 text-violet-600" strokeWidth={2.25} />
                            Nouveau
                          </span>

                          {t.property_name && (
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded text-white"
                              style={{ backgroundColor: t.property_color || '#3B82F6' }}
                            >
                              {t.property_name}
                            </span>
                          )}

                          {t.priority === 'high' && (
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                              Urgent
                            </span>
                          )}
                        </div>

                        {!isReadOnly && (t.can_edit || t.can_delete) && (
                          <div className="flex items-center gap-1 shrink-0">
                            {t.can_edit && onAddNewTask && (
                              <button
                                type="button"
                                onClick={() => onAddNewTask(t)}
                                className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg cursor-pointer transition-colors"
                                title="Modifier cette tâche en attente"
                              >
                                <Edit3 className="w-3.5 h-3.5" strokeWidth={1.75} />
                              </button>
                            )}
                            {t.can_delete && onDeleteTask && (
                              <button
                                type="button"
                                onClick={() => onDeleteTask(t.id)}
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg cursor-pointer transition-colors"
                                title="Supprimer cette tâche en attente"
                              >
                                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <h4 className="font-semibold text-sm text-slate-800 break-words leading-snug">{t.title}</h4>

                      {t.description && (
                        <p className="text-xs text-slate-600 break-words leading-relaxed">
                          <span className="text-brand-600 font-bold mr-1">→</span>
                          {t.description}
                        </p>
                      )}

                      {t.subtasks && t.subtasks.length > 0 && (
                        <ul className="space-y-1 pl-2 border-l-2 border-violet-200">
                          {t.subtasks.map(st => (
                            <li key={st.id} className="text-[11px] text-slate-600 font-medium">
                              • {st.title}
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Réattribution / Retrait rapide (Admin) */}
                      {isAdmin && !isReadOnly && (
                        <div className="pt-2 border-t border-black/[0.12] flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {users
                              .filter(other => other.id !== u.id)
                              .map(other => (
                                <button
                                  key={other.id}
                                  type="button"
                                  onClick={() => onAssignTask(t.id, other.id)}
                                  className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-white border border-black/[0.12] text-slate-700 hover:border-black/[0.22] hover:bg-slate-100 transition-colors cursor-pointer"
                                  title={`Réattribuer à ${other.name}`}
                                >
                                  → {other.name}
                                </button>
                              ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => onAssignTask(t.id, null)}
                            className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors cursor-pointer"
                            title="Retirer le responsable (renvoyer dans Tâches non-attribuées)"
                          >
                            Retirer
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-3 px-4 border border-dashed border-black/[0.12] rounded-xl text-center text-xs text-slate-400 font-medium">
                  Aucune tâche attribuée pour la semaine prochaine.
                </div>
              ),
              `meeting-section-unassigned-${u.id}`,
              String(u.id)
            );
          })}
        </div>
      )}

      {/* Dock de navigation fixe par associé (gauche sur desktop, bas-gauche en pilule sur mobile/tablette) */}
      {users.length > 0 && (
        <nav
          aria-label="Navigation rapide par associé"
          className={`fixed z-40 bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 sm:left-6 ${
            showFab ? 'max-w-[calc(100vw-6.5rem)]' : 'max-w-[calc(100vw-2rem)]'
          } lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 lg:left-3 min-[1440px]:left-[max(1rem,calc(50%-43rem))] lg:max-w-none bg-white/90 backdrop-blur-md border border-black/[0.12] shadow-lg shadow-slate-900/10 rounded-full p-1.5 flex flex-row lg:flex-col items-center gap-1.5 overflow-x-auto lg:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
        >
          {meetingStep === 'unassigned' && (
            <>
              <button
                type="button"
                onClick={() => scrollToSection('meeting-section-unassigned-pool', 'pool')}
                aria-label="Aller aux tâches non-attribuées"
                aria-current={activeAnchor === 'pool' ? 'location' : undefined}
                className={`group relative w-11 h-11 rounded-full shrink-0 flex items-center justify-center transition-all motion-reduce:transition-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
                  activeAnchor === 'pool'
                    ? 'bg-amber-50 ring-2 ring-amber-500 text-amber-700 shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-amber-700'
                }`}
              >
                <span className="w-8 h-8 rounded-full flex items-center justify-center bg-amber-100 text-amber-700 border border-amber-200">
                  <UserPlus className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
                </span>

                {pendingUnassigned.length > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center shadow-xs ring-2 ring-white"
                  >
                    {pendingUnassigned.length}
                  </span>
                )}

                <span
                  role="tooltip"
                  className="hidden lg:flex items-center gap-1.5 pointer-events-none opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-150 motion-reduce:transition-none absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap px-2.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-lg border border-slate-700/80"
                >
                  <span>À attribuer</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-500/25 text-amber-200 text-[10px] font-bold">
                    {pendingUnassigned.length}
                  </span>
                </span>
              </button>

              <span aria-hidden="true" className="w-px h-6 lg:w-6 lg:h-px bg-black/[0.12] shrink-0" />
            </>
          )}

          {users.map((user) => {
            const targetId = `meeting-section-${meetingStep}-${user.id}`;
            const isActive = activeAnchor === user.id;

            const badgeCount =
              meetingStep === 'retro'
                ? activeSprintTasks.filter((t) => t.assigned_to === user.id).length
                : meetingStep === 'questions'
                ? questions.filter((q) => q.user_id === user.id && !hasFinalDecision(q)).length
                : pendingAssigned.filter((t) => t.assigned_to === user.id).length;

            const badgeLabel =
              meetingStep === 'retro'
                ? 'tâches'
                : meetingStep === 'questions'
                ? 'à trancher'
                : 'planifiées';

            return (
              <button
                key={user.id}
                type="button"
                onClick={() => scrollToSection(targetId, user.id)}
                aria-label={`Aller à la section de ${user.name}`}
                aria-current={isActive ? 'location' : undefined}
                className={`group relative w-11 h-11 rounded-full shrink-0 flex items-center justify-center transition-all motion-reduce:transition-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
                  isActive
                    ? 'bg-indigo-50 ring-2 ring-indigo-600 shadow-xs'
                    : 'hover:bg-slate-100 opacity-90 hover:opacity-100'
                }`}
              >
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs border border-black/10 transition-transform motion-reduce:transition-none ${
                    isActive ? 'scale-105' : 'group-hover:scale-105'
                  }`}
                  style={{ backgroundColor: user.avatar_color || '#4B5563' }}
                >
                  {user.initials}
                </span>

                {isActive && (
                  <span
                    aria-hidden="true"
                    className="hidden lg:block absolute -left-1.5 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-indigo-600"
                  />
                )}

                <span
                  role="tooltip"
                  className="hidden lg:flex items-center gap-1.5 pointer-events-none opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-150 motion-reduce:transition-none absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap px-2.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-lg border border-slate-700/80"
                >
                  <span>{user.name}</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 text-[10px] font-bold">
                    {badgeCount} {badgeLabel}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Bouton d'action flottant circulaire pour ajouter une tâche en séance */}
      {showFab && (
        <button
          type="button"
          onClick={() => onAddNewTask?.(null)}
          aria-label="Nouvelle tâche en séance"
          aria-keyshortcuts="n + ="
          title="Nouvelle tâche en séance (N, + ou =)"
          className="group fixed z-40 bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] lg:bottom-7 lg:right-7 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg shadow-indigo-600/30 hover:shadow-xl hover:shadow-indigo-600/40 ring-1 ring-white/25 hover:scale-105 active:scale-95 transition-all motion-reduce:transition-none motion-reduce:transform-none flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100"
        >
          <Plus className="w-6 h-6" strokeWidth={2.5} aria-hidden="true" />
          <span
            role="tooltip"
            className="hidden lg:flex items-center gap-2 pointer-events-none opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-150 motion-reduce:transition-none absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-lg border border-slate-700/80"
          >
            <span>Nouvelle tâche en séance</span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-[10px] font-mono text-slate-200">N</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-[10px] font-mono text-slate-200">+</kbd>
            </span>
          </span>
        </button>
      )}

      {/* Mémo compact des raccourcis clavier */}
      {isShortcutsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsShortcutsModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="meeting-shortcuts-title"
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-black/[0.12] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-indigo-300" strokeWidth={2} />
                <h3 id="meeting-shortcuts-title" className="text-sm font-bold">
                  Raccourcis clavier — Vue Réunion
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsShortcutsModalOpen(false)}
                aria-label="Fermer le mémo"
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 text-xs">
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Navigation
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 py-1">
                    <span className="text-slate-700 font-medium">Changer d'étape (1, 2, 3)</span>
                    <span className="flex items-center gap-1 shrink-0">
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-black/[0.15] font-mono text-[11px] font-bold text-slate-700">1</kbd>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-black/[0.15] font-mono text-[11px] font-bold text-slate-700">2</kbd>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-black/[0.15] font-mono text-[11px] font-bold text-slate-700">3</kbd>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-1">
                    <span className="text-slate-700 font-medium">Intervenant suivant / précédent</span>
                    <span className="flex items-center gap-1 shrink-0">
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-black/[0.15] font-mono text-[11px] font-bold text-slate-700">J</kbd>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-black/[0.15] font-mono text-[11px] font-bold text-slate-700">K</kbd>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-1">
                    <span className="text-slate-700 font-medium">Aller à « À attribuer » (étape 3)</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-black/[0.15] font-mono text-[11px] font-bold text-slate-700">0</kbd>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-1">
                    <span className="text-slate-700 font-medium">Déplier/replier « Autres tâches » (étape 1)</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-black/[0.15] font-mono text-[11px] font-bold text-slate-700">E</kbd>
                  </div>
                </div>
              </div>

              {(showFab || canCreateQuestion || canCloseSprint) && (
                <div className="pt-3 border-t border-black/[0.12] space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Actions en séance
                  </p>
                  <div className="space-y-1.5">
                    {showFab && (
                      <div className="flex items-center justify-between gap-3 py-1">
                        <span className="text-slate-700 font-medium">Nouvelle tâche en séance</span>
                        <span className="flex items-center gap-1 shrink-0">
                          <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-black/[0.15] font-mono text-[11px] font-bold text-slate-700">N</kbd>
                          <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-black/[0.15] font-mono text-[11px] font-bold text-slate-700">+</kbd>
                          <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-black/[0.15] font-mono text-[11px] font-bold text-slate-700">=</kbd>
                        </span>
                      </div>
                    )}
                    {canCreateQuestion && (
                      <div className="flex items-center justify-between gap-3 py-1">
                        <span className="text-slate-700 font-medium">Poser une question</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-black/[0.15] font-mono text-[11px] font-bold text-slate-700">Q</kbd>
                      </div>
                    )}
                    {canCloseSprint && (
                      <div className="flex items-center justify-between gap-3 py-1">
                        <span className="text-slate-700 font-medium">Valider & Clôturer le sprint</span>
                        <span className="flex items-center gap-1 shrink-0">
                          <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-black/[0.15] font-mono text-[11px] font-bold text-slate-700">Shift</kbd>
                          <span className="text-slate-400">+</span>
                          <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-black/[0.15] font-mono text-[11px] font-bold text-slate-700">C</kbd>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-black/[0.12] flex items-center justify-between text-[11px] text-slate-500">
                <span>Annuler une édition / Fermer</span>
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-black/[0.15] font-mono font-bold text-slate-700">Échap</kbd>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
