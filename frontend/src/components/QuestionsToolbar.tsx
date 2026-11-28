import React, { useMemo } from 'react';
import {
  QuestionAnswersFilter,
  QuestionDecisionFilter,
  QuestionFacets,
  QuestionSortKey,
  User,
} from '../types';
import { AssigneeFilterDropdown, AssigneeFilterLabels } from './AssigneeFilterDropdown';
import { FilterAccordionSection, MultiFilterOption, UnifiedFilterDropdown } from './UnifiedFilterDropdown';
import { SortDropdown, SortOptionItem } from './SortDropdown';
import { Button, SearchInput } from './ui';
import {
  Plus,
  RotateCcw,
  Loader2,
  Scale,
  MessageSquare,
  UserCheck,
} from 'lucide-react';

interface QuestionsToolbarProps {
  currentUser: User | null;
  users: User[];
  facets: QuestionFacets;
  userFilter: 'me' | 'all' | number;
  onChangeUserFilter: (filter: 'me' | 'all' | number) => void;
  searchQuery: string;
  onChangeSearchQuery: (q: string) => void;
  decisionStatus: QuestionDecisionFilter;
  onChangeDecisionStatus: (s: QuestionDecisionFilter) => void;
  hasAnswers: QuestionAnswersFilter;
  onChangeHasAnswers: (v: QuestionAnswersFilter) => void;
  answeredByMe: boolean | null;
  onChangeAnsweredByMe: (v: boolean | null) => void;
  sortBy: QuestionSortKey;
  sortDir: 'asc' | 'desc';
  onSelectSort: (key: QuestionSortKey) => void;
  onToggleSortDir: () => void;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
  isLoading?: boolean;
  canWrite: boolean;
  onAddNewQuestion: () => void;
}

type MyParticipationFilter = 'all' | 'unanswered' | 'answered';

const QUESTION_ASSIGNEE_LABELS: AssigneeFilterLabels = {
  heading: 'Associé',
  me: 'Mes questions',
  all: 'Toutes les questions',
  allMobile: 'Toutes',
  ariaPrefix: 'Associé',
  popoverAriaLabel: 'Filtrer les questions par associé',
};

const ANSWERS_FILTER_OPTIONS: MultiFilterOption<QuestionAnswersFilter>[] = [
  { id: 'all', label: 'Toutes les propositions' },
  { id: 'with_answers', label: 'Avec propositions', dotClass: 'bg-sky-500' },
  { id: 'without_answers', label: 'Sans proposition', dotClass: 'bg-slate-400' },
];

const PARTICIPATION_OPTIONS: MultiFilterOption<MyParticipationFilter>[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'unanswered', label: 'Sans ma réponse', dotClass: 'bg-amber-500' },
  { id: 'answered', label: 'Avec ma réponse', dotClass: 'bg-emerald-500' },
];

const QUESTION_SORT_OPTIONS: SortOptionItem<QuestionSortKey>[] = [
  { id: 'created_at', label: "Date d'ajout" },
  { id: 'alpha', label: 'Titre' },
  { id: 'decision_status', label: 'Statut décision' },
  { id: 'answers_count', label: 'Nb réponses' },
  { id: 'user', label: 'Associé' },
];

/**
 * Barre de contrôle Liquid Glass de l'onglet Questions, alignée sur TasksToolbar :
 * recherche debouncée, sélecteur d'associé avec compteurs serveur, filtres accordéon unifiés,
 * tri serveur ascendant/descendant et création rapide.
 */
