export const responsiveMixin = {
  data() {
    return {
      containerWidth: 0,
      containerHeight: 0,
      baseWidth: 0,
      baseHeight: 0,
      resizeObserver: null,
    };
  },
  
  computed: {
    // Dynamic scaling factors
    widthScale() {
      return this.containerWidth / this.baseWidth;
    },
    heightScale() {
      return this.containerHeight / this.baseHeight;
    },
    averageScale() {
      return (this.widthScale + this.heightScale) / 2;
    },
    
    // Dynamic spacing values
    dynamicSpacing() {
      const baseSpacing = {
        xs: 4,   // 4px base
        sm: 8,   // 8px base
        md: 16,  // 16px base
        lg: 24,  // 24px base
        xl: 32   // 32px base
      };
      
      return {
        xs: Math.max(2, Math.round(baseSpacing.xs * this.averageScale)),
        sm: Math.max(4, Math.round(baseSpacing.sm * this.averageScale)),
        md: Math.max(8, Math.round(baseSpacing.md * this.averageScale)),
        lg: Math.max(12, Math.round(baseSpacing.lg * this.averageScale)),
        xl: Math.max(16, Math.round(baseSpacing.xl * this.averageScale))
      };
    },
    
    // Dynamic CSS variables
    responsiveStyles() {
      // Calculate responsive card height based on screen size and available space
      let cardHeightVh;
      
      if (this.containerWidth <= 480) {
        // Mobile: smaller height to accommodate touch interface
        cardHeightVh = Math.round(45 * this.heightScale);
      } else if (this.containerWidth <= 768) {
        // Tablet: medium height
        cardHeightVh = Math.round(55 * this.heightScale);
      } else {
        // Desktop: full height
        cardHeightVh = Math.round(60 * this.heightScale);
      }
      
      // Ensure minimum and maximum bounds
      cardHeightVh = Math.max(30, Math.min(cardHeightVh, 70));
      
      return {
        '--dynamic-xs': `${this.dynamicSpacing.xs}px`,
        '--dynamic-sm': `${this.dynamicSpacing.sm}px`,
        '--dynamic-md': `${this.dynamicSpacing.md}px`,
        '--dynamic-lg': `${this.dynamicSpacing.lg}px`,
        '--dynamic-xl': `${this.dynamicSpacing.xl}px`,
        '--container-height': `${Math.round(68 * this.heightScale)}vh`,
        '--card-height': `${cardHeightVh}vh`,
        '--font-scale': this.averageScale.toFixed(2)
      };
    }
  },
  
  mounted() {
    this.initResizeObserver();
  },

  beforeUnmount() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  },
  
  methods: {
    initResizeObserver() {
      const el = this.$el || document.body;
      const rect = el.getBoundingClientRect();
      this.containerWidth = rect.width;
      this.containerHeight = rect.height;
      this.baseWidth = rect.width;
      this.baseHeight = rect.height;
      this.resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          if (entry.contentRect) {
            this.containerWidth = entry.contentRect.width;
            this.containerHeight = entry.contentRect.height;
          }
        }
      });
      this.resizeObserver.observe(el);
    }
  }};