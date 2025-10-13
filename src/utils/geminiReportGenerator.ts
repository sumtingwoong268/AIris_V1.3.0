// OpenAI Report Generator for AIris

import { openai } from "./openaiClient";

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
