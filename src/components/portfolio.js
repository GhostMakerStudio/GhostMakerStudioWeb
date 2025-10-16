// 🎨 PORTFOLIO GALLERY - EXACT COPY FROM ADMIN PANEL LOGIC
class PortfolioGallery {
  constructor() {
    this.projects = [];
    this.currentProject = null;
    this.imageCache = new Map();
    this.gridLayout = { width: 3, height: 3 };
    console.log('🚀 [DEBUG] PortfolioGallery constructor called - Updated version loaded!');
    console.log('📅 [DEBUG] Loaded at:', new Date().toISOString());
  }

  // 🚀 INITIALIZE PORTFOLIO
  async init() {
    console.log('🎬 Portfolio Gallery script loaded - v2.1 (Facebook-style loading)');
    await this.loadProjects();
    this.setupEventListeners();
    console.log('✅ Portfolio Gallery ready!');
  }

  // 📡 LOAD PROJECTS (EXACT COPY FROM ADMIN PANEL)
  async loadProjects() {
    try {
      console.log('🔄 Loading projects from API Gateway...');
      console.log('🌐 API URL:', 'https://o7jiy71lw3.execute-api.us-east-1.amazonaws.com/prod/api/projects');
      console.log('📅 Timestamp:', new Date().toISOString());
      
      const response = await fetch('https://o7jiy71lw3.execute-api.us-east-1.amazonaws.com/prod/api/projects');
      
      console.log('📡 Response received:');
      console.log('  - Status:', response.status);
      console.log('  - Status Text:', response.statusText);
      console.log('  - Headers:', Object.fromEntries(response.headers.entries()));
      
      const data = await response.json();
      console.log('📊 Parsed JSON data:', data);
      
      if (data.success && data.projects) {
        console.log('📡 Response status: 200');
        console.log('📊 Projects data:', data);
        
        // Load projects first (already filtered by Lambda)
        this.projects = data.projects;
        
        // Then fetch grid layout separately (like admin panel)
        await this.loadGridLayout();
        
        console.log('📁 Filtered projects array:', this.projects);
        console.log('📐 Using grid layout:', this.gridLayout);
        this.renderProjects();
      } else {
        console.log('⚠️ No projects found');
        this.projects = [];
      }
    } catch (error) {
      console.error('❌ Failed to load projects:', error);
      console.error('❌ Error details:');
      console.error('  - Error type:', error.constructor.name);
      console.error('  - Error message:', error.message);
      console.error('  - Error stack:', error.stack);
      
      // Try to get more details about the fetch error
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.error('🌐 Network/Fetch Error Details:');
        console.error('  - This might be a CORS issue or network problem');
        console.error('  - Check if the API Gateway URL is accessible');
      }
      
      if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
        console.error('📄 JSON Parse Error Details:');
        console.error('  - The response is not valid JSON');
        console.error('  - This usually means the server returned HTML (404 page) instead of JSON');
      }
      
