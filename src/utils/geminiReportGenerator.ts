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
  testResults: Record<string, TestResult>
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

    // Prepare test data for AI
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
      
      return `${type}: ${result.score || 0}% (${details})`;
    }).join('\n');

    // Create prompt for Gemini
    const prompt = `You are an expert optometrist and vision health specialist. Analyze the following vision screening test results and provide a detailed, personalized report.

**Patient Profile:**
- Name: ${profile.display_name || 'User'}
- Engagement Level: ${profile.current_streak} week streak, Level ${Math.floor(profile.xp / 100) + 1}

**Test Results:**
${testSummary}

**Instructions:**
1. Provide a comprehensive analysis (2-3 paragraphs) explaining what these results mean for the patient's eye health. Be specific about each test.

2. Give 4-6 clinical recommendations based on the severity:
   - If scores are 90%+: maintenance recommendations
   - If scores are 70-89%: suggest professional consultation
   - If scores are <70%: recommend urgent evaluation
   - For Amsler test with distortions: URGENT care needed
   - Consider the patient's engagement level

3. Recommend 5-7 specific eye exercises tailored to their test results. Include:
   - Exercise name
   - Detailed instructions
   - Duration/repetitions
   - Which test result it addresses

4. Provide 5-7 nutrition recommendations with:
   - Specific nutrient names
   - Why it's important for eye health
   - Food sources (at least 3 per nutrient)

5. Assess urgency level (low, moderate, or high) based on scores

**Format your response EXACTLY like this:**

ANALYSIS:
[Your detailed analysis here - 2-3 paragraphs]

RECOMMENDATIONS:
1. [First recommendation]
2. [Second recommendation]
[etc.]

EXERCISES:
1. [Exercise name]: [Detailed instructions with duration]
2. [Exercise name]: [Detailed instructions with duration]
[etc.]

NUTRITION:
1. [Nutrient name]: [Why important] - Found in: [foods]
2. [Nutrient name]: [Why important] - Found in: [foods]
[etc.]

URGENCY: [low/moderate/high]

Be professional, compassionate, and evidence-based. Use medical terminology where appropriate but explain it in accessible language.`;

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
    const exercisesMatch = text.match(/EXERCISES:\s*([\s\S]*?)(?=NUTRITION:|$)/i);
    const nutritionMatch = text.match(/NUTRITION:\s*([\s\S]*?)(?=URGENCY:|$)/i);
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
