import { AlertCircle, Check, CheckCircle2, Circle, Clock3, LockKeyhole, RefreshCw, ShoppingBasket, X } from 'lucide-react';
import type { TvShoppingListItem, TvTask } from '../hooks/use-tv-data';
import { useShoppingListItems, useTasks, useToggleShoppingListItem } from '../hooks/use-tv-data';
import { canToggleShoppingList, resolveTvTaskState } from '../lib/tv-task-state';

/** Content rendered inside the application's existing .overlay/.dialog shell. */
export interface TvShoppingListDialogProps {
  /** Shopping-list task currently selected on the TV task board. */
  task: TvTask;
  /** Identity of the selected family member, used for authenticated item toggles. */
  memberId: string;
  /** Use the linked-device credential when this is a legacy TV session. */
  legacy: boolean;
  /** Close the content and let the parent dismiss its existing dialog shell. */
  onClose: () => void;
  /** Called after the server confirms that all list items are complete. */
  onSuccess: (title: string, message: string) => void;
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Die Einkaufsliste konnte nicht geladen werden.';
}

function toggleLockMessage(task: TvTask, memberId: string) {
  if (!task.isShoppingList) return 'Diese Aufgabe ist keine Einkaufsliste mehr.';
  const state = resolveTvTaskState({ ...task, isShoppingList: false }, memberId);
  if (state.notAssigned) return 'Diese Liste ist einem anderen Familienmitglied zugeteilt.';
  if (state.weekend) return 'Diese Aufgabe kann am Wochenende nicht bearbeitet werden.';
  if (state.due && state.daysPast < 0) return 'Diese Aufgabe ist noch nicht verfügbar.';
  if (state.due && state.daysPast > 1) return 'Die Frist für diese Aufgabe ist abgelaufen.';
  if (state.unavailable && state.nextAvailableDate) return `Wieder verfügbar ab ${new Date(state.nextAvailableDate).toLocaleDateString('de-DE',{day:'numeric',month:'short'})}.`;
  if (task.remainingSlots != null && task.remainingSlots <= 0) return 'Alle verfügbaren Plätze sind belegt.';
  if (task.status === 'completed') return 'Diese Aufgabe wurde abgeschlossen.';
  if (state.closed) return 'Diese Aufgabe ist nicht mehr aktiv.';
  return null;
}

function ItemLabel({item}:{item:TvShoppingListItem}) {
  if (!item.completedByMemberId) return <Circle size={25} aria-hidden="true"/>;
  return <CheckCircle2 size={25} aria-hidden="true"/>;
}

