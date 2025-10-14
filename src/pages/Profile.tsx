import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useXP } from "@/hooks/useXP";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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

  const symptomOptions = [
    "blurred_distance",
    "near_strain",
    "headaches",
    "dryness",
    "halos_glare",
    "color_confusion",
    "night_vision_issues",
  ];

  const conditionOptions = [
    "myopia",
    "hyperopia",
    "astigmatism",
    "amblyopia",
    "color_deficiency",
    "glaucoma",
    "cataract",
    "retinal_disease",
    "other",
  ];

  const familyOptions = ["high_myopia", "glaucoma", "color_blindness", "macular_disease", "keratoconus"];

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
  const [customSymptoms, setCustomSymptoms] = useState("");
  const [customEyeConditions, setCustomEyeConditions] = useState("");
  const [customFamilyHistory, setCustomFamilyHistory] = useState("");
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
          const profileSymptoms = Array.isArray(profile.symptoms) ? profile.symptoms : [];
          const profileConditions = Array.isArray(profile.eye_conditions) ? profile.eye_conditions : [];
          const profileFamilyHistory = Array.isArray(profile.family_history) ? profile.family_history : [];

          setSymptoms(profileSymptoms.filter((item: string) => symptomOptions.includes(item)));
          setCustomSymptoms(
            profileSymptoms
              .filter((item: string) => !symptomOptions.includes(item))
              .join("; "),
          );

          setEyeConditions(profileConditions.filter((item: string) => conditionOptions.includes(item)));
          setCustomEyeConditions(
            profileConditions
              .filter((item: string) => !conditionOptions.includes(item))
              .join("; "),
          );

          setFamilyHistory(profileFamilyHistory.filter((item: string) => familyOptions.includes(item)));
          setCustomFamilyHistory(
            profileFamilyHistory
              .filter((item: string) => !familyOptions.includes(item))
              .join("; "),
          );
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
      const mergeCustomValues = (selected: string[], custom: string) => {
        const parsed = custom
          .split(";")
          .map((item) => item.trim())
          .filter(Boolean);
        return Array.from(new Set([...selected, ...parsed]));
      };

      const mergedSymptoms = mergeCustomValues(symptoms, customSymptoms);
      const mergedEyeConditions = mergeCustomValues(eyeConditions, customEyeConditions);
      const mergedFamilyHistory = mergeCustomValues(familyHistory, customFamilyHistory);

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
          symptoms: mergedSymptoms,
          eye_conditions: mergedEyeConditions,
          family_history: mergedFamilyHistory,
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

  const toggleArray = (arr: string[], setArr: (val: string[]) => void, value: string) => {
    setArr(arr.includes(value) ? arr.filter((item) => item !== value) : [...arr, value]);
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
          <CardContent className="space-y-8">
            <div className="space-y-8">
              {/* Avatar Upload */}
              <div className="space-y-2">
                <Label>Profile Photo</Label>
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
                    <input type="file" id="avatar-upload" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                    <Button variant="outline" onClick={() => document.getElementById("avatar-upload")?.click()} disabled={uploading}>
                      <Upload className="mr-2 h-4 w-4" />
                      {uploading ? "Uploading..." : "Upload Photo"}
                    </Button>
                    {avatarUrl && (
                      <Button variant="ghost" size="sm" className="ml-2" onClick={() => setAvatarUrl("")}>
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Basic Profile */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">👤 Basic Profile</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label>Display Name *</Label>
                    <Input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Full Name</Label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Date of Birth</Label>
                    <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
                  </div>
                  <div>
                    <Label>Gender</Label>
                    <Select value={gender} onValueChange={(val) => setGender(val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="prefer_not_say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Ethnicity (Optional)</Label>
                    <Input value={ethnicity} onChange={(e) => setEthnicity(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Vision Information */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">👓 Vision Information</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label>Do you wear glasses/contacts?</Label>
                    <Select value={wearsCorrection} onValueChange={(val) => setWearsCorrection(val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
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
                    <Select value={correctionType} onValueChange={(val) => setCorrectionType(val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
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
                    <Select value={lastEyeExam} onValueChange={(val) => setLastEyeExam(val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
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
                <h3 className="text-xl font-semibold">🌿 Lifestyle</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <Label>Screen Time (hours/day)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="16"
                      value={screenTimeHours}
                      onChange={(e) => setScreenTimeHours(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Outdoor Time (hours/day)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="10"
                      value={outdoorTimeHours}
                      onChange={(e) => setOutdoorTimeHours(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Sleep Quality</Label>
                    <Select value={sleepQuality} onValueChange={(val) => setSleepQuality(val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="average">Average</SelectItem>
                        <SelectItem value="poor">Poor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>
                    Common Symptoms (Select all that apply or add custom; separate custom values with a semicolon{" "}
                    <code>;</code>)
                  </Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {symptomOptions.map((symptom) => (
                      <div key={symptom} className="flex items-center space-x-2">
                        <Checkbox
                          checked={symptoms.includes(symptom)}
                          onCheckedChange={() => toggleArray(symptoms, setSymptoms, symptom)}
                        />
                        <label className="text-sm">{symptom.replace(/_/g, " ")}</label>
                      </div>
                    ))}
                  </div>
                  <Input
                    className="mt-2"
                    placeholder="Custom symptoms (e.g. blurry vision; eye pain)"
                    value={customSymptoms}
                    onChange={(e) => setCustomSymptoms(e.target.value)}
                  />
                </div>
              </div>

              {/* Eye Health History */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">👁️ Eye Health History</h3>
                <div>
                  <Label>
                    Known Eye Conditions (Select or add custom; separate custom values with a semicolon <code>;</code>)
                  </Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {conditionOptions.map((condition) => (
                      <div key={condition} className="flex items-center space-x-2">
                        <Checkbox
                          checked={eyeConditions.includes(condition)}
                          onCheckedChange={() => toggleArray(eyeConditions, setEyeConditions, condition)}
                        />
                        <label className="text-sm">{condition.replace(/_/g, " ")}</label>
                      </div>
                    ))}
                  </div>
                  <Input
                    className="mt-2"
                    placeholder="Custom conditions (e.g. dry eye; keratoconus)"
                    value={customEyeConditions}
                    onChange={(e) => setCustomEyeConditions(e.target.value)}
                  />
                </div>
                <div>
                  <Label>
                    Family Eye History (Select or add custom; separate custom values with a semicolon <code>;</code>)
                  </Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {familyOptions.map((history) => (
                      <div key={history} className="flex items-center space-x-2">
                        <Checkbox
                          checked={familyHistory.includes(history)}
                          onCheckedChange={() => toggleArray(familyHistory, setFamilyHistory, history)}
                        />
                        <label className="text-sm">{history.replace(/_/g, " ")}</label>
                      </div>
                    ))}
                  </div>
                  <Input
                    className="mt-2"
                    placeholder="Custom family history (e.g. glaucoma; macular degeneration)"
                    value={customFamilyHistory}
                    onChange={(e) => setCustomFamilyHistory(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Eye Surgeries or Trauma (Optional)</Label>
                  <Input
                    value={eyeSurgeries}
                    onChange={(e) => setEyeSurgeries(e.target.value)}
                    placeholder="Describe any surgeries or eye injuries"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox checked={usesEyeMedication} onCheckedChange={(val) => setUsesEyeMedication(!!val)} />
                  <Label>I use eye drops or vision medication</Label>
                </div>
                {usesEyeMedication && (
                  <div>
                    <Label>Medication Details</Label>
                    <Input
                      value={medicationDetails}
                      onChange={(e) => setMedicationDetails(e.target.value)}
                      placeholder="List medications"
                    />
                  </div>
                )}
              </div>

              {/* Additional Details */}
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">📝 Additional Details</h3>
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
              <Button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-primary to-blue-500 text-white hover:from-blue-500 hover:to-primary"
              >
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
