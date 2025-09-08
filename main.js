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
        this.fileInput = document.getElementById('file-input');
        this.imageStatus = document.getElementById('image-status');
        this.tileList = document.getElementById('tile-list');
        
        this.running = false;
        this.frameCount = 0;
        this.lastTime = 0;
        this.fps = 0;
        this.frameTimeBuffer = [];
        this.maxFrameTimeBuffer = 60;
        
        this.imageBuffer = null;
        this.wasmModule = null;
        
        // Store multiple tile data - Map with tile index as key
        this.loadedTiles = new Map();
        this.nextTileIndex = 0; // Which tile position to load next image into
        this.draggedTileIndex = null; // Track which tile is being dragged
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.start());
        this.stopBtn.addEventListener('click', () => this.stop());
        this.loadImageBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleImageLoad(e));
        
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
            this.imageStatus.textContent = 'Loading image...';
            
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
                row: row
            });
            
            const tileWidth = this.imageBuffer.tile_width;
            const tileHeight = this.imageBuffer.tile_height;
            this.imageStatus.textContent = `Loaded: ${file.name} at tile (${col},${row}) (${tileWidth}x${tileHeight})`;
            
            // Update tile list display
            this.updateTileList();
            
            // Render immediately to show the loaded image
            this.renderSingleFrame();
            
            console.log(`Image loaded successfully at tile position (${col}, ${row})`);
        } catch (error) {
            console.error('Failed to load image:', error);
            this.imageStatus.textContent = 'Failed to load image';
            alert('Failed to load image: ' + error.message);
        }
    }

    async initialize() {
        try {
            this.wasmModule = await init();
            this.imageBuffer = new ImageBuffer(400, 400, 2, 2);
            
            // Initialize tile list display
            this.updateTileList();
            
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
                    await this.imageBuffer.load_image_from_bytes(tileData.imageData, col, row);
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
            
            // Update status
            if (this.loadedTiles.size > 0) {
                this.imageStatus.textContent = `${this.loadedTiles.size} tiles loaded`;
            } else {
                this.imageStatus.textContent = 'No image loaded';
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

            // Reload both tiles in their new positions
            await this.imageBuffer.load_image_from_bytes(draggedTile.imageData, draggedTile.col, draggedTile.row);
            await this.imageBuffer.load_image_from_bytes(targetTile.imageData, targetTile.col, targetTile.row);

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
            }
        } else {
            const emptyMessage = document.createElement('li');
            emptyMessage.className = 'tile-list-empty';
            emptyMessage.textContent = 'No tiles loaded';
            this.tileList.appendChild(emptyMessage);
        }
    }

    async removeTile(tileIndex) {
        if (!this.loadedTiles.has(tileIndex)) {
            console.error('Attempted to remove non-existent tile:', tileIndex);
            return;
        }
        
        const tileData = this.loadedTiles.get(tileIndex);
        
        // Remove tile from our data structure
        this.loadedTiles.delete(tileIndex);
        
        // Clear the specific tile in the Rust ImageBuffer
        await this.imageBuffer.clear_tile(tileData.col, tileData.row);
        
        // Update status
        if (this.loadedTiles.size > 0) {
            this.imageStatus.textContent = `${this.loadedTiles.size} tiles loaded`;
        } else {
            this.imageStatus.textContent = 'No image loaded';
        }
        
        // Update tile list display
        this.updateTileList();
        
        // Render single frame to show updated pattern
        this.renderSingleFrame();
        
        console.log(`Tile removed successfully from position (${tileData.col}, ${tileData.row})`);
    }

    start() {
        if (this.running) return;
        
        this.running = true;
        this.startBtn.disabled = true;
        this.stopBtn.disabled = false;
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.frameTimeBuffer = [];
        
        this.render();
    }

    stop() {
        this.running = false;
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
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
    }

    renderSingleFrame() {
        // Render a single frame without starting animation loop
        this.drawFrame(0); // Use frame 0 for static display
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
        console.log('Application ready. Click Start to begin rendering.');
    } catch (error) {
        console.error('Failed to initialize application:', error);
        document.querySelector('.main-layout').innerHTML = 
            '<h1>Error</h1><p>Failed to load WebAssembly module. Please check the console for details.</p>';
    }
}

main();