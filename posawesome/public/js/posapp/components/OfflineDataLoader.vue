<template>
  <v-container class="fill-height">
    <v-row justify="center" align="center">
      <v-col cols="12" sm="8" md="6" lg="4">
        <v-card class="elevation-6 pa-4">
          <v-card-title class="text-h5 justify-center">
            {{ __("Offline Data Preparation") }}
          </v-card-title>
          
          <v-card-text class="text-center">
            <v-progress-circular
              v-if="loading && !error"
              :size="100"
              :width="10"
              :model-value="progress"
              color="primary"
              class="mb-3"
            >
              {{ progress }}%
            </v-progress-circular>
            
            <v-icon 
              v-if="!loading && !error && complete" 
              size="100" 
              color="success"
              class="mb-3"
            >
              mdi-check-circle-outline
            </v-icon>
            
            <v-icon 
              v-if="error" 
              size="100" 
              color="error"
              class="mb-3"
            >
              mdi-alert-circle-outline
            </v-icon>
            
            <h3 class="text-h6 mb-3">{{ status_message }}</h3>
            
            <div v-if="details" class="text-body-1 mb-4">
              {{ details }}
            </div>
            
            <div v-if="error" class="error-message pa-3 mb-4 text-left">
              <p class="font-weight-bold">{{ __("Error details:") }}</p>
              <p>{{ error }}</p>
            </div>
          </v-card-text>
          
          <v-card-actions v-if="error || complete">
            <v-spacer></v-spacer>
            <v-btn
              v-if="error"
              color="primary"
              variant="elevated"
              @click="retryBootstrap"
            >
              {{ __("Retry") }}
            </v-btn>
            <v-btn
              v-if="complete"
              color="success"
              variant="elevated"
              @click="$emit('bootstrap-complete')"
            >
              {{ __("Continue") }}
            </v-btn>
            <v-spacer></v-spacer>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { startBootstrap, getBootstrapStatus, isBootstrapComplete, initOfflineStores, checkBootstrapNeeded } from '../offline_bootstrap';

export default {
  name: 'OfflineDataLoader',
  props: {
    pos_profile: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      loading: true,
      progress: 0,
      status_message: __('Preparing offline data...'),
      details: '',
      error: null,
      complete: false,
      statusInterval: null
    };
  },
  methods: {
    async initializeBootstrap() {
      try {
        this.loading = true;
        this.error = null;
        this.complete = false;
        this.progress = 5;
        this.status_message = __('Initializing offline database...');
        
        // Initialize database
        const db = await initOfflineStores();
        
        // Check if bootstrap is needed
        const bootstrapNeeded = await checkBootstrapNeeded(db, this.pos_profile);
        
        if (!bootstrapNeeded) {
          // Bootstrap not needed, use cached data
          this.loading = false;
          this.complete = true;
          this.progress = 100;
          this.status_message = __('Ready to use');
          this.details = __('Using cached data from previous session');
          return;
        }
        
        // Start bootstrap process
        this.status_message = __('Starting data download...');
        this.details = __('This may take a few minutes depending on your data size');
        
        // Start progress monitoring
        this.startProgressMonitoring();
        
        // Start the bootstrap process
        const result = await startBootstrap(this.pos_profile);
        
        // Clear interval
        if (this.statusInterval) {
          clearInterval(this.statusInterval);
          this.statusInterval = null;
        }
        
        if (result) {
          // Bootstrap successful
          this.loading = false;
          this.complete = true;
          this.progress = 100;
          this.status_message = __('Offline data ready');
          this.details = __('All master data has been downloaded and verified');
          
          // Emit completion event
          this.$emit('bootstrap-progress', 100);
        } else {
          // Bootstrap failed
          const status = getBootstrapStatus();
          this.loading = false;
          this.error = status.error || __('Unknown error during bootstrap');
          this.status_message = __('Data preparation failed');
          this.details = __('Please check your connection and try again');
        }
      } catch (error) {
        console.error('Bootstrap initialization error:', error);
        this.loading = false;
        this.error = error.message;
        this.status_message = __('Failed to initialize');
        this.details = __('Please check console for details');
      }
    },
    
    startProgressMonitoring() {
      // Clear any existing interval
      if (this.statusInterval) {
        clearInterval(this.statusInterval);
      }
      
      // Set up interval to check progress
      this.statusInterval = setInterval(() => {
        const status = getBootstrapStatus();
        this.progress = status.progress || 0;
        this.status_message = status.message || __('Preparing data...');
        
        // Emit progress event
        this.$emit('bootstrap-progress', this.progress);
        
        // Check if complete
        if (isBootstrapComplete()) {
          clearInterval(this.statusInterval);
          this.statusInterval = null;
          this.loading = false;
          this.complete = true;
        }
        
        // Check for error
        if (status.error) {
          clearInterval(this.statusInterval);
          this.statusInterval = null;
          this.loading = false;
          this.error = status.error;
          this.status_message = __('Bootstrap failed');
        }
      }, 500);
    },
    
    retryBootstrap() {
      this.initializeBootstrap();
    }
  },
  mounted() {
    // Start bootstrap when component is mounted
    this.initializeBootstrap();
  },
  beforeUnmount() {
    // Clear interval when component is destroyed
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }
  }
};
</script>

<style scoped>
.error-message {
  background-color: rgba(var(--v-theme-error), 0.05);
  border-left: 4px solid rgb(var(--v-theme-error));
  border-radius: 4px;
}
</style> 