<template>
    <v-dialog v-model="scannerDialog" max-width="600px" persistent="false">
        <v-card>
            <v-card-title class="text-h5 text-primary d-flex align-center">
                <v-icon class="mr-2" size="large">mdi-camera</v-icon>
                {{ __('Scan QR Code/Barcode') }}
                <v-chip class="ml-2" size="small" color="primary">
                    Auto Detect
                </v-chip>
                <v-spacer></v-spacer>
                <v-btn 
                    icon="mdi-close" 
                    @click.stop="stopScanning" 
                    color="error" 
                    variant="text"
                    size="large"
                    :title="__('Close Scanner')"
                ></v-btn>
            </v-card-title>

            <v-card-text class="pa-0">
                <div v-if="!cameraPermissionDenied">
                    <!-- Scanner container -->
                    <div class="scanner-container">
                        <!-- Unified video element for both QR and barcode scanning -->
                        <video 
                            ref="videoElement" 
                            style="width: 100%; height: 350px; object-fit: cover;"
                            autoplay
                            muted
                            playsinline
                        ></video>

                        <!-- Hidden canvas for barcode processing -->
                        <canvas 
                            ref="barcodeCanvas"
                            style="display: none;"
                        ></canvas>

                        <!-- Scanning overlay -->
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

                    <!-- Status messages -->
                    <div class="status-messages pa-3">
                        <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-2">
                            <v-icon>mdi-alert-circle</v-icon>
                            {{ errorMessage }}
                        </v-alert>

                        <v-alert v-if="scanResult" type="success" variant="tonal" class="mb-2">
                            <v-icon>mdi-check-circle</v-icon>
                            {{ __('Successfully scanned:') }} <strong>{{ scanResult }}</strong>
                            <br><small>Format: {{ scanFormat }}</small>
                        </v-alert>

                        <v-alert v-if="!scanResult && !errorMessage && isScanning" type="info" variant="tonal">
                            <v-icon>mdi-information</v-icon>
                            {{ __('Position the QR code or barcode within the scanning area') }}
                            <br><small>{{ __('Auto-detecting format...') }}</small>
                        </v-alert>
                    </div>
                </div>

                <!-- Camera permission denied message -->
                <div v-else class="pa-4 text-center">
                    <v-icon size="64" color="error">mdi-camera-off</v-icon>
                    <h3 class="mt-2">{{ __('Camera Access Required') }}</h3>
                    <p class="mt-2">{{ __('Please allow camera access to scan codes') }}</p>
                    <v-btn @click="requestCameraPermission" color="primary" class="mt-2">
                        {{ __('Grant Permission') }}
                    </v-btn>
                </div>
            </v-card-text>

            <!-- Action buttons -->
            <v-card-actions class="justify-space-between pa-3">
                <div class="d-flex gap-2">
                    <!-- Flashlight toggle -->
                    <v-btn 
                        v-if="flashlightSupported"
                        @click="toggleFlashlight"
                        :color="flashlightOn ? 'warning' : 'default'"
                        variant="outlined"
                        size="small"
                    >
                        <v-icon>{{ flashlightOn ? 'mdi-flashlight' : 'mdi-flashlight-off' }}</v-icon>
                        {{ flashlightOn ? __('Flash On') : __('Flash Off') }}
                    </v-btn>

                    <!-- Camera switch -->
                    <v-btn 
                        v-if="multipleCameras"
                        @click="switchCamera"
                        color="default"
                        variant="outlined"
                        size="small"
                    >
                        <v-icon>mdi-camera-switch</v-icon>
                        {{ __('Switch Camera') }}
                    </v-btn>
                </div>

                <!-- Cancel button -->
                <v-btn 
                    @click.stop="stopScanning" 
                    color="error" 
                    variant="outlined"
                >
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
    background: #000;
}

.barcode-scanner {
    position: relative;
}

.scanning-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 10;
}

