import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceKey) {
  throw new Error("Missing required Supabase environment variables");
}

const serviceClient = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      res.status(401).json({ error: "Missing authorization header" });
      return;
    }

    const supabaseUserClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: authData, error: authError } = await supabaseUserClient.auth.getUser();
    if (authError || !authData?.user) {
      res.status(401).json({ error: "Invalid or expired session" });
      return;
    }

    const { email } = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
    if (!email || typeof email !== "string") {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    if (email.toLowerCase() === authData.user.email?.toLowerCase()) {
      res.status(400).json({ error: "You cannot add yourself" });
      return;
    }

    const { data: targetUser, error: targetError } = await serviceClient.auth.admin.getUserByEmail(email);
    if (targetError || !targetUser?.user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, display_name")
      .eq("id", targetUser.user.id)
      .maybeSingle();

    if (profileError) {
      res.status(500).json({ error: profileError.message });
      return;
    }

    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    res.status(200).json({ profile: { id: profile.id, display_name: profile.display_name ?? null } });
  } catch (error: any) {
    res.status(500).json({ error: error?.message ?? "Internal Server Error" });
  }
}
