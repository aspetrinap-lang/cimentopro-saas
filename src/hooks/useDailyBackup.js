import { useEffect } from 'react';
import { runDailyBackup } from '@/lib/backupUtils';

export function useDailyBackup() {
  useEffect(() => {
    runDailyBackup().catch(() => {});
  }, []);
}