import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href: string;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  className?: string;
}

const Breadcrumb = ({ items, className = "" }: BreadcrumbProps) => {
  const location = useLocation();
  
  // Generate breadcrumb items based on current path if not provided
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [
      { label: 'Home', href: '/' }
    ];

    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const label = segment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      breadcrumbs.push({
        label,
        href: currentPath
      });
    });

    return breadcrumbs;
  };

  const breadcrumbItems = items || generateBreadcrumbs();

  // Generate structured data for breadcrumbs
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbItems.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.label,
      "item": `https://pinmypic.com${item.href}`
    }))
  };

  return (
    <>
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      
      {/* Visual Breadcrumb */}
      <nav 
        className={`flex items-center space-x-2 text-sm text-gray-600 ${className}`}
        aria-label="Breadcrumb"
      >
        {breadcrumbItems.map((item, index) => (
          <div key={item.href} className="flex items-center">
            {index === 0 && <Home className="h-4 w-4 mr-1" />}
            {index > 0 && <ChevronRight className="h-4 w-4 mx-2 text-gray-400" />}
            
            {index === breadcrumbItems.length - 1 ? (
              <span className="text-gray-900 font-medium" aria-current="page">
                {item.label}
              </span>
            ) : (
              <Link
                to={item.href}
                className="hover:text-pink-500 transition-colors"
              >
                {item.label}
              </Link>
            )}
          </div>
        ))}
      </nav>
    </>
  );
};

export default Breadcrumb;
