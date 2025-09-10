import init, { ImageBuffer } from './pkg/fast_image_tiler.js';

class RenderLoop {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.fpsElement = document.getElementById('fps');
        this.frameCountElement = document.getElementById('frame-count');
        this.startBtn = document.getElementById('start-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.loadImageBtn = document.getElementById('load-image-btn');
        this.gridToggleBtn = document.getElementById('grid-toggle-btn');
        this.fileInput = document.getElementById('file-input');
        this.tileList = document.getElementById('tile-list');
        this.selectedTileInfo = document.getElementById('selected-tile-info');
        this.scaleControl = document.getElementById('scale-control');
        this.tileScaleInput = document.getElementById('tile-scale');
        this.offsetControls = document.getElementById('offset-controls');
        this.tileOffsetXInput = document.getElementById('tile-offset-x');
        this.tileOffsetYInput = document.getElementById('tile-offset-y');
        
        // Background color controls
        this.backgroundColorInput = document.getElementById('background-color');
        this.backgroundColorHex = document.getElementById('background-color-hex');
        this.backgroundOpacityInput = document.getElementById('background-opacity');
        this.backgroundOpacityValue = document.getElementById('background-opacity-value');
        
        // Interaction help text
        this.interactionHelp = document.getElementById('interaction-help');
        
        this.running = false;
        this.frameCount = 0;
        this.lastTime = 0;
        this.fps = 0;
        this.frameTimeBuffer = [];
        this.maxFrameTimeBuffer = 60;
        this.selectionAnimationId = null; // For marching ants animation when not running
        
        this.imageBuffer = null;
        this.wasmModule = null;
        
        // Store multiple tile data - Map with tile index as key
        this.loadedTiles = new Map();
        this.nextTileIndex = 0; // Which tile position to load next image into
        this.draggedTileIndex = null; // Track which tile is being dragged
        this.selectedTileIndex = null; // Track which tile is selected
        
        // Drag offset state
        this.isDraggingOffset = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragStartOffsetX = 0;
        this.dragStartOffsetY = 0;
        this.dragAnimationId = null;
        this.lastDragUpdateTime = 0;
        this.dragThrottleMs = 16; // ~60fps throttling for WASM updates
        
        // Pinch-to-zoom gesture state
        this.isPinching = false;
        this.touchStartTouches = [];
        this.initialPinchDistance = 0;
        this.initialScale = 1.0;
        this.lastPinchUpdateTime = 0;
        
        // Background color state
        this.backgroundColor = { r: 255, g: 255, b: 255, a: 255 }; // Default white
        
        // Grid overlay state
        this.gridState = 'off'; // 'off', '3x3', or '5x5'
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.start());
        this.stopBtn.addEventListener('click', () => this.stop());
        this.loadImageBtn.addEventListener('click', () => this.fileInput.click());
        this.gridToggleBtn.addEventListener('click', () => this.toggleGrid());
        this.fileInput.addEventListener('change', (e) => this.handleImageLoad(e));
        
        // Add export functionality
        const exportBtn = document.getElementById('export-btn');
        const exportFormat = document.getElementById('export-format');
        exportBtn.addEventListener('click', () => this.exportCanvas(exportFormat.value));
        
