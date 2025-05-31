<template>
    <v-dialog v-model="scannerDialog" max-width="600px">
        <v-card>
            <!-- Enhanced close button in the header -->
            <v-card-title class="text-h5 text-primary d-flex align-center">
                <v-icon class="mr-2" size="large">mdi-camera</v-icon>
                {{ __('Scan Barcode/QR Code') }}
                <v-chip class="ml-2" size="small" :color="scanType === 'Both' ? 'primary' : 'secondary'">
                    {{ scanType }}
                </v-chip>
                <v-spacer></v-spacer>
                <v-btn 
                    icon="mdi-close" 
                    @click.stop="stopScanning" 
                    color="error" 
                    variant="text"
                    size="large"
                    :title="__('Close Scanner')"
                    :disabled="false"
                ></v-btn>
            </v-card-title>

            <v-card-text class="pa-0">
                <div v-if="!cameraPermissionDenied">
                    <!-- Scanner container with better styling -->
                    <div class="scanner-container">
                        <div id="qr-reader" style="width: 100%; height: 350px;"></div>

                        <!-- Scanning overlay with animation -->
                        <div v-if="!scanResult" class="scanning-overlay">
                            <div class="scan-line"></div>
                            <div class="scan-corners">
                                <div class="corner top-left"></div>
                                <div class="corner top-right"></div>
                                <div class="corner bottom-left"></div>
                                <div class="corner bottom-right"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Status messages with better styling -->
                    <div class="status-messages pa-3">
                        <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-2">
                            <v-icon>mdi-alert-circle</v-icon>
                            {{ errorMessage }}
                        </v-alert>

                        <v-alert v-if="scanResult" type="success" variant="tonal" class="mb-2">
                            <v-icon>mdi-check-circle</v-icon>
                            {{ __('Successfully scanned:') }} <strong>{{ scanResult }}</strong>
                        </v-alert>

                        <v-alert v-if="!scanResult && !errorMessage" type="info" variant="tonal">
                            <v-icon>mdi-information</v-icon>
                            {{ __('Position the barcode/QR code within the scanning area') }}
                        </v-alert>
                    </div>
                </div>

                <!-- Camera permission denied state -->
                <div v-else class="pa-6 text-center">
                    <v-icon size="80" color="error">mdi-camera-off</v-icon>
                    <h3 class="mt-4 mb-2">{{ __('Camera Access Required') }}</h3>
                    <p class="text-body-2 mb-4">{{ __('Please enable camera access to scan barcodes and QR codes.') }}
                    </p>
                    <v-btn @click="requestCameraPermission" color="primary" size="large" variant="elevated">
                        <v-icon class="mr-2">mdi-camera</v-icon>
                        {{ __('Enable Camera') }}
                    </v-btn>
                </div>
            </v-card-text>

            <!-- Enhanced action buttons -->
            <v-card-actions class="pa-4">
                <v-btn @click="toggleFlashlight" v-if="flashlightSupported" :color="flashlightOn ? 'warning' : 'grey'"
                    variant="outlined">
                    <v-icon class="mr-2">{{ flashlightOn ? 'mdi-flashlight-off' : 'mdi-flashlight' }}</v-icon>
                    {{ flashlightOn ? __('Flash Off') : __('Flash On') }}
                </v-btn>

                <v-btn @click="switchCamera" v-if="multipleCameras" color="primary" variant="outlined">
                    <v-icon class="mr-2">mdi-camera-switch</v-icon>
                    {{ __('Switch Camera') }}
                </v-btn>

                <v-spacer></v-spacer>

                <v-btn @click="stopScanning" color="error" variant="elevated">
                    <v-icon class="mr-2">mdi-close</v-icon>
                    {{ __('Cancel') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<style scoped>
.scanner-container {
    position: relative;
    overflow: hidden;
}

#qr-reader {
    border: 2px solid #1976d2;
    border-radius: 12px;
    background: #f5f5f5;
}

.scanning-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
}

