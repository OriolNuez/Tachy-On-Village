import { stepIcons, stepLabels } from '../../shared/cadence-edits';
import { useId, useState } from 'react';
import type { CadenceEvent, CadenceSummary } from '../../shared/cadences';
import { dateKey, monthDays, shiftMonth } from './calendar-model';

export function Calendar({ events, cadences, compact = false }: { events: CadenceEvent[]; cadences: CadenceSummary[]; compact?: boolean }) {
  const [month, setMonth] = useState(() => shiftMonth(new Date(), 0));
  const id = useId();
  const today = dateKey(new Date());
  const days = monthDays(month);
  const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const colors = new Map(cadences.map(cadence => [cadence.name, cadence.color]));
  const byDay = new Map<string, CadenceEvent[]>();
  for (const event of events) byDay.set(event.date, [...(byDay.get(event.date) ?? []), event]);
  const monthPrefix = dateKey(month).slice(0, 7);
  return <section className={`cad-calendar ${compact ? 'is-compact' : ''}`} aria-labelledby={id}>
    <div className="calendar-toolbar">
      <h3 id={id} aria-live="polite">{monthLabel}</h3>
      <div className="calendar-actions">
        <button className="small-button" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
        <button className="small-button" onClick={() => setMonth(shiftMonth(new Date(), 0))}>Today</button>
        <button className="small-button" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
      </div>
    </div>
    <table className="month-grid" aria-label={monthLabel}>
      <thead><tr>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <th key={day} scope="col">{day}</th>)}</tr></thead>
      <tbody>{Array.from({ length: 6 }, (_, week) => <tr key={week}>{days.slice(week * 7, week * 7 + 7).map(day => {
        const key = dateKey(day);
        return <td key={key} className={day.getMonth() !== month.getMonth() ? 'outside-month' : ''}>
          <time dateTime={key} aria-current={key === today ? 'date' : undefined}>{day.getDate()}</time>
          {(byDay.get(key) ?? []).map((event, i) => <div key={i} className="calendar-event" style={{ borderColor: colors.get(event.cadence) }}>
            <strong>{event.type && <span aria-label={stepLabels[event.type]}>{stepIcons[event.type]} </span>}{event.title}</strong>{!compact && <span>{event.cadence}</span>}{event.contact && <span>{event.contact}</span>}
          </div>)}
        </td>;
      })}</tr>)}</tbody>
    </table>
    {!events.some(event => event.date.startsWith(monthPrefix)) && <p className="calendar-empty">No recorded events this month.</p>}
    {!compact && <div className="calendar-legend" aria-label="Cadence colours">{cadences.map(cadence => <span key={cadence.name}><i style={{ background: cadence.color }} />{cadence.name}</span>)}</div>}
  </section>;
}
