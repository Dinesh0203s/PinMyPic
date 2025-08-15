
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import { Suspense, lazy, useEffect } from "react";
import LoadingSpinner from "./components/LoadingSpinner";
import ScrollToTop from "./components/ScrollToTop";
import PerformanceMonitor from "./components/PerformanceMonitor";
import { initializePerformanceOptimizations } from "./utils/performanceOptimizations";

// Lazy load all pages for better performance
const Index = lazy(() => import("./pages/Index"));
const Events = lazy(() => import("./pages/Events"));
const FindMyFace = lazy(() => import("./pages/FindMyFace"));
const Booking = lazy(() => import("./pages/Booking"));
const Contact = lazy(() => import("./pages/Contact"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const SavedPhotos = lazy(() => import("./pages/SavedPhotos"));
const AlertExamples = lazy(() => import("./components/examples/AlertExamples"));

const QRAccess = lazy(() => import("./components/QRAccess"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ProtectedRoute = lazy(() => import("./components/ProtectedRoute"));
// Import AdminStatusNotification normally since it's always needed
import { AdminStatusNotification } from "./components/AdminStatusNotification";

// Optimized query client with enhanced performance settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error && typeof error === 'object' && 'status' in error) {
          const status = (error as any).status;
          if (status >= 400 && status < 500) return false;
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Enable background refetch for better UX
      refetchOnMount: 'always',
      refetchInterval: false,
      // Network-aware configurations
      networkMode: 'offlineFirst',
    },
    mutations: {
      // Optimize mutation retries
      retry: (failureCount, error) => {
        if (error && typeof error === 'object' && 'status' in error) {
          const status = (error as any).status;
          if (status >= 400 && status < 500) return false;
        }
        return failureCount < 1;
      },
      networkMode: 'offlineFirst',
    },
  },
});

// Use the imported ScrollToTop component

const App = () => {
  useEffect(() => {
    // Initialize performance optimizations
    initializePerformanceOptimizations();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AdminStatusNotification />
            <PerformanceMonitor />
            <BrowserRouter>
              <ScrollToTop />
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
                  <Route path="/saved-photos" element={
                    <ProtectedRoute>
                      <SavedPhotos />
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
