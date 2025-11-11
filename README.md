# Aspire Impact Network Website

A comprehensive website for Aspire Impact Network, showcasing digital solutions services for businesses and nonprofits. Built with modern HTML5, CSS3, and JavaScript.

## Overview

This website serves as the digital presence for Aspire Impact Network, an organization that provides:

1. **Digital Solutions**: Complete digital transformation services for nonprofits and small businesses ($150/month)
2. **Membership Community**: Tiered access (Basic/Premier/Pro) to resources, training, and exclusive content

## Features

### 🏠 Homepage
- Hero section with clear value proposition
- Main service panels
- Impact statistics and business growth focus
- Call-to-action sections

### 💻 Digital Solutions
- Complete package for $150/month
- Website management & optimization
- SEO + AEO (Answer Engine Optimization)
- Social media management
- AI automation integration
- Success stories and process overview

### 👥 Membership Community
- **Basic (Free)**: Community access, newsletter, events
- **Premier ($25/month)**: Training modules, early access, Q&A sessions
- **Pro ($35/month)**: 1:1 consultations, advanced templates, program discounts

### 📚 Resource Hub
- Searchable blog with category filtering
- Categories: Digital Marketing, Business Growth, Technology Solutions, Case Studies
- Newsletter signup
- Featured articles

### 📞 Contact
- Multiple contact methods
- Comprehensive contact form
- Quick action cards
- FAQ section
- Location information

## Technical Stack

- **HTML5**: Semantic, accessible markup
- **CSS3**: Modern design with CSS Grid and Flexbox
- **JavaScript**: Interactive features and form handling
- **Fonts**: Inter from Google Fonts
- **Icons**: SVG icons for scalability
- **Responsive**: Mobile-first design approach

## Color Scheme

- **Primary Blue**: #2563eb
- **Primary Gold**: #d97706
- **Warm Cream**: #fef7ed
- **Neutral Gray**: #6b7280
- **Dark Gray**: #374151

## File Structure

```
/
├── index.html              # Homepage
├── digital-solutions.html  # Digital services
├── membership.html         # Membership tiers
├── blog.html              # Resource hub
├── contact.html           # Contact page
├── css/
│   └── styles.css         # Main stylesheet
├── js/
│   └── main.js           # Interactive functionality
├── images/               # Image assets
└── README.md            # This file
```

## Key Interactive Features

### Navigation
- Responsive mobile navigation with hamburger menu
- Active page highlighting
- Smooth transitions

### Blog/Resources
- Real-time search functionality
- Category filtering
- Load more articles
- Newsletter signup

### Forms
- Contact form with validation
- Custom checkbox styling
- Success/error messaging
- Newsletter signup forms

### User Experience
- Smooth scrolling for anchor links
- Hover effects and animations
- Mobile-optimized touch targets
- Accessible form controls

## Deployment Instructions

### Option 1: Static Hosting (Recommended)

The website is built as a static site and can be deployed to any static hosting service:

#### Netlify
1. Connect your Git repository to Netlify
2. Set build command: (none needed)
3. Set publish directory: `/`
4. Deploy

#### Vercel
1. Connect your Git repository to Vercel
2. No build settings needed
3. Deploy

#### GitHub Pages
1. Push code to GitHub repository
2. Go to repository Settings > Pages
3. Select source branch (main)
4. Site will be available at `https://username.github.io/repository-name`

### Option 2: Traditional Web Hosting

Upload all files to your web server via FTP/SFTP:

1. Upload all HTML files to the root directory
2. Upload `css/` and `js/` folders with their contents
3. Upload `images/` folder when you add images
4. Ensure `index.html` is in the root directory

### Option 3: Local Development

To run locally for development:

1. Clone or download the repository
2. Open `index.html` in a web browser
3. For better development experience, use a local server:
   ```bash
   # Using Python
   python -m http.server 8000

   # Using Node.js http-server
   npx http-server

   # Using PHP
   php -S localhost:8000
   ```

## Customization

### Adding Images
1. Add images to the `images/` folder
2. Replace placeholder divs in HTML with `<img>` tags
3. Update image paths in CSS if needed

### Updating Content
- Edit HTML files directly for content changes
- Update contact information in `contact.html` and footer sections
- Modify pricing in `digital-solutions.html`

### Styling Changes
- All styles are in `css/styles.css`
- CSS custom properties (variables) are defined at the top for easy theme changes
- Mobile styles are in media queries at the bottom

### Adding Functionality
- JavaScript functionality is in `js/main.js`
- Add new features by extending existing functions or creating new ones
- Form handling can be connected to backend services

## Form Integration

Currently, forms show success messages but don't submit data. To connect to a backend:

### Contact Form
Replace the form submission logic in `js/main.js` with your endpoint:

```javascript
// Example with fetch API
fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData)
})
```

### Newsletter Signup
Connect to your email service provider (Mailchimp, ConvertKit, etc.)

## Performance Optimization

The website is optimized for performance:
- Minimal dependencies (no frameworks)
- Efficient CSS with minimal redundancy
- Optimized images (when added)
- Clean, semantic HTML

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- IE11+ (with some graceful degradation)
- Mobile browsers (iOS Safari, Chrome Mobile)

## SEO Features

- Semantic HTML structure
- Meta descriptions on all pages
- Proper heading hierarchy
- Clean URL structure
- Mobile-responsive design

## Accessibility

- Semantic HTML elements
- Proper form labels
- Keyboard navigation support
- Screen reader friendly
- High contrast ratios

## Future Enhancements

Consider adding:
- Content Management System (CMS) integration
- Payment processing for memberships
- User authentication and member portals
- Advanced search functionality
- Blog commenting system
- Social media integration
- Analytics tracking

## Support

For questions about this website:
- Email: brandon.hinrichs@hsst.com
- Phone: (402) 759-2210

## License

© 2024 Aspire Impact Network. All rights reserved.