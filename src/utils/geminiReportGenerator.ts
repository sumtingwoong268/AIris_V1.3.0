// Gemini AI Report Generator for AIris
import { GoogleGenerativeAI } from "@google/generative-ai";

interface TestResult {
  test_type: string;
  score: number | null;
  details: any;
  created_at: string;
}

interface Profile {
  display_name: string | null;
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

    // Prepare current test data
    const testSummary = Object.entries(testResults).map(([type, result]) => {
      let details = "";
      
      switch (type) {
        case 'ishihara':
          details = result.details?.subtype 
            ? `Color vision subtype: ${result.details.subtype}` 
            : "No specific subtype detected";
          break;
        case 'acuity':
          details = result.details?.level 
            ? `Visual clarity level: ${result.details.level}` 
            : "Visual clarity assessed";
          break;
        case 'amsler':
          details = result.details?.distortions 
            ? `Distortions detected: ${result.details.distortions.length} points` 
            : "No significant distortions";
          break;
        case 'reading_stress':
          details = result.details?.readabilityThreshold 
            ? `Comfortable reading size: ${result.details.readabilityThreshold}px, Average difficulty: ${result.details.avgDifficulty}/5` 
            : "Reading comfort assessed";
          break;
      }
      
      return `${type}: ${result.score || 0}% (${details}, Date: ${new Date(result.created_at).toLocaleDateString()})`;
    }).join('\n');

    // Prepare historical trend data
    const historicalTrends = Object.keys(testResults).map(type => {
      const history = testHistory.filter(t => t.test_type === type);
      if (history.length < 2) return `${type}: Insufficient historical data`;
      
      const scores = history.map(t => t.score || 0);
      const trend = scores[scores.length - 1] - scores[scores.length - 2];
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      
      return `${type}: ${history.length} tests completed, avg ${avgScore.toFixed(1)}%, trend: ${trend > 0 ? '+' : ''}${trend.toFixed(1)}%`;
    }).join('\n');

    // Create prompt for Gemini
    const prompt = `You are an expert optometrist and vision health specialist with 20+ years of clinical experience. You are creating a comprehensive, detailed personalized vision health report for a patient. This report should be 750-2000 words and provide actionable, evidence-based insights.

**Patient Profile:**
- Name: ${profile.display_name || 'User'}
- Engagement Level: ${profile.current_streak} week testing streak, Level ${Math.floor(profile.xp / 100) + 1}
- Total XP: ${profile.xp}

**Current Test Results (Most Recent):**
${testSummary}

**Historical Trends:**
${historicalTrends}

**Instructions for Report Generation:**

You MUST provide an extensive, detailed report (minimum 750 words, ideally 1000-2000 words) covering ALL of the following sections comprehensively:

1. **DETAILED ANALYSIS (4-6 comprehensive paragraphs):**
   - Explain EACH test result in detail with clinical context
   - Describe what the specific scores indicate about eye function
   - Compare results to normal population ranges
   - Discuss any patterns or correlations between different tests
   - Analyze historical trends if available (improving/declining/stable)
   - Consider the patient's engagement and consistency
   - Explain the physiological mechanisms behind any issues detected
   - Discuss potential underlying causes for suboptimal scores
   - Be thorough and educational - this is the main body of the report

2. **CLINICAL RECOMMENDATIONS (6-10 detailed items):**
   - Severity-based professional care recommendations:
     * 90%+ scores: Maintain current eye health practices, annual checkups
     * 70-89% scores: Schedule comprehensive eye examination within 3-6 months
     * <70% scores: URGENT - Schedule professional evaluation within 2-4 weeks
     * Amsler distortions: IMMEDIATE ophthalmologist consultation
   - Lifestyle modifications specific to test results
   - Workplace/environment adjustments
   - Screen time management strategies
   - Sleep and rest recommendations
   - When to seek emergency care
   - Follow-up testing timeline
   - Preventive measures for family members if hereditary risks detected

3. **PERSONALIZED EYE EXERCISES (8-12 exercises):**
   For EACH exercise provide:
   - Exercise name
   - DETAILED step-by-step instructions (3-5 steps minimum)
   - Exact duration and frequency (e.g., "10 repetitions, 3 times daily")
   - Which specific test result/condition it targets
   - Expected benefits and timeframe
   - Precautions or contraindications
   
   Include exercises for: accommodation, convergence, tracking, peripheral awareness, focusing stamina, eye-hand coordination, relaxation

4. **COMPREHENSIVE NUTRITION PLAN (8-12 nutrients):**
   For EACH nutrient provide:
   - Specific nutrient name and recommended daily amount
   - Detailed explanation of WHY it's critical for eye health (mechanism of action)
   - At least 4-5 specific food sources with serving sizes
   - Supplementation guidance if dietary intake insufficient
   - Which test result/condition it specifically addresses
   
   Cover: Vitamin A, Lutein, Zeaxanthin, Omega-3s, Zinc, Vitamin C, Vitamin E, Beta-carotene, B-complex vitamins, antioxidants

5. **LIFESTYLE & ENVIRONMENTAL RECOMMENDATIONS (5-8 items):**
   - Lighting optimization for different activities
   - Screen ergonomics and blue light management
   - Proper reading distance and posture
   - Outdoor time recommendations
   - UV protection strategies
   - Humidity and air quality considerations
   - Sleep hygiene for eye health

6. **URGENCY ASSESSMENT:**
   Rate as: low / moderate / high
   Provide clear reasoning for the urgency level
   Specify exact timeline for professional consultation

**Formatting Requirements:**
- Use clear section headers as shown below
- Write in professional yet accessible language
- Include specific measurements, percentages, and timelines
- Provide evidence-based information
- Be encouraging but honest about concerns
- Total length: 750-2000 words (err on the longer side)

**Response Format:**

ANALYSIS:
[Write 4-6 detailed, comprehensive paragraphs analyzing all test results, trends, and implications. Each paragraph should be 80-150 words. Total: 400-800 words]

RECOMMENDATIONS:
1. [Detailed recommendation with specific actions and timelines]
2. [Next recommendation]
[Continue for 6-10 items, each 40-60 words]

EXERCISES:
1. [Exercise Name]: [Detailed step-by-step instructions - 50-80 words including duration, frequency, and targeted condition]
2. [Next exercise]
[Continue for 8-12 exercises]

NUTRITION:
1. [Nutrient Name - Daily Amount]: [Detailed explanation of benefits and mechanism - 40-60 words] - Found in: [4-5 specific foods with serving sizes]
2. [Next nutrient]
[Continue for 8-12 nutrients]

LIFESTYLE:
1. [Detailed lifestyle recommendation with reasoning]
2. [Next recommendation]
[Continue for 5-8 items]

URGENCY: [low/moderate/high] - [Explanation and recommended action timeline]

Remember: This report will be given to the patient and potentially their doctor. Be thorough, professional, evidence-based, and compassionate. Aim for 1000-2000 words total.`;

