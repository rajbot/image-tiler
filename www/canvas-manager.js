export class CanvasManager {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.currentImage = null;
        this.initializeCanvas();
    }

    initializeCanvas() {
        // Set initial canvas size based on container
        this.updateCanvasSize();
        
        // Add resize listener to update canvas when window resizes
        window.addEventListener('resize', () => {
            this.updateCanvasSize();
            // Redraw current image if available
            if (this.currentImage) {
                this.redrawCurrentImage();
            }
        });
    }

    updateCanvasSize() {
        const container = this.canvas.parentElement;
        const containerRect = container.getBoundingClientRect();
        
        // Use container width, but set a reasonable max height
        const maxWidth = Math.floor(containerRect.width - 20); // Leave some margin
        const maxHeight = Math.min(Math.floor(window.innerHeight * 0.6), 800); // 60% of viewport height, max 800px
        
        // Set canvas size
        this.canvas.width = Math.max(maxWidth, 400); // Minimum 400px width
        this.canvas.height = Math.max(maxHeight, 300); // Minimum 300px height
    }

    redrawCurrentImage() {
        if (this.currentImage) {
            const { imageData, scaledWidth, scaledHeight } = this.currentImage;
            this.displayImage(imageData);
        }
    }

    async displayImage(imageData) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                // Update canvas size to fit container
                this.updateCanvasSize();
                
                const scale = Math.min(
                    this.canvas.width / img.width,
                    this.canvas.height / img.height
                );
                
                const scaledWidth = img.width * scale;
                const scaledHeight = img.height * scale;
                
                const x = (this.canvas.width - scaledWidth) / 2;
                const y = (this.canvas.height - scaledHeight) / 2;
                
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
                
                this.currentImage = {
                    image: img,
                    scale: scale,
                    x: x,
                    y: y,
                    width: scaledWidth,
                    height: scaledHeight
                };
                
                resolve();
            };
            
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = imageData.url;
        });
    }

    async displayImageFromBytes(imageBytes, filename = 'result') {
        return new Promise((resolve, reject) => {
            const blob = new Blob([imageBytes], { type: 'image/png' });
            const url = URL.createObjectURL(blob);
            
            const img = new Image();
            
            img.onload = () => {
                // Update canvas size to fit container
                this.updateCanvasSize();
                
                const scale = Math.min(
                    this.canvas.width / img.width,
                    this.canvas.height / img.height
                );
                
                const scaledWidth = img.width * scale;
                const scaledHeight = img.height * scale;
                
                const x = (this.canvas.width - scaledWidth) / 2;
                const y = (this.canvas.height - scaledHeight) / 2;
                
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
                
                this.currentImage = {
                    image: img,
                    scale: scale,
                    x: x,
                    y: y,
                    width: scaledWidth,
                    height: scaledHeight,
                    blob: blob,
                    url: url
                };
                
                resolve();
            };
            
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Failed to load image from bytes'));
            };
            
            img.src = url;
        });
    }

    clear() {
        this.updateCanvasSize();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.currentImage && this.currentImage.url) {
            URL.revokeObjectURL(this.currentImage.url);
        }
        this.currentImage = null;
    }

    downloadImage(filename = 'tiled-image.png') {
        if (!this.currentImage) {
            throw new Error('No image to download');
        }

        const link = document.createElement('a');
        
        if (this.currentImage.blob) {
            link.href = this.currentImage.url;
        } else {
            link.href = this.canvas.toDataURL();
        }
        
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    getCurrentImageData() {
        return this.currentImage;
    }
}