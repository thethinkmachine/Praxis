import { LogEntry } from '@/types/step';

export function createLog(
  message: string,
  level: LogEntry['level'] = 'info',
  stepIndex?: number
): LogEntry {
  return {
    id: Math.random().toString(36).substring(2, 9),
    timestamp: Date.now(),
    level,
    message,
    stepIndex,
  };
}
