import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BarChart3, Calendar as CalendarIcon, Download, Edit3, Eye, Filter, Plus, Search, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { saveAs } from "file-saver";
import logo from "@/assets/logo.png";
import { useAuth } from "@/hooks/useAuth";
import { PremiumHeader } from "@/components/ui/PremiumHeader";
import {
  ensureSampleEntries,
  loadEntries,
  loadStoredTab,
  resetAchievements,
  saveEntries,
  saveStoredTab,
  type AchievementCategory,
  type AchievementEntry,
  type AchievementMedia,
} from "@/utils/achievementsStorage";

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  goals: "Goals",
  progress: "Progress",
  reflections: "Reflections",
};

const mediaIcon = (type: AchievementMedia["type"]) => (type === "video" ? "video" : "image");

const buildEmptyForm = () => ({
  title: "",
  category: "goals" as AchievementCategory,
  description: "",
  media: [] as AchievementMedia[],
  date: format(new Date(), "yyyy-MM-dd"),
});

export default function Achievements() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<AchievementEntry[]>([]);
  const [activeTab, setActiveTab] = useState<AchievementCategory | "all">(loadStoredTab());
  const [filters, setFilters] = useState({
    search: "",
    category: "all" as AchievementCategory | "all",
    from: "",
    to: "",
    media: "any" as "any" | "with" | "without",
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewEntry, setViewEntry] = useState<AchievementEntry | null>(null);
  const [formState, setFormState] = useState(buildEmptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    ensureSampleEntries();
    setEntries(loadEntries());
  }, [authLoading, user]);

  useEffect(() => {
    if (!user || authLoading) return;
    saveEntries(entries);
  }, [entries, user, authLoading]);

  const filteredEntries = useMemo(() => {
    return entries
      .filter((entry) => {
        const matchesTab = activeTab === "all" || entry.category === activeTab;
        const matchesCategory = filters.category === "all" || entry.category === filters.category;
        const matchesSearch =
          entry.title.toLowerCase().includes(filters.search.toLowerCase()) ||
          entry.description.toLowerCase().includes(filters.search.toLowerCase());
        const entryDate = new Date(entry.createdAt);
        const fromDate = filters.from ? new Date(filters.from) : null;
        const toDate = filters.to ? new Date(filters.to) : null;
        const matchesFrom = !fromDate || entryDate >= fromDate;
        const matchesTo = !toDate || entryDate <= toDate;
        const matchesMedia =
          filters.media === "any" ||
          (filters.media === "with" && entry.media.length > 0) ||
          (filters.media === "without" && entry.media.length === 0);
        return matchesTab && matchesCategory && matchesSearch && matchesFrom && matchesTo && matchesMedia;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [entries, activeTab, filters]);

  const analyticsData = useMemo(() => {
    const counts: Record<string, { count: number; label: string }> = {};
    entries.forEach((entry) => {
      const monthKey = format(new Date(entry.createdAt), "yyyy-MM");
      const label = format(new Date(entry.createdAt), "MMM yyyy");
      counts[monthKey] = counts[monthKey] || { count: 0, label };
      counts[monthKey].count += 1;
    });
    return Object.entries(counts)
      .map(([key, value]) => ({ ...value, key }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [entries]);

  const openNewEntry = () => {
    setEditingId(null);
    setFormState(buildEmptyForm());
    setDialogOpen(true);
  };

  const handleMediaUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const readers = Array.from(files).map(
      (file) =>
        new Promise<AchievementMedia>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              id: crypto.randomUUID(),
              type: file.type.startsWith("video") ? "video" : "image",
              url: reader.result as string,
              name: file.name,
            });
          };
          reader.readAsDataURL(file);
        }),
    );

    const mediaItems = await Promise.all(readers);
    setFormState((prev) => ({ ...prev, media: [...prev.media, ...mediaItems] }));
  };

  const handleSave = () => {
    if (!formState.title.trim() || !formState.description.trim()) return;

    const payload: AchievementEntry = {
      id: editingId ?? crypto.randomUUID(),
      title: formState.title.trim(),
      category: formState.category,
      description: formState.description.trim(),
      media: formState.media,
      createdAt: formState.date,
    };

    setEntries((prev) => {
      if (editingId) {
        return prev.map((entry) => (entry.id === editingId ? payload : entry));
      }
      return [payload, ...prev];
    });

    setDialogOpen(false);
    setEditingId(null);
    setFormState(buildEmptyForm());
  };

  const handleEdit = (entry: AchievementEntry) => {
    setEditingId(entry.id);
    setFormState({
      title: entry.title,
      category: entry.category,
      description: entry.description,
      media: entry.media,
      date: entry.createdAt,
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this entry?")) return;
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
    saveAs(blob, "achievements-log.json");
  };

  const handleResetSamples = () => {
    resetAchievements();
    setEntries(loadEntries());
  };

  const filteredTabCount = entries.filter((entry) => activeTab === "all" || entry.category === activeTab).length;

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <PremiumHeader
        title="Achievements"
        subtitle="Track your progress"
        rightContent={
          <Button onClick={openNewEntry} className="rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20">
            <Plus className="mr-2 h-4 w-4" /> New Entry
          </Button>
        }
      />

      <main className="container mx-auto space-y-8 px-4 pt-32 pb-20">
        <div className="grid gap-6 lg:grid-cols-[1.5fr,1fr]">
          <Card className="border-none bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-xl">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
            <CardHeader className="relative z-10 flex flex-col gap-6 p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-[0.3rem] text-white/80">Milestones</p>
                  <CardTitle className="text-3xl font-bold md:text-4xl">Goals & Progress</CardTitle>
                  <CardDescription className="text-indigo-100 text-base max-w-lg">
                    Capture milestones with notes, photos, or quick videos. Your entries stay private and help you keep a clean timeline.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleExport} className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white backdrop-blur-sm">
                    <Download className="mr-2 h-3.5 w-3.5" /> Export
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleResetSamples} className="text-white/70 hover:text-white hover:bg-white/10">
                    Reset
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/10 border border-white/10 p-4 backdrop-blur-md">
                  <p className="text-[10px] uppercase tracking-wider text-white/70">Total Entries</p>
                  <p className="text-3xl font-bold">{entries.length}</p>
                </div>
                <div className="rounded-2xl bg-white/10 border border-white/10 p-4 backdrop-blur-md">
                  <p className="text-[10px] uppercase tracking-wider text-white/70">With Media</p>
                  <p className="text-3xl font-bold">{entries.filter((e) => e.media.length > 0).length}</p>
                </div>
                <div className="rounded-2xl bg-white/10 border border-white/10 p-4 backdrop-blur-md">
                  <p className="text-[10px] uppercase tracking-wider text-white/70">Current View</p>
                  <p className="text-3xl font-bold">{filteredTabCount}</p>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="glass-card flex flex-col justify-center">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-primary" /> Monthly Activity
              </CardTitle>
              <CardDescription>Frequency of your entries over time.</CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsData.length > 0 ? (
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analyticsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                      <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ background: "rgba(255, 255, 255, 0.)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "12px", backdropFilter: "blur(10px)" }}
                        labelStyle={{ color: "var(--foreground)" }}
                      />
                      <Area type="monotone" dataKey="count" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorCount)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-muted">
                  Start logging to see your trends!
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight">Timeline</h2>
              <p className="text-muted-foreground">Your journey, recorded step by step.</p>
            </div>

            <Tabs
              value={activeTab}
              onValueChange={(val) => {
                const next = val as AchievementCategory | "all";
                setActiveTab(next);
                saveStoredTab(next);
              }}
              className="w-full md:w-auto"
            >
              <TabsList className="bg-muted/50 p-1">
                <TabsTrigger value="all" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-800">All</TabsTrigger>
                <TabsTrigger value="goals" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-800">Goals</TabsTrigger>
                <TabsTrigger value="progress" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-800">Progress</TabsTrigger>
                <TabsTrigger value="reflections" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-800">Reflections</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <Card className="glass-card">
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search entries..."
                    value={filters.search}
                    onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                    className="pl-9 bg-background/50 border-border/50"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Input
                    type="date"
                    value={filters.from}
                    onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
                    className="w-auto bg-background/50 border-border/50"
                  />
                  <span className="self-center text-xs text-muted-foreground">to</span>
                  <Input
                    type="date"
                    value={filters.to}
                    onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
                    className="w-auto bg-background/50 border-border/50"
                  />
                </div>
                <Select
                  value={filters.media}
                  onValueChange={(val) => setFilters((prev) => ({ ...prev, media: val as "any" | "with" | "without" }))}
                >
                  <SelectTrigger className="w-[140px] bg-background/50 border-border/50">
                    <SelectValue placeholder="Media" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Media</SelectItem>
                    <SelectItem value="with">With Media</SelectItem>
                    <SelectItem value="without">Text Only</SelectItem>
                  </SelectContent>
                </Select>
                {(filters.search || filters.from || filters.to || filters.media !== "any" || filters.category !== "all") && (
                  <Button variant="ghost" size="icon" onClick={() => setFilters({ search: "", category: "all", from: "", to: "", media: "any" })} title="Clear filters">
                    <Filter className="h-4 w-4" />
                    <span className="sr-only">Clear</span>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {filteredEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center space-y-3 rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
                  <p>No entries match the current filters.</p>
                  <Button onClick={openNewEntry}>Create your first entry</Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredEntries.map((entry) => (
                    <Card key={entry.id} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:bg-white/10 dark:bg-slate-800/30 dark:hover:bg-slate-800/50">
                      <CardHeader className="space-y-3 pb-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="capitalize bg-primary/10 text-primary hover:bg-primary/20">
                            {CATEGORY_LABELS[entry.category]}
                          </Badge>
                          <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" /> {format(new Date(entry.createdAt), "MMM d, yyyy")}
                          </span>
                        </div>
                        <CardTitle className="text-lg font-semibold leading-tight">{entry.title}</CardTitle>
                        <CardDescription className="line-clamp-3 text-sm leading-relaxed text-muted-foreground/80">
                          {entry.description}
                        </CardDescription>
                      </CardHeader>
                      {entry.media.length > 0 && (
                        <div className="mx-6 mb-2 overflow-hidden rounded-xl border border-white/10 shadow-sm relative aspect-video group-hover:scale-[1.02] transition-transform">
                          {entry.media[0].type === "image" ? (
                            <img src={entry.media[0].url} alt={entry.media[0].name || entry.title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="relative h-full w-full bg-black/10 flex items-center justify-center">
                              <video src={entry.media[0].url} className="h-full w-full object-cover" />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <Plus className="h-8 w-8 text-white opacity-70" />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <CardContent className="mt-auto pt-0 pb-4 px-6">
                        <div className="my-3 h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />
                        <div className="flex items-center justify-between gap-2">
                          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => setViewEntry(entry)}>
                            View Details
                          </Button>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleEdit(entry)}>
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(entry.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit entry" : "New achievement"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={formState.title} onChange={(e) => setFormState((prev) => ({ ...prev, title: e.target.value }))} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select
                  value={formState.category}
                  onValueChange={(val) => setFormState((prev) => ({ ...prev, category: val as AchievementCategory }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="goals">Goals</SelectItem>
                    <SelectItem value="progress">Progress</SelectItem>
                    <SelectItem value="reflections">Reflections</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={formState.date}
                  onChange={(e) => setFormState((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description / Reflection</Label>
              <Textarea
                id="description"
                rows={5}
                value={formState.description}
                onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Media uploads</Label>
              <div className="flex items-center gap-3">
                <Button variant="outline" className="gap-2" onClick={() => document.getElementById("achievement-media")?.click()}>
                  <Upload className="h-4 w-4" /> Add photo/video
                </Button>
                <Input
                  id="achievement-media"
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => void handleMediaUpload(e.target.files)}
                />
                <span className="text-xs text-muted-foreground">JPG, PNG, MP4, MOV supported</span>
              </div>
              {formState.media.length > 0 && (
                <ScrollArea className="max-h-40 rounded-lg border p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {formState.media.map((media) => (
                      <div key={media.id} className="relative overflow-hidden rounded-lg border">
                        {media.type === "image" ? (
                          <img src={media.url} alt={media.name || "uploaded"} className="h-28 w-full object-cover" />
                        ) : (
                          <video src={media.url} className="h-28 w-full object-cover" controls />
                        )}
                        <button
                          type="button"
                          className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white"
                          onClick={() =>
                            setFormState((prev) => ({
                              ...prev,
                              media: prev.media.filter((item) => item.id !== media.id),
                            }))
                          }
                        >
                          ×
                        </button>
                        <p className="truncate px-3 py-2 text-xs font-medium">{media.name || "Attachment"}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>{editingId ? "Save changes" : "Save entry"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewEntry} onOpenChange={(open) => !open && setViewEntry(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" /> {viewEntry?.title}
            </DialogTitle>
            <CardDescription className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="capitalize">
                {viewEntry ? CATEGORY_LABELS[viewEntry.category] : ""}
              </Badge>
              <CalendarIcon className="h-4 w-4" />
              {viewEntry ? format(new Date(viewEntry.createdAt), "PPP") : null}
            </CardDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{viewEntry?.description}</p>
            {viewEntry?.media.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {viewEntry.media.map((media) => (
                  <div key={media.id} className="overflow-hidden rounded-xl border">
                    {media.type === "image" ? (
                      <img src={media.url} alt={media.name || viewEntry.title} className="h-56 w-full object-cover" />
                    ) : (
                      <video src={media.url} controls className="h-56 w-full object-cover" />
                    )}
                    <div className="border-t px-3 py-2 text-xs text-muted-foreground">{media.name || "Attachment"}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No media attached.</div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setViewEntry(null)}>
              Close
            </Button>
            {viewEntry && (
              <Button variant="outline" onClick={() => handleEdit(viewEntry)}>
                <Edit3 className="mr-2 h-4 w-4" /> Edit
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
