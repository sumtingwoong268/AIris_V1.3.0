# 🤖 OpenAI Integration Guide for AIris Reports

## Overview

AIris now uses OpenAI to generate **truly personalized** vision health reports based on your test results. Instead of predetermined text, OpenAI analyzes your specific scores and provides custom recommendations.

---

## Step 1: Get OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Sign in with your OpenAI account
3. Click **"Create new secret key"**
4. Copy the API key (starts with `sk-...`)

---

## Step 2: Add API Key to Your Project

### Create/Update .env File

1. In your project root, create a file named `.env` (if not exists)
2. Add this line:

```env
VITE_OPENAI_API_KEY=sk-...YOUR_ACTUAL_KEY_HERE
```

### Example .env File

```env
VITE_OPENAI_API_KEY=sk-...YOUR_ACTUAL_KEY_HERE
```

---

## Step 3: Run the App

1. Install dependencies (if not already):
   ```sh
   npm install
   ```
2. Start the development server:
   ```sh
   npm run dev
   ```

---

## Troubleshooting

- If you see errors about missing API keys, double-check your `.env` file and restart the dev server.
- For more help, visit https://platform.openai.com/docs/guides/
