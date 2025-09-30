import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import { hasAdminDashboardAccess } from '@/utils/adminUtils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogIn, User } from 'lucide-react';
import Header from './Header';
import Footer from './Footer';
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  showSignInMessage?: boolean;
}

const ProtectedRoute = ({ children, requireAdmin = false, showSignInMessage = true }: ProtectedRouteProps) => {
  const { currentUser, userData, loading, loginWithGoogle } = useAuth();
  const location = useLocation();

  // Scroll to top when component mounts or location changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Don't show loading if we have a current user
  if (loading && !currentUser) {
    return <LoadingSpinner message="Authenticating..." />;
  }

  if (!currentUser) {
    // Show sign-in message for booking page and other protected routes
    if (showSignInMessage) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
          <Header />
          <main className="pt-20">
            <div className="container mx-auto px-4 py-16">
              <div className="max-w-md mx-auto">
                <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
                  <CardContent className="p-8 text-center">
                    <div className="w-20 h-20 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                      <User className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold mb-4">
                      <span className="bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 bg-clip-text text-transparent">
                        Sign In Required
                      </span>
                    </h2>
                    <p className="text-gray-600 mb-8 leading-relaxed">
                      Please sign in to access {location.pathname === '/booking' ? 'the booking page' : 'this page'}. 
                      We need to verify your identity to continue.
                    </p>
                    <Button 
                      onClick={loginWithGoogle}
                      className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white py-3 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
                    >
                      <LogIn className="w-5 h-5 mr-2" />
                      Sign In with Google
                    </Button>
                    <p className="text-sm text-gray-500 mt-6 leading-relaxed">
                      Your information is secure and will only be used for booking purposes.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
          <Footer />
        </div>
      );
    }
    
    return <Navigate to="/" replace />;
  }

  // Check if user has admin access
  if (requireAdmin) {
    // Wait for userData to be loaded before checking admin access
    if (!userData) {
      return <LoadingSpinner message="Loading user data..." />;
    }
    
    const hasAdminAccess = hasAdminDashboardAccess(userData);
    
    if (!hasAdminAccess) {
      console.log('Admin access denied for user');
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;