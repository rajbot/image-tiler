export class UIController {
    constructor(imageLoader, canvasManager, wasmModule) {
        this.imageLoader = imageLoader;
        this.canvasManager = canvasManager;
        this.wasmModule = wasmModule;
        this.currentTiledImage = null;
        
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
        this.clearButton = document.getElementById('clear-btn');
        this.status = document.getElementById('status');
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
    }

    addImageToList(imageData) {
        const imageItem = document.createElement('div');
        imageItem.className = 'image-item';
        
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
            const index = Array.from(this.imageList.children).indexOf(imageItem);
            this.imageLoader.removeImage(index);
            imageItem.remove();
            this.updateTileButtons();
        };
        
        imageItem.appendChild(img);
        imageItem.appendChild(info);
        imageItem.appendChild(removeBtn);
        
        this.imageList.appendChild(imageItem);
    }

    updateTileButtons() {
        const imageCount = this.imageLoader.getLoadedImages().length;
        
        this.tileButtons['2x1'].disabled = imageCount < 2;
        this.tileButtons['2x2'].disabled = imageCount < 4;
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
            this.exportButton.disabled = false;
            
            this.updateStatus(`Successfully created ${layout} tile`);
        } catch (error) {
            console.error('Error tiling images:', error);
            this.updateStatus(`Error tiling images: ${error.message}`);
        }
    }

    exportImage() {
        if (!this.currentTiledImage) {
            this.updateStatus('No tiled image to export');
            return;
        }

        try {
            const format = this.exportFormat.value;
            const filename = `tiled-image.${format}`;
            this.canvasManager.downloadImage(filename);
            this.updateStatus('Image exported successfully');
        } catch (error) {
            console.error('Error exporting image:', error);
            this.updateStatus(`Error exporting image: ${error.message}`);
        }
    }

    clearAll() {
        this.imageLoader.clear();
        this.canvasManager.clear();
        this.imageList.innerHTML = '';
        this.currentTiledImage = null;
        this.exportButton.disabled = true;
        this.updateTileButtons();
        this.updateStatus('Cleared all images');
    }

    updateStatus(message) {
        this.status.textContent = message;
        console.log('Status:', message);
    }
}