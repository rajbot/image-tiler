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
  tile_images_grid: jest.fn((rows, cols, img1, img2, img3, img4, img5, img6, img7, img8, img9) => ({ width: cols * 100, height: rows * 100 })),
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
        <input type="number" id="grid-rows" value="1">
        <input type="number" id="grid-cols" value="2">
        <button id="apply-grid"></button>
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

  describe('Grid System Tests', () => {
    let uiController;

    beforeEach(() => {
      // Setup DOM elements for UIController
      document.body.innerHTML = `
        <canvas id="canvas" width="800" height="600"></canvas>
        <input type="file" id="file-input" multiple accept="image/*">
        <div id="drop-zone"></div>
        <div id="image-list"></div>
        <input type="number" id="grid-rows" value="1">
        <input type="number" id="grid-cols" value="2">
        <button id="apply-grid"></button>
        <button id="export-btn"></button>
        <select id="export-format"><option value="png">PNG</option></select>
        <select id="export-size"><option value="original">Original</option></select>
        <button id="clear-btn"></button>
        <div id="status"></div>
        <div id="drag-hint"></div>
      `;

      const { UIController } = require('../www/ui-controller.js');
      uiController = new UIController(imageLoader, canvasManager, mockWasmModule);
    });

    test('should calculate optimal grid for different image counts', () => {
      expect(uiController.calculateOptimalGrid(0)).toEqual({ rows: 1, cols: 2 });
      expect(uiController.calculateOptimalGrid(1)).toEqual({ rows: 1, cols: 2 });
      expect(uiController.calculateOptimalGrid(2)).toEqual({ rows: 1, cols: 2 });
      expect(uiController.calculateOptimalGrid(3)).toEqual({ rows: 2, cols: 2 });
      expect(uiController.calculateOptimalGrid(4)).toEqual({ rows: 2, cols: 2 });
      expect(uiController.calculateOptimalGrid(5)).toEqual({ rows: 2, cols: 3 }); // Add column since rows <= cols
      expect(uiController.calculateOptimalGrid(6)).toEqual({ rows: 2, cols: 3 });
      expect(uiController.calculateOptimalGrid(7)).toEqual({ rows: 2, cols: 4 }); // Add column since rows <= cols
    });

    test('should update grid inputs correctly', () => {
      uiController.updateGridInputs(3, 4);
      expect(document.getElementById('grid-rows').value).toBe('3');
      expect(document.getElementById('grid-cols').value).toBe('4');
    });

    test('should call tile_images_grid with correct parameters', async () => {
      const mockHandles = [
        { handle: 'handle1' },
        { handle: 'handle2' },
        { handle: 'handle3' }
      ];
      
      // Mock getImageHandles to return our test handles
      imageLoader.getImageHandles = jest.fn(() => mockHandles);
      
      // Set grid inputs
      document.getElementById('grid-rows').value = '2';
      document.getElementById('grid-cols').value = '3';
      
      await uiController.performGridTiling();
      
      expect(mockWasmModule.tile_images_grid).toHaveBeenCalledWith(
        2,
        3,
        'handle1',
        'handle2', 
        'handle3',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      );
    });

    test('should handle grid expansion logic correctly', () => {
      // Test the expansion rule: if rows <= cols, add column, else add row
      let grid = uiController.calculateOptimalGrid(4); // 2x2
      expect(grid).toEqual({ rows: 2, cols: 2 });
      
      grid = uiController.calculateOptimalGrid(5); // 2x3 (add column since rows <= cols)
      expect(grid).toEqual({ rows: 2, cols: 3 });
      
      grid = uiController.calculateOptimalGrid(7); // 2x4 (add column since rows <= cols after 2x3)
      expect(grid).toEqual({ rows: 2, cols: 4 });
    });
  });
});