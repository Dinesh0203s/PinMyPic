import { useEffect } from 'react';
import SEOHead from '@/components/SEOHead';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const Brand = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const brandStructuredData = {
    "@context": "https://schema.org",
    "@type": "Brand",
    "name": "PinMyPic",
    "alternateName": ["Pin My Pic", "PinMPic", "pinmpic", "pinmypic"],
    "description": "PinMyPic (PinMPic) - Professional photography services with AI-powered face recognition technology",
    "url": "https://pinmypic.online",
    "logo": "https://pinmypic.online/logo.png",
    "slogan": "Capture Every Moment",
    "founder": {
      "@type": "Person",
      "name": "Dinesh S",
      "email": "Dinesh@pinmypic.com"
    },
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
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SEOHead 
        title="PinMyPic (PinMPic) - Brand Information | AI Photography Services"
        description="PinMyPic (PinMPic) - Professional photography brand with AI-powered face recognition technology. Learn about our photography services in Coimbatore, Tamil Nadu."
        keywords="pinmpic, pinmypic, brand, photography brand, AI photography, face recognition, Coimbatore photography, Tamil Nadu"
        structuredData={brandStructuredData}
      />
      <Header />
      
      <main className="pt-20">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto">
            {/* Brand Header */}
            <div className="text-center mb-16">
              <h1 className="text-5xl md:text-6xl font-bold mb-6">
                <span className="bg-gradient-to-r from-pink-500 to-orange-500 bg-clip-text text-transparent">
                  PinMyPic
                </span>
                <br />
                <span className="text-3xl md:text-4xl text-gray-600">
                  (PinMPic)
                </span>
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Professional Photography Brand with AI-Powered Face Recognition Technology
              </p>
            </div>

            {/* Brand Information */}
            <div className="grid md:grid-cols-2 gap-12 mb-16">
              <div>
                <h2 className="text-3xl font-bold mb-6 text-gray-800">About PinMyPic</h2>
                <p className="text-lg text-gray-600 mb-6">
                  PinMyPic (also known as PinMPic) is a professional photography brand specializing in 
                  AI-powered face recognition technology. We capture life's most precious moments with 
                  artistic vision and professional expertise.
                </p>
                <p className="text-lg text-gray-600 mb-6">
                  Our brand represents innovation in photography, combining traditional professional 
                  photography with cutting-edge AI technology to help people find themselves in 
                  thousands of event photos instantly.
                </p>
                <div className="bg-gradient-to-r from-pink-50 to-orange-50 p-6 rounded-lg">
                  <h3 className="text-xl font-semibold mb-3 text-gray-800">Brand Slogan</h3>
                  <p className="text-lg text-gray-700 font-medium">"Capture Every Moment"</p>
                </div>
              </div>

              <div>
                <h2 className="text-3xl font-bold mb-6 text-gray-800">Brand Services</h2>
                <div className="space-y-4">
                  <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <h3 className="text-xl font-semibold mb-2 text-gray-800">Wedding Photography</h3>
                    <p className="text-gray-600">Professional wedding photography with AI face recognition</p>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <h3 className="text-xl font-semibold mb-2 text-gray-800">Corporate Events</h3>
                    <p className="text-gray-600">Corporate event photography with instant photo finding</p>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <h3 className="text-xl font-semibold mb-2 text-gray-800">AI Face Recognition</h3>
                    <p className="text-gray-600">Find yourself in thousands of event photos instantly</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Brand Values */}
            <div className="bg-white rounded-lg shadow-sm border p-8 mb-16">
              <h2 className="text-3xl font-bold mb-8 text-center text-gray-800">Brand Values</h2>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-white text-2xl">📸</span>
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-gray-800">Quality</h3>
                  <p className="text-gray-600">High-quality professional photography with attention to detail</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-white text-2xl">🤖</span>
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-gray-800">Innovation</h3>
                  <p className="text-gray-600">Cutting-edge AI technology for instant photo discovery</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-yellow-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-white text-2xl">❤️</span>
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-gray-800">Passion</h3>
                  <p className="text-gray-600">Passionate about capturing life's most precious moments</p>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-gradient-to-r from-pink-500 to-orange-500 rounded-lg p-8 text-white text-center">
              <h2 className="text-3xl font-bold mb-6">Contact PinMyPic</h2>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xl font-semibold mb-4">Get in Touch</h3>
                  <p className="mb-2">📧 Dinesh@pinmypic.com</p>
                  <p className="mb-2">📱 +91-9025943634</p>
                  <p>📍 Coimbatore, Tamil Nadu, India</p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-4">Visit Our Website</h3>
                  <p className="mb-4">https://pinmypic.online</p>
                  <a 
                    href="https://pinmypic.online" 
                    className="inline-block bg-white text-pink-500 px-6 py-3 rounded-full font-semibold hover:bg-gray-100 transition-colors"
                  >
                    Visit PinMyPic
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Brand;
