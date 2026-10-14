import { useEffect, useState, type ReactNode } from 'react';
import { Check, Gift, Share2, Star, Users } from 'lucide-react';
import { assetUrl, loadPrivateTvTaskProof, type TvMember } from '../hooks/use-tv-data';
import { useRewardAction, useRewardData, type RewardAction, type TvRedemption, type TvPendingCompletion } from '../hooks/use-tv-rewards';
import { useTvLanguage, tvText, tvTextValue } from '../lib/tv-language';

type View='approvals'|'rewards'|'shop'|'chest';
type Modal={kind:'confirm';title:string;detail:string;action:RewardAction}|{kind:'proof';url:string;completion:TvPendingCompletion;memberName:string}|null;
function iconUrl(icon?:string|null) {return assetUrl(icon?.startsWith('/reward-icons/')?icon:'/reward-icons/gift.png');}
function Badge({children,tone='amber'}:{children:ReactNode;tone?:string}) {return <span className={`pill ${tone}`}>{children}</span>;}
function Load() {return <div className="reward-grid" aria-label="Lädt"><div className="skeleton"/><div className="skeleton"/></div>;}
function Fault({error,retry}:{error:unknown;retry:()=>void}) {return <div className="empty"><h2>Verbindung unterbrochen</h2><p>{error instanceof Error?error.message:'Bitte versuche es noch einmal.'}</p><button className="button" onClick={retry}>Erneut versuchen</button></div>;}
function rewardLabel(status:string) {return status==='completed'?'Erfüllt':status==='approved'?'Wartet auf Erfüllung':'Ausstehend';}
type ProofImage={url?:string;ready?:boolean;error?:string};
function TaskApprovalCard({completion,ask,viewProof}:{completion:TvPendingCompletion;ask:(title:string,detail:string,action:RewardAction)=>void;viewProof:(url:string,completion:TvPendingCompletion,memberName:string)=>void}) {
  // A collective approval may grant points for several members. Never infer
  // readiness from the representative completion's single proofPhotoUrl.
  const attachments=completion.proofAttachments?.length
    ? completion.proofAttachments
    : completion.proofPhotoUrl?[{completionId:completion.id,memberName:completion.memberName}]:[];
  const signature=JSON.stringify({task:completion.id,attachments,photo:completion.proofPhotoUrl});
  const [proofState,setProofState]=useState<{signature:string;images:Record<string,ProofImage>}>({signature:'',images:{}});
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    setProofState({signature,images:{}});
    let mounted=true;
    const objectUrls:string[]=[];
    attachments.forEach(attachment=>{
      const id=attachment.completionId;
      void loadPrivateTvTaskProof(id).then(url=>{
        if (!mounted) {URL.revokeObjectURL(url);return;}
        objectUrls.push(url);
        setProofState(previous=>previous.signature===signature
          ? {signature,images:{...previous.images,[id]:{url,ready:false}}}:previous);
      }).catch(error=>{
        if(mounted)setProofState(previous=>previous.signature===signature
          ? {signature,images:{...previous.images,[id]:{error:error instanceof Error?error.message:'Fotobeweis nicht verfügbar.'}}}:previous);
      });
    });
    return ()=>{mounted=false;objectUrls.forEach(url=>URL.revokeObjectURL(url));};
  },[signature,attempt]);
  const allReady=proofState.signature===signature && attachments.every(attachment=>proofState.images[attachment.completionId]?.ready===true);
  const markImage=(id:string,url:string,ready:boolean)=>{
    setProofState(previous=>{
      if(previous.signature!==signature || previous.images[id]?.url!==url) return previous;
      return {signature,images:{...previous.images,[id]:ready?{url,ready:true}:{error:'Bild konnte nicht angezeigt werden.'}}};
    });
  };
  return <article className="approval-card" data-testid={`card-task-approval-${completion.id}`}>
    <Badge tone="amber">Wartet auf Freigabe</Badge><h3>{completion.taskTitle}</h3><p>{completion.memberName} · {completion.dailyPointShares ? completion.pointsEarned : completion.taskPoints} Punkte</p>
    {completion.dailyPointShares?.map(share=><p key={share.memberId} data-testid={`daily-point-share-${share.memberId}`}>{share.memberName}: {share.executions}/{completion.dailyTarget} · {share.points} Punkte</p>)}
    {attachments.length>0&&<div className="proof-gallery" aria-label={`${attachments.length} Fotobeweise zur Prüfung`}>
      <p>Fotobeweise · {attachments.length} {attachments.length===1?'Mitglied':'Mitglieder'}</p>
      {attachments.map(attachment=>{
        const id=attachment.completionId;
        const image=proofState.signature===signature?proofState.images[id]:undefined;
        const name=attachment.memberName||'Familienmitglied';
        return <div className="proof-member" key={id} data-testid={`proof-member-${id}`}>
          <strong>{name}</strong>
          {image?.error?<div className="proof-error" role="alert"><p>{image.error} Bitte den Fotobeweis für {name} in der Handy-App prüfen. Genehmigen bleibt gesperrt.</p><button className="button" onClick={()=>setAttempt(n=>n+1)} data-testid={`button-retry-proof-${id}`}>Fotos erneut laden</button></div>:
          image?.url?<><img className="proof-preview" src={image.url} alt={`Fotobeweis von ${name} für ${completion.taskTitle}`} onLoad={()=>markImage(id,image.url!,true)} onError={()=>markImage(id,image.url!,false)}/><button className="button proof-open" disabled={!image.ready} onClick={()=>viewProof(image.url!,completion,name)} data-testid={`button-view-proof-${id}`}>Foto von {name} groß ansehen</button></>:
          <div className="proof-loading skeleton" aria-label={`Fotobeweis von ${name} wird geladen`}/>}
        </div>;
      })}
    </div>}
    <div className="reward-actions"><button className="button gold" disabled={!allReady} onClick={()=>ask('Aufgabe genehmigen?',completion.dailyPointShares ? completion.dailyPointShares.map(share=>`${share.memberName}: ${share.points} Punkte`).join(' · ') : `${completion.memberName} erhält die Punkte für „${completion.taskTitle}“.`,{kind:'approve-task',id:completion.id})} data-testid={`button-approve-task-${completion.id}`}>Genehmigen</button><button className="button" onClick={()=>ask('Aufgabe ablehnen?',`„${completion.taskTitle}“ von ${completion.memberName} ablehnen?`,{kind:'reject-task',id:completion.id})} data-testid={`button-reject-task-${completion.id}`}>Ablehnen</button></div>
  </article>;
}