    // Generate content with Gemini
    const result = await model.generateContent(prompt);
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
  const scores = Object.values(testResults).map(r => r.score || 0);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length || 0;
  
  let urgencyLevel: 'low' | 'moderate' | 'high' = 'low';
  if (avgScore < 60) urgencyLevel = 'high';
  else if (avgScore < 80) urgencyLevel = 'moderate';

  return {
    analysis: `Based on your comprehensive vision screening results (average score: ${avgScore.toFixed(1)}%), your eye health shows ${
      avgScore >= 85 ? 'excellent' : avgScore >= 70 ? 'good' : 'concerning'
    } performance across multiple metrics. You've maintained a ${profile.current_streak}-week testing streak, demonstrating strong commitment to monitoring your vision health.`,
    
    recommendations: [
      avgScore >= 85 
        ? "Continue your excellent eye health maintenance routine with regular screenings."
        : avgScore >= 70
        ? "Consider scheduling a comprehensive eye examination with an optometrist."
        : "We recommend seeking professional evaluation soon to address potential vision concerns.",
      "Practice the 20-20-20 rule: every 20 minutes, look at something 20 feet away for 20 seconds.",
      "Ensure adequate lighting for reading and screen work (500-1000 lux recommended).",
      "Maintain a balanced diet rich in eye-healthy nutrients.",
      "Get 7-8 hours of quality sleep to allow eyes to rest and repair.",
    ],
    
    exercises: [
      "Palming: Cup hands over closed eyes for 30 seconds, 3 times daily.",
      "Focus Shifts: Hold finger at arm's length, focus on it, then on distant object. Repeat 10 times.",
      "Figure-8 Tracing: Imagine a large figure-8, trace it with eyes only. 2 minutes, twice daily.",
      "Blink Training: Consciously blink every 3-4 seconds during screen time to prevent dry eyes.",
      "Eye Rolling: Slowly roll eyes in complete circles, 5 times clockwise, 5 times counterclockwise.",
      "Near-Far Focus: Hold object 6 inches from nose, focus for 5 seconds, then switch to distant object for 5 seconds. Repeat 10 times.",
    ],
    
    nutrition: [
      "Vitamin A: Critical for night vision and retinal health - Found in: carrots, sweet potatoes, spinach, liver",
      "Lutein & Zeaxanthin: Protect against macular degeneration - Found in: kale, spinach, eggs, corn, orange peppers",
      "Omega-3 Fatty Acids: Reduce inflammation and dry eye - Found in: salmon, sardines, flaxseed, walnuts, chia seeds",
      "Zinc: Supports vitamin A absorption - Found in: oysters, beef, pumpkin seeds, chickpeas, cashews",
      "Vitamin C: Powerful antioxidant - Found in: citrus fruits, bell peppers, strawberries, broccoli, tomatoes",
      "Vitamin E: Protects eye cells - Found in: almonds, sunflower seeds, avocados, spinach, olive oil",
    ],
    
    urgencyLevel
  };
}
