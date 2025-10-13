import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useXP } from "@/hooks/useXP";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Moon, Sun, Upload } from "lucide-react";
import { useDarkModePreference } from "@/hooks/useDarkModePreference";
import logo from "@/assets/logo.png";

export default function Profile() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { xp } = useXP(user?.id);
  const level = Math.floor(xp / 100) + 1;
  const { toast } = useToast();

  // Profile fields
  const [displayName, setDisplayName] = useState("");
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [ethnicity, setEthnicity] = useState("");
  const [wearsCorrection, setWearsCorrection] = useState("");
  const [correctionType, setCorrectionType] = useState("");
  const [lastEyeExam, setLastEyeExam] = useState("");
  const [screenTimeHours, setScreenTimeHours] = useState("");
  const [outdoorTimeHours, setOutdoorTimeHours] = useState("");
  const [sleepQuality, setSleepQuality] = useState("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [eyeConditions, setEyeConditions] = useState<string[]>([]);
  const [familyHistory, setFamilyHistory] = useState<string[]>([]);
  const [eyeSurgeries, setEyeSurgeries] = useState("");
  const [usesEyeMedication, setUsesEyeMedication] = useState(false);
  const [medicationDetails, setMedicationDetails] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { darkMode, setDarkMode, loading: darkLoading } = useDarkModePreference();

  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        if (profile) {
          setDisplayName(profile.display_name || "");
          setFullName(profile.full_name || "");
          setDateOfBirth(profile.date_of_birth || "");
          setGender(profile.gender || "");
          setEthnicity(profile.ethnicity || "");
          setWearsCorrection(profile.wears_correction || "");
          setCorrectionType(profile.correction_type || "");
          setLastEyeExam(profile.last_eye_exam || "");
          setScreenTimeHours(profile.screen_time_hours || "");
          setOutdoorTimeHours(profile.outdoor_time_hours || "");
          setSleepQuality(profile.sleep_quality || "");
          setSymptoms(profile.symptoms || []);
          setEyeConditions(profile.eye_conditions || []);
          setFamilyHistory(profile.family_history || []);
          setEyeSurgeries(profile.eye_surgeries || "");
          setUsesEyeMedication(!!profile.uses_eye_medication);
          setMedicationDetails(profile.medication_details || "");
          setBio(profile.bio || "");
          setAvatarUrl(profile.avatar_url || "");
        }
      };
      fetchProfile();
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName,
          full_name: fullName,
          date_of_birth: dateOfBirth,
          gender,
          ethnicity,
          wears_correction: wearsCorrection,
          correction_type: correctionType,
          last_eye_exam: lastEyeExam,
          screen_time_hours: screenTimeHours,
          outdoor_time_hours: outdoorTimeHours,
          sleep_quality: sleepQuality,
          symptoms,
          eye_conditions: eyeConditions,
          family_history: familyHistory,
          eye_surgeries: eyeSurgeries,
          uses_eye_medication: usesEyeMedication,
          medication_details: medicationDetails,
          bio,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (error) throw error;
      toast({ title: "Profile updated!", description: "Your changes have been saved." });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleDarkMode = async () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Error", description: "Image must be less than 5MB", variant: "destructive" });
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Error", description: "Only JPEG, PNG, GIF, and WebP images allowed", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      // Delete old avatar if exists and is a valid URL
      if (avatarUrl && avatarUrl.includes(user.id)) {
        const oldPath = avatarUrl.split(`${user.id}/`).pop();
        if (oldPath) {
          await supabase.storage.from('avatars').remove([`${user.id}/${oldPath}`]);
        }
      }

      // Upload new avatar
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL (always use returned path)
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      if (!publicUrl) throw new Error("Failed to get public URL for avatar");
      setAvatarUrl(publicUrl);

      // Save to profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (updateError) throw updateError;

      toast({ title: "Avatar uploaded!", description: "Your profile picture has been updated." });
    } catch (error: any) {
      console.error("Avatar upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="border-b border-border/40 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div
              className="flex cursor-pointer items-center gap-3"
              onClick={() => navigate("/dashboard")}
            >
              <img src={logo} alt="AIris" className="h-10" />
              <div className="flex flex-col">
                <span className="text-lg font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                  AIris
                </span>
                <span className="text-[10px] text-muted-foreground -mt-1">the future of eyecare</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl space-y-10 px-4 py-10">
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-primary via-indigo-600 to-fuchsia-600 text-white shadow-2xl">
          <span className="pointer-events-none absolute -left-16 top-1/4 h-56 w-56 rounded-full bg-white/25 blur-3xl" />
          <span className="pointer-events-none absolute -right-12 bottom-0 h-48 w-48 rounded-full bg-sky-400/30 blur-3xl" />
          <CardContent className="relative z-10 flex flex-col gap-6 p-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.35rem] text-white/70">Personal profile</p>
              <h1 className="text-4xl font-bold">
                {displayName ? `Hey ${displayName},` : "Complete your profile,"} keep your details current
              </h1>
              <p className="max-w-xl text-sm text-white/80">
                Review your vision history, update lifestyle habits, and manage preferences so AIris can tailor insights
                for you.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-white/15 p-4 shadow-lg backdrop-blur">
                <p className="text-xs uppercase tracking-wide text-white/70">Total XP</p>
                <p className="mt-2 text-3xl font-semibold">{xp}</p>
              </div>
              <div className="rounded-2xl bg-white/15 p-4 shadow-lg backdrop-blur">
                <p className="text-xs uppercase tracking-wide text-white/70">Level</p>
                <p className="mt-2 text-3xl font-semibold">{level}</p>
              </div>
              <div className="rounded-2xl bg-white/15 p-4 shadow-lg backdrop-blur">
                <p className="text-xs uppercase tracking-wide text-white/70">Dark Mode</p>
                <p className="mt-2 text-lg font-semibold">{darkMode ? "Enabled" : "Disabled"}</p>
              </div>
              <div className="rounded-2xl bg-white/15 p-4 shadow-lg backdrop-blur">
                <p className="text-xs uppercase tracking-wide text-white/70">Last Sync</p>
                <p className="mt-2 text-lg font-semibold">
                  {lastEyeExam ? lastEyeExam.replace(/_/g, " ") : "Update your exam date"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-slate-900 dark:text-slate-50">Profile Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Profile Info - Expanded */}
            <div className="space-y-4">
              {/* Avatar Upload */}
              <div className="space-y-2">
                <Label>Profile Picture</Label>
                <div className="flex items-center gap-4">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      className="h-20 w-20 rounded-full object-cover border-2 border-primary"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-blue-500 text-2xl font-bold text-white">
                      {displayName ? displayName[0].toUpperCase() : "?"}
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      id="avatar-upload"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      onClick={() => document.getElementById("avatar-upload")?.click()}
                      disabled={uploading}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {uploading ? "Uploading..." : "Upload Photo"}
                    </Button>
                    {avatarUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-2"
                        onClick={() => setAvatarUrl("")}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Input
                    id="gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    placeholder="Enter your gender"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ethnicity">Ethnicity</Label>
                  <Input
                    id="ethnicity"
                    value={ethnicity}
                    onChange={(e) => setEthnicity(e.target.value)}
                    placeholder="Enter your ethnicity"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wearsCorrection">Do you wear glasses/contacts?</Label>
                  <Input
                    id="wearsCorrection"
                    value={wearsCorrection}
                    onChange={(e) => setWearsCorrection(e.target.value)}
                    placeholder="e.g. glasses, contacts, none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="correctionType">Correction Type</Label>
                  <Input
                    id="correctionType"
                    value={correctionType}
                    onChange={(e) => setCorrectionType(e.target.value)}
                    placeholder="e.g. distance, reading, bifocal"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastEyeExam">Last Eye Exam</Label>
                  <Input
                    id="lastEyeExam"
                    value={lastEyeExam}
                    onChange={(e) => setLastEyeExam(e.target.value)}
                    placeholder="e.g. within 1 year"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="screenTimeHours">Screen Time (hours/day)</Label>
                  <Input
                    id="screenTimeHours"
                    type="number"
                    value={screenTimeHours}
                    onChange={(e) => setScreenTimeHours(e.target.value)}
                    placeholder="e.g. 4"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="outdoorTimeHours">Outdoor Time (hours/day)</Label>
                  <Input
                    id="outdoorTimeHours"
                    type="number"
                    value={outdoorTimeHours}
                    onChange={(e) => setOutdoorTimeHours(e.target.value)}
                    placeholder="e.g. 2"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sleepQuality">Sleep Quality</Label>
                  <Input
                    id="sleepQuality"
                    value={sleepQuality}
                    onChange={(e) => setSleepQuality(e.target.value)}
                    placeholder="e.g. good, average, poor"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Common Symptoms (comma separated)</Label>
                <Input
                  value={symptoms.join(", ")}
                  onChange={e => setSymptoms(e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                  placeholder="e.g. blurred_distance, near_strain, headaches"
                />
              </div>
              <div className="space-y-2">
                <Label>Known Eye Conditions (comma separated)</Label>
                <Input
                  value={eyeConditions.join(", ")}
                  onChange={e => setEyeConditions(e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                  placeholder="e.g. myopia, glaucoma"
                />
              </div>
              <div className="space-y-2">
                <Label>Family Eye History (comma separated)</Label>
                <Input
                  value={familyHistory.join(", ")}
                  onChange={e => setFamilyHistory(e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                  placeholder="e.g. high_myopia, glaucoma"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eyeSurgeries">Eye Surgeries or Trauma</Label>
                <Input
                  id="eyeSurgeries"
                  value={eyeSurgeries}
                  onChange={(e) => setEyeSurgeries(e.target.value)}
                  placeholder="Describe any surgeries or eye injuries"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={usesEyeMedication}
                  onChange={e => setUsesEyeMedication(e.target.checked)}
                  id="usesEyeMedication"
                  className="h-4 w-4 rounded border-primary accent-primary"
                />
                <Label htmlFor="usesEyeMedication">I use eye drops or vision medication</Label>
              </div>
              {usesEyeMedication && (
                <div className="space-y-2">
                  <Label htmlFor="medicationDetails">Medication Details</Label>
                  <Input
                    id="medicationDetails"
                    value={medicationDetails}
                    onChange={(e) => setMedicationDetails(e.target.value)}
                    placeholder="List medications"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself"
                  rows={3}
                />
              </div>
            </div>

            {/* Dark Mode Toggle */}
            <div className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
              <div className="flex items-center gap-3 text-slate-900 dark:text-slate-100">
                {darkMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                <span className="font-medium">Dark Mode</span>
              </div>
              <Button variant="outline" size="sm" onClick={toggleDarkMode} disabled={darkLoading}>
                {darkLoading ? "Loading..." : darkMode ? "Disable" : "Enable"}
              </Button>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={handleSave} disabled={loading} className="flex-1 bg-gradient-to-r from-primary to-blue-500 text-white hover:from-blue-500 hover:to-primary">
                {loading ? "Saving..." : "Save Changes"}
              </Button>
              <Button variant="destructive" onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
