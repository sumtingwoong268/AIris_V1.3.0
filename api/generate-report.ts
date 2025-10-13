// api/generate-report.ts
import OpenAI from "openai";

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch {}
    }

    const { prompt, userData } = body || {};
    if (typeof prompt !== "string" || !prompt.trim()) {
      res.status(400).send("Missing prompt");
      return;
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: "You generate clear, detailed eye-health reports." },
        { role: "user", content: prompt }
      ]
    });

    const text = completion.choices?.[0]?.message?.content ?? "";
    res.status(200).json({ text, meta: { ok: true, len: text.length, hasUserData: Boolean(userData) } });
  } catch (err: any) {
    console.error("generate-report error:", err);
    res.status(500).send(err?.message || "Internal Server Error");
  }
}
