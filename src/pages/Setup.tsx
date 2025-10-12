import { useState } from "react";
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
import { Loader2 } from "lucide-react";

export default function Setup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  
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
    tos_accepted: false,
    privacy_accepted: false,
  });

  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [customSymptoms, setCustomSymptoms] = useState("");
  const [eyeConditions, setEyeConditions] = useState<string[]>([]);
  const [customEyeConditions, setCustomEyeConditions] = useState("");
  const [familyHistory, setFamilyHistory] = useState<string[]>([]);
  const [customFamilyHistory, setCustomFamilyHistory] = useState("");

  const symptomOptions = [
    "blurred_distance", "near_strain", "headaches", "dryness", 
    "halos_glare", "color_confusion", "night_vision_issues"
  ];

  const conditionOptions = [
    "myopia", "hyperopia", "astigmatism", "amblyopia", "color_deficiency",
    "glaucoma", "cataract", "retinal_disease", "other"
  ];

  const familyOptions = [
    "high_myopia", "glaucoma", "color_blindness", "macular_disease", "keratoconus"
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.tos_accepted || !formData.privacy_accepted) {
      toast({ title: "Error", description: "Please accept Terms and Privacy Policy", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      let avatar_url = "";

      // Upload avatar if selected
      if (avatarFile && user) {
        const fileExt = avatarFile.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
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
          avatar_url,
          symptoms: mergedSymptoms,
          eye_conditions: mergedEyeConditions,
          family_history: mergedFamilyHistory,
          setup_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user?.id);

      if (error) throw error;

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
      <div className="max-w-4xl mx-auto py-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl">Complete Your Profile</CardTitle>
            <CardDescription>Help us personalize your eye care experience</CardDescription>
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

              {/* Terms & Privacy */}
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-start space-x-2">
                  <Checkbox required checked={formData.tos_accepted} onCheckedChange={val => setFormData({...formData, tos_accepted: !!val})} />
                  <label className="text-sm">
                    I agree to the <a href="https://docs.google.com/document/d/YOUR_TOS_ID" target="_blank" className="text-blue-600 underline">Terms of Service</a> *
                  </label>
                </div>
                <div className="flex items-start space-x-2">
                  <Checkbox required checked={formData.privacy_accepted} onCheckedChange={val => setFormData({...formData, privacy_accepted: !!val})} />
                  <label className="text-sm">
                    I agree to the <a href="https://docs.google.com/document/d/YOUR_PRIVACY_ID" target="_blank" className="text-blue-600 underline">Privacy Policy</a> *
                  </label>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <><Loader2 className="animate-spin mr-2" /> Saving...</> : "Complete Setup"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
