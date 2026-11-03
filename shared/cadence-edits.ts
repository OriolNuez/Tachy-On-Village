export type StepKind = 'email' | 'linkedin' | 'call';
export const stepLabels = { email: 'Email', linkedin: 'LinkedIn outreach', call: 'Call' } as const;
export const stepIcons = { email: '✉', linkedin: 'in', call: '☎' } as const;
export type CadenceEdit =
  | { kind: 'archive' }
  | { kind: 'reply'; id: string; replied: boolean }
  | { kind: 'step'; id?: string; remove?: boolean; title?: string; date?: string; contact?: string; type?: StepKind }
  | { kind: 'account' | 'contact'; id: string; remove?: boolean; values?: Record<string, string> };