      this.projects = [];
    }
  }

  // 🎯 LOAD GRID LAYOUT (SEPARATE API CALL LIKE ADMIN PANEL)
  async loadGridLayout() {
    try {
      console.log('🔄 Fetching grid layout from API Gateway...');
      const gridLayoutResponse = await fetch('https://o7jiy71lw3.execute-api.us-east-1.amazonaws.com/prod/api/grid-layout');
      console.log('📡 Grid layout response status:', gridLayoutResponse.status);
      const gridLayoutItem = await gridLayoutResponse.json();
      console.log('DEBUG: Received gridLayoutItem for main page:', gridLayoutItem);
      console.log('DEBUG: gridLayoutItem.success:', gridLayoutItem.success);
      console.log('DEBUG: gridLayoutItem.layout:', gridLayoutItem.layout);

      if (gridLayoutItem && gridLayoutItem.success && gridLayoutItem.layout) {
        console.log('✅ Grid layout loaded:', gridLayoutItem.layout);
        this.gridLayout = {
          width: gridLayoutItem.layout.width || 3,
          height: gridLayoutItem.layout.height || 3,
          positions: gridLayoutItem.layout.positions || {},
          sectionTitle: gridLayoutItem.layout.sectionTitle || 'Our Work'
        };
        
        // Update the section title on the page
        this.updateSectionTitle(this.gridLayout.sectionTitle);
      } else {
        console.log('⚠️ No grid layout found, using default');
        this.gridLayout = { width: 3, height: 3, positions: {}, sectionTitle: 'Our Work' };
        this.updateSectionTitle('Our Work');
      }
    } catch (error) {
      console.error('❌ Failed to load grid layout:', error);
      console.log('⚠️ Using default grid layout due to error');
      this.gridLayout = { width: 3, height: 3, positions: {}, sectionTitle: 'Our Work' };
      this.updateSectionTitle('Our Work');
    }
  }

  // 📝 UPDATE SECTION TITLE
  updateSectionTitle(title) {
    const sectionTitle = document.querySelector('#portfolio .section-title');
    if (sectionTitle) {
      sectionTitle.textContent = title;
      console.log('📝 Updated section title to:', title);
    }
  }

  // 🎨 RENDER PROJECTS (EXACT COPY FROM ADMIN PANEL)
  renderProjects() {
    const portfolioGrid = document.getElementById('portfolioGrid');
    if (!portfolioGrid) return;

    console.log('🎨 Rendering projects...', this.projects);
    
    // Add detailed project logging like admin panel
    this.projects.forEach(project => {
      console.log(`📊 Project "${project.title}" has ${project.content ? project.content.length : 0} media items:`, project.content);
      console.log(`🖼️ Project "${project.title}" cover image:`, this.getProjectCoverImage(project));
    });
    
    const gridItems = [];

    // Create grid items using layout positions
    // If no positions are defined, use first few projects as fallback
    const hasPositions = Object.keys(this.gridLayout.positions).length > 0;
    
    for (let i = 0; i < this.gridLayout.width * this.gridLayout.height; i++) {
      const gridPosition = i;
      let project = null;
      
      if (hasPositions) {
        // Use grid layout positions
        const projectId = this.gridLayout.positions[gridPosition];
        project = projectId ? this.projects.find(p => p.id === projectId) : null;
      } else {
        // Fallback: use projects in order
        project = this.projects[i] || null;
      }

      if (project) {
        // Project exists at this position according to grid layout
        gridItems.push(`
          <div class="portfolio-item" data-project-id="${project.id}" onclick="portfolioGallery.openProject('${project.id}')" style="grid-column: ${(i % this.gridLayout.width) + 1}; grid-row: ${Math.floor(i / this.gridLayout.width) + 1};">
            <div class="portfolio-cover">
              ${this.getProjectCoverImage(project) ? 
                `<img id="progressive-image-${project.id}" 
                     src="${this.getProjectCoverImage(project)}" 
                     alt="${project.title}" 
                     data-quality="1920w"
                     style="width: 100%; height: 100%; object-fit: cover; 
                            filter: none; transform: scale(1); opacity: 1; 
                            will-change: transform, filter, opacity;
                            transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.3s ease;"
                     onload="if (typeof portfolioGallery.startProgressiveImageLoading === 'function') { portfolioGallery.startProgressiveImageLoading('${project.id}'); }">` :
                `<div style="color: #888; text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%;">
                  <div style="font-size: 2rem; margin-bottom: 10px;">🎨</div>
                  <p>No Cover Image</p>
                </div>`
              }
            </div>
            <h3>${project.title}</h3>
            <p>${project.description || 'No description'}</p>
            <div class="portfolio-stats">
              ${project.content ? project.content.length : 0} media items
            </div>
          </div>
        `);
      } else {
        // Empty slot
        gridItems.push(`
          <div class="portfolio-item empty" style="grid-column: ${(i % this.gridLayout.width) + 1}; grid-row: ${Math.floor(i / this.gridLayout.width) + 1};">
            <div class="portfolio-cover">
              <div style="color: #888; text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%;">
                <div style="font-size: 2rem; margin-bottom: 10px;">➕</div>
                <p>Empty Slot</p>
              </div>
            </div>
          </div>
        `);
      }
    }

    portfolioGrid.innerHTML = gridItems.join('');
    
    console.log('📋 Portfolio grid element:', portfolioGrid);
    console.log('📊 Rendering', this.projects.length, 'projects');
    console.log('📋 Grid items HTML:', gridItems.length, 'items created');
    console.log('📋 Portfolio grid innerHTML length:', portfolioGrid.innerHTML.length);
    console.log('📋 Portfolio grid children count:', portfolioGrid.children.length);
    
    // Debug: Check if any projects are actually visible
    const portfolioItems = portfolioGrid.querySelectorAll('.portfolio-item');
    console.log('🔍 Found', portfolioItems.length, 'portfolio-item elements');
    
    if (portfolioItems.length > 0) {
      const firstItem = portfolioItems[0];
      console.log('🔍 First portfolio item:', firstItem);
      console.log('🔍 First item computed styles:', {
        display: window.getComputedStyle(firstItem).display,
        visibility: window.getComputedStyle(firstItem).visibility,
        opacity: window.getComputedStyle(firstItem).opacity,
        width: window.getComputedStyle(firstItem).width,
        height: window.getComputedStyle(firstItem).height,
        position: window.getComputedStyle(firstItem).position,
        zIndex: window.getComputedStyle(firstItem).zIndex
      });
      
      const firstImage = firstItem.querySelector('img');
      if (firstImage) {
        console.log('🔍 First image src:', firstImage.src);
        console.log('🔍 First image loaded:', firstImage.complete);
      }
    }
    
    console.log('✅ Portfolio grid rendered');
    
    // Trigger fade-in animation for portfolio items
    setTimeout(() => {
      const portfolioItems = portfolioGrid.querySelectorAll('.portfolio-item');
      portfolioItems.forEach(item => {
        item.classList.add('fade-in');
        console.log('🎬 Added fade-in class to portfolio item');
      });
    }, 100);
  }

  // 🎯 GET PROJECT COVER IMAGE (EXACT COPY FROM ADMIN PANEL)
  getProjectCoverImage(project) {
    if (!project || !project.content || project.content.length === 0) {
      return null;
    }
    
    const firstMedia = project.content[0];
    if (!firstMedia) return null;
    
    // EXACT same logic as admin panel
    if (firstMedia.imageQualities && firstMedia.imageQualities.length > 0) {
      // Use admin panel's selectImageQuality function with skipBlur = true
      const initialQuality = this.selectImageQuality(firstMedia.imageQualities, true);
      if (initialQuality) {
        return initialQuality.url;
      }
    }
    
    // Fallback to thumbnail if available (fastest possible)
    if (firstMedia.thumbnailUrl) {
      return firstMedia.thumbnailUrl;
    }
    
    // Last resort - original
    return firstMedia.url;
  }

  // 🎯 GET PROJECT BLUR IMAGE (FOR PROGRESSIVE LOADING)
  getProjectBlurImage(project) {
    if (!project || !project.content || project.content.length === 0) {
      return '/public/images/placeholder-project.jpg';
    }
    
    const firstMedia = project.content[0];
    if (!firstMedia) return '/public/images/placeholder-project.jpg';
    
    // Look for blur_placeholder first (fastest loading for initial display)
    if (firstMedia.imageQualities && firstMedia.imageQualities.length > 0) {
      const blurPlaceholder = firstMedia.imageQualities.find(q => q.quality === 'blur_placeholder');
      if (blurPlaceholder) {
        console.log('✅ Found blur_placeholder quality (fastest):', blurPlaceholder.url);
        return blurPlaceholder.url;
      }
      
      // Fallback to lowest quality for blur effect
      const lowQuality = firstMedia.imageQualities.find(q => q.resolution === '320w') ||
                        firstMedia.imageQualities.find(q => q.resolution === '480w') ||
                        firstMedia.imageQualities.find(q => q.resolution === '640w') ||
                        firstMedia.imageQualities[0];
      
      return lowQuality ? lowQuality.url : firstMedia.url || '/public/images/placeholder-project.jpg';
    }
    
    // Fallback to thumbnail if available (fastest possible)
    if (firstMedia.thumbnailUrl) {
      return firstMedia.thumbnailUrl;
    }
    
    return firstMedia.url || '/public/images/placeholder-project.jpg';
  }

  // 🎯 SELECT IMAGE QUALITY (EXACT COPY FROM ADMIN PANEL)
  selectImageQuality(imageQualities, skipBlur = false) {
    if (!imageQualities || imageQualities.length === 0) {
      return null;
    }
    
    // Sanitize and filter out invalid entries
    imageQualities = imageQualities.filter(q => q && q.quality);
    
    // When skipBlur is true, explicitly exclude blur placeholder
    if (skipBlur) {
      imageQualities = imageQualities.filter(q => q.quality !== 'blur_placeholder');
    }
    
    // If we're skipping blur (for cached images or progressive upgrade), go straight to high quality
    if (skipBlur) {
      // Look for 1920w with modern formats first (highest quality)
      const quality1920w = imageQualities.find(q => q.resolution === '1920w');
      if (quality1920w) {
        if (quality1920w.formats) {
          // Prefer HEIF, then WebP, then JPEG
          const bestFormat = quality1920w.formats.heif || quality1920w.formats.webp || quality1920w.formats.jpg;
          if (bestFormat) {
            return { ...quality1920w, url: bestFormat };
          }
        }
        return quality1920w;
      }
      
      // Fallback to 1280w with modern formats
      const quality1280w = imageQualities.find(q => q.resolution === '1280w');
      if (quality1280w) {
        if (quality1280w.formats) {
          const bestFormat = quality1280w.formats.heif || quality1280w.formats.webp || quality1280w.formats.jpg;
          if (bestFormat) {
            return { ...quality1280w, url: bestFormat };
          }
        }
        return quality1280w;
      }
      
      // Fallback to 960w
      const quality960w = imageQualities.find(q => q.resolution === '960w');
      if (quality960w) {
        if (quality960w.formats) {
          const bestFormat = quality960w.formats.heif || quality960w.formats.webp || quality960w.formats.jpg;
          if (bestFormat) {
            return { ...quality960w, url: bestFormat };
          }
        }
        return quality960w;
      }
    }
    
    // Look for blur_placeholder first (fastest loading for initial display)
    const blurPlaceholder = imageQualities.find(q => q.quality === 'blur_placeholder');
    if (blurPlaceholder && !skipBlur) {
      return blurPlaceholder;
    }
    
    // Look for 320w as fast loading choice
    const quality320w = imageQualities.find(q => q.resolution === '320w');
    if (quality320w) {
      if (quality320w.formats) {
        const bestFormat = quality320w.formats.heif || quality320w.formats.webp || quality320w.formats.jpg;
        if (bestFormat) {
          return { ...quality320w, url: bestFormat };
        }
      }
      return quality320w;
    }
    
    // Final fallback
    return imageQualities[0] || null;
  }

  // 🚀 FACEBOOK-STYLE PROGRESSIVE LOADING (EXACT COPY FROM ADMIN PANEL)
  startProgressiveImageLoading(projectId) {
    // Find the current project and media items
    const project = this.projects.find(p => p.id === projectId);
    if (!project) return;
    
    const currentMedia = project.content[0];
    const currentImg = document.getElementById(`progressive-image-${projectId}`);
    
    if (!currentImg || !currentMedia.imageQualities || currentMedia.imageQualities.length === 0) {
      console.log('⚠️ Cannot start progressive loading - missing image or qualities');
      return;
    }
    
    // Add aggressive preloading like admin panel
    console.log(`🖼️ Aggressively preloading media thumbnails across all projects...`);
    this.projects.forEach(project => {
      if (project.content) {
        project.content.forEach((media, index) => {
          if (media.type === 'image' && media.thumbnailUrl) {
            console.log(`🖼️ Gallery thumbnail ${index}: ${media.type} - Using URL: ${media.thumbnailUrl} (thumbnailUrl: ${media.thumbnailUrl})`);
            console.log(`🔍 Item URLs available: ${media.urls ? 'YES' : 'undefined'}`);
            console.log(`🔍 HLS URL: ${media.hlsUrl || 'undefined'}`);
            
            // Preload and cache
            if (this.imageCache.has(media.thumbnailUrl)) {
              console.log(`✅ Thumbnail ${index} already cached`);
            } else {
              const preloadImg = new Image();
              preloadImg.onload = () => {
                this.imageCache.set(media.thumbnailUrl, preloadImg);
                console.log(`✅ Thumbnail ${index} cached`);
              };
              preloadImg.src = media.thumbnailUrl;
            }
          }
        });
      }
    });
    console.log(`✅ Aggressively preloaded and cached thumbnails for instant gallery loading`);
    console.log(`🔄 Initialized local project state with ${this.projects.length} items`);
    
    // Prevent infinite loop - check if already processing or completed
    if (currentImg.dataset.processing === 'true' || currentImg.dataset.completed === 'true') {
      console.log(`⚠️ Progressive loading already in progress or completed for project ${projectId}`);
      return;
    }
    
    // Mark as processing to prevent multiple calls
    currentImg.dataset.processing = 'true';

    // Check current quality
    const currentQuality = currentImg.dataset.quality;
    console.log(`📊 Progressive loading for project ${projectId} - Current: ${currentQuality}`);
    console.log(`🔍 Available image qualities:`, currentMedia.imageQualities);
    
    // Add media click logging like admin panel
    console.log(`🖱️ Media clicked - URL: ${currentMedia.url}, Type: ${currentMedia.type}, Project: ${projectId}`);
    console.log(`🖱️ Available projects:`, this.projects);
    console.log(`🚀 Starting aggressive preloading around project ${projectId} (total: ${this.projects.length})`);
    
    // If already at high quality, we're done!
    if (currentQuality === '1920w' || currentQuality === '1280w') {
      console.log(`✅ Already at high quality (${currentQuality}) - removing blur`);
      currentImg.style.filter = 'none';
      currentImg.style.transform = 'scale(1)';
      currentImg.dataset.processing = 'false';
      currentImg.dataset.completed = 'true';
      return;
    }
    
    // Add selectImageQuality logging like admin panel
    console.log(`🔍 selectImageQuality called with skipBlur: true`);
    console.log(`🔍 Available image qualities: (${currentMedia.imageQualities.length})`, currentMedia.imageQualities);
    console.log(`🔍 Looking for high quality images (skipBlur=true)`);
    console.log(`🔍 All available qualities: (${currentMedia.imageQualities.length})`, currentMedia.imageQualities);
    
    // Find the BEST quality (highest resolution)
    const bestQuality = currentMedia.imageQualities.find(q => q.resolution === '1920w')
                       || currentMedia.imageQualities.find(q => q.resolution === '1280w')
                       || currentMedia.imageQualities.find(q => q.resolution === '960w')
                       || null;
    
    console.log(`🔍 1920w quality found: ${currentMedia.imageQualities.find(q => q.resolution === '1920w') ? 'YES' : 'NO'}`);
    if (currentMedia.imageQualities.find(q => q.resolution === '1920w')) {
      const quality1920w = currentMedia.imageQualities.find(q => q.resolution === '1920w');
      console.log(`🔍 1920w quality details:`, {
        quality: quality1920w.quality,
        hasFormats: !!quality1920w.formats,
        url: quality1920w.url
      });
      console.log(`🔍 Best format found: ${quality1920w.formats ? 'YES ' + (quality1920w.formats.heif ? 'heif' : quality1920w.formats.webp ? 'webp' : 'jpg') : 'NO'}`);
      console.log(`✅ Using 1920w quality with modern format: ${quality1920w.formats ? (quality1920w.formats.heif ? 'heif' : quality1920w.formats.webp ? 'webp' : 'jpg') : 'jpg'}`);
    }
    
    if (!bestQuality) {
      console.log('⚠️ No high quality version found');
      console.log('🔍 Available qualities:', currentMedia.imageQualities.map(q => q.resolution));
          currentImg.style.filter = 'none';
      currentImg.style.transform = 'scale(1)';
      currentImg.dataset.processing = 'false';
      currentImg.dataset.completed = 'true';
      return;
    }
    
    console.log(`📥 Upgrading from ${currentQuality} to ${bestQuality.resolution}`);
    console.log(`🔍 Best quality details:`, bestQuality);
    
    // Add loading media logging like admin panel
    console.log(`🎬 Loading media 0: ${currentMedia.type} - URL: ${bestQuality.url}`);
    console.log(`🖼️ Starting with high quality (no blur): ${bestQuality.resolution} (${bestQuality.url})`);
    
    // Preload the high quality image in the background
    const highQualityImg = new Image();
    
    highQualityImg.onload = () => {
      console.log(`🚀 Image loaded - starting Facebook-style blur-up`);
      console.log(`📊 Progressive loading for project ${projectId} - Current: ${bestQuality.resolution}`);
      console.log(`🔍 Available image qualities: (${currentMedia.imageQualities.length})`, currentMedia.imageQualities);
      console.log(`✅ Already at high quality (${bestQuality.resolution}) - removing blur`);
      
      // Cache it
      this.cacheImage(bestQuality.url, highQualityImg);
      
      // FACEBOOK-STYLE SMOOTH TRANSITION
      // Step 1: Remove blur while keeping the low-quality image visible
      currentImg.style.transition = 'filter 0.3s ease-out, transform 0.3s ease-out';
      currentImg.style.filter = 'blur(0px)';
      currentImg.style.transform = 'scale(1)';
      
      // Step 2: Fade to high quality after blur is removed
      setTimeout(() => {
        currentImg.style.transition = 'opacity 0.2s ease-in-out';
        currentImg.style.opacity = '0.5';
        
        setTimeout(() => {
        // Swap to high quality
          currentImg.src = bestQuality.url;
        currentImg.dataset.quality = bestQuality.resolution;
          currentImg.style.opacity = '1';
        currentImg.dataset.processing = 'false';
        currentImg.dataset.completed = 'true';
        
        console.log(`🎉 Successfully upgraded to ${bestQuality.resolution} with smooth transition!`);
        console.log(`✅ Progressive loading complete for project ${projectId}!`);
      }, 100);
      }, 300);
    };
    
    highQualityImg.onerror = () => {
      console.log(`❌ Failed to load ${bestQuality.resolution}, keeping current quality`);
      // Just remove blur effect
      currentImg.style.filter = 'none';
      currentImg.style.transform = 'scale(1)';
      currentImg.dataset.processing = 'false';
      currentImg.dataset.completed = 'true';
    };
    
    // Start loading the high quality image
    highQualityImg.src = bestQuality.url;
  }

  // 🎯 CACHE IMAGE (EXACT COPY FROM ADMIN PANEL)
  cacheImage(url, imgElement) {
    if (!this.imageCache) {
      this.imageCache = new Map();
    }
    this.imageCache.set(url, imgElement);
  }

  // 🖱️ OPEN PROJECT (GALLERY VIEW)
  openProject(projectId) {
    console.log('🖱️ Opening project:', projectId);
    
    // Don't open grid_layout or other system items
    if (projectId === 'grid_layout' || projectId === 'layout' || !projectId) {
      console.log('⚠️ Cannot open system item:', projectId);
      return;
    }

    // Find the project
    const project = this.projects.find(p => p.id === projectId);
    if (!project) {
      console.log('⚠️ Project not found:', projectId);
      return;
    }

    // Set current project
    this.currentProject = project;
    
    // Create and show gallery modal
    this.showProjectGallery(project);
  }

  // 🎨 SHOW PROJECT GALLERY (EXACT COPY FROM ADMIN PANEL)
  showProjectGallery(project) {
    // Close any existing modal first to prevent stacking
    this.closeMediaViewer();
    
    // Create modal overlay - EXACT same as admin panel
    const modal = document.createElement('div');
    modal.className = 'project-gallery-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.9);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(10px);
    `;
    
    // Create gallery content - EXACT same as admin panel
    const galleryContent = document.createElement('div');
    galleryContent.className = 'project-gallery-content';
    galleryContent.style.cssText = `
      background: #1a1a1a;
      border-radius: 12px;
      padding: 20px;
      max-width: 90vw;
      max-height: 90vh;
      overflow: auto;
      position: relative;
    `;
    
    // Create header - EXACT same as admin panel
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 1px solid #333;
    `;
    
    // Project title - EXACT same styling as admin panel
    const title = document.createElement('h2');
    title.textContent = project.title;
    title.style.cssText = `
      color: #00d4aa;
      margin: 0;
      font-size: 1.5rem;
      font-weight: 600;
    `;
    
    // Close button - EXACT same as admin panel
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '✕';
    closeButton.style.cssText = `
      background: #333;
      color: white;
      border: none;
      border-radius: 50%;
      width: 30px;
      height: 30px;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    closeButton.onclick = () => this.closeProjectGallery();
    
    header.appendChild(title);
    header.appendChild(closeButton);
    
    // Create media viewer body - EXACT same as admin panel
    const mediaViewerBody = document.createElement('div');
    mediaViewerBody.className = 'media-viewer-body';
    mediaViewerBody.style.cssText = `
      display: grid;
      grid-template-columns: repeat(10, 1fr);
      gap: 8px;
      margin-top: 20px;
    `;
    
    // Add media items - EXACT same as admin panel
    if (project.content && project.content.length > 0) {
      project.content.forEach((media, index) => {
        const mediaItem = document.createElement('div');
        mediaItem.className = 'media-item';
        mediaItem.style.cssText = `
          aspect-ratio: 1;
          background: #2a2a2a;
          border-radius: 8px;
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.3s ease;
          position: relative;
        `;
        mediaItem.onmouseover = () => mediaItem.style.transform = 'scale(1.05)';
        mediaItem.onmouseout = () => mediaItem.style.transform = 'scale(1)';
        
        if (media.type === 'image') {
          const img = document.createElement('img');
          img.src = media.thumbnailUrl || media.url;
          img.alt = media.filename || 'Media item';
          img.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: contain;
            background: #1a1a1a;
            cursor: pointer;
          `;
          
          // Add click handler to open this image in full viewer
          img.onclick = () => {
            // Close the gallery modal first
            this.closeMediaViewer();
            // Open the image in full viewer
            this.showMediaItem(media, index);
          };
          
          mediaItem.appendChild(img);
          
          // Add "Movie" label if it's a video (admin panel style)
          if (media.filename && media.filename.includes('video')) {
            const label = document.createElement('div');
            label.textContent = 'Movie';
            label.style.cssText = `
              position: absolute;
              bottom: 5px;
              right: 5px;
              background: rgba(0, 0, 0, 0.7);
              color: white;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 10px;
              font-weight: 600;
            `;
            mediaItem.appendChild(label);
          }
        } else if (media.type === 'video') {
          const video = document.createElement('video');
          video.src = media.url;
          video.controls = true;
          video.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: contain;
            background: #1a1a1a;
            cursor: pointer;
          `;
          
          // Add click handler to open this video in full viewer
          video.onclick = () => {
            // Close the gallery modal first
            this.closeMediaViewer();
            // Open the video in full viewer
            this.showMediaItem(media, index);
          };
          
          mediaItem.appendChild(video);
          
          // Add "Movie" label for videos
          const label = document.createElement('div');
          label.textContent = 'Movie';
          label.style.cssText = `
            position: absolute;
            bottom: 5px;
            right: 5px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 600;
          `;
          mediaItem.appendChild(label);
        }
        
        mediaViewerBody.appendChild(mediaItem);
      });
        } else {
      const noMedia = document.createElement('div');
      noMedia.textContent = 'No media items';
      noMedia.style.cssText = `
        text-align: center;
        color: #888;
        padding: 40px;
        grid-column: 1 / -1;
      `;
      mediaViewerBody.appendChild(noMedia);
    }
    
    // Assemble gallery - EXACT same structure as admin panel
    galleryContent.appendChild(header);
    galleryContent.appendChild(mediaViewerBody);
    modal.appendChild(galleryContent);
    
    // Add to page
    document.body.appendChild(modal);
    
    // Close on backdrop click
    modal.onclick = (e) => {
      if (e.target === modal) {
        this.closeProjectGallery();
      }
    };
    
    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeProjectGallery();
      }
    });
  }

  // 🚪 CLOSE PROJECT GALLERY
  closeProjectGallery() {
    const modal = document.querySelector('.project-gallery-modal');
    if (modal) {
      modal.remove();
    }
    this.currentProject = null;
  }

  // 🖼️ OPEN MEDIA VIEWER (EXACT COPY FROM ADMIN PANEL)
  openMediaViewer(media, index) {
    console.log('🖼️ Opening media viewer for:', media.filename || media.alt);
    
    // Get current project and media items
    const project = this.currentProject;
    if (!project || !project.content) return;
    
    const mediaItems = project.content;
    const currentIndex = index;
    
    // Create full-screen modal - EXACT same as admin panel
    const modal = document.createElement('div');
    modal.className = 'media-viewer-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.95);
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(10px);
    `;
    
    // Create media container - EXACT same as admin panel
    const mediaContainer = document.createElement('div');
    mediaContainer.className = 'media-viewer-container';
    mediaContainer.style.cssText = `
      position: relative;
      max-width: 95vw;
      max-height: 95vh;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    // Create close button - EXACT same as admin panel
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '✕';
    closeButton.style.cssText = `
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      border: none;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      cursor: pointer;
      font-size: 18px;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    closeButton.onclick = () => this.closeMediaViewer();
    
    // Create navigation arrows - EXACT same as admin panel
    const leftArrow = document.createElement('button');
    leftArrow.innerHTML = '‹';
    leftArrow.style.cssText = `
      position: absolute;
      left: 20px;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(0, 0, 0, 0.7);
      color: white;
      border: none;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      cursor: pointer;
      font-size: 24px;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: ${currentIndex > 0 ? '1' : '0.3'};
      pointer-events: ${currentIndex > 0 ? 'auto' : 'none'};
    `;
    leftArrow.onclick = (e) => {
      e.stopPropagation();
      if (currentIndex > 0) {
        this.updateMediaViewer(mediaItems[currentIndex - 1], currentIndex - 1, modal);
      }
    };
    
    const rightArrow = document.createElement('button');
    rightArrow.innerHTML = '›';
    rightArrow.style.cssText = `
      position: absolute;
      right: 20px;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(0, 0, 0, 0.7);
      color: white;
      border: none;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      cursor: pointer;
      font-size: 24px;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: ${currentIndex < mediaItems.length - 1 ? '1' : '0.3'};
      pointer-events: ${currentIndex < mediaItems.length - 1 ? 'auto' : 'none'};
    `;
    rightArrow.onclick = (e) => {
      e.stopPropagation();
      if (currentIndex < mediaItems.length - 1) {
        this.updateMediaViewer(mediaItems[currentIndex + 1], currentIndex + 1, modal);
      }
    };
    
    // Create counter - EXACT same as admin panel
    const counter = document.createElement('div');
    counter.textContent = `${currentIndex + 1} of ${mediaItems.length}`;
    counter.style.cssText = `
      position: absolute;
      top: 20px;
      left: 20px;
      color: white;
      font-size: 16px;
      font-weight: 600;
      z-index: 10;
    `;
    
    // Create media element
    let mediaElement;
    if (media.type === 'image') {
      mediaElement = document.createElement('img');
      mediaElement.src = media.url;
      mediaElement.alt = media.filename || 'Media item';
      mediaElement.style.cssText = `
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        background: #1a1a1a;
        border-radius: 8px;
      `;
    } else if (media.type === 'video') {
      mediaElement = document.createElement('video');
      mediaElement.src = media.url;
      mediaElement.controls = true;
      mediaElement.autoplay = true;
      mediaElement.style.cssText = `
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        background: #1a1a1a;
        border-radius: 8px;
      `;
    }
    
    // Assemble modal - EXACT same as admin panel
    mediaContainer.appendChild(closeButton);
    mediaContainer.appendChild(leftArrow);
    mediaContainer.appendChild(rightArrow);
    mediaContainer.appendChild(counter);
    mediaContainer.appendChild(mediaElement);
    modal.appendChild(mediaContainer);
    
    // Add to page
    document.body.appendChild(modal);
    
    // Close on backdrop click
    modal.onclick = (e) => {
      if (e.target === modal) {
        this.closeMediaViewer();
      }
    };
    
    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeMediaViewer();
      }
    });
  }

  // 🖼️ SHOW MEDIA ITEM (EXACT COPY FROM ADMIN PANEL)
  showMediaItem(media, index, modal) {
    const mediaContainer = modal.querySelector('.media-viewer-container');
    const mediaElement = mediaContainer.querySelector('img, video');
    const counter = mediaContainer.querySelector('div');
    const leftArrow = mediaContainer.querySelector('button:nth-of-type(1)');
    const rightArrow = mediaContainer.querySelector('button:nth-of-type(2)');
    
    // Update media element
    if (media.type === 'image') {
      mediaElement.src = media.url;
      mediaElement.alt = media.filename || 'Media item';
    } else if (media.type === 'video') {
      mediaElement.src = media.url;
    }
    
    // Update counter
    counter.textContent = `${index + 1} of ${this.currentProject.content.length}`;
    
    // Update arrow states
    leftArrow.style.opacity = index > 0 ? '1' : '0.3';
    leftArrow.style.pointerEvents = index > 0 ? 'auto' : 'none';
    rightArrow.style.opacity = index < this.currentProject.content.length - 1 ? '1' : '0.3';
    rightArrow.style.pointerEvents = index < this.currentProject.content.length - 1 ? 'auto' : 'none';
    
    // Update click handlers - FIX: Don't create new viewers, just update existing one
    leftArrow.onclick = (e) => {
      e.stopPropagation();
      if (index > 0) {
        this.updateMediaViewer(this.currentProject.content[index - 1], index - 1, modal);
      }
    };
    
    rightArrow.onclick = (e) => {
      e.stopPropagation();
      if (index < this.currentProject.content.length - 1) {
        this.updateMediaViewer(this.currentProject.content[index + 1], index + 1, modal);
      }
    };
  }

  // 🔄 UPDATE MEDIA VIEWER (FIX: Update existing viewer with full Facebook-style loading)
  updateMediaViewer(media, index, modal) {
    console.log(`🔄 Updating media viewer to index ${index}:`, media.filename || media.alt);
    console.log('🔍 Modal element:', modal);
    
    const mediaContainer = modal.querySelector('.media-viewer-container');
    console.log('🔍 Media container found:', mediaContainer);
    
    if (!mediaContainer) {
      console.error('❌ Media container not found! Cannot update viewer.');
      return;
    }
    
    const mediaElement = mediaContainer.querySelector('img, video');
    const counter = mediaContainer.querySelector('div');
    const leftArrow = mediaContainer.querySelector('button:nth-of-type(1)');
    const rightArrow = mediaContainer.querySelector('button:nth-of-type(2)');
    
    console.log('🔍 Elements found:', {
      mediaElement: !!mediaElement,
      counter: !!counter,
      leftArrow: !!leftArrow,
      rightArrow: !!rightArrow
    });
    
    // Add full Facebook-style loading like admin panel
    console.log(`🚀 Starting aggressive preloading around index ${index} (total: ${this.currentProject.content.length})`);
    
    // Preload and cache surrounding images
    for (let i = Math.max(0, index - 1); i <= Math.min(this.currentProject.content.length - 1, index + 1); i++) {
      const surroundingMedia = this.currentProject.content[i];
      if (surroundingMedia && surroundingMedia.type === 'image' && surroundingMedia.thumbnailUrl) {
        if (this.imageCache.has(surroundingMedia.thumbnailUrl)) {
          console.log(`✅ Image already cached: 320w (index ${i})`);
        } else {
          const preloadImg = new Image();
          preloadImg.onload = () => {
            this.imageCache.set(surroundingMedia.thumbnailUrl, preloadImg);
            console.log(`✅ Image cached: 320w (index ${i})`);
          };
          preloadImg.src = surroundingMedia.thumbnailUrl;
        }
      }
    }
    
    // Add media loading logging like admin panel
    console.log(`🎬 Loading media ${index}: ${media.type} - URL: ${media.url}`);
    
    // Add selectImageQuality logging like admin panel
    if (media.imageQualities && media.imageQualities.length > 0) {
      console.log(`🔍 selectImageQuality called with skipBlur: true`);
      console.log(`🔍 Available image qualities: (${media.imageQualities.length})`, media.imageQualities);
      console.log(`🔍 Looking for high quality images (skipBlur=true)`);
      console.log(`🔍 All available qualities: (${media.imageQualities.length})`, media.imageQualities);
      
      const quality1920w = media.imageQualities.find(q => q.resolution === '1920w');
      if (quality1920w) {
        console.log(`🔍 1920w quality found: YES`);
        console.log(`🔍 1920w quality details:`, {
          quality: quality1920w.quality,
          hasFormats: !!quality1920w.formats,
          url: quality1920w.url
        });
        console.log(`🔍 Best format found: ${quality1920w.formats ? 'YES ' + (quality1920w.formats.heif ? 'heif' : quality1920w.formats.webp ? 'webp' : 'jpg') : 'NO'}`);
        console.log(`✅ Using 1920w quality with modern format: ${quality1920w.formats ? (quality1920w.formats.heif ? 'heif' : quality1920w.formats.webp ? 'webp' : 'jpg') : 'jpg'}`);
        console.log(`🖼️ Starting with high quality (no blur): 1920w (${quality1920w.url})`);
      }
    }
    
    // Update media element - SIMPLIFIED VERSION FIRST
    if (media.type === 'image' && mediaElement) {
      console.log('🖼️ Updating image element with new media');
      
      // Get the high quality image URL
      const highQualityImage = this.getProjectCoverImage({ content: [media] });
      console.log('🖼️ High quality image URL:', highQualityImage);
      
      if (highQualityImage) {
        // Simple direct update first to test navigation
        console.log('🔄 Before update - current src:', mediaElement.src);
        console.log('🔄 Setting new src to:', highQualityImage);
        
        mediaElement.src = highQualityImage;
        mediaElement.alt = media.filename || 'Media item';
        mediaElement.style.filter = 'none';
        mediaElement.style.transform = 'scale(1)';
        mediaElement.style.opacity = '1';
        
        console.log('🔄 After update - new src:', mediaElement.src);
        console.log('✅ Image updated successfully');
        
        // Force a reload in case of caching issues
        mediaElement.load();
      } else {
        console.error('❌ No image URL found for media:', media);
      }
    } else if (media.type === 'video' && mediaElement) {
      console.log('🎥 Updating video element with new media');
      mediaElement.src = media.url;
      mediaElement.load();
    } else {
      console.error('❌ Cannot update media - missing element or unsupported type:', {
        type: media.type,
        hasElement: !!mediaElement
      });
    }
    
    // Update counter
    counter.textContent = `${index + 1} of ${this.currentProject.content.length}`;
    
    // Update arrow states
    leftArrow.style.opacity = index > 0 ? '1' : '0.3';
    leftArrow.style.pointerEvents = index > 0 ? 'auto' : 'none';
    rightArrow.style.opacity = index < this.currentProject.content.length - 1 ? '1' : '0.3';
    rightArrow.style.pointerEvents = index < this.currentProject.content.length - 1 ? 'auto' : 'none';
    
    // Update click handlers - FIX: Use updateMediaViewer instead of showMediaItem
    leftArrow.onclick = (e) => {
      e.stopPropagation();
      if (index > 0) {
        this.updateMediaViewer(this.currentProject.content[index - 1], index - 1, modal);
      }
    };
    
    rightArrow.onclick = (e) => {
      e.stopPropagation();
      if (index < this.currentProject.content.length - 1) {
        this.updateMediaViewer(this.currentProject.content[index + 1], index + 1, modal);
      }
    };
  }

  // 🚪 CLOSE MEDIA VIEWER
  closeMediaViewer() {
    // Close both possible modal types to be safe
    const galleryModal = document.querySelector('.project-gallery-modal');
    const viewerModal = document.querySelector('.media-viewer-modal');
    
    if (galleryModal) {
      galleryModal.remove();
    }
    if (viewerModal) {
      viewerModal.remove();
    }
  }

  // 🎯 SETUP EVENT LISTENERS
  setupEventListeners() {
    // Add any event listeners needed
    console.log('🎯 Event listeners setup complete');
    console.log('✅ Portfolio Gallery ready!');
  }
}

// 🚀 INITIALIZE PORTFOLIO GALLERY
const portfolioGallery = new PortfolioGallery();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  portfolioGallery.init();
});