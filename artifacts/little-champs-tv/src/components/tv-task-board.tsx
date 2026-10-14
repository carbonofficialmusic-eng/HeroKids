import { useState, type ReactNode } from 'react';
import { CalendarDays, ChevronDown, Pin, Star } from 'lucide-react';
import type { TvMember, TvTask } from '../hooks/use-tv-data';
import { TvTaskCard } from './tv-task-card';
import { shouldShowTvTask } from '../lib/tv-task-state';
import spongeIcon from '../assets/sponge.svg';
import { tvText, useTvLanguage } from '../lib/tv-language';

type Category = 'household' | 'school' | 'selfCare' | 'other';
const categoryOrder: Category[] = ['household','school','selfCare','other'];
const categoryLabels: Record<Category,string> = {
  household:'Haushalt',school:'Schule & Lernen',selfCare:'Körperpflege',other:'Sonstige',
};
const categoryIcons: Record<Exclude<Category,'selfCare'>,string> = {
  household:'🏠',school:'📚',other:'⭐',
};
const householdIcons = ['🧹','🍽️','🗑️','🧺','🛁','🧼','🪣','🧽'];
const schoolIcons = ['📚','✏️','📝','📖','🎒','✍️','📓','🎓'];
const selfCareIcons = ['🦷','🚿','💇','🛏️','👕','👟','🧴'];

function categoryFor(task: TvTask): Category {
  const emoji = task.iconEmoji || '⭐';
  if (householdIcons.includes(emoji)) return 'household';
  if (schoolIcons.includes(emoji)) return 'school';
  if (selfCareIcons.includes(emoji)) return 'selfCare';
  return 'other';
}

function taskPriority(task: TvTask) {
  if (task.isSharedTask) return 2;
  if ((task.assignedMemberCompletions?.length ?? 0) > 1) return 1;
  return 0;
}

// Match the parent and kid boards: single assignment, multi-assignment, team;
// then due date (undated last) and finally title.
export function sortBoardTasks(tasks: TvTask[]) {
  return [...tasks].sort((a,b)=>{
    const priority=taskPriority(a)-taskPriority(b);
    if (priority) return priority;
    const dueA=a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const dueB=b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    if (dueA!==dueB) return dueA-dueB;
    return a.title.localeCompare(b.title);
  });
}

function localDateKey() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
}
function fixedAppointment(task: TvTask) {
  return !!task.dueDate && task.recurrence === 'none';
}
function sortAppointments(tasks: TvTask[]) {
  // The iOS board sorts by date, time (all-day last), then input order.
  return tasks.map((task,index)=>({task,index})).sort((a,b)=>
    String(a.task.dueDate).slice(0,10).localeCompare(String(b.task.dueDate).slice(0,10))
    || String(a.task.dueTime || '99:99').localeCompare(String(b.task.dueTime || '99:99'))
    || a.index-b.index
  ).map(({task})=>task);
}

function appointmentTime(task: TvTask) {
  if (!task.dueTime) return 'Ganztägig';
  const time = task.dueTime.slice(0,5);
  if (!task.durationMinutes) return `${time} Uhr`;
  const [hours,minutes] = time.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return `${time} Uhr`;
  const end = hours*60+minutes+task.durationMinutes;
  return `${time}–${String(Math.floor(end/60)%24).padStart(2,'0')}:${String(end%60).padStart(2,'0')} Uhr`;
}

function assigneeName(task: TvTask, members: TvMember[]) {
  const assigned = task.assignedMemberCompletions?.length
    ? task.assignedMemberCompletions
    : task.sharedMemberCompletions;
  const names = assigned?.map(person=>person.displayName)
    ?? members.filter(person=>task.sharedMemberIds?.includes(person.id)).map(person=>person.displayName);
  return names.length ? names.join(' & ') : '–';
}

function UpcomingAppointments({appointments,members,onOpen}:{appointments:TvTask[];members:TvMember[];onOpen:(task:TvTask)=>void}) {
  useTvLanguage();
  const [showAll,setShowAll] = useState(false);
  if (!appointments.length) return null;
  const dateFormatter = new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'});
  return <section className="tv-upcoming" data-testid="card-more-appointments">
    <h3><span className="tv-upcoming-icon"><CalendarDays size={22}/></span>Weitere Termine</h3>
    <div className="tv-upcoming-rows">{appointments.slice(0,showAll?undefined:3).map((task,index)=>
      <button key={task.id} type="button" className="tv-upcoming-row" onClick={()=>onOpen(task)} data-testid={`button-more-appointment-${task.id}`}>
        <span className={`tv-upcoming-date tv-upcoming-date-${index%3}`}>{dateFormatter.format(new Date(`${String(task.dueDate).slice(0,10)}T12:00:00`))}</span>
        <span className="tv-upcoming-assignee">{assigneeName(task,members)}</span>
        <span className="tv-upcoming-name"><span aria-hidden="true">{task.iconEmoji || '📅'}</span><span><strong>{task.title}</strong><small>{appointmentTime(task)}</small></span></span>
      </button>
    )}</div>
    {appointments.length>3 && <button type="button" className="tv-upcoming-more" onClick={()=>setShowAll(value=>!value)}>{showAll?'Weniger anzeigen':`Alle ${appointments.length} weiteren Termine anzeigen`}</button>}
  </section>;
}

