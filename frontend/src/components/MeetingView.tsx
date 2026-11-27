import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Sprint, Task, TaskStatus, Question, User, Property } from '../types';
import { hasFinalDecision } from '../utils/questions';
import { MeetingControlDock } from './MeetingControlDock';
import { useConfirm } from './ui';
import {
  MeetingFocusKey,
  MeetingHeader,
  MeetingParticipantTab,
  MeetingStepId,
} from './meeting/MeetingHeader';
import { MeetingRetroStep } from './meeting/MeetingRetroStep';
import { MeetingQuestionsStep } from './meeting/MeetingQuestionsStep';
import { MeetingActionPlanStep } from './meeting/MeetingActionPlanStep';
import { MeetingShortcutsModal } from './meeting/MeetingShortcutsModal';

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

/**
 * Vue Réunion hebdomadaire unifiée (Apple Liquid Glass) :
 * - En-tête compact + étapes + sélecteur d'intervenant pour maximiser l'espace utile en partage d'écran Teams / Meet
 * - Focus sur un associé à la fois par défaut selon son tour de parole (avec vue globale « Tous » optionnelle)
 */
export const MeetingView: React.FC<MeetingViewProps> = ({
  sprint,
  tasks,
  questions,
  users,
  currentUser,
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
  isReadOnly,
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const confirm = useConfirm();
  const [meetingStep, setMeetingStep] = useState<MeetingStepId>('retro');

  // Focus par intervenant : 1 personne affichée à la fois pour suivre son tour de parole (ou 'all' / 'pool')
  const [focusedKey, setFocusedKey] = useState<MeetingFocusKey>(() => users[0]?.id ?? 'all');

  // Rôles de la réunion (Animateur & Rédacteur)
  const [animatorId, setAnimatorId] = useState<number>(() => {
    const stored = localStorage.getItem('meeting_animator_id');
    if (stored) return Number(stored);
    const chris = users.find((u) => u.name.toLowerCase().includes('chris'));
    return chris ? chris.id : users[0]?.id || 1;
  });
  const [scribeId, setScribeId] = useState<number>(() => {
    const stored = localStorage.getItem('meeting_scribe_id');
    if (stored) return Number(stored);
    const max = users.find((u) => u.name.toLowerCase().includes('max'));
    return max ? max.id : users[1]?.id || users[0]?.id || 1;
  });

  const [openProposalDrawers, setOpenProposalDrawers] = useState<Record<number, boolean>>({});
  const [expandedAccordions, setExpandedAccordions] = useState<Record<number, boolean>>({});
  const [decisionInputs, setDecisionInputs] = useState<Record<number, string>>({});
  const [isSubmittingDecision, setIsSubmittingDecision] = useState<Record<number, boolean>>({});
  const decisionInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Scroll-spy utilisé uniquement lorsque l'utilisateur active le mode « Tous »
  const [scrollSpyAnchor, setScrollSpyAnchor] = useState<number | 'pool' | null>(null);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const lockSpyRef = useRef(false);
  const scrollLockTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (users.length === 0) return;
    if (!users.some((u) => u.id === animatorId)) {
      const chris = users.find((u) => u.name.toLowerCase().includes('chris'));
      setAnimatorId(chris ? chris.id : users[0].id);
    }
    if (!users.some((u) => u.id === scribeId)) {
      const max = users.find((u) => u.name.toLowerCase().includes('max'));
      setScribeId(max ? max.id : users[1]?.id || users[0].id);
    }
  }, [users, animatorId, scribeId]);

  // Ajuster le focus par défaut lorsqu'on change d'étape ou que la liste des associés charge
  useEffect(() => {
    if (meetingStep === 'unassigned') {
      setFocusedKey((prev) => {
        if (prev === 'all' || prev === 'pool') return prev;
        return users.some((u) => u.id === prev) ? prev : 'pool';
      });
      return;
    }
    setFocusedKey((prev) => {
      if (prev === 'all') return prev;
      if (typeof prev === 'number' && users.some((u) => u.id === prev)) return prev;
      return users[0]?.id ?? 'all';
    });
  }, [meetingStep, users]);

  const handleChangeStep = useCallback(
    (nextStep: MeetingStepId) => {
      setMeetingStep(nextStep);
      if (nextStep === 'unassigned') {
        setFocusedKey('pool');
      } else {
        setFocusedKey((prev) =>
          typeof prev === 'number' && users.some((u) => u.id === prev)
            ? prev
            : users[0]?.id ?? 'all'
        );
      }
      window.scrollTo({ top: 0, behavior: 'auto' });
    },
    [users]
  );

  useEffect(() => {
    if (!sprint || focusedKey !== 'all') return;

    const initialKey: number | 'pool' | null =
      meetingStep === 'unassigned' ? 'pool' : users[0]?.id ?? null;
    setScrollSpyAnchor(initialKey);

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
        setScrollSpyAnchor(rawKey === 'pool' ? 'pool' : Number(rawKey));
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: 0 }
    );

    anchorElements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
      if (scrollLockTimerRef.current !== null) {
        window.clearTimeout(scrollLockTimerRef.current);
      }
    };
  }, [meetingStep, users, sprint?.id, focusedKey]);

  const toggleAccordion = useCallback((userId: number) => {
    setExpandedAccordions((prev) => ({ ...prev, [userId]: !prev[userId] }));
  }, []);

  const pendingAllTasks = useMemo(() => tasks.filter((t) => t.status === 'pending'), [tasks]);
  const pendingUnassigned = useMemo(
    () => pendingAllTasks.filter((t) => !t.assigned_to),
    [pendingAllTasks]
  );
  const pendingAssigned = useMemo(
    () => pendingAllTasks.filter((t) => !!t.assigned_to),
    [pendingAllTasks]
  );
  const activeSprintTasks = useMemo(() => tasks.filter((t) => t.status !== 'pending'), [tasks]);
  const doneTasks = useMemo(
    () => activeSprintTasks.filter((t) => t.status === 'done'),
    [activeSprintTasks]
  );
  const unfinishedSprintTasks = useMemo(
    () => activeSprintTasks.filter((t) => t.status !== 'done'),
    [activeSprintTasks]
  );
  const undecidedQuestions = useMemo(
    () => questions.filter((q) => !hasFinalDecision(q)),
    [questions]
  );

  // Onglets d'intervenants selon l'étape active
  const participantTabs: MeetingParticipantTab[] = useMemo(() => {
    const base: MeetingParticipantTab[] = [];
    if (meetingStep === 'unassigned') {
      base.push({
        key: 'pool',
        label: 'À attribuer',
        count: pendingUnassigned.length,
        isPool: true,
      });
    }
    for (const u of users) {
      const count =
        meetingStep === 'retro'
          ? activeSprintTasks.filter((t) => t.assigned_to === u.id).length
          : meetingStep === 'questions'
          ? questions.filter((q) => q.user_id === u.id && !hasFinalDecision(q)).length
          : pendingAssigned.filter((t) => t.assigned_to === u.id).length;
      base.push({
        key: u.id,
        label: u.name.split(' ')[0],
        count,
        user: u,
      });
    }
    return base;
  }, [meetingStep, users, activeSprintTasks, questions, pendingUnassigned.length, pendingAssigned]);

  const handleSelectFocus = useCallback((key: MeetingFocusKey) => {
    setFocusedKey(key);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const handleStepSpeaker = useCallback(
    (direction: -1 | 1) => {
      if (participantTabs.length === 0) return;
      const currentIdx = participantTabs.findIndex((t) => t.key === focusedKey);
      const nextIdx =
        currentIdx === -1
          ? 0
          : Math.max(0, Math.min(participantTabs.length - 1, currentIdx + direction));
      handleSelectFocus(participantTabs[nextIdx].key);
    },
    [participantTabs, focusedKey, handleSelectFocus]
  );

  const handleDockSelectParticipant = useCallback(
    (elementId: string, anchorKey: number | 'pool') => {
      if (focusedKey === 'all') {
        const el = document.getElementById(elementId);
        if (!el) return;
        if (scrollLockTimerRef.current !== null) {
          window.clearTimeout(scrollLockTimerRef.current);
        }
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        lockSpyRef.current = true;
        setScrollSpyAnchor(anchorKey);
        el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        scrollLockTimerRef.current = window.setTimeout(() => {
          lockSpyRef.current = false;
        }, reduceMotion ? 50 : 650);
      } else {
        handleSelectFocus(anchorKey);
      }
    },
    [focusedKey, handleSelectFocus]
  );

  const showFab =
    !isReadOnly && currentUser?.role !== 'read' && !!onAddNewTask && sprint?.status !== 'closed';
  const canCreateQuestion =
    !isReadOnly && currentUser?.role !== 'read' && !!onAddNewQuestion;
  const canCloseSprint = isAdmin && sprint?.status !== 'closed';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (hasOpenModal) return;

      if (e.key === 'Escape') {
        if (isShortcutsModalOpen) {
          e.preventDefault();
          setIsShortcutsModalOpen(false);
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
        setIsShortcutsModalOpen((prev) => !prev);
        return;
      }

      if (isShortcutsModalOpen) return;

      if (e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1') {
        e.preventDefault();
        handleChangeStep('retro');
        return;
      }
      if (e.key === '2' || e.code === 'Digit2' || e.code === 'Numpad2') {
        e.preventDefault();
        handleChangeStep('questions');
        return;
      }
      if (e.key === '3' || e.code === 'Digit3' || e.code === 'Numpad3') {
        e.preventDefault();
        handleChangeStep('unassigned');
        return;
      }

      if (meetingStep === 'unassigned' && (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0')) {
        e.preventDefault();
        handleDockSelectParticipant('meeting-section-unassigned-pool', 'pool');
        return;
      }

      if (keyLower === 'j' || keyLower === 'k') {
        e.preventDefault();
        handleStepSpeaker(keyLower === 'j' ? 1 : -1);
        return;
      }

      if (keyLower === 'e' && meetingStep === 'retro') {
        const targetUserId =
          typeof focusedKey === 'number'
            ? focusedKey
            : typeof scrollSpyAnchor === 'number'
            ? scrollSpyAnchor
            : users[0]?.id;
        if (targetUserId) {
          e.preventDefault();
          toggleAccordion(targetUserId);
        }
        return;
      }

      if (showFab && (keyLower === 'n' || e.key === '+' || e.key === '=' || e.code === 'NumpadAdd')) {
        e.preventDefault();
        onAddNewTask?.(null);
        return;
      }

      if (canCreateQuestion && keyLower === 'q') {
        e.preventDefault();
        onAddNewQuestion?.();
        return;
      }

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
    focusedKey,
    scrollSpyAnchor,
    users,
    showFab,
    canCreateQuestion,
    canCloseSprint,
    handleChangeStep,
    handleStepSpeaker,
    handleDockSelectParticipant,
    toggleAccordion,
    onAddNewTask,
    onAddNewQuestion,
    onOpenCloseSprintModal,
  ]);

  if (!sprint) {
    return (
      <div className="cdh-glass-column rounded-cdh-2xl p-10 text-center text-[var(--cdh-text-secondary)] text-sm">
        Aucun sprint disponible.
      </div>
    );
  }

  // Questions ordonnées pour le passage automatique au champ suivant via Entrée
  const userIdsSet = new Set(users.map((u) => u.id));
  const orderedVisibleQuestions: Question[] =
    typeof focusedKey === 'number'
      ? questions.filter((q) => q.user_id === focusedKey)
      : [
          ...users.flatMap((u) => questions.filter((q) => q.user_id === u.id)),
          ...questions.filter((q) => !userIdsSet.has(q.user_id)),
        ];

  const focusNextDecisionInput = (currentQuestionId: number) => {
    const idx = orderedVisibleQuestions.findIndex((q) => q.id === currentQuestionId);
    if (idx === -1) return;
    const nextQ = orderedVisibleQuestions[idx + 1];
    if (!nextQ) return;
    window.setTimeout(() => {
      const nextEl = decisionInputRefs.current[nextQ.id];
      if (nextEl) {
        nextEl.focus();
        nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  };

  const handleSaveDecision = async (questionId: number, advanceToNext: boolean = false) => {
    const existingQuestion = questions.find((q) => q.id === questionId);
    const savedAnswer = (existingQuestion?.final_answer || '').trim();
    const text =
      decisionInputs[questionId] !== undefined ? decisionInputs[questionId].trim() : savedAnswer;
    if (!text) return;

    if (text === savedAnswer) {
      if (advanceToNext) focusNextDecisionInput(questionId);
      return;
    }
    if (!onSetQuestionDecision) return;

    setIsSubmittingDecision((prev) => ({ ...prev, [questionId]: true }));
    try {
      await onSetQuestionDecision(questionId, text);
      setDecisionInputs((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
      if (advanceToNext) focusNextDecisionInput(questionId);
    } catch {
      // Notification gérée globalement
    } finally {
      setIsSubmittingDecision((prev) => ({ ...prev, [questionId]: false }));
    }
  };

  const handleClearDecision = async (questionId: number) => {
    const confirmed = await confirm({
      title: 'Effacer la décision',
      message: 'Effacer la réponse définitive pour remettre cette question à trancher ?',
      confirmLabel: 'Effacer',
      variant: 'warning',
    });
    if (!confirmed) return;
    try {
      await onSetQuestionDecision?.(questionId, '');
      setDecisionInputs((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    } catch {
      // Notification gérée globalement
    }
  };

  const dockActiveKey = focusedKey === 'all' ? scrollSpyAnchor : focusedKey;

  return (
    <div
      className={`space-y-4 ${
        users.length > 0 || showFab
          ? 'lg:pl-16 min-[1520px]:pl-0 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-6'
          : 'lg:pb-6'
      }`}
    >
      <MeetingHeader
        sprint={sprint}
        users={users}
        isAdmin={isAdmin}
        isReadOnly={isReadOnly}
        meetingStep={meetingStep}
        onChangeStep={handleChangeStep}
        animatorId={animatorId}
        onChangeAnimator={(val) => {
          setAnimatorId(val);
          localStorage.setItem('meeting_animator_id', String(val));
        }}
        scribeId={scribeId}
        onChangeScribe={(val) => {
          setScribeId(val);
          localStorage.setItem('meeting_scribe_id', String(val));
        }}
        stats={{
          total: activeSprintTasks.length,
          done: doneTasks.length,
          toCarryOver: unfinishedSprintTasks.length,
          unassigned: pendingUnassigned.length,
        }}
        undecidedQuestionsCount={undecidedQuestions.length}
        pendingTotalCount={pendingUnassigned.length + pendingAssigned.length}
        participantTabs={participantTabs}
        focusedKey={focusedKey}
        onSelectFocus={handleSelectFocus}
        onStepSpeaker={handleStepSpeaker}
        showAddPendingTask={showFab}
        onAddPendingTask={() => onAddNewTask?.(null)}
        canCreateQuestion={canCreateQuestion}
        onAddQuestion={() => onAddNewQuestion?.()}
        onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
        onOpenCloseSprint={onOpenCloseSprintModal}
      />

      {meetingStep === 'retro' && (
        <MeetingRetroStep
          users={users}
          focusedKey={focusedKey}
          activeSprintTasks={activeSprintTasks}
          currentUser={currentUser}
          isAdmin={isAdmin}
          isReadOnly={isReadOnly}
          expandedAccordions={expandedAccordions}
          onToggleAccordion={toggleAccordion}
          onUpdateTaskStatus={onUpdateTaskStatus}
          onToggleSubtask={onToggleSubtask}
          onToggleStar={onToggleStar}
          onEditTask={onEditTask}
        />
      )}

      {meetingStep === 'questions' && (
        <MeetingQuestionsStep
          sprint={sprint}
          users={users}
          questions={questions}
          focusedKey={focusedKey}
          currentUser={currentUser}
          isAdmin={isAdmin}
          isReadOnly={isReadOnly}
          decisionInputs={decisionInputs}
          isSubmittingDecision={isSubmittingDecision}
          openProposalDrawers={openProposalDrawers}
          decisionInputRefs={decisionInputRefs}
          onChangeDecisionInput={(qId, val) =>
            setDecisionInputs((prev) => ({ ...prev, [qId]: val }))
          }
          onResetDecisionInput={(qId) =>
            setDecisionInputs((prev) => {
              const next = { ...prev };
              delete next[qId];
              return next;
            })
          }
          onToggleProposals={(qId) =>
            setOpenProposalDrawers((prev) => ({ ...prev, [qId]: !prev[qId] }))
          }
          onSelectProposition={(qId, content) => {
            setDecisionInputs((prev) => ({ ...prev, [qId]: content }));
            window.setTimeout(() => decisionInputRefs.current[qId]?.focus(), 30);
          }}
          onSaveDecision={handleSaveDecision}
          onClearDecision={handleClearDecision}
          onEditQuestion={onEditQuestion}
        />
      )}

      {meetingStep === 'unassigned' && (
        <MeetingActionPlanStep
          sprint={sprint}
          users={users}
          pendingUnassigned={pendingUnassigned}
          pendingAssigned={pendingAssigned}
          focusedKey={focusedKey}
          isAdmin={isAdmin}
          isReadOnly={isReadOnly}
          onAssignTask={onAssignTask}
          onEditPendingTask={onAddNewTask}
          onDeleteTask={onDeleteTask}
        />
      )}

      <MeetingControlDock
        users={users}
        tasks={tasks}
        questions={questions}
        meetingStep={meetingStep}
        activeAnchor={dockActiveKey}
        pendingUnassignedCount={pendingUnassigned.length}
        showAddPendingTask={showFab}
        onSelectParticipant={handleDockSelectParticipant}
        onAddPendingTask={() => onAddNewTask?.(null)}
      />

      <MeetingShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
        showFab={showFab}
        canCreateQuestion={canCreateQuestion}
        canCloseSprint={canCloseSprint}
      />
    </div>
  );
};