export function TvRewards({view,member,legacy,onDialogChange}:{view:View;member:TvMember;legacy:boolean;onDialogChange:(open:boolean)=>void}) {
  useTvLanguage();
  const data=useRewardData(member.id,member.role,legacy);
  const action=useRewardAction(member.id,legacy);
  const [modal,setModal]=useState<Modal>(null);
  const [error,setError]=useState('');
  const [proofViewed,setProofViewed]=useState(false);
  const parent=member.role==='parent'&&!legacy;
  const shareEnabled=!legacy && data.family.data?.canUseSharedRewards===true;
  const open=(next:Modal)=>{setError('');setModal(next);onDialogChange(!!next);};
  useEffect(()=>()=>onDialogChange(false),[onDialogChange]);
  useEffect(()=>{const close=()=>open(null);window.addEventListener('tv-reward-back',close);return ()=>window.removeEventListener('tv-reward-back',close);},[]);
  const ask=(title:string,detail:string,command:RewardAction)=>open({kind:'confirm',title,detail,action:command});
  const run=async(command:RewardAction)=>{
    setError('');
    try {await action.mutateAsync(command);open(null);}
    catch(e) {setError(e instanceof Error?e.message:'Aktion fehlgeschlagen. Bitte erneut versuchen.');}
  };
  const refresh=()=>{void Promise.all([data.rewards.refetch(),data.redemptions.refetch(),data.shared.refetch(),data.requests.refetch(),...(parent?[data.pending.refetch()]:[])]);};
  const rewardCards=(data.rewards.data||[]).filter(r=>parent||r.isActive).map(r=>{
    const balance=member.totalPoints??0;
    const ready=balance>=r.pointThreshold;
    const remaining=Math.max(0,r.pointThreshold-balance);
    const progress=Math.min(100,Math.round(balance/Math.max(1,r.pointThreshold)*100));
    return <article className="reward-card" data-reward-visual-state={ready?'ready':'locked'} key={r.id} data-testid={`card-reward-${r.id}`}>
      <div className="reward-card-top"><span className="reward-icon"><img src={iconUrl(r.iconEmoji)} alt=""/></span><div className="reward-copy"><h3>{r.title}</h3><p>{r.description}</p><Badge tone={ready?'cyan':'muted'}>{r.pointThreshold.toLocaleString('de-DE')} Punkte</Badge>{parent&&!r.isActive&&<Badge tone="muted">Inaktiv</Badge>}</div></div>
      {!parent&&<><div className="reward-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${progress}%`}}/></div><p>{ready?'Du kannst diese Belohnung jetzt einlösen.':`Noch ${remaining.toLocaleString('de-DE')} Punkte bis zur Belohnung.`}</p></>}
       <div className="reward-actions">{parent?<button className="button gold" disabled={!ready||!r.isActive||action.isPending} onClick={()=>ask('Belohnung kaufen?',`${r.pointThreshold} Punkte werden von deinem Guthaben abgezogen.`,{kind:'redeem',id:r.id})} data-testid={`button-buy-reward-${r.id}`}>{ready?'Kaufen':`${remaining} Punkte fehlen`}</button>:
      <button className="button primary" disabled={!ready||action.isPending} onClick={()=>ask('Belohnung einlösen?',`${r.pointThreshold} Punkte werden von deinem Guthaben abgezogen. „${r.title}“ landet in deiner Schatzkiste.`,{kind:'redeem',id:r.id})} data-testid={`button-redeem-reward-${r.id}`}>{ready?'Jetzt einlösen':`${remaining} Punkte fehlen`}</button>}</div>
    </article>;
  });
  const all=data.redemptions.data||[];
  const joined=all.filter(r=>r.memberId!==member.id&&r.sharingParticipants?.some(p=>p.memberId===member.id));
  const joinedIds=new Set(joined.map(r=>r.id));
  const own=parent?all.filter(r=>!joinedIds.has(r.id)):all.filter(r=>r.memberId===member.id);
  const shared=data.shared.data||[];
  const joinable=shared.filter(r=>r.memberId!==member.id&&!r.participants?.some(p=>p.memberId===member.id));
  const redemptionCard=(r:TvRedemption,mode:'own'|'joined'|'joinable')=>{
    const participants=r.participants||r.sharingParticipants||[];
    const isOwner=r.memberId===member.id;
    const canManage=parent||isOwner;
    const label=r.rewardTitle||r.reward?.title||'Belohnung';
    return <article className="reward-card treasure-card" key={`${mode}-${r.id}`} data-testid={`card-redemption-${r.id}`}>
      <div className="reward-card-top"><span className="reward-icon"><img src={iconUrl(r.rewardIconEmoji||r.reward?.iconEmoji)} alt=""/></span><div className="reward-copy"><h3>{label}</h3><div className="reward-meta"><Badge>{rewardLabel(r.status)}</Badge>{r.sharingStatus==='sharing_active'&&<Badge tone="cyan">Wird geteilt</Badge>}{r.sharingStatus==='sharing_finalized'&&<Badge tone="mint">Geteilt</Badge>}</div>
      <p>{mode==='joinable'?`Geteilt von ${r.member?.displayName||'einem Familienmitglied'}`:parent?`Von ${r.member?.displayName||'Familienmitglied'} eingelöst`:mode==='joined'?'Gemeinsam eingelöst':'In deiner Schatzkiste'}{mode==='joinable'?' · Punkte erst beim Abschluss fällig':mode==='joined'&&r.sharingStatus==='sharing_active'?' · Noch keine Punkte abgezogen':mode==='joined'&&r.sharingStatus==='sharing_finalized'?` · Dein Beitrag: ${participants.find(p=>p.memberId===member.id)?.pointsContributed??0} Punkte`:` · ${r.pointsSpent} Punkte`}</p>
      {participants.length>0&&<p><Users size={15}/> Dabei: {participants.map(p=>p.member?.displayName||p.displayName).filter(Boolean).join(', ')}</p>}</div></div>
      <div className="reward-actions">
      {mode==='joinable'&&shareEnabled&&<button className="button gold" onClick={()=>ask('Beim Teilen mitmachen?',`Du machst bei „${label}“ mit. Jetzt werden keine Punkte abgezogen; dein Anteil wird erst beim Abschluss der Teilung fällig.`,{kind:'join',id:r.id})} data-testid={`button-join-${r.id}`}>Mitmachen</button>}
      {mode==='joined'&&r.sharingStatus==='sharing_active'&&<button className="button" onClick={()=>ask('Teilung verlassen?',`Du verlässt „${label}“. Vor dem Abschluss wurden dir dafür noch keine Punkte abgezogen.`,{kind:'leave-sharing',id:r.id})} data-testid={`button-leave-${r.id}`}>Teilung verlassen</button>}
      {isOwner&&r.status!=='completed'&&r.sharingStatus==='not_shared'&&shareEnabled&&<button className="button" onClick={()=>ask('Belohnung teilen?',`Familienmitglieder können sich an „${label}“ beteiligen.`,{kind:'share',id:r.id})} data-testid={`button-share-${r.id}`}><Share2 size={17}/> Teilen</button>}
      {isOwner&&r.sharingStatus==='sharing_active'&&participants.length>0&&<button className="button gold" onClick={()=>ask('Teilen beenden und abrechnen?',`Erst jetzt werden die endgültigen Anteile für „${label}“ berechnet. Die teilnehmenden Mitglieder zahlen ihren Anteil; du erhältst den entsprechenden Betrag zurück.`,{kind:'finalize',id:r.id})} data-testid={`button-finalize-${r.id}`}>Teilen beenden & abrechnen</button>}
      {isOwner&&r.sharingStatus==='sharing_active'&&<button className="button" onClick={()=>ask('Teilung abbrechen?',`„${label}“ wird wieder deine persönliche Belohnung. Die anderen Mitglieder verlassen die Teilung, ohne dass ihnen Punkte abgezogen werden. Du behältst den ursprünglichen Kaufpreis.`,{kind:'cancel-sharing',id:r.id})} data-testid={`button-cancel-sharing-${r.id}`}>Teilung abbrechen</button>}
      {parent&&r.status!=='completed'&&r.sharingStatus!=='sharing_active'&&<button className="button gold" onClick={()=>ask('Belohnung erfüllt?',`„${label}“ wird als erfüllt markiert.`,{kind:'status',id:r.id,status:'completed'})} data-testid={`button-complete-redemption-${r.id}`}><Check size={17}/> Erfüllt</button>}
      {parent&&r.status==='pending'&&r.sharingStatus==='not_shared'&&<button className="button" onClick={()=>ask('Belohnung freigeben?',`„${label}“ als freigegeben markieren?`,{kind:'status',id:r.id,status:'approved'})} data-testid={`button-approve-redemption-${r.id}`}>Freigeben</button>}
      {canManage&&r.status!=='completed'&&r.sharingStatus==='not_shared'&&<button className="button" onClick={()=>ask('Einlösung stornieren?',`„${label}“ wird storniert. Punkte werden zurückerstattet.`,{kind:'cancel',id:r.id})} data-testid={`button-cancel-redemption-${r.id}`}>Stornieren</button>}
      </div>
    </article>;
  };
  const requests=(data.requests.data||[]).filter(r=>r.status==='pending');
  const myRequests=(data.requests.data||[]).filter(r=>r.requester?.id===member.id);
  const pending=data.pending.data||[];
  const showApprovals=view==='approvals';
  const childCollection=view==='shop'||view==='chest';
  const listQuery=showApprovals?[data.requests,data.pending]:view==='chest'?[data.redemptions,data.shared]:view==='shop'?[data.rewards,data.redemptions,data.shared,data.requests]:[data.rewards,data.redemptions,data.shared];
  return <section className="reward-page">
     {childCollection ? <div className={`reward-emblem reward-emblem-${view}`}><h1 className="reward-visually-hidden">{view==='chest'?'Schatzkiste':'Belohnungsshop'}</h1><img src={assetUrl(`/nav-icons/${view}.png`)} alt=""/></div> :
       <div className="page-head"><div className="reward-head"><img src={assetUrl(`/nav-icons/${showApprovals?'clipboard':'shop'}.png`)} alt=""/><div><p className="eyebrow">{showApprovals?'Für Eltern':'Für eure Familie'}</p><h1>{showApprovals?'Genehmigungen':'Belohnungen'}</h1></div></div></div>}
    {error&&!modal&&<p className="status-line reward-error" role="alert">{tvTextValue(error)}</p>}
    {data.family.isError&&<p className="status-line reward-error" role="alert">Freigabe für geteilte Belohnungen konnte nicht geprüft werden. <button className="button" onClick={()=>data.family.refetch()}>Erneut prüfen</button></p>}
    {listQuery.some(q=>q.isLoading)?<Load/>:listQuery.some(q=>q.isError)?<Fault error={listQuery.find(q=>q.isError)?.error} retry={refresh}/>:
     showApprovals?<><div className="reward-section"><h2>Aufgaben · {pending.length}</h2>{pending.length?<div className="reward-grid">{pending.map(c=><TaskApprovalCard key={c.id} completion={c} ask={ask} viewProof={(url,completion,memberName)=>{setProofViewed(false);open({kind:'proof',url,completion,memberName});}}/>)}</div>:<div className="empty"><Check size={35}/><h2>Alles geprüft</h2><p>Keine Aufgaben warten auf Genehmigung.</p></div>}</div><div className="reward-section"><h2>Belohnungswünsche · {requests.length}</h2>{requests.length?<div className="reward-grid">{requests.map(r=><article className="approval-card" key={r.id}><Badge>{r.pointThreshold} Punkte</Badge><h3>{r.title}</h3><p>{r.description}</p><p>Vorgeschlagen von {r.requester?.displayName||'einem Familienmitglied'}</p><div className="reward-actions"><button className="button gold" onClick={()=>ask('Wunsch genehmigen?',`„${r.title}“ wird als Belohnung in den Shop übernommen.`,{kind:'approve-request',id:r.id})} data-testid={`button-approve-request-${r.id}`}>Genehmigen</button><button className="button" onClick={()=>ask('Wunsch ablehnen?',`„${r.title}“ wird abgelehnt.`,{kind:'decline-request',id:r.id})} data-testid={`button-decline-request-${r.id}`}>Ablehnen</button></div></article>)}</div>:<div className="empty"><Star size={35}/><h2>Keine Wünsche offen</h2><p>Neue Belohnungsvorschläge erscheinen hier.</p></div>}</div></>:
      <>{(view==='chest'||view==='shop'||view==='rewards')&&shareEnabled&&joinable.length>0&&<div className="reward-section"><h2>Zum Mitmachen <Users size={22}/></h2><div className="reward-grid">{joinable.map(r=>redemptionCard(r,'joinable'))}</div></div>}
       {view!=='chest'&&<div className="reward-section"><h2 className={view==='shop'?'reward-visually-hidden':undefined}>{parent?'Belohnungen im Shop':'Verfügbare Belohnungen'}</h2>{rewardCards.length?<div className="reward-grid">{rewardCards}</div>:<div className="empty"><Gift size={35}/><h2>Noch keine Belohnungen</h2><p>Neue Belohnungen erstellt ihr in der Web- oder iOS-App.</p></div>}</div>}
      {view==='shop'&&<div className="reward-section"><h2 className="tv-scroll-stop" tabIndex={0}>Meine Wünsche</h2>{myRequests.length?<div className="reward-grid">{myRequests.map(r=><article className="approval-card tv-scroll-stop" tabIndex={0} key={r.id} data-testid={`card-my-request-${r.id}`}><Badge tone={r.status==='approved'?'mint':r.status==='declined'?'coral':'amber'}>{r.status==='approved'?'Genehmigt':r.status==='declined'?'Abgelehnt':'Wartet auf Genehmigung'}</Badge><h3>{r.title}</h3><p>{r.description}</p><p>{r.pointThreshold} Punkte</p></article>)}</div>:<div className="empty tv-scroll-stop" tabIndex={0}><Star size={35}/><h2>Deine Wunschliste ist leer</h2><p>Neue Wünsche kannst du in der Web- oder iOS-App vorschlagen.</p></div>}</div>}
      {view!=='shop'&&<div className="reward-section"><h2 className={view==='chest'?'reward-visually-hidden':undefined}>{parent?'Eingelöste Belohnungen':'Meine Belohnungen'}</h2>{own.length||joined.length?<div className="reward-grid">{[...own.map(r=>redemptionCard(r,'own')),...joined.map(r=>redemptionCard(r,'joined'))]}</div>:<div className="empty"><Gift size={35}/><h2>Noch nichts in der Schatzkiste</h2><p>Sammle Punkte und löse deine erste Belohnung ein.</p></div>}</div>}</>}
    {modal&&<div className="overlay"><div className="dialog dialog-scroll" role="dialog" aria-modal="true" aria-labelledby="tv-dialog-title">
       {modal.kind==='confirm'?<><Badge tone="amber"><Gift size={17}/> Bitte bestätigen</Badge><h2 id="tv-dialog-title">{modal.title}</h2><p>{modal.detail}</p>{error&&<p className="status-line" role="alert">{error}</p>}<div className="dialog-actions"><button className="button" onClick={()=>open(null)} data-testid="button-cancel-reward-action">Zurück</button><button className="button primary" disabled={action.isPending} onClick={()=>run(modal.action)} data-testid="button-confirm-reward-action" data-reward-redeem-confirm={modal.action.kind==='redeem'?'':undefined}>{action.isPending?'Bitte warten…':'Bestätigen'}</button></div></>:
       <><h2 id="tv-dialog-title">Fotobeweis · {modal.memberName}</h2><p>{modal.completion.taskTitle} · Prüfe alle Fotobeweise auf der Aufgabenkarte vor der Genehmigung.</p><img className="proof-large" src={modal.url} alt={`Fotobeweis von ${modal.memberName} für ${modal.completion.taskTitle}`} onLoad={()=>setProofViewed(true)} onError={()=>setProofViewed(false)}/>{!proofViewed&&<p className="status-line" role="alert">Das Foto konnte nicht angezeigt werden. Bitte auf dem Handy prüfen.</p>}<div className="dialog-actions"><button className="button" onClick={()=>open(null)} data-testid="button-close-proof">Zurück zu allen Fotos</button></div></>}
    </div></div>}
  </section>;
}