import { generateReport } from "./openaiClient";

interface TestResult {
  test_type: string;
  score: number | null;
  details: any;
  created_at: string;
}

interface Profile {
  display_name: string | null;
  full_name?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  ethnicity?: string | null;
  wears_correction?: string | null;
  correction_type?: string | null;
  last_eye_exam?: string | null;
  screen_time_hours?: string | null;
  outdoor_time_hours?: string | null;
  sleep_quality?: string | null;
  symptoms?: string[] | null;
  eye_conditions?: string[] | null;
  family_history?: string[] | null;
  eye_surgeries?: string | null;
  uses_eye_medication?: boolean | null;
  medication_details?: string | null;
  bio?: string | null;
  xp: number;
  current_streak: number;
}

interface AIReportData {
  analysis: string;
  recommendations: string[];
  exercises: string[];
  nutrition: string[];
  urgencyLevel: 'low' | 'moderate' | 'high';
}

export async function generateAIReport(
  profile: Profile,
  testResults: Record<string, TestResult>,
  testHistory: TestResult[] = []
): Promise<AIReportData> {
  try {
    const demographics = `Demographics & Lifestyle:\n` +
      `- Name: ${profile.display_name || profile.full_name || 'User'}\n` +
      (profile.date_of_birth ? `- Date of Birth: ${profile.date_of_birth}\n` : "") +
      (profile.gender ? `- Gender: ${profile.gender}\n` : "") +
      (profile.ethnicity ? `- Ethnicity: ${profile.ethnicity}\n` : "") +
      (profile.wears_correction ? `- Wears Correction: ${profile.wears_correction}\n` : "") +
      (profile.correction_type ? `- Correction Type: ${profile.correction_type}\n` : "") +
      (profile.last_eye_exam ? `- Last Eye Exam: ${profile.last_eye_exam}\n` : "") +
      (profile.screen_time_hours ? `- Screen Time: ${profile.screen_time_hours} hours/day\n` : "") +
      (profile.outdoor_time_hours ? `- Outdoor Time: ${profile.outdoor_time_hours} hours/day\n` : "") +
      (profile.sleep_quality ? `- Sleep Quality: ${profile.sleep_quality}\n` : "") +
      (profile.eye_surgeries ? `- Eye Surgeries: ${profile.eye_surgeries}\n` : "") +
      (profile.uses_eye_medication ? `- Uses Eye Medication: Yes\n` : "") +
      (profile.medication_details ? `- Medication Details: ${profile.medication_details}\n` : "") +
      (profile.bio ? `- Bio: ${profile.bio}\n` : "");

    const symptoms = profile.symptoms && profile.symptoms.length
      ? `Symptoms: ${profile.symptoms.join(", ")}`
      : "Symptoms: None reported";
    const eyeConditions = profile.eye_conditions && profile.eye_conditions.length
      ? `Known Eye Conditions: ${profile.eye_conditions.join(", ")}`
      : "Known Eye Conditions: None reported";
    const familyHistory = profile.family_history && profile.family_history.length
      ? `Family Eye History: ${profile.family_history.join(", ")}`
      : "Family Eye History: None reported";

    const testSummary = Object.entries(testResults).map(([type, result]) => {
      let details = JSON.stringify(result.details || {});
      return `${type}: ${result.score || 0}% (Details: ${details}, Date: ${new Date(result.created_at).toLocaleDateString()})`;
    }).join("\n");
    const historicalTrends = Object.keys(testResults).map(type => {
      const history = testHistory.filter(t => t.test_type === type);
      if (history.length < 2) return `${type}: Insufficient historical data`;
      const scores = history.map(t => t.score || 0);
      const trend = scores[scores.length - 1] - scores[scores.length - 2];
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      return `${type}: ${history.length} tests, avg ${avgScore.toFixed(1)}%, trend: ${trend > 0 ? '+' : ''}${trend.toFixed(1)}%`;
    }).join("\n");

    const userPrompt = `You are a digital eye-health assistant for the AIris platform. Generate a visually beautiful, modern, and branded report for the user, suitable for display in a web app.\n\n**Branding:**\n- The report should feature the AIris logo at the top (logo file: 'logo.png').\n- Use clear, elegant section headers and a visually pleasing layout.\n- Use color, whitespace, and visual hierarchy to make the report easy to read and aesthetically pleasing.\n- Use callout boxes or highlights for important findings or urgent recommendations.\n\n**Content:**\n- Use all the data provided: demographics, lifestyle, symptoms, test results, and history.\n- Write in clear, professional, and friendly English.\n- Avoid repetition and keep the tone modern and supportive.\n\n**Sections:**\n1. Cover Page\n   - AIris logo\n   - Report title: 'AIris Vision Health Report'\n   - User's name and date\n2. Summary Overview\n   - 2–3 crisp paragraphs summarizing vision status, risk, and trends\n3. Detailed Test Analysis\n   - For each test: score, interpretation, trend, and explanation\n   - Use visual cues (e.g., colored bars, icons, or highlights) for scores and risk\n4. Personalized Self-Care Guidance\n   - Eye exercises (3–5 routines, with instructions)\n   - Lifestyle tips (screen time, sleep, hydration, etc.)\n   - Nutrition advice (key nutrients, foods, and a sample meal plan)\n5. Medical Follow-Up\n   - When to see a professional, and what tests may be needed\n   - Short explanations for each\n6. Long-Term Improvement Plan\n   - Next steps for 3–6 months, habit tracking, and measurable targets\n7. Disclaimers\n   - Standard medical disclaimer\n\n**Format:**\n- Output in HTML5 markup, using semantic tags (section, h1-h3, p, ul, li, etc.)\n- Use inline styles for color, spacing, and highlights (no external CSS).\n- Include an <img> tag for the logo at the top: <img src='logo.png' alt='AIris Logo' style='height:60px;margin-bottom:24px;'>\n- Use <div> or <section> with background color or border for callouts/highlights.\n- Use <hr> to separate major sections.\n- Do NOT use emojis.\n- Make the report visually appealing and easy to scan.\n\n---\n\n### DATASET\n${demographics}${symptoms}\n${eyeConditions}${familyHistory}\n\nCurrent Test Results (Most Recent):\n${testSummary}\n\nHistorical Trends:\n${historicalTrends}`;

    const response = await generateReport({
      prompt: userPrompt,
      userData: { profile, testResults, testHistory }
    });
    const text = response.text || "";
    return parseAIResponse(text);
  } catch (error) {
    console.error("Error generating AI report:", error);
    return generateFallbackReport(profile, testResults);
  }
}

