# 🤖 Gemini AI Integration Guide for AIris Reports

## Overview

AIris now uses Google's Gemini AI to generate **truly personalized** vision health reports based on your test results. Instead of predetermined text, Gemini analyzes your specific scores and provides custom recommendations.

---

## Step 1: Get Gemini API Key

### Method 1: Google AI Studio (Easiest)
1. Go to https://makersuite.google.com/app/apikey
2. Sign in with your Google account
3. Click **"Get API key"** or **"Create API key"**
4. Select **"Create API key in new project"** (or use existing project)
5. Copy the API key (starts with `AIzaSy...`)

### Method 2: Google Cloud Console (Advanced)
1. Go to https://console.cloud.google.com
2. Create a new project or select existing
3. Enable the **"Generative Language API"**
4. Go to **Credentials** → **Create Credentials** → **API Key**
5. Copy the API key

---

## Step 2: Add API Key to Your Project

### Create/Update .env File

1. In your project root, create a file named `.env` (if not exists)
2. Add this line:

```env
VITE_GEMINI_API_KEY=AIzaSy...YOUR_ACTUAL_KEY_HERE
```

### Example .env File

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Gemini AI (for AI-powered reports)
VITE_GEMINI_API_KEY=AIzaSyAbCdEf1234567890

```

### Important Notes:
- ⚠️ **Never commit `.env` to git** (it's already in `.gitignore`)
- Use `.env.example` as a template (safe to commit)
- Restart dev server after adding/changing environment variables

---

## Step 3: Restart Development Server

After adding the API key, restart your server:

```bash
# Stop server (Ctrl+C)
# Then restart:
npm run dev
# or
bun run dev
```

---

## Step 4: Test AI Report Generation

1. Login to AIris
2. Complete at least 2-3 tests (Ishihara, Reading Stress, etc.)
3. Go to **Reports** page
4. Click **"Generate New Report"**
5. Wait for "Generating AI Report..." toast
6. PDF should download with AI-generated content

---

## What Gemini AI Does

### Input Data Sent to Gemini:
- Test types and scores (e.g., "Ishihara: 85%")
- Test details (subtype, difficulty levels, etc.)
- User engagement (streak, level)
- User's display name

### Gemini Generates:
1. **Detailed Analysis** (2-3 paragraphs)
   - Explains what scores mean
   - Test-specific insights
   - Engagement recognition

2. **Clinical Recommendations** (4-6 items)
   - Severity-based suggestions
   - Professional consultation timing
   - Maintenance advice

3. **Personalized Exercises** (5-7 exercises)
   - Tailored to test results
   - Detailed instructions
   - Duration/reps included

4. **Nutrition Advice** (5-7 nutrients)
   - Specific to eye health needs
   - Why each nutrient matters
   - Food sources listed

5. **Urgency Assessment**
   - Low: Maintain current practices
   - Moderate: Consider check-up
   - High: Seek professional care soon

---

## Fallback Behavior

If Gemini API key is missing or API fails:
- Reports still generate (won't fail)
- Uses intelligent fallback content
- Based on test scores
- Still personalized to degree

**You'll see**: "Gemini API key not found. Using fallback report." in console

---

## Example AI-Generated Report

### Without AI (Old):
> "Consider a professional color vision assessment."
> "Practice the 20-20-20 rule."

### With Gemini AI (New):
> "Your Ishihara color test score of 78% suggests mild red-green color vision deficiency, likely deuteranomaly. This is common, affecting approximately 5% of males, and typically doesn't impair daily activities significantly. However, certain career paths requiring precise color discrimination may require additional consideration. Your excellent 5-week testing streak demonstrates proactive health monitoring, which is commendable.
> 
> Given your moderate Ishihara performance combined with your high visual acuity (92%), we recommend scheduling a comprehensive color vision assessment with an optometrist who can perform more detailed tests like the Farnsworth-Munsell 100 Hue test. This will provide definitive diagnosis and help you understand any practical implications.
> 
> For your reading stress test results showing difficulty below 14px font size, consider..."

---

## API Usage & Costs

### Gemini Pro Pricing (as of 2024):
- **Free tier**: 60 requests per minute
- **Pay-as-you-go**: $0.00025 per 1K characters (input)
- **Cost per report**: ~$0.001-0.002 (very cheap!)

### Monthly Estimates:
- 100 reports/month: ~$0.10-0.20
- 1000 reports/month: ~$1-2
- Free tier easily handles personal use

---

## Troubleshooting

### Issue: "Gemini API key not found"
**Solution**: 
- Check `.env` file exists in project root
- Verify key is named exactly `VITE_GEMINI_API_KEY`
- Restart dev server
- Check browser console for detailed errors

### Issue: "API request failed"
**Solution**:
- Verify API key is correct (copy-paste from Google AI Studio)
- Check API key is enabled for "Generative Language API"
- Check internet connection
- Verify no firewall blocking https://generativelanguage.googleapis.com

### Issue: Reports generate but not personalized
**Solution**:
- Check browser console for "Using fallback report" message
- Verify Gemini API key is set and valid
- Check network tab in DevTools for API calls
- If API call fails, check error response

### Issue: Slow report generation
**Solution**:
- Gemini API typically responds in 2-5 seconds
- If slower, check internet connection
- Free tier has rate limits (60/min)
- Consider using paid tier for high volume

---

## Security Best Practices

### DO:
- ✅ Keep API keys in `.env` files
- ✅ Use environment variables (`import.meta.env.VITE_...`)
- ✅ Add `.env` to `.gitignore`
- ✅ Use separate keys for dev/production
- ✅ Rotate keys periodically

### DON'T:
- ❌ Commit API keys to git
- ❌ Share API keys in screenshots
- ❌ Use production keys in development
- ❌ Hardcode keys in source code
- ❌ Expose keys in client-side code (they're safe in Vite VITE_ prefix)

---

## Advanced: Customizing AI Prompts

Want to customize how Gemini analyzes results?

Edit: `src/utils/geminiReportGenerator.ts`

### Prompt Structure:
```typescript
const prompt = `You are an expert optometrist...

**Patient Profile:**
- Name: ${profile.display_name}
- Engagement: ${profile.current_streak} weeks

**Test Results:**
${testSummary}

**Instructions:**
1. Provide analysis (2-3 paragraphs)
2. Give 4-6 recommendations
...
`;
```

### Customization Ideas:
- Change AI personality (more/less formal)
- Adjust recommendation count
- Add specific medical guidelines
- Include more/less technical terms
- Focus on specific conditions

---

## Testing Checklist

- [ ] API key added to `.env`
- [ ] Dev server restarted
- [ ] At least 2 tests completed
- [ ] Report generates successfully
- [ ] PDF downloads and opens
- [ ] AI analysis section present
- [ ] Recommendations are specific to scores
- [ ] Exercises are detailed
- [ ] Nutrition includes food sources
- [ ] Urgency level makes sense
- [ ] "AI-Powered by Gemini" in footer

---

## FAQ

**Q: Is my data sent to Google?**
A: Yes, test scores and basic info are sent to Gemini API to generate personalized reports. No personal health information beyond test scores is shared.

**Q: Can I use this offline?**
A: No, AI report generation requires internet. Fallback reports work offline.

**Q: What if I don't want AI reports?**
A: Remove the API key from `.env` and reports will use intelligent fallback content.

**Q: Can I use other AI models?**
A: Yes! You can modify `geminiReportGenerator.ts` to use OpenAI, Claude, etc. The structure is adaptable.

**Q: Is this HIPAA compliant?**
A: Gemini API is not HIPAA-compliant by default. For medical use, consult with Google Cloud for HIPAA BAA.

---

## Support

### Getting Help:
1. Check browser console for errors
2. Verify environment variables
3. Test with fallback (remove API key temporarily)
4. Check Gemini API status: https://status.cloud.google.com/

### Useful Links:
- Gemini API Docs: https://ai.google.dev/docs
- Google AI Studio: https://makersuite.google.com
- Pricing: https://ai.google.dev/pricing
- API Status: https://status.cloud.google.com/

---

**You're all set!** 🚀 

Your reports are now powered by cutting-edge AI, providing truly personalized vision health insights.
