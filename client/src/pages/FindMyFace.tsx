import { useEffect } from 'react';
import { Camera, Search, Download, Zap, Shield, Brain, Database, Cpu, Lock, Target, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SEOHead from '@/components/SEOHead';

const FindMyFace = () => {
  // Scroll to top when page loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const steps = [
    {
      icon: <Camera className="h-8 w-8" />,
      title: "Upload Your Photo",
      description: "Take a selfie or upload a clear photo of yourself. Our system accepts various image formats and automatically optimizes quality."
    },
    {
      icon: <Brain className="h-8 w-8" />,
      title: "AI Face Processing",
      description: "Advanced neural networks extract unique facial features and create mathematical embeddings for precise matching."
    },
    {
      icon: <Search className="h-8 w-8" />,
      title: "Smart Comparison",
      description: "Advanced similarity algorithms compare your face against all event photos using mathematical precision."
    },
    {
      icon: <Download className="h-8 w-8" />,
      title: "Get Your Results",
      description: "Receive matched photos ranked by similarity score. Download, save to gallery, or share your memories instantly."
    }
  ];

  const features = [
    {
      icon: <Cpu className="h-6 w-6 text-yellow-500" />,
      title: "GPU-Accelerated Processing",
      description: "State-of-the-art GPU acceleration delivers results in seconds, even for large events with thousands of photos."
    },
    {
      icon: <Shield className="h-6 w-6 text-green-500" />,
      title: "Privacy & Security First",
      description: "Face data is processed securely in-memory and never permanently stored. Your privacy is our top priority."
    },
    {
      icon: <Target className="h-6 w-6 text-blue-500" />,
      title: "99%+ Accuracy Rate",
      description: "State-of-the-art deep learning models ensure the highest accuracy in facial recognition technology."
    },
    {
      icon: <Database className="h-6 w-6 text-purple-500" />,
      title: "Scalable Architecture",
      description: "Microservice-based design handles events of any size, from intimate gatherings to large-scale conferences."
    },
    {
      icon: <Layers className="h-6 w-6 text-orange-500" />,
      title: "Smart Filtering",
      description: "Advanced similarity thresholds and ranking algorithms ensure you only see the most relevant matches."
    },
    {
      icon: <Lock className="h-6 w-6 text-red-500" />,
      title: "Secure Processing",
      description: "End-to-end encryption and secure data handling protect your images throughout the entire process."
    }
  ];

  const technicalFeatures = [
    {
      title: "Deep Learning Networks",
      description: "Industry-leading neural networks with superior accuracy for identity verification and matching."
    },
    {
      title: "Advanced Vector Search",
      description: "Cutting-edge similarity search algorithms provide lightning-fast comparisons across massive datasets."
    },
    {
      title: "Real-time Processing",
      description: "Optimized algorithms and GPU acceleration deliver instant results without compromising accuracy."
    },
    {
      title: "Mathematical Embeddings",
      description: "Convert facial features into numerical vectors for precise, bias-free comparison and matching."
    }
  ];

  // SEO structured data for FindMyFace page
  const findMyFaceStructuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "FindMyFace - AI Face Recognition",
    "description": "Find yourself in event photos using advanced AI face recognition technology. Upload your photo and discover all your photos from professional photography events.",
    "url": "https://pinmypic.com/findmyface",
    "applicationCategory": "PhotographyApplication",
    "operatingSystem": "Web Browser",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "INR"
    },
    "featureList": [
      "AI Face Recognition",
      "GPU-Accelerated Processing", 
      "99%+ Accuracy Rate",
      "Privacy & Security First",
      "Instant Photo Discovery",
      "High-Resolution Downloads"
    ],
    "provider": {
      "@type": "Organization",
      "name": "PinMyPic",
      "url": "https://pinmypic.com"
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SEOHead 
        title="FindMyFace - AI Face Recognition | Find Yourself in Event Photos"
        description="Find yourself in event photos using advanced AI face recognition technology. Upload your photo and discover all your photos from professional photography events in Coimbatore, Tamil Nadu."
        keywords="AI face recognition, find my face, photo search, event photos, facial recognition, photo discovery, AI technology, Coimbatore photography, Tamil Nadu"
        url="/findmyface"
        structuredData={findMyFaceStructuredData}
      />
      <Header />
      
      <main className="pt-20">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-cyan-50 via-blue-50 to-purple-50 py-20 relative overflow-hidden">
          {/* Background decorative elements */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-cyan-400/20 to-blue-400/20 rounded-full blur-3xl"></div>
          </div>
          
          <div className="container mx-auto px-4 text-center relative z-10">
            <div className="mb-8">
              <div className="inline-flex items-center px-4 py-2 bg-white/50 backdrop-blur-sm rounded-full border border-blue-200 mb-6">
                <Brain className="h-5 w-5 text-blue-600 mr-2" />
                <span className="text-blue-700 font-medium">AI-Powered Recognition</span>
              </div>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-6">
              <span className="bg-gradient-to-r from-cyan-600 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                FindMyFace
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-4xl mx-auto leading-relaxed">
              Revolutionary AI technology that instantly finds all your photos from any event. 
              Upload a selfie and let our advanced algorithms do the rest.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <div className="flex items-center text-gray-600">
                <Zap className="h-5 w-5 text-yellow-500 mr-2" />
                <span>Results in seconds</span>
              </div>
              <div className="flex items-center text-gray-600">
                <Shield className="h-5 w-5 text-green-500 mr-2" />
                <span>100% Private & Secure</span>
              </div>
              <div className="flex items-center text-gray-600">
                <Target className="h-5 w-5 text-blue-500 mr-2" />
                <span>99%+ Accuracy</span>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 bg-white relative">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                <span className="bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                  How It Works
                </span>
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Experience the future of photo discovery with our simple 4-step process
              </p>
            </div>
            
            <div className="max-w-6xl mx-auto">
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                {steps.map((step, index) => (
                  <div key={index} className="relative">
                    {/* Connecting line for desktop */}
                    {index < steps.length - 1 && (
                      <div className="hidden lg:block absolute top-10 left-full w-8 h-0.5 bg-gradient-to-r from-cyan-300 to-purple-300 z-0"></div>
                    )}
                    
                    <div className="text-center relative z-10 bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 group">
                      <div className="relative mb-6">
                        <div className="w-20 h-20 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full flex items-center justify-center text-white mx-auto shadow-lg group-hover:scale-110 transition-transform duration-300">
                          {step.icon}
                        </div>
                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-pink-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg">
                          {index + 1}
                        </div>
                      </div>
                      <h3 className="text-xl font-semibold text-gray-800 mb-4 group-hover:text-blue-600 transition-colors duration-300">
                        {step.title}
                      </h3>
                      <p className="text-gray-600 leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Key Features */}
        <section className="py-20 bg-gradient-to-br from-gray-50 to-blue-50 relative">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-6 text-gray-800">
                Advanced AI Features & Capabilities
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Cutting-edge technology designed to deliver the best photo recognition experience
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
              {features.map((feature, index) => (
                <Card key={index} className="group border-0 shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 bg-white/90 backdrop-blur-sm">
                  <CardContent className="p-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                      {feature.icon}
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-4 group-hover:text-blue-600 transition-colors duration-300">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Technical Architecture */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-6 text-gray-800">
              Powered by Cutting-Edge Technology
            </h2>
            <p className="text-xl text-gray-600 text-center mb-12 max-w-3xl mx-auto">
              Our FindMyFace system combines state-of-the-art AI models with enterprise-grade infrastructure
            </p>
            
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {technicalFeatures.map((tech, index) => (
                <div key={index} className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg border border-blue-100">
                  <h3 className="text-xl font-semibold text-gray-800 mb-3">{tech.title}</h3>
                  <p className="text-gray-600">{tech.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Performance Statistics */}
        <section className="py-20 bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 relative overflow-hidden">
          {/* Background decorative elements */}
          <div className="absolute top-20 right-20 w-32 h-32 bg-gradient-to-br from-purple-200/30 to-pink-200/30 rounded-full blur-2xl"></div>
          <div className="absolute bottom-20 left-20 w-40 h-40 bg-gradient-to-br from-orange-200/30 to-yellow-200/30 rounded-full blur-2xl"></div>
          
          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4 text-gray-800">
                Unmatched Performance & Accuracy
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Real metrics from our advanced AI system delivering exceptional results
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
              <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 text-center group">
                <div className="w-16 h-16 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Target className="h-8 w-8 text-white" />
                </div>
                <div className="text-4xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent mb-2">
                  99.5%
                </div>
                <p className="text-gray-600 font-medium">Recognition Accuracy</p>
              </div>
              
              <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 text-center group">
                <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Zap className="h-8 w-8 text-white" />
                </div>
                <div className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-2">
                  &lt;3s
                </div>
                <p className="text-gray-600 font-medium">Average Processing Time</p>
              </div>
              
              <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 text-center group">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Search className="h-8 w-8 text-white" />
                </div>
                <div className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                  60%
                </div>
                <p className="text-gray-600 font-medium">Similarity Threshold</p>
              </div>
              
              <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 text-center group">
                <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Database className="h-8 w-8 text-white" />
                </div>
                <div className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-2">
                  10K+
                </div>
                <p className="text-gray-600 font-medium">Photos Per Event Capacity</p>
              </div>
            </div>
          </div>
        </section>

        {/* How the AI Works */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12 text-gray-800">
              Behind the AI: Technical Process
            </h2>
            
            <div className="max-w-4xl mx-auto">
              <div className="grid gap-8">
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-8 rounded-lg border border-blue-100">
                  <h3 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
                    <Brain className="h-8 w-8 text-blue-500 mr-3" />
                    Face Detection & Feature Extraction
                  </h3>
                  <p className="text-gray-600 mb-4">
                    When photos are uploaded to events, our system automatically processes each image using advanced AI models. 
                    The AI identifies faces in the photos and extracts unique facial features, converting them into mathematical 
                    embeddings - numerical vectors that represent each person's distinctive characteristics.
                  </p>
                  <div className="bg-white p-4 rounded border-l-4 border-blue-500">
                    <strong className="text-gray-800">Technical Details:</strong> Our embeddings create high-dimensional vectors 
                    that capture facial geometry, proportions, and unique features with sub-pixel precision.
                  </div>
                </div>

                <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-8 rounded-lg border border-purple-100">
                  <h3 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
                    <Database className="h-8 w-8 text-purple-500 mr-3" />
                    Similarity Search & Matching
                  </h3>
                  <p className="text-gray-600 mb-4">
                    When you upload your selfie, the system extracts your face embedding and compares it against all stored 
                    embeddings from the event using advanced similarity algorithms. The system calculates mathematical 
                    similarity scores to determine how closely your face matches each photo.
                  </p>
                  <div className="bg-white p-4 rounded border-l-4 border-purple-500">
                    <strong className="text-gray-800">Matching Process:</strong> Only photos with similarity scores above 60% 
                    are returned, ensuring high-quality matches while filtering out false positives.
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-8 rounded-lg border border-green-100">
                  <h3 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
                    <Shield className="h-8 w-8 text-green-500 mr-3" />
                    Privacy & Security Architecture
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Your privacy is paramount. Face processing happens in real-time memory without permanent storage of biometric data. 
                    The system uses secure microservice architecture with encrypted data transmission and automatic cleanup of 
                    temporary processing files.
                  </p>
                  <div className="bg-white p-4 rounded border-l-4 border-green-500">
                    <strong className="text-gray-800">Security Features:</strong> End-to-end encryption, in-memory processing, 
                    automatic data purging, and zero-trust architecture ensure your data remains private.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="py-20 bg-gradient-to-br from-cyan-600 via-blue-600 to-purple-600 relative overflow-hidden">
          {/* Background decorative elements */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
            <div className="absolute bottom-10 right-10 w-24 h-24 bg-white/5 rounded-full blur-lg"></div>
            <div className="absolute top-1/2 left-1/3 w-16 h-16 bg-white/5 rounded-full blur-md"></div>
          </div>
          
          <div className="container mx-auto px-4 text-center relative z-10">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Ready to Find Your Photos?
              </h2>
              <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
                Experience the future of photo discovery. Our AI technology is waiting to help you find every moment you're in.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-12">
                <div className="flex items-center text-blue-100">
                  <div className="w-3 h-3 bg-green-400 rounded-full mr-3 animate-pulse"></div>
                  <span>AI Service Active</span>
                </div>
                <div className="flex items-center text-blue-100">
                  <div className="w-3 h-3 bg-green-400 rounded-full mr-3 animate-pulse"></div>
                  <span>Models Loaded</span>
                </div>
                <div className="flex items-center text-blue-100">
                  <div className="w-3 h-3 bg-green-400 rounded-full mr-3 animate-pulse"></div>
                  <span>Ready to Process</span>
                </div>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
                <h3 className="text-2xl font-semibold text-white mb-4">
                  Visit Events to Get Started
                </h3>
                <p className="text-blue-100 mb-6">
                  Browse available events and use FindMyFace technology to instantly locate all your photos.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button 
                    onClick={() => window.location.href = '/events'} 
                    className="bg-white text-blue-600 px-8 py-4 rounded-full font-semibold hover:bg-blue-50 transition-all duration-300 transform hover:scale-105 shadow-lg"
                  >
                    Browse Events
                  </button>
                  <button 
                    onClick={() => window.location.href = '/contact'} 
                    className="bg-transparent border-2 border-white text-white px-8 py-4 rounded-full font-semibold hover:bg-white hover:text-blue-600 transition-all duration-300 transform hover:scale-105"
                  >
                    Learn More
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default FindMyFace;