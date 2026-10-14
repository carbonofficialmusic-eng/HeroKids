import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../index.css'), 'utf8');

function declarations(selector: string) {
  const start = css.indexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
}

describe('TV profile spacing on webOS and modern browsers', () => {
  it('separates the points trophy from its label on webOS without a doubled modern-browser gap', () => {
    expect(declarations('.dashboard-points-title')).toContain('gap:0');
    expect(declarations('.dashboard-points-title > svg')).toContain('margin-right:12px');
    expect(declarations('.dashboard-points-title > svg')).toContain('flex:none');
  });
  it('loosens TV titles, buttons and badges without changing their fonts or sizes', () => {
    const titles = declarations('.tv h1,.tv h2,.tv h3,.tv .member-card strong');
    const controls = declarations('.tv button,.tv .pill,.tv .task-label,.tv .person-state,.tv .tv-daily-progress');
    const categories = declarations('.tv .tv-category-heading');
    expect(titles).toContain('letter-spacing:normal');
    expect(controls).toContain('letter-spacing:.015em');
    expect(categories).toContain('letter-spacing:.01em');
    for (const rule of [titles, controls, categories]) {
      expect(rule).not.toMatch(/font(?:-size|-family|-weight)?\s*:/);
    }
    expect(css.lastIndexOf('.tv h1,.tv h2,.tv h3,.tv .member-card strong')).toBeGreaterThan(css.lastIndexOf('letter-spacing:-.025em'));
  });
  it('gives the dashboard profile label and name exactly the same 36px margin as member selection', () => {
    expect(declarations('.dashboard-profile > span:last-child')).toContain('margin-left:36px');
    expect(declarations('.member-info')).toContain('margin-left:36px');
  });

  it('does not add a flex gap on top of the dashboard text margin', () => {
    expect(declarations('.dashboard-profile')).toContain('gap:0');
    expect(declarations('.dashboard-profile')).not.toContain('gap:30px');
  });

  it('centers dashboard navigation with equal vertical padding while preserving bar height', () => {
    const dashboard = declarations('.dashboard-topbar');
    expect(dashboard).toContain('align-items:center');
    expect(dashboard).toContain('padding-top:17px');
    expect(dashboard).toContain('padding-bottom:17px');
  });

  it('separates every category name from its icon without relying on unsupported flex gap', () => {
    expect(declarations('.tv-category-label')).toContain('gap:0');
    expect(declarations('.tv-category-label')).not.toContain('gap:34px');
    expect(declarations('.tv-category-label > strong')).toContain('margin-left:34px');
  });

  it('spaces card sections on webOS without adding margins to empty metadata or absolute ribbons', () => {
    expect(declarations('.dashboard-main .tv-task')).toContain('gap:0');
    expect(declarations('.dashboard-main .tv-task')).toContain('min-height:190px');
    expect(declarations('.dashboard-main .tv-task > :not(.due-ribbon):not(.task-footer):not(:empty)')).toContain('margin-bottom:14px');
    expect(declarations('.task-footer')).toContain('margin-top:auto');
  });

  it('gives multiline text and the footer sufficient vertical separation', () => {
    expect(declarations('.dashboard-main .tv-task h3')).toContain('line-height:1.3');
    expect(declarations('.dashboard-main .tv-task h3')).toContain('margin:0 0 8px');
    expect(declarations('.dashboard-main .tv-task p')).toContain('line-height:1.5');
    expect(declarations('.dashboard-main .tv-task .task-footer')).toContain('padding-top:12px');
  });
});