<template>
  <i v-if="useWebfont" :class="webfontClasses" :style="iconStyle" aria-hidden="true"></i>
  <svg v-else class="icon" aria-hidden="true" v-bind="$attrs" @error="handleSvgError">
    <use :xlink:href="iconUrl" />
  </svg>
</template>

<script>
// Keep track of missing icons to avoid duplicate logging
const reportedMissingIcons = new Set();

export default {
  name: 'Icon',
  props: {
    name: {
      type: String,
      required: true
    },
    size: {
      type: String,
      default: null
    },
    color: {
      type: String,
      default: null
    }
  },
  data() {
    return {
      iconLoadFailed: false,
      useWebfont: false,
      parentColor: null,
      parentSize: null,
      parentBackgroundColor: null
    };
  },
  computed: {
    effectiveName() {
      return this.name;
    },
    iconUrl() {
      // Use local sprite
      return `/assets/posawesome/dist/mdi-sprite.svg#mdi-${this.effectiveName}`;
    },
    webfontClasses() {
      return [
        'mdi',
        `mdi-${this.effectiveName}`
      ];
    },
    iconStyle() {
      // Apply explicit size and color if provided, otherwise inherit from parent
      const style = {};
      
      // Size handling - priority: prop > parent > default
      if (this.size) {
        style.fontSize = this.size;
      } else if (this.parentSize) {
        // Convert parent size to em for consistency
        const numericSize = parseFloat(this.parentSize);
        const unit = this.parentSize.replace(numericSize, '');
        
        // If parent has pixel size, convert to em for better scaling
        if (unit === 'px') {
          style.fontSize = `${numericSize / 16}em`; // Assuming 16px base font size
        } else {
          style.fontSize = this.parentSize;
        }
      }
      
      // Color handling - priority: prop > parent > inherit
      if (this.color) {
        style.color = this.color;
      } else if (this.parentColor) {
        style.color = this.parentColor;
      }
      
      // Ensure proper contrast with background if needed
      if (this.parentBackgroundColor && !this.color && !this.parentColor) {
        // Simple contrast detection - if background is light, use dark text and vice versa
        const rgb = this.getRgbFromColor(this.parentBackgroundColor);
        if (rgb) {
          // Calculate perceived brightness
          const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
          if (brightness > 125) {
            style.color = '#000000'; // Dark text for light background
          } else {
            style.color = '#ffffff'; // Light text for dark background
          }
        }
      }
      
      return style;
    }
  },
  methods: {
    getRgbFromColor(color) {
      // Helper to extract RGB values from color string
      if (!color) return null;
      
      // Handle hex
      if (color.startsWith('#')) {
        const hex = color.substring(1);
        return {
          r: parseInt(hex.substring(0, 2), 16),
          g: parseInt(hex.substring(2, 4), 16),
          b: parseInt(hex.substring(4, 6), 16)
        };
      }
      
      // Handle rgb/rgba
      if (color.startsWith('rgb')) {
        const values = color.match(/\d+/g);
        if (values && values.length >= 3) {
          return {
            r: parseInt(values[0]),
            g: parseInt(values[1]),
            b: parseInt(values[2])
          };
        }
      }
      
      return null;
    },
    
    handleSvgError() {
      // Only log each missing icon once to avoid console spam
      if (!reportedMissingIcons.has(this.name)) {
        console.error(`[Icon] Failed to load icon: ${this.name}`);
        reportedMissingIcons.add(this.name);
        
        // Add to missing icons list in localStorage for later reference
        try {
          const missingIcons = JSON.parse(localStorage.getItem('posawesome_missing_icons') || '[]');
          if (!missingIcons.includes(this.name)) {
            missingIcons.push(this.name);
            localStorage.setItem('posawesome_missing_icons', JSON.stringify(missingIcons));
          }
        } catch (e) {
          console.error('Error storing missing icon in localStorage:', e);
        }
        
        // Capture parent styling before switching to webfont
        this.captureParentStyling();
        
        // Switch to webfont version
        console.info(`[Icon] Switching to webfont for: ${this.name}`);
        this.useWebfont = true;
        
        // Dynamically load the MDI webfont CSS if not already loaded
        if (!document.getElementById('mdi-webfont')) {
          const link = document.createElement('link');
          link.id = 'mdi-webfont';
          link.rel = 'stylesheet';
          link.href = '/assets/posawesome/css/materialdesignicons.min.css';
          document.head.appendChild(link);
          
          // Fallback to CDN if local file doesn't exist
          link.onerror = () => {
            link.href = 'https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css';
          };
        }
      }
    },
    
    captureParentStyling() {
      // Capture the computed styles from the parent element to apply to webfont
      if (this.$el && this.$el.parentElement) {
        const parentStyle = window.getComputedStyle(this.$el.parentElement);
        this.parentColor = parentStyle.color;
        this.parentSize = parentStyle.fontSize;
        this.parentBackgroundColor = parentStyle.backgroundColor;
        
        // If parent has a gradient background, try to extract a color from it
        if (this.parentBackgroundColor === 'rgba(0, 0, 0, 0)' && parentStyle.background) {
          // Check if it's a gradient
          if (parentStyle.background.includes('gradient')) {
            // Extract the first color from the gradient
            const match = parentStyle.background.match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}/i);
            if (match) {
              this.parentBackgroundColor = match[0];
            }
          }
        }
      }
    },
    
    // Method to export missing icons report
    exportMissingIconsReport() {
      try {
        const confirmedMissing = JSON.parse(localStorage.getItem('posawesome_missing_icons') || '[]');
        const suspectedMissing = JSON.parse(localStorage.getItem('posawesome_suspected_missing_icons') || '[]');
        
        const report = {
          timestamp: new Date().toISOString(),
          confirmedMissing,
          suspectedMissing,
          total: confirmedMissing.length + suspectedMissing.length
        };
        
        console.table({
          'Confirmed Missing': confirmedMissing.length,
          'Suspected Missing': suspectedMissing.length,
          'Total': report.total
        });
        
        console.log('Confirmed Missing Icons:', confirmedMissing);
        console.log('Suspected Missing Icons:', suspectedMissing);
        
        return report;
      } catch (e) {
        console.error('Error generating missing icons report:', e);
        return null;
      }
    }
  },
  mounted() {
    // Capture parent styling on mount for consistent initial rendering
    this.$nextTick(() => {
      this.captureParentStyling();
    });
    
    // Check if the icon exists in the sprite
    // This is a more proactive approach than waiting for error events
    setTimeout(() => {
      const iconElement = this.$el;
      // Check if the icon is rendered properly
      const computedStyle = window.getComputedStyle(iconElement);
      const hasContent = iconElement.getBBox && 
                        (iconElement.getBBox().width > 0 || 
                         iconElement.getBBox().height > 0);
      
      if (!hasContent && !reportedMissingIcons.has(this.name)) {
        console.warn(`[Icon] Possible missing icon: ${this.name}`);
        reportedMissingIcons.add(this.name);
        
        // Add to suspected missing icons list
        try {
          const suspectedMissingIcons = JSON.parse(localStorage.getItem('posawesome_suspected_missing_icons') || '[]');
          if (!suspectedMissingIcons.includes(this.name)) {
            suspectedMissingIcons.push(this.name);
            localStorage.setItem('posawesome_suspected_missing_icons', JSON.stringify(suspectedMissingIcons));
          }
        } catch (e) {
          console.error('Error storing suspected missing icon in localStorage:', e);
        }
        
        // Capture parent styling before switching to webfont
        this.captureParentStyling();
        
        // Switch to webfont version
        console.info(`[Icon] Switching to webfont for: ${this.name}`);
        this.useWebfont = true;
        
        // Dynamically load the MDI webfont CSS if not already loaded
        if (!document.getElementById('mdi-webfont')) {
          const link = document.createElement('link');
          link.id = 'mdi-webfont';
          link.rel = 'stylesheet';
          
          // Try local file first
          link.href = '/assets/posawesome/css/materialdesignicons.min.css';
          document.head.appendChild(link);
          
          // Fallback to CDN if local file doesn't exist
          link.onerror = () => {
            console.warn('[Icon] Local webfont CSS not found, falling back to CDN');
            link.href = 'https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css';
            
            // If CDN also fails, log an error
            link.onerror = () => {
              console.error('[Icon] Failed to load webfont CSS from CDN');
            };
          };
        }
      }
    }, 500); // Give the SVG some time to load
  }
}
</script>

<style>
.icon {
  width: 1em;
  height: 1em;
  vertical-align: -0.15em;
  fill: currentColor;
  overflow: hidden;
}

/* Enhanced styling for MDI webfont icons to match SVG icons */
.mdi {
  display: inline-block;
  font-size: 1em;
  width: 1em;
  height: 1em;
  vertical-align: -0.15em;
  color: inherit; /* Ensure color inheritance */
  line-height: 1;
  text-rendering: auto;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Fix for icons in fixed-size containers */
.menu-icon-wrapper-compact .mdi,
.menu-icon-wrapper-compact .icon {
  font-size: 18px; /* Match the size used in the navbar icons */
  color: white; /* Ensure white color in the colored icon wrappers */
}

/* Ensure proper sizing in other common containers */
.v-btn .mdi,
.v-btn .icon {
  font-size: 1.25em; /* Match Vuetify's icon sizing in buttons */
}

/* Ensure proper alignment in chips */
.v-chip .mdi,
.v-chip .icon {
  margin-right: 0.25em;
}
</style>