.scan-line {
    position: absolute;
    top: 50%;
    left: 10%;
    right: 10%;
    height: 2px;
    background: linear-gradient(90deg, transparent, #4CAF50, transparent);
    animation: scan 2s linear infinite;
}

@keyframes scan {
    0% { transform: translateY(-100px); }
    100% { transform: translateY(100px); }
}

.scan-corners {
    position: absolute;
    top: 20%;
    left: 20%;
    right: 20%;
    bottom: 20%;
}

.corner {
    position: absolute;
    width: 20px;
    height: 20px;
    border: 3px solid #4CAF50;
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
import QrScanner from 'qr-scanner';
import Quagga from 'quagga';

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
            qrScanner: null,
            scanResult: '',
            scanFormat: '',
            errorMessage: '',
            cameraPermissionDenied: false,
            flashlightSupported: false,
            flashlightOn: false,
            multipleCameras: false,
            currentCameraId: null,
            availableCameras: [],
            isScanning: false,
            barcodeDetectionInterval: null,
            isDecodingBarcode: false,
            videoStream: null
        };
    },

    methods: {
        async startScanning() {
            this.scannerDialog = true;
            this.errorMessage = '';
            this.scanResult = '';
            this.scanFormat = '';
            this.cameraPermissionDenied = false;
            this.isScanning = false;

            // Wait for dialog to render
            await this.$nextTick();

            try {
                // Check camera permissions first
                const hasCamera = await QrScanner.hasCamera();
                if (!hasCamera) {
                    throw new Error('No camera found');
                }

                // Get available cameras
                this.availableCameras = await QrScanner.listCameras(true);
                this.multipleCameras = this.availableCameras.length > 1;

                // Start unified scanner with auto-detection
                await this.initializeAutoDetectionScanner();
                
            } catch (error) {
                this.handleScannerError(error);
            }
        },

        async initializeAutoDetectionScanner() {
            try {
                await this.$nextTick();
                
                const videoElement = this.$refs.videoElement;
                if (!videoElement) {
                    throw new Error('Video element not found');
                }

                // Initialize QR Scanner
                this.qrScanner = new QrScanner(
                    videoElement,
                    result => this.onScanSuccess(result.data, 'QR Code'),
                    {
                        returnDetailedScanResult: true,
                        highlightScanRegion: true,
                        highlightCodeOutline: true,
                        preferredCamera: this.currentCameraId || 'environment'
                    }
                );

                await this.qrScanner.start();
                this.isScanning = true;
                
                // Check for flashlight support
                this.flashlightSupported = await this.qrScanner.hasFlash();
                
                // Start barcode detection in parallel
                this.startBarcodeDetection();
                
                console.log('Auto-detection scanner initialized successfully');
                
            } catch (error) {
                console.error('Auto-detection scanner initialization error:', error);
                this.handleScannerError(error);
            }
        },

        startBarcodeDetection() {
            const videoElement = this.$refs.videoElement;
            const canvas = this.$refs.barcodeCanvas;
            
            if (!videoElement || !canvas) {
                console.warn('Video element or canvas not found for barcode detection');
                return;
            }

            const context = canvas.getContext('2d');
            
            // Set up periodic barcode scanning
            this.barcodeDetectionInterval = setInterval(() => {
                if (!this.isScanning || this.scanResult || this.isDecodingBarcode) {
                    return;
                }

                try {
                    // Set canvas size to match video
                    canvas.width = videoElement.videoWidth;
                    canvas.height = videoElement.videoHeight;
                    
                    if (canvas.width === 0 || canvas.height === 0) {
                        return; // Video not ready yet
                    }

                    // Draw current video frame to canvas
                    context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                    
                    // Get image data for barcode detection
                    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                    
                    // Use Quagga for barcode detection
                    this.detectBarcodeInImageData(imageData);
                    
                } catch (error) {
                    console.warn('Barcode detection frame error:', error);
                }
            }, 150); // Check every 150ms
        },

        detectBarcodeInImageData(imageData) {
            // Create a temporary canvas for Quagga
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = imageData.width;
            tempCanvas.height = imageData.height;
            const tempContext = tempCanvas.getContext('2d');
            tempContext.putImageData(imageData, 0, 0);

            this.isDecodingBarcode = true; // Set flag before decoding

            // Configure Quagga for single image processing
            const config = {
                inputStream: {
                    name: "Live",
                    type: "ImageStream",
                    src: tempCanvas.toDataURL(),
                    sequence: false,
                    size: 800
                },
                locator: {
                    patchSize: "medium",
                    halfSample: true
                },
                numOfWorkers: 1,
                decoder: {
                    readers: [
                        "code_128_reader",
                        "ean_reader",
                        "ean_8_reader",
                        "code_39_reader",
                        "code_39_vin_reader",
                        "codabar_reader",
                        "upc_reader",
                        "upc_e_reader",
                        "i2of5_reader"
                    ]
                },
                locate: true
            };

            // Process single frame
            Quagga.decodeSingle(config, (result) => {
                this.isDecodingBarcode = false; // Reset flag after decoding
                if (result && result.codeResult) {
                    const code = result.codeResult.code;
                    const format = result.codeResult.format;
                    this.onScanSuccess(code, format.toUpperCase());
                }
            });
        },

        onScanSuccess(decodedText, format = 'Unknown') {
            console.log('Scan successful:', decodedText, 'Format:', format);
            this.scanResult = decodedText;
            this.scanFormat = format;
            this.errorMessage = '';
            
            // Stop all scanning
            this.stopCurrentScanner();
            this.isScanning = false;
            
            // Emit the scanned result to parent component
            this.$emit('barcode-scanned', decodedText);
            
            // Show success feedback
            if (typeof frappe !== 'undefined' && frappe.show_alert) {
                frappe.show_alert({
                    message: this.__('Code scanned successfully') + ` (${format})`,
                    indicator: 'green'
                }, 3);
            }
            
            // Auto-close after 3 seconds
            setTimeout(() => {
                this.stopScanning();
            }, 3000);
        },

        stopCurrentScanner() {
            // Stop QR scanner
            if (this.qrScanner) {
                this.qrScanner.stop();
                this.qrScanner.destroy();
                this.qrScanner = null;
            }
            
            // Stop barcode detection interval
            if (this.barcodeDetectionInterval) {
                clearInterval(this.barcodeDetectionInterval);
                this.barcodeDetectionInterval = null;
            }
        },

        // ... existing code ...
        
        async toggleFlashlight() {
            if (this.qrScanner && this.flashlightSupported) {
                try {
                    if (this.flashlightOn) {
                        await this.qrScanner.turnFlashOff();
                        this.flashlightOn = false;
                    } else {
                        await this.qrScanner.turnFlashOn();
                        this.flashlightOn = true;
                    }
                } catch (error) {
                    console.warn('Flashlight toggle failed:', error);
                }
            }
        },

        async switchCamera() {
            if (this.multipleCameras) {
                try {
                    const currentIndex = this.availableCameras.findIndex(
                        camera => camera.id === this.currentCameraId
                    );
                    const nextIndex = (currentIndex + 1) % this.availableCameras.length;
                    const nextCamera = this.availableCameras[nextIndex];
                    
                    this.currentCameraId = nextCamera.id;
                    
                    // Restart scanner with new camera
                    this.stopCurrentScanner();
                    await this.initializeAutoDetectionScanner();
                    
                    if (typeof frappe !== 'undefined' && frappe.show_alert) {
                        frappe.show_alert({
                            message: this.__('Switched to: ') + nextCamera.label,
                            indicator: 'blue'
                        }, 2);
                    }
                } catch (error) {
                    console.warn('Camera switch failed:', error);
                }
            }
        },

        stopScanning() {
            console.log('Stopping scanner');
            
            try {
                // Stop all scanners
                this.stopCurrentScanner();
                
                // Reset component state
                this.scannerDialog = false;
                this.scanResult = '';
                this.scanFormat = '';
                this.errorMessage = '';
                this.flashlightOn = false;
                this.cameraPermissionDenied = false;
                this.isScanning = false;
                
                // Emit close event to parent component
                this.$emit('scanner-closed');
                
                // Show feedback to user
                if (typeof frappe !== 'undefined' && frappe.show_alert) {
                    frappe.show_alert({
                        message: this.__('Scanner closed'),
                        indicator: 'blue'
                    }, 2);
                }
                
            } catch (error) {
                console.error('Error stopping scanner:', error);
                // Force close the dialog even if there's an error
                this.scannerDialog = false;
            }
        },

        handleEscKey(event) {
            if (event.key === 'Escape' && this.scannerDialog) {
                event.preventDefault();
                this.stopScanning();
            }
        }
    },

    mounted() {
        // Add ESC key listener
        if (typeof document !== 'undefined') {
            document.addEventListener('keydown', this.handleEscKey);
        }
    },

    beforeUnmount() {
        // Remove ESC key listener
        if (typeof document !== 'undefined') {
            document.removeEventListener('keydown', this.handleEscKey);
        }
        this.stopScanning();
    }
};
</script>