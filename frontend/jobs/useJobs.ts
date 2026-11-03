import { useEffect, useRef, useState } from 'react';
import type { JobSnapshot } from '../../shared/jobs';

export function useJobs(onCompleted: () => void) {
  const [job, setJob] = useState<JobSnapshot | null>(null);
  const [connectionError, setConnectionError] = useState('');
  const completed = useRef<string | null>(null);
  useEffect(() => {
    const api = window.villageDesktop?.jobs;
    if (!api) return;
    let active = true, updated = false;
    function accept(value: JobSnapshot | null) {
      if (!active) return;
      setJob(value);
      if (value?.state === 'completed' && completed.current !== value.id) {
        completed.current = value.id; onCompleted();
      }
    }
    const unsubscribe = api.onUpdate(value => { updated = true; accept(value); });
    void api.current().then(result => {
      if (!active) return;
      if (!result.ok) setConnectionError(result.error);
      else if (!updated) accept(result.data);
    }).catch(() => { if (active) setConnectionError('Could not reconnect to the task runner. Restart the desktop app.'); });
    return () => { active = false; unsubscribe(); };
  }, [onCompleted]);
  return { job, connectionError };
}
