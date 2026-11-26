import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MobileBottomNav from "@/components/MobileBottomNav";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import Index from "./pages/Index.tsx";
import About from "./pages/About.tsx";
import Events from "./pages/Events.tsx";
import EventDetail from "./pages/EventDetail.tsx";
import Programs from "./pages/Programs.tsx";
import Projects from "./pages/ProjectsShowcase.tsx";
import Services from "./pages/Services.tsx";
import Blog from "./pages/Blog.tsx";
import BlogPost from "./pages/BlogPost.tsx";
import Contact from "./pages/Contact.tsx";
import Auth from "./pages/Auth.tsx";
import ForgotPassword from "./pages/ForgotPassword.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import NotFound from "./pages/NotFound.tsx";
import ProtectedRoute from "./components/ProtectedRoute.tsx";
import AdminRoute from "./components/AdminRoute.tsx";
import CookieConsent from "./components/CookieConsent.tsx";
import AIAssistant from "./components/AIAssistant.tsx";
import OfflineBanner from "./components/OfflineBanner.tsx";
import { useAnalytics } from "@/hooks/useAnalytics";

// Secondary public & authenticated pages lazy-loaded for optimal initial bundle size.
const ProjectSubmit = lazy(() => import("./pages/ProjectSubmit.tsx"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail.tsx"));
const Profile = lazy(() => import("./pages/Profile.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const AccountSecurity = lazy(() => import("./pages/AccountSecurity.tsx"));
const VerifyCertificate = lazy(() => import("./pages/VerifyCertificate.tsx"));
const CertificatePrint = lazy(() => import("./pages/CertificatePrint.tsx"));
const CertificateShare = lazy(() => import("./pages/CertificateShare.tsx"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy.tsx"));
const TermsOfService = lazy(() => import("./pages/TermsOfService.tsx"));
const Install = lazy(() => import("./pages/Install.tsx"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe.tsx"));
const Leaderboard = lazy(() => import("./pages/Leaderboard.tsx"));
const Mentors = lazy(() => import("./pages/Mentors.tsx"));
const BecomeMentor = lazy(() => import("./pages/BecomeMentor.tsx"));
const MentorAvailability = lazy(() => import("./pages/MentorAvailability.tsx"));
const Messages = lazy(() => import("./pages/Messages.tsx"));
const Forum = lazy(() => import("./pages/Forum.tsx"));
const ForumCategory = lazy(() => import("./pages/ForumCategory.tsx"));
const ForumThread = lazy(() => import("./pages/ForumThread.tsx"));
const ForumNew = lazy(() => import("./pages/ForumNew.tsx"));
const Search = lazy(() => import("./pages/Search.tsx"));
const Teams = lazy(() => import("./pages/Teams.tsx"));
const JudgeAccept = lazy(() => import("./pages/JudgeAccept.tsx"));
const EventResults = lazy(() => import("./pages/EventResults.tsx"));
const EventRegister = lazy(() => import("./pages/EventRegister.tsx"));
const TeamPortal = lazy(() => import("./pages/TeamPortal.tsx"));
const SponsorPortal = lazy(() => import("./pages/SponsorPortal.tsx"));

// Admin bundle is lazy-loaded to keep the public entry lean.
const AdminLayout = lazy(() => import("./layouts/AdminLayout.tsx"));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview.tsx"));
const AdminEvents = lazy(() => import("./pages/admin/AdminEvents.tsx"));
const AdminBlog = lazy(() => import("./pages/admin/AdminBlog.tsx"));
const AdminParticipants = lazy(() => import("./pages/admin/AdminParticipants.tsx"));
const AdminCheckIn = lazy(() => import("./pages/admin/AdminCheckIn.tsx"));
const AdminEventAnalytics = lazy(() => import("./pages/admin/AdminEventAnalytics.tsx"));
const AdminCertificates = lazy(() => import("./pages/admin/AdminCertificates.tsx"));
const AdminCertificateTemplate = lazy(() => import("./pages/admin/AdminCertificateTemplate.tsx"));
const AdminCertificateBulk = lazy(() => import("./pages/admin/AdminCertificateBulk.tsx"));
const AdminCertificateAudit = lazy(() => import("./pages/admin/AdminCertificateAudit.tsx"));
const AdminAuthAudit = lazy(() => import("./pages/admin/AdminAuthAudit.tsx"));
const AdminMetaChecker = lazy(() => import("./pages/admin/AdminMetaChecker.tsx"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers.tsx"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics.tsx"));
const AdminActivity = lazy(() => import("./pages/admin/AdminActivity.tsx"));
const AdminProjects = lazy(() => import("./pages/admin/AdminProjects.tsx"));
const AdminJudging = lazy(() => import("./pages/admin/AdminJudging.tsx"));
const AdminJudgeInvitations = lazy(() => import("./pages/admin/AdminJudgeInvitations.tsx"));
const AdminComments = lazy(() => import("./pages/admin/AdminComments.tsx"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings.tsx"));
const AdminNewsletter = lazy(() => import("./pages/admin/AdminNewsletter.tsx"));
const AdminImpersonate = lazy(() => import("./pages/admin/AdminImpersonate.tsx"));
const AdminOgPreview = lazy(() => import("./pages/admin/AdminOgPreview.tsx"));
const AdminEventParticipants = lazy(() => import("./pages/admin/AdminEventParticipants.tsx"));
const AdminEventFeedback = lazy(() => import("./pages/admin/AdminEventFeedback.tsx"));
const AdminModeration = lazy(() => import("./pages/admin/AdminModeration.tsx"));
const AdminRegistrations = lazy(() => import("./pages/admin/AdminRegistrations.tsx"));
const AdminAnnouncements = lazy(() => import("./pages/admin/AdminAnnouncements.tsx"));
const AdminEventPeople = lazy(() => import("./pages/admin/AdminEventPeople.tsx"));
const AdminSponsors = lazy(() => import("./pages/admin/AdminSponsors.tsx"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error: unknown) => {
        const status = (error as { status?: number })?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

const AdminFallback = () => (
  <div className="p-8 text-sm text-muted-foreground" role="status" aria-live="polite">
    Loading admin…
  </div>
);

const PageFallback = () => (
  <div className="min-h-[60vh] flex items-center justify-center p-8 text-sm text-muted-foreground" role="status" aria-live="polite">
    Loading page…
  </div>
);

const AnalyticsTracker = () => {
  useAnalytics();
  return null;
};

const PublicLayout = () => {
  const location = useLocation();
  return (
    <>
      <Navbar />
      <div id="main-content" tabIndex={-1}>
        <RouteErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/about" element={<About />} />
              <Route path="/events" element={<Events />} />
              <Route path="/events/:slug" element={<EventDetail />} />
              <Route path="/events/:slug/register" element={<EventRegister />} />
              <Route path="/register" element={<EventRegister />} />
              <Route path="/team-portal" element={<ProtectedRoute><TeamPortal /></ProtectedRoute>} />
              <Route path="/sponsor-portal" element={<ProtectedRoute><SponsorPortal /></ProtectedRoute>} />
              <Route path="/events/:slug/results" element={<EventResults />} />
              <Route path="/teams" element={<Teams />} />
              <Route path="/judge/accept/:token" element={<JudgeAccept />} />
              <Route path="/programs" element={<Programs />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/submit" element={<ProtectedRoute><ProjectSubmit /></ProtectedRoute>} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/services" element={<Services />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verify" element={<VerifyCertificate />} />
              <Route path="/verify/:certificateNumber" element={<VerifyCertificate />} />
              <Route path="/certificate/:certificateNumber/print" element={<CertificatePrint />} />
              <Route path="/certificate/share/:token" element={<CertificateShare />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/install" element={<Install />} />
              <Route path="/unsubscribe" element={<Unsubscribe />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/mentors" element={<Mentors />} />
              <Route path="/mentors/become" element={<ProtectedRoute><BecomeMentor /></ProtectedRoute>} />
              <Route path="/mentors/availability" element={<ProtectedRoute><MentorAvailability /></ProtectedRoute>} />
              <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/account/security" element={<ProtectedRoute><AccountSecurity /></ProtectedRoute>} />
              <Route path="/forum" element={<Forum />} />
              <Route path="/forum/c/:slug" element={<ForumCategory />} />
              <Route path="/forum/t/:id" element={<ForumThread />} />
              <Route path="/forum/new" element={<ProtectedRoute><ForumNew /></ProtectedRoute>} />
              <Route path="/search" element={<Search />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </RouteErrorBoundary>
      </div>
      <Footer />
      <AIAssistant />
      <MobileBottomNav />
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AnalyticsTracker />
        <OfflineBanner />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg"
        >
          Skip to main content
        </a>
        <AuthProvider>
          <Routes>
            {/* Admin routes */}
            <Route
              path="/admin"
              element={
                <AdminRoute requireMfa>
                  <Suspense fallback={<AdminFallback />}>
                    <AdminLayout />
                  </Suspense>
                </AdminRoute>
              }
            >
              <Route index element={<AdminOverview />} />
              <Route path="events" element={<AdminEvents />} />
              <Route path="events/:eventId/participants" element={<AdminEventParticipants />} />
              <Route path="events/:eventId/feedback" element={<AdminEventFeedback />} />
              <Route path="registrations" element={<AdminRegistrations />} />
              <Route path="announcements" element={<AdminAnnouncements />} />
              <Route path="event-people" element={<AdminEventPeople />} />
              <Route path="sponsors" element={<AdminSponsors />} />
              <Route path="blog" element={<AdminBlog />} />
              <Route path="participants" element={<AdminParticipants />} />
              <Route path="checkin" element={<AdminCheckIn />} />
              <Route path="event-analytics" element={<AdminEventAnalytics />} />
              <Route path="certificates" element={<AdminCertificates />} />
              <Route path="certificates/template" element={<AdminCertificateTemplate />} />
              <Route path="certificates/bulk" element={<AdminCertificateBulk />} />
              <Route path="certificates/audit" element={<AdminCertificateAudit />} />
              <Route path="auth-audit" element={<AdminAuthAudit />} />
              <Route path="meta-checker" element={<AdminMetaChecker />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="activity" element={<AdminActivity />} />
              <Route path="projects" element={<AdminProjects />} />
              <Route path="judging" element={<AdminJudging />} />
              <Route path="judging/invitations" element={<AdminJudgeInvitations />} />
              <Route path="comments" element={<AdminComments />} />
              <Route path="moderation" element={<AdminModeration />} />
              <Route path="newsletter" element={<AdminNewsletter />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="og-preview" element={<AdminOgPreview />} />
              <Route path="impersonate/:userId" element={<AdminImpersonate />} />
            </Route>

            {/* Public routes */}
            <Route path="*" element={<PublicLayout />} />
          </Routes>
        </AuthProvider>
        <CookieConsent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
