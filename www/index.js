import init, * as wasm from '../pkg/image_tiler.js';
import { ImageLoader } from './image-loader.js';
import { CanvasManager } from './canvas-manager.js';
import { UIController } from './ui-controller.js';

async function run() {
    try {
        // Initialize the WASM module
        await init();
        console.log('WASM module loaded successfully');

        // Initialize components
        const imageLoader = new ImageLoader();
        const canvasManager = new CanvasManager('canvas');
        const uiController = new UIController(imageLoader, canvasManager, wasm);

        console.log('Image Tiler application initialized');
        
        // Update status
        document.getElementById('status').textContent = 'Ready! Drop images or click to select files.';

    } catch (error) {
        console.error('Failed to initialize application:', error);
        document.getElementById('status').textContent = 'Failed to initialize application: ' + error.message;
    }
}

// Start the application
run();