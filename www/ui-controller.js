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
        this.setupCanvasSelection();
    }

    initializeElements() {
        this.fileInput = document.getElementById('file-input');
        this.dropZone = document.getElementById('drop-zone');
        this.imageList = document.getElementById('image-list');
        this.gridRows = document.getElementById('grid-rows');
        this.gridCols = document.getElementById('grid-cols');
        this.applyGridButton = document.getElementById('apply-grid');
        this.exportButton = document.getElementById('export-btn');
        this.exportFormat = document.getElementById('export-format');
        this.exportSize = document.getElementById('export-size');
        this.status = document.getElementById('status');
        this.dragHint = document.getElementById('drag-hint');
        this.imageDetails = document.getElementById('image-details');
        this.detailName = document.getElementById('detail-name');
        this.detailDimensions = document.getElementById('detail-dimensions');
        this.zoomInput = document.getElementById('zoom-input');
        this.zoomResetBtn = document.getElementById('zoom-reset');
        this.offsetXInput = document.getElementById('offset-x-input');
        this.offsetYInput = document.getElementById('offset-y-input');
        this.offsetResetBtn = document.getElementById('offset-reset');
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

        // Grid controls
        this.applyGridButton.addEventListener('click', () => {
            this.performGridTiling();
        });

        // Update grid when input values change
        this.gridRows.addEventListener('input', () => {
            this.performGridTiling();
        });

        this.gridCols.addEventListener('input', () => {
            this.performGridTiling();
        });

        // Export button
        this.exportButton.addEventListener('click', () => {
            this.exportImage();
        });


        // Zoom controls
        this.zoomInput.addEventListener('change', () => {
            this.applyZoom();
        });

        this.zoomResetBtn.addEventListener('click', () => {
            this.resetZoom();
        });

        // Offset controls
        this.offsetXInput.addEventListener('input', () => {
            this.applyOffset();
        });

        this.offsetYInput.addEventListener('input', () => {
            this.applyOffset();
        });

        this.offsetResetBtn.addEventListener('click', () => {
            this.resetOffset();
        });
    }

    setupCanvasSelection() {
        // Set up callback for canvas image selection
        this.canvasManager.onImageSelected = (selectedIndex) => {
            this.selectedImageIndex = selectedIndex;
            this.updateImageListSelection(selectedIndex);
        };

        // Set up callback for canvas image dragging
        this.canvasManager.onImageDrag = (imageIndex, deltaX, deltaY) => {
            if (imageIndex >= 0) {
                const currentOffset = this.imageLoader.getImageOffset(imageIndex);
                const newOffsetX = currentOffset.x + deltaX;
                const newOffsetY = currentOffset.y + deltaY;
                
                this.imageLoader.setImageOffset(imageIndex, newOffsetX, newOffsetY);
                this.updateOffsetInputs(imageIndex);
                this.performGridTiling(); // Real-time update during drag
            }
        };

        // Set up callback for canvas drag end
        this.canvasManager.onImageDragEnd = (imageIndex, totalDeltaX, totalDeltaY) => {
            if (imageIndex >= 0) {
                console.log(`Image ${imageIndex} drag ended. Total delta: (${totalDeltaX}, ${totalDeltaY})`);
                this.updateStatus(`Image panned by (${Math.round(totalDeltaX)}, ${Math.round(totalDeltaY)})`);
            }
        };
    }

    updateImageListSelection(selectedIndex) {
        // Remove previous selection highlights and add new one
        const imageItems = this.imageList.querySelectorAll('.image-item');
        imageItems.forEach((item, index) => {
            if (selectedIndex === index) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
        
        // Update image details display
        this.updateImageDetails(selectedIndex);
    }

    updateImageDetails(selectedIndex) {
        if (selectedIndex === -1) {
            // No image selected, hide details
            this.imageDetails.style.display = 'none';
            return;
        }

        const images = this.imageLoader.getLoadedImages();
        if (selectedIndex >= 0 && selectedIndex < images.length) {
            const selectedImage = images[selectedIndex];
            
            // Get dimensions from the current tiled image
            let dimensions = 'Unknown';
            if (this.currentTiledHandle) {
                // Calculate the dimensions of the selected image within the grid
                const gridInfo = this.canvasManager.getCurrentImageData()?.gridInfo;
                if (gridInfo) {
                    const cellWidth = Math.floor(this.currentTiledHandle.width / gridInfo.cols);
                    const cellHeight = Math.floor(this.currentTiledHandle.height / gridInfo.rows);
                    dimensions = `${cellWidth} × ${cellHeight}`;
                } else {
                    // Single image case
                    dimensions = `${this.currentTiledHandle.width} × ${this.currentTiledHandle.height}`;
                }
            }
            
            // Update the display
            this.detailName.textContent = selectedImage.name;
            this.detailDimensions.textContent = dimensions;
            
            // Update zoom input to show the selected image's zoom level
            const currentZoom = this.imageLoader.getImageZoom(selectedIndex);
            this.zoomInput.value = currentZoom;
            
            // Update offset inputs to show the selected image's offset values
            const currentOffset = this.imageLoader.getImageOffset(selectedIndex);
            this.offsetXInput.value = Math.round(currentOffset.x);
            this.offsetYInput.value = Math.round(currentOffset.y);
            
            this.imageDetails.style.display = 'block';
        } else {
            this.imageDetails.style.display = 'none';
        }
    }

    async handleFiles(files) {
        this.updateStatus('Loading images...');
        
        for (let file of files) {
            if (file.type.startsWith('image/')) {
                try {
                    const imageData = await this.imageLoader.loadFile(file);
                    const handle = await this.imageLoader.loadImageHandle(imageData, this.wasmModule);
                    console.log(`Created WASM handle for ${file.name}:`, handle);
                    this.addImageToList(imageData);
                } catch (error) {
                    console.error('Error loading image:', error);
                    this.updateStatus(`Error loading ${file.name}: ${error.message}`);
                }
            }
        }
        
        this.updateStatus(`Loaded ${this.imageLoader.getLoadedImages().length} images`);
        this.updateGridControls();
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
            this.updateGridControls();
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

    updateGridControls() {
        const imageCount = this.imageLoader.getLoadedImages().length;
        this.applyGridButton.disabled = imageCount === 0;
    }

    async updateAutoPreview() {
        const handles = this.imageLoader.getImageHandles().map(item => item.handle);
        
        if (handles.length === 0) {
            this.canvasManager.clear();
            this.currentTiledImage = null;
            this.currentTiledHandle = null;
            this.exportButton.disabled = true;
            this.updateExportSizeOptions();
            return;
        }

        // Calculate optimal grid size and update inputs
        const optimalGrid = this.calculateOptimalGrid(handles.length);
        console.log(`Auto-preview: ${handles.length} images -> ${optimalGrid.rows}x${optimalGrid.cols} grid`);
        this.updateGridInputs(optimalGrid.rows, optimalGrid.cols);

        // Use the new grid tiling function
        await this.performGridTiling();
    }


    calculateOptimalGrid(imageCount) {
        if (imageCount === 0) return { rows: 1, cols: 2 };
        if (imageCount <= 2) return { rows: 1, cols: 2 };
        if (imageCount <= 4) return { rows: 2, cols: 2 };
        
        // For more than 4 images, use the expansion rule
        let rows = 2;
        let cols = 2;
        let capacity = rows * cols;
        
        while (capacity < imageCount) {
            if (rows <= cols) {
                cols++;
            } else {
                rows++;
            }
            capacity = rows * cols;
        }
        
        return { rows, cols };
    }

    updateGridInputs(rows, cols) {
        this.gridRows.value = rows;
        this.gridCols.value = cols;
    }

    async performGridTiling() {
        const imageHandleData = this.imageLoader.getImageHandles();
        console.log(`Available image handles: ${imageHandleData.length}`, imageHandleData.map(item => item.handle));
        
        if (imageHandleData.length === 0) {
            this.updateStatus('No images to tile');
            return;
        }

        const rows = parseInt(this.gridRows.value);
        const cols = parseInt(this.gridCols.value);
        
        if (rows <= 0 || cols <= 0) {
            this.updateStatus('Rows and columns must be greater than 0');
            return;
        }

        try {
            console.log(`Performing grid tiling: ${imageHandleData.length} images in ${rows}x${cols} grid`);
            
            // Apply individual zoom and pan to each image before tiling
            const zoomedHandles = imageHandleData.map((item, index) => {
                const zoom = item.zoom || 100;
                const offsetX = item.offsetX || 0;
                const offsetY = item.offsetY || 0;
                console.log(`Image ${index}: applying ${zoom}% zoom with offset (${offsetX}, ${offsetY})`);
                
                if (zoom === 100 && offsetX === 0 && offsetY === 0) {
                    return item.handle;
                } else {
                    return this.wasmModule.zoom_and_pan_image(item.handle, zoom, offsetX, offsetY);
                }
            });
            
            // Call the appropriate function based on number of images
            let tiledHandle;
            switch (zoomedHandles.length) {
                case 1:
                    tiledHandle = this.wasmModule.tile_images_grid_1(rows, cols, zoomedHandles[0]);
                    break;
                case 2:
                    tiledHandle = this.wasmModule.tile_images_grid_2(rows, cols, zoomedHandles[0], zoomedHandles[1]);
                    break;
                case 3:
                    tiledHandle = this.wasmModule.tile_images_grid_3(rows, cols, zoomedHandles[0], zoomedHandles[1], zoomedHandles[2]);
                    break;
                case 4:
                    tiledHandle = this.wasmModule.tile_images_grid_4(rows, cols, zoomedHandles[0], zoomedHandles[1], zoomedHandles[2], zoomedHandles[3]);
                    break;
                case 5:
                    tiledHandle = this.wasmModule.tile_images_grid_5(rows, cols, zoomedHandles[0], zoomedHandles[1], zoomedHandles[2], zoomedHandles[3], zoomedHandles[4]);
                    break;
                case 6:
                    tiledHandle = this.wasmModule.tile_images_grid_6(rows, cols, zoomedHandles[0], zoomedHandles[1], zoomedHandles[2], zoomedHandles[3], zoomedHandles[4], zoomedHandles[5]);
                    break;
                case 7:
                    tiledHandle = this.wasmModule.tile_images_grid_7(rows, cols, zoomedHandles[0], zoomedHandles[1], zoomedHandles[2], zoomedHandles[3], zoomedHandles[4], zoomedHandles[5], zoomedHandles[6]);
                    break;
                case 8:
                    tiledHandle = this.wasmModule.tile_images_grid_8(rows, cols, zoomedHandles[0], zoomedHandles[1], zoomedHandles[2], zoomedHandles[3], zoomedHandles[4], zoomedHandles[5], zoomedHandles[6], zoomedHandles[7]);
                    break;
                case 9:
                    tiledHandle = this.wasmModule.tile_images_grid_9(rows, cols, zoomedHandles[0], zoomedHandles[1], zoomedHandles[2], zoomedHandles[3], zoomedHandles[4], zoomedHandles[5], zoomedHandles[6], zoomedHandles[7], zoomedHandles[8]);
                    break;
                default:
                    throw new Error(`Unsupported number of images: ${zoomedHandles.length}. Maximum supported is 9 images.`);
            }
            const exportFormat = this.exportFormat.value;
            const imageBytes = this.wasmModule.export_image(tiledHandle, exportFormat);
            
            // Create grid info for canvas image positioning
            const gridInfo = {
                rows: rows,
                cols: cols,
                imageCount: imageHandleData.length
            };
            
            await this.canvasManager.displayImageFromBytes(imageBytes, 'tiled-result', gridInfo);
            this.currentTiledImage = imageBytes;
            this.currentTiledHandle = tiledHandle;
            this.exportButton.disabled = false;
            this.updateExportSizeOptions();
            
            this.updateStatus(`Successfully created ${rows}×${cols} grid`);
        } catch (error) {
            console.error('Error tiling images:', error);
            this.updateStatus(`Error tiling images: ${error.message}`);
        }
    }

    getCurrentTiledDimensions() {
        if (!this.currentTiledHandle) {
            return null;
        }
        return {
            width: this.currentTiledHandle.width,
            height: this.currentTiledHandle.height
        };
    }

    updateExportSizeOptions() {
        const dimensions = this.getCurrentTiledDimensions();
        if (!dimensions) {
            // No tiled image, show default options
            this.exportSize.innerHTML = '<option value="original">Original</option>';
            return;
        }

        const { width, height } = dimensions;
        const aspectRatio = width / height;
        
        // Generate size options based on common target sizes
        const targetSizes = [1920, 1280, 1024, 800, 640];
        let options = '<option value="original">Original</option>';
        
        targetSizes.forEach(targetSize => {
            let finalWidth, finalHeight;
            
            if (aspectRatio > 1) {
                // Wider than tall - limit by width
                finalWidth = targetSize;
                finalHeight = Math.round(targetSize / aspectRatio);
            } else {
                // Taller than wide - limit by height  
                finalHeight = targetSize;
                finalWidth = Math.round(targetSize * aspectRatio);
            }
            
            options += `<option value="${finalWidth}x${finalHeight}">${finalWidth}×${finalHeight}</option>`;
        });
        
        this.exportSize.innerHTML = options;
    }

    async exportImage() {
        if (!this.currentTiledHandle) {
            this.updateStatus('No tiled image to export');
            return;
        }

        try {
            const format = this.exportFormat.value;
            const selectedSize = this.exportSize.value;
            
            // The currentTiledHandle already contains individually zoomed images
            let exportHandle = this.currentTiledHandle;
            
            // If not original size, resize the image
            if (selectedSize !== 'original') {
                const [width, height] = selectedSize.split('x').map(Number);
                exportHandle = this.wasmModule.resize_image(exportHandle, width, height);
            }
            
            const imageBytes = this.wasmModule.export_image(exportHandle, format);
            
            // Get current grid info from canvas manager to preserve selection functionality
            const currentGridInfo = this.canvasManager.getCurrentImageData()?.gridInfo;
            
            await this.canvasManager.displayImageFromBytes(imageBytes, 'exported-result', currentGridInfo);
            
            const filename = `tiled-image-${selectedSize}.${format}`;
            this.canvasManager.downloadImage(filename);
            this.updateStatus(`Image exported successfully as ${selectedSize} ${format.toUpperCase()}`);
        } catch (error) {
            console.error('Error exporting image:', error);
            this.updateStatus(`Error exporting image: ${error.message}`);
        }
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
        
        // Update canvas selection to match
        this.canvasManager.selectedImageIndex = this.selectedImageIndex;
        this.canvasManager.redrawWithSelection();
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
                
                // Update canvas selection to match the new position
                this.canvasManager.selectedImageIndex = this.selectedImageIndex;
                
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

    applyZoom() {
        if (this.selectedImageIndex === -1) {
            this.updateStatus('No image selected for zoom');
            return;
        }

        const zoomValue = parseInt(this.zoomInput.value);
        if (isNaN(zoomValue) || zoomValue < 10 || zoomValue > 500) {
            this.updateStatus('Zoom must be between 10% and 500%');
            const currentZoom = this.imageLoader.getImageZoom(this.selectedImageIndex);
            this.zoomInput.value = currentZoom;
            return;
        }

        try {
            console.log(`Applying ${zoomValue}% zoom to image ${this.selectedImageIndex}`);
            
            // Set the zoom level for the selected image
            this.imageLoader.setImageZoom(this.selectedImageIndex, zoomValue);
            
            // Regenerate the tiled image with the new zoom
            this.performGridTiling();
            
            this.updateStatus(`Zoom applied to selected image: ${zoomValue}%`);
        } catch (error) {
            console.error('Error applying zoom:', error);
            this.updateStatus(`Error applying zoom: ${error.message}`);
            const currentZoom = this.imageLoader.getImageZoom(this.selectedImageIndex);
            this.zoomInput.value = currentZoom;
        }
    }

    resetZoom() {
        if (this.selectedImageIndex === -1) {
            this.updateStatus('No image selected for zoom reset');
            return;
        }
        
        this.zoomInput.value = 100;
        this.applyZoom();
    }

    updateOffsetInputs(imageIndex) {
        if (imageIndex === this.selectedImageIndex) {
            const currentOffset = this.imageLoader.getImageOffset(imageIndex);
            this.offsetXInput.value = Math.round(currentOffset.x);
            this.offsetYInput.value = Math.round(currentOffset.y);
        }
    }

    applyOffset() {
        if (this.selectedImageIndex === -1) {
            this.updateStatus('No image selected for offset');
            return;
        }

        const offsetX = parseInt(this.offsetXInput.value) || 0;
        const offsetY = parseInt(this.offsetYInput.value) || 0;
        
        if (offsetX < -1000 || offsetX > 1000 || offsetY < -1000 || offsetY > 1000) {
            this.updateStatus('Offset values must be between -1000 and 1000');
            const currentOffset = this.imageLoader.getImageOffset(this.selectedImageIndex);
            this.offsetXInput.value = Math.round(currentOffset.x);
            this.offsetYInput.value = Math.round(currentOffset.y);
            return;
        }

        try {
            console.log(`Applying offset (${offsetX}, ${offsetY}) to image ${this.selectedImageIndex}`);
            
            // Set the offset for the selected image
            this.imageLoader.setImageOffset(this.selectedImageIndex, offsetX, offsetY);
            
            // Regenerate the tiled image with the new offset
            this.performGridTiling();
            
            this.updateStatus(`Offset applied to selected image: (${offsetX}, ${offsetY})`);
        } catch (error) {
            console.error('Error applying offset:', error);
            this.updateStatus(`Error applying offset: ${error.message}`);
            const currentOffset = this.imageLoader.getImageOffset(this.selectedImageIndex);
            this.offsetXInput.value = Math.round(currentOffset.x);
            this.offsetYInput.value = Math.round(currentOffset.y);
        }
    }

    resetOffset() {
        if (this.selectedImageIndex === -1) {
            this.updateStatus('No image selected for offset reset');
            return;
        }
        
        this.offsetXInput.value = 0;
        this.offsetYInput.value = 0;
        this.applyOffset();
    }

    updateStatus(message) {
        this.status.textContent = message;
        console.log('Status:', message);
    }
}