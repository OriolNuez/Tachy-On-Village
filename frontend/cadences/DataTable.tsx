import { useState, type ReactNode } from 'react';

export function DataTable({ label, headers, rows, empty }: { label: string; headers: string[]; rows: ReactNode[][]; empty: string }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / 25));
  const current = Math.min(page, pages - 1);
  return <>
    <div className="data-scroll" tabIndex={0} role="region" aria-label={`${label} table`}>
      <table className="data-table"><caption className="sr-only">{label}</caption><thead><tr>{headers.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{rows.slice(current * 25, current * 25 + 25).map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell || '—'}</td>)}</tr>)}</tbody>
      </table>
      {!rows.length && <div className="table-empty"><span aria-hidden="true">◇</span><p>{empty}</p><small>Records will appear here when available.</small></div>}
    </div>
    {pages > 1 && <nav className="table-pagination" aria-label={`${label} pages`}><button className="small-button" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button><span>{current + 1} / {pages}</span><button className="small-button" disabled={current === pages - 1} onClick={() => setPage(current + 1)}>Next</button></nav>}
  </>;
}
