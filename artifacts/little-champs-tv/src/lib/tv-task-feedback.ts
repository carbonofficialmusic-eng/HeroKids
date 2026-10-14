import type { TvTask, TvTaskCompletionResponse } from '../hooks/use-tv-data';
import { getTvTaskAssignedIds } from './tv-task-state';

export function taskConfirmationText(task: TvTask): string {
  if (task.isSharedTask && getTvTaskAssignedIds(task).length > 0) {
    return 'Damit reichst du deinen Teil der Teamaufgabe ein.';
  }
  return task.requiresApproval
    ? 'Deine Eltern prüfen die Aufgabe, bevor du Punkte bekommst.'
    : 'Deine Aufgabe wird für deine Familie eingetragen.';
}

export function taskCompletionFeedback(task: TvTask, result: TvTaskCompletionResponse): {title:string;message:string} {
  if (result.partial) {
    return {
      title: 'Fortschritt gespeichert',
      message: `${result.dailyProgress} von ${result.dailyTarget} Ausführungen heute. Die Aufgabe ist noch nicht fertig.`,
    };
  }
  const isTeam = result.isTeamTask ?? (!!task.isSharedTask && getTvTaskAssignedIds(task).length > 0);
  if (isTeam) {
    if (result.autoApproved === true) {
      return {title:'Teamaufgabe erledigt!',message:'Alle haben ihren Teil erledigt. Die Teamaufgabe ist abgeschlossen und die Punkte wurden gutgeschrieben.'};
    }
    if (result.teamReadyForApproval === true) {
      return {title:'Teamaufgabe eingereicht',message:'Alle haben ihren Teil eingereicht. Die Teamaufgabe wartet auf die gemeinsame Freigabe.'};
    }
    if (result.teamReadyForApproval === false) {
      return {title:'Teil eingereicht',message:'Dein Teil ist eingereicht. Die anderen sind jetzt dran.'};
    }
    // Older servers do not report whether this was the last contribution.
    // Do not claim that others still need to submit without that information.
    return {title:'Teil eingereicht',message:'Dein Teil der Teamaufgabe wurde eingereicht.'};
  }
  return {
    title:'Gut gemacht!',
    message:task.requiresApproval ? 'Die Aufgabe wartet auf die Freigabe.' : 'Deine Aufgabe wurde eingetragen.',
  };
}