import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

    if (!supabaseUrl || !anonKey || !serviceKey) {
      console.error("lookup-user missing env vars", { hasUrl: !!supabaseUrl, hasAnon: !!anonKey, hasService: !!serviceKey });
      res.status(500).json({ error: "Server missing Supabase credentials" });
      return;
    }

    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const supabaseUserClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: authData, error: authError } = await supabaseUserClient.auth.getUser();
    if (authError) {
      console.error("lookup-user auth error:", authError);
    }
    if (authError || !authData?.user) {
      res.status(401).json({ error: "Invalid or expired session" });
      return;
    }

    const { email: rawEmail } = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
    if (!rawEmail || typeof rawEmail !== "string") {
      res.status(400).json({ error: "Email is required" });
      return;
    }
    const email = rawEmail.trim();
    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    const basicEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const hasOnlyAscii = /^[\x00-\x7F]+$/.test(email);
    if (!basicEmailPattern.test(email) || !hasOnlyAscii) {
      res.status(400).json({ error: "Enter a valid email address" });
      return;
    }

    if (email.toLowerCase() === authData.user.email?.toLowerCase()) {
      res.status(400).json({ error: "You cannot add yourself" });
      return;
    }

    const { data: targetList, error: targetError } = await serviceClient.auth.admin.listUsers({
      email,
      page: 1,
      perPage: 1,
    });
    const targetUser = targetList?.users?.[0] ?? null;
    if (targetError || !targetUser) {
      if (targetError) {
        console.error("lookup-user admin error:", targetError);
      }
      const adminMessage = targetError?.message ?? "User not found";
      const friendly =
        targetError && adminMessage.includes("Function invocation failed")
          ? "Failed to look up user email. Verify SUPABASE_SERVICE_ROLE_KEY is configured on the server."
          : adminMessage;
      res.status(targetError ? 500 : 404).json({ error: friendly });
      return;
    }

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, display_name")
      .eq("id", targetUser.id)
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
    console.error("lookup-user error:", error);
    res.status(500).json({ error: error?.message ?? "Internal Server Error" });
  }
}
