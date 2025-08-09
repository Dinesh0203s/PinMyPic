import { useEffect } from 'react';
import { useLocation } from 'wouter';

// Global scroll-to-top component for page navigation
const ScrollToTop: React.FC = () => {
  const [location] = useLocation();

  useEffect(() => {
    // Scroll to top on route change
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant' // Instant for route changes
    });
  }, [location]);

  return null;
};

export default ScrollToTop;