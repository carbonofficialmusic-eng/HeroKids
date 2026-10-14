// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TvMember, TvTask } from '../hooks/use-tv-data';
import { TvTaskCard } from './tv-task-card';
import { setTvLanguage } from '../lib/tv-language';
beforeEach(() => setTvLanguage('de'));

// Cosmetic icons can resolve a separate React major version in the monorepo.
// Keep these tests on the same React 18 renderer as the tested components.
vi.mock('lucide-react', () => {
  const Icon = () => null;
  return {
    CalendarDays: Icon,
    Camera: Icon,
    Check: Icon,
    CheckCircle2: Icon,
    ChevronDown: Icon,
    Clock3: Icon,
    LockKeyhole: Icon,
    Pin: Icon,
    RefreshCw: Icon,
    ShoppingBasket: Icon,
    Star: Icon,
    Users: Icon,
  };
});

const baseTask: TvTask = {
  id: 'task',
  title: 'Zimmer aufräumen',
  points: 5,
  status: 'active',
  recurrence: 'none',
};

const parent: TvMember = { id: 'parent', displayName: 'Mama', role: 'parent' };
const child: TvMember = { id: 'child', displayName: 'Mia', role: 'child' };
const otherChild: TvMember = { id: 'other', displayName: 'Leo', role: 'child' };

