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
        this.hasLoadedImage = false;
        
        this.imageBuffer = null;
        this.wasmModule = null;
        
        // Store image data for regeneration
        this.currentImageData = null;
        this.currentFileName = null;
        
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

    async handleImageLoad(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (!file.type.match(/^image\/(jpeg|png)$/)) {
            alert('Please select a JPEG or PNG image.');
            return;
        }
        
        try {
            this.imageStatus.textContent = 'Loading image...';
            
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // Store image data for regeneration
            this.currentImageData = uint8Array;
            this.currentFileName = file.name;
            
            // Load image into Rust and resize to tile dimensions
            await this.imageBuffer.load_image_from_bytes(uint8Array);
            
            this.hasLoadedImage = true;
            const tileWidth = this.imageBuffer.tile_width;
            const tileHeight = this.imageBuffer.tile_height;
            this.imageStatus.textContent = `Loaded: ${file.name} (${tileWidth}x${tileHeight})`;
            
            // Update tile list display
            this.updateTileList();
            
            // Render immediately to show the loaded image
            this.renderSingleFrame();
            
            console.log('Image loaded and processed successfully');
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
            
            // Reload image if one was loaded
            if (this.currentImageData && this.currentFileName) {
                await this.imageBuffer.load_image_from_bytes(this.currentImageData);
                this.hasLoadedImage = true;
                this.imageStatus.textContent = `Loaded: ${this.currentFileName} (${tileWidth}x${tileHeight})`;
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

    updateTileList() {
        this.tileList.innerHTML = '';
        
        if (this.hasLoadedImage && this.currentFileName) {
            const listItem = document.createElement('li');
            listItem.className = 'tile-item';
            
            const tileName = document.createElement('span');
            tileName.className = 'tile-name';
            tileName.textContent = this.currentFileName;
            tileName.title = this.currentFileName; // Show full name on hover
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'tile-remove';
            removeBtn.innerHTML = '×';
            removeBtn.title = 'Remove tile';
            removeBtn.addEventListener('click', () => this.removeTile());
            
            listItem.appendChild(tileName);
            listItem.appendChild(removeBtn);
            this.tileList.appendChild(listItem);
        } else {
            const emptyMessage = document.createElement('li');
            emptyMessage.className = 'tile-list-empty';
            emptyMessage.textContent = 'No tiles loaded';
            this.tileList.appendChild(emptyMessage);
        }
    }

    removeTile() {
        // Clear the loaded image data
        this.hasLoadedImage = false;
        this.currentImageData = null;
        this.currentFileName = null;
        
        // Update image status
        this.imageStatus.textContent = 'No image loaded';
        
        // Regenerate grid without image (this will clear the image from canvas)
        this.imageBuffer = new ImageBuffer(
            parseInt(document.getElementById('tile-width').value),
            parseInt(document.getElementById('tile-height').value),
            parseInt(document.getElementById('num-cols').value),
            parseInt(document.getElementById('num-rows').value)
        );
        
        // Update tile list display
        this.updateTileList();
        
        // Render single frame to show pattern without image
        this.renderSingleFrame();
        
        console.log('Tile removed successfully');
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