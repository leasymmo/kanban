import React from 'react';
import { Sparkles, Zap } from 'lucide-react';
import { Badge } from './Badge';

export interface TaskOriginBadgesProps {
  isNew?: number | boolean;
  isUnplanned?: number | boolean;
}

/**
 * Badges unifiés d'origine de tâche (« Nouveau » / « Complémentaire »).
 */
export const TaskOriginBadges: React.FC<TaskOriginBadgesProps> = React.memo(
  ({ isNew, isUnplanned }) => {
    if (!isNew && !isUnplanned) return null;
    return (
      <>
        {isNew ? (
          <Badge variant="accent">
            <Sparkles className="w-3 h-3" strokeWidth={2} />
            Nouveau
          </Badge>
        ) : null}
        {isUnplanned ? (
          <Badge variant="success">
            <Zap className="w-3 h-3" strokeWidth={2} />
            Complémentaire
          </Badge>
        ) : null}
      </>
    );
  }
);

TaskOriginBadges.displayName = 'TaskOriginBadges';
