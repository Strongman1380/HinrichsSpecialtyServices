/**
 * SEO Enhancement Utilities
 * Dynamic sitemap generation, meta tag management, structured data
 */

// Update page meta tags dynamically
export function updateMetaTags(metaData) {
  const {
    title,
    description,
    keywords,
    ogTitle,
    ogDescription,
    ogImage,
    ogUrl,
    twitterCard = 'summary_large_image',
    canonical
  } = metaData;

  // Update title
  if (title) {
    document.title = title;
    updateMetaTag('property', 'og:title', ogTitle || title);
    updateMetaTag('name', 'twitter:title', ogTitle || title);
  }

  // Update description
  if (description) {
    updateMetaTag('name', 'description', description);
    updateMetaTag('property', 'og:description', ogDescription || description);
    updateMetaTag('name', 'twitter:description', ogDescription || description);
  }

  // Update keywords
  if (keywords) {
    updateMetaTag('name', 'keywords', keywords);
  }

  // Update OG image
  if (ogImage) {
    updateMetaTag('property', 'og:image', ogImage);
    updateMetaTag('name', 'twitter:image', ogImage);
  }

  // Update OG URL
  if (ogUrl) {
    updateMetaTag('property', 'og:url', ogUrl);
    updateMetaTag('name', 'twitter:url', ogUrl);
  }

  // Update Twitter card type
  updateMetaTag('name', 'twitter:card', twitterCard);

  // Update canonical URL
  if (canonical) {
    updateCanonical(canonical);
  }
}

function updateMetaTag(attribute, attributeValue, content) {
  let element = document.querySelector(`meta[${attribute}="${attributeValue}"]`);

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, attributeValue);
    document.head.appendChild(element);
  }

  element.setAttribute('content', content);
}

function updateCanonical(url) {
  let canonical = document.querySelector('link[rel="canonical"]');

  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }

  canonical.setAttribute('href', url);
}

// Add structured data (JSON-LD)
export function addStructuredData(type, data) {
  const script = document.createElement('script');
  script.type = 'application/ld+json';

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': type,
    ...data
  };

  script.textContent = JSON.stringify(structuredData, null, 2);
  document.head.appendChild(script);
}

// Add Article schema for blog posts
export function addArticleSchema(article) {
  addStructuredData('Article', {
    headline: article.title,
    image: article.image,
    author: {
      '@type': 'Person',
      name: article.author || 'Aspire Impact Network'
    },
    publisher: {
      '@type': 'Organization',
      name: 'Aspire Impact Network',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.hsst.com/images/logo.png'
      }
    },
    datePublished: article.publishedDate,
    dateModified: article.modifiedDate || article.publishedDate,
    description: article.description
  });
}

// Add Service schema
export function addServiceSchema(service) {
  addStructuredData('Service', {
    name: service.name,
    description: service.description,
    provider: {
      '@type': 'Organization',
      name: 'Aspire Impact Network'
    },
    areaServed: {
      '@type': 'Place',
      name: service.areaServed || 'United States'
    },
    offers: service.price ? {
      '@type': 'Offer',
      price: service.price,
      priceCurrency: 'USD'
    } : undefined
  });
}

// Add LocalBusiness schema
export function addLocalBusinessSchema() {
  addStructuredData('LocalBusiness', {
    name: 'Aspire Impact Network',
    image: 'https://www.hsst.com/images/hero-image.png',
    '@id': 'https://www.hsst.com',
    url: 'https://www.hsst.com',
    telephone: '+1-402-759-2210',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '',
      addressLocality: 'Geneva',
      addressRegion: 'NE',
      postalCode: '',
      addressCountry: 'US'
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 40.5267,
      longitude: -97.5956
    },
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '09:00',
      closes: '17:00'
    },
    sameAs: [
      // Add social media URLs here
    ]
  });
}

// Add FAQ schema
export function addFAQSchema(faqs) {
  addStructuredData('FAQPage', {
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  });
}

// Add BreadcrumbList schema
export function addBreadcrumbSchema(breadcrumbs) {
  addStructuredData('BreadcrumbList', {
    itemListElement: breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url
    }))
  });
}

// Generate dynamic sitemap
export function generateSitemap() {
  const pages = [
    { url: '/', priority: 1.0, changefreq: 'weekly' },
    { url: '/our-story.html', priority: 0.8, changefreq: 'monthly' },
    { url: '/digital-solutions.html', priority: 0.9, changefreq: 'weekly' },
    { url: '/blog.html', priority: 0.7, changefreq: 'daily' },
    { url: '/contact.html', priority: 0.6, changefreq: 'monthly' }
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(page => `  <url>
    <loc>https://www.hsst.com${page.url}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  </url>`).join('\n')}
</urlset>`;

  return sitemap;
}

// Preload critical resources
export function preloadResource(href, as, type) {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = href;
  link.as = as;
  if (type) link.type = type;
  document.head.appendChild(link);
}

// Prefetch next page
export function prefetchPage(url) {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  document.head.appendChild(link);
}

// Add internal linking helper
export function addInternalLinks(content, linkMap) {
  let linkedContent = content;

  Object.entries(linkMap).forEach(([keyword, url]) => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    linkedContent = linkedContent.replace(
      regex,
      `<a href="${url}">${keyword}</a>`
    );
  });

  return linkedContent;
}

// Export all SEO utilities
export default {
  updateMetaTags,
  addStructuredData,
  addArticleSchema,
  addServiceSchema,
  addLocalBusinessSchema,
  addFAQSchema,
  addBreadcrumbSchema,
  generateSitemap,
  preloadResource,
  prefetchPage,
  addInternalLinks
};
