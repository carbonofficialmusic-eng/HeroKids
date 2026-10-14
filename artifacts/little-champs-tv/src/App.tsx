import { useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CalendarDays, Camera, Check, ChevronRight, CircleHelp, Crown, Gamepad2, LockKeyhole, LogOut, RefreshCw, ShieldCheck, Sparkles, Star, Trophy, Users, X } from 'lucide-react';
import { isLegacySkin, LEGACY_SKIN_ORDER, STARS_PER_LEGACY_AVATAR, TOTAL_HIDDEN_STARS } from '../../../lib/legacy-shared/src/skin-config';
import { useRemote } from './hooks/use-remote';
import { apiOrigin, isPrivateTvAvatar, loadPrivateTvAvatar, memberAvatarUrl, skinAssetUrl, clearPendingPair, getPendingPair, useAppointments, useCompleteTask, useDiscoverSkin, useEquipSkin, usePairPoll, useSelectMember, useSession, useSkins, useStartPair, useTaskCategoryNames, useTasks, useUnpair, type PairRequest, type TvMember, type TvTask, type TvSkin } from './hooks/use-tv-data';
import { TvTaskBoard } from './components/tv-task-board';
import { TvRewards } from './components/tv-rewards';
import { TvSkinCardArt } from './components/tv-skin-card-art';
import { TvShoppingListDialog } from './components/tv-shopping-list-dialog';
import { taskCompletionFeedback, taskConfirmationText } from './lib/tv-task-feedback';
import { leaveTvToHome } from './lib/tv-platform-back';
import { useTvLanguage, tvText, tvTextValue, tvSkinName } from './lib/tv-language';

type Page = 'pair' | 'member' | 'tasks' | 'skins' | 'approvals' | 'rewards' | 'shop' | 'chest';
type Dialog = {kind:'pin';member:TvMember} | {kind:'task';task:TvTask} | {kind:'shopping';task:TvTask} | {kind:'photo';task:TvTask} | {kind:'appointment';task:TvTask} | {kind:'logout'} | {kind:'success';title:string;message?:string} | null;
const queryClient = new QueryClient({defaultOptions:{queries:{retry:1,refetchOnWindowFocus:true,gcTime:60000}}});

function LoadingTiles() { return <div className="task-grid" aria-label="Lädt"><div className="skeleton"/><div className="skeleton"/><div className="skeleton"/><div className="skeleton"/></div>; }
function Empty({title,detail,action,onAction}:{title:string;detail:string;action?:string;onAction?:()=>void}) {
  return <div className="empty"><CircleHelp size={42}/><h2>{title}</h2><p>{detail}</p>{action && onAction && <button className="button" onClick={onAction} data-testid="button-empty-action">{action}</button>}</div>;
}
function Avatar({member}:{member:TvMember}) {
  const privatePath = member.useCustomAvatar && isPrivateTvAvatar(member.avatarUrl) ? member.avatarUrl : null;
  const [privateImage,setPrivateImage] = useState<string>();
  const [failedImage,setFailedImage] = useState<string>();
  useEffect(()=>{
    setPrivateImage(undefined);
    if (!privatePath) return;
    let cancelled = false;
    let imageUrl: string | undefined;
    void loadPrivateTvAvatar(privatePath).then(url=>{
      imageUrl = url;
      if (cancelled) URL.revokeObjectURL(url);
      else setPrivateImage(url);
    }).catch(error=>{if (!cancelled) console.warn('TV profile picture could not be loaded:',error);});
    return ()=>{cancelled=true;if(imageUrl) URL.revokeObjectURL(imageUrl);};
  },[privatePath]);
  const image = privateImage || memberAvatarUrl(member);
  return <span className="avatar" style={{backgroundColor:member.color || undefined}}>{image && failedImage!==image ? <img src={image} alt="" onError={()=>setFailedImage(image)}/> : member.displayName.trim().slice(0,1).toLocaleUpperCase()}</span>;
}

