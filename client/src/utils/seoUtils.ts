// SEO utility functions for dynamic meta tag generation

export interface SEOConfig {
  title: string;
  description: string;
  keywords: string;
  image?: string;
  url?: string;
  type?: string;
  structuredData?: object;
}

export const generatePageTitle = (pageTitle: string, siteName = "PinMyPic"): string => {
  if (pageTitle.includes(siteName)) {
    return pageTitle;
  }
  return `${pageTitle} | ${siteName}`;
};

export const generateMetaDescription = (description: string, maxLength = 160): string => {
  if (description.length <= maxLength) {
    return description;
  }
  return description.substring(0, maxLength - 3) + "...";
};

export const generateKeywords = (baseKeywords: string[], additionalKeywords: string[] = []): string => {
  const allKeywords = [...baseKeywords, ...additionalKeywords];
  const uniqueKeywords = [...new Set(allKeywords)];
  return uniqueKeywords.join(", ");
};

// Base keywords for all pages
export const BASE_KEYWORDS = [
  "photography",
  "face recognition", 
  "AI photography",
  "event photography",
  "Coimbatore photography",
  "Tamil Nadu",
  "professional photographer",
  "photo gallery",
  "PinMyPic"
];

// Page-specific keyword sets
export const PAGE_KEYWORDS = {
  home: [
    "wedding photography",
    "corporate events", 
    "party photography",
    "photo booking",
    "instant photo finder"
  ],
  events: [
    "photography events",
    "event gallery",
    "wedding photography",
    "corporate events",
    "party photography",
    "Coimbatore events",
    "Tamil Nadu photography",
    "AI face recognition",
    "event photos"
  ],
  findMyFace: [
    "AI face recognition",
    "find my face",
    "photo search",
    "event photos",
    "facial recognition",
    "photo discovery",
    "AI technology",
    "Coimbatore photography",
    "Tamil Nadu"
  ],
  contact: [
    "contact photographer",
    "photography booking",
    "Coimbatore photographer",
    "Tamil Nadu photography",
    "professional photography services",
    "photography consultation"
  ],
  booking: [
    "photography booking",
    "book photographer",
    "wedding photography booking",
    "corporate photography",
    "event photography services",
    "professional photography"
  ]
};

// Default SEO configurations for each page
export const DEFAULT_SEO_CONFIGS: Record<string, SEOConfig> = {
  home: {
    title: "PinMyPic - AI-Powered Photography & Face Recognition | Professional Event Photography",
    description: "Professional photography services with AI-powered face recognition technology. Find yourself in event photos instantly. Wedding, corporate, and party photography in Coimbatore, Tamil Nadu.",
    keywords: generateKeywords(BASE_KEYWORDS, PAGE_KEYWORDS.home),
    url: "https://pinmypic.com/",
    type: "website"
  },
  events: {
    title: "Photography Events Gallery | PinMyPic - AI Face Recognition",
    description: "Browse professional photography events with AI-powered face recognition. Wedding, corporate, and party photography in Coimbatore, Tamil Nadu. Find yourself in event photos instantly.",
    keywords: generateKeywords(BASE_KEYWORDS, PAGE_KEYWORDS.events),
    url: "https://pinmypic.com/events",
    type: "website"
  },
  findMyFace: {
    title: "FindMyFace - AI Face Recognition | Find Yourself in Event Photos",
    description: "Find yourself in event photos using advanced AI face recognition technology. Upload your photo and discover all your photos from professional photography events in Coimbatore, Tamil Nadu.",
    keywords: generateKeywords(BASE_KEYWORDS, PAGE_KEYWORDS.findMyFace),
    url: "https://pinmypic.com/findmyface",
    type: "website"
  },
  contact: {
    title: "Contact Us | PinMyPic - Professional Photography Services",
    description: "Contact PinMyPic for professional photography services in Coimbatore, Tamil Nadu. Book wedding, corporate, and event photography with AI face recognition technology.",
    keywords: generateKeywords(BASE_KEYWORDS, PAGE_KEYWORDS.contact),
    url: "https://pinmypic.com/contact",
    type: "website"
  },
  booking: {
    title: "Book Photography Services | PinMyPic - Professional Photography",
    description: "Book professional photography services for weddings, corporate events, and parties in Coimbatore, Tamil Nadu. AI-powered face recognition included.",
    keywords: generateKeywords(BASE_KEYWORDS, PAGE_KEYWORDS.booking),
    url: "https://pinmypic.com/booking",
    type: "website"
  }
};

// Generate structured data for different page types
export const generateStructuredData = (type: string, data?: any) => {
  const baseOrganization = {
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
    }
  };

  switch (type) {
    case 'home':
      return {
        ...baseOrganization,
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
    
    case 'events':
      return {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "Photography Events Gallery",
        "description": "Browse professional photography events with AI-powered face recognition",
        "url": "https://pinmypic.com/events",
        "numberOfItems": data?.totalEvents || 0,
        "itemListElement": data?.events?.slice(0, 10).map((event: any, index: number) => ({
          "@type": "Event",
          "position": index + 1,
          "name": event.title,
          "description": event.description,
          "startDate": event.eventDate,
          "location": {
            "@type": "Place",
            "name": event.location || "Coimbatore, Tamil Nadu"
          },
          "organizer": {
            "@type": "Organization",
            "name": "PinMyPic",
            "url": "https://pinmypic.com"
          }
        })) || []
      };
    
    case 'findMyFace':
      return {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": "FindMyFace - AI Face Recognition",
        "description": "Find yourself in event photos using advanced AI face recognition technology",
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
    
    default:
      return baseOrganization;
  }
};

// Validate SEO configuration
export const validateSEOConfig = (config: SEOConfig): SEOConfig => {
  return {
    ...config,
    title: config.title || "PinMyPic - AI-Powered Photography & Face Recognition",
    description: generateMetaDescription(config.description),
    keywords: config.keywords || generateKeywords(BASE_KEYWORDS),
    image: config.image || "https://pinmypic.com/logo.png",
    url: config.url || "https://pinmypic.com",
    type: config.type || "website"
  };
};
