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
import { generateReport } from "@/utils/openaiClient";
import logo from "@/assets/logo.png";

function OpenAIReportHTML({ html }: { html: string }) {
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


      // 3) Build prompt (closed correctly)
const testSummary = Object.entries(latestByType)
  .map(([type, result]) => {
    const score = result?.score ?? 0;
    const when = result?.created_at ? new Date(result.created_at).toLocaleDateString() : "";
    const details = result?.details ? JSON.stringify(result.details) : "{}";
    return `${type}: ${score}% (Details: ${details}, Date: ${when})`;
  })
  .join("\n");

const prompt = `
You are a digital eye-health assistant for the AIris platform. Generate a visually clean, long, clinically-aligned report. No emojis.

User:
- Name: ${profile.display_name || profile.full_name || "User"}
${profile.date_of_birth ? `- Date of Birth: ${profile.date_of_birth}\n` : ""}${profile.gender ? `- Gender: ${profile.gender}\n` : ""}${profile.wears_correction ? `- Wears Correction: ${profile.wears_correction}\n` : ""}${profile.correction_type ? `- Correction Type: ${profile.correction_type}\n` : ""}${profile.last_eye_exam ? `- Last Eye Exam: ${profile.last_eye_exam}\n` : ""}${profile.screen_time_hours ? `- Screen Time: ${profile.screen_time_hours} hours/day\n` : ""}${profile.outdoor_time_hours ? `- Outdoor Time: ${profile.outdoor_time_hours} hours/day\n` : ""}${profile.sleep_quality ? `- Sleep Quality: ${profile.sleep_quality}\n` : ""}

Symptoms: ${(profile.symptoms && profile.symptoms.length) ? profile.symptoms.join(", ") : "None reported"}
Known Eye Conditions: ${(profile.eye_conditions && profile.eye_conditions.length) ? profile.eye_conditions.join(", ") : "None reported"}
Family Eye History: ${(profile.family_history && profile.family_history.length) ? profile.family_history.join(", ") : "None reported"}

Current Test Results (most recent):
${testSummary}

Output as plain paragraphs and lists (HTML allowed). Sections:
1. Summary Overview
2. Detailed Test Analysis
3. Personalised Self-Care Guidance (exercises, lifestyle, nutrition)
4. Medical Follow-Up
5. Long-Term Improvement Plan
6. Disclaimers
`.trim();

      // 4) AI analysis (serverless)
      toast({ title: "Generating AI Report...", description: "Analyzing your results" });
      const { text: aiReportText } = await generateReport({
        prompt,
        userData: { profile, testResults: latestByType, testHistory: results },
      });

      // 5) PDF build
      const pdfDoc = await PDFDocument.create();
      let page = pdfDoc.addPage([595, 842]); // A4
      const { width, height } = page.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      let y = height - 50;

      // Header
      page.drawText("AIris Vision Health Report", {
        x: 50,
        y,
        size: 24,
        font: bold,
        color: rgb(0.2, 0.4, 0.8),
      });
      y -= 30;

      page.drawText(`Generated for: ${profile.display_name || "User"}`, {
        x: 50,
        y,
        size: 12,
        font,
        color: rgb(0, 0, 0),
      });
      y -= 18;

      page.drawText(`Date: ${new Date().toLocaleDateString()}`, {
        x: 50,
        y,
        size: 12,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
      y -= 40;

      // Stats
      page.drawText("Profile Statistics", { x: 50, y, size: 16, font: bold, color: rgb(0, 0, 0) });
      y -= 25;
      page.drawText(`Total XP: ${profile.xp || 0}`, { x: 60, y, size: 12, font }); y -= 18;
      page.drawText(`Level: ${Math.floor((profile.xp || 0) / 100) + 1}`, { x: 60, y, size: 12, font }); y -= 18;
      page.drawText(`Weekly Streak: ${profile.current_streak || 0} weeks`, { x: 60, y, size: 12, font }); y -= 35;

      // Results summary
      page.drawText("Test Results Summary", { x: 50, y, size: 16, font: bold, color: rgb(0, 0, 0) });
      y -= 25;

      const testLabels: Record<string, string> = {
        ishihara: "Ishihara Color Test",
        visual_acuity: "Visual Acuity Test",
        acuity: "Visual Acuity Test",
        amsler: "Amsler Grid Test",
        reading_stress: "Reading Stress Test",
      };
      const used = new Set<string>();
      for (const [key, label] of Object.entries(testLabels)) {
        if (used.has(label)) continue;
        let result = latestByType[key];
        if (label === "Visual Acuity Test") {
          result = latestByType["visual_acuity"] || latestByType["acuity"];
        }
        const scoreText = result ? `${result.score ?? 0}%` : "Not taken";
        const dateText = result?.created_at ? new Date(result.created_at).toLocaleDateString() : "";

        page.drawText(`${label}:`, { x: 60, y, size: 12, font });
        page.drawText(scoreText, {
          x: 250,
          y,
          size: 12,
          font,
          color: result
            ? (result.score >= 80 ? rgb(0, 0.6, 0) : result.score >= 60 ? rgb(0.8, 0.6, 0) : rgb(0.8, 0, 0))
            : rgb(0.6, 0.6, 0.6),
        });
        if (dateText) {
          page.drawText(dateText, { x: 350, y, size: 10, font, color: rgb(0.5, 0.5, 0.5) });
        }
        y -= 18;
        used.add(label);
      }
      y -= 30;

// AI Analysis
page.drawText("AI-Powered Analysis", { x: 50, y, size: 16, font: bold, color: rgb(0.2, 0.4, 0.8) });
y -= 5;
page.drawText("Generated by OpenAI", { x: 50, y, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
y -= 20;

const plainAnalysis = (aiReportText || "").replace(/<[^>]*>/g, "");
const analysisLines = plainAnalysis.split("\n").flatMap((line) => wrapText(line.trim(), 75));
for (const line of analysisLines) {
  if (y < 100) {
    page = pdfDoc.addPage([595, 842]);
    y = page.getSize().height - 50;
  }
  page.drawText(line, { x: 60, y, size: 10, font, maxWidth: width - 120 });
  y -= 14;
}

// Disclaimer
if (y < 150) {
  page = pdfDoc.addPage([595, 842]);
  y = page.getSize().height - 50;
}
page.drawText("Important Disclaimer", { x: 50, y, size: 14, font: bold, color: rgb(0.6, 0, 0) });
y -= 20;

const disclaimer =
  "This AI-generated report is based on self-administered vision screening tests and is NOT a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of a qualified eye care professional with any questions about your eye health. If you experience sudden vision changes, eye pain, flashes of light, or other concerning symptoms, seek immediate medical attention.";
for (const line of wrapText(disclaimer, 75)) {
  page.drawText(line, { x: 50, y, size: 9, font, color: rgb(0.3, 0.3, 0.3), maxWidth: width - 100 });
  y -= 12;
}

// Footer
const pages = pdfDoc.getPages();
pages.forEach((p, idx) => {
  p.drawText("AIris - The Future of Eyecare | AI-Powered by OpenAI", {
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
    summary: `Comprehensive eye health summary generated on ${new Date().toLocaleDateString()}`,
    analysis: aiReportText, // keep AI HTML/plain for web preview
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

        {reports.length > 0 && latestReport?.analysis && String(latestReport.analysis).startsWith("<") && (
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Latest AIris report preview</h2>
            <OpenAIReportHTML html={String(latestReport.analysis)} />
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
