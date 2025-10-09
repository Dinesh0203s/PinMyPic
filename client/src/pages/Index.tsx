
import { useEffect } from 'react';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import PhotographyShowcase from '@/components/PhotographyShowcase';
import EventTypes from '@/components/EventTypes';
import EventsPreview from '@/components/EventsPreview';
import FindMyFaceSection from '@/components/FindMyFaceSection';
import Footer from '@/components/Footer';
import SEOHead from '@/components/SEOHead';

const Index = () => {
  // Scroll to top when page loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Structured data for the homepage
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "PinMyPic",
    "description": "Professional photography services with AI-powered face recognition technology",
    "url": "https://pinmypic.com",
    "logo": "https://pinmypic.com/logo.png",
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+91-9025943634",
      "contactType": "customer service",
      "email": "Dinesh@pinmypic.com"
    },
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Coimbatore",
      "addressRegion": "Tamil Nadu",
      "addressCountry": "IN"
    },
    "sameAs": [
      "https://pinmypic.com"
    ],
    "service": [
      {
        "@type": "Service",
        "name": "Wedding Photography",
        "description": "Professional wedding photography with AI face recognition"
      },
      {
        "@type": "Service", 
        "name": "Corporate Event Photography",
        "description": "Corporate event photography with instant photo finding"
      },
      {
        "@type": "Service",
        "name": "AI Face Recognition",
        "description": "Find yourself in thousands of event photos instantly"
      }
    ]
  };

  return (
    <div className="min-h-screen">
      <SEOHead 
        title="PinMyPic - AI-Powered Photography & Face Recognition | Professional Event Photography"
        description="Professional photography services with AI-powered face recognition technology. Find yourself in event photos instantly. Wedding, corporate, and party photography in Coimbatore, Tamil Nadu."
        keywords="photography, face recognition, AI photography, event photography, wedding photography, corporate events, photo gallery, Coimbatore photography, Tamil Nadu, professional photographer, photo booking, instant photo finder"
        structuredData={structuredData}
      />
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
