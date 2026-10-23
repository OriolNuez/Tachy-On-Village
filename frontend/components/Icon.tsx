import type { CSSProperties, ReactNode } from 'react';

export function Icon({ name, size = 20, style }: { name: string; size?: number; style?: CSSProperties }) {
  const paths: Record<string, ReactNode> = {
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
    compass: <><circle cx="12" cy="12" r="9" /><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z" /></>,
    map: <><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    arrow: <path d="M4 12h15m-5-5 5 5-5 5" />,
    walk: <><circle cx="13" cy="4" r="2" /><path d="m9 21 3-7 4 7M6 12l4-4h4l3 4h3m-8-4-2 6" /></>,
    leaf: <><path d="M19 4C9 2 3 7 5 14c2 6 11 6 14-10Z" /><path d="M4 21 14 9" /></>,
    dock: <><path d="M3 17c2 2 4 2 6 0 2 2 4 2 6 0 2 2 4 2 6 0M5 13h14l-3 4H8Zm7-11v11m0-10 6 7h-6" /></>,
    restaurant: <><path d="M4 13h16a8 8 0 0 1-16 0Zm2 8h12M9 3c-4 4 4 4 0 8m6-8c-4 4 4 4 0 8" /></>,
    arena: <><path d="M7 3h10v7a5 5 0 0 1-10 0Zm0 2H3v3c0 3 2 4 5 4m9-7h4v3c0 3-2 4-5 4m-4 3v6m-4 0h8" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18m-13 4h1m5 0h1m-7 3h1m5 0h1" /></>,
    wardrobe: <><path d="m8 4 4 2 4-2 5 5-4 3v9H7v-9L3 9Zm0 0c0 5 8 5 8 0" /></>,
    shrine: <><path d="M3 6h18M5 10h14M7 6v15m10-15v15M2 3q10 4 20 0m-10 7v5" /><path d="m10 17 2-2 2 2-2 2Z" /></>,
  };
  return <svg width={size} height={size} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.compass}</svg>;
}
