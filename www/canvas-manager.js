export class CanvasManager {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.currentImage = null;
        this.selectedImageIndex = -1;
        this.imagePositions = [];
        this.marchingAntsOffset = 0;
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.lastDragX = 0;
        this.lastDragY = 0;
        this.gridState = 0; // 0=off, 1=thirds, 2=fifths
        this.initializeCanvas();
        this.setupClickHandling();
        this.setupDragHandling();
        this.startMarchingAntsAnimation();
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

    setupClickHandling() {
        this.canvas.addEventListener('click', (event) => {
            if (this.isDragging) return; // Ignore clicks during drag
            
            const rect = this.canvas.getBoundingClientRect();
            const x = (event.clientX - rect.left) * (this.canvas.width / rect.width);
            const y = (event.clientY - rect.top) * (this.canvas.height / rect.height);
            
            this.handleCanvasClick(x, y);
        });
    }

    setupDragHandling() {
        this.canvas.addEventListener('mousedown', (event) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = (event.clientX - rect.left) * (this.canvas.width / rect.width);
            const y = (event.clientY - rect.top) * (this.canvas.height / rect.height);
            
            // Check if we're clicking on a selected image
            if (this.selectedImageIndex >= 0 && this.imagePositions[this.selectedImageIndex]) {
                const pos = this.imagePositions[this.selectedImageIndex];
                if (x >= pos.x && x <= pos.x + pos.width && 
                    y >= pos.y && y <= pos.y + pos.height) {
                    
                    this.isDragging = true;
                    this.dragStartX = x;
                    this.dragStartY = y;
                    this.lastDragX = x;
                    this.lastDragY = y;
                    this.canvas.style.cursor = 'grabbing';
                    event.preventDefault();
                }
            }
        });

        this.canvas.addEventListener('mousemove', (event) => {
            if (!this.isDragging) {
                // Change cursor when hovering over selected image
                if (this.selectedImageIndex >= 0 && this.imagePositions[this.selectedImageIndex]) {
                    const rect = this.canvas.getBoundingClientRect();
                    const x = (event.clientX - rect.left) * (this.canvas.width / rect.width);
                    const y = (event.clientY - rect.top) * (this.canvas.height / rect.height);
                    
                    const pos = this.imagePositions[this.selectedImageIndex];
                    if (x >= pos.x && x <= pos.x + pos.width && 
                        y >= pos.y && y <= pos.y + pos.height) {
                        this.canvas.style.cursor = 'grab';
                    } else {
                        this.canvas.style.cursor = 'default';
                    }
                }
                return;
            }

            const rect = this.canvas.getBoundingClientRect();
            const x = (event.clientX - rect.left) * (this.canvas.width / rect.width);
            const y = (event.clientY - rect.top) * (this.canvas.height / rect.height);
            
            const deltaX = x - this.lastDragX;
            const deltaY = y - this.lastDragY;
            
            this.lastDragX = x;
            this.lastDragY = y;
            
            // Notify drag handler with delta
            if (this.onImageDrag) {
                this.onImageDrag(this.selectedImageIndex, deltaX, deltaY);
            }
            
            event.preventDefault();
        });

        this.canvas.addEventListener('mouseup', (event) => {
            if (this.isDragging) {
                this.canvas.style.cursor = 'default';
                
                // Calculate total drag distance
                const rect = this.canvas.getBoundingClientRect();
                const x = (event.clientX - rect.left) * (this.canvas.width / rect.width);
                const y = (event.clientY - rect.top) * (this.canvas.height / rect.height);
                
                const totalDeltaX = x - this.dragStartX;
                const totalDeltaY = y - this.dragStartY;
                
                // Notify drag end handler
                if (this.onImageDragEnd) {
                    this.onImageDragEnd(this.selectedImageIndex, totalDeltaX, totalDeltaY);
                }
                
                // Reset isDragging after a short delay to prevent click events from firing
                setTimeout(() => {
                    this.isDragging = false;
                }, 10);
                
                event.preventDefault();
            }
        });

        // Handle mouse leave to cancel drag
        this.canvas.addEventListener('mouseleave', (event) => {
            if (this.isDragging) {
                this.canvas.style.cursor = 'default';
                setTimeout(() => {
                    this.isDragging = false;
                }, 10);
            }
        });
    }

    handleCanvasClick(x, y) {
        // Check if click is on any image in the grid
        for (let i = 0; i < this.imagePositions.length; i++) {
            const pos = this.imagePositions[i];
            if (x >= pos.x && x <= pos.x + pos.width && 
                y >= pos.y && y <= pos.y + pos.height) {
                
                // Toggle selection
                if (this.selectedImageIndex === i) {
                    this.selectedImageIndex = -1; // Deselect
                } else {
                    this.selectedImageIndex = i; // Select
                }
                
                // Notify UI controller of selection change
                if (this.onImageSelected) {
                    this.onImageSelected(this.selectedImageIndex);
                }
                
                this.redrawWithSelection();
                return;
            }
        }
        
        // Clicked outside any image, deselect
        this.selectedImageIndex = -1;
        if (this.onImageSelected) {
            this.onImageSelected(-1);
        }
        this.redrawWithSelection();
    }

    startMarchingAntsAnimation() {
        const animate = () => {
            this.marchingAntsOffset += 0.5;
            if (this.marchingAntsOffset >= 16) {
                this.marchingAntsOffset = 0;
            }
            
            if (this.selectedImageIndex >= 0) {
                this.redrawWithSelection();
            }
            
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }

    drawMarchingAnts(x, y, width, height) {
        const ctx = this.ctx;
        ctx.save();
        
        // Set up marching ants pattern
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.lineDashOffset = -this.marchingAntsOffset;
        
        // Draw black outline
        ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);
        
        // Draw white outline (inverted pattern)
        ctx.strokeStyle = '#ffffff';
        ctx.lineDashOffset = -this.marchingAntsOffset + 8;
        ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);
        
        ctx.restore();
    }

    redrawWithSelection() {
        if (!this.currentImage) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Redraw the current image using the stored image element
        if (this.currentImage.image) {
            // Use the already loaded image
            this.ctx.drawImage(
                this.currentImage.image,
                this.currentImage.x,
                this.currentImage.y,
                this.currentImage.width,
                this.currentImage.height
            );
        }
        
        // Draw grid overlay if enabled
        if (this.gridState > 0) {
            this.drawGrid();
        }
        
        // Draw selection outline if needed
        if (this.selectedImageIndex >= 0 && this.imagePositions[this.selectedImageIndex]) {
            const pos = this.imagePositions[this.selectedImageIndex];
            this.drawMarchingAnts(pos.x, pos.y, pos.width, pos.height);
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

    async displayImageFromBytes(imageBytes, filename = 'result', gridInfo = null) {
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
                
                // Calculate image positions for grid selection
                this.calculateImagePositions(gridInfo, x, y, scaledWidth, scaledHeight);
                
                this.currentImage = {
                    image: img,
                    imageBytes: imageBytes,
                    scale: scale,
                    x: x,
                    y: y,
                    width: scaledWidth,
                    height: scaledHeight,
                    blob: blob,
                    url: url,
                    gridInfo: gridInfo
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

    calculateImagePositions(gridInfo, canvasX, canvasY, canvasWidth, canvasHeight) {
        this.imagePositions = [];
        
        if (!gridInfo || !gridInfo.rows || !gridInfo.cols) {
            // Single image or no grid info
            this.imagePositions.push({
                x: canvasX,
                y: canvasY,
                width: canvasWidth,
                height: canvasHeight
            });
            return;
        }
        
        const { rows, cols, imageCount } = gridInfo;
        const cellWidth = canvasWidth / cols;
        const cellHeight = canvasHeight / rows;
        
        // Calculate positions for each image in the grid
        for (let i = 0; i < Math.min(imageCount, rows * cols); i++) {
            const row = Math.floor(i / cols);
            const col = i % cols;
            
            this.imagePositions.push({
                x: canvasX + col * cellWidth,
                y: canvasY + row * cellHeight,
                width: cellWidth,
                height: cellHeight
            });
        }
    }

    clear() {
        this.updateCanvasSize();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.currentImage && this.currentImage.url) {
            URL.revokeObjectURL(this.currentImage.url);
        }
        this.currentImage = null;
        this.selectedImageIndex = -1;
        this.imagePositions = [];
        this.isDragging = false;
        this.canvas.style.cursor = 'default';
        
        // Notify UI controller of selection reset
        if (this.onImageSelected) {
            this.onImageSelected(-1);
        }
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

    drawGrid() {
        if (!this.currentImage || !this.imagePositions.length) return;

        const divisions = this.gridState === 1 ? 3 : 5; // thirds or fifths
        
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([]);

        // Draw grid lines for each tile
        this.imagePositions.forEach(pos => {
            const cellWidth = pos.width / divisions;
            const cellHeight = pos.height / divisions;

            // Draw vertical lines
            for (let i = 1; i < divisions; i++) {
                const x = pos.x + i * cellWidth;
                this.ctx.beginPath();
                this.ctx.moveTo(x, pos.y);
                this.ctx.lineTo(x, pos.y + pos.height);
                this.ctx.stroke();
            }

            // Draw horizontal lines
            for (let i = 1; i < divisions; i++) {
                const y = pos.y + i * cellHeight;
                this.ctx.beginPath();
                this.ctx.moveTo(pos.x, y);
                this.ctx.lineTo(pos.x + pos.width, y);
                this.ctx.stroke();
            }
        });

        this.ctx.restore();
    }

    toggleGrid() {
        // Cycle through: 0 (off) -> 1 (thirds) -> 2 (fifths) -> 0 (off)
        this.gridState = (this.gridState + 1) % 3;
        
        // Redraw to show/hide grid
        this.redrawWithSelection();
        
        // Return the new state for UI updates
        return this.gridState;
    }

    getGridStateText() {
        switch (this.gridState) {
            case 0: return 'Grid: Off';
            case 1: return 'Grid: 3x3';
            case 2: return 'Grid: 5x5';
            default: return 'Grid: Off';
        }
    }
}