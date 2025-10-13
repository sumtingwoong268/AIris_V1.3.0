# ☀️ Gemini Integration Guide for AIris Reports

AIris now uses **Google Gemini** to generate fully personalized vision-health reports. Every sentence of the report is AI-crafted from your data—no boilerplate text—so correct setup is essential.

## Step 1: Get a Gemini API Key
1. Visit the [Google AI Studio](https://aistudio.google.com/app/apikey).  
2. Sign in with your Google account (or create one).  
3. Click **Create API key** and copy the value. Keep it safe—you'll use it in your environment variables.

## Step 2: Configure Environment Variables
Add the key to your project or hosting provider:

```bash
# .env.local (never commit this file)
GEMINI_API_KEY="your-super-secret-key"
```

If you deploy to Vercel, Netlify, Render, etc., set the same `GEMINI_API_KEY` in their dashboard.

## Step 3: Install Dependencies (if running locally)
We already ship with `@google/generative-ai`. If you ever need to reinstall, run:

```bash
npm install @google/generative-ai
```

## Step 4: Generate a Report
1. Log in to AIris.
2. Visit the **Reports** page.
3. Click **Generate New Report**.

Gemini will ingest every available data point—demographics, history, test scores, progression—and produce a rich HTML report that matches the AIris aesthetic. The same AI-generated content is used both for the on-page preview and the downloadable PDF.

## Troubleshooting
- **Blank report**: Confirm `GEMINI_API_KEY` is set in your environment and that the key has not expired.
- **429 / quota errors**: Your Gemini quota may be exhausted; visit Google AI Studio to review usage or upgrade your plan.
- **Security**: Never commit API keys to source control. Rotate keys if you suspect compromise.

With Gemini in place, every report is generated end-to-end by AI using your users' unique data. Enjoy the upgrade! 🎉
