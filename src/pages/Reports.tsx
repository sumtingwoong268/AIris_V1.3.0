// src/pages/Reports.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Download, FileText, Plus } from "lucide-react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { saveAs } from "file-saver";
import { generateReport } from "@/utils/geminiClient";
import logo from "@/assets/logo.png";
import StructuredReportView from "@/components/reports/StructuredReportView";
import {
  parseAiReportText,
  sanitizeToPlainText,
  TRAFFIC_BADGE_COLORS,
  type TrafficLight,
  type UrgencyLevel,
} from "@/utils/reportFormatting";
import type { GeminiStructuredReport } from "@/utils/reportTypes";

function AIReportHTML({ html }: { html: string }) {
  if (!html) return null;
  return (
    <div
      className="prose max-w-none my-8 rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-900/70"
      style={{ overflowX: "auto" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

const wrapText = (text: string, maxChars: number): string[] => {
  const words = (text || "").split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + (line ? " " : "") + w).length <= maxChars) {
      line = line ? line + " " + w : w;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
};

type TestResultRow = {
  test_type: string;
  score: number | null;
  details: any;
  created_at: string;
  xp_earned?: number | null;
};

function calculateAge(dateString?: string | null): number | null {
  if (!dateString) return null;
  const dob = new Date(dateString);
  if (Number.isNaN(dob.getTime())) return null;
  const diff = Date.now() - dob.getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

function buildGeminiDataset(
  profile: Record<string, any>,
  latestByType: Record<string, TestResultRow>,
  results: TestResultRow[],
) {
  const tests: Record<string, any> = {};

  const normalizeTiming = (details: any) => {
    const timing = details && typeof details === "object" ? details.timing : null;
    if (!timing) return null;
    const sessionDurationMs = Number.isFinite(timing.sessionDurationMs) ? Number(timing.sessionDurationMs) : null;
    const averageQuestionDurationMs = Number.isFinite(timing.averageQuestionDurationMs)
      ? Number(timing.averageQuestionDurationMs)
      : null;
    const perQuestionRaw = Array.isArray(timing.perQuestion) ? timing.perQuestion : [];
    const perQuestion = perQuestionRaw.map((entry: any) => ({
      id: entry?.id ?? null,
      label: entry?.label ?? null,
      durationMs: Number.isFinite(entry?.durationMs) ? Number(entry.durationMs) : null,
      startedAtIso: typeof entry?.startedAtIso === "string" ? entry.startedAtIso : null,
      endedAtIso: typeof entry?.endedAtIso === "string" ? entry.endedAtIso : null,
    }));
    const questionDurations = perQuestion
      .map((entry) => entry.durationMs)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
    const fastestQuestionMs = questionDurations.length ? Math.min(...questionDurations) : null;
    const slowestQuestionMs = questionDurations.length ? Math.max(...questionDurations) : null;

    return {
      sessionDurationMs,
      averageQuestionDurationMs,
      perQuestion,
      fastestQuestionMs,
      slowestQuestionMs,
    };
  };

  const deriveIshiharaInsights = (details: any, currentScore: number | null) => {
    if (!details || typeof details !== "object") return null;
    const summary = details.analysisSummary ?? details.analysis_summary ?? null;
    const matched = summary?.matched_outcomes ?? details.matchedOutcomes ?? {};
    const segments = summary?.segments ?? details.segments ?? null;
    const control = summary?.control ?? details.control ?? null;
    const suspected =
      summary?.suspected_deficiency ?? details.suspectedDeficiency ?? details.subtype ?? null;
    const focus = summary?.focus_type ?? details.focusType ?? null;
    const secondary = summary?.secondary_type ?? details.secondaryType ?? null;
    const totalPlates =
      details.totalPlates ??
      (Array.isArray(details.answers) ? details.answers.length : summary?.totalPlates ?? null);
    const correctCount = details.correctCount ?? summary?.correct_count ?? null;
    const totalMistakes = typeof matched?.totalMistakes === "number" ? matched.totalMistakes : null;
    const suspectedKey =
      typeof suspected === "string" ? suspected.toLowerCase().replace(/[^a-z0-9]+/g, "_") : null;
    const suspectedMatches =
      suspectedKey && typeof matched === "object" ? matched[suspectedKey] ?? null : null;

    let confidence: "high" | "medium" | "low" | "undetermined" = "undetermined";
    if (suspectedKey === "normal") {
      const ratio =
        correctCount !== null && totalPlates ? correctCount / totalPlates : currentScore !== null ? currentScore / 100 : null;
      if (ratio !== null) {
        confidence = ratio >= 0.9 ? "high" : ratio >= 0.75 ? "medium" : "low";
      }
    } else if (typeof suspectedMatches === "number") {
      confidence = suspectedMatches >= 3 ? "high" : suspectedMatches >= 2 ? "medium" : "low";
    } else if (totalMistakes !== null) {
      confidence = totalMistakes >= 4 ? "medium" : "low";
    }

    const answered = Array.isArray(details.answers) ? details.answers : [];
    const mistakeBreakdown = answered
      .filter((entry) => entry && typeof entry === "object" && entry.correct === false)
      .map((entry) => ({
        plateId: entry.plateId ?? null,
        userAnswer: entry.answer ?? entry.normalizedAnswer ?? null,
        matchedOutcome: entry.matchedOutcome ?? null,
        plateType: entry.plateTypeNormalized ?? entry.plateType ?? null,
      }));

    return {
      suspectedDeficiency: suspectedKey,
      suspectedDeficiencyDisplay: typeof suspected === "string" ? suspected : null,
      confidence,
      focusType: focus,
      secondaryType: secondary,
      control,
      segments,
      matchedOutcomes: matched,
      totalPlates,
      correctCount,
      score: currentScore,
      totalMistakes,
      mistakeBreakdown,
    };
  };

  const chronologicalHistory = (type: string) =>
    results
      .filter((entry) => entry.test_type === type)
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  let ishiharaOverview: any = null;

  Object.entries(latestByType).forEach(([testType, latest]) => {
    const history = chronologicalHistory(testType).map((item) => ({
      score: item.score ?? null,
      created_at: item.created_at,
      details: item.details ?? null,
      xp_earned: item.xp_earned ?? null,
      timing: normalizeTiming(item.details ?? null),
    }));
    const latestScore = latest?.score ?? null;
    const previousScore = history.length >= 2 ? history[history.length - 2].score : null;
    const trend =
      latestScore !== null && previousScore !== null
        ? Number((latestScore - previousScore).toFixed(2))
        : null;

    const timingRecords = history
      .map((entry) => entry.timing)
      .filter((timing): timing is NonNullable<typeof timing> => timing !== null);

    const sessionDurations = timingRecords
      .map((timing) => timing.sessionDurationMs)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);

    const questionDurations = timingRecords.flatMap((timing) =>
      timing.perQuestion
        .map((entry) => entry.durationMs)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0),
    );

    const averageSessionDurationMs = sessionDurations.length
      ? Math.round(sessionDurations.reduce((sum, value) => sum + value, 0) / sessionDurations.length)
      : null;

    const averageQuestionDurationMs = questionDurations.length
      ? Math.round(questionDurations.reduce((sum, value) => sum + value, 0) / questionDurations.length)
      : null;

    const fastestQuestionMs = questionDurations.length ? Math.min(...questionDurations) : null;
    const slowestQuestionMs = questionDurations.length ? Math.max(...questionDurations) : null;
    const latestTiming = normalizeTiming(latest?.details ?? null);

    tests[testType] = {
      current: {
        score: latestScore,
        created_at: latest?.created_at ?? null,
        details: latest?.details ?? null,
        timing: latestTiming,
      },
      previousScore,
      trend,
      history,
      timing: {
        averageSessionDurationMs,
        averageQuestionDurationMs,
        sessionCount: sessionDurations.length,
        questionCount: questionDurations.length,
        fastestQuestionMs,
        slowestQuestionMs,
      },
    };

    if (testType === "ishihara") {
      const analysis = deriveIshiharaInsights(latest?.details ?? null, latestScore);
      if (analysis) {
        (tests[testType] as any).analysis = analysis;
        ishiharaOverview = {
          ...analysis,
          trend,
          previousScore,
          history: history.map((entry) => ({
            score: entry.score,
            created_at: entry.created_at,
            suspectedDeficiency:
              deriveIshiharaInsights(entry.details ?? null, entry.score ?? null)?.suspectedDeficiency ?? null,
          })),
        };
      }
    }
  });

  const allCurrentScores = Object.values(latestByType)
    .map((entry) => (typeof entry?.score === "number" ? entry.score : null))
    .filter((value): value is number => value !== null);

  const overallAverageScore =
    allCurrentScores.length > 0
      ? Number((allCurrentScores.reduce((sum, value) => sum + value, 0) / allCurrentScores.length).toFixed(2))
      : null;

  const previousScores: number[] = [];
  Object.keys(latestByType).forEach((type) => {
    const history = chronologicalHistory(type);
    if (history.length >= 2 && typeof history[history.length - 2].score === "number") {
      previousScores.push(history[history.length - 2].score as number);
    }
  });

  const previousAverage =
    previousScores.length > 0
      ? Number((previousScores.reduce((sum, value) => sum + value, 0) / previousScores.length).toFixed(2))
      : null;

  const lowestScoresByType: Record<string, number | null> = {};
  Object.keys(latestByType).forEach((type) => {
    const history = chronologicalHistory(type);
    let lowest: number | null = null;
    history.forEach((entry) => {
      if (typeof entry.score === "number") {
        lowest = lowest === null ? entry.score : Math.min(lowest, entry.score);
      }
    });
    lowestScoresByType[type] = lowest;
  });

  const careBaselinePool = Object.values(lowestScoresByType).filter(
    (value): value is number => typeof value === "number",
  );
  const careBaselineScore = careBaselinePool.length > 0 ? Math.min(...careBaselinePool) : null;

  let riskLevel: "Low" | "Moderate" | "High" | "Unknown" = "Unknown";
  if (careBaselineScore !== null) {
    riskLevel = careBaselineScore >= 70 ? "Low" : careBaselineScore >= 40 ? "Moderate" : "High";
  }

  const trendOverall =
    overallAverageScore !== null && previousAverage !== null
      ? Number((overallAverageScore - previousAverage).toFixed(2))
      : null;

  const age = calculateAge(profile.date_of_birth ?? null);

  const symptoms = Array.isArray(profile.symptoms) ? profile.symptoms : [];
  const eyeConditions = Array.isArray(profile.eye_conditions) ? profile.eye_conditions : [];
  const familyHistory = Array.isArray(profile.family_history) ? profile.family_history : [];

  const allTimingRecords = results
    .map((entry) => normalizeTiming(entry.details ?? null))
    .filter((timing): timing is NonNullable<ReturnType<typeof normalizeTiming>> => timing !== null);

  const overallSessionDurations = allTimingRecords
    .map((timing) => timing.sessionDurationMs)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);

  const overallQuestionDurations = allTimingRecords.flatMap((timing) =>
    timing.perQuestion
      .map((entry) => entry.durationMs)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0),
  );

  const averageSessionDurationMs = overallSessionDurations.length
    ? Math.round(overallSessionDurations.reduce((sum, value) => sum + value, 0) / overallSessionDurations.length)
    : null;

  const averageQuestionDurationMs = overallQuestionDurations.length
    ? Math.round(overallQuestionDurations.reduce((sum, value) => sum + value, 0) / overallQuestionDurations.length)
    : null;

  const fastestQuestionMs = overallQuestionDurations.length ? Math.min(...overallQuestionDurations) : null;
  const slowestQuestionMs = overallQuestionDurations.length ? Math.max(...overallQuestionDurations) : null;

  return {
    generated_at: new Date().toISOString(),
    user: {
      name: profile.display_name || profile.full_name || profile.username || "User",
      full_name: profile.full_name ?? null,
      age,
      gender: profile.gender ?? null,
      ethnicity: profile.ethnicity ?? null,
      wears_correction: profile.wears_correction ?? null,
      correction_type: profile.correction_type ?? null,
      last_eye_exam: profile.last_eye_exam ?? null,
    },
    lifestyle: {
      screen_time_hours: profile.screen_time_hours ?? null,
      outdoor_time_hours: profile.outdoor_time_hours ?? null,
      sleep_quality: profile.sleep_quality ?? null,
      symptoms,
      eye_conditions: eyeConditions,
      family_history: familyHistory,
      eye_surgeries: profile.eye_surgeries ?? null,
      uses_eye_medication: profile.uses_eye_medication ?? false,
      medication_details: profile.medication_details ?? null,
      bio: profile.bio ?? null,
    },
    stats: {
      xp: profile.xp ?? 0,
      level: Math.floor((profile.xp ?? 0) / 100) + 1,
      current_streak: profile.current_streak ?? 0,
      overall_score: overallAverageScore,
      care_baseline_score: careBaselineScore,
      previous_average_score: previousAverage,
      overall_trend: trendOverall,
      risk_level: riskLevel,
      tests_completed: Object.keys(latestByType).length,
      average_session_duration_ms: averageSessionDurationMs,
      average_question_duration_ms: averageQuestionDurationMs,
      fastest_question_ms: fastestQuestionMs,
      slowest_question_ms: slowestQuestionMs,
      timed_sessions_count: overallSessionDurations.length,
      timed_responses_count: overallQuestionDurations.length,
    },
    tests,
    color_vision: ishiharaOverview,
    history: results.map((entry) => ({
      test_type: entry.test_type,
      score: entry.score ?? null,
      created_at: entry.created_at,
      details: entry.details ?? null,
      xp_earned: entry.xp_earned ?? null,
      timing: normalizeTiming(entry.details ?? null),
    })),
  };
}

