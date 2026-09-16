import { useState } from "react";
import { CalendarDays, Check, Circle, Info, Star, BookOpen, Brush, Sparkles, Utensils, Users } from "lucide-react";
import "./_group.css";

type Theme = "parentLight" | "parentDark" | "kidLight" | "kidDark";

const themes = {
  parentLight: { bg:"#eef5f7", ink:"#18324d", muted:"#718092", surface:"#ffffff", line:"#e0e8ee", shadow:"0 5px 15px rgba(32,55,82,.08)", today:"#ff5d00", todayEnd:"#ff8d20", todayInk:"#ffffff", todayLine:"#ff5d00", todaySurface:"#fffaf6", todayIconBg:"#fff0e6", todayShadow:"0 0 18px rgba(255,93,0,.26)", todayShadowColor:"rgba(255,93,0,.25)", dateBlue:"#2563eb", icon:"#53727a", iconBg:"#e8f0ef", points:"#a36f17", pointsBg:"#f8edcf", action:"#087c9a", actionBg:"#e5f8fb", actionLine:"#9bdce8", actionHover:"#d3f2f7", done:"#5a9a72", doneInk:"#fff" },
  parentDark: { bg:"#071326", ink:"#f7fbff", muted:"#aebcda", surface:"#101e38", line:"#344f73", shadow:"0 10px 25px rgba(0,0,0,.28)", today:"#ff647c", todayEnd:"#ff4f7b", todayInk:"#ffffff", todayLine:"#ff647c", todaySurface:"#10243e", todayIconBg:"#26344f", todayShadow:"0 0 18px rgba(255,100,124,.30)", todayShadowColor:"rgba(255,100,124,.32)", dateBlue:"#60a5fa", icon:"#91dff2", iconBg:"#17334f", points:"#ffd873", pointsBg:"#493d1e", action:"#bdeffc", actionBg:"#123b56", actionLine:"#287395", actionHover:"#174d6d", done:"#6bb184", doneInk:"#15221e" },
  kidLight: { bg:"#eaf5f8", ink:"#18324d", muted:"#66758b", surface:"#ffffff", line:"#d6e5eb", shadow:"0 7px 18px rgba(38,72,112,.09)", today:"#ff5d00", todayEnd:"#ff8d20", todayInk:"#ffffff", todayLine:"#ff5d00", todaySurface:"#fffaf6", todayIconBg:"#eef7ff", todayShadow:"0 0 18px rgba(255,93,0,.26)", todayShadowColor:"rgba(255,93,0,.28)", dateBlue:"#2563eb", icon:"#2d9fc4", iconBg:"#e2f5fb", points:"#ffffff", pointsBg:"#ffb300", action:"#087f99", actionBg:"#ddf8fc", actionLine:"#8bd9e7", actionHover:"#c8f1f7", done:"#57a56d", doneInk:"#fff" },
  kidDark: { bg:"#071326", ink:"#f7fbff", muted:"#aebcda", surface:"#132441", line:"#38547a", shadow:"0 10px 22px rgba(0,0,0,.3)", today:"#ff647c", todayEnd:"#ff4f7b", todayInk:"#ffffff", todayLine:"#ff647c", todaySurface:"#10243e", todayIconBg:"#173b59", todayShadow:"0 0 18px rgba(255,100,124,.30)", todayShadowColor:"rgba(255,100,124,.32)", dateBlue:"#60a5fa", icon:"#22b8e6", iconBg:"#183957", points:"#ffffff", pointsBg:"#ffb300", action:"#c8f5fc", actionBg:"#15435e", actionLine:"#2d7d9b", actionHover:"#19536f", done:"#75c88a", doneInk:"#1d3024" },
} as const;

