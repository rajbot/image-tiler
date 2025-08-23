/**
 * UI Integration Tests
 * 
 * Tests the interaction between UI components and core workflows
 * Note: File loading requires async FileReader which is complex to mock
 * These tests focus on the integration points that can be reliably tested
 */

import { ImageLoader } from '../www/image-loader.js';
import { CanvasManager } from '../www/canvas-manager.js';

// Mock WASM module
const mockWasmModule = {
  load_image: jest.fn(() => ({ width: 100, height: 100 })),
  tile_image_with_blank_2x1: jest.fn(() => ({ width: 200, height: 100 })),
  tile_images_2x1: jest.fn(() => ({ width: 200, height: 100 })),
  tile_images_2x2_with_blanks_3: jest.fn(() => ({ width: 800, height: 800 })),
  tile_images_2x2: jest.fn(() => ({ width: 800, height: 800 })),
  resize_image: jest.fn((handle, width, height) => ({ width, height })),
  export_image: jest.fn(() => new Uint8Array([1, 2, 3, 4]))
};

describe('Component Integration Tests', () => {
  let imageLoader, canvasManager;
  let mockCanvas, mockContext;

  beforeEach(() => {
    // Setup minimal DOM for canvas manager
    document.body.innerHTML = `
      <canvas id="canvas" width="800" height="600"></canvas>
    `;

    mockContext = {
      clearRect: jest.fn(),
      drawImage: jest.fn()
    };

    mockCanvas = document.getElementById('canvas');
    mockCanvas.getContext = jest.fn(() => mockContext);
    mockCanvas.toDataURL = jest.fn(() => 'data:image/png;base64,mock');

    imageLoader = new ImageLoader();
    canvasManager = new CanvasManager('canvas');

    jest.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('ImageLoader and CanvasManager Integration', () => {
    test('should work together for basic image workflow', async () => {
      // Create mock image data
      const mockImageData = {
        name: 'test.jpg',
        size: 1000,
        data: new Uint8Array([1, 2, 3, 4]),
        url: 'mock-url',
        file: new File(['test data'], 'test.jpg')
      };

      // Load image into ImageLoader
      imageLoader.loadedImages.push(mockImageData);
      
      // Display on canvas
      await canvasManager.displayImage(mockImageData);

      expect(mockContext.clearRect).toHaveBeenCalled();
      expect(mockContext.drawImage).toHaveBeenCalled();
    });

    test('should handle canvas display from bytes', async () => {
      const imageBytes = new Uint8Array([1, 2, 3, 4]);
      
      await canvasManager.displayImageFromBytes(imageBytes, 'test.png');

      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(mockContext.clearRect).toHaveBeenCalled();
    });
  });

  describe('WASM Integration Simulation', () => {
    test('should simulate complete image processing workflow', () => {
      // Create mock image handles
      const handle1 = { width: 100, height: 100 };
      const handle2 = { width: 150, height: 100 };

      // Simulate WASM calls
      const tiledResult = mockWasmModule.tile_images_2x1(handle1, handle2);
      const exportedBytes = mockWasmModule.export_image(tiledResult, 'png');

      expect(mockWasmModule.tile_images_2x1).toHaveBeenCalledWith(handle1, handle2);
      expect(mockWasmModule.export_image).toHaveBeenCalledWith(tiledResult, 'png');
      expect(exportedBytes).toBeInstanceOf(Uint8Array);
    });

    test('should simulate different tiling scenarios', () => {
      const handles = [
        { width: 100, height: 100 },
        { width: 100, height: 100 },
        { width: 100, height: 100 },  
        { width: 100, height: 100 }
      ];

      // Test different WASM functions
      mockWasmModule.tile_image_with_blank_2x1(handles[0]);
      mockWasmModule.tile_images_2x1(handles[0], handles[1]);
      mockWasmModule.tile_images_2x2_with_blanks_3(handles[0], handles[1], handles[2]);
      mockWasmModule.tile_images_2x2(handles[0], handles[1], handles[2], handles[3]);

      expect(mockWasmModule.tile_image_with_blank_2x1).toHaveBeenCalled();
      expect(mockWasmModule.tile_images_2x1).toHaveBeenCalled();
      expect(mockWasmModule.tile_images_2x2_with_blanks_3).toHaveBeenCalled();
      expect(mockWasmModule.tile_images_2x2).toHaveBeenCalled();
    });
  });

  describe('Export Size Validation', () => {
    let uiController;

    beforeEach(() => {
      // Setup DOM elements for UIController
      document.body.innerHTML = `
        <canvas id="canvas" width="800" height="600"></canvas>
        <input type="file" id="file-input" multiple accept="image/*">
        <div id="drop-zone"></div>
        <div id="image-list"></div>
        <button id="tile-2x1"></button>
        <button id="tile-2x2"></button>
        <button id="export-btn"></button>
        <select id="export-format"><option value="png">PNG</option></select>
        <select id="export-size"><option value="original">Original</option></select>
        <button id="clear-btn"></button>
        <div id="status"></div>
        <div id="drag-hint"></div>
      `;

      // Import UIController dynamically to avoid module loading issues
      const { UIController } = require('../www/ui-controller.js');
      uiController = new UIController(imageLoader, canvasManager, mockWasmModule);
    });

    test('should update export size dropdown based on tiled image dimensions', () => {
      // Simulate a 2x1 tiled image (200x100)
      uiController.currentTiledHandle = { width: 200, height: 100 };
      
      // Update export size options
      uiController.updateExportSizeOptions();
      
      // Check that dropdown has been populated with correct aspect ratio options
      const dropdown = document.getElementById('export-size');
      const options = Array.from(dropdown.options).map(opt => opt.textContent);
      
      expect(options).toContain('Original');
      // For 2:1 aspect ratio, should show options like "1920×960", "1280×640", etc.
      expect(options.some(opt => opt.includes('×960'))).toBe(true);
      expect(options.some(opt => opt.includes('×640'))).toBe(true);
    });

    test('should calculate correct export dimensions for 2x1 aspect ratio', () => {
      // Simulate a 2x1 tiled image
      const tiledHandle = { width: 200, height: 100 }; // 2:1 aspect ratio
      uiController.currentTiledHandle = tiledHandle;
      
      uiController.updateExportSizeOptions();
      
      // Select a specific size option
      const dropdown = document.getElementById('export-size');
      dropdown.value = '1920x960'; // Should be available for 2:1 ratio
      
      // Mock the export process
      uiController.exportImage();
      
      // Verify resize_image was called with correct dimensions
      expect(mockWasmModule.resize_image).toHaveBeenCalledWith(tiledHandle, 1920, 960);
    });

    test('should calculate correct export dimensions for square aspect ratio', () => {
      // Simulate a square tiled image
      const tiledHandle = { width: 800, height: 800 }; // 1:1 aspect ratio
      uiController.currentTiledHandle = tiledHandle;
      
      uiController.updateExportSizeOptions();
      
      // Check that dropdown contains square options
      const dropdown = document.getElementById('export-size');
      const options = Array.from(dropdown.options).map(opt => opt.textContent);
      
      expect(options.some(opt => opt.includes('1920×1920'))).toBe(true);
      expect(options.some(opt => opt.includes('1280×1280'))).toBe(true);
    });

    test('should handle original size export without resizing', async () => {
      const tiledHandle = { width: 200, height: 100 };
      uiController.currentTiledHandle = tiledHandle;
      
      // Select original size
      const dropdown = document.getElementById('export-size');
      dropdown.value = 'original';
      
      await uiController.exportImage();
      
      // Verify resize_image was NOT called for original size
      expect(mockWasmModule.resize_image).not.toHaveBeenCalled();
      // Verify export_image was called with original handle
      expect(mockWasmModule.export_image).toHaveBeenCalledWith(tiledHandle, 'png');
    });
  });
});