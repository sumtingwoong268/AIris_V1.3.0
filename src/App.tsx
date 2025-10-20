import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Friends from "./pages/Friends";
import Reports from "./pages/Reports";
import Blogs from "./pages/Blogs";
import BlogArticle from "./pages/BlogArticle";
import Setup from "./pages/Setup";
import Statistics from "./pages/Statistics";
import IshiharaTest from "./pages/tests/IshiharaTest";
import VisualAcuityTest from "./pages/tests/VisualAcuityTest";
import AmslerTest from "./pages/tests/AmslerTest";
import ReadingStressTest from "./pages/tests/ReadingStressTest";
import ManageBlogs from "./pages/ManageBlogs";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Auth />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/blogs" element={<Blogs />} />
          <Route path="/blogs/:slug" element={<BlogArticle />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/tests/ishihara" element={<IshiharaTest />} />
          <Route path="/tests/visual-acuity" element={<VisualAcuityTest />} />
          <Route path="/tests/amsler" element={<AmslerTest />} />
          <Route path="/tests/reading-stress" element={<ReadingStressTest />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
