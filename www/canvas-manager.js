export class CanvasManager {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.currentImage = null;
    }

    async displayImage(imageData) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                this.canvas.width = Math.min(img.width, 800);
                this.canvas.height = Math.min(img.height, 600);
                
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
                this.canvas.width = Math.min(img.width, 800);
                this.canvas.height = Math.min(img.height, 600);
                
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