export function DueTodayPreview({ theme, kid }: { theme: Theme; kid: boolean }) {
  const [done, setDone] = useState(false);
  const t = themes[theme];
  const iconProps = { size: 20, strokeWidth: 2.2 };
  return (
    <main className={`dt-stage ${kid ? "is-kid-board" : "is-parent-board"}`} style={{ background:t.bg, color:t.ink, ["--line" as string]:t.line, ["--surface" as string]:t.surface, ["--shadow" as string]:t.shadow, ["--today" as string]:t.today, ["--today-end" as string]:t.todayEnd, ["--today-ink" as string]:t.todayInk, ["--today-line" as string]:t.todayLine, ["--today-surface" as string]:t.todaySurface, ["--today-icon-bg" as string]:t.todayIconBg, ["--today-shadow" as string]:t.todayShadow, ["--today-shadow-color" as string]:t.todayShadowColor, ["--date-blue" as string]:t.dateBlue, ["--icon" as string]:t.icon, ["--icon-bg" as string]:t.iconBg, ["--points" as string]:t.points, ["--points-bg" as string]:t.pointsBg, ["--action" as string]:t.action, ["--action-bg" as string]:t.actionBg, ["--action-line" as string]:t.actionLine, ["--action-hover" as string]:t.actionHover, ["--done" as string]:t.done, ["--done-ink" as string]:t.doneInk }}>
      <section className="dt-shell" aria-label="Aufgabenkarte Vorschau">
        <p className="dt-kicker">{kid ? "Mias Aufgaben" : "Familienaufgaben"}</p>
        <h1 className="dt-heading">{kid ? "Heute im Abenteuer" : "Offene Aufgaben"}</h1>
        {kid ? (
          <div className="dt-kid-list">
            <article className="dt-kid-card is-today">
              <div className="dt-ribbon"><CalendarDays size={13} strokeWidth={2.5} />HEUTE</div>
              <div className="dt-kid-hero"><Star size={58} strokeWidth={1.8} /></div>
              <Info className="dt-kid-info" size={17} />
              <div className="dt-kid-detail">
                <div className="dt-kid-row"><Users size={15} /><span>Einzeln</span></div>
                <div className="dt-assignee">👧 Mia · Offen</div>
                <div className="dt-kid-row"><span>0/1 fertig</span></div>
              </div>
              <div className="dt-kid-date"><CalendarDays size={15} />Termin: Heute</div>
              <button className={`dt-kid-points ${done ? "done" : ""}`} onClick={() => setDone(v => !v)}>
                <Star size={20} fill="currentColor" />{done ? "Erledigt" : "+20"}
              </button>
            </article>
            <article className="dt-kid-card dt-kid-card-next">
              <div className="dt-kid-hero"><Star size={50} strokeWidth={1.8} /></div>
              <p className="dt-kid-next-title">Hausaufgaben machen</p>
            </article>
          </div>
        ) : (
        <div className="dt-list">
          <article className="dt-card is-today">
            <div className="dt-ribbon"><CalendarDays size={13} strokeWidth={2.5} />HEUTE</div>
            <div className="dt-icon">{kid ? <Sparkles {...iconProps}/> : <Brush {...iconProps}/>}</div>
            <div className="dt-copy">
              <p className="dt-title">Zimmer aufräumen</p>
              <div className="dt-meta"><CalendarDays size={13}/>Termin: Heute</div>
            </div>
            <div className="dt-points"><Star size={13} fill="currentColor"/>20</div>
            <button className={`dt-action ${done ? "done" : ""}`} aria-label={done ? "Erledigt" : "Aufgabe erledigen"} onClick={() => setDone(v => !v)}>
              {done ? <Check size={17} strokeWidth={3}/> : <Circle size={17} strokeWidth={2.4}/>}
            </button>
          </article>
          <article className="dt-card">
            <div className="dt-icon"><BookOpen {...iconProps}/></div>
            <div className="dt-copy"><p className="dt-title">Hausaufgaben machen</p><div className="dt-meta"><CalendarDays size={13}/>Morgen</div></div>
            <div className="dt-points"><Star size={13} fill="currentColor"/>30</div><Info className="dt-info" size={16}/>
          </article>
          <article className="dt-card">
            <div className="dt-icon"><Utensils {...iconProps}/></div>
            <div className="dt-copy"><p className="dt-title">Tisch decken</p><div className="dt-meta"><CalendarDays size={13}/>Freitag</div></div>
            <div className="dt-points"><Star size={13} fill="currentColor"/>10</div><Info className="dt-info" size={16}/>
          </article>
        </div>
        )}
        <div className="dt-footer"><span className="dt-dot"/>{done ? "Aufgabe abgeschlossen" : "Tippe auf den Kreis, wenn du fertig bist"}<span style={{marginLeft:"auto"}}>3 Aufgaben</span></div>
      </section>
    </main>
  );
}