function renderCard(task: TvTask, memberId = child.id, onComplete = vi.fn()) {
  const memberName = memberId === parent.id ? parent.displayName : memberId === otherChild.id ? otherChild.displayName : child.displayName;
  render(createElement(TvTaskCard,{task,memberId,memberName,onComplete}));
  return onComplete;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('TV task card assignment and daily progress', () => {
  it('lets a parent act on a task assigned to that parent', () => {
    renderCard({
      ...baseTask,
      assignedMemberCompletions: [
        { memberId: parent.id, displayName: parent.displayName, status: null, hasCompleted: false, hasSubmitted: false },
      ],
    }, parent.id);
    expect(screen.getByTestId('button-complete-task-task').textContent).toContain('Erledigt');
    expect(screen.queryByText('Zur Genehmigung wechseln')).toBeNull();
  });

  it('shows the family-wide 1/2 progress and lets the family continue an unassigned daily task', () => {
    const task = { ...baseTask, recurrence: 'daily', dailyTarget: 2, dailyProgress: 1 };
    renderCard(task, parent.id);
    expect(screen.getByTestId('button-complete-task-task')).not.toBeNull();
    const familyProgress = screen.getByTestId('daily-progress-family-task');
    expect(familyProgress.getAttribute('aria-label')).toBe('Familie: 1 von 2 heute');
    expect(familyProgress.querySelectorAll('.tv-daily-segment.done')).toHaveLength(1);
    expect(familyProgress.querySelectorAll('.tv-daily-segment.open')).toHaveLength(1);
    expect(screen.queryByTestId('daily-progress-member-task-parent')).toBeNull();
  });

  it('renders unassigned family daily progress from 0/2 through 2/2', () => {
    for (const completed of [0, 1, 2]) {
      cleanup();
      renderCard({
        ...baseTask,
        recurrence: 'daily',
        dailyTarget: 2,
        dailyProgress: completed,
        memberCompletionStatus: completed === 2 ? 'approved' : null,
        memberHasCompleted: completed === 2,
      }, parent.id);
      const badge = screen.getByTestId('daily-progress-family-task');
      expect(badge.getAttribute('aria-label')).toBe(`Familie: ${completed} von 2 heute`);
      expect(badge.querySelectorAll('.tv-daily-segment.done')).toHaveLength(completed);
      expect(badge.querySelectorAll('.tv-daily-segment.open')).toHaveLength(2 - completed);
      expect(screen.queryByTestId('button-complete-task-task') !== null).toBe(completed < 2);
    }
  });

  it.each([2, 3])('shows all %i family executions green while approval remains pending', (target) => {
    renderCard({
      ...baseTask,
      recurrence: 'daily',
      dailyTarget: target,
      dailyProgress: target,
      memberCompletionStatus: 'pending',
      memberHasCompleted: true,
    });
    expect(screen.getByTestId('status-task-task').textContent).toContain('Eingereicht');
    expect(screen.queryByTestId('button-complete-task-task')).toBeNull();
    const badge = screen.getByTestId('daily-progress-family-task');
    expect(badge.getAttribute('aria-label')).toBe(`Familie: ${target} von ${target} heute`);
    expect(badge.querySelectorAll('.tv-daily-segment.done')).toHaveLength(target);
    expect(badge.querySelectorAll('.tv-daily-segment.open')).toHaveLength(0);
  });

  it('shows family progress for a legacy shared task without selected member IDs', () => {
    renderCard({
      ...baseTask,
      recurrence: 'daily',
      dailyTarget: 2,
      dailyProgress: 1,
      isSharedTask: true,
      sharedMemberIds: [],
    });
    expect(screen.getByTestId('daily-progress-family-task').getAttribute('aria-label')).toBe('Familie: 1 von 2 heute');
    expect(screen.queryByText('Teamaufgabe')).toBeNull();
  });

  it('clearly marks a child-only task as not assigned to a parent', () => {
    renderCard({
      ...baseTask,
      assignedMemberCompletions: [
        { memberId: child.id, displayName: child.displayName, status: 'pending', hasCompleted: false, hasSubmitted: true },
      ],
      memberCompletionStatus: 'approved',
      memberHasCompleted: true,
    }, parent.id);
    expect(screen.getByText('Nicht zugeteilt')).not.toBeNull();
    expect(screen.queryByText('Zur Genehmigung wechseln')).toBeNull();
    expect(screen.queryByTestId('button-complete-task-task')).toBeNull();
  });

  it('uses the selected child row even when another child is pending', () => {
    renderCard({
      ...baseTask,
      assignedMemberCompletions: [
        { memberId: child.id, displayName: child.displayName, status: null, hasCompleted: false, hasSubmitted: false },
        { memberId: otherChild.id, displayName: otherChild.displayName, status: 'pending', hasCompleted: false, hasSubmitted: true },
      ],
    });
    expect(screen.getByTestId('button-complete-task-task')).not.toBeNull();
    expect(screen.getByText('Leo · Eingereicht')).not.toBeNull();
    expect(screen.queryByTestId('status-task-task')?.textContent ?? '').not.toContain('Eingereicht');
  });

  it('shows each assignee daily progress with names and green/yellow segments', () => {
    renderCard({
      ...baseTask,
      recurrence: 'daily',
      dailyTarget: 2,
      dailyProgress: 0,
      assignedMemberCompletions: [
        { memberId: child.id, displayName: child.displayName, status: null, hasCompleted: false, hasSubmitted: false, dailyProgress: 1 },
        { memberId: otherChild.id, displayName: otherChild.displayName, status: 'approved', hasCompleted: true, hasSubmitted: true, dailyProgress: 2 },
      ],
    });
    const mineProgress = screen.getByTestId('daily-progress-member-task-child');
    expect(mineProgress.getAttribute('aria-label')).toBe('Mia: 1 von 2 heute');
    expect(mineProgress.querySelectorAll('.tv-daily-segment.done')).toHaveLength(1);
    expect(mineProgress.querySelectorAll('.tv-daily-segment.open')).toHaveLength(1);
    expect(screen.getByTestId('daily-progress-member-task-other').getAttribute('aria-label')).toBe('Leo: 2 von 2 heute');
    expect(screen.queryByTestId('daily-progress-family-task')).toBeNull();
    expect(screen.getByTestId('button-complete-task-task')).not.toBeNull();
  });

  it('falls back to selected-member task progress when explicit assignment rows are absent', () => {
    renderCard({
      ...baseTask,
      recurrence: 'daily',
      dailyTarget: 2,
      dailyProgress: 1,
      sharedMemberIds: [parent.id],
      memberCompletionStatus: 'approved',
      memberHasCompleted: false,
    }, parent.id);
    expect(screen.getByTestId('button-complete-task-task')).not.toBeNull();
    const progress = screen.getByTestId('daily-progress-member-task-parent');
    expect(progress.getAttribute('aria-label')).toBe('Mama: 1 von 2 heute');
    expect(progress.querySelectorAll('.tv-daily-segment.done')).toHaveLength(1);
  });

  it('allows an approved partial 1/2 daily task to be submitted again', () => {
    renderCard({
      ...baseTask,
      recurrence: 'daily',
      dailyTarget: 2,
      assignedMemberCompletions: [
        { memberId: child.id, displayName: child.displayName, status: 'approved', hasCompleted: false, hasSubmitted: false, dailyProgress: 1 },
      ],
    });
    expect(screen.getByTestId('button-complete-task-task')).not.toBeNull();
    expect(screen.getByTestId('status-task-task').textContent).toContain('Bereit');
  });

  it('blocks a pending 1/2 daily task and shows its submitted state', () => {
    renderCard({
      ...baseTask,
      recurrence: 'daily',
      dailyTarget: 2,
      assignedMemberCompletions: [
        { memberId: child.id, displayName: child.displayName, status: 'pending', hasCompleted: false, hasSubmitted: true, dailyProgress: 1 },
      ],
    });
    expect(screen.getByTestId('status-task-task').textContent).toContain('Eingereicht');
    expect(screen.queryByTestId('button-complete-task-task')).toBeNull();
  });

  it('shows final 2/2 segments green while the card remains submitted', () => {
    renderCard({
      ...baseTask,
      recurrence: 'daily',
      dailyTarget: 2,
      assignedMemberCompletions: [
        { memberId: child.id, displayName: child.displayName, status: 'pending', hasCompleted: true, hasSubmitted: true, dailyProgress: 2 },
      ],
    });
    expect(screen.getByTestId('status-task-task').textContent).toContain('Eingereicht');
    expect(screen.queryByTestId('button-complete-task-task')).toBeNull();
    expect(screen.getByTestId('card-task-task').getAttribute('data-task-visual-state')).toBe('submitted');
    const progress = screen.getByTestId('daily-progress-member-task-child');
    expect(progress.querySelectorAll('.tv-daily-segment.done')).toHaveLength(2);
    expect(progress.querySelectorAll('.tv-daily-segment.open')).toHaveLength(0);
  });

  it.each([child, parent])('shows submitted 3/3 green for a $role without bypassing approval', (member) => {
    const onComplete = renderCard({
      ...baseTask,
      recurrence: 'daily',
      dailyTarget: 3,
      requiresApproval: true,
      assignedMemberCompletions: [
        { memberId: member.id, displayName: member.displayName, status: 'pending', hasCompleted: true, hasSubmitted: true, dailyProgress: 3 },
        { memberId: otherChild.id, displayName: otherChild.displayName, status: null, hasCompleted: false, hasSubmitted: false, dailyProgress: 1 },
      ],
    }, member.id);
    const progress = screen.getByTestId(`daily-progress-member-task-${member.id}`);
    expect(progress.getAttribute('aria-label')).toBe(`${member.displayName}: 3 von 3 heute`);
    expect(progress.querySelectorAll('.tv-daily-segment.done')).toHaveLength(3);
    expect(progress.querySelectorAll('.tv-daily-segment.open')).toHaveLength(0);
    const otherProgress = screen.getByTestId('daily-progress-member-task-other');
    expect(otherProgress.querySelectorAll('.tv-daily-segment.done')).toHaveLength(1);
    expect(otherProgress.querySelectorAll('.tv-daily-segment.open')).toHaveLength(2);
    expect(screen.getByTestId('status-task-task').textContent).toContain('Eingereicht');
    expect(screen.getByTestId('card-task-task').getAttribute('data-task-visual-state')).toBe('submitted');
    expect(screen.queryByTestId('button-complete-task-task')).toBeNull();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('shows fallback 3/3 progress green without marking the pending task approved', () => {
    renderCard({
      ...baseTask,
      recurrence: 'daily',
      dailyTarget: 3,
      dailyProgress: 3,
      sharedMemberIds: [child.id],
      memberCompletionStatus: 'pending',
      requiresApproval: true,
    });
    const progress = screen.getByTestId('daily-progress-member-task-child');
    expect(progress.querySelectorAll('.tv-daily-segment.done')).toHaveLength(3);
    expect(progress.querySelectorAll('.tv-daily-segment.open')).toHaveLength(0);
    expect(screen.getByTestId('status-task-task').textContent).toContain('Eingereicht');
    expect(screen.queryByTestId('button-complete-task-task')).toBeNull();
  });

  it('closes the final approved 2/2 daily task', () => {
    renderCard({
      ...baseTask,
      recurrence: 'daily',
      dailyTarget: 2,
      assignedMemberCompletions: [
        { memberId: child.id, displayName: child.displayName, status: 'approved', hasCompleted: true, hasSubmitted: true, dailyProgress: 2 },
      ],
    });
    expect(screen.getByTestId('status-task-task').textContent).toContain('Erledigt');
    expect(screen.queryByTestId('button-complete-task-task')).toBeNull();
  });

  it('does not let a team member resubmit an approved contribution before team reset', () => {
    renderCard({
      ...baseTask,
      isSharedTask: true,
      sharedMemberIds: [child.id, otherChild.id],
      sharedMemberCompletions: [
        { memberId: child.id, displayName: child.displayName, status: 'approved', hasCompleted: true, hasSubmitted: true },
        { memberId: otherChild.id, displayName: otherChild.displayName, status: null, hasCompleted: false, hasSubmitted: false },
      ],
    });
    expect(screen.getByTestId('status-task-task').textContent).toContain('Erledigt');
    expect(screen.queryByTestId('button-complete-task-task')).toBeNull();
  });

  it('keeps a stale completed aggregate visible to a parent but never claims it can be submitted', () => {
    renderCard({
      ...baseTask,
      status: 'completed',
      recurrence: 'daily',
      dailyTarget: 2,
      assignedMemberCompletions: [
        { memberId: parent.id, displayName: parent.displayName, status: null, hasCompleted: false, hasSubmitted: false, dailyProgress: 1 },
        { memberId: child.id, displayName: child.displayName, status: 'approved', hasCompleted: true, hasSubmitted: true, dailyProgress: 2 },
      ],
    }, parent.id);
    expect(screen.getByTestId('text-task-title-task')).not.toBeNull();
    expect(screen.getByTestId('daily-progress-member-task-parent').getAttribute('aria-label')).toBe('Mama: 1 von 2 heute');
    expect(screen.getByTestId('status-task-task').textContent).toContain('Aufgabe abgeschlossen');
    expect(screen.queryByTestId('button-complete-task-task')).toBeNull();
  });

  it('keeps the photo-required route on Handy nutzen and normal tasks on Erledigt', () => {
    const onComplete = renderCard({ ...baseTask, requiresProof: true });
    expect(screen.getByTestId('button-complete-task-task').textContent).toContain('Handy nutzen');
    fireEvent.click(screen.getByTestId('button-complete-task-task'));
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ requiresProof: true }));
    cleanup();
    renderCard(baseTask);
    expect(screen.getByTestId('button-complete-task-task').textContent).toContain('Erledigt');
    expect(screen.queryByText('Foto erforderlich')).toBeNull();
  });

  it('opens shopping lists with a distinct list action and never shows generic completion', () => {
    const openList = renderCard({ ...baseTask, isShoppingList: true });
    expect(screen.getByTestId('button-open-shopping-list-task').textContent).toContain('Liste öffnen');
    expect(screen.queryByTestId('button-complete-task-task')).toBeNull();
    fireEvent.click(screen.getByTestId('button-open-shopping-list-task'));
    expect(openList).toHaveBeenCalledWith(expect.objectContaining({ isShoppingList: true }));
  });

  it.each([child, parent])('keeps shopping-list workflow colors visible for a $role through submission, reopening and approval', (member) => {
    // Preserve the real stylesheet's rule order to catch cascade regressions.
    const taskStyles = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../index.css'), 'utf8');
    const rules = taskStyles.match(/^\.tv-task(?:\.task-unavailable|\[data-task-visual-state="(?:submitted|approved)"\]) \{[^\n]+\}/gm);
    expect(rules).toHaveLength(3);
    const style = document.createElement('style');
    style.textContent = rules!.join('\n');
    document.head.appendChild(style);
    try {
      const task: TvTask = {
        ...baseTask,
        isShoppingList: true,
        requiresApproval: true,
        assignedMemberCompletions: [
          { memberId: member.id, displayName: member.displayName, status: null, hasCompleted: false, hasSubmitted: false },
        ],
      };
      const onComplete = vi.fn();
      const props = { memberId: member.id, onComplete };
      const { rerender } = render(createElement(TvTaskCard, { ...props, task }));
      const card = screen.getByTestId('card-task-task');
      expect(card.classList.contains('task-unavailable')).toBe(true);
      expect(window.getComputedStyle(card).borderTopColor).toBe('rgb(52, 70, 98)');

      const submitted: TvTask = {
        ...task,
        assignedMemberCompletions: [
          { memberId: member.id, displayName: member.displayName, status: 'pending', hasCompleted: false, hasSubmitted: true },
        ],
      };
      rerender(createElement(TvTaskCard, { ...props, task: submitted }));
      expect(card.getAttribute('data-task-visual-state')).toBe('submitted');
      expect(window.getComputedStyle(card).borderTopColor).toBe('rgba(255, 195, 40, 0.42)');
      expect(screen.getByTestId('status-task-task').textContent).toContain('Eingereicht');
      expect(screen.getByTestId('button-open-shopping-list-task')).not.toBeNull();
      expect(screen.queryByTestId('button-complete-task-task')).toBeNull();

      // Unchecking a product clears the pending completion and restores open styling.
      rerender(createElement(TvTaskCard, { ...props, task }));
      expect(card.getAttribute('data-task-visual-state')).toBe('open');
      expect(window.getComputedStyle(card).borderTopColor).toBe('rgb(52, 70, 98)');

      rerender(createElement(TvTaskCard, { ...props, task: {
        ...task,
        status: 'completed',
        assignedMemberCompletions: [
          { memberId: member.id, displayName: member.displayName, status: 'approved', hasCompleted: true, hasSubmitted: true },
        ],
      } }));
      expect(card.getAttribute('data-task-visual-state')).toBe('approved');
      expect(window.getComputedStyle(card).borderTopColor).toBe('rgba(34, 197, 94, 0.32)');
      expect(screen.getByTestId('status-task-task').textContent).toContain('Erledigt');
      expect(onComplete).not.toHaveBeenCalled();
    } finally {
      style.remove();
    }
  });

  it('renders custom recurrenceDays as an interval label', () => {
    renderCard({ ...baseTask, recurrenceDays: 7 });
    expect(screen.getByText('Alle 7 Tage')).not.toBeNull();
  });
});