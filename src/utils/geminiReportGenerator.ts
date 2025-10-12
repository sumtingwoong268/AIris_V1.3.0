// Gemini AI Report Generator for AIris

import { GoogleGenerativeAI } from "@google/generative-ai";

interface TestResult {
  test_type: string;
  score: number | null;
  details: any;
  created_at: string;
}


// Expanded profile type for all demographics/lifestyle/symptoms
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
  // Get API key from environment
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Gemini API key not found. Using fallback report.");
    return generateFallbackReport(profile, testResults);
  }
  try {
    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // Compose all user data for the prompt
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

    // Prepare test results and history
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

    // --- USER PROMPT INJECTION ---
    const userPrompt = `You are a digital eye-health assistant that generates detailed, personalized reports from quantitative and qualitative vision-screening data.\n\nUse the complete dataset provided below, including:\n- current test results and scores,\n- previous test results and their trend,\n- demographic and lifestyle data (age, gender, screen time, outdoor time, nutrition habits, corrective lenses, etc.),\n- symptom responses (blurred vision, dryness, glare, headaches, color confusion, etc.).\n\nWrite a structured report in clear professional English. Do not use emojis or informal language. Keep tone objective, clinical, and easy to understand. Avoid repetition.\n\n---\n\n### DATASET\n${demographics}${symptoms}\n${eyeConditions}\n${familyHistory}\n\nCurrent Test Results (Most Recent):\n${testSummary}\n\nHistorical Trends:\n${historicalTrends}\n\n---\n\n### Report Requirements\n\n**1. Summary Overview**\n- Summarize the user's overall vision status in 2–3 crisp paragraphs.\n- Mention the total health score, risk level, and the direction of change from previous results (improved / stable / declined).\n- Explain briefly what the main findings indicate about visual acuity, color perception, macular or retinal health, and general eye function.\n\n**2. Detailed Test Analysis**\nFor each test completed (for example: visual_acuity, amsler_grid, color_vision, contrast_sensitivity, refraction, reaction_time, etc.):\n- State the current score and its interpretation.\n- Compare it with previous scores and highlight any improvement or deterioration.\n- Explain, in simple but precise language, what the score reveals about that specific visual function.\n- If abnormalities are found, describe possible causes or mechanisms (e.g., macular stress, uncorrected refractive error, eye-strain, early AMD patterns).\n\n**3. Personalised Self-Care Guidance**\nProvide actionable steps that the user can follow independently, tailored to their data:\n- **Eye exercises**: give 3–5 specific routines (palming, near-far focusing, figure-eight tracking, blinking intervals, etc.), each with short instructions and daily frequency.\n- **Lifestyle adjustments**: screen-time management, lighting, sleep, hydration, air quality, and UV protection.\n- **Nutrition**: list key vitamins and nutrients (A, C, E, lutein, zeaxanthin, omega-3) and foods containing them. Suggest a sample one-day meal plan supporting eye health.\n\n**4. Medical Follow-Up**\n- Clearly state whether a professional examination is advised (e.g., “routine check in 6 months” or “consult ophthalmologist soon”).\n- Describe what additional diagnostic tests or imaging (OCT, refraction, slit-lamp, etc.) may be useful based on current findings.\n- Provide a short explanation of what these tests assess and why they are relevant for this user.\n\n**5. Long-Term Improvement Plan**\n- Offer realistic next steps for the next 3–6 months, including re-testing frequency.\n- Recommend habit-tracking metrics (daily breaks, lighting setup, exercise frequency, nutrition adherence).\n- Summarize measurable targets (for example: maintain acuity ≥80%, reduce Amsler distortions, improve comfort score).\n\n**6. Disclaimers**\nEnd with a neutral statement clarifying that the report is informational and not a substitute for professional diagnosis or treatment.\n\n---\n\n### Output Format\nProduce a long, continuous text with section headings:\n1. Summary Overview  \n2. Detailed Test Analysis  \n3. Personalised Self-Care Guidance  \n4. Medical Follow-Up  \n5. Long-Term Improvement Plan  \n6. Disclaimers  \n\nNo bullet icons, emojis, or stylistic punctuation. Use plain text with standard capitalization.`;

    // Generate content with Gemini
    const result = await model.generateContent(userPrompt);
    const response = await result.response;
    const text = response.text();
    // Parse the AI response
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
    // Extract sections using markers
    const analysisMatch = text.match(/ANALYSIS:\s*([\s\S]*?)(?=RECOMMENDATIONS:|$)/i);
    const recommendationsMatch = text.match(/RECOMMENDATIONS:\s*([\s\S]*?)(?=EXERCISES:|$)/i);
    const exercisesMatch = text.match(/EXERCISES:\s*([\s\S]*?)(?=NUTRITION:|LIFESTYLE:|$)/i);
    const nutritionMatch = text.match(/NUTRITION:\s*([\s\S]*?)(?=LIFESTYLE:|URGENCY:|$)/i);
    const lifestyleMatch = text.match(/LIFESTYLE:\s*([\s\S]*?)(?=URGENCY:|$)/i);
    const urgencyMatch = text.match(/URGENCY:\s*(\w+)/i);

    // Parse analysis
    if (analysisMatch) {
      sections.analysis = analysisMatch[1].trim();
    }

    // Parse recommendations
    if (recommendationsMatch) {
      const recText = recommendationsMatch[1];
      sections.recommendations = recText
        .split(/\d+\.\s+/)
        .filter(r => r.trim())
        .map(r => r.trim());
    }

    // Parse exercises
    if (exercisesMatch) {
      const exText = exercisesMatch[1];
      sections.exercises = exText
        .split(/\d+\.\s+/)
        .filter(e => e.trim())
        .map(e => e.trim());
    }

    // Parse nutrition
    if (nutritionMatch) {
      const nutText = nutritionMatch[1];
      sections.nutrition = nutText
        .split(/\d+\.\s+/)
        .filter(n => n.trim())
        .map(n => n.trim());
    }

    // Parse lifestyle (append to recommendations)
    if (lifestyleMatch) {
      const lifeText = lifestyleMatch[1];
      const lifestyleItems = lifeText
        .split(/\d+\.\s+/)
        .filter(l => l.trim())
        .map(l => l.trim());
      sections.recommendations.push(...lifestyleItems);
    }

    // Parse urgency
    if (urgencyMatch) {
      const urgency = urgencyMatch[1].toLowerCase();
      if (urgency === 'low' || urgency === 'moderate' || urgency === 'high') {
        sections.urgencyLevel = urgency;
      }
    }

  } catch (error) {
    console.error("Error parsing AI response:", error);
  }

  return sections;
}

function generateFallbackReport(
  profile: Profile,
  testResults: Record<string, TestResult>
): AIReportData {
  // Fallback report when AI is unavailable
  return {
    analysis: "AI report generation is currently unavailable. Please try again later for a personalized, in-depth analysis and recommendations.",
    recommendations: [],
    exercises: [],
    nutrition: [],
    urgencyLevel: 'moderate'
  };
}
