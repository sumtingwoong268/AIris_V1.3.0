// src/pages/Reports.tsx
import { useEffect, useState } from "react";
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

  const chronologicalHistory = (type: string) =>
    results
      .filter((entry) => entry.test_type === type)
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  Object.entries(latestByType).forEach(([testType, latest]) => {
    const history = chronologicalHistory(testType).map((item) => ({
      score: item.score ?? null,
      created_at: item.created_at,
      details: item.details ?? null,
      xp_earned: item.xp_earned ?? null,
    }));
    const latestScore = latest?.score ?? null;
    const previousScore = history.length >= 2 ? history[history.length - 2].score : null;
    const trend =
      latestScore !== null && previousScore !== null
        ? Number((latestScore - previousScore).toFixed(2))
        : null;

    tests[testType] = {
      current: {
        score: latestScore,
        created_at: latest?.created_at ?? null,
        details: latest?.details ?? null,
      },
      previousScore,
      trend,
      history,
    };
  });

  const allCurrentScores = Object.values(latestByType)
    .map((entry) => (typeof entry?.score === "number" ? entry.score : null))
    .filter((value): value is number => value !== null);

  const overallScore =
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

  let riskLevel: "Low" | "Moderate" | "High" | "Unknown" = "Unknown";
  if (overallScore !== null) {
    riskLevel = overallScore >= 80 ? "Low" : overallScore >= 60 ? "Moderate" : "High";
  }

  const trendOverall =
    overallScore !== null && previousAverage !== null
      ? Number((overallScore - previousAverage).toFixed(2))
      : null;

  const age = calculateAge(profile.date_of_birth ?? null);

  const symptoms = Array.isArray(profile.symptoms) ? profile.symptoms : [];
  const eyeConditions = Array.isArray(profile.eye_conditions) ? profile.eye_conditions : [];
  const familyHistory = Array.isArray(profile.family_history) ? profile.family_history : [];

  return {
    generated_at: new Date().toISOString(),
    user: {
      name: profile.display_name || profile.full_name || "User",
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
      overall_score: overallScore,
      previous_average_score: previousAverage,
      overall_trend: trendOverall,
      risk_level: riskLevel,
      tests_completed: Object.keys(latestByType).length,
    },
    tests,
    history: results.map((entry) => ({
      test_type: entry.test_type,
      score: entry.score ?? null,
      created_at: entry.created_at,
      details: entry.details ?? null,
      xp_earned: entry.xp_earned ?? null,
    })),
  };
}

export default function Reports() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const latestReport = reports[0];
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

      let y = height - 50;

      page.drawText("AIris Vision Health Report", {
        x: 50,
        y,
        size: 24,
        font: bold,
        color: rgb(0.2, 0.4, 0.8),
      });
      y -= 30;

      const displayName = dataset.user?.name ?? profile.display_name ?? "User";
      const generatedDate = new Date().toLocaleDateString();

      page.drawText(`Generated for: ${displayName}`, {
        x: 50,
        y,
        size: 12,
        font,
        color: rgb(0, 0, 0),
      });
      y -= 18;

      page.drawText(`Date: ${generatedDate}`, {
        x: 50,
        y,
        size: 12,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
      y -= 28;

      const sanitized = aiReportText
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<li>/gi, "• ")
        .replace(/<\/(p|div|section|article)>/gi, "\n\n")
        .replace(/<\/(h[1-6])>/gi, "\n")
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      const analysisLines = sanitized
        .split("\n")
        .map((line) => line.trim())
        .flatMap((line) => (line ? wrapText(line, 90) : [""]));

      const summarySnippetSource = sanitized.replace(/\s+/g, " ").trim();
      const summarySnippet =
        summarySnippetSource.length > 220
          ? `${summarySnippetSource.slice(0, 220).trim()}…`
          : summarySnippetSource;

      for (const line of analysisLines) {
        if (y < 80) {
          page = pdfDoc.addPage([595, 842]);
          y = page.getSize().height - 50;
        }
        if (!line) {
          y -= 12;
          continue;
        }
        page.drawText(line, {
          x: 50,
          y,
          size: 10,
          font,
          maxWidth: width - 100,
          color: rgb(0.1, 0.1, 0.1),
        });
        y -= 14;
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
const fileName = `AIris_Report_${(profile.display_name ?? "User")
  .replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;
saveAs(blob, fileName);

// ✅ Single insert only (remove any earlier duplicate insert)
{
  const { error: insertError } = await supabase.from("reports").insert({
    user_id: user.id,
    title: "Vision Health Report",
    summary: summarySnippet || `AI-generated report created on ${generatedDate}`,
    analysis: aiReportText,
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

        {reports.length > 0 && latestReport?.analysis && (
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Latest AIris report preview</h2>
            {String(latestReport.analysis).trim().startsWith("<") ? (
              <AIReportHTML html={String(latestReport.analysis)} />
            ) : (
              <div className="rounded-3xl border border-white/60 bg-white/80 p-6 text-sm leading-relaxed shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-900/70">
                {String(latestReport.analysis)}
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
            {reports.map((report) => (
              <Card key={report.id} className="transition-transform hover:-translate-y-0.5 hover:shadow-2xl">
                <CardHeader>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-50">
                        <FileText className="h-5 w-5 text-primary" />
                        {report.title}
                      </CardTitle>
                      <CardDescription className="mt-2 text-sm leading-relaxed">{report.summary}</CardDescription>
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
                </CardContent>
              </Card>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
