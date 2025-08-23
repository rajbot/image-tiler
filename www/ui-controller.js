export class UIController {
    constructor(imageLoader, canvasManager, wasmModule) {
        this.imageLoader = imageLoader;
        this.canvasManager = canvasManager;
        this.wasmModule = wasmModule;
        this.currentTiledImage = null;
        this.currentTiledHandle = null;
        this.selectedImageIndex = -1;
        this.draggedImageIndex = -1;
        
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        this.fileInput = document.getElementById('file-input');
        this.dropZone = document.getElementById('drop-zone');
        this.imageList = document.getElementById('image-list');
        this.tileButtons = {
            '2x1': document.getElementById('tile-2x1'),
            '2x2': document.getElementById('tile-2x2')
        };
        this.exportButton = document.getElementById('export-btn');
        this.exportFormat = document.getElementById('export-format');
        this.exportSize = document.getElementById('export-size');
        this.clearButton = document.getElementById('clear-btn');
        this.status = document.getElementById('status');
        this.dragHint = document.getElementById('drag-hint');
    }

    setupEventListeners() {
        // File input
        this.fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        // Drag and drop
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('drag-over');
        });

        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.classList.remove('drag-over');
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('drag-over');
            this.handleFiles(e.dataTransfer.files);
        });

        // Tiling buttons
        this.tileButtons['2x1'].addEventListener('click', () => {
            this.performTiling('2x1');
        });

        this.tileButtons['2x2'].addEventListener('click', () => {
            this.performTiling('2x2');
        });

        // Export button
        this.exportButton.addEventListener('click', () => {
            this.exportImage();
        });

        // Clear button
        this.clearButton.addEventListener('click', () => {
            this.clearAll();
        });
    }

    async handleFiles(files) {
        this.updateStatus('Loading images...');
        
        for (let file of files) {
            if (file.type.startsWith('image/')) {
                try {
                    const imageData = await this.imageLoader.loadFile(file);
                    await this.imageLoader.loadImageHandle(imageData, this.wasmModule);
                    this.addImageToList(imageData);
                } catch (error) {
                    console.error('Error loading image:', error);
                    this.updateStatus(`Error loading ${file.name}: ${error.message}`);
                }
            }
        }
        
        this.updateStatus(`Loaded ${this.imageLoader.getLoadedImages().length} images`);
        this.updateTileButtons();
        this.updateAutoPreview();
    }

    addImageToList(imageData, isSelected = false) {
        // Hide empty state when first image is added
        this.updateImageListEmptyState();
        
        const imageItem = document.createElement('div');
        imageItem.className = isSelected ? 'image-item selected' : 'image-item';
        
        const img = document.createElement('img');
        img.src = imageData.url;
        img.alt = imageData.name;
        img.style.maxWidth = '100px';
        img.style.maxHeight = '100px';
        img.style.objectFit = 'cover';
        
        const info = document.createElement('div');
        info.className = 'image-info';
        info.innerHTML = `
            <div class="image-name">${imageData.name}</div>
            <div class="image-size">${Math.round(imageData.size / 1024)} KB</div>
        `;
        
        const removeBtn = document.createElement('button');
        removeBtn.textContent = '×';
        removeBtn.className = 'remove-btn';
        removeBtn.onclick = () => {
            const index = Array.from(this.imageList.children).filter(child => 
                child.className.includes('image-item')).indexOf(imageItem);
            
            // Adjust selection if needed
            if (this.selectedImageIndex === index) {
                this.selectedImageIndex = -1;
            } else if (this.selectedImageIndex > index) {
                this.selectedImageIndex--;
            }
            
            this.imageLoader.removeImage(index);
            imageItem.remove();
            this.updateTileButtons();
            this.updateAutoPreview();
            this.updateImageListEmptyState();
        };
        
        imageItem.appendChild(img);
        imageItem.appendChild(info);
        imageItem.appendChild(removeBtn);
        
        // Add selection functionality
        imageItem.addEventListener('click', (e) => {
            if (e.target === removeBtn) return; // Don't select when clicking remove
            this.toggleImageSelection(imageItem);
        });
        
        // Add drag and drop functionality
        imageItem.draggable = true;
        imageItem.addEventListener('dragstart', (e) => {
            this.handleDragStart(e, imageItem);
        });
        
        imageItem.addEventListener('dragover', (e) => {
            this.handleDragOver(e);
        });
        
        imageItem.addEventListener('dragenter', (e) => {
            this.handleDragEnter(e, imageItem);
        });
        
        imageItem.addEventListener('dragleave', (e) => {
            this.handleDragLeave(e, imageItem);
        });
        
        imageItem.addEventListener('drop', (e) => {
            this.handleDrop(e, imageItem);
        });
        
        imageItem.addEventListener('dragend', (e) => {
            this.handleDragEnd(e);
        });
        
        this.imageList.appendChild(imageItem);
    }

    updateImageListEmptyState() {
        const emptyState = this.imageList.querySelector('.empty-state');
        const imageCount = this.imageLoader.getLoadedImages().length;
        const hasImages = imageCount > 0;
        
        if (emptyState) {
            emptyState.style.display = hasImages ? 'none' : 'block';
        }
        
        // Show/hide drag hint
        if (this.dragHint) {
            this.dragHint.style.display = imageCount >= 2 ? 'block' : 'none';
        }
    }

    updateTileButtons() {
        const imageCount = this.imageLoader.getLoadedImages().length;
        
        this.tileButtons['2x1'].disabled = imageCount < 2;
        this.tileButtons['2x2'].disabled = imageCount < 4;
    }

    async updateAutoPreview() {
        const handles = this.imageLoader.getImageHandles().map(item => item.handle);
        
        if (handles.length === 0) {
            this.canvasManager.clear();
            return;
        }

        try {
            let tiledHandle;
            
            if (handles.length === 1) {
                // Show first image with blank on right side (2x1)
                tiledHandle = this.wasmModule.tile_image_with_blank_2x1(handles[0]);
            } else if (handles.length === 2) {
                // Show 2x1 tile with first two images
                tiledHandle = this.wasmModule.tile_images_2x1(handles[0], handles[1]);
            } else if (handles.length === 3) {
                // Show 2x2 tile with 3 images + 1 blank (bottom right)
                tiledHandle = this.wasmModule.tile_images_2x2_with_blanks_3(handles[0], handles[1], handles[2]);
            } else if (handles.length >= 4) {
                // Show full 2x2 tile with first four images
                tiledHandle = this.wasmModule.tile_images_2x2(handles[0], handles[1], handles[2], handles[3]);
            }

            const exportFormat = this.exportFormat.value;
            const imageBytes = this.wasmModule.export_image(tiledHandle, exportFormat);
            
            await this.canvasManager.displayImageFromBytes(imageBytes);
            this.currentTiledImage = imageBytes;
            this.currentTiledHandle = tiledHandle;
            this.exportButton.disabled = false;
            
        } catch (error) {
            console.error('Error creating auto preview:', error);
            this.updateStatus(`Error creating preview: ${error.message}`);
        }
    }

    async performTiling(layout) {
        const handles = this.imageLoader.getImageHandles().map(item => item.handle);
        
        if (layout === '2x1' && handles.length < 2) {
            this.updateStatus('Need at least 2 images for 2x1 tiling');
            return;
        }
        
        if (layout === '2x2' && handles.length < 4) {
            this.updateStatus('Need at least 4 images for 2x2 tiling');
            return;
        }

        try {
            this.updateStatus('Tiling images...');
            
            let tiledHandle;
            if (layout === '2x1') {
                tiledHandle = this.wasmModule.tile_images_2x1(handles[0], handles[1]);
            } else if (layout === '2x2') {
                tiledHandle = this.wasmModule.tile_images_2x2(handles[0], handles[1], handles[2], handles[3]);
            }

            const exportFormat = this.exportFormat.value;
            const imageBytes = this.wasmModule.export_image(tiledHandle, exportFormat);
            
            await this.canvasManager.displayImageFromBytes(imageBytes);
            this.currentTiledImage = imageBytes;
            this.currentTiledHandle = tiledHandle;
            this.exportButton.disabled = false;
            
            this.updateStatus(`Successfully created ${layout} tile`);
        } catch (error) {
            console.error('Error tiling images:', error);
            this.updateStatus(`Error tiling images: ${error.message}`);
        }
    }

    async exportImage() {
        if (!this.currentTiledHandle) {
            this.updateStatus('No tiled image to export');
            return;
        }

        try {
            const format = this.exportFormat.value;
            const selectedSize = this.exportSize.value;
            let exportHandle = this.currentTiledHandle;
            
            // If not original size, resize the image
            if (selectedSize !== 'original') {
                const [width, height] = selectedSize.split('x').map(Number);
                exportHandle = this.wasmModule.resize_image(this.currentTiledHandle, width, height);
            }
            
            const imageBytes = this.wasmModule.export_image(exportHandle, format);
            await this.canvasManager.displayImageFromBytes(imageBytes);
            
            const filename = `tiled-image-${selectedSize}.${format}`;
            this.canvasManager.downloadImage(filename);
            this.updateStatus(`Image exported successfully as ${selectedSize} ${format.toUpperCase()}`);
        } catch (error) {
            console.error('Error exporting image:', error);
            this.updateStatus(`Error exporting image: ${error.message}`);
        }
    }

    clearAll() {
        this.imageLoader.clear();
        this.canvasManager.clear();
        this.imageList.innerHTML = '';
        // Restore empty state
        this.imageList.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z" />
                </svg>
                <p>No images loaded yet</p>
            </div>
        `;
        this.currentTiledImage = null;
        this.currentTiledHandle = null;
        this.selectedImageIndex = -1;
        this.exportButton.disabled = true;
        this.dragHint.style.display = 'none';
        this.updateTileButtons();
        this.updateStatus('Cleared all images');
    }

    toggleImageSelection(imageItem) {
        const imageItems = Array.from(this.imageList.children).filter(child => 
            child.className.includes('image-item'));
        const index = imageItems.indexOf(imageItem);
        
        if (this.selectedImageIndex === index) {
            // Unselect
            imageItem.classList.remove('selected');
            this.selectedImageIndex = -1;
        } else {
            // Clear previous selection
            if (this.selectedImageIndex >= 0 && imageItems[this.selectedImageIndex]) {
                imageItems[this.selectedImageIndex].classList.remove('selected');
            }
            // Select new image
            imageItem.classList.add('selected');
            this.selectedImageIndex = index;
        }
    }

    handleDragStart(e, imageItem) {
        const imageItems = Array.from(this.imageList.children).filter(child => 
            child.className.includes('image-item'));
        this.draggedImageIndex = imageItems.indexOf(imageItem);
        
        imageItem.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', imageItem.outerHTML);
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    handleDragEnter(e, imageItem) {
        e.preventDefault();
        if (!imageItem.classList.contains('dragging')) {
            imageItem.classList.add('drag-over');
        }
    }

    handleDragLeave(e, imageItem) {
        imageItem.classList.remove('drag-over');
    }

    handleDrop(e, imageItem) {
        e.preventDefault();
        
        if (this.draggedImageIndex === -1) return;
        
        const imageItems = Array.from(this.imageList.children).filter(child => 
            child.className.includes('image-item'));
        const dropIndex = imageItems.indexOf(imageItem);
        
        if (dropIndex !== -1 && dropIndex !== this.draggedImageIndex) {
            // Reorder in the data layer
            const success = this.imageLoader.reorderImages(this.draggedImageIndex, dropIndex);
            
            if (success) {
                // Update selected index if needed
                if (this.selectedImageIndex === this.draggedImageIndex) {
                    this.selectedImageIndex = dropIndex;
                } else if (this.selectedImageIndex >= Math.min(this.draggedImageIndex, dropIndex) &&
                          this.selectedImageIndex <= Math.max(this.draggedImageIndex, dropIndex)) {
                    // Adjust selection index for items that shifted
                    if (this.draggedImageIndex < dropIndex && this.selectedImageIndex > this.draggedImageIndex) {
                        this.selectedImageIndex--;
                    } else if (this.draggedImageIndex > dropIndex && this.selectedImageIndex < this.draggedImageIndex) {
                        this.selectedImageIndex++;
                    }
                }
                
                // Rebuild the UI list
                this.rebuildImageList();
                this.updateAutoPreview();
                this.updateStatus('Images reordered');
            }
        }
        
        // Clean up drag styles
        imageItems.forEach(item => {
            item.classList.remove('drag-over');
        });
    }

    handleDragEnd(e) {
        const imageItems = Array.from(this.imageList.children).filter(child => 
            child.className.includes('image-item'));
        
        imageItems.forEach(item => {
            item.classList.remove('dragging', 'drag-over');
        });
        
        this.draggedImageIndex = -1;
    }

    rebuildImageList() {
        // Clear current list (except empty state)
        const emptyState = this.imageList.querySelector('.empty-state');
        this.imageList.innerHTML = '';
        if (emptyState && this.imageLoader.getLoadedImages().length === 0) {
            this.imageList.appendChild(emptyState);
        }
        
        // Rebuild from data
        const images = this.imageLoader.getLoadedImages();
        images.forEach((imageData, index) => {
            this.addImageToList(imageData, index === this.selectedImageIndex);
        });
    }

    updateStatus(message) {
        this.status.textContent = message;
        console.log('Status:', message);
    }
}