function TvApp() {
  const language = useTvLanguage();
  const qc = useQueryClient();
  const session = useSession();
  const member = session.data?.authenticated ? session.data.member || session.data.members.find(m=>m.id===session.data?.selectedMemberId) : undefined;
  const legacy = !!session.data?.legacy;
  const [page,setPage] = useState<Page>('pair');
  const [dialog,setDialog] = useState<Dialog>(null);
  const [pin,setPin] = useState('');
  const [pairRequest,setPairRequest] = useState<PairRequest | null>(getPendingPair);
  const [notice,setNotice] = useState('');
  const [taskFeedback,setTaskFeedback] = useState<{title:string;message:string}|null>(null);
  const [skinAction,setSkinAction] = useState<string|null>(null);
  const [rewardDialog,setRewardDialog] = useState(false);
  const [clock,setClock] = useState(Date.now());
  const choosingMember = useRef(false);
  const skinFocusAfterUpdate = useRef<{id:string;state:'active'|'discovered'} | null>(null);
  const startPair = useStartPair(), poll = usePairPoll(pairRequest), selectMember = useSelectMember(), unpair = useUnpair();
  const tasks = useTasks(page==='tasks' ? member?.id : undefined,legacy), complete = useCompleteTask(member?.id,legacy);
  const appointments = useAppointments(page==='tasks' ? member?.id : undefined,legacy);
  const taskCategories = useTaskCategoryNames(page==='tasks' ? member?.id : undefined,legacy);
  const skins = useSkins(page==='skins' ? member?.id : undefined,legacy), discover = useDiscoverSkin(member?.id,legacy), equip = useEquipSkin(member?.id,legacy);
  const expired = !!pairRequest && (poll.data?.status === 'expired' || clock >= new Date(pairRequest.expiresAt).getTime());

  // Only the pairing code needs a deadline. Do not rerender every dashboard
  // and every image card once a second while the TV is idle.
  useEffect(()=>{
    if (!pairRequest) return;
    setClock(Date.now());
    const delay = new Date(pairRequest.expiresAt).getTime() - Date.now();
    if (!Number.isFinite(delay) || delay <= 0) return;
    const timer=window.setTimeout(()=>setClock(Date.now()),delay);
    return ()=>window.clearTimeout(timer);
  },[pairRequest?.expiresAt]);
  useEffect(()=>{
    const frame=requestAnimationFrame(()=>window.scrollTo(0,0));
    setTaskFeedback(null);
    return ()=>cancelAnimationFrame(frame);
  },[page,member?.id]);
  useEffect(()=>{
    if (session.data?.authenticated) setPage(current=> !pairRequest && (current==='pair' || (!session.data?.member && !['pair','member'].includes(current))) ? 'member' : current);
    else if (session.data && !session.data.authenticated && !pairRequest) {setPage('pair');setDialog(null);}
  },[session.data?.authenticated,session.data?.selectedMemberId,pairRequest]);
  useEffect(()=>{
    if (poll.data?.status==='approved') {setPairRequest(null);setNotice('');setPage('member');}
  },[poll.data?.status]);
  useEffect(()=>{
    const check=()=>{void qc.invalidateQueries({queryKey:['tv-session']});};
    window.addEventListener('tv-auth-check',check);
    return ()=>window.removeEventListener('tv-auth-check',check);
  },[qc]);
  const back=()=>{
    if (dialog) {setDialog(null);setPin('');setNotice('');return;}
    if (rewardDialog) {window.dispatchEvent(new Event('tv-reward-back'));return;}
    if (skinAction) {setSkinAction(null);return;}
    if (page==='skins'||page==='approvals'||page==='rewards'||page==='shop'||page==='chest') setPage('tasks');
    else if (page==='tasks') setPage('member');
    else if (page==='pair' && legacy) setPage('member');
    else if (apiOrigin) leaveTvToHome();
  };
   useRemote(
     `${session.isLoading?'loading':page}:${member?.id||''}`,
     !!dialog||rewardDialog,
     back,
      dialog?.kind==='pin' && dialog.member.usesDefaultPin ? '[data-testid="button-submit-pin"]' : dialog?.kind==='task' ? '[data-testid="button-confirm-task"]' : rewardDialog ? '[data-reward-redeem-confirm]' : undefined,
     page==='skins' && skinAction ? `[data-testid="card-skin-${skinAction}"] button:not(:disabled)` : undefined,
   );
   useEffect(()=>{
     if (dialog?.kind!=='success') return;
     const frame=requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('[data-testid="button-close-success"]')?.focus());
     return ()=>cancelAnimationFrame(frame);
   },[dialog?.kind]);
  useEffect(()=>{
    if (page!=='skins' || !skinAction || dialog) return;
    const frame=requestAnimationFrame(()=>document.querySelector<HTMLElement>(`[data-testid="card-skin-${skinAction}"] button`)?.focus());
    return ()=>cancelAnimationFrame(frame);
  },[page,skinAction,dialog]);
  useEffect(()=>{
    const focus = skinFocusAfterUpdate.current;
    if (page!=='skins' || dialog || !focus || skins.isFetching || equip.isPending || discover.isPending ||
        !skins.data?.skins.some(s=>s.id===focus.id && (focus.state==='active' ? s.isActive : s.isDiscovered))) return;
    const frame=requestAnimationFrame(()=>{
      const target=document.querySelector<HTMLElement>(`[data-testid="card-skin-${focus.id}"] button:not(:disabled)`);
      if (target) {target.focus();skinFocusAfterUpdate.current=null;}
    });
    return ()=>cancelAnimationFrame(frame);
  },[page,dialog,skins.data,skins.isFetching,equip.isPending,discover.isPending]);
  const beginPair=async()=>{
    setNotice('');setPairRequest(null);clearPendingPair();
    try {const result=await startPair.mutateAsync();setPairRequest(result);setClock(Date.now());setPage('pair');}
    catch(e) {setNotice(e instanceof Error?e.message:'Verbindungscode konnte nicht erstellt werden.');}
  };
  const choose=async(target:TvMember,enteredPin?:string)=>{
    if (choosingMember.current) return;
    if (target.role==='parent' && !enteredPin) {setPin(target.usesDefaultPin?'0000':'');setNotice('');setDialog({kind:'pin',member:target});return;}
    if (target.role==='parent' && enteredPin?.length !== 4) return;
    choosingMember.current = true;
    setNotice('');
    try {await selectMember.mutateAsync({memberId:target.id,...(enteredPin?{pin:enteredPin}:{})});setPin('');setDialog(null);setPage('tasks');setSkinAction(null);setRewardDialog(false);}
    catch(e) {setPin('');setNotice(e instanceof Error?e.message:'Profil konnte nicht geöffnet werden. Bitte erneut versuchen.');}
    finally {choosingMember.current = false;}
  };
  const submitTask=async(task:TvTask)=>{
    if(task.requiresProof){setDialog({kind:'photo',task});return;}
    try {
      const result=await complete.mutateAsync(task.id);
      setTaskFeedback(taskCompletionFeedback(task,result));
      setDialog(null);
    }
    catch(e){setNotice(e instanceof Error?e.message:'Aufgabe konnte nicht eingereicht werden.');setDialog(null);}
  };
  const logout=async()=>{
    try {await unpair.mutateAsync();setPage('pair');setDialog(null);setPairRequest(null);setNotice('');}
    catch(e){setNotice(e instanceof Error?e.message:'Abmelden fehlgeschlagen. Bitte erneut versuchen.');setDialog(null);}
  };

  const starCount=skins.data?.starStats?.starsFound ?? 0;
  const orderedSkins=[...(skins.data?.skins ?? [])].sort((a,b)=>(a.position??999)-(b.position??999));
  const legacySkins=LEGACY_SKIN_ORDER.map(id=>orderedSkins.find(s=>s.id===id)).filter((skin):skin is TvSkin=>!!skin);
  const regularSkins=orderedSkins.filter(s=>!isLegacySkin(s.id));
  const renderSkinCard=(skin:TvSkin)=>{
    const open=skinAction===skin.id;
    const legacyIndex=LEGACY_SKIN_ORDER.indexOf(skin.id);
    const starsNeeded=(legacyIndex+1)*STARS_PER_LEGACY_AVATAR;
    return <article className={`skin ${!skin.isDiscovered?'locked':''} ${skin.isActive?'active-skin':''} ${open?'selected-skin':''} ${legacyIndex>=0?'legacy-skin':''}`} key={skin.id} data-testid={`card-skin-${skin.id}`}>
      <div className="skin-art">{skin.isDiscovered?<TvSkinCardArt skinId={skin.id} name={tvSkinName(skin.id,skin.name)} discovered={skin.isDiscovered}/>:<LockKeyhole size={48}/>}
        {legacyIndex>=0 && <span className="skin-legacy-mark" aria-label="Little Champs Legacy"><Crown size={18}/></span>}
        {legacyIndex<0 && skin.isDiscovered && skins.data?.starPlacements?.[skin.id] && <span className="skin-found-star" aria-label="Stern gefunden"><Star size={19} fill="currentColor"/></span>}
      </div>
      <div className="skin-copy"><strong>{skin.isDiscovered?tvSkinName(skin.id,skin.name):'Geheimer Skin'}</strong>
        <small>{skin.isActive?'Ausgewählt':skin.isOverLimit?'Familienlimit':skin.isDiscovered?'Entdeckt':legacyIndex>=0?`${Math.min(starCount,starsNeeded)} / ${starsNeeded} Sterne`:skin.canDiscover?'Bereit zum Entdecken':'Sammle weiter Punkte'}</small>
        {legacyIndex>=0 && !skin.isDiscovered && <div className="skin-star-progress" role="progressbar" aria-label="Sterne für geheimen Legacy-Charakter" aria-valuenow={Math.min(starCount,starsNeeded)} aria-valuemin={0} aria-valuemax={starsNeeded}><span style={{width:`${Math.min(100,starCount/starsNeeded*100)}%`}}/></div>}
        {!open ? <button className="button" onClick={()=>setSkinAction(skin.id)} data-testid={`button-open-skin-${skin.id}`}>Karte ansehen <ChevronRight size={17}/></button> :
          skin.canDiscover && !skin.isDiscovered ? <button className="button primary" disabled={discover.isPending} onClick={async()=>{setNotice('');skinFocusAfterUpdate.current={id:skin.id,state:'discovered'};try{const result=await discover.mutateAsync(skin.id);if(result.starFound){skinFocusAfterUpdate.current=null;setDialog({kind:'success',title:'Du hast einen Stern gefunden'});}}catch(e){skinFocusAfterUpdate.current=null;setNotice(e instanceof Error?e.message:'Skin konnte nicht entdeckt werden.');}}} data-testid={`button-discover-skin-${skin.id}`}>{discover.isPending?'Wird entdeckt…':'Entdecken'} <Sparkles size={16}/></button> :
         skin.isDiscovered && !skin.isActive && !skin.isOverLimit ? <button className="button gold" disabled={equip.isPending} onClick={async()=>{setNotice('');skinFocusAfterUpdate.current={id:skin.id,state:'active'};try{await equip.mutateAsync(skin.id);}catch(e){skinFocusAfterUpdate.current=null;setNotice(e instanceof Error?e.message:'Skin konnte nicht ausgewählt werden.');}}} data-testid={`button-equip-skin-${skin.id}`}>{equip.isPending?'Wird gewählt…':'Auswählen'} <Check size={16}/></button> :
        <button className="button" onClick={()=>setSkinAction(null)} data-testid={`button-close-skin-${skin.id}`}>{skin.isActive?'Ausgewählt':skin.isOverLimit?'Familienlimit':'Gesperrt'} <X size={16}/></button>}
      </div>
    </article>;
  };

  const activeBackground = member?.activeSkinId ? skinAssetUrl(member.activeSkinId,'backgrounds') : undefined;
  return <div className={`tv dark ${activeBackground ? 'has-skin-background' : ''}`}>
    {activeBackground && page!=='pair' && <img className="tv-skin-background" src={activeBackground} alt="" aria-hidden="true"/>}
    <header className={`topbar ${member && !['pair','member'].includes(page) ? 'dashboard-topbar' : ''}`}>
      <div className="brand"><img src="./brand/littlechamps_logo.png" alt="Little Champs"/><div><strong>Little Champs</strong><small>Familien-TV</small></div></div>
      {session.data?.authenticated && <div className="top-actions">
        {member && page!=='member' && page!=='pair' && <><button className={`button ${page==='tasks'?'active':''}`} onClick={()=>setPage('tasks')} data-testid="button-nav-tasks">Aufgaben</button><button className={`button ${page==='skins'?'active':''}`} onClick={()=>{setPage('skins');setSkinAction(null);}} data-testid="button-nav-skins">Skins</button>{member.role==='parent'&&!legacy?<><button className={`button ${page==='approvals'?'active':''}`} onClick={()=>setPage('approvals')} data-testid="button-nav-approvals">Genehmigungen</button><button className={`button ${page==='rewards'?'active':''}`} onClick={()=>setPage('rewards')} data-testid="button-nav-rewards">Belohnungen</button></>:<><button className={`button ${page==='shop'?'active':''}`} onClick={()=>setPage('shop')} data-testid="button-nav-shop">Belohnungsshop</button><button className={`button ${page==='chest'?'active':''}`} onClick={()=>setPage('chest')} data-testid="button-nav-chest">Schatzkiste</button></>}</>}
        {page!=='member' && <button className="button" onClick={()=>{setPage('member');setSkinAction(null);setDialog(null);setNotice('');}} data-testid="button-switch-member"><Users size={20}/> Profil wechseln</button>}
        <button className="button icon-button" onClick={()=>setDialog({kind:'logout'})} data-testid="button-unpair" aria-label="TV abmelden"><LogOut size={22}/></button>
      </div>}
    </header>
    <main className={member && !['pair','member'].includes(page) ? 'dashboard-main' : undefined}>
      {member && !['pair','member'].includes(page) && <div className="dashboard-identity">
        {!['skins','shop','chest'].includes(page) && <img className="dashboard-logo" src="./brand/littlechamps_logo.png" alt="Little Champs"/>}
        <div className="dashboard-summary">
          <div className="dashboard-profile" data-testid="tv-dashboard-profile"><Avatar member={member}/><span><small>Dein Profil</small><strong>{member.displayName}</strong></span></div>
          <div className="dashboard-points" data-testid="tv-dashboard-points">
            <span className="dashboard-points-title"><Trophy size={20}/> Deine Punkte</span>
            <span className="dashboard-points-label">Insgesamt verdient</span>
            <strong data-testid="tv-total-earned">{typeof member.totalEarned==='number' ? member.totalEarned.toLocaleString('de-DE') : '–'}</strong>
            <span className="dashboard-points-available">Verfügbar <b data-testid="tv-available-points">{typeof member.totalPoints==='number' ? member.totalPoints.toLocaleString('de-DE') : '–'}</b></span>
          </div>
        </div>
      </div>}
      {session.isLoading ? <section className="hero"><div className="skeleton"/><div className="skeleton"/></section> :
      session.isError ? <Empty title="Keine Verbindung" detail={session.error instanceof Error?session.error.message:'Der Server ist gerade nicht erreichbar.'} action="Erneut versuchen" onAction={()=>session.refetch()}/> :
      page==='pair' || !session.data?.authenticated ? <section className="pair-layout">
        <div className="pair-intro"><span className="eyebrow">Little Champs auf dem Fernseher</span><h1>Die ganze Familie. Ein Bildschirm.</h1><p className="subhead">Verbinde diesen Fernseher mit eurer Familie. Die Person, die eure Familie erstellt hat, bestätigt die Anfrage auf ihrem bereits angemeldeten Handy.</p>
          <div className="steps"><div><b>01</b><span>Code auf dem TV anzeigen</span></div><div><b>02</b><span>Little Champs auf dem Handy öffnen: Einstellungen → TV-Freigabe</span></div><div><b>03</b><span>Code eingeben und TV freigeben</span></div></div>
          {legacy && <button className="button" onClick={()=>setPage('member')} data-testid="button-return-linked"><ArrowLeft size={19}/> Zurück zum Kinderprofil</button>}
        </div>
        <div className="pair-card">
          <div className="pair-card-top"><span className="pair-icon"><Gamepad2 size={31}/></span><span className="eyebrow">TV verbinden</span></div>
          {!pairRequest ? <><h2>Bereit für eure Familie?</h2><p>Starte die Verbindung, um einen einmaligen Code für die Freigabe zu erhalten.</p><button className="button primary wide" onClick={beginPair} disabled={startPair.isPending} data-testid="button-start-pair">{startPair.isPending?'Code wird erstellt…':'Verbindung starten'} <ArrowRight size={21}/></button></> :
          <><p className="code-label">Diesen Code auf dem Handy eingeben</p><div className="pair-code" data-testid="text-pair-code" aria-label={`TV-Code ${pairRequest.code}`}>{pairRequest.code.split('').map((char,i)=><span key={i}>{char}</span>)}</div>
          {expired ? <><div className="pair-status error">Dieser Code ist abgelaufen.</div><button className="button primary wide" onClick={beginPair} disabled={startPair.isPending} data-testid="button-retry-pair"><RefreshCw size={19}/> Neuen Code anzeigen</button></> :
          <><div className="pair-status" data-testid="status-pair">{poll.isError ? 'Verbindung unterbrochen. Wir versuchen es erneut.' : poll.isFetching ? 'Warte auf Freigabe am Handy…' : 'Bitte auf dem Handy freigeben.'}</div><div className="pair-foot"><span>Noch {Math.max(0,Math.ceil((new Date(pairRequest.expiresAt).getTime()-clock)/60000))} Min. gültig</span><button className="text-button" onClick={beginPair} disabled={startPair.isPending} data-testid="button-new-code">Neuer Code</button></div></>}
          </>}
          {notice && <p className="status-line" role="alert" data-testid="status-pair-error">{tvTextValue(notice)}</p>}
        </div>
      </section> :
       page==='member' ? <section className="member-selection">
         <img className="member-selection-logo" src="./brand/littlechamps_logo.png" alt="Little Champs"/>
        <div className="page-head"><div><p className="eyebrow">{session.data.familyName || 'Eure Familie'}</p><h1>Wer ist heute dran?</h1></div></div>
        <div className="member-grid">{session.data.members.map(target=><button key={target.id} className="member-card" onClick={()=>legacy ? setPage('tasks') : choose(target)} data-testid={`button-select-member-${target.id}`}><Avatar member={target}/><span className="member-info"><strong data-testid={`text-member-name-${target.id}`}>{target.displayName}</strong><small>{target.role==='parent'?'Elternprofil · PIN erforderlich':'Kinderprofil'}</small><span className="member-points"><Star size={17}/>{target.totalPoints ?? 0} Punkte</span></span><ChevronRight className="member-arrow" size={27}/></button>)}</div>
        {legacy && <div className="upgrade"><div><span className="eyebrow">Neuer Familienmodus</span><h2>Mehr als ein Profil auf dem TV.</h2><p>Dieses TV ist noch mit einem Kinderprofil verbunden. Richte Familien-TV ein, damit alle ihr eigenes Profil auswählen können. Bis zur Freigabe funktioniert die bisherige Verbindung weiter.</p></div><button className="button primary" onClick={()=>{setPage('pair');setNotice('');}} data-testid="button-upgrade-family-tv">Familien-TV einrichten <ArrowRight size={20}/></button></div>}
        {notice && <p className="status-line" role="alert">{tvTextValue(notice)}</p>}
      </section> :
       page==='tasks' && member ? <section>
         <div className="page-head"><div><p className="eyebrow">{member.role==='parent'?'Familienübersicht':'Deine Aufgaben'}</p><h1>{tvText('Los geht’s, {0}.',[member.displayName])}</h1></div></div>
        {notice && <p className="status-line" role="alert" data-testid="status-task-error">{tvTextValue(notice)}</p>}
        {taskFeedback && <p className="status-line" role="status" data-testid="status-task-success"><strong>{tvTextValue(taskFeedback.title)}</strong> {tvTextValue(taskFeedback.message)}</p>}
        {taskCategories.isError && <p className="status-line" role="alert">Die eigenen Kategorienamen konnten nicht geladen werden. Es werden Standardnamen angezeigt.</p>}
        {tasks.isLoading||appointments.isLoading ? <LoadingTiles/> : tasks.isError||appointments.isError ? <Empty title="Aufgaben und Termine konnten nicht geladen werden" detail={tasks.error instanceof Error?tasks.error.message:appointments.error instanceof Error?appointments.error.message:'Bitte Verbindung prüfen.'} action="Erneut versuchen" onAction={()=>{void tasks.refetch();void appointments.refetch();}}/> :
          <TvTaskBoard key={member.role} tasks={tasks.data||[]} appointments={appointments.data||[]} member={member} members={session.data.members} categoryNames={taskCategories.data?.categoryNames} onComplete={selected=>{setNotice('');setTaskFeedback(null);setDialog(selected.isShoppingList?{kind:'shopping',task:selected}:selected.requiresProof?{kind:'photo',task:selected}:{kind:'task',task:selected});}} onOpenAppointment={selected=>setDialog({kind:'appointment',task:selected})}/>}
      </section> :
      page==='skins' && member ? <section>
         <div className="page-head"><div><p className="eyebrow">Deine Sammlung</p><h1>Deine Skin-Galerie.</h1></div><div className="top-actions"><span className="pill amber"><Sparkles size={19}/>{skins.data?.availableCards ?? '–'} Karten bereit</span></div></div>
        {notice && <p role="alert" className="status-line" data-testid="status-skin-error">{tvTextValue(notice)}</p>}
        {skins.isLoading ? <LoadingTiles/> : skins.isError ? <Empty title="Galerie nicht erreichbar" detail={skins.error instanceof Error?skins.error.message:'Bitte Verbindung prüfen.'} action="Erneut versuchen" onAction={()=>skins.refetch()}/> : !skins.data?.skins.length ? <Empty title="Noch keine Karten" detail="Deine Skin-Karten erscheinen hier automatisch, sobald sie verfügbar sind."/> :
         <>{skins.data.tierLimitReached && <p className="pill amber limit">Das Skin-Limit eurer Familie ist erreicht. Frag deine Eltern nach weiteren Skins.</p>}<div className="skin-stage">
         <div className="skin-preview"><span className="eyebrow">Anprobe</span>{(()=>{
           const selected=skins.data.skins.find(s=>s.id===skinAction) || skins.data.skins.find(s=>s.isActive) || skins.data.skins.find(s=>s.isDiscovered);
           const legacyIndex=selected?LEGACY_SKIN_ORDER.indexOf(selected.id):-1;
           const starsNeeded=(legacyIndex+1)*STARS_PER_LEGACY_AVATAR;
           return <><div className="skin-preview-art">
             {selected?.isDiscovered && <><img className="preview-background" src={skinAssetUrl(selected.id,'backgrounds')} alt=""/><img className="preview-avatar" src={skinAssetUrl(selected.id,'avatars')} alt=""/></>}
             {!selected?.isDiscovered && <LockKeyhole size={66}/>}
           </div>
           <h2>{selected?.isDiscovered?tvSkinName(selected.id,selected.name):'Geheimer Skin'}</h2>
           <p>{selected?.isDiscovered?(language==='de' && selected.description ? selected.description : 'Dein Avatar und sein Hintergrund.'):legacyIndex>=0?`Bei ${starsNeeded} Sternen wird dieser Legacy-Charakter aufgedeckt. ${Math.min(starCount,starsNeeded)} von ${starsNeeded} Sternen gefunden.`:'Sammle Punkte und entdecke, was sich hinter dieser Karte verbirgt.'}</p>
           {selected?.isActive && <span className="pill amber"><Check size={17}/> Gerade ausgewählt</span>}</>;
         })()}</div>
          <div className="skin-collection">
            {legacySkins.length>0 && <section className="legacy-collection" aria-labelledby="legacy-heading">
              <div className="skin-collection-heading"><Crown size={27}/><div><h2 id="legacy-heading">Little Champs Legacy</h2><p>Finde Sterne beim Aufdecken regulärer Skins. Je 4 Sterne decken einen Legacy-Charakter auf.</p></div><span className="pill amber"><Star size={18}/>{starCount}/{skins.data.starStats?.totalStars ?? TOTAL_HIDDEN_STARS} Sterne</span></div>
              <div className="skin-grid legacy-skin-grid">{legacySkins.map(renderSkinCard)}</div>
            </section>}
            <section className="regular-collection" aria-label="Weitere Skin-Karten"><div className="skin-grid">{regularSkins.map(renderSkinCard)}</div></section>
          </div></div></>}
        </section> : member && ((member.role==='parent' && (page==='approvals'||page==='rewards')) || (member.role==='child' && (page==='shop'||page==='chest'))) ? <TvRewards key={member.id} view={page as 'approvals'|'rewards'|'shop'|'chest'} member={member} legacy={legacy} onDialogChange={setRewardDialog}/> : <LoadingTiles/>}
    </main>
    <footer className="hint"><kbd>← ↑ ↓ →</kbd> Bewegen <kbd>OK</kbd> Auswählen <kbd>Zurück</kbd> Zurück</footer>
    {dialog && <div className="overlay"><div className="dialog" role="dialog" aria-modal="true" aria-labelledby="tv-dialog-title">
      {dialog.kind==='pin' ? <><span className="pill amber"><LockKeyhole size={18}/> Geschütztes Elternprofil</span><h2 id="tv-dialog-title">PIN für {dialog.member.displayName}</h2><p>{dialog.member.usesDefaultPin?'Noch keine eigene PIN festgelegt. Die Standard-PIN 0000 ist bereits eingetragen. Wähle „Profil öffnen“.':'Gib die PIN mit der Fernbedienung ein. Sie wird auf dem Bildschirm nicht angezeigt.'}</p><input className="pin-input" type="password" inputMode="numeric" autoComplete="off" value={pin} maxLength={4} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,4))} aria-label="Eltern-PIN" data-testid="input-parent-pin"/><div className="pin-pad">{'123456789'.split('').map(n=><button key={n} className="button" onClick={()=>setPin(v=>(v+n).slice(0,4))} data-testid={`button-pin-${n}`}>{n}</button>)}<button className="button" onClick={()=>setPin(v=>v.slice(0,-1))} data-testid="button-pin-delete"><ArrowLeft size={20}/></button><button className="button" onClick={()=>setPin(v=>(v+'0').slice(0,4))} data-testid="button-pin-0">0</button><button className="button" onClick={()=>setPin('')} data-testid="button-pin-clear">C</button></div>{notice && <p className="status-line" role="alert" data-testid="status-pin-error">{notice}</p>}<div className="dialog-actions"><button className="button" onClick={()=>{setPin('');setDialog(null);setNotice('');}} data-testid="button-cancel-pin">Abbrechen</button><button className="button primary" disabled={pin.length!==4 || selectMember.isPending} onClick={()=>dialog.kind==='pin'&&choose(dialog.member,pin)} data-testid="button-submit-pin">{selectMember.isPending?'Prüfe PIN…':'Profil öffnen'} <ArrowRight size={19}/></button></div></> :
       dialog.kind==='task' ? <><span className="pill mint"><ShieldCheck size={18}/> Aufgabe bestätigen</span><h2 id="tv-dialog-title">„{dialog.task.title}“ erledigt?</h2><p>{taskConfirmationText(dialog.task)}</p><div className="dialog-actions"><button className="button" onClick={()=>setDialog(null)} data-testid="button-cancel-task">Noch nicht</button><button className="button primary" autoFocus disabled={complete.isPending} onClick={()=>submitTask(dialog.task)} data-testid="button-confirm-task">{complete.isPending?'Wird eingereicht…':'Ja, erledigt'} <Check size={20}/></button></div></> :
       dialog.kind==='shopping' ? member ? <TvShoppingListDialog key={`${member.id}:${dialog.task.id}`} task={tasks.data?.find(task=>task.id===dialog.task.id) || dialog.task} memberId={member.id} legacy={legacy} onClose={()=>setDialog(null)} onSuccess={(title,message)=>{setTaskFeedback({title,message});setDialog(null);}}/> : null :
      dialog.kind==='photo' ? <><span className="pill amber"><Camera size={18}/> Foto erforderlich</span><h2 id="tv-dialog-title">Diese Aufgabe braucht dein Handy.</h2><p>Öffne „{dialog.task.title}“ in der Little Champs Handy-App, mach ein Foto und reiche die Aufgabe dort ein.</p><div className="dialog-actions"><button className="button primary" onClick={()=>{setDialog(null);tasks.refetch();}} data-testid="button-photo-done">Verstanden <Check size={20}/></button></div></> :
      dialog.kind==='appointment' ? <><span className="pill cyan"><CalendarDays size={18}/> {dialog.task.isGoogleCalendarEvent?'Google Kalender':'Termin'}</span><h2 id="tv-dialog-title">{dialog.task.title}</h2><p>{new Date(`${String(dialog.task.dueDate).slice(0,10)}T12:00:00`).toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}{dialog.task.dueTime?` · ${dialog.task.dueTime.slice(0,5)} Uhr`:' · Ganztägig'}</p>{dialog.task.description && <p>{dialog.task.description}</p>}<div className="dialog-actions"><button className="button primary" onClick={()=>setDialog(null)} data-testid="button-close-appointment">Schließen <Check size={20}/></button></div></> :
      dialog.kind==='logout' ? <><span className="pill coral"><LogOut size={18}/> TV abmelden</span><h2 id="tv-dialog-title">Diesen Fernseher abmelden?</h2><p>Danach muss eure Familie den TV erneut per Handy freigeben.</p><div className="dialog-actions"><button className="button" onClick={()=>setDialog(null)} data-testid="button-cancel-unpair">Verbunden bleiben</button><button className="button primary" disabled={unpair.isPending} onClick={logout} data-testid="button-confirm-unpair">{unpair.isPending?'Wird abgemeldet…':'TV abmelden'}</button></div></> :
       <><span className="pill mint"><Gamepad2 size={18}/> Little Champs</span><h2 id="tv-dialog-title">{dialog.title}</h2>{dialog.message && <p>{dialog.message}</p>}<div className="dialog-actions"><button className="button primary" onClick={()=>setDialog(null)} data-testid="button-close-success">Weiter <ArrowRight size={19}/></button></div></>}
    </div></div>}
  </div>;
}

function App() { return <QueryClientProvider client={queryClient}><TvApp/></QueryClientProvider>; }
export default App;