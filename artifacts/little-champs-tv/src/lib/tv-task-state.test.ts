import { describe, expect, it } from 'vitest';
import type { TvTask } from '../hooks/use-tv-data';
import { canOpenShoppingList, canToggleShoppingList, resolveTvTaskState, shouldShowTvTask } from './tv-task-state';

const now = new Date(2026, 5, 12, 12);
const future = new Date(now.getTime() + 3 * 86400000).toISOString();

const activeTask: TvTask = {
  id: 'task',
  title: 'Aufgabe',
  points: 5,
  status: 'active',
  recurrence: 'none',
};

describe('resolveTvTaskState', () => {
  it('allows a parent to complete a task explicitly assigned to that parent', () => {
    const task: TvTask = {
      ...activeTask,
      assignedMemberCompletions: [
        { memberId: 'parent', displayName: 'Mama', status: null, hasCompleted: false },
      ],
    };

    expect(resolveTvTaskState(task, 'parent', now)).toMatchObject({
      notAssigned: false,
      actionable: true,
      visual: 'open',
    });
  });

  it('keeps an unassigned family task family-wide and blocks after family completion', () => {
    const task: TvTask = { ...activeTask, memberCompletionStatus: 'approved', memberHasCompleted: true };
    const state = resolveTvTaskState(task, 'child', now);
    expect(state.hasExplicitAssignees).toBe(false);
    expect(state.actionable).toBe(false);
    expect(state.approved).toBe(true);
  });

  it('uses family-wide daily progress and leaves an approved partial target open', () => {
    const task: TvTask = {
      ...activeTask,
      recurrence: 'daily',
      dailyTarget: 2,
      dailyProgress: 1,
      memberCompletionStatus: 'approved',
      memberHasCompleted: true,
    };
    expect(resolveTvTaskState(task, 'parent', now)).toMatchObject({
      actionable: true,
      approved: false,
      dailyProgress: 1,
      dailyTarget: 2,
    });
  });

  it('blocks an unassigned family task only after the shared daily target is reached', () => {
    const task: TvTask = {
      ...activeTask,
      recurrence: 'daily',
      dailyTarget: 2,
      dailyProgress: 2,
      memberCompletionStatus: 'approved',
      memberHasCompleted: true,
    };
    expect(resolveTvTaskState(task, 'parent', now)).toMatchObject({
      dailyProgress: 2,
      approved: true,
      actionable: false,
    });
  });

  it('treats a legacy shared flag without selected IDs as a family-wide task', () => {
    const task: TvTask = {
      ...activeTask,
      recurrence: 'daily',
      dailyTarget: 2,
      dailyProgress: 1,
      isSharedTask: true,
      sharedMemberIds: [],
      memberCompletionStatus: 'approved',
      memberHasCompleted: true,
    };
    expect(resolveTvTaskState(task, 'parent', now)).toMatchObject({
      isTeamTask: false,
      hasExplicitAssignees: false,
      dailyProgress: 1,
      approved: false,
      actionable: true,
    });
  });

  it('falls back to selected-member task metadata when assigned completion rows are absent', () => {
    const task: TvTask = {
      ...activeTask,
      recurrence: 'daily',
      dailyTarget: 2,
      dailyProgress: 1,
      sharedMemberIds: ['parent'],
      memberCompletionStatus: 'approved',
      memberHasCompleted: false,
    };
    expect(resolveTvTaskState(task, 'parent', now)).toMatchObject({
      hasExplicitAssignees: true,
      notAssigned: false,
      mine: undefined,
      dailyProgress: 1,
      actionable: true,
      approved: false,
    });
    expect(resolveTvTaskState(task, 'child', now)).toMatchObject({
      notAssigned: true,
      dailyProgress: 0,
      actionable: false,
    });
  });

  it('does not let the status of other assigned members block or complete the selected member', () => {
    const task: TvTask = {
      ...activeTask,
      assignedMemberCompletions: [
        { memberId: 'mine', displayName: 'Mia', status: null, hasCompleted: false },
        { memberId: 'other', displayName: 'Leo', status: 'pending', hasCompleted: false, hasSubmitted: true },
      ],
      memberCompletionStatus: 'approved',
      memberHasCompleted: true,
    };
    expect(resolveTvTaskState(task, 'mine', now)).toMatchObject({
      actionable: true,
      pending: false,
      approved: false,
      visual: 'open',
    });
    expect(resolveTvTaskState(task, 'other', now)).toMatchObject({
      actionable: false,
      pending: true,
      visual: 'submitted',
    });
  });

  it('leaves a daily assignee actionable after approved progress 1/2 despite aggregate approval', () => {
    const task: TvTask = {
      ...activeTask,
      recurrence: 'daily',
      dailyTarget: 2,
      memberHasCompleted: true,
      memberCompletionStatus: 'approved',
      assignedMemberCompletions: [
        { memberId: 'mine', displayName: 'Mia', status: 'approved', hasCompleted: false, hasSubmitted: false, dailyProgress: 1 },
        { memberId: 'other', displayName: 'Leo', status: 'approved', hasCompleted: true, hasSubmitted: true, dailyProgress: 2 },
      ],
    };
    expect(resolveTvTaskState(task, 'mine', now)).toMatchObject({
      dailyProgress: 1,
      dailyTarget: 2,
      actionable: true,
      approved: false,
      visual: 'open',
    });
    expect(shouldShowTvTask(task, 'mine', 'child', now)).toBe(true);
  });

  it('keeps inconsistent completed aggregates display-only even when an assignee row is open', () => {
    const task: TvTask = {
      ...activeTask,
      status: 'completed',
      recurrence: 'daily',
      dailyTarget: 2,
      assignedMemberCompletions: [
        { memberId: 'mine', displayName: 'Mia', status: null, hasCompleted: false, hasSubmitted: false, dailyProgress: 1 },
      ],
    };
    expect(shouldShowTvTask(task, 'mine', 'parent', now)).toBe(true);
    expect(resolveTvTaskState(task, 'mine', now)).toMatchObject({
      closed: true,
      actionable: false,
    });
  });

  it('blocks pending approval at daily progress 1/2', () => {
    const task: TvTask = {
      ...activeTask,
      recurrence: 'daily',
      dailyTarget: 2,
      assignedMemberCompletions: [
        { memberId: 'mine', displayName: 'Mia', status: 'pending', hasCompleted: false, hasSubmitted: true, dailyProgress: 1 },
      ],
    };
    expect(resolveTvTaskState(task, 'mine', now)).toMatchObject({
      pending: true,
      actionable: false,
      visual: 'submitted',
    });
  });

  it('closes the selected member at the final approved 2/2 daily execution', () => {
    const task: TvTask = {
      ...activeTask,
      recurrence: 'daily',
      dailyTarget: 2,
      assignedMemberCompletions: [
        { memberId: 'mine', displayName: 'Mia', status: 'approved', hasCompleted: true, hasSubmitted: true, dailyProgress: 2 },
      ],
    };
    expect(resolveTvTaskState(task, 'mine', now)).toMatchObject({
      actionable: false,
      approved: true,
      visual: 'approved',
    });
  });

  it('treats explicit member availability null as authoritative instead of using a global future date', () => {
    const task: TvTask = {
      ...activeTask,
      memberNextAvailableDate: null,
      nextAvailableDate: future,
    };
    expect(resolveTvTaskState(task, 'child', now).unavailable).toBe(false);
    expect(resolveTvTaskState({ ...activeTask, nextAvailableDate: future }, 'child', now).unavailable).toBe(true);
  });

  it('does not retain an assigned recurring task from an unrelated global date when the member row is null', () => {
    const completedTask: TvTask = {
      ...activeTask,
      status: 'completed',
      recurrence: 'weekly',
      memberNextAvailableDate: null,
      nextAvailableDate: future,
      assignedMemberCompletions: [
        { memberId: 'mine', displayName: 'Mia', status: 'approved', hasCompleted: true, nextAvailableDate: null },
      ],
    };
    expect(shouldShowTvTask(completedTask, 'mine', 'child', now)).toBe(false);
    const withoutMemberBoundary = { ...completedTask };
    delete withoutMemberBoundary.memberNextAvailableDate;
    expect(shouldShowTvTask({
      ...withoutMemberBoundary,
      assignedMemberCompletions: [{ memberId: 'mine', displayName: 'Mia', status: 'approved', hasCompleted: true }],
    }, 'mine', 'child', now)).toBe(true);
  });

  it('uses an assigned row null boundary instead of another member or aggregate boundary', () => {
    const task: TvTask = {
      ...activeTask,
      memberNextAvailableDate: future,
      nextAvailableDate: future,
      assignedMemberCompletions: [
        { memberId: 'mine', displayName: 'Mia', status: null, hasCompleted: false, nextAvailableDate: null },
      ],
    };
    expect(resolveTvTaskState(task, 'mine', now).unavailable).toBe(false);
  });

  it('retains the intentional collective next-available date for team tasks', () => {
    const task: TvTask = {
      ...activeTask,
      isSharedTask: true,
      sharedMemberIds: ['mine', 'other'],
      nextAvailableDate: future,
      memberNextAvailableDate: null,
      sharedMemberCompletions: [
        { memberId: 'mine', displayName: 'Mia', status: null, hasCompleted: false },
        { memberId: 'other', displayName: 'Leo', status: null, hasCompleted: false },
      ],
    };
    expect(resolveTvTaskState(task, 'mine', now).unavailable).toBe(true);
  });

  it('keeps an approved team contribution blocked until team reset', () => {
    const task: TvTask = {
      ...activeTask,
      isSharedTask: true,
      sharedMemberIds: ['mine', 'other'],
      sharedMemberCompletions: [
        { memberId: 'mine', displayName: 'Mia', status: 'approved', hasCompleted: true, hasSubmitted: true },
        { memberId: 'other', displayName: 'Leo', status: null, hasCompleted: false, hasSubmitted: false },
      ],
    };
    expect(resolveTvTaskState(task, 'mine', now)).toMatchObject({
      teamContributionBlocked: true,
      actionable: false,
      approved: true,
    });
    expect(resolveTvTaskState({ ...task, sharedMemberCompletions: task.sharedMemberCompletions?.map(person => person.memberId === 'mine' ? { ...person, status: null, hasCompleted: false, hasSubmitted: false } : person) }, 'mine', now).actionable).toBe(true);
  });

  it('preserves weekend, actual due-date, slot, shopping-list and inactive/deleted locks', () => {
    const saturday = new Date(2026, 5, 13, 12);
    expect(resolveTvTaskState({ ...activeTask, recurrence: 'weekdays' }, 'child', saturday).locked).toBe(true);

    const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const twoDaysAhead = new Date(now.getTime() + 2 * 86400000);
    expect(resolveTvTaskState({ ...activeTask, dueDate: dateKey(twoDaysAhead) }, 'child', now).locked).toBe(true);
    expect(resolveTvTaskState({ ...activeTask, remainingSlots: 0 }, 'child', now).locked).toBe(true);
    expect(resolveTvTaskState({ ...activeTask, isShoppingList: true }, 'child', now).locked).toBe(true);
    expect(resolveTvTaskState({ ...activeTask, status: 'inactive' }, 'child', now).closed).toBe(true);
    expect(resolveTvTaskState({ ...activeTask, status: 'deleted' }, 'child', now).closed).toBe(true);
    expect(resolveTvTaskState({ ...activeTask, status: 'pending_approval' }, 'child', now)).toMatchObject({
      closed: true,
      actionable: false,
    });
  });
});

