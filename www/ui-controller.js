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
        this.tileHeight = document.getElementById('tile-height');
        this.tileWidth = document.getElementById('tile-width');
        this.aspectLock = document.getElementById('aspect-lock');
        this.applyGridButton = document.getElementById('apply-grid');
        
        // Track custom tile dimensions and aspect ratio lock state
        this.aspectRatioLocked = true;
        this.customTileDimensions = null;
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
        this.gridToggleBtn = document.getElementById('grid-toggle-btn');
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

        // Tile dimension controls (optional - may not exist in tests)
        if (this.tileWidth) {
            this.tileWidth.addEventListener('input', () => {
                this.onTileWidthChange();
            });
        }

        if (this.tileHeight) {
            this.tileHeight.addEventListener('input', () => {
                this.onTileHeightChange();
            });
        }

        if (this.aspectLock) {
            this.aspectLock.addEventListener('click', () => {
                this.toggleAspectRatioLock();
            });
        }

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

        // Grid toggle button (optional - may not exist in tests)
        if (this.gridToggleBtn) {
            this.gridToggleBtn.addEventListener('click', () => {
                this.toggleGrid();
            });
        }
    }

    setupCanvasSelection() {
        // Set up callback for canvas image selection
        this.canvasManager.onImageSelected = (selectedIndex) => {
            this.selectedImageIndex = selectedIndex;
            this.updateImageListSelection(selectedIndex);
        };

        // Timeout handle for high-quality re-render after drag
        this.highQualityRenderTimeout = null;

        // Set up callback for canvas image dragging
        this.canvasManager.onImageDrag = (imageIndex, deltaX, deltaY) => {
            if (imageIndex >= 0) {
                console.log(`=== DRAG CALLBACK: image ${imageIndex}, raw delta (${deltaX}, ${deltaY}) ===`);
                
                // Scale drag deltas from canvas/display coordinate space to original image coordinate space
                const scaledDelta = this.scaleCanvasDeltaToOriginalCoordinates(imageIndex, deltaX, deltaY);
                
                console.log(`Scaled delta: (${scaledDelta.x}, ${scaledDelta.y})`);
                
                const currentOffset = this.imageLoader.getImageOffset(imageIndex);
                console.log(`Current offset from storage: (${currentOffset.x}, ${currentOffset.y})`);
                
                const newOffsetX = currentOffset.x + scaledDelta.x;
                const newOffsetY = currentOffset.y + scaledDelta.y;
                
                console.log(`Calculated new offset: (${newOffsetX}, ${newOffsetY})`);
                
                this.imageLoader.setImageOffset(imageIndex, newOffsetX, newOffsetY);
                
                // Verify what was actually stored
                const verifyOffset = this.imageLoader.getImageOffset(imageIndex);
                console.log(`Verified stored offset: (${verifyOffset.x}, ${verifyOffset.y})`);
                console.log(`Expected offset for full left pan: -${this.imageLoader.getImageDimensions(imageIndex).width}px`);
                this.updateOffsetInputs(imageIndex);
                
                // Cancel any pending high-quality render
                if (this.highQualityRenderTimeout) {
                    clearTimeout(this.highQualityRenderTimeout);
                    this.highQualityRenderTimeout = null;
                }
                
                // Use proxy images for real-time performance during drag
                this.performGridTiling(true); // useProxy = true for smooth dragging
            }
        };

        // Set up callback for canvas drag start
        this.canvasManager.onImageDragStart = (imageIndex) => {
            if (imageIndex >= 0) {
                // Cancel any pending high-quality render when new drag starts
                if (this.highQualityRenderTimeout) {
                    clearTimeout(this.highQualityRenderTimeout);
                    this.highQualityRenderTimeout = null;
                }
            }
        };

        // Set up callback for canvas drag end
        this.canvasManager.onImageDragEnd = (imageIndex, totalDeltaX, totalDeltaY) => {
            if (imageIndex >= 0) {
                console.log(`Image ${imageIndex} drag ended. Total delta: (${totalDeltaX}, ${totalDeltaY})`);
                this.updateStatus(`Image panned by (${Math.round(totalDeltaX)}, ${Math.round(totalDeltaY)})`);
                
                // Schedule high-quality re-render after drag ends (300ms debounce)
                this.scheduleHighQualityRender();
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
            
            // Get dimensions from the original image (not proxy)
            const imageDimensions = this.imageLoader.getImageDimensions(selectedIndex);
            const dimensions = `${imageDimensions.width} × ${imageDimensions.height}`;
            
            // Update the display
            this.detailName.textContent = selectedImage.name;
            this.detailDimensions.textContent = dimensions;
            
            // Update zoom input to show the effective zoom level (including grid scaling)
            const effectiveZoom = this.calculateEffectiveZoom(selectedIndex);
            this.zoomInput.value = Math.round(effectiveZoom);
            
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

    async performGridTiling(useProxy = true) {
        const imageHandleData = this.imageLoader.getImageHandles();
        console.log(`Available image handles: ${imageHandleData.length}`, imageHandleData.map(item => item.handle));
        
        if (imageHandleData.length === 0) {
            this.clearTileDimensions();
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
            const proxyInfo = useProxy ? ' (using proxy images for performance)' : ' (using original images for quality)';
            console.log(`Performing grid tiling: ${imageHandleData.length} images in ${rows}x${cols} grid${proxyInfo}`);
            
            // Collect handles and zoom/offset data for new zoomed tiling functions
            const handles = [];
            const zoomLevels = [];
            const offsetXLevels = [];
            const offsetYLevels = [];
            
            imageHandleData.forEach((item, index) => {
                const zoom = item.zoom || 100;
                const offsetX = item.offsetX || 0;
                const offsetY = item.offsetY || 0;
                
                // Select appropriate handle: proxy for preview, original for export
                const baseHandle = this.imageLoader.getImageHandle(index, useProxy);
                const proxyUsed = useProxy && this.imageLoader.hasProxy(index);
                const handleType = proxyUsed ? 'proxy' : 'original';
                
                // Scale offsets from original image coordinates to handle coordinates
                let scaledOffsetX = offsetX;
                let scaledOffsetY = offsetY;
                
                if (proxyUsed) {
                    // Convert offsets from original image coordinate space to proxy coordinate space
                    const originalDims = this.imageLoader.getImageDimensions(index);
                    const proxyHandle = this.imageLoader.getImageHandle(index, true);
                    
                    if (proxyHandle && originalDims) {
                        const scaleX = proxyHandle.width / originalDims.width;
                        const scaleY = proxyHandle.height / originalDims.height;
                        
                        scaledOffsetX = offsetX * scaleX;
                        scaledOffsetY = offsetY * scaleY;
                        
                        console.log(`Image ${index}: scaling offset (${offsetX}, ${offsetY}) → (${scaledOffsetX}, ${scaledOffsetY}) for ${handleType} handle`);
                    }
                }
                
                console.log(`Image ${index}: using ${zoom}% zoom with offset (${scaledOffsetX}, ${scaledOffsetY}) on ${handleType} handle`);
                
                handles.push(baseHandle);
                zoomLevels.push(zoom);
                offsetXLevels.push(Math.round(scaledOffsetX));
                offsetYLevels.push(Math.round(scaledOffsetY));
            });
            
            // Call the appropriate function based on number of images and custom tile dimensions
            let tiledHandle;
            
            // Check if we should use custom tile dimensions
            const useCustomDimensions = this.customTileDimensions && 
                                      this.customTileDimensions.width > 0 && 
                                      this.customTileDimensions.height > 0;
            
            if (useCustomDimensions) {
                const tileWidth = this.customTileDimensions.width;
                const tileHeight = this.customTileDimensions.height;
                console.log(`Using custom tile dimensions: ${tileWidth}×${tileHeight}`);
                
                switch (handles.length) {
                    case 1:
                        tiledHandle = this.wasmModule.tile_images_grid_1_custom_zoomed(rows, cols, tileWidth, tileHeight, zoomLevels[0], offsetXLevels[0], offsetYLevels[0], handles[0]);
                        break;
                    case 2:
                        tiledHandle = this.wasmModule.tile_images_grid_2_custom_zoomed(rows, cols, tileWidth, tileHeight, zoomLevels[0], offsetXLevels[0], offsetYLevels[0], zoomLevels[1], offsetXLevels[1], offsetYLevels[1], handles[0], handles[1]);
                        break;
                    case 3:
                        tiledHandle = this.wasmModule.tile_images_grid_3_custom_zoomed(rows, cols, tileWidth, tileHeight, zoomLevels[0], offsetXLevels[0], offsetYLevels[0], zoomLevels[1], offsetXLevels[1], offsetYLevels[1], zoomLevels[2], offsetXLevels[2], offsetYLevels[2], handles[0], handles[1], handles[2]);
                        break;
                    case 4:
                        tiledHandle = this.wasmModule.tile_images_grid_4_custom_zoomed(rows, cols, tileWidth, tileHeight, zoomLevels[0], offsetXLevels[0], offsetYLevels[0], zoomLevels[1], offsetXLevels[1], offsetYLevels[1], zoomLevels[2], offsetXLevels[2], offsetYLevels[2], zoomLevels[3], offsetXLevels[3], offsetYLevels[3], handles[0], handles[1], handles[2], handles[3]);
                        break;
                    case 5:
                        tiledHandle = this.wasmModule.tile_images_grid_5_custom_zoomed(rows, cols, tileWidth, tileHeight, zoomLevels[0], offsetXLevels[0], offsetYLevels[0], zoomLevels[1], offsetXLevels[1], offsetYLevels[1], zoomLevels[2], offsetXLevels[2], offsetYLevels[2], zoomLevels[3], offsetXLevels[3], offsetYLevels[3], zoomLevels[4], offsetXLevels[4], offsetYLevels[4], handles[0], handles[1], handles[2], handles[3], handles[4]);
                        break;
                    case 6:
                        tiledHandle = this.wasmModule.tile_images_grid_6_custom_zoomed(rows, cols, tileWidth, tileHeight, zoomLevels[0], offsetXLevels[0], offsetYLevels[0], zoomLevels[1], offsetXLevels[1], offsetYLevels[1], zoomLevels[2], offsetXLevels[2], offsetYLevels[2], zoomLevels[3], offsetXLevels[3], offsetYLevels[3], zoomLevels[4], offsetXLevels[4], offsetYLevels[4], zoomLevels[5], offsetXLevels[5], offsetYLevels[5], handles[0], handles[1], handles[2], handles[3], handles[4], handles[5]);
                        break;
                    case 7:
                        tiledHandle = this.wasmModule.tile_images_grid_7_custom_zoomed(rows, cols, tileWidth, tileHeight, zoomLevels[0], offsetXLevels[0], offsetYLevels[0], zoomLevels[1], offsetXLevels[1], offsetYLevels[1], zoomLevels[2], offsetXLevels[2], offsetYLevels[2], zoomLevels[3], offsetXLevels[3], offsetYLevels[3], zoomLevels[4], offsetXLevels[4], offsetYLevels[4], zoomLevels[5], offsetXLevels[5], offsetYLevels[5], zoomLevels[6], offsetXLevels[6], offsetYLevels[6], handles[0], handles[1], handles[2], handles[3], handles[4], handles[5], handles[6]);
                        break;
                    case 8:
                        tiledHandle = this.wasmModule.tile_images_grid_8_custom_zoomed(rows, cols, tileWidth, tileHeight, zoomLevels[0], offsetXLevels[0], offsetYLevels[0], zoomLevels[1], offsetXLevels[1], offsetYLevels[1], zoomLevels[2], offsetXLevels[2], offsetYLevels[2], zoomLevels[3], offsetXLevels[3], offsetYLevels[3], zoomLevels[4], offsetXLevels[4], offsetYLevels[4], zoomLevels[5], offsetXLevels[5], offsetYLevels[5], zoomLevels[6], offsetXLevels[6], offsetYLevels[6], zoomLevels[7], offsetXLevels[7], offsetYLevels[7], handles[0], handles[1], handles[2], handles[3], handles[4], handles[5], handles[6], handles[7]);
                        break;
                    case 9:
                        tiledHandle = this.wasmModule.tile_images_grid_9_custom_zoomed(rows, cols, tileWidth, tileHeight, zoomLevels[0], offsetXLevels[0], offsetYLevels[0], zoomLevels[1], offsetXLevels[1], offsetYLevels[1], zoomLevels[2], offsetXLevels[2], offsetYLevels[2], zoomLevels[3], offsetXLevels[3], offsetYLevels[3], zoomLevels[4], offsetXLevels[4], offsetYLevels[4], zoomLevels[5], offsetXLevels[5], offsetYLevels[5], zoomLevels[6], offsetXLevels[6], offsetYLevels[6], zoomLevels[7], offsetXLevels[7], offsetYLevels[7], zoomLevels[8], offsetXLevels[8], offsetYLevels[8], handles[0], handles[1], handles[2], handles[3], handles[4], handles[5], handles[6], handles[7], handles[8]);
                        break;
                    default:
                        throw new Error(`Unsupported number of images: ${handles.length}. Maximum supported is 9 images.`);
                }
            } else {
                // Use automatic tile sizing based on largest image
                switch (handles.length) {
                    case 1:
                        tiledHandle = this.wasmModule.tile_images_grid_1_zoomed(rows, cols, zoomLevels[0], offsetXLevels[0], offsetYLevels[0], handles[0]);
                        break;
                    case 2:
                        tiledHandle = this.wasmModule.tile_images_grid_2_zoomed(rows, cols, zoomLevels[0], offsetXLevels[0], offsetYLevels[0], zoomLevels[1], offsetXLevels[1], offsetYLevels[1], handles[0], handles[1]);
                        break;
                    case 3:
                        tiledHandle = this.wasmModule.tile_images_grid_3_zoomed(rows, cols, zoomLevels[0], offsetXLevels[0], offsetYLevels[0], zoomLevels[1], offsetXLevels[1], offsetYLevels[1], zoomLevels[2], offsetXLevels[2], offsetYLevels[2], handles[0], handles[1], handles[2]);
                        break;
                    case 4:
                        tiledHandle = this.wasmModule.tile_images_grid_4_zoomed(rows, cols, zoomLevels[0], offsetXLevels[0], offsetYLevels[0], zoomLevels[1], offsetXLevels[1], offsetYLevels[1], zoomLevels[2], offsetXLevels[2], offsetYLevels[2], zoomLevels[3], offsetXLevels[3], offsetYLevels[3], handles[0], handles[1], handles[2], handles[3]);
                        break;
                    case 5:
                        tiledHandle = this.wasmModule.tile_images_grid_5_zoomed(rows, cols, zoomLevels[0], offsetXLevels[0], offsetYLevels[0], zoomLevels[1], offsetXLevels[1], offsetYLevels[1], zoomLevels[2], offsetXLevels[2], offsetYLevels[2], zoomLevels[3], offsetXLevels[3], offsetYLevels[3], zoomLevels[4], offsetXLevels[4], offsetYLevels[4], handles[0], handles[1], handles[2], handles[3], handles[4]);
                        break;
                    case 6:
                        tiledHandle = this.wasmModule.tile_images_grid_6_zoomed(rows, cols, zoomLevels[0], offsetXLevels[0], offsetYLevels[0], zoomLevels[1], offsetXLevels[1], offsetYLevels[1], zoomLevels[2], offsetXLevels[2], offsetYLevels[2], zoomLevels[3], offsetXLevels[3], offsetYLevels[3], zoomLevels[4], offsetXLevels[4], offsetYLevels[4], zoomLevels[5], offsetXLevels[5], offsetYLevels[5], handles[0], handles[1], handles[2], handles[3], handles[4], handles[5]);
                        break;
                    case 7:
                        tiledHandle = this.wasmModule.tile_images_grid_7_zoomed(rows, cols, zoomLevels[0], offsetXLevels[0], offsetYLevels[0], zoomLevels[1], offsetXLevels[1], offsetYLevels[1], zoomLevels[2], offsetXLevels[2], offsetYLevels[2], zoomLevels[3], offsetXLevels[3], offsetYLevels[3], zoomLevels[4], offsetXLevels[4], offsetYLevels[4], zoomLevels[5], offsetXLevels[5], offsetYLevels[5], zoomLevels[6], offsetXLevels[6], offsetYLevels[6], handles[0], handles[1], handles[2], handles[3], handles[4], handles[5], handles[6]);
                        break;
                    case 8:
                        tiledHandle = this.wasmModule.tile_images_grid_8_zoomed(rows, cols, zoomLevels[0], offsetXLevels[0], offsetYLevels[0], zoomLevels[1], offsetXLevels[1], offsetYLevels[1], zoomLevels[2], offsetXLevels[2], offsetYLevels[2], zoomLevels[3], offsetXLevels[3], offsetYLevels[3], zoomLevels[4], offsetXLevels[4], offsetYLevels[4], zoomLevels[5], offsetXLevels[5], offsetYLevels[5], zoomLevels[6], offsetXLevels[6], offsetYLevels[6], zoomLevels[7], offsetXLevels[7], offsetYLevels[7], handles[0], handles[1], handles[2], handles[3], handles[4], handles[5], handles[6], handles[7]);
                        break;
                    case 9:
                        tiledHandle = this.wasmModule.tile_images_grid_9_zoomed(rows, cols, zoomLevels[0], offsetXLevels[0], offsetYLevels[0], zoomLevels[1], offsetXLevels[1], offsetYLevels[1], zoomLevels[2], offsetXLevels[2], offsetYLevels[2], zoomLevels[3], offsetXLevels[3], offsetYLevels[3], zoomLevels[4], offsetXLevels[4], offsetYLevels[4], zoomLevels[5], offsetXLevels[5], offsetYLevels[5], zoomLevels[6], offsetXLevels[6], offsetYLevels[6], zoomLevels[7], offsetXLevels[7], offsetYLevels[7], zoomLevels[8], offsetXLevels[8], offsetYLevels[8], handles[0], handles[1], handles[2], handles[3], handles[4], handles[5], handles[6], handles[7], handles[8]);
                        break;
                    default:
                        throw new Error(`Unsupported number of images: ${handles.length}. Maximum supported is 9 images.`);
                }
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
            
            // Update tile dimension displays
            this.updateTileDimensions(rows, cols);
            
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

    updateTileDimensions(rows, cols) {
        if (!this.tileHeight || !this.tileWidth) {
            return;
        }

        const loadedImages = this.imageLoader.getLoadedImages();
        if (loadedImages.length === 0) {
            return;
        }

        // Find the largest original image dimensions among all images
        // This determines the reference tile size since all images are scaled to fit the largest
        let maxWidth = 0;
        let maxHeight = 0;
        
        for (let i = 0; i < loadedImages.length; i++) {
            const originalDims = this.imageLoader.getImageDimensions(i);
            if (originalDims) {
                maxWidth = Math.max(maxWidth, originalDims.width);
                maxHeight = Math.max(maxHeight, originalDims.height);
            }
        }

        // The tile size is based on the largest image's dimensions
        // Each tile will be sized to contain this largest image
        const tileWidth = maxWidth;
        const tileHeight = maxHeight;

        // Update the input fields (only if not manually set by user)
        if (!this.customTileDimensions) {
            this.tileWidth.value = tileWidth;
            this.tileHeight.value = tileHeight;
            this.customTileDimensions = { width: tileWidth, height: tileHeight };
        }

        console.log(`Tile dimensions: ${tileWidth} × ${tileHeight} pixels (based on largest image for ${rows}×${cols} grid)`);
    }

    clearTileDimensions() {
        if (this.tileWidth && this.tileHeight) {
            this.tileWidth.value = '';
            this.tileHeight.value = '';
            this.customTileDimensions = null;
        }
    }

    toggleAspectRatioLock() {
        this.aspectRatioLocked = !this.aspectRatioLocked;
        
        if (this.aspectLock) {
            if (this.aspectRatioLocked) {
                this.aspectLock.classList.add('locked');
                this.aspectLock.textContent = '🔗 Locked';
                this.aspectLock.title = 'Unlock aspect ratio';
            } else {
                this.aspectLock.classList.remove('locked');
                this.aspectLock.textContent = '🔓 Unlocked';
                this.aspectLock.title = 'Lock aspect ratio';
            }
        }
        
        console.log(`Aspect ratio lock: ${this.aspectRatioLocked ? 'locked' : 'unlocked'}`);
    }

    onTileWidthChange() {
        const widthValue = parseInt(this.tileWidth.value);
        if (isNaN(widthValue) || widthValue < 1 || widthValue > 10000) {
            return;
        }

        if (this.aspectRatioLocked && this.customTileDimensions) {
            // Calculate height to maintain aspect ratio
            const aspectRatio = this.customTileDimensions.width / this.customTileDimensions.height;
            const newHeight = Math.round(widthValue / aspectRatio);
            this.tileHeight.value = newHeight;
            this.customTileDimensions = { width: widthValue, height: newHeight };
        } else {
            // Update only width
            this.customTileDimensions = {
                width: widthValue,
                height: this.customTileDimensions?.height || parseInt(this.tileHeight.value) || widthValue
            };
        }

        console.log(`Custom tile width changed to: ${widthValue}px`);
        this.performGridTiling();
    }

    onTileHeightChange() {
        const heightValue = parseInt(this.tileHeight.value);
        if (isNaN(heightValue) || heightValue < 1 || heightValue > 10000) {
            return;
        }

        if (this.aspectRatioLocked && this.customTileDimensions) {
            // Calculate width to maintain aspect ratio
            const aspectRatio = this.customTileDimensions.width / this.customTileDimensions.height;
            const newWidth = Math.round(heightValue * aspectRatio);
            this.tileWidth.value = newWidth;
            this.customTileDimensions = { width: newWidth, height: heightValue };
        } else {
            // Update only height
            this.customTileDimensions = {
                width: this.customTileDimensions?.width || parseInt(this.tileWidth.value) || heightValue,
                height: heightValue
            };
        }

        console.log(`Custom tile height changed to: ${heightValue}px`);
        this.performGridTiling();
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
        if (this.imageLoader.getImageHandles().length === 0) {
            this.updateStatus('No images to export');
            return;
        }

        try {
            const format = this.exportFormat.value;
            const selectedSize = this.exportSize.value;
            
            // Always regenerate with original quality for export (useProxy = false)
            console.log('Regenerating tiled image with original quality for export...');
            await this.performGridTiling(false);
            
            // Use the freshly generated high-quality tiled image
            let exportHandle = this.currentTiledHandle;
            
            if (!exportHandle) {
                this.updateStatus('Failed to generate high-quality image for export');
                return;
            }
            
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
        if (isNaN(zoomValue) || zoomValue < 10 || zoomValue > 10000) {
            this.updateStatus('Zoom must be between 10% and 10000%');
            // Reset to current effective zoom
            const effectiveZoom = this.calculateEffectiveZoom(this.selectedImageIndex);
            this.zoomInput.value = Math.round(effectiveZoom);
            return;
        }

        try {
            console.log(`Applying ${zoomValue}% effective zoom to image ${this.selectedImageIndex}`);
            
            // Convert from effective zoom (what user sees) to user zoom (what we store)
            const userZoom = this.convertEffectiveZoomToUserZoom(this.selectedImageIndex, zoomValue);
            console.log(`Effective zoom ${zoomValue}% converts to user zoom ${userZoom.toFixed(1)}%`);
            
            // Set the converted zoom level for the selected image
            this.imageLoader.setImageZoom(this.selectedImageIndex, userZoom);
            
            // Regenerate the tiled image with the new zoom
            this.performGridTiling();
            
            this.updateStatus(`Effective zoom applied to selected image: ${zoomValue}%`);
        } catch (error) {
            console.error('Error applying zoom:', error);
            this.updateStatus(`Error applying zoom: ${error.message}`);
            // Reset to current effective zoom
            const effectiveZoom = this.calculateEffectiveZoom(this.selectedImageIndex);
            this.zoomInput.value = Math.round(effectiveZoom);
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
        
        if (offsetX < -10000 || offsetX > 10000 || offsetY < -10000 || offsetY > 10000) {
            this.updateStatus('Offset values must be between -10000 and 10000');
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

    /**
     * Scale canvas drag deltas from display coordinate space to original image coordinate space
     * This is needed because drag coordinates are in canvas/proxy space but offsets are stored in original space
     */
    scaleCanvasDeltaToOriginalCoordinates(imageIndex, deltaX, deltaY) {
        // Get the current tiled image and canvas information to determine scaling
        if (!this.currentTiledHandle) {
            console.log(`No tiled handle available, no scaling needed`);
            return { x: deltaX, y: deltaY };
        }
        
        // Get original image dimensions
        const originalDimensions = this.imageLoader.getImageDimensions(imageIndex);
        
        // Get the canvas scaling factor (how the tiled image is scaled to fit in canvas)
        const canvasElement = this.canvasManager.canvas;
        const currentImage = this.canvasManager.currentImage;
        
        if (!currentImage || !currentImage.image) {
            console.log(`No current canvas image, using simple proxy scaling`);
            // Fallback to simple proxy scaling
            const useProxy = true;
            const isUsingProxy = useProxy && this.imageLoader.hasProxy(imageIndex);
            if (isUsingProxy) {
                const proxyHandle = this.imageLoader.getImageHandle(imageIndex, true);
                if (proxyHandle) {
                    const scaleX = originalDimensions.width / proxyHandle.width;
                    const scaleY = originalDimensions.height / proxyHandle.height;
                    return { x: deltaX * scaleX, y: deltaY * scaleY };
                }
            }
            return { x: deltaX, y: deltaY };
        }
        
        // Calculate the full coordinate transformation chain:
        // Canvas coords → Displayed tiled image coords → Individual image coords → Original image coords
        
        console.log(`Scaling delta (${deltaX}, ${deltaY}) for image ${imageIndex}`);
        console.log(`Canvas size: ${canvasElement.width}x${canvasElement.height}`);
        console.log(`Tiled image size: ${this.currentTiledHandle.width}x${this.currentTiledHandle.height}`);
        console.log(`Canvas image display size: ${currentImage.width}x${currentImage.height}`);
        console.log(`Original image size: ${originalDimensions.width}x${originalDimensions.height}`);
        
        // Step 1: Canvas coords → Displayed tiled image coords
        // The tiled image is scaled to fit in canvas
        const canvasToDisplayedScale = this.currentTiledHandle.width / currentImage.width;
        console.log(`Canvas to displayed scale: ${canvasToDisplayedScale}`);
        
        // Step 2: Get the grid layout to find individual image size within tiled image
        const gridInfo = this.canvasManager.getCurrentImageData()?.gridInfo;
        if (!gridInfo) {
            console.log(`No grid info available, treating as single image`);
            // Single image case - the displayed image IS the individual image
            const displayedToOriginalScaleX = originalDimensions.width / this.currentTiledHandle.width;
            const displayedToOriginalScaleY = originalDimensions.height / this.currentTiledHandle.height;
            
            const totalScaleX = canvasToDisplayedScale * displayedToOriginalScaleX;
            const totalScaleY = canvasToDisplayedScale * displayedToOriginalScaleY;
            
            console.log(`Total scale factors: scaleX=${totalScaleX}, scaleY=${totalScaleY}`);
            
            return {
                x: deltaX * totalScaleX,
                y: deltaY * totalScaleY
            };
        }
        
        // Step 3: Grid case - account for individual cell size
        const cellWidth = this.currentTiledHandle.width / gridInfo.cols;
        const cellHeight = this.currentTiledHandle.height / gridInfo.rows;
        
        console.log(`Grid: ${gridInfo.rows}x${gridInfo.cols}, Cell size: ${cellWidth}x${cellHeight}`);
        
        // Step 4: Scale from canvas to original image coordinates
        // The issue was calculating cell scaling incorrectly for grids
        
        // Canvas pixel → Tiled image pixel
        const canvasToTiledScaleX = this.currentTiledHandle.width / currentImage.width;
        const canvasToTiledScaleY = this.currentTiledHandle.height / currentImage.height;
        
        // Tiled image pixel → Original image pixel (direct scaling)
        const tiledToOriginalScaleX = originalDimensions.width / this.currentTiledHandle.width;
        const tiledToOriginalScaleY = originalDimensions.height / this.currentTiledHandle.height;
        
        const totalScaleX = canvasToTiledScaleX * tiledToOriginalScaleX;
        const totalScaleY = canvasToTiledScaleY * tiledToOriginalScaleY;
        
        console.log(`Canvas to tiled scale: ${canvasToTiledScaleX}, ${canvasToTiledScaleY}`);
        console.log(`Tiled to original scale: ${tiledToOriginalScaleX}, ${tiledToOriginalScaleY}`);
        console.log(`Total scale factors: scaleX=${totalScaleX}, scaleY=${totalScaleY}`);
        
        const scaledDelta = {
            x: deltaX * totalScaleX,
            y: deltaY * totalScaleY
        };
        
        console.log(`Scaled delta: (${scaledDelta.x}, ${scaledDelta.y})`);
        return scaledDelta;
    }

    /**
     * Calculate the effective zoom including grid scaling factor
     * When images are tiled together, they get scaled to create uniform grid cells
     * This returns the actual zoom percentage being applied to the image
     */
    calculateEffectiveZoom(imageIndex) {
        const userZoom = this.imageLoader.getImageZoom(imageIndex);
        
        // If there's only one image or no tiled result, no grid scaling is applied
        const imageCount = this.imageLoader.getLoadedImages().length;
        if (imageCount <= 1 || !this.currentTiledHandle) {
            return userZoom;
        }
        
        // Calculate grid scaling factor based on how images are scaled relative to the largest image
        const imageDimensions = this.imageLoader.getImageDimensions(imageIndex);
        const allImages = this.imageLoader.getLoadedImages();
        
        if (!imageDimensions || allImages.length === 0) {
            return userZoom;
        }
        
        // Find the largest image dimensions among all images (this becomes the reference)
        let maxWidth = 0;
        let maxHeight = 0;
        for (let i = 0; i < allImages.length; i++) {
            const dims = this.imageLoader.getImageDimensions(i);
            maxWidth = Math.max(maxWidth, dims.width);
            maxHeight = Math.max(maxHeight, dims.height);
        }
        
        // Calculate how much this image gets scaled relative to the largest image
        // Images are scaled to fit within the reference dimensions while preserving aspect ratio
        // This means scaling by the factor that makes the image fit without clipping
        const scaleX = maxWidth / imageDimensions.width;
        const scaleY = maxHeight / imageDimensions.height;
        const gridScaleFactor = Math.min(scaleX, scaleY); // Use smaller scale to prevent clipping
        
        // The effective zoom is the user zoom multiplied by the grid scaling factor
        const effectiveZoomPercent = userZoom * gridScaleFactor;
        
        console.log(`Image ${imageIndex}: ${imageDimensions.width}×${imageDimensions.height} → reference ${maxWidth}×${maxHeight}, scaleX: ${scaleX.toFixed(3)}, scaleY: ${scaleY.toFixed(3)}, grid scale: ${gridScaleFactor.toFixed(3)}, user zoom: ${userZoom}%, effective: ${effectiveZoomPercent.toFixed(1)}%`);
        
        return effectiveZoomPercent;
    }

    /**
     * Convert effective zoom (what user sees) to user zoom (what we store)
     * This is the inverse of calculateEffectiveZoom
     */
    convertEffectiveZoomToUserZoom(imageIndex, effectiveZoom) {
        // If there's only one image, no conversion needed
        const imageCount = this.imageLoader.getLoadedImages().length;
        if (imageCount <= 1) {
            return effectiveZoom;
        }
        
        // Get the same grid scaling factor used in calculateEffectiveZoom
        const imageDimensions = this.imageLoader.getImageDimensions(imageIndex);
        const allImages = this.imageLoader.getLoadedImages();
        
        if (!imageDimensions || allImages.length === 0) {
            return effectiveZoom;
        }
        
        // Calculate the same grid scaling factor
        let maxWidth = 0;
        let maxHeight = 0;
        for (let i = 0; i < allImages.length; i++) {
            const dims = this.imageLoader.getImageDimensions(i);
            maxWidth = Math.max(maxWidth, dims.width);
            maxHeight = Math.max(maxHeight, dims.height);
        }
        
        const scaleX = maxWidth / imageDimensions.width;
        const scaleY = maxHeight / imageDimensions.height;
        const gridScaleFactor = Math.min(scaleX, scaleY);
        
        // Convert: effectiveZoom = userZoom * gridScaleFactor
        // So: userZoom = effectiveZoom / gridScaleFactor
        const userZoom = effectiveZoom / gridScaleFactor;
        
        return userZoom;
    }

    /**
     * Schedule a high-quality re-render after drag operations
     * Uses 300ms debounce to prevent excessive renders
     */
    scheduleHighQualityRender() {
        // Clear any existing timeout
        if (this.highQualityRenderTimeout) {
            clearTimeout(this.highQualityRenderTimeout);
        }
        
        // Schedule new high-quality render
        this.highQualityRenderTimeout = setTimeout(() => {
            console.log('Rendering high-quality preview after drag...');
            this.performGridTiling(false); // useProxy = false for full quality
            this.highQualityRenderTimeout = null;
        }, 300); // 300ms debounce
    }

    toggleGrid() {
        const newState = this.canvasManager.toggleGrid();
        
        // Update button text and appearance (if button exists)
        if (this.gridToggleBtn) {
            this.gridToggleBtn.textContent = this.canvasManager.getGridStateText();
            
            if (newState > 0) {
                this.gridToggleBtn.classList.add('active');
            } else {
                this.gridToggleBtn.classList.remove('active');
            }
        }
    }

    updateStatus(message) {
        this.status.textContent = message;
        console.log('Status:', message);
    }
}