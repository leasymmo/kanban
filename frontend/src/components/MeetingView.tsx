import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Sprint, Task, TaskStatus, Question, User } from '../types';
import { hasFinalDecision } from '../utils/questions';
import { MeetingControlDock } from './MeetingControlDock';
import { MeetingHeader, MeetingStepId } from './meeting/MeetingHeader';
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

function readStoredParticipantId(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Vue Réunion hebdomadaire unifiée (Apple Liquid Glass) :
 * - En-tête compact + étapes pour maximiser l'espace utile en partage d'écran Teams / Meet
 * - Liste complète avec scroll-spy et navigation directe par associé via le dock flottant à gauche
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
  const [meetingStep, setMeetingStep] = useState<MeetingStepId>('retro');

  // Rôles de la réunion (Animateur & Rédacteur)
  const [animatorId, setAnimatorId] = useState<number>(() => {
    const stored = readStoredParticipantId('meeting_animator_id');
    if (stored) return stored;
    const chris = users.find((u) => u.name.toLowerCase().includes('chris'));
    return chris ? chris.id : users[0]?.id || 1;
  });
  const [scribeId, setScribeId] = useState<number>(() => {
    const stored = readStoredParticipantId('meeting_scribe_id');
    if (stored) return stored;
    const max = users.find((u) => u.name.toLowerCase().includes('max'));
    return max ? max.id : users[1]?.id || users[0]?.id || 1;
  });

  const [expandedAccordions, setExpandedAccordions] = useState<Record<number, boolean>>({});

  // Scroll-spy & navigation directe via la barre flottante gauche
  const [activeAnchor, setActiveAnchor] = useState<number | 'pool' | null>(null);
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

  const handleChangeStep = useCallback((nextStep: MeetingStepId) => {
    setMeetingStep(nextStep);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    if (!sprint) return;

    const initialKey: number | 'pool' | null =
      meetingStep === 'unassigned' ? 'pool' : users[0]?.id ?? null;
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
        setActiveAnchor(meetingStep === 'unassigned' ? 'pool' : users[0]?.id ?? null);
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

  const scrollToSection = useCallback((elementId: string, anchorKey: number | 'pool') => {
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
  }, []);

  const toggleAccordion = useCallback((userId: number) => {
    setExpandedAccordions((prev) => ({ ...prev, [userId]: !prev[userId] }));
  }, []);

  const {
    pendingUnassigned,
    pendingAssigned,
    activeSprintTasks,
    doneCount,
    unfinishedCount,
  } = useMemo(() => {
    const pendingUn: Task[] = [];
    const pendingAs: Task[] = [];
    const active: Task[] = [];
    let done = 0;
    let unfinished = 0;

    for (const t of tasks) {
      if (t.status === 'pending') {
        if (t.assigned_to) pendingAs.push(t);
        else pendingUn.push(t);
      } else {
        active.push(t);
        if (t.status === 'done') done += 1;
        else unfinished += 1;
      }
    }

    return {
      pendingUnassigned: pendingUn,
      pendingAssigned: pendingAs,
      activeSprintTasks: active,
      doneCount: done,
      unfinishedCount: unfinished,
    };
  }, [tasks]);

  const undecidedQuestionsCount = useMemo(
    () => questions.reduce((acc, q) => (hasFinalDecision(q) ? acc : acc + 1), 0),
    [questions]
  );

  const showFab =
    !isReadOnly && currentUser?.role !== 'read' && !!onAddNewTask && sprint?.status !== 'closed';
  const canCreateQuestion =
    !isReadOnly && currentUser?.role !== 'read' && !!onAddNewQuestion;
  const canCloseSprint = isAdmin && sprint?.status !== 'closed';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing || hasOpenModal) return;

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const targetEl = e.target as HTMLElement | null;
      if (targetEl && targetEl.closest('input, textarea, select, [contenteditable="true"]')) {
        return;
      }

      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) {
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
        scrollToSection('meeting-section-unassigned-pool', 'pool');
        return;
      }

      if (keyLower === 'j' || keyLower === 'k') {
        const anchors: { elementId: string; key: number | 'pool' }[] = [
          ...(meetingStep === 'unassigned'
            ? [{ elementId: 'meeting-section-unassigned-pool', key: 'pool' as const }]
            : []),
          ...users.map((u) => ({
            elementId: `meeting-section-${meetingStep}-${u.id}`,
            key: u.id,
          })),
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

      if (keyLower === 'e' && meetingStep === 'retro') {
        const targetUserId = typeof activeAnchor === 'number' ? activeAnchor : users[0]?.id;
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
    activeAnchor,
    users,
    showFab,
    canCreateQuestion,
    canCloseSprint,
    handleChangeStep,
    scrollToSection,
    toggleAccordion,
    onAddNewTask,
    onAddNewQuestion,
    onOpenCloseSprintModal,
  ]);

  const handleChangeAnimator = useCallback((val: number) => {
    setAnimatorId(val);
    try {
      localStorage.setItem('meeting_animator_id', String(val));
    } catch {
      // ignore storage quota errors
    }
  }, []);

  const handleChangeScribe = useCallback((val: number) => {
    setScribeId(val);
    try {
      localStorage.setItem('meeting_scribe_id', String(val));
    } catch {
      // ignore storage quota errors
    }
  }, []);

  const handleAddPendingTask = useCallback(() => {
    onAddNewTask?.(null);
  }, [onAddNewTask]);

  const handleAddQuestion = useCallback(() => {
    onAddNewQuestion?.();
  }, [onAddNewQuestion]);

  if (!sprint) {
    return (
      <div className="cdh-glass-column rounded-cdh-2xl p-10 text-center text-[var(--cdh-text-secondary)] text-sm">
        Aucun sprint disponible.
      </div>
    );
  }

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
        onChangeAnimator={handleChangeAnimator}
        scribeId={scribeId}
        onChangeScribe={handleChangeScribe}
        stats={{
          total: activeSprintTasks.length,
          done: doneCount,
          toCarryOver: unfinishedCount,
          unassigned: pendingUnassigned.length,
        }}
        undecidedQuestionsCount={undecidedQuestionsCount}
        pendingTotalCount={pendingUnassigned.length + pendingAssigned.length}
        showAddPendingTask={showFab}
        onAddPendingTask={handleAddPendingTask}
        canCreateQuestion={canCreateQuestion}
        onAddQuestion={handleAddQuestion}
        onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
        onOpenCloseSprint={onOpenCloseSprintModal}
      />

      {meetingStep === 'retro' && (
        <MeetingRetroStep
          users={users}
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
          currentUser={currentUser}
          isAdmin={isAdmin}
          isReadOnly={isReadOnly}
          onSetQuestionDecision={onSetQuestionDecision}
          onEditQuestion={onEditQuestion}
        />
      )}

      {meetingStep === 'unassigned' && (
        <MeetingActionPlanStep
          sprint={sprint}
          users={users}
          pendingUnassigned={pendingUnassigned}
          pendingAssigned={pendingAssigned}
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
        activeAnchor={activeAnchor}
        pendingUnassignedCount={pendingUnassigned.length}
        showAddPendingTask={showFab}
        onSelectParticipant={scrollToSection}
        onAddPendingTask={handleAddPendingTask}
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