describe('shopping-list eligibility', () => {
  const listTask:TvTask={...activeTask,isShoppingList:true};

  it('allows an assigned active member to open and toggle a shopping list',()=>{
    expect(canOpenShoppingList(listTask,'mine')).toBe(true);
    expect(canToggleShoppingList(listTask,'mine',now)).toBe(true);
  });

  it('allows active pending or approved lists to be unchecked, but blocks archived and unassigned lists',()=>{
    expect(canOpenShoppingList({...listTask,memberCompletionStatus:'pending'},'mine')).toBe(true);
    expect(canToggleShoppingList({...listTask,memberCompletionStatus:'pending'},'mine',now)).toBe(true);
    expect(canOpenShoppingList({...listTask,memberCompletionStatus:'approved',memberHasCompleted:true},'mine')).toBe(true);
    expect(canToggleShoppingList({...listTask,memberCompletionStatus:'approved',memberHasCompleted:true},'mine',now)).toBe(true);
    expect(canOpenShoppingList({...listTask,status:'completed'},'mine')).toBe(true);
    expect(canToggleShoppingList({...listTask,status:'completed'},'mine',now)).toBe(false);
    expect(canOpenShoppingList({...listTask,sharedMemberIds:['other']},'mine')).toBe(true);
    expect(canToggleShoppingList({...listTask,sharedMemberIds:['other']},'mine',now)).toBe(false);
  });

  it('preserves availability boundaries for list-item toggles',()=>{
    const saturday=new Date(2026,5,13,12);
    expect(canToggleShoppingList({...listTask,recurrence:'weekdays'},'mine',saturday)).toBe(false);
    expect(canToggleShoppingList({...listTask,memberNextAvailableDate:future},'mine',now)).toBe(false);
    expect(canToggleShoppingList({...listTask,remainingSlots:0},'mine',now)).toBe(false);
    expect(canToggleShoppingList({...listTask,status:'pending_approval'},'mine',now)).toBe(false);
  });
});

