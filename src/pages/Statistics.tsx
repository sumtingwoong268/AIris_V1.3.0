import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, TrendingDown, Award, Target, Calendar } from "lucide-react";

export default function Statistics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [testHistory, setTestHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTestHistory();
    }
  }, [user]);

  const fetchTestHistory = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("test_results")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    setTestHistory(data || []);
    setLoading(false);
  };

  const getTestTypeData = (type: string) => {
    const tests = testHistory.filter(t => t.test_type === type);
    const scores = tests.map(t => t.score || 0);
    const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 0;
    const latest = tests.length ? tests[tests.length - 1].score : 0;
    const trend = tests.length >= 2 ? latest - tests[tests.length - 2].score : 0;
    
    return { tests, avg, latest, trend, count: tests.length };
  };

  const testTypes = [
    { key: "ishihara", name: "Ishihara Color Test", color: "bg-red-500", icon: "🎨" },
    { key: "acuity", name: "Visual Acuity Test", color: "bg-blue-500", icon: "👁️" },
    { key: "amsler", name: "Amsler Grid Test", color: "bg-green-500", icon: "📐" },
    { key: "reading_stress", name: "Reading Stress Test", color: "bg-purple-500", icon: "📖" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto p-6 max-w-6xl">
        <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-4">
          <ArrowLeft className="mr-2" /> Back to Dashboard
        </Button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            📊 Your Statistics
          </h1>
          <p className="text-muted-foreground">Track your progress and improve your eye health</p>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : (
          <>
            {/* Overall Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Target className="w-4 h-4" /> Total Tests
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{testHistory.length}</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Award className="w-4 h-4" /> Average Score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {testHistory.length 
                      ? ((testHistory.reduce((sum, t) => sum + (t.score || 0), 0) / testHistory.length).toFixed(1))
                      : 0}%
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> This Month
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {testHistory.filter(t => {
                      const testDate = new Date(t.created_at);
                      const now = new Date();
                      return testDate.getMonth() === now.getMonth() && testDate.getFullYear() === now.getFullYear();
                    }).length}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Per Test Type Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {testTypes.map(({ key, name, color, icon }) => {
                const data = getTestTypeData(key);
                
                return (
                  <Card key={key} className="overflow-hidden">
                    <div className={`${color} text-white p-4 flex items-center justify-between`}>
                      <div>
                        <h3 className="text-xl font-bold flex items-center gap-2">
                          <span className="text-2xl">{icon}</span>
                          {name}
                        </h3>
                        <p className="text-sm opacity-90">
                          {data.count} test{data.count !== 1 ? 's' : ''} completed
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold">{data.latest}%</div>
                        <div className="text-xs flex items-center gap-1 justify-end">
                          {data.trend > 0 ? <TrendingUp className="w-4 h-4" /> : data.trend < 0 ? <TrendingDown className="w-4 h-4" /> : null}
                          {data.trend !== 0 && <span>{Math.abs(data.trend).toFixed(1)}%</span>}
                        </div>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Average Score</span>
                          <span className="font-semibold">{data.avg}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Best Score</span>
                          <span className="font-semibold text-green-600">
                            {data.tests.length ? Math.max(...data.tests.map(t => t.score || 0)).toFixed(1) : 0}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Latest Score</span>
                          <span className="font-semibold">{data.latest}%</span>
                        </div>
                        
                        {/* Mini Progress Chart */}
                        {data.tests.length > 0 && (
                          <div className="mt-4">
                            <div className="text-xs text-muted-foreground mb-2">Progress Over Time</div>
                            <div className="flex items-end gap-1 h-20">
                              {data.tests.slice(-10).map((test, idx) => {
                                const height = (test.score || 0);
                                return (
                                  <div
                                    key={idx}
                                    className={`flex-1 ${color} opacity-70 rounded-t transition-all hover:opacity-100`}
                                    style={{ height: `${height}%` }}
                                    title={`${test.score}% - ${new Date(test.created_at).toLocaleDateString()}`}
                                  />
                                );
                              })}
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                              <span>Oldest</span>
                              <span>Latest</span>
                            </div>
                          </div>
                        )}

                        {data.tests.length === 0 && (
                          <div className="text-center py-4 text-muted-foreground text-sm">
                            No tests completed yet
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Recent Test History */}
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>Recent Test History</CardTitle>
              </CardHeader>
              <CardContent>
                {testHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No test history yet. Complete some tests to see your progress!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {testHistory.slice(-15).reverse().map((test, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="text-2xl">
                            {testTypes.find(t => t.key === test.test_type)?.icon || "📝"}
                          </div>
                          <div>
                            <div className="font-medium">
                              {testTypes.find(t => t.key === test.test_type)?.name || test.test_type}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(test.created_at).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-bold ${
                            test.score >= 80 ? "text-green-600" : test.score >= 60 ? "text-yellow-600" : "text-red-600"
                          }`}>
                            {test.score}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            +{test.xp_earned || 0} XP
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
