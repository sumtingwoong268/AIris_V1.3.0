import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ASCII_PATTERN = /^[\u0020-\u007E]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^@[a-z0-9_.-]{1,19}$/;

type RequestLike = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (payload: unknown) => void;
};

const normalizeEmail = (value: string | null | undefined) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || !ASCII_PATTERN.test(trimmed) || !EMAIL_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
};

const normalizeUsername = (value: string | null | undefined) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || !ASCII_PATTERN.test(trimmed)) {
    return null;
  }
  const withoutAt = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  if (!withoutAt) {
    return null;
  }
  const candidate = `@${withoutAt.toLowerCase()}`;
  if (!USERNAME_PATTERN.test(candidate)) {
    return null;
  }
  return candidate;
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const rawAuthorization = req.headers?.authorization;
    const authHeader = Array.isArray(rawAuthorization) ? rawAuthorization[0] : rawAuthorization;
    const token = authHeader?.replace("Bearer ", "");
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

    const parsedBody = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const payload =
      parsedBody && typeof parsedBody === "object"
        ? (parsedBody as Record<string, unknown>)
        : {};
    const rawUsernameValue = payload.username;
    const rawEmailValue = payload.email;
    const rawUsername = typeof rawUsernameValue === "string" ? rawUsernameValue : null;
    const rawEmail = typeof rawEmailValue === "string" ? rawEmailValue : null;

    const normalizedUsername = normalizeUsername(rawUsername);
    if (rawUsername && !normalizedUsername) {
      res.status(400).json({ error: "Enter a valid username" });
      return;
    }

    const email = normalizeEmail(rawEmail);
    if (rawEmail && !email) {
      res.status(400).json({ error: "Enter a valid email address" });
      return;
    }

    if (!normalizedUsername && !email) {
      res.status(400).json({ error: "Username or email is required" });
      return;
    }

    let targetProfile: { id: string; display_name: string | null; username: string } | null = null;

    if (normalizedUsername) {
      const { data, error } = await serviceClient
        .from("profiles")
        .select("id, display_name, username")
        .eq("username", normalizedUsername)
        .maybeSingle();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      if (!data) {
        res.status(404).json({ error: "No user found with that username" });
        return;
      }

      targetProfile = {
        id: data.id,
        display_name: data.display_name ?? null,
        username: data.username,
      };
    } else if (email) {
      if (email.toLowerCase() === authData.user.email?.toLowerCase()) {
        res.status(400).json({ error: "You cannot add yourself" });
        return;
      }

      type AdminListUsersResponse = Awaited<ReturnType<typeof serviceClient.auth.admin.listUsers>>;
      let targetList: AdminListUsersResponse["data"] | null = null;
      let targetError: AdminListUsersResponse["error"] | null = null;
      try {
        const response = await serviceClient.auth.admin.listUsers({
          email,
          page: 1,
          perPage: 1,
        });
        targetList = response.data;
        targetError = response.error;
      } catch (adminError: unknown) {
        if (adminError instanceof Error && adminError.message.includes("ByteString")) {
          res.status(400).json({ error: "Enter a valid email address" });
          return;
        }
        throw adminError;
      }

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

      if (targetUser.id === authData.user.id) {
        res.status(400).json({ error: "You cannot add yourself" });
        return;
      }

      const { data: fetchedProfile, error: profileError } = await serviceClient
        .from("profiles")
        .select("id, display_name, username")
        .eq("id", targetUser.id)
        .maybeSingle();

      if (profileError) {
        res.status(500).json({ error: profileError.message });
        return;
      }

      if (!fetchedProfile) {
        res.status(404).json({ error: "Profile not found" });
        return;
      }

      targetProfile = {
        id: fetchedProfile.id,
        display_name: fetchedProfile.display_name ?? null,
        username: fetchedProfile.username,
      };
    }

    if (!targetProfile) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (targetProfile.id === authData.user.id) {
      res.status(400).json({ error: "You cannot add yourself" });
      return;
    }

    res.status(200).json({
      profile: {
        id: targetProfile.id,
        display_name: targetProfile.display_name,
        username: targetProfile.username,
      },
    });
  } catch (error: unknown) {
    console.error("lookup-user error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    res.status(500).json({ error: message });
  }
}