describe('shouldShowTvTask', () => {
  it.each(['parent', 'child'] as const)('hides an approved completed one-off shopping list for a %s',role=>{
    const completedList:TvTask={
      ...activeTask,
      status:'completed',
      isShoppingList:true,
      memberCompletionStatus:'approved',
      memberHasCompleted:true,
    };
    expect(shouldShowTvTask(completedList,'mine',role,now)).toBe(false);
    expect(canToggleShoppingList(completedList,'mine',now)).toBe(false);
  });

  it('hides collectively completed one-off lists even with incomplete assignee rows', () => {
    const task: TvTask = {
      ...activeTask, status: 'completed', isShoppingList: true,
      assignedMemberCompletions: [
        { memberId: 'mine', displayName: 'Mia', status: 'approved', hasCompleted: true },
        { memberId: 'other', displayName: 'Leo', status: null, hasCompleted: false },
      ],
    };
    expect(shouldShowTvTask(task, 'mine', 'child', now)).toBe(false);
    expect(shouldShowTvTask(task, 'other', 'child', now)).toBe(false);
    expect(shouldShowTvTask(task, 'parent', 'parent', now)).toBe(false);
  });

  it('preserves open, pending and recurring shopping lists', () => {
    const task = { ...activeTask, isShoppingList: true };
    expect(shouldShowTvTask(task, 'mine', 'child', now)).toBe(true);
    expect(shouldShowTvTask({ ...task, status: 'pending_approval' }, 'mine', 'parent', now)).toBe(true);
    expect(shouldShowTvTask({ ...task, status: 'completed', memberCompletionStatus: 'pending' }, 'mine', 'child', now)).toBe(true);
    expect(shouldShowTvTask({
      ...task, status: 'completed', recurrence: 'weekly',
      memberCompletionStatus: 'approved', memberHasCompleted: true, memberNextAvailableDate: future,
    }, 'mine', 'child', now)).toBe(true);
  });

  it('keeps an aggregate-completed one-off in the parent overview until every assignee completes it', () => {
    const task: TvTask = {
      ...activeTask,
      status: 'completed',
      assignedMemberCompletions: [
        { memberId: 'parent', displayName: 'Mama', status: null, hasCompleted: false },
        { memberId: 'child', displayName: 'Mia', status: 'approved', hasCompleted: true },
      ],
    };
    expect(shouldShowTvTask(task, 'parent', 'parent', now)).toBe(true);
    expect(shouldShowTvTask(task, 'child', 'child', now)).toBe(false);
    expect(shouldShowTvTask({
      ...task,
      assignedMemberCompletions: task.assignedMemberCompletions?.map(person => ({ ...person, status: 'approved', hasCompleted: true })),
    }, 'parent', 'parent', now)).toBe(false);
  });

  it('keeps pending approval visible but hides inactive and deleted tasks', () => {
    expect(shouldShowTvTask({ ...activeTask, status: 'pending_approval' }, 'child', 'child', now)).toBe(true);
    expect(shouldShowTvTask({ ...activeTask, status: 'inactive' }, 'child', 'child', now)).toBe(false);
    expect(shouldShowTvTask({ ...activeTask, status: 'deleted' }, 'child', 'child', now)).toBe(false);
  });
});