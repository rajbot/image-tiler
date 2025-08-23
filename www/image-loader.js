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
            this.imageHandles.push({
                handle: handle,
                metadata: imageData
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
        this.loadedImages = [];
        this.imageHandles = [];
    }

    removeImage(index) {
        if (index >= 0 && index < this.loadedImages.length) {
            const img = this.loadedImages[index];
            if (img.url) {
                URL.revokeObjectURL(img.url);
            }
            this.loadedImages.splice(index, 1);
            this.imageHandles.splice(index, 1);
        }
    }
}