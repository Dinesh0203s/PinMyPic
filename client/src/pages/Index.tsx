
import { useEffect } from 'react';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import PhotographyShowcase from '@/components/PhotographyShowcase';
import EventTypes from '@/components/EventTypes';
import EventsPreview from '@/components/EventsPreview';
import FindMyFaceSection from '@/components/FindMyFaceSection';
import Footer from '@/components/Footer';

const Index = () => {
  // Scroll to top when page loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <PhotographyShowcase />
        <EventTypes />
        <EventsPreview />
        <FindMyFaceSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
