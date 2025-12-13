import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2 } from "lucide-react";
import logo from "@/assets/logo.png";
import { sanitizeUsername, usernameIsAvailable, USERNAME_MAX_LENGTH } from "@/utils/username";

export default function Setup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [usernameInput, setUsernameInput] = useState("@");
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  const [formData, setFormData] = useState({
    display_name: "",
    full_name: "",
    date_of_birth: "",
    gender: "",
    ethnicity: "",
    wears_correction: "",
    correction_type: "",
    last_eye_exam: "",
    screen_time_hours: "",
    outdoor_time_hours: "",
    sleep_quality: "",
    eye_surgeries: "",
    uses_eye_medication: false,
    medication_details: "",
    privacy_accepted: false,
  });

  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [customSymptoms, setCustomSymptoms] = useState("");
  const [eyeConditions, setEyeConditions] = useState<string[]>([]);
  const [customEyeConditions, setCustomEyeConditions] = useState("");
  const [familyHistory, setFamilyHistory] = useState<string[]>([]);
  const [customFamilyHistory, setCustomFamilyHistory] = useState("");

  useEffect(() => {
    if (!user) return;
    const loadUsername = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();
      if (error) {
        console.error("Failed to load username during setup:", error);
        return;
      }
      if (data?.username) {
        setUsernameInput(data.username);
        setCurrentUsername(data.username);
      }
    };
    void loadUsername();
  }, [user]);

  const symptomOptions = [
    "Blurred_distance", "Near_strain", "Headaches", "Dryness", 
    "Halos_glare", "Color_confusion", "Night_vision_issues"
  ];

  const conditionOptions = [
    "Myopia", "Hyperopia", "Astigmatism", "Amblyopia", "Aolor_deficiency",
    "Glaucoma", "Cataract", "Retinal_disease", "Other"
  ];

  const familyOptions = [
    "High_myopia", "Glaucoma", "Color_blindness", "Macular_disease", "Keratoconus"
  ];

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Error", description: "Image must be less than 5MB", variant: "destructive" });
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleUsernameCheck = async () => {
    if (!user) return;
    const sanitized = sanitizeUsername(usernameInput);
    if (!sanitized) {
      setUsernameError("Enter a valid username (start with @, max 20 characters).");
      return;
    }
    if (sanitized === currentUsername) {
      setUsernameError(null);
      return;
    }
    setCheckingUsername(true);
    try {
      const available = await usernameIsAvailable(supabase, sanitized, user.id);
      setUsernameError(available ? null : "That username is already taken.");
    } catch (error: any) {
      console.error("Username availability check failed:", error);
      setUsernameError(error.message ?? "Could not verify username availability.");
    } finally {
      setCheckingUsername(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.privacy_accepted) {
      toast({ title: "Error", description: "Please accept the Privacy Policy to continue", variant: "destructive" });
      return;
    }

    const sanitizedUsername = sanitizeUsername(usernameInput);
    if (!sanitizedUsername) {
      setUsernameError("Enter a valid username (start with @, max 20 characters).");
      toast({ title: "Username required", description: "Choose a username that starts with @ and uses allowed characters.", variant: "destructive" });
      return;
    }

    let activeUser = user ?? null;
    if (!activeUser?.id) {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error("Failed to verify auth session during setup:", sessionError);
      }
      activeUser = sessionData?.session?.user ?? null;
      if (!activeUser?.id) {
        console.warn("Supabase auth session missing while completing setup.");
      }
    }

    if (!activeUser?.id) {
      toast({
        title: "Session expired",
        description: "Please sign in again before completing setup.",
        variant: "destructive",
      });
      return;
    }
    const userId = activeUser.id;

    if (sanitizedUsername !== currentUsername) {
      setCheckingUsername(true);
      try {
        const available = await usernameIsAvailable(supabase, sanitizedUsername, userId);
        if (!available) {
          setUsernameError("That username is already taken.");
          toast({ title: "Username taken", description: "Please choose another username.", variant: "destructive" });
          return;
        }
        setUsernameError(null);
      } catch (error: any) {
        setUsernameError(error.message ?? "Could not verify username availability.");
        toast({ title: "Username check failed", description: "Please try again in a moment.", variant: "destructive" });
        return;
      } finally {
        setCheckingUsername(false);
      }
    }

    setLoading(true);

    try {
      let avatar_url = "";

      // Upload avatar if selected
      if (avatarFile) {
        const fileExt = avatarFile.name.split(".").pop();
        const fileName = `${userId}/${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(fileName, avatarFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("avatars")
          .getPublicUrl(fileName);

        if (!publicUrl) throw new Error("Failed to get public URL for avatar");
        avatar_url = publicUrl;
      }

      // Merge custom and checkbox values (semicolon-separated, trimmed, non-empty)
      const mergedSymptoms = [
        ...symptoms,
        ...customSymptoms.split(';').map(s => s.trim()).filter(Boolean)
      ].filter((v, i, arr) => arr.indexOf(v) === i);
      const mergedEyeConditions = [
        ...eyeConditions,
        ...customEyeConditions.split(';').map(s => s.trim()).filter(Boolean)
      ].filter((v, i, arr) => arr.indexOf(v) === i);
      const mergedFamilyHistory = [
        ...familyHistory,
        ...customFamilyHistory.split(';').map(s => s.trim()).filter(Boolean)
      ].filter((v, i, arr) => arr.indexOf(v) === i);

      // Update profile
      const { error } = await supabase
        .from("profiles")
        .update({
          ...formData,
          username: sanitizedUsername,
          avatar_url,
          symptoms: mergedSymptoms,
          eye_conditions: mergedEyeConditions,
          family_history: mergedFamilyHistory,
          setup_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) throw error;

      setCurrentUsername(sanitizedUsername);
      setUsernameInput(sanitizedUsername);
      setUsernameError(null);
      toast({ title: "Success", description: "Profile setup complete!" });
      navigate("/dashboard");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleArray = (arr: string[], setArr: (val: string[]) => void, value: string) => {
    setArr(arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]);
  };

  const handleProtectedNavigation = () => {
    if (!formData.privacy_accepted) {
      toast({
        title: "Finish required step",
        description: "Please accept the Privacy Policy before leaving setup.",
        variant: "destructive",
      });
      return;
    }
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="border-b border-border/40 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto flex items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={handleProtectedNavigation}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex cursor-pointer items-center gap-3" onClick={handleProtectedNavigation}>
            <img src={logo} alt="AIris" className="h-10" />
            <div className="flex flex-col">
              <span className="text-lg font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                AIris
              </span>
              <span className="text-[10px] text-muted-foreground -mt-1">the future of eyecare</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl space-y-10 px-4 py-10">
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-primary via-indigo-600 to-fuchsia-600 text-white shadow-2xl">
          <span className="pointer-events-none absolute -left-14 top-1/3 h-48 w-48 rounded-full bg-white/25 blur-3xl" />
          <span className="pointer-events-none absolute -right-10 bottom-0 h-44 w-44 rounded-full bg-sky-400/30 blur-3xl" />
          <CardContent className="relative z-10 space-y-4 p-8 lg:p-10">
            <p className="text-sm uppercase tracking-[0.35rem] text-white/70">Quick onboarding</p>
            <h1 className="text-4xl font-bold">Tell us about your vision habits so we can tailor AIris for you</h1>
            <p className="max-w-3xl text-sm text-white/80">
              The more we know about your lifestyle, the better we can personalize reminders, eye health tips, and test
              insights. You can always fine-tune these settings later inside your profile.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/15 p-4 text-sm backdrop-blur">
                <span className="text-xs uppercase tracking-wide text-white/70">Step</span>
                <p className="mt-2 text-lg font-semibold">1 of 1 — Profile setup</p>
              </div>
              <div className="rounded-2xl bg-white/15 p-4 text-sm backdrop-blur">
                <span className="text-xs uppercase tracking-wide text-white/70">Estimated time</span>
                <p className="mt-2 text-lg font-semibold">~3 minutes</p>
              </div>
              <div className="rounded-2xl bg-white/15 p-4 text-sm backdrop-blur">
                <span className="text-xs uppercase tracking-wide text-white/70">Required</span>
                <p className="mt-2 text-lg font-semibold">Review privacy policy</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-slate-900 dark:text-slate-50">Complete Your Profile</CardTitle>
            <CardDescription className="text-sm text-slate-600 dark:text-slate-300">
              Help us personalize your eye care experience with a few quick questions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              
              {/* Avatar Upload */}
              <div className="space-y-2">
                <Label>Profile Photo</Label>
                <div className="flex items-center gap-4">
                  {avatarPreview && (
                    <img src={avatarPreview} alt="Avatar" className="w-20 h-20 rounded-full object-cover" />
                  )}
                  <Input type="file" accept="image/*" onChange={handleAvatarChange} />
                </div>
              </div>

              {/* Basic Profile */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">👤 Basic Profile</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="username">Username *</Label>
                    <Input
                      id="username"
                      value={usernameInput}
                      onChange={(e) => {
                        setUsernameInput(e.target.value);
                        if (usernameError) setUsernameError(null);
                      }}
                      onBlur={handleUsernameCheck}
                      maxLength={USERNAME_MAX_LENGTH}
                      autoComplete="off"
                      required
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Choose a unique handle starting with @. Allowed characters: letters, numbers, ".", "_" and "-".
                    </p>
                    {checkingUsername && !usernameError && (
                      <p className="text-xs text-muted-foreground">Checking availability…</p>
                    )}
                    {usernameError && (
                      <p className="text-xs text-destructive">{usernameError}</p>
                    )}
                  </div>
                  <div>
                    <Label>Display Name *</Label>
                    <Input required value={formData.display_name} onChange={e => setFormData({...formData, display_name: e.target.value})} />
                  </div>
                  <div>
                    <Label>Full Name</Label>
                    <Input value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} />
                  </div>
                  <div>
                    <Label>Date of Birth</Label>
                    <Input type="date" value={formData.date_of_birth} onChange={e => setFormData({...formData, date_of_birth: e.target.value})} />
                  </div>
                  <div>
                    <Label>Gender</Label>
                    <Select value={formData.gender} onValueChange={val => setFormData({...formData, gender: val})}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="prefer_not_say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Ethnicity (Optional)</Label>
                    <Input value={formData.ethnicity} onChange={e => setFormData({...formData, ethnicity: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* Vision Information */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">👓 Vision Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Do you wear glasses/contacts?</Label>
                    <Select value={formData.wears_correction} onValueChange={val => setFormData({...formData, wears_correction: val})}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="glasses">Glasses</SelectItem>
                        <SelectItem value="contacts">Contacts</SelectItem>
                        <SelectItem value="both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Correction Type</Label>
                    <Select value={formData.correction_type} onValueChange={val => setFormData({...formData, correction_type: val})}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="distance">Distance</SelectItem>
                        <SelectItem value="reading">Reading</SelectItem>
                        <SelectItem value="bifocal">Bifocal</SelectItem>
                        <SelectItem value="progressive">Progressive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Last Eye Exam</Label>
                    <Select value={formData.last_eye_exam} onValueChange={val => setFormData({...formData, last_eye_exam: val})}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="never">Never</SelectItem>
                        <SelectItem value="less_1_year">Less than 1 year</SelectItem>
                        <SelectItem value="1_2_years">1-2 years ago</SelectItem>
                        <SelectItem value="more_2_years">More than 2 years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Lifestyle */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">🧠 Lifestyle & Habits</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Screen Time (hours/day)</Label>
                    <Input type="number" min="0" max="16" value={formData.screen_time_hours} onChange={e => setFormData({...formData, screen_time_hours: e.target.value})} />
                  </div>
                  <div>
                    <Label>Outdoor Time (hours/day)</Label>
                    <Input type="number" min="0" max="10" value={formData.outdoor_time_hours} onChange={e => setFormData({...formData, outdoor_time_hours: e.target.value})} />
                  </div>
                  <div>
                    <Label>Sleep Quality</Label>
                    <Select value={formData.sleep_quality} onValueChange={val => setFormData({...formData, sleep_quality: val})}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="average">Average</SelectItem>
                        <SelectItem value="poor">Poor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Common Symptoms (Select all that apply or add custom; separate custom values with a semicolon <code>;</code>)</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {symptomOptions.map(symptom => (
                      <div key={symptom} className="flex items-center space-x-2">
                        <Checkbox checked={symptoms.includes(symptom)} onCheckedChange={() => toggleArray(symptoms, setSymptoms, symptom)} />
                        <label className="text-sm">{symptom.replace(/_/g, " ")}</label>
                      </div>
                    ))}
                  </div>
                  <Input
                    className="mt-2"
                    placeholder="Custom symptoms (e.g. blurry vision; eye pain)"
                    value={customSymptoms}
                    onChange={e => setCustomSymptoms(e.target.value)}
                  />
                </div>
              </div>

              {/* Eye Health History */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">👁️ Eye Health History</h3>
                <div>
                  <Label>Known Eye Conditions (Select or add custom; separate custom values with a semicolon <code>;</code>)</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {conditionOptions.map(condition => (
                      <div key={condition} className="flex items-center space-x-2">
                        <Checkbox checked={eyeConditions.includes(condition)} onCheckedChange={() => toggleArray(eyeConditions, setEyeConditions, condition)} />
                        <label className="text-sm">{condition.replace(/_/g, " ")}</label>
                      </div>
                    ))}
                  </div>
                  <Input
                    className="mt-2"
                    placeholder="Custom conditions (e.g. dry eye; keratoconus)"
                    value={customEyeConditions}
                    onChange={e => setCustomEyeConditions(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Family Eye History (Select or add custom; separate custom values with a semicolon <code>;</code>)</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {familyOptions.map(history => (
                      <div key={history} className="flex items-center space-x-2">
                        <Checkbox checked={familyHistory.includes(history)} onCheckedChange={() => toggleArray(familyHistory, setFamilyHistory, history)} />
                        <label className="text-sm">{history.replace(/_/g, " ")}</label>
                      </div>
                    ))}
                  </div>
                  <Input
                    className="mt-2"
                    placeholder="Custom family history (e.g. glaucoma; macular degeneration)"
                    value={customFamilyHistory}
                    onChange={e => setCustomFamilyHistory(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Eye Surgeries or Trauma (Optional)</Label>
                  <Input value={formData.eye_surgeries} onChange={e => setFormData({...formData, eye_surgeries: e.target.value})} placeholder="Describe any surgeries or eye injuries" />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox checked={formData.uses_eye_medication} onCheckedChange={val => setFormData({...formData, uses_eye_medication: !!val})} />
                  <Label>I use eye drops or vision medication</Label>
                </div>
                {formData.uses_eye_medication && (
                  <div>
                    <Label>Medication Details</Label>
                    <Input value={formData.medication_details} onChange={e => setFormData({...formData, medication_details: e.target.value})} placeholder="List medications" />
                  </div>
                )}
              </div>

              {/* Privacy Policy */}
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-start space-x-2">
                  <Checkbox required checked={formData.privacy_accepted} onCheckedChange={val => setFormData({...formData, privacy_accepted: !!val})} />
                  <label className="text-sm">
                    I agree to the <a href="https://docs.google.com/document/d/1mRvsgIr6H9fzEfP02vHtCDwWrA2sbnauyJqczURnWWQ/edit?tab=t.0#heading=h.az3l7ex3egnh" target="_blank" className="text-blue-600 underline">Privacy Policy</a> *
                  </label>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-primary to-blue-500 text-white hover:from-blue-500 hover:to-primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Complete Setup"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
