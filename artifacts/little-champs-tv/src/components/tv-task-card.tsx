import { CalendarDays, Camera, Check, CheckCircle2, Clock3, LockKeyhole, RefreshCw, ShoppingBasket, Star, Users } from 'lucide-react';
import type { TvTask } from '../hooks/use-tv-data';
import { canOpenShoppingList, resolveTvTaskState } from '../lib/tv-task-state';
import { tvText, useTvLanguage } from '../lib/tv-language';

function progressLabel(progress: NonNullable<TvTask['assignedMemberCompletions']>[number], task: TvTask) {
  if (progress.status === 'pending') return 'Eingereicht';
  if (progress.status === 'rejected') return 'Erneut versuchen';
  if (task.recurrence === 'daily' && (task.dailyTarget || 1) > 1) {
    return (progress.dailyProgress || 0) >= (task.dailyTarget || 1) ? 'Erledigt' : 'Offen';
  }
  return progress.status === 'approved' || progress.hasCompleted ? 'Erledigt' : 'Offen';
}
function recurrenceLabel(task: TvTask) {
  if ((task.recurrenceDays ?? 0) > 0) {
    return task.recurrenceDays === 1 ? 'Täglich' : tvText('Alle {0} Tage',[task.recurrenceDays]);
  }
  switch (task.recurrence) {
    case 'daily': return 'Täglich';
    case 'weekly': return 'Wöchentlich';
    case 'weekdays': return 'Mo–Fr';
    case 'monthly': return 'Monatlich';
    case 'yearly': return 'Jährlich';
    case 'immediate': return 'Sofort wiederholbar';
    default: return 'Einmalige Aufgabe';
  }
}

function DailyProgress({name,completed,total,testId}:{name:string;completed:number;total:number;testId:string}) {
  const safeTotal=Math.min(3,Math.max(1,total));
  const safeCompleted=Math.min(safeTotal,Math.max(0,completed));
  return <span className="tv-daily-progress" data-testid={testId} aria-label={`${name}: ${safeCompleted} von ${safeTotal} heute`}>
    <span className="tv-daily-progress-name">{name}</span>
    {Array.from({length:safeTotal},(_,index)=><span key={index} className={`tv-daily-segment ${index<safeCompleted?'done':'open'}`} aria-hidden="true">{index<safeCompleted?'✓':index+1}</span>)}
  </span>;
}

export function TvTaskCard({ task, memberId, memberName, onComplete }: {task:TvTask;memberId:string;memberName?:string;onComplete:(task:TvTask)=>void}) {
  useTvLanguage();
  const state = resolveTvTaskState(task,memberId);
  const {people,approved,pending,rejected,visual,dailyTarget,dailyProgress,dailyMulti,unavailable,weekend,due,daysPast,nextAvailableDate,notAssigned,closed,locked,actionable} = state;
  const canOpenList = canOpenShoppingList(task,memberId);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const dueToday = due===today && visual==='open' && actionable;
  const reason = notAssigned?'Nicht zugeteilt':weekend?'Nur werktags':due && daysPast<0?'Noch nicht verfügbar':due && daysPast>1?'Frist abgelaufen':unavailable?'Später verfügbar':task.remainingSlots!=null && task.remainingSlots<=0?'Alle Plätze belegt':state.teamContributionBlocked?'Teamrunde abwarten':task.status==='completed'?'Aufgabe abgeschlossen':closed?'Nicht verfügbar':null;
  const label = pending?'Eingereicht':approved?'Erledigt':reason || (canOpenList?'Liste öffnen':rejected?'Erneut versuchen':'Bereit');
  const stateTone = pending?'amber':approved?'mint':rejected?'coral':locked?'muted':'cyan';
  const familyDailyProgress = dailyMulti && !state.hasExplicitAssignees;
  return <article className={`task tv-task ${locked?'task-unavailable':''} ${dueToday?'lc-task-due-today':''}`} tabIndex={actionable ? undefined : 0} aria-label={!actionable ? `${task.title}: ${label}` : undefined} data-task-visual-state={visual} data-testid={`card-task-${task.id}`}>
    {dueToday && <span className="due-ribbon" data-testid={`badge-due-today-${task.id}`}><CalendarDays size={17}/> Heute fällig</span>}
    <div className="task-top"><span className={`pill ${stateTone}`} data-testid={`status-task-${task.id}`}>{pending?<Clock3 size={17}/>:approved?<CheckCircle2 size={17}/>:locked?<LockKeyhole size={17}/>:rejected?<RefreshCw size={17}/>:<Check size={17}/>} {label}</span><span className="pill amber"><Star size={17}/>{task.points} Punkte</span></div>
    <div className="task-content"><h3 data-testid={`text-task-title-${task.id}`}>{task.title}</h3>{task.description && <p>{task.description}</p>}</div>
    <div className="task-meta">
      {state.isTeamTask && <span className="task-label lc-team-task-label"><Users size={16}/> Teamaufgabe</span>}
      {task.recurrence==='immediate' && <span className="task-label lc-immediate-task-label"><RefreshCw size={16}/> Sofort wiederholbar</span>}
      {task.requiresProof && <span className="task-label"><Camera size={16}/> Foto erforderlich</span>}
      {task.recurrenceDays && due && <span className="task-label tv-custom-recurrence">{recurrenceLabel(task)}</span>}
      {familyDailyProgress && <DailyProgress name={tvText('Familie')} completed={dailyProgress} total={dailyTarget} testId={`daily-progress-family-${task.id}`}/>}
    </div>
    {people.length>0 && <div className="task-people"><span>{state.isTeamTask?'Team':'Zugewiesen'}:</span>{people.map(person=><span key={person.memberId} className={`person-state ${person.status||'open'}`}>{person.displayName} · {progressLabel(person,task)}</span>)}</div>}
    {dailyMulti && state.hasExplicitAssignees && (people.length>0 || !notAssigned) && <div className="task-people tv-daily-progress-list" aria-label="Tagesfortschritt je Person">
      {people.length>0
        ? people.map(person=><DailyProgress key={person.memberId} name={person.displayName} completed={person.dailyProgress||0} total={dailyTarget} testId={`daily-progress-member-${task.id}-${person.memberId}`}/>)
        : <DailyProgress name={memberName || 'Ausgewählt'} completed={dailyProgress} total={dailyTarget} testId={`daily-progress-member-${task.id}-${memberId}`}/>}
    </div>}
    <div className="task-footer"><span><CalendarDays size={17}/>{due ? daysPast===0?'Heute fällig':daysPast===1?'Gestern fällig':daysPast>1?'Frist abgelaufen':`Ab ${new Date(`${due}T12:00:00`).toLocaleDateString('de-DE',{day:'numeric',month:'short'})}` : unavailable && nextAvailableDate ? `Wieder ab ${new Date(nextAvailableDate).toLocaleDateString('de-DE',{day:'numeric',month:'short'})}` : recurrenceLabel(task)}</span>{canOpenList
      ? <button className="button primary" onClick={()=>onComplete(task)} data-testid={`button-open-shopping-list-${task.id}`}>Liste öffnen <ShoppingBasket size={18}/></button>
      : actionable && <button className="button primary" onClick={()=>onComplete(task)} data-testid={`button-complete-task-${task.id}`}>{task.requiresProof?'Handy nutzen':rejected?'Erneut einreichen':'Erledigt'} <Check size={18}/></button>}</div>
  </article>;
}