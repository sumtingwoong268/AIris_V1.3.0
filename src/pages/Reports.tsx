import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Download, FileText, Plus, Sparkles } from "lucide-react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { saveAs } from "file-saver";
import { generateAIReport } from "@/utils/geminiReportGenerator";
import logo from "@/assets/logo.png";
// Helper to safely render HTML (Gemini output)
function GeminiReportHTML({ html }: { html: string }) {
  if (!html) return null;
  return (
    <div
      className="prose max-w-none border rounded-lg bg-white/90 shadow-lg p-6 my-8"
      style={{ overflowX: 'auto' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// Helper to wrap text for PDF
const wrapText = (text: string, maxChars: number): string[] => {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  words.forEach(word => {
    if ((currentLine + word).length <= maxChars) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });
  
  if (currentLine) lines.push(currentLine);
  return lines;
};

export default function Reports() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (user) {
      fetchReports();
    }
  }, [user]);

  const fetchReports = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("reports")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      setReports(data);
    }
  };

  const generatePDF = async () => {
    if (!user) return;
    
    setGenerating(true);
    try {
      // Fetch user profile and test results
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      const { data: results } = await supabase
        .from("test_results")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!profile || !results) {
        throw new Error("Could not fetch data for report");
      }

      // Aggregate latest results by type
      const latestByType: Record<string, any> = {};
      results.forEach((r) => {
        if (!latestByType[r.test_type]) {
          latestByType[r.test_type] = r;
        }
      });

      // Generate AI-powered report
      toast({
        title: "Generating AI Report...",
        description: "Using Gemini AI to analyze your results",
      });
      
      const aiReport = await generateAIReport(profile, latestByType, results);

      // Create PDF
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595, 842]); // A4 size
      const { width, height } = page.getSize();
      
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      let yPosition = height - 50;

      // Header
      page.drawText("AIris Vision Health Report", {
        x: 50,
        y: yPosition,
        size: 24,
        font: boldFont,
        color: rgb(0.2, 0.4, 0.8),
      });
      yPosition -= 30;

      page.drawText(`Generated for: ${profile.display_name || "User"}`, {
        x: 50,
        y: yPosition,
        size: 12,
        font,
        color: rgb(0, 0, 0),
      });
      yPosition -= 18;

      page.drawText(`Date: ${new Date().toLocaleDateString()}`, {
        x: 50,
        y: yPosition,
        size: 12,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
      yPosition -= 40;

      // Profile Stats
      page.drawText("Profile Statistics", {
        x: 50,
        y: yPosition,
        size: 16,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= 25;

      page.drawText(`Total XP: ${profile.xp || 0}`, {
        x: 60,
        y: yPosition,
        size: 12,
        font,
      });
      yPosition -= 18;

      page.drawText(`Level: ${Math.floor((profile.xp || 0) / 100) + 1}`, {
        x: 60,
        y: yPosition,
        size: 12,
        font,
      });
      yPosition -= 18;

      page.drawText(`Weekly Streak: ${profile.current_streak || 0} weeks`, {
        x: 60,
        y: yPosition,
        size: 12,
        font,
      });
      yPosition -= 35;

      // Test Results Summary
      page.drawText("Test Results Summary", {
        x: 50,
        y: yPosition,
        size: 16,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= 25;

      const testLabels: Record<string, string> = {
        ishihara: "Ishihara Color Test",
        acuity: "Visual Acuity Test",
        visual_acuity: "Visual Acuity Test",
        amsler: "Amsler Grid Test",
        reading_stress: "Reading Stress Test",
      };

      // To avoid duplicate rows for visual acuity, track which label keys have been shown
      const shownLabels = new Set<string>();
      Object.entries(testLabels).forEach(([key, label]) => {
        if (shownLabels.has(label)) return;
        // Prefer 'visual_acuity' if present, else 'acuity'
        let result = latestByType[key];
        if (label === "Visual Acuity Test") {
          result = latestByType["visual_acuity"] || latestByType["acuity"];
        }
        const scoreText = result ? `${result.score || 0}%` : "Not taken";
        const dateText = result ? new Date(result.created_at).toLocaleDateString() : "";
        page.drawText(`${label}:`, {
          x: 60,
          y: yPosition,
          size: 12,
          font,
        });
        page.drawText(scoreText, {
          x: 250,
          y: yPosition,
          size: 12,
          font: result ? font : undefined,
          color: result ? (result.score >= 80 ? rgb(0, 0.6, 0) : result.score >= 60 ? rgb(0.8, 0.6, 0) : rgb(0.8, 0, 0)) : rgb(0.6, 0.6, 0.6),
        });
        if (dateText) {
          page.drawText(dateText, {
            x: 350,
            y: yPosition,
            size: 10,
            font,
            color: rgb(0.5, 0.5, 0.5),
          });
        }
        yPosition -= 18;
        shownLabels.add(label);
      });
      yPosition -= 30;

      // AI-Generated Analysis Section
      page.drawText("AI-Powered Analysis", {
        x: 50,
        y: yPosition,
        size: 16,
        font: boldFont,
        color: rgb(0.2, 0.4, 0.8),
      });
      yPosition -= 5;
      
      page.drawText("Generated by Gemini AI", {
        x: 50,
        y: yPosition,
        size: 9,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
      yPosition -= 20;

      // Analysis text
      const analysisLines = aiReport.analysis.split('\n');
      analysisLines.forEach(line => {
        const wrapped = wrapText(line, 75);
        wrapped.forEach(wrappedLine => {
          if (yPosition < 100) {
            const newPage = pdfDoc.addPage([595, 842]);
            yPosition = newPage.getSize().height - 50;
            page.drawText = newPage.drawText.bind(newPage);
          }
          page.drawText(wrappedLine, {
            x: 60,
            y: yPosition,
            size: 10,
            font,
            maxWidth: width - 120,
          });
          yPosition -= 14;
        });
      });
      yPosition -= 20;

      // Clinical Recommendations Section
      if (yPosition < 200) {
        const newPage = pdfDoc.addPage([595, 842]);
        yPosition = newPage.getSize().height - 50;
        page.drawText = newPage.drawText.bind(newPage);
      }

      page.drawText("Clinical Recommendations", {
        x: 50,
        y: yPosition,
        size: 16,
        font: boldFont,
        color: rgb(0.2, 0.4, 0.8),
      });
      yPosition -= 20;

      aiReport.recommendations.forEach((rec, i) => {
        const wrapped = wrapText(rec, 70);
        wrapped.forEach((line, lineIdx) => {
          if (yPosition < 100) {
            const newPage = pdfDoc.addPage([595, 842]);
            yPosition = newPage.getSize().height - 50;
            page.drawText = newPage.drawText.bind(newPage);
          }
          const prefix = lineIdx === 0 ? `${i + 1}. ` : "   ";
          page.drawText(`${prefix}${line}`, {
            x: 60,
            y: yPosition,
            size: 11,
            font,
            maxWidth: width - 120,
          });
          yPosition -= 16;
        });
      });
      yPosition -= 20;

      // Eye Exercises
      if (yPosition < 200) {
        const newPage = pdfDoc.addPage([595, 842]);
        yPosition = newPage.getSize().height - 50;
        page.drawText = newPage.drawText.bind(newPage);
      }

      page.drawText("Recommended Eye Exercises", {
        x: 50,
        y: yPosition,
        size: 16,
        font: boldFont,
        color: rgb(0.2, 0.4, 0.8),
      });
      yPosition -= 20;

      aiReport.exercises.forEach((ex) => {
        const wrapped = wrapText(ex, 70);
        wrapped.forEach((line, idx) => {
          if (yPosition < 100) {
            const newPage = pdfDoc.addPage([595, 842]);
            yPosition = newPage.getSize().height - 50;
            page.drawText = newPage.drawText.bind(newPage);
          }
          const prefix = idx === 0 ? "• " : "  ";
          page.drawText(`${prefix}${line}`, {
            x: 60,
            y: yPosition,
            size: 10,
            font,
            maxWidth: width - 120,
          });
          yPosition -= 14;
        });
      });
      yPosition -= 20;

      // Nutrition Tips
      if (yPosition < 200) {
        const newPage = pdfDoc.addPage([595, 842]);
        yPosition = newPage.getSize().height - 50;
        page.drawText = newPage.drawText.bind(newPage);
      }

      page.drawText("Nutrition for Eye Health", {
        x: 50,
        y: yPosition,
        size: 16,
        font: boldFont,
        color: rgb(0.2, 0.4, 0.8),
      });
      yPosition -= 20;

      aiReport.nutrition.forEach((item) => {
        const wrapped = wrapText(item, 70);
        wrapped.forEach((line, idx) => {
          if (yPosition < 100) {
            const newPage = pdfDoc.addPage([595, 842]);
            yPosition = newPage.getSize().height - 50;
            page.drawText = newPage.drawText.bind(newPage);
          }
          const prefix = idx === 0 ? "• " : "  ";
          page.drawText(`${prefix}${line}`, {
            x: 60,
            y: yPosition,
            size: 10,
            font,
            maxWidth: width - 120,
          });
          yPosition -= 14;
        });
      });
      yPosition -= 30;

      // Urgency Banner
      if (aiReport.urgencyLevel === 'high') {
        if (yPosition < 100) {
          const newPage = pdfDoc.addPage([595, 842]);
          yPosition = newPage.getSize().height - 50;
          page.drawText = newPage.drawText.bind(newPage);
        }

        page.drawText("⚠ URGENT ATTENTION NEEDED", {
          x: 50,
          y: yPosition,
          size: 14,
          font: boldFont,
          color: rgb(0.8, 0, 0),
        });
        yPosition -= 18;
        
        page.drawText("Based on your test results, please schedule a professional eye examination soon.", {
          x: 50,
          y: yPosition,
          size: 10,
          font,
          color: rgb(0.6, 0, 0),
        });
        yPosition -= 30;
      }

      // Disclaimer
      if (yPosition < 150) {
        const newPage = pdfDoc.addPage([595, 842]);
        yPosition = newPage.getSize().height - 50;
        page.drawText = newPage.drawText.bind(newPage);
      }

      page.drawText("Important Disclaimer", {
        x: 50,
        y: yPosition,
        size: 14,
        font: boldFont,
        color: rgb(0.6, 0, 0),
      });
      yPosition -= 20;

      const disclaimer = "This AI-generated report is based on self-administered vision screening tests and is NOT a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of a qualified eye care professional with any questions about your eye health. If you experience sudden vision changes, eye pain, flashes of light, or other concerning symptoms, seek immediate medical attention.";
      const disclaimerWrapped = wrapText(disclaimer, 75);
      disclaimerWrapped.forEach(line => {
        page.drawText(line, {
          x: 50,
          y: yPosition,
          size: 9,
          font,
          color: rgb(0.3, 0.3, 0.3),
          maxWidth: width - 100,
        });
        yPosition -= 12;
      });

      // Footer on all pages
      const pages = pdfDoc.getPages();
      pages.forEach((p, idx) => {
        p.drawText("AIris - The Future of Eyecare | AI-Powered by Gemini", {
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

      // Save PDF
  const pdfBytes = await pdfDoc.save();
  // Ensure compatibility: convert Uint8Array to ArrayBuffer for Blob
  // Convert Uint8Array to a regular array for Blob compatibility
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const fileName = `AIris_Report_${profile.display_name?.replace(/\s/g, "_") || "User"}_${new Date().toISOString().split("T")[0]}.pdf`;
      saveAs(blob, fileName);

      // Save report record to database
      await supabase.from("reports").insert({
        user_id: user.id,
        title: "Vision Health Report",
        summary: `Comprehensive eye health summary generated on ${new Date().toLocaleDateString()}`,
      });

      await fetchReports();

      toast({
        title: "Report generated!",
        description: "Your PDF has been downloaded",
      });
    } catch (error: any) {
      console.error("PDF generation error:", error);
      toast({
        title: "Error generating report",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary-lighter/10 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div 
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate("/dashboard")}
          >
            <img src={logo} alt="AIris" className="h-10" />
            <div className="flex flex-col">
              <span className="text-lg font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                AIris
              </span>
              <span className="text-[10px] text-muted-foreground -mt-1">
                the future of eyecare
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Your Reports</h1>
            <p className="mt-2 text-muted-foreground">
              View and download your vision screening reports
            </p>
          </div>
          <Button onClick={generatePDF} disabled={generating}>
            <Plus className="mr-2 h-4 w-4" />
            {generating ? "Generating..." : "Generate New Report"}
          </Button>
        </div>

        {/* Preview the latest Gemini HTML report if available */}
        {reports.length > 0 && reports[0].analysis && reports[0].analysis.startsWith('<') && (
          <>
            <h2 className="text-2xl font-semibold mb-2 mt-8">Latest AIris Report Preview</h2>
            <GeminiReportHTML html={reports[0].analysis} />
          </>
        )}

        {reports.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="py-16 text-center">
              <FileText className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
              <h3 className="mb-2 text-xl font-semibold">No Reports Yet</h3>
              <p className="text-muted-foreground mb-4">
                Generate your first comprehensive vision health report
              </p>
              <Button onClick={generatePDF} disabled={generating}>
                <Plus className="mr-2 h-4 w-4" />
                {generating ? "Generating..." : "Generate Report"}
              </Button>
              <p className="mt-6 text-sm text-muted-foreground">
                Or complete tests first to get personalized insights
              </p>
              <Button variant="outline" className="mt-2" onClick={() => navigate("/dashboard")}>
                Start a Test
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <Card key={report.id} className="shadow-card transition-all hover:shadow-elevated">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        {report.title}
                      </CardTitle>
                      <CardDescription className="mt-2">{report.summary}</CardDescription>
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
          </div>
        )}
      </main>
    </div>
  );
}
