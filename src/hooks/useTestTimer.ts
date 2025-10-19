import { useCallback, useEffect, useRef, useState } from "react";

export type QuestionTimingRecord = {
  id: string;
  label?: string;
  durationMs: number;
  startedAtIso: string;
  endedAtIso: string;
};

export type SessionTimingSummary = {
  sessionDurationMs: number;
  averageQuestionDurationMs: number;
  questionTimings: QuestionTimingRecord[];
};

type UseTestTimerReturn = {
  sessionElapsedMs: number;
  questionElapsedMs: number;
  hasSessionStarted: boolean;
  activeQuestionLabel?: string;
  startSession: (questionId: string, label?: string) => void;
  markQuestionStart: (questionId: string, label?: string) => void;
  completeQuestion: (questionId?: string, label?: string) => {
    durationMs: number;
    record: QuestionTimingRecord | null;
  };
  completeSession: () => SessionTimingSummary;
  reset: () => void;
};

const TICK_INTERVAL_MS = 200;

const nowIso = (timestamp: number) => new Date(timestamp).toISOString();

export const useTestTimer = (): UseTestTimerReturn => {
  const [sessionElapsedMs, setSessionElapsedMs] = useState(0);
  const [questionElapsedMs, setQuestionElapsedMs] = useState(0);
  const [activeQuestionLabel, setActiveQuestionLabel] = useState<string | undefined>(undefined);
  const [hasSessionStarted, setHasSessionStarted] = useState(false);
  const [recordsState, setRecordsState] = useState<QuestionTimingRecord[]>([]);

  const sessionStartRef = useRef<number | null>(null);
  const questionStartRef = useRef<number | null>(null);
  const questionIdRef = useRef<string | null>(null);
  const recordsRef = useRef<QuestionTimingRecord[]>([]);
  const intervalRef = useRef<number | null>(null);

  const stopTicker = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!hasSessionStarted || sessionStartRef.current === null) {
      stopTicker();
      return;
    }
    if (intervalRef.current !== null) {
      return;
    }

    intervalRef.current = window.setInterval(() => {
      const sessionStart = sessionStartRef.current;
      if (sessionStart !== null) {
        setSessionElapsedMs(Date.now() - sessionStart);
      }
      const questionStart = questionStartRef.current;
      if (questionStart !== null) {
        setQuestionElapsedMs(Date.now() - questionStart);
      }
    }, TICK_INTERVAL_MS);

    return () => {
      stopTicker();
    };
  }, [hasSessionStarted, stopTicker]);

  const reset = useCallback(() => {
    stopTicker();
    sessionStartRef.current = null;
    questionStartRef.current = null;
    questionIdRef.current = null;
    recordsRef.current = [];
    setRecordsState([]);
    setSessionElapsedMs(0);
    setQuestionElapsedMs(0);
    setActiveQuestionLabel(undefined);
    setHasSessionStarted(false);
  }, [stopTicker]);

  const startSession = useCallback(
    (questionId: string, label?: string) => {
      const start = Date.now();
      sessionStartRef.current = start;
      questionStartRef.current = start;
      questionIdRef.current = questionId;
      recordsRef.current = [];
      setRecordsState([]);
      setSessionElapsedMs(0);
      setQuestionElapsedMs(0);
      setActiveQuestionLabel(label);
      setHasSessionStarted(true);
    },
    [],
  );

  const markQuestionStart = useCallback((questionId: string, label?: string) => {
    const start = Date.now();
    questionStartRef.current = start;
    questionIdRef.current = questionId;
    setQuestionElapsedMs(0);
    setActiveQuestionLabel(label);
  }, []);

  const completeQuestion = useCallback(
    (questionId?: string, label?: string) => {
      const questionStart = questionStartRef.current;
      if (questionStart === null) {
        return { durationMs: 0, record: null };
      }
      const end = Date.now();
      const durationMs = end - questionStart;
      const finalId = questionId ?? questionIdRef.current ?? `q-${recordsRef.current.length + 1}`;
      const finalLabel = label ?? activeQuestionLabel;
      const record: QuestionTimingRecord = {
        id: finalId,
        label: finalLabel,
        durationMs,
        startedAtIso: nowIso(questionStart),
        endedAtIso: nowIso(end),
      };

      recordsRef.current = [...recordsRef.current, record];
      setRecordsState(recordsRef.current);
      questionStartRef.current = null;
      questionIdRef.current = null;
      setQuestionElapsedMs(0);
      setActiveQuestionLabel(undefined);

      return { durationMs, record };
    },
    [activeQuestionLabel],
  );

  const completeSession = useCallback((): SessionTimingSummary => {
    const sessionStart = sessionStartRef.current;
    const end = Date.now();
    let sessionDurationMs = 0;
    if (sessionStart !== null) {
      sessionDurationMs = end - sessionStart;
    }
    const questionTimings = recordsRef.current;
    const totalQuestionDuration = questionTimings.reduce((sum, record) => sum + record.durationMs, 0);
    const averageQuestionDurationMs =
      questionTimings.length > 0 ? Math.round(totalQuestionDuration / questionTimings.length) : 0;

    stopTicker();
    sessionStartRef.current = null;
    questionStartRef.current = null;
    questionIdRef.current = null;
    setHasSessionStarted(false);

    return {
      sessionDurationMs,
      averageQuestionDurationMs,
      questionTimings,
    };
  }, [stopTicker]);

  return {
    sessionElapsedMs,
    questionElapsedMs,
    hasSessionStarted,
    activeQuestionLabel,
    startSession,
    markQuestionStart,
    completeQuestion,
    completeSession,
    reset,
  };
};

export const formatDurationMs = (durationMs: number): string => {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return "0:00";
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};