export function TvShoppingListDialog({task,memberId,legacy,onClose,onSuccess}:TvShoppingListDialogProps) {
  const tasksQuery = useTasks(memberId,legacy);
  const itemsQuery = useShoppingListItems(task.id,memberId,legacy);
  const toggle = useToggleShoppingListItem(memberId,legacy);
  const liveTask = tasksQuery.data?.find(candidate=>candidate.id===task.id);
  const taskMissing = !!tasksQuery.data && !liveTask;
  const taskStateUnavailable = !tasksQuery.data || tasksQuery.isFetching || tasksQuery.isError;
  const currentTask = liveTask || task;
  const items = itemsQuery.data || [];
  const completedCount = items.filter(item=>!!item.completedByMemberId).length;
  const allCompleted = items.length > 0 && completedCount === items.length;
  const canToggle = !!liveTask && !taskStateUnavailable && canToggleShoppingList(currentTask,memberId);
  const lockMessage = taskMissing
    ? 'Diese Aufgabe wurde entfernt oder ist nicht mehr verfügbar. Die Liste kann nur noch angesehen werden.'
    : taskStateUnavailable
      ? tasksQuery.isError ? 'Der Aufgabenstatus konnte nicht geprüft werden. Bitte erneut laden, bevor du etwas änderst.' : 'Der Aufgabenstatus wird geprüft …'
      : toggleLockMessage(currentTask,memberId);

  const toggleItem = (item:TvShoppingListItem) => {
    if (!canToggle || toggle.isPending) return;
    toggle.mutate({taskId:task.id,itemId:item.id}, {
      onSuccess:(result)=>{
        if (!result.allCompleted) return;
        const title = currentTask.requiresApproval ? 'Liste eingereicht' : 'Liste erledigt';
        const message = currentTask.requiresApproval
          ? 'Alle Produkte sind abgehakt. Die Liste wartet jetzt auf die gemeinsame Freigabe.'
          : 'Alle Produkte sind abgehakt. Die Liste wurde abgeschlossen.';
        onSuccess(title,message);
      },
    });
  };

  return <section className="tv-shopping-dialog-content" aria-labelledby="tv-dialog-title">
    <header className="tv-shopping-dialog-header">
      <div className="tv-shopping-dialog-heading">
        <span className="tv-shopping-dialog-icon"><ShoppingBasket size={30}/></span>
        <div><p className="eyebrow">Einkaufsliste</p><h2 id="tv-dialog-title">{task.title}</h2></div>
      </div>
      <button type="button" className="button tv-shopping-close" aria-label="Einkaufsliste schließen" onClick={onClose} data-testid="button-close-shopping-list"><X size={22}/> Schließen</button>
    </header>

    {items.length > 0 && <div className="tv-shopping-progress" aria-live="polite" data-testid="shopping-list-progress">
      <span>{completedCount} von {items.length} Produkten erledigt</span>
      <span className="tv-shopping-progress-track" aria-hidden="true"><span style={{width:`${Math.round(completedCount / items.length * 100)}%`}}/></span>
    </div>}

    {itemsQuery.isLoading && <div className="tv-shopping-state" role="status" data-testid="shopping-list-loading"><RefreshCw size={25}/> Einkaufsliste wird geladen …</div>}

    {itemsQuery.isError && <div className="tv-shopping-error" role="alert" data-testid="shopping-list-error">
      <AlertCircle size={25}/><p>{errorText(itemsQuery.error)}</p>
      <button type="button" className="button" onClick={()=>void itemsQuery.refetch()} disabled={itemsQuery.isFetching} data-testid="button-retry-shopping-list">
        <RefreshCw size={18}/> {itemsQuery.isFetching?'Wird erneut geladen …':'Erneut versuchen'}
      </button>
    </div>}

    {!itemsQuery.isLoading && !itemsQuery.isError && items.length === 0 && <div className="tv-shopping-empty" data-testid="shopping-list-empty">
      <ShoppingBasket size={38}/><strong>Diese Liste ist noch leer</strong><span>Es wurden noch keine Produkte hinzugefügt.</span>
    </div>}

    {items.length > 0 && <div className="tv-shopping-items" aria-label="Produkte auf der Einkaufsliste">
      {items.map(item=>{
        const checked = !!item.completedByMemberId;
        const disabled = !canToggle || toggle.isPending;
        return <button type="button" key={item.id}
          className={`tv-shopping-item ${checked?'is-checked':''} ${disabled?'is-readonly':''}`}
          aria-pressed={checked}
          aria-disabled={disabled}
          aria-label={`${checked?'Als offen markieren':'Als erledigt markieren'}: ${item.text}${checked && item.completedByMemberName?`, erledigt von ${item.completedByMemberName}`:''}`}
          onClick={()=>toggleItem(item)}
          data-testid={`button-shopping-item-${item.id}`}>
          <span className="tv-shopping-item-check"><ItemLabel item={item}/></span>
          <span className="tv-shopping-item-copy"><strong>{item.text}</strong>{checked && item.completedByMemberName && <small>Erledigt von {item.completedByMemberName}</small>}</span>
          {checked && <span className="tv-shopping-item-done">Erledigt</span>}
          {toggle.isPending && <span className="tv-shopping-item-busy" aria-label="Wird gespeichert"><RefreshCw size={19}/></span>}
        </button>;
      })}
    </div>}

    {toggle.isPending && <p className="tv-shopping-feedback" role="status" data-testid="shopping-list-saving"><RefreshCw size={18}/> Änderung wird gespeichert …</p>}
    {toggle.isError && <div className="tv-shopping-error tv-shopping-toggle-error" role="alert" data-testid="shopping-list-toggle-error">
      <AlertCircle size={22}/><p>{errorText(toggle.error)}</p>
      <button type="button" className="button" onClick={()=>{toggle.reset();void itemsQuery.refetch();}} data-testid="button-retry-shopping-toggle">Listenstatus erneut laden</button>
    </div>}

    {lockMessage && <p className="tv-shopping-lock" role="note" data-testid="shopping-list-lock"><LockKeyhole size={19}/>{lockMessage}</p>}
    {tasksQuery.isError && !taskMissing && <button type="button" className="button tv-shopping-task-retry" onClick={()=>void tasksQuery.refetch()} disabled={tasksQuery.isFetching} data-testid="button-retry-shopping-task-state"><RefreshCw size={18}/> Aufgabenstatus erneut laden</button>}
    {!lockMessage && allCompleted && <p className="tv-shopping-complete" role="status" data-testid="shopping-list-complete">
      {currentTask.requiresApproval ? <><Clock3 size={20}/> Alle Produkte sind abgehakt. Die Liste wartet auf Freigabe. Du kannst Produkte vor der Freigabe wieder öffnen.</> : <><Check size={20}/> Alle Produkte sind abgehakt.</>}
    </p>}
  </section>;
}