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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="border-b border-border/40 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex cursor-pointer items-center gap-3" onClick={() => navigate("/dashboard")}>
              <img src={logo} alt="AIris" className="h-10" />
              <div className="flex flex-col">
                <span className="text-lg font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">AIris</span>
                <span className="text-[10px] text-muted-foreground -mt-1">Long-term achievements</span>
              </div>
            </div>
          </div>
          <Button onClick={openNewEntry} className="rounded-full">
            <Plus className="mr-2 h-4 w-4" /> New Entry
          </Button>
        </div>
      </header>

      <main className="container mx-auto space-y-8 px-4 py-10">
        <div className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
          <Card className="border-primary/20 bg-white/80 shadow-lg backdrop-blur dark:bg-slate-900/80">
            <CardHeader className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3rem] text-primary">Achievements</p>
                  <CardTitle className="text-3xl">Log goals, progress, and reflections</CardTitle>
                  <CardDescription>
                    Capture milestones with notes, photos, or quick videos. Your entries stay private and help you keep a clean timeline.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleExport}>
                    <Download className="mr-2 h-4 w-4" /> Export JSON
                  </Button>
                  <Button variant="ghost" onClick={handleResetSamples}>
                    Reset samples
                  </Button>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-blue-100 p-4 dark:from-primary/15 dark:to-blue-950/40">
                  <p className="text-xs uppercase tracking-wide text-primary">Entries</p>
                  <p className="text-3xl font-semibold">{entries.length}</p>
                  <p className="text-xs text-muted-foreground">Total logged items</p>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 p-4 dark:from-emerald-900/50 dark:to-emerald-800/40">
                  <p className="text-xs uppercase tracking-wide text-emerald-600">With media</p>
                  <p className="text-3xl font-semibold">{entries.filter((e) => e.media.length > 0).length}</p>
                  <p className="text-xs text-muted-foreground">Photos or videos attached</p>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-indigo-100 to-fuchsia-50 p-4 dark:from-indigo-900/40 dark:to-fuchsia-900/30">
                  <p className="text-xs uppercase tracking-wide text-indigo-600">Current view</p>
                  <p className="text-3xl font-semibold">{filteredTabCount}</p>
                  <p className="text-xs text-muted-foreground">Matching selected tab</p>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="border-primary/20 bg-white/80 shadow-lg backdrop-blur dark:bg-slate-900/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-primary" /> Entries per month
              </CardTitle>
              <CardDescription>Quick glance at how frequently you capture achievements.</CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={analyticsData} margin={{ left: 0, right: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                    <XAxis dataKey="label" stroke="currentColor" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} stroke="currentColor" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: "rgba(15,23,42,0.85)", color: "white", borderRadius: 12 }} />
                    <Area type="monotone" dataKey="count" stroke="#6366f1" fill="#c7d2fe" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
                  Start logging entries to see your monthly cadence.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-primary/15 bg-white/80 shadow-lg backdrop-blur dark:bg-slate-900/80">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-2xl">Timeline</CardTitle>
              <Tabs
                value={activeTab}
                onValueChange={(val) => {
                  const next = val as AchievementCategory | "all";
                  setActiveTab(next);
                  saveStoredTab(next);
                }}
                className="w-full md:w-auto"
              >
                <TabsList className="grid w-full grid-cols-4 md:w-[480px]">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="goals">Goals</TabsTrigger>
                  <TabsTrigger value="progress">Progress</TabsTrigger>
                  <TabsTrigger value="reflections">Reflections</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-xl border bg-white px-3 py-2 shadow-sm dark:bg-slate-900">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search titles or descriptions"
                  value={filters.search}
                  onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                  className="border-0 shadow-none focus-visible:ring-0"
                />
              </div>
              <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-xl border bg-white px-3 py-2 shadow-sm dark:bg-slate-900">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={filters.from}
                  onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
                  className="border-0 shadow-none focus-visible:ring-0"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={filters.to}
                  onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
                  className="border-0 shadow-none focus-visible:ring-0"
                />
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border bg-white px-3 py-3 shadow-sm dark:bg-slate-900 sm:justify-between">
                <Select
                  value={filters.media}
                  onValueChange={(val) => setFilters((prev) => ({ ...prev, media: val as "any" | "with" | "without" }))}
                >
                  <SelectTrigger className="min-w-[140px] flex-1 sm:flex-none">
                    <SelectValue placeholder="Media" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any media</SelectItem>
                    <SelectItem value="with">Has media</SelectItem>
                    <SelectItem value="without">No media</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filters.category}
                  onValueChange={(val) => setFilters((prev) => ({ ...prev, category: val as AchievementCategory | "all" }))}
                >
                  <SelectTrigger className="min-w-[140px] flex-1 sm:flex-none">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="goals">Goals</SelectItem>
                    <SelectItem value="progress">Progress</SelectItem>
                    <SelectItem value="reflections">Reflections</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" className="flex-1 gap-2 sm:flex-none" onClick={() => setFilters({ search: "", category: "all", from: "", to: "", media: "any" })}>
                  <Filter className="h-4 w-4" />
                  Clear filters
                </Button>
                <Button className="flex-1 sm:flex-none" onClick={openNewEntry}>
                  <Plus className="mr-2 h-4 w-4" /> New Entry
                </Button>
              </div>
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
                  <Card key={entry.id} className="group flex h-full flex-col border-border/60 bg-white/90 shadow-md transition hover:-translate-y-1 hover:shadow-xl dark:bg-slate-900/80">
                    <CardHeader className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="capitalize">
                          {CATEGORY_LABELS[entry.category]}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <CalendarIcon className="h-4 w-4" /> {format(new Date(entry.createdAt), "PPP")}
                        </span>
                      </div>
                      <CardTitle className="text-xl">{entry.title}</CardTitle>
                      <CardDescription className="line-clamp-3 text-sm leading-relaxed">
                        {entry.description}
                      </CardDescription>
                    </CardHeader>
                    {entry.media.length > 0 && (
                      <div className="mx-4 overflow-hidden rounded-xl border">
                        {entry.media[0].type === "image" ? (
                          <img src={entry.media[0].url} alt={entry.media[0].name || entry.title} className="h-40 w-full object-cover" />
                        ) : (
                          <video src={entry.media[0].url} controls className="h-40 w-full object-cover" />
                        )}
                      </div>
                    )}
                    <CardContent className="mt-auto space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {entry.media.map((media) => (
                          <Badge key={media.id} variant="secondary" className="flex items-center gap-1">
                            <span className="text-xs uppercase">{mediaIcon(media.type)}</span>
                            {media.name || "Attachment"}
                          </Badge>
                        ))}
                        {entry.media.length === 0 && <Badge variant="secondary">Text only</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => setViewEntry(entry)}>
                          <Eye className="mr-2 h-4 w-4" /> View Full Entry
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(entry)}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
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