const isStructuredReport = (value: unknown): value is GeminiStructuredReport => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate.sections) && candidate.sections.length > 0;
};

export default function Reports() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);

  const latestReport = reports[0];
  const latestReportDetails = useMemo(() => {
    if (!latestReport) return null;
    const reportData = latestReport.report_data ?? {};
    const structured = isStructuredReport(reportData?.structured) ? (reportData.structured as GeminiStructuredReport) : null;
    const html =
      typeof reportData?.html === "string"
        ? reportData.html
        : typeof latestReport.analysis === "string"
          ? latestReport.analysis
          : "";
    const plainText =
      typeof reportData?.plain_text === "string"
        ? reportData.plain_text
        : sanitizeToPlainText(
            html ||
              (typeof latestReport.recommendations === "string" ? latestReport.recommendations : "") ||
              (typeof latestReport.risk_assessment === "string" ? latestReport.risk_assessment : ""),
          );
    const keyFindings: string[] = Array.isArray(reportData?.key_findings) ? (reportData.key_findings as string[]) : [];
    const theme = reportData?.theme ?? {};
    const accentColor = typeof theme?.accentColor === "string" ? theme.accentColor : "#6366F1";
    const trafficLight =
      (theme?.trafficLight as TrafficLight | undefined) || (latestReport.traffic_light as TrafficLight | undefined) || null;
    const urgency =
      (theme?.urgency as UrgencyLevel | undefined) || (latestReport.urgency_level as UrgencyLevel | undefined) || null;
    const themeSummary =
      typeof theme?.summary === "string" && theme.summary.trim().length > 0 ? theme.summary.trim() : undefined;
    const summary =
      themeSummary ??
      (typeof latestReport.summary === "string" && latestReport.summary.trim().length > 0
        ? latestReport.summary.trim()
        : typeof latestReport.risk_assessment === "string" && latestReport.risk_assessment.trim().length > 0
          ? latestReport.risk_assessment.trim()
          : plainText.slice(0, 260));

    return {
      structured,
      html,
      plainText,
      keyFindings,
      accentColor,
      trafficLight,
      urgency,
      summary,
      themeSummary,
    };
  }, [latestReport]);

  const latestReportHtml = latestReportDetails?.html ?? "";
  const lastGeneratedAt = latestReport?.created_at
    ? new Date(latestReport.created_at).toLocaleString()
    : null;

  useEffect(() => {
    if (user) void fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchReports = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) setReports(data);
  };

  const generatePDF = async () => {
    if (!user) return;

    setGenerating(true);
    try {
      // 1) Load profile and results
      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      const { data: results, error: rErr } = await supabase
        .from("test_results")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (pErr || rErr || !profile || !results) {
        throw new Error("Could not fetch profile or test results");
      }

      // 2) Latest result per type
      const latestByType: Record<string, any> = {};
      for (const r of results) {
        if (!latestByType[r.test_type]) latestByType[r.test_type] = r;
      }

      const dataset = buildGeminiDataset(
        profile,
        latestByType as Record<string, TestResultRow>,
        results as TestResultRow[],
      );

      // 3) AI analysis (serverless)
      toast({ title: "Generating AI Report...", description: "Analyzing your results" });
      const { text: aiReportText } = await generateReport({
        userData: dataset,
      });

      // 4) PDF build
      const pdfDoc = await PDFDocument.create();
      let page = pdfDoc.addPage([595, 842]);
      const { width, height } = page.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const baseRisk = dataset.stats?.risk_level ?? "Unknown";
      const fallbackTraffic: TrafficLight =
        baseRisk === "High" ? "red" : baseRisk === "Moderate" ? "yellow" : "green";
      const fallbackUrgency: UrgencyLevel =
        fallbackTraffic === "red" ? "urgent" : fallbackTraffic === "yellow" ? "consult_soon" : "no_action";

      const parsedReport = parseAiReportText(aiReportText, {
        fallbackTrafficLight: fallbackTraffic,
        fallbackUrgency,
        fallbackAccentColor: "#6366F1",
      });

      const sanitizedPlain = parsedReport.plainText || sanitizeToPlainText(aiReportText);
      const generatedDate = new Date().toLocaleDateString();

      const summarySnippetSource =
        (parsedReport.summary && parsedReport.summary.trim().length > 0
          ? parsedReport.summary.trim()
          : sanitizedPlain.replace(/\s+/g, " ").trim()) || "";
      const summarySnippet =
        summarySnippetSource.length > 220
          ? `${summarySnippetSource.slice(0, 220).trim()}…`
          : summarySnippetSource || `AI-generated report created on ${generatedDate}`;

      const trafficLight = parsedReport.trafficLight;
      const urgencyLevel = parsedReport.urgency;

      const structuredReport = parsedReport.structured;

      const hexToRgb = (hex: string): [number, number, number] | null => {
        const cleaned = hex.replace("#", "");
        if (![3, 6].includes(cleaned.length)) return null;
        const normalized = cleaned.length === 3 ? cleaned.replace(/./g, (ch) => ch + ch) : cleaned;
        const segments = normalized.match(/.{2}/g);
        if (!segments) return null;
        const [rHex, gHex, bHex] = segments;
        return [parseInt(rHex, 16) / 255, parseInt(gHex, 16) / 255, parseInt(bHex, 16) / 255];
      };

      const accentHex = parsedReport.accentColor ?? "#2563EB";
      const accentRgb = hexToRgb(accentHex) ?? [0.2, 0.4, 0.8];
      const accentColor = rgb(accentRgb[0], accentRgb[1], accentRgb[2]);

      const marginX = 50;
      let y = height - 50;

      const ensureSpace = (amount: number) => {
        if (y - amount < 60) {
          page = pdfDoc.addPage([595, 842]);
          const nextSize = page.getSize();
          y = nextSize.height - 50;
        }
      };

      const drawLines = (
        text: string,
        opts?: { size?: number; color?: ReturnType<typeof rgb>; indent?: number; leading?: number },
      ) => {
        const size = opts?.size ?? 10;
        const color = opts?.color ?? rgb(0.1, 0.1, 0.1);
        const indent = opts?.indent ?? 0;
        const leading = opts?.leading ?? size + 4;
        const lines = wrapText(text, 88);

        for (const line of lines) {
          if (!line.trim()) {
            y -= leading * 0.6;
            continue;
          }
          ensureSpace(leading);
          page.drawText(line, {
            x: marginX + indent,
            y,
            size,
            font,
            color,
          });
          y -= leading;
        }
      };

      const drawParagraph = (
        text: string,
        opts?: {
          size?: number;
          color?: ReturnType<typeof rgb>;
          bulletIndent?: number;
          indent?: number;
          leading?: number;
          paragraphSpacing?: number;
        },
      ) => {
        const paragraphs = text
          .split(/\n+/)
          .map((p) => p.trim())
          .filter((p) => p.length > 0);

        if (paragraphs.length === 0) {
          y -= (opts?.leading ?? (opts?.size ?? 10) + 4) * 0.6;
          return;
        }

        paragraphs.forEach((para, index) => {
          const isBullet = /^[-•\u2022]/.test(para);
          const normalized = isBullet ? para.replace(/^[-•\u2022]\s*/, "") : para;
          const prefix = isBullet ? "• " : "";
          const indent = isBullet ? opts?.bulletIndent ?? 12 : opts?.indent ?? 0;

          drawLines(`${prefix}${normalized}`, {
            size: opts?.size,
            color: opts?.color,
            indent,
            leading: opts?.leading,
          });

          if (index < paragraphs.length - 1) {
            y -= opts?.paragraphSpacing ?? 6;
          }
        });
      };

      const drawSectionTitle = (title: string) => {
        ensureSpace(32);
        page.drawText(title, {
          x: marginX,
          y,
          size: 14,
          font: bold,
          color: accentColor,
        });
        y -= 20;
        page.drawLine({
          start: { x: marginX, y: y + 6 },
          end: { x: width - marginX, y: y + 6 },
          thickness: 0.5,
          color: accentColor,
        });
        y -= 10;
      };

      const displayName =
        dataset.user?.name ?? profile.display_name ?? profile.username ?? "User";
      page.drawText("AIris Vision Health Report", {
        x: marginX,
        y,
        size: 24,
        font: bold,
        color: accentColor,
      });
      y -= 30;

      drawParagraph(`Generated for: ${displayName}`, { size: 12, leading: 16 });
      drawParagraph(`Date: ${generatedDate}`, { size: 12, color: rgb(0.4, 0.4, 0.4), leading: 16 });
      const leadSummary = parsedReport.themeSummary ?? parsedReport.summary ?? "";
      if (leadSummary.trim().length > 0) {
        y -= 6;
        drawParagraph(sanitizeToPlainText(leadSummary), { size: 11, color: rgb(0.2, 0.2, 0.2) });
      }
      y -= 6;

      if (structuredReport) {
        if (parsedReport.keyFindings.length > 0) {
          drawSectionTitle("Key Findings");
          parsedReport.keyFindings.forEach((finding) => {
            const text = `• ${sanitizeToPlainText(finding)}`;
            drawParagraph(text, { bulletIndent: 12 });
          });
          y -= 12;
        }

        structuredReport.sections.forEach((section) => {
          drawSectionTitle(section.title);
          section.blocks.forEach((block) => {
            const text = sanitizeToPlainText(block);
            if (!text.trim()) return;
            drawParagraph(text, { bulletIndent: 12, paragraphSpacing: 4 });
            y -= 6;
          });
          y -= 8;
        });
      } else {
        const printablePlain = sanitizedPlain.length > 0 ? sanitizedPlain : parsedReport.summary ?? "";
        drawParagraph(printablePlain, { bulletIndent: 12 });
      }

// Footer
const pages = pdfDoc.getPages();
pages.forEach((p, idx) => {
  p.drawText("AIris - The Future of Eyecare | AI-assisted by Google Gemini", {
    x: 50,
    y: 30,
    size: 8,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });
  p.drawText(`Page ${idx + 1} of ${pages.length}`, {
    x: width - 100,
    y: 30,
    size: 8,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });
});

// ✅ Save and download the PDF here
const pdfBytes = await pdfDoc.save();
const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });   // <-- put this line here
const fileName = `AIris_Report_${(profile.display_name ?? profile.username ?? "User")
  .replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;
saveAs(blob, fileName);

// ✅ Single insert only (remove any earlier duplicate insert)
{
  const { error: insertError } = await supabase.from("reports").insert({
    user_id: user.id,
    title: "Vision Health Report",
    summary: summarySnippet || `AI-generated report created on ${generatedDate}`,
    report_data: {
      dataset,
      html: parsedReport.html,
      plain_text: parsedReport.plainText || sanitizedPlain,
      raw_text: aiReportText,
      structured: parsedReport.structured,
      key_findings: parsedReport.keyFindings,
      theme: {
        accentColor: parsedReport.accentColor,
        trafficLight,
        urgency: urgencyLevel,
        summary: parsedReport.themeSummary ?? parsedReport.summary,
      },
    },
    risk_assessment: summarySnippet || sanitizedPlain.slice(0, 500),
    recommendations: parsedReport.plainText || sanitizedPlain,
    urgency_level: urgencyLevel,
    traffic_light: trafficLight,
  });
  if (insertError) throw insertError;
}


      await fetchReports();
      toast({ title: "Report generated!", description: "Your PDF has been downloaded" });
    } catch (error: any) {
      console.error("PDF generation error:", error);
      toast({
        title: "Error generating report",
        description: error?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="border-b border-border/40 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto flex items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex cursor-pointer items-center gap-3" onClick={() => navigate("/dashboard")}>
            <img src={logo} alt="AIris" className="h-10" />
            <div className="flex flex-col">
              <span className="text-lg font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                AIris
              </span>
              <span className="text-[10px] text-muted-foreground -mt-1">the future of eyecare</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl space-y-10 px-4 py-10">
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-primary via-indigo-600 to-fuchsia-600 text-white shadow-2xl">
          <span className="pointer-events-none absolute -left-12 top-1/3 h-48 w-48 rounded-full bg-white/25 blur-3xl" />
          <span className="pointer-events-none absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-sky-400/30 blur-3xl" />
          <CardContent className="relative z-10 flex flex-col gap-6 p-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.35rem] text-white/70">Vision reports</p>
              <h1 className="text-4xl font-bold">Download and share your personalized AIris assessments</h1>
              <p className="max-w-2xl text-sm text-white/80">
                Each report condenses your latest test data into an optometrist-friendly summary. Keep them handy for
                checkups or track your progress over time.
              </p>
            </div>
            <div className="flex w-full flex-col items-start gap-3 rounded-2xl bg-white/15 p-5 shadow-lg backdrop-blur lg:max-w-sm">
              <p className="text-xs uppercase tracking-wide text-white/70">Last generated</p>
              <p className="text-lg font-semibold">{lastGeneratedAt ?? "No reports yet"}</p>
              {latestReportDetails?.trafficLight && (
                <span
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
                  style={{
                    backgroundColor: TRAFFIC_BADGE_COLORS[latestReportDetails.trafficLight].bg,
                    color: TRAFFIC_BADGE_COLORS[latestReportDetails.trafficLight].text,
                  }}
                >
                  Status · {latestReportDetails.trafficLight.toUpperCase()}
                </span>
              )}
              {latestReportDetails?.urgency && (
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                  Urgency · {latestReportDetails.urgency.replace(/_/g, " ")}
                </span>
              )}
              <Button
                className="w-full bg-white/20 text-white hover:bg-white/30"
                onClick={generatePDF}
                disabled={generating}
              >
                <Plus className="mr-2 h-4 w-4" />
                {generating ? "Generating..." : "Generate New Report"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {reports.length > 0 && latestReportDetails && (
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Latest AIris report preview</h2>
            {latestReportDetails.structured ? (
              <StructuredReportView
                report={latestReportDetails.structured}
                accentColor={latestReportDetails.accentColor}
                trafficLight={
                  latestReportDetails.trafficLight ??
                  (latestReport.traffic_light as TrafficLight | undefined) ??
                  "yellow"
                }
                urgency={
                  latestReportDetails.urgency ??
                  (latestReport.urgency_level as UrgencyLevel | undefined) ??
                  "routine_checkup"
                }
                keyFindings={latestReportDetails.keyFindings}
                themeSummary={latestReportDetails.themeSummary ?? latestReportDetails.summary}
              />
            ) : latestReportHtml.trim().startsWith("<") ? (
              <AIReportHTML html={latestReportHtml} />
            ) : (
              <div className="rounded-3xl border border-white/60 bg-white/80 p-6 text-sm leading-relaxed shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-900/70">
                {latestReportDetails.plainText || latestReportHtml}
              </div>
            )}
          </section>
        )}

        {reports.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <FileText className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
              <h3 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-50">No reports yet</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Generate your first comprehensive vision health report to unlock tailored recommendations.
              </p>
              <Button
                className="bg-gradient-to-r from-primary to-blue-500 text-white hover:from-blue-500 hover:to-primary"
                onClick={generatePDF}
                disabled={generating}
              >
                <Plus className="mr-2 h-4 w-4" />
                {generating ? "Generating..." : "Generate Report"}
              </Button>
              <p className="mt-6 text-sm text-muted-foreground">
                Or complete tests first to get additional insights before generating.
              </p>
              <Button variant="outline" className="mt-2" onClick={() => navigate("/dashboard")}>
                Start a Test
              </Button>
            </CardContent>
          </Card>
        ) : (
          <section className="space-y-4">
            {reports.map((report) => {
              const reportData = report.report_data ?? {};
              const theme = reportData?.theme ?? {};
              const keyFindings = Array.isArray(reportData?.key_findings) ? reportData.key_findings : [];
              const traffic = (report.traffic_light as TrafficLight | undefined) || (theme?.trafficLight as TrafficLight | undefined);
              const urgency =
                (report.urgency_level as UrgencyLevel | undefined) || (theme?.urgency as UrgencyLevel | undefined);
              const accentColor = typeof theme?.accentColor === "string" ? theme.accentColor : "#6366F1";
              const summaryText =
                (typeof theme?.summary === "string" && theme.summary.trim().length > 0
                  ? theme.summary.trim()
                  : typeof report.summary === "string" && report.summary.trim().length > 0
                    ? report.summary.trim()
                    : typeof report.risk_assessment === "string"
                      ? report.risk_assessment
                      : "AI-generated vision health summary") ?? "AI-generated vision health summary";
              const badge =
                traffic && TRAFFIC_BADGE_COLORS[traffic]
                  ? TRAFFIC_BADGE_COLORS[traffic]
                  : { bg: "rgba(148,163,184,0.16)", text: "rgb(71,85,105)" };

              return (
                <Card key={report.id} className="transition-transform hover:-translate-y-0.5 hover:shadow-2xl">
                  <CardHeader>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-50">
                          <FileText className="h-5 w-5" style={{ color: accentColor }} />
                          {report.title}
                        </CardTitle>
                        <CardDescription className="mt-2 text-sm leading-relaxed">{summaryText}</CardDescription>
                      </div>
                      <Button size="sm" variant="outline" onClick={generatePDF} disabled={generating}>
                        <Download className="mr-2 h-4 w-4" />
                        Re-generate
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Generated on {new Date(report.created_at).toLocaleDateString()}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em]">
                      {urgency && (
                        <span className="rounded-full bg-slate-900/5 px-3 py-1 text-slate-600 dark:bg-white/10 dark:text-slate-200">
                          Urgency · {String(urgency).replace(/_/g, " ")}
                        </span>
                      )}
                      {traffic && (
                        <span
                          className="rounded-full px-3 py-1"
                          style={{ backgroundColor: badge.bg, color: badge.text }}
                        >
                          Status · {String(traffic).toUpperCase()}
                        </span>
                      )}
                    </div>
                    {keyFindings.length > 0 && (
                      <ul className="mt-4 grid gap-2 text-sm text-slate-600 dark:text-slate-200">
                        {keyFindings.slice(0, 3).map((finding: string, idx: number) => (
                          <li key={idx} className="rounded-xl border border-slate-200/50 bg-white/70 px-3 py-2 dark:border-white/5 dark:bg-slate-950/60">
                            {finding}
                          </li>
                        ))}
                        {keyFindings.length > 3 && (
                          <li className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                            +{keyFindings.length - 3} more insights
                          </li>
                        )}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}