function parseAIResponse(text: string): AIReportData {
  const sections = {
    analysis: '',
    recommendations: [] as string[],
    exercises: [] as string[],
    nutrition: [] as string[],
    urgencyLevel: 'moderate' as 'low' | 'moderate' | 'high'
  };
  try {
    const analysisMatch = text.match(/ANALYSIS:\s*([\s\S]*?)(?=RECOMMENDATIONS:|$)/i);
    const recommendationsMatch = text.match(/RECOMMENDATIONS:\s*([\s\S]*?)(?=EXERCISES:|$)/i);
    const exercisesMatch = text.match(/EXERCISES:\s*([\s\S]*?)(?=NUTRITION:|LIFESTYLE:|$)/i);
    const nutritionMatch = text.match(/NUTRITION:\s*([\s\S]*?)(?=LIFESTYLE:|URGENCY:|$)/i);
    const lifestyleMatch = text.match(/LIFESTYLE:\s*([\s\S]*?)(?=URGENCY:|$)/i);
    const urgencyMatch = text.match(/URGENCY:\s*(\w+)/i);
    let foundSection = false;
    if (analysisMatch) {
      sections.analysis = analysisMatch[1].trim();
      foundSection = true;
    }
    if (recommendationsMatch) {
      const recText = recommendationsMatch[1];
      sections.recommendations = recText
        .split(/\d+\.\s+/)
        .filter(r => r.trim())
        .map(r => r.trim());
      foundSection = true;
    }
    if (exercisesMatch) {
      const exText = exercisesMatch[1];
      sections.exercises = exText
        .split(/\d+\.\s+/)
        .filter(e => e.trim())
        .map(e => e.trim());
      foundSection = true;
    }
    if (nutritionMatch) {
      const nutText = nutritionMatch[1];
      sections.nutrition = nutText
        .split(/\d+\.\s+/)
        .filter(n => n.trim())
        .map(n => n.trim());
      foundSection = true;
    }
    if (lifestyleMatch) {
      const lifeText = lifestyleMatch[1];
      const lifestyleItems = lifeText
        .split(/\d+\.\s+/)
        .filter(l => l.trim())
        .map(l => l.trim());
      sections.recommendations.push(...lifestyleItems);
      foundSection = true;
    }
    if (urgencyMatch) {
      const urgency = urgencyMatch[1].toLowerCase();
      if (urgency === 'low' || urgency === 'moderate' || urgency === 'high') {
        sections.urgencyLevel = urgency;
        foundSection = true;
      }
    }
    if (!foundSection) {
      sections.analysis = text.trim();
    }
  } catch (error) {
    console.error("Error parsing AI response:", error);
    sections.analysis = text.trim();
  }
  return sections;
}

function generateFallbackReport(
  profile: Profile,
  testResults: Record<string, TestResult>
): AIReportData {
  return {
    analysis: "AI report generation is currently unavailable. Please try again later for a personalized, in-depth analysis and recommendations.",
    recommendations: [],
    exercises: [],
    nutrition: [],
    urgencyLevel: 'moderate'
  };
}