export function TvTaskBoard({tasks,appointments,member,members,categoryNames,onComplete,onOpenAppointment}:{
  tasks:TvTask[];appointments:TvTask[];member:TvMember;members:TvMember[];
  categoryNames?:Record<string,string>|null;
  onComplete:(task:TvTask)=>void;onOpenAppointment:(task:TvTask)=>void;
}) {
  useTvLanguage();
  const storageKey=`little-champs-tv_${member.role}_collapsed_categories`;
  const [collapsed,setCollapsed] = useState<Set<string>>(()=>{
    try {return new Set(JSON.parse(localStorage.getItem(storageKey) || '[]') as string[]);}
    catch {return new Set();}
  });
  const toggle=(key:string)=>{
    setCollapsed(previous=>{
      const next=new Set(previous);
      if (next.has(key)) next.delete(key); else next.add(key);
      try {localStorage.setItem(storageKey,JSON.stringify([...next]));} catch {/* Keep collapse state for this session. */}
      return next;
    });
  };
  const activeTasks=tasks.filter(task=>shouldShowTvTask(task,member.id,member.role));
  const byId=new Map(tasks.map(task=>[task.id,task]));
  const fixedAppointments=sortAppointments(appointments
    .map(appointment=>byId.get(appointment.id) ? {...byId.get(appointment.id)!,isGoogleCalendarEvent:appointment.isGoogleCalendarEvent} : appointment)
    .filter(task=>task.status==='active' && fixedAppointment(task) && String(task.dueDate).slice(0,10)>=localDateKey()));
  const important=activeTasks.filter(task=>task.isImportant && !fixedAppointment(task));
  const regular=activeTasks.filter(task=>!task.isImportant && !fixedAppointment(task));
  const groups=categoryOrder.map(category=>({
    category,tasks:sortBoardTasks(regular.filter(task=>categoryFor(task)===category)),
  })).filter(group=>group.tasks.length);
  const renderCards=(items:TvTask[])=><div className="task-grid">{items.map(task=>
    <TvTaskCard key={task.id} task={task} memberId={member.id} memberName={member.displayName} onComplete={onComplete}/>
  )}</div>;
  const renderSection=(key:string,label:string,icon:ReactNode,content:ReactNode)=>{
    const isCollapsed=collapsed.has(key);
    return <section key={key} className="tv-task-section" data-testid={`section-${key.replace(/_/g,'')}`}>
      <button type="button" className={`tv-category-heading ${key==='__important__'?'important':key==='__appointments__'?'appointments':''}`} aria-expanded={!isCollapsed} aria-controls={`tv-category-${key}`} onClick={()=>toggle(key)} data-testid={`button-category-${key}`}>
        <span className="tv-category-label">{icon}<strong>{label}</strong></span>
        <ChevronDown className={isCollapsed?'collapsed':''} size={34} strokeWidth={3}/>
      </button>
      <div id={`tv-category-${key}`} hidden={isCollapsed} className="tv-category-content">{content}</div>
    </section>;
  };
  if (!important.length && !fixedAppointments.length && !groups.length) {
    return <div className="empty"><h2>Heute ist alles ruhig</h2><p>Neue Aufgaben deiner Familie erscheinen hier.</p></div>;
  }
  return <div className="tv-task-sections">
    {important.length>0 && renderSection('__important__','Wichtig',<Pin size={27} strokeWidth={2.7}/>,renderCards(important))}
    {fixedAppointments.length>0 && renderSection('__appointments__','Termine',<CalendarDays size={27} strokeWidth={2.7}/>,
      <div className="tv-appointment-layout">
        <TvTaskCard task={fixedAppointments[0]} memberId={member.id} memberName={member.displayName} onComplete={onComplete}/>
        <UpcomingAppointments appointments={fixedAppointments.slice(1)} members={members} onOpen={onOpenAppointment}/>
      </div>)}
    {groups.map(({category,tasks:items})=>renderSection(category,categoryNames?.[category] || tvText(categoryLabels[category]),
      category==='selfCare'
        ? <img className="tv-category-image" src={spongeIcon} alt="" aria-hidden="true"/>
        : <span className="tv-category-emoji" aria-hidden="true">{categoryIcons[category]}</span>,renderCards(items)))}
  </div>;
}