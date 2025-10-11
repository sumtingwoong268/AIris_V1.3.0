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
import logo from "@/assets/logo.png";

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
        amsler: "Amsler Grid Test",
        reading_stress: "Reading Stress Test",
      };

      Object.entries(testLabels).forEach(([key, label]) => {
        const result = latestByType[key];
        const scoreText = result ? `${result.score || 0}%` : "Not taken";
        
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
          color: result ? rgb(0, 0, 0) : rgb(0.6, 0.6, 0.6),
        });
        
        yPosition -= 18;
      });
      yPosition -= 20;

      // Personalized Recommendations
      page.drawText("Personalized Recommendations", {
        x: 50,
        y: yPosition,
        size: 16,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= 25;

      const insights: string[] = [];

      // Add conditional insights
      const ishihara = latestByType.ishihara;
      if (ishihara && ishihara.score < 80) {
        insights.push("Consider a professional color vision assessment");
        if (ishihara.details?.subtype) {
          insights.push(`Possible ${ishihara.details.subtype} color deficiency detected`);
        }
      }

      const readingStress = latestByType.reading_stress;
      if (readingStress && (readingStress.details?.avgDifficulty || 0) > 3) {
        insights.push("Practice the 20-20-20 rule: Every 20 min, look 20 ft away for 20 sec");
      }

      const acuity = latestByType.acuity;
      if (acuity && acuity.score < 70) {
        insights.push("Consider a professional visual acuity examination");
      }

      if (insights.length === 0) {
        insights.push("Your vision tests show healthy results!");
        insights.push("Continue regular eye health monitoring");
      }

      insights.forEach((insight, i) => {
        const text = `${i + 1}. ${insight}`;
        page.drawText(text, {
          x: 60,
          y: yPosition,
          size: 11,
          font,
          maxWidth: width - 120,
        });
        yPosition -= 16;
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
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= 20;

      const exercises = [
        "Palming: Cup hands over eyes for 30 seconds to relax",
        "Focus shift: Alternate focus between near (10 in) and far (10 ft) objects",
        "Figure-8: Trace an imaginary figure-8 with your eyes",
        "Blink training: Consciously blink every 3-4 seconds while reading",
      ];

      exercises.forEach((ex) => {
        page.drawText(`• ${ex}`, {
          x: 60,
          y: yPosition,
          size: 10,
          font,
          maxWidth: width - 120,
        });
        yPosition -= 14;
      });
      yPosition -= 20;

      // Nutrition Tips
      page.drawText("Nutrition for Eye Health", {
        x: 50,
        y: yPosition,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= 20;

      const nutrition = [
        "Vitamin A: Carrots, sweet potatoes, spinach",
        "Lutein & Zeaxanthin: Leafy greens, eggs, corn",
        "Omega-3: Salmon, tuna, flaxseed, walnuts",
        "Zinc: Oysters, beef, pumpkin seeds, chickpeas",
        "Vitamin C: Citrus fruits, bell peppers, broccoli",
      ];

      nutrition.forEach((item) => {
        page.drawText(`• ${item}`, {
          x: 60,
          y: yPosition,
          size: 10,
          font,
          maxWidth: width - 120,
        });
        yPosition -= 14;
      });

      // Footer
      page.drawText("AIris - The Future of Eyecare", {
        x: 50,
        y: 30,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });

      // Save PDF
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
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