        // Add Enter key listeners to grid input fields
        const gridInputs = ['tile-width', 'tile-height', 'num-cols', 'num-rows'];
        gridInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.regenerateGrid();
                }
            });
        });
        
        // Add scale input event listeners
        this.tileScaleInput.addEventListener('change', () => this.updateTileScale());
        this.tileScaleInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.updateTileScale();
            }
        });
        
        // Add offset input event listeners
        this.tileOffsetXInput.addEventListener('change', () => this.updateTileOffset());
        this.tileOffsetXInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.updateTileOffset();
            }
        });
        this.tileOffsetYInput.addEventListener('change', () => this.updateTileOffset());
        this.tileOffsetYInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.updateTileOffset();
            }
        });
        
        // Add background color event listeners
        this.backgroundColorInput.addEventListener('input', () => this.updateBackgroundColor());
        this.backgroundOpacityInput.addEventListener('input', () => this.updateBackgroundOpacity());
        
        // Add canvas event handlers for tile selection and offset dragging
        this.canvas.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleCanvasMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleCanvasMouseLeave(e));
        
        // Add touch event handlers for pinch-to-zoom
        this.canvas.addEventListener('touchstart', (e) => this.handleCanvasTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleCanvasTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.handleCanvasTouchEnd(e));
        
        // Add wheel event handler for trackpad pinch-to-zoom
        this.canvas.addEventListener('wheel', (e) => this.handleCanvasWheel(e));
    }

    // Helper method to calculate grid position from tile index
    getTilePosition(tileIndex) {
        const numCols = parseInt(document.getElementById('num-cols').value);
        const col = tileIndex % numCols;
        const row = Math.floor(tileIndex / numCols);
        return { col, row };
    }

    // Helper method to calculate tile index from grid position
    getTileIndex(col, row) {
        const numCols = parseInt(document.getElementById('num-cols').value);
        return row * numCols + col;
    }

    // Get the next available tile position
    getNextAvailableTileIndex() {
        const numCols = parseInt(document.getElementById('num-cols').value);
        const numRows = parseInt(document.getElementById('num-rows').value);
        const totalTiles = numCols * numRows;

        // Find first empty tile slot
        for (let i = 0; i < totalTiles; i++) {
            if (!this.loadedTiles.has(i)) {
                return i;
            }
        }
        return null; // No available slots
    }
    
    // Handle canvas mouse down for tile selection and drag start
    handleCanvasMouseDown(event) {
        // Don't handle clicks during list tile drag operations
        if (this.draggedTileIndex !== null) {
            return;
        }
        
        // Get mouse coordinates relative to canvas
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        
        // Account for canvas scaling (CSS vs actual canvas size)
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const canvasX = mouseX * scaleX;
        const canvasY = mouseY * scaleY;
        
        // Determine which tile was clicked
        const tileWidth = this.imageBuffer.tile_width;
        const tileHeight = this.imageBuffer.tile_height;
        const col = Math.floor(canvasX / tileWidth);
        const row = Math.floor(canvasY / tileHeight);
        
        // Check if click is within grid bounds
        const numCols = parseInt(document.getElementById('num-cols').value);
        const numRows = parseInt(document.getElementById('num-rows').value);
        if (col >= numCols || row >= numRows || col < 0 || row < 0) {
            return; // Click outside grid
        }
        
        // Find tile at this position
        const clickedTileIndex = this.getTileIndex(col, row);
        
        // Check if there's a loaded tile at this position
        const tileAtPosition = Array.from(this.loadedTiles.entries()).find(([_, tileData]) => {
            return tileData.col === col && tileData.row === row;
        });
        
        if (tileAtPosition) {
            const [tileIndex, tileData] = tileAtPosition;
            
            if (this.selectedTileIndex === tileIndex) {
                // Clicked on already selected tile - start drag
                this.isDraggingOffset = true;
                this.dragStartX = event.clientX;
                this.dragStartY = event.clientY;
                this.dragStartOffsetX = tileData.offsetX || 0;
                this.dragStartOffsetY = tileData.offsetY || 0;
                this.lastDragUpdateTime = Date.now();
                
                // Start drag animation if main animation isn't running
                if (!this.running) {
                    this.startDragAnimation();
                }
                
                // Prevent text selection during drag
                event.preventDefault();
            } else {
                // Clicked on different tile - select it
                this.selectedTileIndex = tileIndex;
                
                // Update visual state of all tiles
                this.updateTileListSelection();
                
                // Update selected tile info in right sidebar
                this.updateSelectedTileInfo();
                
                // Render to show selection
                this.renderSingleFrame();
            }
        } else {
            // Clicked on empty tile - deselect any current selection
            if (this.selectedTileIndex !== null) {
                this.selectedTileIndex = null;
                this.updateTileListSelection();
                this.updateSelectedTileInfo();
                this.renderSingleFrame();
            }
        }
    }

    // Handle mouse move for drag offset updates
    handleCanvasMouseMove(event) {
        if (!this.isDraggingOffset || this.selectedTileIndex === null) {
            return;
        }

        // Calculate mouse delta from drag start
        const deltaX = event.clientX - this.dragStartX;
        const deltaY = event.clientY - this.dragStartY;

        // Calculate new offset values
        const newOffsetX = this.dragStartOffsetX + deltaX;
        const newOffsetY = this.dragStartOffsetY + deltaY;

        // Get current tile dimensions for validation
        const tileWidth = this.imageBuffer.tile_width;
        const tileHeight = this.imageBuffer.tile_height;

        // Clamp offsets to valid range
        const clampedOffsetX = Math.max(-tileWidth, Math.min(tileWidth, newOffsetX));
        const clampedOffsetY = Math.max(-tileHeight, Math.min(tileHeight, newOffsetY));

        // Update tile data in memory
        const tileData = this.loadedTiles.get(this.selectedTileIndex);
        if (tileData) {
            tileData.offsetX = clampedOffsetX;
            tileData.offsetY = clampedOffsetY;

            // Update UI inputs
            this.tileOffsetXInput.value = Math.round(clampedOffsetX);
            this.tileOffsetYInput.value = Math.round(clampedOffsetY);

            // Throttled WASM update for performance
            const now = Date.now();
            if (now - this.lastDragUpdateTime >= this.dragThrottleMs) {
                this.updateTileOffsetInWasm(tileData, clampedOffsetX, clampedOffsetY);
                this.lastDragUpdateTime = now;
            }

            // Always render for smooth visual feedback
            if (!this.running) {
                // Use drag animation loop for smooth updates
                if (this.dragAnimationId === null) {
                    this.startDragAnimation();
                }
            }
        }
    }

    // Handle mouse up to end drag
    handleCanvasMouseUp(event) {
        if (this.isDraggingOffset) {
            this.finalizeDrag();
        }
    }

    // Handle mouse leave to cancel drag
    handleCanvasMouseLeave(event) {
        if (this.isDraggingOffset) {
            this.finalizeDrag();
        }
    }

    // Touch event handlers for pinch-to-zoom
    handleCanvasTouchStart(event) {
        // Only handle if a tile is selected
        if (this.selectedTileIndex === null) {
            return;
        }
        
        // Prevent default touch behavior (scrolling, zooming)
        event.preventDefault();
        
        const touches = Array.from(event.touches);
        
        if (touches.length === 2) {
            // Two fingers - start pinch gesture
            this.isPinching = true;
            this.touchStartTouches = touches.map(touch => ({
                x: touch.clientX,
                y: touch.clientY
            }));
            
            // Calculate initial distance between fingers
            this.initialPinchDistance = this.calculateTouchDistance(touches[0], touches[1]);
            
            // Store current scale
            const tileData = this.loadedTiles.get(this.selectedTileIndex);
            this.initialScale = tileData ? tileData.scale : 1.0;
            
            console.log(`Pinch started: distance=${this.initialPinchDistance}, scale=${this.initialScale}`);
        }
    }

    handleCanvasTouchMove(event) {
        if (!this.isPinching || this.selectedTileIndex === null) {
            return;
        }
        
        // Prevent default touch behavior
        event.preventDefault();
        
        const touches = Array.from(event.touches);
        
        if (touches.length === 2) {
            // Calculate current distance between fingers
            const currentDistance = this.calculateTouchDistance(touches[0], touches[1]);
            
            // Calculate scale factor
            const scaleFactor = currentDistance / this.initialPinchDistance;
            const newScale = Math.max(0.1, Math.min(5.0, this.initialScale * scaleFactor));
            
            // Throttle updates for performance
            const now = Date.now();
            if (now - this.lastPinchUpdateTime >= this.dragThrottleMs) {
                this.applyPinchScale(newScale);
                this.lastPinchUpdateTime = now;
            }
        }
    }

    handleCanvasTouchEnd(event) {
        // Prevent default touch behavior
        event.preventDefault();
        
        const touches = Array.from(event.touches);
        
        if (touches.length < 2) {
            // End pinch gesture when less than 2 fingers remain
            if (this.isPinching) {
                console.log(`Pinch ended`);
                this.isPinching = false;
                this.touchStartTouches = [];
                
                // Apply final scale update
                const tileData = this.loadedTiles.get(this.selectedTileIndex);
                if (tileData) {
                    this.updateTileScaleValue(Math.round(tileData.scale * 100));
                }
            }
        }
    }

    // Wheel event handler for trackpad pinch-to-zoom
    handleCanvasWheel(event) {
        // Only handle if a tile is selected and it's a pinch gesture (Ctrl+wheel)
        if (this.selectedTileIndex === null || !event.ctrlKey) {
            return;
        }
        
        // Prevent default browser zoom
        event.preventDefault();
        
        const tileData = this.loadedTiles.get(this.selectedTileIndex);
        if (!tileData) return;
        
        // Calculate scale change from wheel delta
        const scaleFactor = 1 - (event.deltaY * 0.01); // Adjust sensitivity
        const newScale = Math.max(0.1, Math.min(5.0, tileData.scale * scaleFactor));
        
        // Apply scale change
        this.applyPinchScale(newScale);
        this.updateTileScaleValue(Math.round(newScale * 100));
    }

    // Helper method to calculate distance between two touch points
    calculateTouchDistance(touch1, touch2) {
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Helper method to apply scale from pinch gesture
    async applyPinchScale(newScale) {
        if (this.selectedTileIndex === null || !this.loadedTiles.has(this.selectedTileIndex)) {
            return;
        }
        
        const tileData = this.loadedTiles.get(this.selectedTileIndex);
        
        try {
            // Update scale in tile data
            tileData.scale = newScale;
            
            // Reload image with new scale and existing offsets
            await this.imageBuffer.load_image_from_bytes_with_scale_and_offset(
                tileData.imageData, 
                tileData.col, 
                tileData.row, 
                newScale,
                tileData.offsetX || 0,
                tileData.offsetY || 0
            );
            
            // Render to show updated scale
            if (!this.running) {
                this.renderSingleFrame();
            }
        } catch (error) {
            console.error('Failed to apply pinch scale:', error);
        }
    }

    // Helper method to update scale input value
    updateTileScaleValue(scalePercent) {
        if (this.tileScaleInput) {
            this.tileScaleInput.value = scalePercent;
        }
    }

    // Convert hex color to RGB values
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    // Update background color from color picker
    updateBackgroundColor() {
        const hexColor = this.backgroundColorInput.value;
        const rgb = this.hexToRgb(hexColor);
        
        if (rgb) {
            this.backgroundColor.r = rgb.r;
            this.backgroundColor.g = rgb.g;
            this.backgroundColor.b = rgb.b;
            
            // Update hex display
            this.backgroundColorHex.textContent = hexColor.toUpperCase();
            
            // Apply background color to WASM
            this.applyBackgroundColorToWasm();
            
            console.log(`Background color updated to ${hexColor} (${rgb.r}, ${rgb.g}, ${rgb.b}, ${this.backgroundColor.a})`);
        }
    }

    // Update background opacity from slider
    updateBackgroundOpacity() {
        const opacityPercent = parseInt(this.backgroundOpacityInput.value);
        this.backgroundColor.a = Math.round((opacityPercent / 100) * 255);
        
        // Update opacity display
        this.backgroundOpacityValue.textContent = `${opacityPercent}%`;
        
        // Apply background color to WASM
        this.applyBackgroundColorToWasm();
        
        console.log(`Background opacity updated to ${opacityPercent}% (alpha: ${this.backgroundColor.a})`);
    }

    // Apply current background color to WASM and refresh affected areas
    async applyBackgroundColorToWasm() {
        if (!this.imageBuffer) return;
        
        // Set the background color in WASM
        this.imageBuffer.set_background_color(
            this.backgroundColor.r,
            this.backgroundColor.g,
            this.backgroundColor.b,
            this.backgroundColor.a
        );
        
        // Reload all tiles to apply the new background color
        await this.reloadAllTiles();
        
        // Render to show the changes
        if (!this.running) {
            this.renderSingleFrame();
        }
    }

    // Reload all loaded tiles to apply new background color
    async reloadAllTiles() {
        for (const [tileIndex, tileData] of this.loadedTiles) {
            try {
                await this.imageBuffer.load_image_from_bytes_with_scale_and_offset(
                    tileData.imageData,
                    tileData.col,
                    tileData.row,
                    tileData.scale || 1.0,
                    tileData.offsetX || 0,
                    tileData.offsetY || 0
                );
            } catch (error) {
                console.error(`Failed to reload tile at (${tileData.col}, ${tileData.row}):`, error);
            }
        }
    }

    toggleGrid() {
        const states = ['off', '3x3', '5x5'];
        const currentIndex = states.indexOf(this.gridState);
        this.gridState = states[(currentIndex + 1) % states.length];
        this.gridToggleBtn.textContent = `Grid: ${this.gridState}`;
        
        // Redraw canvas with new grid state
        this.renderSingleFrame();
    }

    async handleImageLoad(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (!file.type.match(/^image\/(jpeg|png)$/)) {
            alert('Please select a JPEG or PNG image.');
            return;
        }
        
        // Find next available tile position
        const tileIndex = this.getNextAvailableTileIndex();
        if (tileIndex === null) {
            alert('All tile positions are full. Remove a tile first.');
            return;
        }
        
        try {
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            const { col, row } = this.getTilePosition(tileIndex);
            
            // Load image into Rust at specific tile position
            await this.imageBuffer.load_image_from_bytes(uint8Array, col, row);
            
            // Store tile data
            this.loadedTiles.set(tileIndex, {
                fileName: file.name,
                imageData: uint8Array,
                tileIndex: tileIndex,
                col: col,
                row: row,
                scale: 1.0, // Default scale 100%
                offsetX: 0, // Default offset X 0px
                offsetY: 0  // Default offset Y 0px
            });
            
            // Update tile list display
            this.updateTileList();
            
            // Render immediately to show the loaded image
            this.renderSingleFrame();
            
            console.log(`Image loaded successfully at tile position (${col}, ${row})`);
        } catch (error) {
            console.error('Failed to load image:', error);
            alert('Failed to load image: ' + error.message);
        }
    }

    async initialize() {
        try {
            this.wasmModule = await init();
            this.imageBuffer = new ImageBuffer(400, 400, 2, 2);
            
            // Initialize background color in WASM
            this.imageBuffer.set_background_color(
                this.backgroundColor.r,
                this.backgroundColor.g,
                this.backgroundColor.b,
                this.backgroundColor.a
            );
            
            // Initialize tile list display
            this.updateTileList();
            
            // Hide FPS and frame counter initially (shown only when animation starts)
            this.fpsElement.style.display = 'none';
            this.frameCountElement.style.display = 'none';
            
            // Render initial frame to show default pattern
            this.renderSingleFrame();
            
            console.log('WebAssembly module loaded successfully');
        } catch (error) {
            console.error('Failed to load WebAssembly module:', error);
            throw error;
        }
    }

    async regenerateGrid() {
        try {
            // Read current values from input fields
            const tileWidth = parseInt(document.getElementById('tile-width').value);
            const tileHeight = parseInt(document.getElementById('tile-height').value);
            const numCols = parseInt(document.getElementById('num-cols').value);
            const numRows = parseInt(document.getElementById('num-rows').value);
            
            // Validate inputs
            if (tileWidth <= 0 || tileHeight <= 0 || numCols <= 0 || numRows <= 0) {
                alert('All grid values must be positive integers');
                return;
            }
            
            // Stop animation if running
            const wasRunning = this.running;
            if (this.running) {
                this.stop();
            }
            
            // Create new ImageBuffer with new dimensions
            this.imageBuffer = new ImageBuffer(tileWidth, tileHeight, numCols, numRows);
            
            // Initialize background color in new WASM buffer
            this.imageBuffer.set_background_color(
                this.backgroundColor.r,
                this.backgroundColor.g,
                this.backgroundColor.b,
                this.backgroundColor.a
            );
            
            // Update canvas size to match new total dimensions
            const totalWidth = tileWidth * numCols;
            const totalHeight = tileHeight * numRows;
            this.canvas.width = totalWidth;
            this.canvas.height = totalHeight;
            
            // Reload all tiles that were previously loaded
            const tilesToReload = [];
            for (const [tileIndex, tileData] of this.loadedTiles) {
                const { col, row } = this.getTilePosition(tileIndex);
                // Check if this tile position is still valid in the new grid
                if (col < numCols && row < numRows) {
                    tilesToReload.push({ tileIndex, tileData, col, row });
                }
            }
            
            // Clear tiles that no longer fit
            this.loadedTiles.clear();
            
            // Reload valid tiles
            for (const { tileIndex, tileData, col, row } of tilesToReload) {
                try {
                    await this.imageBuffer.load_image_from_bytes_with_scale_and_offset(
                        tileData.imageData, 
                        col, 
                        row, 
                        tileData.scale || 1.0,
                        tileData.offsetX || 0,
                        tileData.offsetY || 0
                    );
                    // Update tile data with potentially new position
                    this.loadedTiles.set(tileIndex, {
                        ...tileData,
                        col: col,
                        row: row
                    });
                } catch (error) {
                    console.error(`Failed to reload tile at (${col}, ${row}):`, error);
                }
            }
            
            // Status updates removed to free up right sidebar
            
            // Update offset input ranges if a tile is selected (tile dimensions may have changed)
            if (this.selectedTileIndex !== null && this.loadedTiles.has(this.selectedTileIndex)) {
                this.updateSelectedTileInfo();
            }
            
            // Restart animation if it was running, otherwise render single frame
            if (wasRunning) {
                this.start();
            } else {
                // Show the updated grid immediately if not animating
                this.renderSingleFrame();
            }
            
            console.log(`Grid regenerated: ${tileWidth}x${tileHeight} tiles, ${numCols}x${numRows} grid`);
        } catch (error) {
            console.error('Failed to regenerate grid:', error);
            alert('Failed to regenerate grid: ' + error.message);
        }
    }

    async swapTiles(draggedIndex, targetIndex) {
        if (draggedIndex === targetIndex) {
            return; // No swap needed
        }

        // Get both tile data
        const draggedTile = this.loadedTiles.get(draggedIndex);
        const targetTile = this.loadedTiles.get(targetIndex);

        if (!draggedTile || !targetTile) {
            console.error('Invalid tile indices for swap:', draggedIndex, targetIndex);
            return;
        }

        // Swap their grid positions (col, row)
        const tempCol = draggedTile.col;
        const tempRow = draggedTile.row;
        draggedTile.col = targetTile.col;
        draggedTile.row = targetTile.row;
        targetTile.col = tempCol;
        targetTile.row = tempRow;

        try {
            // Clear both tiles in Rust
            await this.imageBuffer.clear_tile(draggedTile.col, draggedTile.row);
            await this.imageBuffer.clear_tile(targetTile.col, targetTile.row);

            // Reload both tiles in their new positions with their scales and offsets
            await this.imageBuffer.load_image_from_bytes_with_scale_and_offset(
                draggedTile.imageData, 
                draggedTile.col, 
                draggedTile.row, 
                draggedTile.scale || 1.0,
                draggedTile.offsetX || 0,
                draggedTile.offsetY || 0
            );
            await this.imageBuffer.load_image_from_bytes_with_scale_and_offset(
                targetTile.imageData, 
                targetTile.col, 
                targetTile.row, 
                targetTile.scale || 1.0,
                targetTile.offsetX || 0,
                targetTile.offsetY || 0
            );

            // Update the tile list display
            this.updateTileList();

            // Render to show the swapped positions
            this.renderSingleFrame();

            console.log(`Swapped tiles: (${tempCol},${tempRow}) ↔ (${draggedTile.col},${draggedTile.row})`);
        } catch (error) {
            console.error('Error swapping tiles:', error);
            // Revert position swap on error
            draggedTile.col = tempCol;
            draggedTile.row = tempRow;
            targetTile.col = tempCol;
            targetTile.row = tempRow;
        }
    }

    updateTileList() {
        this.tileList.innerHTML = '';
        
        if (this.loadedTiles.size > 0) {
            // Sort tiles by index for consistent display order
            const sortedTiles = Array.from(this.loadedTiles.entries()).sort((a, b) => a[0] - b[0]);
            
            for (const [tileIndex, tileData] of sortedTiles) {
                const listItem = document.createElement('li');
                listItem.className = 'tile-item';
                listItem.draggable = true;
                listItem.dataset.tileIndex = tileIndex;
                
                // Add drag handle
                const dragHandle = document.createElement('span');
                dragHandle.className = 'tile-drag-handle';
                dragHandle.innerHTML = '⋮⋮';
                dragHandle.title = 'Drag to reorder';
                
                const tileName = document.createElement('span');
                tileName.className = 'tile-name';
                tileName.textContent = `${tileData.fileName} (${tileData.col},${tileData.row})`;
                tileName.title = `${tileData.fileName} at tile position (${tileData.col}, ${tileData.row})`; // Show full info on hover
                
                const removeBtn = document.createElement('button');
                removeBtn.className = 'tile-remove';
                removeBtn.innerHTML = '×';
                removeBtn.title = 'Remove tile';
                removeBtn.addEventListener('click', () => this.removeTile(tileIndex));
                
                // Add click event listener for selection
                listItem.addEventListener('click', (e) => {
                    // Don't select if clicking drag handle or remove button
                    if (e.target.classList.contains('tile-drag-handle') || 
                        e.target.classList.contains('tile-remove')) {
                        return;
                    }
                    
                    // Don't select during drag operations
                    if (this.draggedTileIndex !== null) {
                        return;
                    }
                    
                    // Toggle selection
                    const clickedIndex = parseInt(listItem.dataset.tileIndex);
                    if (this.selectedTileIndex === clickedIndex) {
                        this.selectedTileIndex = null; // Deselect
                    } else {
                        this.selectedTileIndex = clickedIndex; // Select
                    }
                    
                    // Update visual state of all tiles
                    this.updateTileListSelection();
                    
                    // Update selected tile info in right sidebar
                    this.updateSelectedTileInfo();
                    
                    // Render to show/hide selection
                    this.renderSingleFrame();
                });
                
                // Add drag event listeners
                listItem.addEventListener('dragstart', (e) => {
                    this.draggedTileIndex = parseInt(e.target.dataset.tileIndex);
                    e.target.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', ''); // Required for Firefox
                });
                
                listItem.addEventListener('dragend', (e) => {
                    e.target.classList.remove('dragging');
                    this.draggedTileIndex = null;
                    // Remove drag-over class from all items
                    document.querySelectorAll('.tile-item').forEach(item => {
                        item.classList.remove('drag-over');
                    });
                });
                
                listItem.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                });
                
                listItem.addEventListener('dragenter', (e) => {
                    e.preventDefault();
                    if (this.draggedTileIndex !== null && 
                        parseInt(e.target.closest('.tile-item').dataset.tileIndex) !== this.draggedTileIndex) {
                        e.target.closest('.tile-item').classList.add('drag-over');
                    }
                });
                
                listItem.addEventListener('dragleave', (e) => {
                    e.target.closest('.tile-item').classList.remove('drag-over');
                });
                
                listItem.addEventListener('drop', (e) => {
                    e.preventDefault();
                    const targetIndex = parseInt(e.target.closest('.tile-item').dataset.tileIndex);
                    if (this.draggedTileIndex !== null && targetIndex !== this.draggedTileIndex) {
                        this.swapTiles(this.draggedTileIndex, targetIndex);
                    }
                    e.target.closest('.tile-item').classList.remove('drag-over');
                });
                
                listItem.appendChild(dragHandle);
                listItem.appendChild(tileName);
                listItem.appendChild(removeBtn);
                this.tileList.appendChild(listItem);
                
                // Update selection visual state
                if (this.selectedTileIndex === tileIndex) {
                    listItem.classList.add('selected');
                }
            }
        } else {
            const emptyMessage = document.createElement('li');
            emptyMessage.className = 'tile-list-empty';
            emptyMessage.textContent = 'No tiles loaded';
            this.tileList.appendChild(emptyMessage);
        }
        
        // Update interaction help text when tile list changes
        this.updateInteractionHelp();
    }

    updateTileListSelection() {
        // Update selection visual state for all tile items
        const tileItems = document.querySelectorAll('.tile-item');
        tileItems.forEach(item => {
            const itemIndex = parseInt(item.dataset.tileIndex);
            if (this.selectedTileIndex === itemIndex) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    updateSelectedTileInfo() {
        if (this.selectedTileIndex === null || !this.loadedTiles.has(this.selectedTileIndex)) {
            this.selectedTileInfo.innerHTML = '<em>No tile selected</em>';
            this.scaleControl.style.display = 'none';
            this.offsetControls.style.display = 'none';
        } else {
            const tileData = this.loadedTiles.get(this.selectedTileIndex);
            this.selectedTileInfo.textContent = `Selected: ${tileData.fileName}`;
            this.scaleControl.style.display = 'block';
            this.offsetControls.style.display = 'block';
            this.tileScaleInput.value = Math.round(tileData.scale * 100);
            this.tileOffsetXInput.value = tileData.offsetX || 0;
            this.tileOffsetYInput.value = tileData.offsetY || 0;
            
            // Update offset input ranges based on current tile dimensions
            const tileWidth = this.imageBuffer.tile_width;
            const tileHeight = this.imageBuffer.tile_height;
            this.tileOffsetXInput.setAttribute('min', `-${tileWidth}`);
            this.tileOffsetXInput.setAttribute('max', `${tileWidth}`);
            this.tileOffsetYInput.setAttribute('min', `-${tileHeight}`);
            this.tileOffsetYInput.setAttribute('max', `${tileHeight}`);
        }
        
        // Update interaction help text whenever tile selection changes
        this.updateInteractionHelp();
    }

    updateInteractionHelp() {
        const hasTiles = this.loadedTiles.size > 0;
        const hasSelection = this.selectedTileIndex !== null && this.loadedTiles.has(this.selectedTileIndex);
        
        if (!hasTiles) {
            // No tiles loaded - hide help text
            this.interactionHelp.style.display = 'none';
        } else if (!hasSelection) {
            // Tiles loaded but nothing selected
            this.interactionHelp.textContent = 'Click to select tile';
            this.interactionHelp.style.display = 'block';
        } else {
            // Tile is selected
            this.interactionHelp.textContent = 'Click and drag to pan image. Pinch to zoom.';
            this.interactionHelp.style.display = 'block';
        }
    }

    // Helper method to update tile offset in WASM (throttled during drag)
    async updateTileOffsetInWasm(tileData, offsetX, offsetY) {
        try {
            await this.imageBuffer.load_image_from_bytes_with_scale_and_offset(
                tileData.imageData, 
                tileData.col, 
                tileData.row, 
                tileData.scale || 1.0,
                offsetX,
                offsetY
            );
            
            // Render to show updated offset
            if (!this.running && this.dragAnimationId === null) {
                this.renderSingleFrame();
            }
        } catch (error) {
            console.error('Failed to update tile offset in WASM:', error);
        }
    }

    // Start drag animation loop for smooth updates when main animation isn't running
    startDragAnimation() {
        if (this.dragAnimationId !== null) {
            return; // Already running
        }
        
        const animate = () => {
            if (this.isDraggingOffset || (this.selectedTileIndex !== null && !this.running)) {
                // Use frame 0 for static background pattern
                this.drawFrameWithStaticBackground();
                
                // Use dynamic frame for marching ants animation
                const animationFrame = Date.now() * 0.1;
                this.drawMarchingAnts(animationFrame);
                
                this.dragAnimationId = requestAnimationFrame(animate);
            } else {
                this.dragAnimationId = null;
            }
        };
        
        this.dragAnimationId = requestAnimationFrame(animate);
    }

    // Stop drag animation loop
    stopDragAnimation() {
        if (this.dragAnimationId !== null) {
            cancelAnimationFrame(this.dragAnimationId);
            this.dragAnimationId = null;
        }
    }

    // Finalize drag operation
    async finalizeDrag() {
        if (!this.isDraggingOffset) {
            return;
        }

        this.isDraggingOffset = false;
        
        // Final WASM update with exact values
        const tileData = this.loadedTiles.get(this.selectedTileIndex);
        if (tileData) {
            await this.updateTileOffsetInWasm(tileData, tileData.offsetX, tileData.offsetY);
            console.log(`Drag completed: Tile offset updated to (${tileData.offsetX}, ${tileData.offsetY}) for tile at (${tileData.col}, ${tileData.row})`);
        }

        // Stop drag animation if main animation isn't running
        if (!this.running) {
            this.stopDragAnimation();
            // Start selection animation for marching ants
            if (this.selectedTileIndex !== null) {
                this.startSelectionAnimation();
            }
        }
    }

    async updateTileScale() {
        if (this.selectedTileIndex === null || !this.loadedTiles.has(this.selectedTileIndex)) {
            return;
        }

        const newScalePercent = parseInt(this.tileScaleInput.value);
        if (isNaN(newScalePercent) || newScalePercent < 10 || newScalePercent > 500) {
            alert('Scale must be between 10% and 500%');
            // Reset to current scale
            const tileData = this.loadedTiles.get(this.selectedTileIndex);
            this.tileScaleInput.value = Math.round(tileData.scale * 100);
            return;
        }

        const newScale = newScalePercent / 100;
        const tileData = this.loadedTiles.get(this.selectedTileIndex);
        
        if (Math.abs(tileData.scale - newScale) < 0.01) {
            return; // No significant change
        }

        try {
            // Update scale in tile data
            tileData.scale = newScale;

            // Reload image with new scale and existing offsets
            await this.imageBuffer.load_image_from_bytes_with_scale_and_offset(
                tileData.imageData, 
                tileData.col, 
                tileData.row, 
                newScale,
                tileData.offsetX || 0,
                tileData.offsetY || 0
            );

            // Render to show updated scale
            this.renderSingleFrame();

            console.log(`Tile scale updated to ${newScalePercent}% for tile at (${tileData.col}, ${tileData.row})`);
        } catch (error) {
            console.error('Failed to update tile scale:', error);
            alert('Failed to update tile scale: ' + error.message);
            
            // Reset to previous scale
            const tileData = this.loadedTiles.get(this.selectedTileIndex);
            this.tileScaleInput.value = Math.round(tileData.scale * 100);
        }
    }

    async updateTileOffset() {
        if (this.selectedTileIndex === null || !this.loadedTiles.has(this.selectedTileIndex)) {
            return;
        }

        const newOffsetX = parseInt(this.tileOffsetXInput.value);
        const newOffsetY = parseInt(this.tileOffsetYInput.value);
        
        // Get current tile dimensions for validation
        const tileWidth = this.imageBuffer.tile_width;
        const tileHeight = this.imageBuffer.tile_height;
        
        if (isNaN(newOffsetX) || isNaN(newOffsetY) || 
            newOffsetX < -tileWidth || newOffsetX > tileWidth || 
            newOffsetY < -tileHeight || newOffsetY > tileHeight) {
            alert(`Offset must be between -${tileWidth}px and ${tileWidth}px for X, and -${tileHeight}px and ${tileHeight}px for Y`);
            // Reset to current offsets
            const tileData = this.loadedTiles.get(this.selectedTileIndex);
            this.tileOffsetXInput.value = tileData.offsetX || 0;
            this.tileOffsetYInput.value = tileData.offsetY || 0;
            return;
        }

        const tileData = this.loadedTiles.get(this.selectedTileIndex);
        
        if (tileData.offsetX === newOffsetX && tileData.offsetY === newOffsetY) {
            return; // No change
        }

        try {
            // Update offsets in tile data
            tileData.offsetX = newOffsetX;
            tileData.offsetY = newOffsetY;

            // Reload image with new offsets and existing scale
            await this.imageBuffer.load_image_from_bytes_with_scale_and_offset(
                tileData.imageData, 
                tileData.col, 
                tileData.row, 
                tileData.scale || 1.0,
                newOffsetX,
                newOffsetY
            );

            // Render to show updated offset
            this.renderSingleFrame();

            console.log(`Tile offset updated to (${newOffsetX}, ${newOffsetY}) for tile at (${tileData.col}, ${tileData.row})`);
        } catch (error) {
            console.error('Failed to update tile offset:', error);
            alert('Failed to update tile offset: ' + error.message);
            
            // Reset to previous offsets
            const tileData = this.loadedTiles.get(this.selectedTileIndex);
            this.tileOffsetXInput.value = tileData.offsetX || 0;
            this.tileOffsetYInput.value = tileData.offsetY || 0;
        }
    }

    async removeTile(tileIndex) {
        if (!this.loadedTiles.has(tileIndex)) {
            console.error('Attempted to remove non-existent tile:', tileIndex);
            return;
        }
        
        const tileData = this.loadedTiles.get(tileIndex);
        
        // Clear selection if this tile was selected
        if (this.selectedTileIndex === tileIndex) {
            this.selectedTileIndex = null;
            this.updateSelectedTileInfo();
        }
        
        // Remove tile from our data structure
        this.loadedTiles.delete(tileIndex);
        
        // Clear the specific tile in the Rust ImageBuffer
        await this.imageBuffer.clear_tile(tileData.col, tileData.row);
        
        // Status updates removed to free up right sidebar
        
        // Update tile list display
        this.updateTileList();
        
        // Render single frame to show updated pattern
        this.renderSingleFrame();
        
        console.log(`Tile removed successfully from position (${tileData.col}, ${tileData.row})`);
    }

    exportCanvas(format) {
        // Temporarily remove marching ants and grid for clean export
        const originalSelection = this.selectedTileIndex;
        const originalGridState = this.gridState;
        this.selectedTileIndex = null;
        this.gridState = 'off';
        
        // Redraw canvas without marching ants and grid
        this.drawFrameWithStaticBackground();
        
        // Get the canvas element
        const canvas = this.canvas;
        
        // Convert to desired format
        const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
        const quality = format === 'png' ? 1.0 : 0.9; // High quality for JPEG
        
        // Convert canvas to blob
        canvas.toBlob((blob) => {
            // Create download link
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            
            // Generate filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const filename = `tile-export-${timestamp}.${format === 'jpeg' ? 'jpg' : format}`;
            
            // Trigger download
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up
            URL.revokeObjectURL(url);
            
            console.log(`Canvas exported as ${filename}`);
            
            // Restore selection and grid state, then redraw if needed
            this.selectedTileIndex = originalSelection;
            this.gridState = originalGridState;
            if (originalSelection !== null) {
                if (this.running) {
                    // Let the main animation loop handle the redraw
                } else {
                    // Restart selection animation for static mode
                    this.startSelectionAnimation();
                }
            } else {
                // Just redraw to restore grid if there was no selection
                this.renderSingleFrame();
            }
        }, mimeType, quality);
    }

    start() {
        if (this.running) return;
        
        // Stop selection and drag animations since main animation will handle everything
        this.stopSelectionAnimation();
        this.stopDragAnimation();
        
        this.running = true;
        this.startBtn.disabled = true;
        this.stopBtn.disabled = false;
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.frameTimeBuffer = [];
        
        // Show FPS and frame counter when animation starts
        this.fpsElement.style.display = 'block';
        this.frameCountElement.style.display = 'block';
        
        this.render();
    }

    stop() {
        this.running = false;
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        
        // Hide FPS and frame counter when animation stops
        this.fpsElement.style.display = 'none';
        this.frameCountElement.style.display = 'none';
        
        // Restart selection animation if a tile is selected and not dragging
        if (this.selectedTileIndex !== null && !this.isDraggingOffset) {
            this.startSelectionAnimation();
        } else if (this.isDraggingOffset) {
            // Start drag animation for smooth dragging when main animation stops
            this.startDragAnimation();
        }
    }

    calculateFPS(currentTime) {
        if (this.lastTime === 0) {
            this.lastTime = currentTime;
            return;
        }
        
        const deltaTime = currentTime - this.lastTime;
        this.frameTimeBuffer.push(deltaTime);
        
        if (this.frameTimeBuffer.length > this.maxFrameTimeBuffer) {
            this.frameTimeBuffer.shift();
        }
        
        const averageDelta = this.frameTimeBuffer.reduce((a, b) => a + b, 0) / this.frameTimeBuffer.length;
        this.fps = Math.round(1000 / averageDelta);
        
        this.lastTime = currentTime;
    }

    drawFrame(frameNumber = this.frameCount) {
        // Generate new pattern in Rust
        this.imageBuffer.generate_pattern(frameNumber);
        
        // Get WASM memory buffer
        const wasmMemory = this.wasmModule.memory;
        const dataPtr = this.imageBuffer.data_ptr();
        const dataLen = this.imageBuffer.data_len();
        
        // Create ImageData from WASM memory
        const uint8Array = new Uint8ClampedArray(wasmMemory.buffer, dataPtr, dataLen);
        const imageData = new ImageData(uint8Array, this.imageBuffer.width, this.imageBuffer.height);
        
        // Draw to canvas
        this.ctx.putImageData(imageData, 0, 0);
        
        // Draw grid overlay
        this.drawGrid();
        
        // Draw marching ants selection if a tile is selected
        if (this.selectedTileIndex !== null) {
            this.drawMarchingAnts(frameNumber);
        }
    }

    drawFrameWithStaticBackground() {
        // Fill with solid background color instead of animated pattern
        this.imageBuffer.fill_background();
        
        // Get WASM memory buffer
        const wasmMemory = this.wasmModule.memory;
        const dataPtr = this.imageBuffer.data_ptr();
        const dataLen = this.imageBuffer.data_len();
        
        // Create ImageData from WASM memory
        const uint8Array = new Uint8ClampedArray(wasmMemory.buffer, dataPtr, dataLen);
        const imageData = new ImageData(uint8Array, this.imageBuffer.width, this.imageBuffer.height);
        
        // Draw to canvas
        this.ctx.putImageData(imageData, 0, 0);
        
        // Draw grid overlay
        this.drawGrid();
        
        // Note: marching ants will be drawn separately in the animation loop
    }

    drawMarchingAnts(animationFrame = 0) {
        if (this.selectedTileIndex === null || !this.loadedTiles.has(this.selectedTileIndex)) {
            return;
        }
        
        const tileData = this.loadedTiles.get(this.selectedTileIndex);
        const tileWidth = this.imageBuffer.tile_width;
        const tileHeight = this.imageBuffer.tile_height;
        
        // Calculate tile position on canvas
        const tileX = tileData.col * tileWidth;
        const tileY = tileData.row * tileHeight;
        
        // Save canvas state
        this.ctx.save();
        
        // Set up marching ants style
        const dashLength = 8;
        const dashOffset = -(animationFrame * 0.5) % (dashLength * 2); // Animate dash offset
        
        this.ctx.setLineDash([dashLength, dashLength]);
        this.ctx.lineDashOffset = dashOffset;
        this.ctx.lineWidth = 2;
        
        // Draw white border (outer)
        this.ctx.strokeStyle = 'white';
        this.ctx.strokeRect(tileX - 1, tileY - 1, tileWidth + 2, tileHeight + 2);
        
        // Draw black border (inner) with opposite phase
        this.ctx.lineDashOffset = dashOffset + dashLength;
        this.ctx.strokeStyle = 'black';
        this.ctx.strokeRect(tileX - 1, tileY - 1, tileWidth + 2, tileHeight + 2);
        
        // Restore canvas state
        this.ctx.restore();
    }

    drawGrid() {
        if (this.gridState === 'off' || !this.imageBuffer) {
            return;
        }
        
        // Save canvas state
        this.ctx.save();
        
        const tileWidth = this.imageBuffer.tile_width;
        const tileHeight = this.imageBuffer.tile_height;
        const numCols = parseInt(document.getElementById('num-cols').value);
        const numRows = parseInt(document.getElementById('num-rows').value);
        
        // Set grid line style
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([]);
        
        const gridDivisions = this.gridState === '3x3' ? 3 : 5;
        const cellWidth = tileWidth / gridDivisions;
        const cellHeight = tileHeight / gridDivisions;
        
        // Draw grid lines for each tile
        for (let tileRow = 0; tileRow < numRows; tileRow++) {
            for (let tileCol = 0; tileCol < numCols; tileCol++) {
                const tileStartX = tileCol * tileWidth;
                const tileStartY = tileRow * tileHeight;
                
                // Draw tile boundary lines (top and left edges)
                // Top edge of tile
                this.ctx.beginPath();
                this.ctx.moveTo(tileStartX, tileStartY);
                this.ctx.lineTo(tileStartX + tileWidth, tileStartY);
                this.ctx.stroke();
                
                // Left edge of tile
                this.ctx.beginPath();
                this.ctx.moveTo(tileStartX, tileStartY);
                this.ctx.lineTo(tileStartX, tileStartY + tileHeight);
                this.ctx.stroke();
                
                // Draw vertical grid lines within this tile
                for (let i = 1; i < gridDivisions; i++) {
                    const x = tileStartX + i * cellWidth;
                    this.ctx.beginPath();
                    this.ctx.moveTo(x, tileStartY);
                    this.ctx.lineTo(x, tileStartY + tileHeight);
                    this.ctx.stroke();
                }
                
                // Draw horizontal grid lines within this tile
                for (let i = 1; i < gridDivisions; i++) {
                    const y = tileStartY + i * cellHeight;
                    this.ctx.beginPath();
                    this.ctx.moveTo(tileStartX, y);
                    this.ctx.lineTo(tileStartX + tileWidth, y);
                    this.ctx.stroke();
                }
            }
        }
        
        // Restore canvas state
        this.ctx.restore();
    }

    renderSingleFrame() {
        // Render a single frame without starting animation loop
        // Use solid background instead of animated pattern when stopped
        this.drawFrameWithStaticBackground();
        
        // Draw marching ants for selected tile if any
        if (this.selectedTileIndex !== null) {
            this.drawMarchingAnts(0); // Use frame 0 for static marching ants
        }
        
        // Start marching ants animation if a tile is selected and main animation isn't running
        if (this.selectedTileIndex !== null && !this.running) {
            this.startSelectionAnimation();
        } else if (this.selectedTileIndex === null && this.selectionAnimationId !== null) {
            this.stopSelectionAnimation();
        }
    }

    startSelectionAnimation() {
        if (this.selectionAnimationId !== null) {
            return; // Already running
        }
        
        const animate = () => {
            if (this.selectedTileIndex !== null && !this.running) {
                // Use frame 0 for static background pattern
                this.drawFrameWithStaticBackground();
                
                // Use dynamic frame for marching ants animation
                const animationFrame = Date.now() * 0.1;
                this.drawMarchingAnts(animationFrame);
                
                this.selectionAnimationId = requestAnimationFrame(animate);
            } else {
                this.selectionAnimationId = null;
            }
        };
        
        this.selectionAnimationId = requestAnimationFrame(animate);
    }

    stopSelectionAnimation() {
        if (this.selectionAnimationId !== null) {
            cancelAnimationFrame(this.selectionAnimationId);
            this.selectionAnimationId = null;
        }
    }

    render(currentTime = performance.now()) {
        if (!this.running) return;

        this.calculateFPS(currentTime);
        
        // Draw the current frame
        this.drawFrame();
        
        // Update stats
        this.frameCount++;
        this.fpsElement.textContent = `FPS: ${this.fps}`;
        this.frameCountElement.textContent = `Frame: ${this.frameCount}`;
        
        // Continue the loop
        requestAnimationFrame((time) => this.render(time));
    }
}

// Initialize and start the application
async function main() {
    try {
        const renderLoop = new RenderLoop();
        await renderLoop.initialize();
        
        // Expose renderLoop globally for testing
        window.renderLoop = renderLoop;
        
        console.log('Application ready. Click Start to begin rendering.');
    } catch (error) {
        console.error('Failed to initialize application:', error);
        document.querySelector('.main-layout').innerHTML = 
            '<h1>Error</h1><p>Failed to load WebAssembly module. Please check the console for details.</p>';
    }
}

main();