export const QuestionsToolbar: React.FC<QuestionsToolbarProps> = React.memo(({
  currentUser,
  users,
  facets,
  userFilter,
  onChangeUserFilter,
  searchQuery,
  onChangeSearchQuery,
  decisionStatus,
  onChangeDecisionStatus,
  hasAnswers,
  onChangeHasAnswers,
  answeredByMe,
  onChangeAnsweredByMe,
  sortBy,
  sortDir,
  onSelectSort,
  onToggleSortDir,
  hasActiveFilters,
  onResetFilters,
  isLoading = false,
  canWrite,
  onAddNewQuestion,
}) => {
  const assigneeCounts = useMemo(
    () => ({
      all: facets.summary.total,
      unassigned: 0,
      by_user: facets.counts_by_user_id,
    }),
    [facets.summary.total, facets.counts_by_user_id]
  );

  const decisionOptions = useMemo<MultiFilterOption<QuestionDecisionFilter>[]>(
    () => [
      { id: 'all', label: `Toutes (${facets.summary.total})` },
      { id: 'undecided', label: `À trancher (${facets.summary.undecided})`, dotClass: 'bg-amber-500' },
      { id: 'decided', label: `Décidées (${facets.summary.decided})`, dotClass: 'bg-emerald-500' },
    ],
    [facets.summary.total, facets.summary.undecided, facets.summary.decided]
  );

  const participationValue: MyParticipationFilter =
    answeredByMe === false ? 'unanswered' : answeredByMe === true ? 'answered' : 'all';

  const filterSections = useMemo<FilterAccordionSection<any>[]>(() => {
    const sections: FilterAccordionSection<any>[] = [
      {
        id: 'decision_status',
        title: 'Décision',
        mode: 'single',
        icon: <Scale className="w-3.5 h-3.5 text-[var(--cdh-text-tertiary)] shrink-0" strokeWidth={2} />,
        options: decisionOptions,
        selectedValue: decisionStatus,
        defaultValue: 'all',
        onSelectSingle: onChangeDecisionStatus,
      },
      {
        id: 'has_answers',
        title: 'Propositions',
        mode: 'single',
        icon: <MessageSquare className="w-3.5 h-3.5 text-[var(--cdh-text-tertiary)] shrink-0" strokeWidth={2} />,
        options: ANSWERS_FILTER_OPTIONS,
        selectedValue: hasAnswers,
        defaultValue: 'all',
        onSelectSingle: onChangeHasAnswers,
      },
    ];

    if (currentUser) {
      sections.push({
        id: 'answered_by_me',
        title: 'Ma réponse',
        mode: 'single',
        icon: <UserCheck className="w-3.5 h-3.5 text-[var(--cdh-text-tertiary)] shrink-0" strokeWidth={2} />,
        options: PARTICIPATION_OPTIONS,
        selectedValue: participationValue,
        defaultValue: 'all',
        onSelectSingle: (val: MyParticipationFilter) => {
          if (val === 'unanswered') onChangeAnsweredByMe(false);
          else if (val === 'answered') onChangeAnsweredByMe(true);
          else onChangeAnsweredByMe(null);
        },
      });
    }

    return sections;
  }, [
    decisionOptions,
    decisionStatus,
    onChangeDecisionStatus,
    hasAnswers,
    onChangeHasAnswers,
    currentUser,
    participationValue,
    onChangeAnsweredByMe,
  ]);

  return (
    <div className="relative z-20 shrink-0 cdh-glass-chrome px-2.5 py-2 sm:px-3 sm:py-2 rounded-cdh-xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0 lg:flex-1 lg:max-w-xs xl:max-w-sm">
        <div className="relative flex-1 min-w-0">
          <SearchInput
            value={searchQuery}
            onChange={(e) => onChangeSearchQuery(e.target.value)}
            onClear={() => onChangeSearchQuery('')}
            placeholder="Rechercher…"
            aria-label="Rechercher une question, réponse, décision"
            className="w-full min-w-0"
          />
          {isLoading && (
            <Loader2
              className="w-3.5 h-3.5 animate-spin text-[var(--cdh-accent)] absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none"
              strokeWidth={2.25}
              aria-hidden="true"
            />
          )}
        </div>

        {canWrite && (
          <Button
            variant="primary"
            size="sm"
            onClick={onAddNewQuestion}
            leftIcon={<Plus className="w-3.5 h-3.5" strokeWidth={2.25} />}
            className="lg:hidden shrink-0"
          >
            Question
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between lg:justify-end gap-1 sm:gap-2 shrink-0 flex-nowrap min-w-0">
        <AssigneeFilterDropdown
          value={userFilter}
          onChange={onChangeUserFilter}
          currentUser={currentUser}
          allUsers={users}
          assigneeCounts={assigneeCounts}
          labels={QUESTION_ASSIGNEE_LABELS}
        />

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <UnifiedFilterDropdown
            label="Filtres"
            align="right"
            title="Filtrer par décision, propositions ou participation"
            sections={filterSections}
          />

          <SortDropdown
            value={sortBy}
            direction={sortDir}
            options={QUESTION_SORT_OPTIONS}
            defaultSortBy="created_at"
            defaultSortDir="asc"
            onSelectSort={onSelectSort}
            onToggleDir={onToggleSortDir}
            popoverTitle="Trier les questions"
            popoverAriaLabel="Trier les questions"
            ariaLabelPrefix="Trier les questions"
          />

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              aria-label="Réinitialiser les filtres"
              title="Réinitialiser les filtres"
              className="p-1.5 sm:p-2 min-h-[38px] sm:min-h-[34px] min-w-[32px] sm:min-w-[34px] rounded-cdh-md flex items-center justify-center text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control)] transition-colors cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          )}
        </div>

        {canWrite && (
          <Button
            variant="primary"
            size="sm"
            onClick={onAddNewQuestion}
            leftIcon={<Plus className="w-3.5 h-3.5" strokeWidth={2.25} />}
            className="hidden lg:inline-flex shrink-0"
          >
            <span className="hidden xl:inline">Poser une question</span>
            <span className="xl:hidden">Question</span>
          </Button>
        )}
      </div>
    </div>
  );
});

QuestionsToolbar.displayName = 'QuestionsToolbar';
