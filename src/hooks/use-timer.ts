import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Accurate elapsed-time hook: pauses freeze the clock, resumes continue it.
 * `elapsedSeconds` is a float; render with Math.floor for display.
 */
export function useTimer() {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const segmentStartRef = useRef<number | null>(null);
  const accumRef = useRef(0);
  const intervalRef = useRef<number | null>(null);

  const clearTick = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    segmentStartRef.current = Date.now();
    setRunning(true);
    clearTick();
    intervalRef.current = window.setInterval(() => {
      const now = Date.now();
      const base = accumRef.current + (now - (segmentStartRef.current ?? now)) / 1000;
      setElapsedSeconds(base);
    }, 250);
  }, [clearTick]);

  const pause = useCallback(() => {
    const now = Date.now();
    if (segmentStartRef.current !== null) {
      accumRef.current += (now - segmentStartRef.current) / 1000;
    }
    segmentStartRef.current = null;
    setRunning(false);
    clearTick();
  }, [clearTick]);

  /** Freeze the clock and return the final elapsed seconds. */
  const stop = useCallback(() => {
    const now = Date.now();
    const final =
      accumRef.current +
      (segmentStartRef.current !== null ? (now - segmentStartRef.current) / 1000 : 0);
    accumRef.current = 0;
    segmentStartRef.current = null;
    setRunning(false);
    setElapsedSeconds(final);
    clearTick();
    return final;
  }, [clearTick]);

  const reset = useCallback(() => {
    accumRef.current = 0;
    segmentStartRef.current = null;
    setRunning(false);
    setElapsedSeconds(0);
    clearTick();
  }, [clearTick]);

  useEffect(() => clearTick, [clearTick]);

  return { elapsedSeconds, running, start, pause, resume: start, stop, reset };
}
