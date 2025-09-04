// Performance optimization constants
// These values were determined through testing to provide optimal performance vs quality balance
const PROXY_THRESHOLD = 1200;  // Images larger than this (px) get proxy handles
const PROXY_MAX_DIMENSION = 800; // Proxy images are resized to this max dimension

export class ImageLoader {
    constructor() {
        this.loadedImages = [];
        this.imageHandles = [];
    }

    async loadFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (event) => {
                try {
                    const arrayBuffer = event.target.result;
                    const uint8Array = new Uint8Array(arrayBuffer);
                    
                    const url = URL.createObjectURL(file);
                    
                    const imageData = {
                        name: file.name,
                        size: file.size,
                        data: uint8Array,
                        url: url,
                        file: file
                    };
                    
                    this.loadedImages.push(imageData);
                    resolve(imageData);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
    }

    async loadImageHandle(imageData, wasmModule) {
        try {
            const handle = wasmModule.load_image(imageData.data);
            
            // Check if image needs proxy for performance
            const needsProxy = wasmModule.needs_proxy_image(handle, PROXY_THRESHOLD);
            let proxyHandle = null;
            
            if (needsProxy) {
                console.log(`Creating proxy for large image: ${handle.width}x${handle.height} (threshold: ${PROXY_THRESHOLD}px)`);
                proxyHandle = wasmModule.create_proxy_image(handle, PROXY_MAX_DIMENSION);
                console.log(`Proxy created: ${proxyHandle.width}x${proxyHandle.height} (max dimension: ${PROXY_MAX_DIMENSION}px)`);
            } else {
                console.log(`Image is small enough, no proxy needed: ${handle.width}x${handle.height}`);
            }
            
            this.imageHandles.push({
                handle: handle,           // Original full-resolution handle
                proxyHandle: proxyHandle, // Lower-resolution proxy (null if not needed)
                needsProxy: needsProxy,   // Boolean flag
                metadata: imageData,
                dimensions: {             // Store original dimensions
                    width: handle.width,
                    height: handle.height
                },
                zoom: 100,  // Default zoom level
                offsetX: 0, // Default X offset
                offsetY: 0  // Default Y offset
            });
            return handle;
        } catch (error) {
            throw new Error(`Failed to load image into WASM: ${error}`);
        }
    }

    getLoadedImages() {
        return this.loadedImages;
    }

    getImageHandles() {
        return this.imageHandles;
    }

    clear() {
        this.loadedImages.forEach(img => {
            if (img.url) {
                URL.revokeObjectURL(img.url);
            }
        });
        
        // Free WASM handles
        this.imageHandles.forEach(item => {
            if (item.handle && typeof item.handle.free === 'function') {
                item.handle.free();
            }
            if (item.proxyHandle && typeof item.proxyHandle.free === 'function') {
                item.proxyHandle.free();
            }
        });
        
        this.loadedImages = [];
        this.imageHandles = [];
    }

    removeImage(index) {
        if (index >= 0 && index < this.loadedImages.length) {
            const img = this.loadedImages[index];
            if (img.url) {
                URL.revokeObjectURL(img.url);
            }
            
            // Free WASM handles for removed image
            const handleItem = this.imageHandles[index];
            if (handleItem) {
                if (handleItem.handle && typeof handleItem.handle.free === 'function') {
                    handleItem.handle.free();
                }
                if (handleItem.proxyHandle && typeof handleItem.proxyHandle.free === 'function') {
                    handleItem.proxyHandle.free();
                }
            }
            
            this.loadedImages.splice(index, 1);
            this.imageHandles.splice(index, 1);
        }
    }

    reorderImages(fromIndex, toIndex) {
        if (fromIndex >= 0 && fromIndex < this.loadedImages.length &&
            toIndex >= 0 && toIndex < this.loadedImages.length &&
            fromIndex !== toIndex) {
            
            // Move image data
            const [imageData] = this.loadedImages.splice(fromIndex, 1);
            this.loadedImages.splice(toIndex, 0, imageData);
            
            // Move handle data
            const [handleData] = this.imageHandles.splice(fromIndex, 1);
            this.imageHandles.splice(toIndex, 0, handleData);
            
            return true;
        }
        return false;
    }

    setImageZoom(index, zoomLevel) {
        if (index >= 0 && index < this.imageHandles.length) {
            this.imageHandles[index].zoom = zoomLevel;
            return true;
        }
        return false;
    }

    getImageZoom(index) {
        if (index >= 0 && index < this.imageHandles.length) {
            return this.imageHandles[index].zoom;
        }
        return 100; // Default zoom
    }

    setImageOffset(index, offsetX, offsetY) {
        if (index >= 0 && index < this.imageHandles.length) {
            this.imageHandles[index].offsetX = offsetX;
            this.imageHandles[index].offsetY = offsetY;
            return true;
        }
        return false;
    }

    getImageOffset(index) {
        if (index >= 0 && index < this.imageHandles.length) {
            return {
                x: this.imageHandles[index].offsetX,
                y: this.imageHandles[index].offsetY
            };
        }
        return { x: 0, y: 0 }; // Default offset
    }

    /**
     * Get the appropriate handle for an image (proxy for preview, original for export)
     * @param {number} index - Image index
     * @param {boolean} useProxy - Whether to use proxy handle if available (default: true)
     * @returns {Object} The WASM ImageHandle
     */
    getImageHandle(index, useProxy = true) {
        if (index >= 0 && index < this.imageHandles.length) {
            const item = this.imageHandles[index];
            // Use proxy if requested and available, otherwise use original
            if (useProxy && item.proxyHandle) {
                return item.proxyHandle;
            }
            return item.handle;
        }
        return null;
    }

    /**
     * Get image dimensions (always from original handle)
     * @param {number} index - Image index
     * @returns {Object} {width, height}
     */
    getImageDimensions(index) {
        if (index >= 0 && index < this.imageHandles.length) {
            return this.imageHandles[index].dimensions;
        }
        return { width: 0, height: 0 };
    }

    /**
     * Check if image has proxy handle
     * @param {number} index - Image index
     * @returns {boolean}
     */
    hasProxy(index) {
        if (index >= 0 && index < this.imageHandles.length) {
            return this.imageHandles[index].needsProxy && this.imageHandles[index].proxyHandle !== null;
        }
        return false;
    }
}