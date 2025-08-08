
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import { Suspense, lazy } from "react";
import LoadingSpinner from "./components/LoadingSpinner";

// Lazy load all pages for better performance
const Index = lazy(() => import("./pages/Index"));
const Events = lazy(() => import("./pages/Events"));
const FindMyFace = lazy(() => import("./pages/FindMyFace"));
const Booking = lazy(() => import("./pages/Booking"));
const Contact = lazy(() => import("./pages/Contact"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const AlertExamples = lazy(() => import("./components/examples/AlertExamples"));

const QRAccess = lazy(() => import("./components/QRAccess"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ProtectedRoute = lazy(() => import("./components/ProtectedRoute"));
// Import AdminStatusNotification normally since it's always needed
import { AdminStatusNotification } from "./components/AdminStatusNotification";

// Optimized query client with performance settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AdminStatusNotification />
            <BrowserRouter>
              <Suspense fallback={<LoadingSpinner />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/events" element={<Events />} />
                  <Route path="/event/:eventId" element={<Events />} />
                  <Route path="/findmyface" element={<FindMyFace />} />
                  <Route path="/contact" element={<Contact />} />

                  <Route path="/booking" element={
                    <ProtectedRoute>
                      <Booking />
                    </ProtectedRoute>
                  } />
                  <Route path="/profile" element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin" element={
                    <ProtectedRoute requireAdmin>
                      <AdminDashboard />
                    </ProtectedRoute>
                  } />

                  <Route path="/qr-access/:eventId" element={<QRAccess />} />
                  <Route path="/alerts" element={<AlertExamples />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
