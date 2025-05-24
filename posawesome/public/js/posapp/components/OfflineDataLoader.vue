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
      statusInterval: null,
      retryCount: 0,
      maxRetries: 3
    };
  },
  methods: {
    async initializeBootstrap() {
      try {
        // Reset status
        this.loading = true;
        this.error = null;
        this.complete = false;
        this.progress = 5;
        this.status_message = __('Initializing offline database...');
        
        // If we've already tried multiple times, force a complete reset
        if (this.retryCount >= 2) {
          this.details = __('Attempting recovery after previous failures...');
          
          // Clear browser caches on retry
          try {
            if (window.caches && window.caches.keys) {
              const cacheKeys = await window.caches.keys();
              for (const key of cacheKeys) {
                if (key.includes('posawesome')) {
                  await window.caches.delete(key);
                  console.log(`Cache '${key}' deleted`);
                }
              }
            }
          } catch (cacheError) {
            console.warn('Error clearing caches:', cacheError);
          }
          
          // Clear IndexedDB databases
          try {
            await this.clearAllDatabases();
          } catch (dbError) {
            console.warn('Error clearing databases:', dbError);
          }
          
          // Wait longer to ensure cleanup completes
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Initialize database
        this.details = __('Creating database for offline data...');
        let db = null;
        try {
          db = await initOfflineStores();
        } catch (dbError) {
          console.error('Failed to initialize database:', dbError);
          // If database init fails, try one more time after a delay
          this.details = __('Database initialization failed, retrying...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          db = await initOfflineStores();
        }
        
        if (!db) {
          throw new Error('Failed to initialize database');
        }
        
        // Check if bootstrap is needed
        this.details = __('Checking if offline data needs to be updated...');
        let bootstrapNeeded = true;
        try {
          bootstrapNeeded = await checkBootstrapNeeded(db, this.pos_profile);
        } catch (checkError) {
          console.warn('Error checking bootstrap need, assuming needed:', checkError);
          bootstrapNeeded = true;
        }
        
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
          this.retryCount = 0; // Reset retry count on success
          
          // Emit completion event
          this.$emit('bootstrap-progress', 100);
        } else {
          // Bootstrap failed
          const status = getBootstrapStatus();
          this.loading = false;
          this.error = status.error || __('Unknown error during bootstrap');
          this.status_message = __('Data preparation failed');
          this.details = __('Please check your connection and try again');
          this.retryCount++; // Increment retry count
        }
      } catch (error) {
        console.error('Bootstrap initialization error:', error);
        this.loading = false;
        this.error = error.message;
        this.status_message = __('Failed to initialize');
        this.details = __('Try refreshing the page or clearing browser data');
        this.retryCount++; // Increment retry count
        
        // Try to provide more helpful error message based on error type
        if (error.message.includes('IndexedDB') || error.message.includes('object store')) {
          this.details = __('Browser database error. Try clearing your browser data and restarting your browser.');
        } else if (error.message.includes('network') || error.message.includes('connection')) {
          this.details = __('Network error. Check your internet connection and try again.');
        }
      }
    },
    
    async clearAllDatabases() {
      const dbNames = ['posawesome-offline-db'];
      
      for (const dbName of dbNames) {
        try {
          await this.deleteDatabase(dbName);
          console.log(`Database ${dbName} deleted`);
        } catch (error) {
          console.warn(`Failed to delete database ${dbName}:`, error);
        }
      }
    },
    
    async deleteDatabase(dbName) {
      return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(dbName);
        
        request.onsuccess = () => {
          console.log(`Database ${dbName} successfully deleted`);
          resolve();
        };
        
        request.onerror = (event) => {
          reject(new Error(`Error deleting database ${dbName}: ${event.target.error}`));
        };
        
        request.onblocked = () => {
          console.warn(`Database ${dbName} deletion blocked`);
          // Try to continue anyway
          resolve();
        };
      });
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
      // Ask user to confirm clear database on retry
      if (this.retryCount >= 2) {
        if (confirm(__('Multiple attempts have failed. Would you like to completely reset the offline database? This will clear all cached data.'))) {
          console.log('User confirmed database reset, starting fresh bootstrap');
          
          // Show loading state
          this.loading = true;
          this.error = null;
          this.progress = 2;
          this.status_message = __('Resetting offline database...');
          this.details = __('Clearing existing data...');
          
          // Use setTimeout to allow UI to update before starting potentially slow operation
          setTimeout(() => {
            this.initializeBootstrap();
          }, 500);
        } else {
          // Just retry without clearing database
          this.initializeBootstrap();
        }
      } else {
        // Regular retry
        this.initializeBootstrap();
      }
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