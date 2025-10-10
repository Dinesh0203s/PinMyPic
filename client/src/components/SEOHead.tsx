import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
  structuredData?: object;
}

const SEOHead = ({
  title = "PinMyPic (PinMPic) - AI-Powered Photography & Face Recognition | Professional Event Photography",
  description = "Professional photography services with AI-powered face recognition technology. Find yourself in event photos instantly. Wedding, corporate, and party photography in Coimbatore, Tamil Nadu.",
  keywords = "pinmpic, pinmypic, photography, face recognition, AI photography, event photography, wedding photography, corporate events, photo gallery, Coimbatore photography, Tamil Nadu, professional photographer, photo booking, instant photo finder",
  image = "https://pinmypic.online/logo.png",
  url = "https://pinmypic.online",
  type = "website",
  structuredData
}: SEOHeadProps) => {
  const fullTitle = title.includes('PinMyPic') ? title : `${title} | PinMyPic`;
  const fullUrl = url.startsWith('http') ? url : `https://pinmypic.online${url}`;

  useEffect(() => {
    // Update document title for better UX
    document.title = fullTitle;
  }, [fullTitle]);

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <link rel="canonical" href={fullUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="PinMyPic" />
      <meta property="og:locale" content="en_US" />

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={fullUrl} />
      <meta property="twitter:title" content={fullTitle} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={image} />

      {/* Structured Data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
};

export default SEOHead;
