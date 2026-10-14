import { beforeEach, describe, expect, it } from 'vitest';
import type { TvTask } from '../hooks/use-tv-data';
import { taskCompletionFeedback, taskConfirmationText } from './tv-task-feedback';
import { setTvLanguage } from './tv-language';
beforeEach(() => setTvLanguage('de'));

const task: TvTask = {id:'task',title:'Aufräumen',points:10,status:'active',recurrence:'none'};
const team: TvTask = {...task,isSharedTask:true,sharedMemberIds:['one','two']};

describe('TV task feedback',()=>{
  it('keeps incomplete daily executions distinct from a final submission',()=>{
    expect(taskCompletionFeedback(team,{partial:true,dailyProgress:1,dailyTarget:3})).toEqual({
      title:'Fortschritt gespeichert',message:'1 von 3 Ausführungen heute. Die Aufgabe ist noch nicht fertig.',
    });
  });
  it('asks teammates to act only when the server reports missing contributions',()=>{
    expect(taskCompletionFeedback(team,{isTeamTask:true,autoApproved:false,teamReadyForApproval:false}).message).toContain('Die anderen sind jetzt dran');
  });
  it('reports collective approval after the last contribution',()=>{
    expect(taskCompletionFeedback(team,{isTeamTask:true,autoApproved:false,teamReadyForApproval:true})).toEqual({
      title:'Teamaufgabe eingereicht',message:'Alle haben ihren Teil eingereicht. Die Teamaufgabe wartet auf die gemeinsame Freigabe.',
    });
  });
  it('reports collective completion and points when the server auto-approves the team',()=>{
    expect(taskCompletionFeedback(team,{isTeamTask:true,autoApproved:true,teamReadyForApproval:true}).title).toBe('Teamaufgabe erledigt!');
  });
  it('avoids claiming other teammates are missing on an older server',()=>{
    expect(taskCompletionFeedback(team,{autoApproved:false}).message).toBe('Dein Teil der Teamaufgabe wurde eingereicht.');
  });
  it('uses authoritative server normalization of a legacy team flag',()=>{
    expect(taskCompletionFeedback(team,{isTeamTask:false,autoApproved:true}).message).toBe('Deine Aufgabe wurde eingetragen.');
  });
  it('does not label a family-wide legacy shared task as a team',()=>{
    const unassigned = {...task,isSharedTask:true};
    expect(taskConfirmationText(unassigned)).toBe('Deine Aufgabe wird für deine Familie eingetragen.');
    expect(taskCompletionFeedback(unassigned,{}).title).toBe('Gut gemacht!');
  });
  it('preserves existing ordinary approval and next-day confirmation wording',()=>{
    expect(taskConfirmationText({...task,requiresApproval:true})).toContain('Deine Eltern prüfen');
    expect(taskCompletionFeedback({...task,requiresApproval:true},{}).message).toBe('Die Aufgabe wartet auf die Freigabe.');
    expect(taskCompletionFeedback({...task,dueDate:'2026-10-01',requiresApproval:false},{autoApproved:false}).message).toBe('Deine Aufgabe wurde eingetragen.');
  });
});