.scan-line {
    position: absolute;
    top: 50%;
    left: 20%;
    right: 20%;
    height: 2px;
    background: linear-gradient(90deg, transparent, #4caf50, transparent);
    animation: scan 2s linear infinite;
}

@keyframes scan {
    0% {
        transform: translateY(-100px);
    }

    100% {
        transform: translateY(100px);
    }
}

.scan-corners {
    position: absolute;
    top: 25%;
    left: 25%;
    right: 25%;
    bottom: 25%;
}

.corner {
    position: absolute;
    width: 20px;
    height: 20px;
    border: 3px solid #4caf50;
}

.corner.top-left {
    top: 0;
    left: 0;
    border-right: none;
    border-bottom: none;
}

.corner.top-right {
    top: 0;
    right: 0;
    border-left: none;
    border-bottom: none;
}

.corner.bottom-left {
    bottom: 0;
    left: 0;
    border-right: none;
    border-top: none;
}

.corner.bottom-right {
    bottom: 0;
    right: 0;
    border-left: none;
    border-top: none;
}

.status-messages {
    background: rgba(255, 255, 255, 0.95);
}
</style>

<script>
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';

export default {
    name: 'CameraScanner',
    props: {
        scanType: {
            type: String,
            default: 'Both' // 'QR Code', 'Barcode', 'Both'
        }
    },

    data() {
        return {
            scannerDialog: false,
            html5QrcodeScanner: null,
            scanResult: '',
            errorMessage: '',
            cameraPermissionDenied: false,
            flashlightSupported: false,
            flashlightOn: false,
            multipleCameras: false,
            currentCameraId: null,
            availableCameras: []
        };
    },

    // Add debug methods
    methods: {
        async startScanning() {
            this.scannerDialog = true;
            this.errorMessage = '';
            this.scanResult = '';
            this.cameraPermissionDenied = false;

            try {
                await this.initializeScanner();
            } catch (error) {
                this.handleScannerError(error);
            }
        },

        // Enhanced configuration with fallback support
        async initializeScanner() {
            // Check camera permissions first
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                stream.getTracks().forEach(track => track.stop()); // Stop the test stream
            } catch (error) {
                this.cameraPermissionDenied = true;
                return;
            }

            // Get available cameras
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                this.availableCameras = devices.filter(device => device.kind === 'videoinput');
                this.multipleCameras = this.availableCameras.length > 1;
                this.currentCameraId = this.availableCameras[0]?.deviceId;
            } catch (error) {
                console.warn('Could not enumerate devices:', error);
            }

            let supportedFormats = [];
            if (this.scanType === 'QR Code') {
                supportedFormats = [Html5QrcodeSupportedFormats.QR_CODE];
            } else if (this.scanType === 'Barcode') {
                supportedFormats = [
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.EAN_13
                ];
            } else {
                // Both - QR + one barcode format
                supportedFormats = [
                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.CODE_128
                ];
            }

            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0,
                supportedScanTypes: supportedFormats
            };

            this.html5QrcodeScanner = new Html5QrcodeScanner(
                'qr-reader',
                config,
                false
            );

            this.html5QrcodeScanner.render(
                this.onScanSuccess,
                this.onScanFailure
            );

            // Check for flashlight support
            this.checkFlashlightSupport();
        },

        onScanSuccess(decodedText, decodedResult) {
            console.log('Scan successful:', decodedText, decodedResult);
            this.scanResult = decodedText;
            this.errorMessage = '';

            // Add visual feedback
            this.showSuccessMessage(`Successfully scanned: ${decodedText}`);

            // Emit the scanned barcode to the parent component
            this.$emit('barcode-scanned', decodedText);

            // Auto-close after successful scan with longer delay for user feedback
            setTimeout(() => {
                this.stopScanning();
            }, 2000);
        },

        onScanFailure(error) {
            // Enhanced error logging for debugging
            if (!error.includes('No QR code found') && !error.includes('No barcode found')) {
                console.warn('Scan error details:', {
                    error: error,
                    timestamp: new Date().toISOString(),
                    scanType: this.scanType,
                    cameraId: this.currentCameraId
                });

                // Show user-friendly error message
                this.errorMessage = this.__('Scanning failed. Please try again or check lighting conditions.');
            }
        },

        showSuccessMessage(message) {
            // Add success notification
            frappe.show_alert({
                message: message,
                indicator: 'green'
            }, 3);
        },

        handleScannerError(error) {
            console.error('Scanner initialization error details:', {
                error: error,
                name: error.name,
                message: error.message,
                timestamp: new Date().toISOString()
            });

            if (error.name === 'NotAllowedError') {
                this.cameraPermissionDenied = true;
                this.errorMessage = this.__('Camera access denied. Please allow camera permissions in your browser settings.');
            } else if (error.name === 'NotFoundError') {
                this.errorMessage = this.__('No camera found on this device.');
            } else if (error.name === 'NotReadableError') {
                this.errorMessage = this.__('Camera is already in use by another application.');
            } else {
                this.errorMessage = this.__('Failed to initialize camera scanner. Please check your camera permissions and try again.');
            }
        },

        logScanAttempt(result, success = true) {
            if (this.debugMode) {
                const logEntry = {
                    timestamp: new Date().toISOString(),
                    result: result,
                    success: success,
                    scanType: this.scanType,
                    cameraId: this.currentCameraId
                };

                this.scanHistory.push(logEntry);
                console.log('Scan attempt:', logEntry);

                // Keep only last 50 entries
                if (this.scanHistory.length > 50) {
                    this.scanHistory = this.scanHistory.slice(-50);
                }
            }
        },

        exportScanHistory() {
            if (this.debugMode && this.scanHistory.length > 0) {
                const dataStr = JSON.stringify(this.scanHistory, null, 2);
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `scan-history-${new Date().toISOString().split('T')[0]}.json`;
                link.click();
            }
        }
    },

    mounted() {
        // Add ESC key listener
        document.addEventListener('keydown', this.handleEscKey);
    },
    
    beforeUnmount() {
        // Remove ESC key listener
        document.removeEventListener('keydown', this.handleEscKey);
        this.stopScanning();
    },
    
    handleEscKey(event) {
        if (event.key === 'Escape' && this.scannerDialog) {
            this.stopScanning();
        }
    },
    
    // Enhanced stopScanning method
    stopScanning() {
        console.log('Stopping camera scanner - button clicked');
        
        try {
            // Force close dialog first
            this.scannerDialog = false;
            
            // Clear the scanner instance
            if (this.html5QrcodeScanner) {
                this.html5QrcodeScanner.clear().catch(error => {
                    console.warn('Error clearing scanner:', error);
                });
                this.html5QrcodeScanner = null;
            }
            
            // Reset component state
            this.scanResult = '';
            this.errorMessage = '';
            this.flashlightOn = false;
            this.cameraPermissionDenied = false;
            
            // Emit close event to parent component
            this.$emit('scanner-closed');
            
            // Show feedback to user
            frappe.show_alert({
                message: this.__('Scanner closed'),
                indicator: 'blue'
            }, 2);
            
        } catch (error) {
            console.error('Error stopping scanner:', error);
            // Force close the dialog even if there's an error
            this.scannerDialog = false;
        }
    }
}
</script>

<style scoped>
#qr-reader {
    border: 2px solid #ddd;
    border-radius: 8px;
}
</style>