# GhostMaker Studio Website

**Professional Creative Services Platform**

*"I'm basically a ghost that makes things"*

## 🎯 Project Overview

GhostMaker Studio is a comprehensive business automation platform designed for anonymous creative service providers. The website combines a professional portfolio showcase with a complete order management system, payment processing, and analytics dashboard.

## 🏗️ Architecture

### Three-Tier Environment System
- **Development**: `localhost:3000` - Local development and testing
- **Staging**: `dev.ghostmakerstudio.com` - Pre-production testing
- **Production**: `ghostmakerstudio.com` - Live website

### Tech Stack
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: AWS Services
  - DynamoDB for data storage
  - S3 for file storage
  - Cognito for authentication
  - Lambda for API endpoints
- **Payment**: Stripe integration
- **Hosting**: AWS CloudFront + S3

## 💼 Services Offered

1. **Flyer Design** - $5.00
   - Event flyers, promotional materials, announcements
   
2. **Video Production** - $25.00
   - Complete video editing, effects, multiple format exports
   
3. **Web/Mobile Applications** - $250.00
   - Custom web and mobile app development

## 🔄 Order Workflow

### Status Progression
1. **Content Pending** - Order placed, waiting to start
2. **Content Being Created** - Creator has started work
3. **First Draft Done** - Initial version ready for review
4. **Revision** - Client feedback, revisions in progress
5. **Order Complete** - Final version delivered

### Communication System
- **No email/phone communication** for revisions
- **In-app messaging system** for all communication
- **Real-time notifications** to creator's mobile device
- **File attachment support** for project files

## 📊 Analytics & Performance Tracking

### Key Metrics
- Order timeline tracking (placement → completion)
- Average processing times
- Revision counts and turnaround times
- Revenue analytics by service type
- Queue position and estimated start times
- Bottleneck identification with color coding

### Dashboard Features
- Visual performance graphs
- Real-time order queue
- Quick action buttons
- Export capabilities for data analysis

## 🚀 Getting Started

### Prerequisites
- Node.js (for local development server)
- AWS Account (for backend services)
- Stripe Account (for payment processing)

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd GhostMakerStudioWebsite
   ```

2. **Start development server**
   ```bash
   npm run dev
   # or
   python -m http.server 3000
   ```

3. **Access the website**
   - Open `http://localhost:3000` in your browser

### Environment Configuration

Update `config/environments.js` with your:
- AWS credentials and region
- Stripe publishable keys
- API endpoints
- S3 bucket names

## 📁 Project Structure

```
GhostMakerStudioWebsite/
├── config/
│   └── environments.js          # Environment configuration
├── public/
│   └── images/                  # Static images and assets
├── src/
│   ├── api/                     # Backend API services
│   │   ├── aws-config.js        # AWS configuration
│   │   ├── database.js          # Database operations
│   │   ├── payments.js          # Payment processing
│   │   └── order-service.js     # Order management
│   ├── components/              # JavaScript components
│   │   ├── main.js              # Main site functionality
│   │   ├── order.js             # Order page logic
│   │   ├── order-details.js     # Order tracking
│   │   └── admin-dashboard.js   # Admin interface
│   ├── pages/                   # HTML pages
│   │   ├── order.html           # Order form
│   │   ├── order-details.html   # Order tracking
│   │   └── admin-dashboard.html # Admin panel
│   └── styles/                  # CSS stylesheets
│       ├── main.css             # Main styles
│       ├── order.css            # Order page styles
│       ├── order-details.css    # Order details styles
│       └── admin-dashboard.css  # Dashboard styles
├── index.html                   # Homepage
├── package.json                 # Dependencies
└── README.md                    # This file
```

## 🎨 Design Philosophy

### Visual Identity
- **Ghost-themed aesthetic** - Mysterious, professional, creative
- **Color palette**: Dark teals, purples, and greens with glowing accents
- **Typography**: Modern, clean fonts with ghost-inspired branding
- **Effects**: Subtle glitch effects and digital overlays

### User Experience
- **Portfolio-first approach** - Showcase work before asking for purchases
- **Transparent communication** - Clear status updates and queue positions
- **Seamless workflow** - No manual email/phone coordination needed
- **Mobile-responsive** - Works perfectly on all devices

## 🔐 Security & Privacy

- **Anonymous creator persona** - No personal information displayed
- **Secure payment processing** - Stripe handles all payment data
- **AWS security** - Enterprise-grade infrastructure
- **Data protection** - Customer data encrypted and secure

## 📈 Business Model

### Short-Term Goals
- Learn web development and business automation
- Generate income through creative services
- Build professional portfolio
- Establish automated delivery system

### Long-Term Vision
- Transition to app development focus
- Use website as portfolio piece
- Scale with additional anonymous creators
- Create reusable business template

## 🤝 Contributing

This project is built using AI assistance and focuses on:
- Clear, maintainable code structure
- Comprehensive documentation
- Modular architecture for easy updates
- User-focused design and functionality

## 📞 Support

For technical support or questions about the platform:
- Check the documentation in each component file
- Review the environment configuration
- Test in development environment first

## 📄 License

MIT License - See LICENSE file for details

---

**Built with ❤️ by GhostMaker Studio**

*Professional creative services delivered with excellence*
