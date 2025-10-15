// Main JavaScript for GhostMaker Studio Website
// Handles navigation, portfolio loading, and general site functionality

class GhostMakerStudio {
  constructor() {
    this.init();
  }

  init() {
    this.setupNavigation();
    this.loadPortfolio();
    this.setupScrollEffects();
    this.setupAnimations();
  }

  setupNavigation() {
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(anchor.getAttribute('href'));
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });

    // Mobile menu toggle (if needed)
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    
    if (mobileMenuToggle && navLinks) {
      mobileMenuToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
      });
    }
  }

  async loadPortfolio() {
    const portfolioGrid = document.getElementById('portfolioGrid');
    if (!portfolioGrid) return;

    try {
      // Load portfolio data from API or static data
      const portfolioData = await this.fetchPortfolioData();
      this.displayPortfolio(portfolioData);
    } catch (error) {
      console.error('Failed to load portfolio:', error);
      this.displayPortfolioError();
    }
  }

  async fetchPortfolioData() {
    try {
      // Fetch real portfolio data from your API
      const response = await fetch('/api/projects');
      const data = await response.json();
      
      if (data.success && data.projects) {
        console.log('📡 Loaded', data.projects.length, 'projects from API');
        
        // Transform project data to portfolio format
        return data.projects.map(project => {
          // Get the first media item as the cover image
          const coverMedia = project.content && project.content.length > 0 ? project.content[0] : null;
          const coverImage = coverMedia ? coverMedia.thumbnailUrl || coverMedia.url : 'public/images/placeholder-project.jpg';
          
          return {
            id: project.id,
            title: project.title,
            description: project.description,
            image: coverImage,
            category: 'project',
            client: 'GhostMaker Studio',
            link: '#',
            project: project // Keep full project data for advanced features
          };
        });
      } else {
        console.log('⚠️ No projects found, using fallback data');
        return this.getFallbackPortfolioData();
      }
    } catch (error) {
      console.error('❌ Failed to fetch portfolio data:', error);
      return this.getFallbackPortfolioData();
    }
  }

  getFallbackPortfolioData() {
    return [
      {
        id: 'fallback-1',
        title: 'Event Flyer Design',
        description: 'Professional flyer for music festival',
        image: 'public/images/portfolio/flyer-1.jpg',
        category: 'flyer',
        client: 'Music Festival Co.',
        link: 'https://example.com/festival-flyer'
      },
      {
        id: 'fallback-2',
        title: 'Product Video',
        description: 'Promotional video for new product launch',
        image: 'public/images/portfolio/video-1.jpg',
        category: 'video',
        client: 'Tech Startup',
        link: 'https://youtube.com/watch?v=example'
      },
      {
        id: 'fallback-3',
        title: 'E-commerce Website',
        description: 'Custom e-commerce platform with payment integration',
        image: 'public/images/portfolio/web-1.jpg',
        category: 'web',
        client: 'Local Business',
        link: 'https://example-store.com'
      }
    ];
  }

  displayPortfolio(portfolioData) {
    const portfolioGrid = document.getElementById('portfolioGrid');
    
    portfolioGrid.innerHTML = portfolioData.map((item, index) => `
      <div class="portfolio-item" data-category="${item.category}">
        <div class="portfolio-image">
          <img id="progressive-image-${index}" 
               src="${item.image}" 
               alt="${item.title}" 
               loading="lazy"
               style="filter: blur(20px); transform: scale(1.1); opacity: 1; 
                      will-change: transform, filter, opacity;
                      transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.3s ease;"
               onload="if (typeof startProgressiveImageLoading === 'function') { startProgressiveImageLoading(${index}); }">
          <div class="portfolio-overlay">
            <h3>${item.title}</h3>
            <p>${item.description}</p>
            <div class="portfolio-meta">
              <span class="portfolio-client">Client: ${item.client}</span>
              <span class="portfolio-category">${this.getCategoryDisplayName(item.category)}</span>
            </div>
            <div class="portfolio-actions">
              <a href="${item.link}" class="btn btn-small" target="_blank">View Live</a>
              <button class="btn btn-small btn-secondary" onclick="this.showPortfolioDetails(${item.id})">Details</button>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    // Add hover effects
    this.setupPortfolioHovers();
    
    // Start progressive loading for all images
    this.startProgressiveLoading(portfolioData);
  }

  displayPortfolioError() {
    const portfolioGrid = document.getElementById('portfolioGrid');
    portfolioGrid.innerHTML = `
      <div class="portfolio-error">
        <p>Unable to load portfolio items. Please try again later.</p>
        <button class="btn btn-secondary" onclick="location.reload()">Retry</button>
      </div>
    `;
  }

  setupPortfolioHovers() {
    const portfolioItems = document.querySelectorAll('.portfolio-item');
    
    portfolioItems.forEach(item => {
      const overlay = item.querySelector('.portfolio-overlay');
      
      item.addEventListener('mouseenter', () => {
        overlay.style.opacity = '1';
      });
      
      item.addEventListener('mouseleave', () => {
        overlay.style.opacity = '0';
      });
    });
  }

  showPortfolioDetails(portfolioId) {
    // TODO: Implement portfolio detail modal
    console.log('Show portfolio details for:', portfolioId);
  }

  // 🚀 FACEBOOK-STYLE PROGRESSIVE LOADING
  startProgressiveLoading(portfolioData) {
    console.log('🚀 Starting Facebook-style progressive loading for', portfolioData.length, 'images');
    
    portfolioData.forEach((item, index) => {
      setTimeout(() => {
        this.startProgressiveImageLoading(index, item);
      }, index * 100); // Stagger loading for smooth effect
    });
  }

  startProgressiveImageLoading(index, item) {
    const img = document.getElementById(`progressive-image-${index}`);
    if (!img) return;

    console.log(`📸 Starting progressive loading for image ${index}: ${item.title}`);

    // Create a high-quality version of the image
    const highQualityImg = new Image();
    
    highQualityImg.onload = () => {
      console.log(`✅ High quality loaded for ${item.title}`);
      
      // Facebook-style smooth transition
      img.style.transition = 'filter 0.3s ease-out, transform 0.3s ease-out';
      img.style.filter = 'blur(0px)';
      img.style.transform = 'scale(1)';
      
      // Add loaded class for CSS styling
      img.classList.add('loaded');
      
      // Optional: Fade to high quality after blur is removed
      setTimeout(() => {
        img.style.transition = 'opacity 0.2s ease-in-out';
        img.style.opacity = '0.5';
        
        setTimeout(() => {
          // Swap to high quality (in this case, same image but could be different quality)
          img.style.opacity = '1';
          console.log(`🎉 Progressive loading complete for ${item.title}`);
        }, 100);
      }, 300);
    };
    
    highQualityImg.onerror = () => {
      console.log(`❌ Failed to load high quality for ${item.title}`);
      // Just remove blur effect
      img.style.filter = 'none';
      img.style.transform = 'scale(1)';
    };
    
    // Start loading the high quality image
    highQualityImg.src = item.image;
  }

  setupScrollEffects() {
    // Navbar background on scroll
    window.addEventListener('scroll', () => {
      const navbar = document.querySelector('.navbar');
      if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    });

    // Fade in animations on scroll
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-in');
        }
      });
    }, observerOptions);

    // Observe elements for fade-in animation
    document.querySelectorAll('.service-card, .portfolio-item, .section-title').forEach(el => {
      observer.observe(el);
    });
  }

  setupAnimations() {
    // Add CSS classes for animations
    const style = document.createElement('style');
    style.textContent = `
      .fade-in {
        opacity: 1 !important;
        transform: translateY(0) !important;
        transition: opacity 0.6s ease, transform 0.6s ease;
      }
      
      .service-card,
      .portfolio-item,
      .section-title {
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.6s ease, transform 0.6s ease;
      }
      
      .navbar {
        transition: background-color 0.3s ease;
      }
      
      .navbar.scrolled {
        background-color: rgba(0, 0, 0, 0.95);
        backdrop-filter: blur(10px);
      }
    `;
    document.head.appendChild(style);
  }

  // Helper Methods
  getCategoryDisplayName(category) {
    const names = {
      flyer: 'Flyer Design',
      video: 'Video Production',
      web: 'Web Development',
      app: 'Mobile App'
    };
    return names[category] || category;
  }

  // Public methods for external use
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-message">${message}</span>
        <button class="notification-close">&times;</button>
      </div>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      notification.remove();
    }, 5000);

    // Close button
    notification.querySelector('.notification-close').addEventListener('click', () => {
      notification.remove();
    });
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.ghostMakerStudio = new GhostMakerStudio();
});

// Export for use in other modules
// export default GhostMakerStudio;
