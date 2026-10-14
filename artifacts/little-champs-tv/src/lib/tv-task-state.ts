import type { TvTask, TvTaskMemberProgress } from '../hooks/use-tv-data';

export type TvTaskState = {
  people: TvTaskMemberProgress[];
  assignedIds: string[];
  mine: TvTaskMemberProgress | undefined;
  hasExplicitAssignees: boolean;
  isTeamTask: boolean;
  notAssigned: boolean;
  dailyTarget: number;
  dailyProgress: number;
  dailyMulti: boolean;
  pending: boolean;
  approved: boolean;
  rejected: boolean;
  teamContributionBlocked: boolean;
  visual: 'submitted' | 'approved' | 'open';
  nextAvailableDate: string | null;
  unavailable: boolean;
  weekend: boolean;
  due: string | null;
  daysPast: number;
  closed: boolean;
  locked: boolean;
  actionable: boolean;
};

function owns(object: object, key: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dailyTargetComplete(progress: TvTaskMemberProgress, target: number) {
  return (progress.dailyProgress ?? 0) >= target
    || (progress.dailyProgress == null && progress.hasCompleted);
}

function progressComplete(task: TvTask, progress: TvTaskMemberProgress, target: number) {
  if (task.recurrence === 'daily' && target > 1) {
    return progress.status !== 'pending' && dailyTargetComplete(progress, target);
  }
  return progress.status === 'approved' || progress.hasCompleted;
}

function isRecurring(task: TvTask) {
  return task.recurrence !== 'none' || (task.recurrenceDays ?? 0) > 0;
}

export function getTvTaskPeople(task: TvTask): TvTaskMemberProgress[] {
  return task.assignedMemberCompletions?.length
    ? task.assignedMemberCompletions
    : task.sharedMemberCompletions?.length
      ? task.sharedMemberCompletions
      : [];
}

export function getTvTaskAssignedIds(task: TvTask) {
  const people = getTvTaskPeople(task);
  return people.length ? people.map(person => person.memberId) : task.sharedMemberIds || [];
}

export function resolveTvTaskState(
  task: TvTask,
  memberId: string,
  now = new Date(),
): TvTaskState {
  const people = getTvTaskPeople(task);
  const assignedIds = getTvTaskAssignedIds(task);
  const hasExplicitAssignees = assignedIds.length > 0;
  const isTeamTask = !!task.isSharedTask && hasExplicitAssignees;
  const mine = people.find(person => person.memberId === memberId);
  const notAssigned = hasExplicitAssignees && !assignedIds.includes(memberId);
  // The daily execution endpoint clamps supported targets to 1–3.
  const dailyTarget = Math.min(3, Math.max(1, task.dailyTarget || 1));
  const dailyMulti = task.recurrence === 'daily' && dailyTarget > 1;
  // getDailyTaskProgress returns the family-wide aggregate when there are no
  // explicit assignees; explicit tasks instead need the matching member row.
  const dailyProgress = dailyMulti
    ? Math.max(0, mine?.dailyProgress ?? (hasExplicitAssignees
      ? notAssigned ? 0 : task.dailyProgress ?? 0
      : task.dailyProgress ?? 0))
    : 0;
  const status = hasExplicitAssignees
    ? mine ? mine.status : notAssigned ? null : task.memberCompletionStatus ?? null
    : task.memberCompletionStatus ?? null;
  const pending = status === 'pending'
    || (!hasExplicitAssignees && task.status === 'pending_approval');
  const rejected = status === 'rejected';
  const dailyProgressWasProvided = dailyMulti
    && (mine ? mine.dailyProgress != null : hasExplicitAssignees ? !notAssigned && task.dailyProgress != null : task.dailyProgress != null);
  const memberFullyComplete = dailyMulti
    ? dailyProgress >= dailyTarget
      || (!dailyProgressWasProvided && (mine ? !!mine.hasCompleted : !notAssigned && !!task.memberHasCompleted))
    : status === 'approved'
      || (hasExplicitAssignees ? mine ? !!mine.hasCompleted : !notAssigned && !!task.memberHasCompleted : !!task.memberHasCompleted);
  const teamContributionBlocked = isTeamTask
    && (status === 'pending' || status === 'approved');
  const approved = !pending && (isTeamTask && status === 'approved'
    ? true
    : memberFullyComplete);

  let nextAvailableDate: string | null = null;
  if (isTeamTask) {
    // A team shares the collective round boundary; its task-level date is
    // intentional and must not be hidden by an individual contribution row.
    nextAvailableDate = task.nextAvailableDate ?? task.memberNextAvailableDate ?? null;
  } else if (mine && owns(mine, 'nextAvailableDate')) {
    // Member-specific nulls are authoritative. Do not accidentally inherit a
    // different member's recurring boundary from the aggregate task.
    nextAvailableDate = mine.nextAvailableDate ?? null;
  } else if (owns(task, 'memberNextAvailableDate')) {
    nextAvailableDate = task.memberNextAvailableDate ?? null;
  } else if (!hasExplicitAssignees) {
    nextAvailableDate = task.nextAvailableDate ?? null;
  }

  const unavailable = !!nextAvailableDate
    && new Date(nextAvailableDate).getTime() > now.getTime()
    && !(task.isSharedTask && rejected);
  const weekend = task.recurrence === 'weekdays' && (now.getDay() === 0 || now.getDay() === 6);
  const today = dateKey(now);
  const due = task.dueDate && task.recurrence === 'none' ? String(task.dueDate).slice(0, 10) : null;
  const daysPast = due
    ? Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${due}T12:00:00`).getTime()) / 86400000)
    : 0;
  // Completion endpoints accept active tasks only. Keep inconsistent legacy
  // aggregate rows visible when useful, but never advertise a submit action.
  const closed = task.status !== 'active';
  const locked = notAssigned
    || closed
    || !!task.isShoppingList
    || weekend
    || unavailable
    || (due !== null && (daysPast < 0 || daysPast > 1))
    || (task.remainingSlots != null && task.remainingSlots <= 0)
    || teamContributionBlocked;
  const actionable = !locked && !pending && !approved;
  const visual = pending
    ? 'submitted'
    : approved
      ? 'approved'
      : 'open';

  return {
    people,
    assignedIds,
    mine,
    hasExplicitAssignees,
    isTeamTask,
    notAssigned,
    dailyTarget,
    dailyProgress,
    dailyMulti,
    pending,
    approved,
    rejected,
    teamContributionBlocked,
    visual,
    nextAvailableDate,
    unavailable,
    weekend,
    due,
    daysPast,
    closed,
    locked,
    actionable,
  };
}

/**
 * A shopping list is an operational view, not a task-completion action.
 * Pending, approved, and otherwise locked lists remain viewable so families
 * can see what was bought and who checked it.
 */
export function canOpenShoppingList(task: TvTask, memberId: string) {
  return !!task.isShoppingList && !!memberId;
}

/**
 * Item toggles use the active task's availability boundaries, but unlike a
 * generic task submission they remain available while list completion is
 * pending or approved. The canonical route accepts changes until the task
 * itself stops being active.
 */
export function canToggleShoppingList(task: TvTask, memberId: string, now = new Date()) {
  if (!canOpenShoppingList(task, memberId)) return false;
  const state = resolveTvTaskState({ ...task, isShoppingList: false }, memberId, now);
  // The canonical item-toggle route deliberately permits unchecking an active
  // list while collective completions are pending; it removes those stale
  // completion rows when the list is no longer fully checked. Task-level and
  // per-member availability boundaries still apply.
  return !state.closed
    && !state.notAssigned
    && !state.weekend
    && !state.unavailable
    && !(state.due !== null && (state.daysPast < 0 || state.daysPast > 1))
    && !(task.remainingSlots != null && task.remainingSlots <= 0);
}

/**
 * Keep completed aggregate tasks visible only when the selected member (or,
 * on a parent overview, at least one assignee) still has work to do. One-off
 * tasks completed for everyone stay hidden.
 */
export function shouldShowTvTask(
  task: TvTask,
  memberId: string,
  role: 'parent' | 'child',
  now = new Date(),
) {
  if (task.status === 'active' || task.status === 'pending_approval') return true;
  if (task.status !== 'completed') return false;

  // One-off shopping lists finish collectively. They are not dashboard
  // history, even if individual assignee rows still look incomplete.
  if (task.isShoppingList) {
    const shoppingState = resolveTvTaskState(task, memberId, now);
    if (!isRecurring(task)) return shoppingState.pending;
    // Recurring lists may remain viewable during their current round.
    if (!shoppingState.notAssigned && (shoppingState.pending || shoppingState.approved)) return true;
  }

  const people = getTvTaskPeople(task);
  const assignedIds = getTvTaskAssignedIds(task);
  const explicit = assignedIds.length > 0;
  const target = Math.min(3, Math.max(1, task.dailyTarget || 1));
  const oneOff = !isRecurring(task);

  if (explicit) {
    if (!people.length) return true;
    if (oneOff) {
      if (role === 'parent') {
        return people.some(person => !progressComplete(task, person, target));
      }
      const mine = people.find(person => person.memberId === memberId);
      return !mine || !progressComplete(task, mine, target);
    }
    if (people.some(person => !progressComplete(task, person, target))) return true;
    if (!!task.isSharedTask && explicit) {
      return people.some(person => !!person.nextAvailableDate)
        || !!task.memberNextAvailableDate
        || !!task.nextAvailableDate;
    }
    const hasMemberSpecificBoundary = people.some(person => owns(person, 'nextAvailableDate'))
      || owns(task, 'memberNextAvailableDate');
    return hasMemberSpecificBoundary
      ? people.some(person => !!person.nextAvailableDate) || !!task.memberNextAvailableDate
      : !!task.nextAvailableDate;
  }

  if (oneOff) return resolveTvTaskState(task, memberId, now).pending;

  const state = resolveTvTaskState(task, memberId, now);
  if (state.pending) return true;
  if (state.dailyMulti && !state.approved) return true;
  // A present null means this member has no future lock. Only fall back to the
  // aggregate date when the API omitted the member-specific property.
  return !!state.nextAvailableDate;
}