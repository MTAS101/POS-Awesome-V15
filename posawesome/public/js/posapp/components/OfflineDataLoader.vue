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
            
            <div v-if="debugMode && debugLog.length > 0" class="debug-panel">
              <p class="font-weight-bold">{{ __("Debug Log:") }}</p>
              <div v-for="(entry, index) in debugLog" :key="index">
                {{ entry.time.toLocaleTimeString() }}: {{ entry.message }}
              </div>
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
import { startBootstrap, getBootstrapStatus, isBootstrapComplete, initOfflineStores, checkBootstrapNeeded, getDetailedLog } from '../offline_bootstrap';

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
      maxRetries: 3,
      startTime: null,
      progressTimeout: null,
      stuckAtProgress: null,
      stuckDuration: 0,
      debugMode: false,
      debugLog: []
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
        this.startTime = Date.now();
        this.stuckAtProgress = null;
        this.stuckDuration = 0;
        
        // Clear any existing timeouts
        if (this.progressTimeout) {
          clearTimeout(this.progressTimeout);
        }
        
        // Set a timeout to detect if progress gets stuck
        this.progressTimeout = setTimeout(() => {
          this.handleProgressStuck();
        }, 30000); // 30 seconds
        
        // Log debug info
        this.logDebug('Starting bootstrap initialization');
        
        // If we've already tried multiple times, force a complete reset
        if (this.retryCount >= 2) {
          this.details = __('Attempting recovery after previous failures...');
          this.logDebug('Multiple retries detected, performing full reset');
          
          // Clear browser caches on retry
          try {
            if (window.caches && window.caches.keys) {
              const cacheKeys = await window.caches.keys();
              for (const key of cacheKeys) {
                if (key.includes('posawesome')) {
                  await window.caches.delete(key);
                  this.logDebug(`Cache '${key}' deleted`);
                }
              }
            }
          } catch (cacheError) {
            this.logDebug(`Error clearing caches: ${cacheError.message}`);
          }
          
          // Clear IndexedDB databases
          try {
            await this.clearAllDatabases();
          } catch (dbError) {
            this.logDebug(`Error clearing databases: ${dbError.message}`);
          }
          
          // Wait longer to ensure cleanup completes
          this.details = __('Performing deep cleanup...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          this.logDebug('Deep cleanup completed');
        }
        
        // Initialize database
        this.details = __('Creating database for offline data...');
        let db = null;
        try {
          this.logDebug('Calling initOfflineStores');
          db = await initOfflineStores();
          this.logDebug('Database initialization successful');
        } catch (dbError) {
          this.logDebug(`Database initialization failed: ${dbError.message}`);
          
          // If database init fails, try one more time after a delay
          this.details = __('Database initialization failed, retrying...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          this.logDebug('Retrying database initialization');
          db = await initOfflineStores();
        }
        
        if (!db) {
          this.logDebug('Database initialization returned null');
          throw new Error('Failed to initialize database');
        }
        
        // Update progress since we've successfully initialized the database
        this.progress = 15;
        clearTimeout(this.progressTimeout);
        this.progressTimeout = setTimeout(() => {
          this.handleProgressStuck();
        }, 30000); // Reset 30 second timeout
        
        // Check if bootstrap is needed
        this.details = __('Checking if offline data needs to be updated...');
        let bootstrapNeeded = true;
        try {
          this.logDebug('Checking if bootstrap is needed');
          bootstrapNeeded = await checkBootstrapNeeded(db, this.pos_profile);
          this.logDebug(`Bootstrap needed: ${bootstrapNeeded}`);
        } catch (checkError) {
          this.logDebug(`Error checking bootstrap need: ${checkError.message}`);
          bootstrapNeeded = true;
        }
        
        if (!bootstrapNeeded) {
          // Bootstrap not needed, use cached data
          this.loading = false;
          this.complete = true;
          this.progress = 100;
          this.status_message = __('Ready to use');
          this.details = __('Using cached data from previous session');
          this.logDebug('Using cached data, bootstrap complete');
          
          // Clear timeout
          if (this.progressTimeout) {
            clearTimeout(this.progressTimeout);
            this.progressTimeout = null;
          }
          
          return;
        }
        
        // Start bootstrap process
        this.status_message = __('Starting data download...');
        this.details = __('This may take a few minutes depending on your data size');
        
        // Start progress monitoring
        this.startProgressMonitoring();
        
        // Start the bootstrap process
        this.logDebug('Starting bootstrap process');
        const result = await startBootstrap(this.pos_profile);
        this.logDebug(`Bootstrap process result: ${result}`);
        
        // Clear interval and timeout
        if (this.statusInterval) {
          clearInterval(this.statusInterval);
          this.statusInterval = null;
        }
        
        if (this.progressTimeout) {
          clearTimeout(this.progressTimeout);
          this.progressTimeout = null;
        }
        
        if (result) {
          // Bootstrap successful
          this.loading = false;
          this.complete = true;
          this.progress = 100;
          this.status_message = __('Offline data ready');
          this.details = __('All master data has been downloaded and verified');
          this.retryCount = 0; // Reset retry count on success
          this.logDebug('Bootstrap completed successfully');
          
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
          this.logDebug(`Bootstrap failed: ${status.error}`);
          
          // Show detailed log in debug mode
          if (this.debugMode) {
            this.debugLog = getDetailedLog();
          }
        }
      } catch (error) {
        console.error('Bootstrap initialization error:', error);
        this.loading = false;
        this.error = error.message;
        this.status_message = __('Failed to initialize');
        this.details = __('Try refreshing the page or clearing browser data');
        this.retryCount++; // Increment retry count
        this.logDebug(`Initialization error: ${error.message}`);
        
        // Clear timeout
        if (this.progressTimeout) {
          clearTimeout(this.progressTimeout);
          this.progressTimeout = null;
        }
        
        // Try to provide more helpful error message based on error type
        if (error.message.includes('IndexedDB') || error.message.includes('object store')) {
          this.details = __('Browser database error. Try clearing your browser data and restarting your browser.');
        } else if (error.message.includes('network') || error.message.includes('connection')) {
          this.details = __('Network error. Check your internet connection and try again.');
        } else if (error.message.includes('timeout')) {
          this.details = __('Operation timed out. Your browser may be restricting background operations.');
        }
        
        // Show detailed log in debug mode
        if (this.debugMode) {
          this.debugLog = getDetailedLog();
        }
      }
    },
    
    handleProgressStuck() {
      // Called when progress hasn't changed for too long
      if (this.progress < 20) {
        this.logDebug(`Progress stuck at ${this.progress}% for over 30 seconds`);
        
        if (!this.stuckAtProgress) {
          this.stuckAtProgress = this.progress;
          this.stuckDuration = 30;
          
          // Give it another chance with a longer timeout
          this.progressTimeout = setTimeout(() => {
            this.handleProgressStuck();
          }, 30000); // Another 30 seconds
          
          this.details = __('Operation taking longer than expected, please wait...');
        } else if (this.stuckDuration >= 60) {
          // Stuck for too long, trigger error
          this.logDebug('Progress stuck for over 60 seconds, cancelling operation');
          const error = new Error('Operation timed out - progress stuck at ' + this.progress + '%');
          
          // Force error state
          this.loading = false;
          this.error = error.message;
          this.status_message = __('Operation timed out');
          this.details = __('The database operation is taking too long. Please try again or restart your browser.');
          this.retryCount++;
          
          // Clear interval
          if (this.statusInterval) {
            clearInterval(this.statusInterval);
            this.statusInterval = null;
          }
          
          // Clear timeout
          if (this.progressTimeout) {
            clearTimeout(this.progressTimeout);
            this.progressTimeout = null;
          }
          
          // Show detailed log in debug mode
          if (this.debugMode) {
            this.debugLog = getDetailedLog();
          }
        } else {
          // Still stuck but giving more time
          this.stuckDuration += 30;
          this.progressTimeout = setTimeout(() => {
            this.handleProgressStuck();
          }, 30000); // Another 30 seconds
          
          this.details = __('Operation taking longer than expected, please continue waiting...');
        }
      } else {
        // Progress is moving, reset stuck status
        this.stuckAtProgress = null;
        this.stuckDuration = 0;
        
        // Set new timeout for next progress checkpoint
        this.progressTimeout = setTimeout(() => {
          this.handleProgressStuck();
        }, 30000);
      }
    },
    
    logDebug(message) {
      console.log(`[OFFLINE LOADER] ${message}`);
      this.debugLog.push({
        time: new Date(),
        message: message
      });
      
      // Keep log from growing too large
      if (this.debugLog.length > 100) {
        this.debugLog = this.debugLog.slice(-50);
      }
    },
    
    async clearAllDatabases() {
      const dbNames = ['posawesome-offline-db'];
      this.logDebug('Clearing all databases');
      
      for (const dbName of dbNames) {
        try {
          await this.deleteDatabase(dbName);
          this.logDebug(`Database ${dbName} deleted`);
        } catch (error) {
          this.logDebug(`Failed to delete database ${dbName}: ${error.message}`);
        }
      }
    },
    
    async deleteDatabase(dbName) {
      return new Promise((resolve, reject) => {
        this.logDebug(`Attempting to delete database ${dbName}`);
        const request = indexedDB.deleteDatabase(dbName);
        
        request.onsuccess = () => {
          this.logDebug(`Database ${dbName} successfully deleted`);
          resolve();
        };
        
        request.onerror = (event) => {
          const error = new Error(`Error deleting database ${dbName}: ${event.target.error}`);
          this.logDebug(error.message);
          reject(error);
        };
        
        request.onblocked = () => {
          this.logDebug(`Database ${dbName} deletion blocked`);
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
      
      let lastProgress = this.progress;
      let stuckCount = 0;
      
      // Set up interval to check progress
      this.statusInterval = setInterval(() => {
        const status = getBootstrapStatus();
        this.progress = status.progress || 0;
        this.status_message = status.message || __('Preparing data...');
        
        // Check if progress is stuck
        if (this.progress === lastProgress) {
          stuckCount++;
          
          if (stuckCount >= 20) { // Stuck for 10 seconds (20 * 500ms)
            this.logDebug(`Progress stuck at ${this.progress}% for ${stuckCount * 0.5} seconds`);
            
            // Update UI to show it's still working
            if (stuckCount % 10 === 0) { // Every 5 seconds
              this.details = __('Still working... Please be patient.');
            }
          }
        } else {
          // Progress changed, reset stuck counter
          stuckCount = 0;
          lastProgress = this.progress;
          
          // Reset progress timeout when progress changes
          if (this.progressTimeout) {
            clearTimeout(this.progressTimeout);
            this.progressTimeout = setTimeout(() => {
              this.handleProgressStuck();
            }, 30000);
          }
        }
        
        // Emit progress event
        this.$emit('bootstrap-progress', this.progress);
        
        // Check if complete
        if (isBootstrapComplete()) {
          clearInterval(this.statusInterval);
          this.statusInterval = null;
          this.loading = false;
          this.complete = true;
          
          // Clear timeout
          if (this.progressTimeout) {
            clearTimeout(this.progressTimeout);
            this.progressTimeout = null;
          }
        }
        
        // Check for error
        if (status.error) {
          clearInterval(this.statusInterval);
          this.statusInterval = null;
          this.loading = false;
          this.error = status.error;
          this.status_message = __('Bootstrap failed');
          
          // Clear timeout
          if (this.progressTimeout) {
            clearTimeout(this.progressTimeout);
            this.progressTimeout = null;
          }
        }
      }, 500);
    },
    
    retryBootstrap() {
      // Clear any existing timeouts
      if (this.progressTimeout) {
        clearTimeout(this.progressTimeout);
        this.progressTimeout = null;
      }
      
      // Ask user to confirm clear database on retry
      if (this.retryCount >= 2) {
        if (confirm(__('Multiple attempts have failed. Would you like to completely reset the offline database? This will clear all cached data.'))) {
          this.logDebug('User confirmed database reset, starting fresh bootstrap');
          
          // Turn on debug mode after multiple failures
          this.debugMode = true;
          
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
    },
    
    toggleDebugMode() {
      this.debugMode = !this.debugMode;
      if (this.debugMode) {
        this.debugLog = getDetailedLog();
      }
    }
  },
  mounted() {
    // Start bootstrap when component is mounted
    this.initializeBootstrap();
    
    // Add keyboard shortcut for debug mode
    window.addEventListener('keydown', (event) => {
      // Ctrl+Shift+D to toggle debug mode
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        this.toggleDebugMode();
      }
    });
  },
  beforeUnmount() {
    // Clear interval when component is destroyed
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }
    
    // Clear timeout
    if (this.progressTimeout) {
      clearTimeout(this.progressTimeout);
      this.progressTimeout = null;
    }
    
    // Remove keyboard listener
    window.removeEventListener('keydown', this.toggleDebugMode);
  }
};
</script>

<style scoped>
.error-message {
  background-color: rgba(var(--v-theme-error), 0.05);
  border-left: 4px solid rgb(var(--v-theme-error));
  border-radius: 4px;
}

.debug-panel {
  margin-top: 20px;
  text-align: left;
  max-height: 300px;
  overflow-y: auto;
  background-color: #f5f5f5;
  padding: 10px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
}
</style> 