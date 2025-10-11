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
import logo from "@/assets/logo.png";

export default function Profile() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { xp } = useXP(user?.id);
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const isDark = localStorage.getItem("darkMode") === "true";
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add("dark");
    }
  }, []);

  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        if (data) {
          setDisplayName(data.display_name || "");
          setBio(data.bio || "");
          setAvatarUrl(data.avatar_url || "");
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
          bio,
          avatar_url: avatarUrl,
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

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem("darkMode", String(newMode));
    if (newMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type and size
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPEG, PNG, GIF, or WebP image.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      // Check if bucket exists and is accessible
      const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
      
      if (bucketError) {
        console.error("Bucket check error:", bucketError);
        // Continue anyway - bucket might exist but not be listable
      }

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = fileName; // Store at root of bucket for simplicity

      console.log("Uploading file:", filePath);

      // Try to delete old file first (if exists)
      if (avatarUrl) {
        const oldPath = avatarUrl.split('/').pop();
        if (oldPath) {
          await supabase.storage.from('avatars').remove([oldPath]);
        }
      }

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { 
          cacheControl: '3600',
          upsert: true 
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      console.log("Upload successful:", uploadData);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;
      console.log("Public URL:", publicUrl);

      setAvatarUrl(publicUrl);

      // Save to profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) {
        console.error("Profile update error:", updateError);
        throw updateError;
      }

      toast({ 
        title: "Avatar uploaded!", 
        description: "Your profile picture has been updated." 
      });
    } catch (error: any) {
      console.error("Avatar upload error:", error);
      
      let errorMessage = error.message || "Unknown error occurred";
      
      // Provide helpful error messages
      if (errorMessage.includes("Bucket not found")) {
        errorMessage = "Avatar storage not configured. Please contact support or create an 'avatars' bucket in Supabase.";
      } else if (errorMessage.includes("permission")) {
        errorMessage = "Permission denied. Please check storage bucket permissions.";
      }
      
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const level = Math.floor(xp / 100) + 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary-lighter/10 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div 
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => navigate("/dashboard")}
            >
              <img src={logo} alt="AIris" className="h-10" />
              <div className="flex flex-col">
                <span className="text-lg font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                  AIris
                </span>
                <span className="text-[10px] text-muted-foreground -mt-1">
                  the future of eyecare
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 py-8">
        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle className="text-2xl">Profile Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 rounded-lg bg-gradient-primary p-6 text-white">
              <div>
                <p className="text-sm opacity-90">Total XP</p>
                <p className="text-3xl font-bold">{xp}</p>
              </div>
              <div>
                <p className="text-sm opacity-90">Level</p>
                <p className="text-3xl font-bold">{level}</p>
              </div>
            </div>

            {/* Profile Info */}
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
                    <div className="h-20 w-20 rounded-full bg-gradient-primary flex items-center justify-center text-white text-2xl font-bold">
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
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                {darkMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                <span className="font-medium">Dark Mode</span>
              </div>
              <Button variant="outline" size="sm" onClick={toggleDarkMode}>
                {darkMode ? "Disable" : "Enable"}
              </Button>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button onClick={handleSave} disabled={loading} className="flex-1">
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
