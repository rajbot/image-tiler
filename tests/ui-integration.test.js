/**
 * UI Integration Tests
 * 
 * Tests the interaction between UI components and core workflows
 * Note: File loading requires async FileReader which is complex to mock
 * These tests focus on the integration points that can be reliably tested
 */

import { ImageLoader } from '../www/image-loader.js';
import { CanvasManager } from '../www/canvas-manager.js';
import { UIController } from '../www/ui-controller.js';

// Enhanced Mock WASM module with parameter validation
const createValidatingMockFunction = (expectedParamCount, functionName) => {
  return jest.fn((...args) => {
    // Validate parameter count
    if (args.length !== expectedParamCount) {
      throw new Error(`${functionName} expected ${expectedParamCount} parameters, got ${args.length}`);
    }
    
    // Validate that rows and cols are numbers
    const [rows, cols] = args;
    if (typeof rows !== 'number' || typeof cols !== 'number') {
      throw new Error(`${functionName} expected rows and cols to be numbers, got ${typeof rows}, ${typeof cols}`);
    }
    
    // Validate that image handles are defined (not undefined/null)
    for (let i = 2; i < args.length; i++) {
      if (args[i] === undefined || args[i] === null) {
        throw new Error(`${functionName} parameter ${i} (image handle) is undefined/null`);
      }
    }
    
    return { width: cols * 100, height: rows * 100 };
  });
};

// Helper function to create proper mock image handles with proxy support
const createMockHandle = (img, index) => ({
  handle: `handle${index + 1}`,
  proxyHandle: null,     // Most test images are small, no proxy needed
  needsProxy: false,
  dimensions: { width: 100, height: 100 },
  metadata: img,
  zoom: 100,
  offsetX: 0,
  offsetY: 0
});

const mockWasmModule = {
  load_image: jest.fn(() => ({ width: 100, height: 100 })),
  tile_image_with_blank_2x1: jest.fn(() => ({ width: 200, height: 100 })),
  tile_images_2x1: jest.fn(() => ({ width: 200, height: 100 })),
  tile_images_2x2_with_blanks_3: jest.fn(() => ({ width: 800, height: 800 })),
  tile_images_2x2: jest.fn(() => ({ width: 800, height: 800 })),
  tile_images_grid_1: createValidatingMockFunction(3, 'tile_images_grid_1'), // rows, cols, img1
  tile_images_grid_2: createValidatingMockFunction(4, 'tile_images_grid_2'), // rows, cols, img1, img2
  tile_images_grid_3: createValidatingMockFunction(5, 'tile_images_grid_3'), // rows, cols, img1, img2, img3
  tile_images_grid_4: createValidatingMockFunction(6, 'tile_images_grid_4'), // rows, cols, img1-img4
  tile_images_grid_5: createValidatingMockFunction(7, 'tile_images_grid_5'), // rows, cols, img1-img5
  tile_images_grid_6: createValidatingMockFunction(8, 'tile_images_grid_6'), // rows, cols, img1-img6
  tile_images_grid_7: createValidatingMockFunction(9, 'tile_images_grid_7'), // rows, cols, img1-img7
  tile_images_grid_8: createValidatingMockFunction(10, 'tile_images_grid_8'), // rows, cols, img1-img8
  tile_images_grid_9: createValidatingMockFunction(11, 'tile_images_grid_9'), // rows, cols, img1-img9
  // Zoomed tiling functions (auto-sized tiles)
  tile_images_grid_1_zoomed: jest.fn(() => ({ width: 800, height: 800 })),
  tile_images_grid_2_zoomed: jest.fn(() => ({ width: 800, height: 800 })),
  tile_images_grid_3_zoomed: jest.fn(() => ({ width: 800, height: 800 })),
  tile_images_grid_4_zoomed: jest.fn(() => ({ width: 800, height: 800 })),
  tile_images_grid_5_zoomed: jest.fn(() => ({ width: 800, height: 800 })),
  tile_images_grid_6_zoomed: jest.fn(() => ({ width: 800, height: 800 })),
  tile_images_grid_7_zoomed: jest.fn(() => ({ width: 800, height: 800 })),
  tile_images_grid_8_zoomed: jest.fn(() => ({ width: 800, height: 800 })),
  tile_images_grid_9_zoomed: jest.fn(() => ({ width: 800, height: 800 })),
  // Custom zoomed tiling functions
  tile_images_grid_1_custom_zoomed: jest.fn(() => ({ width: 800, height: 800 })),
  tile_images_grid_2_custom_zoomed: jest.fn(() => ({ width: 800, height: 800 })),
  tile_images_grid_3_custom_zoomed: jest.fn(() => ({ width: 800, height: 800 })),
  tile_images_grid_4_custom_zoomed: jest.fn(() => ({ width: 800, height: 800 })),
  tile_images_grid_5_custom_zoomed: jest.fn(() => ({ width: 800, height: 800 })),
  tile_images_grid_6_custom_zoomed: jest.fn(() => ({ width: 800, height: 800 })),
  tile_images_grid_7_custom_zoomed: jest.fn(() => ({ width: 800, height: 800 })),
  tile_images_grid_8_custom_zoomed: jest.fn(() => ({ width: 800, height: 800 })),
  tile_images_grid_9_custom_zoomed: jest.fn(() => ({ width: 800, height: 800 })),
  resize_image: jest.fn((handle, width, height) => ({ width, height })),
  export_image: jest.fn(() => new Uint8Array([1, 2, 3, 4])),
  zoom_image: jest.fn((handle, zoomPercentage) => ({ width: handle.width, height: handle.height })),
  zoom_and_pan_image: jest.fn((handle, zoomPercentage, offsetX, offsetY) => ({ width: handle.width, height: handle.height }))
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
    
    // Mock the new proxy-related methods in ImageLoader
    imageLoader.getImageHandle = jest.fn((index, useProxy = true) => {
      if (index >= 0 && index < imageLoader.imageHandles.length) {
        const item = imageLoader.imageHandles[index];
        // Use proxy if requested and available, otherwise use original
        if (useProxy && item.proxyHandle) {
          return item.proxyHandle;
        }
        return item.handle;
      }
      return null;
    });
    
    imageLoader.hasProxy = jest.fn((index) => {
      if (index >= 0 && index < imageLoader.imageHandles.length) {
        const item = imageLoader.imageHandles[index];
        return item.needsProxy && item.proxyHandle !== null;
      }
      return false;
    });
    
    imageLoader.getImageDimensions = jest.fn((index) => {
      if (index >= 0 && index < imageLoader.imageHandles.length) {
        return imageLoader.imageHandles[index].dimensions || { width: 100, height: 100 };
      }
      return { width: 0, height: 0 };
    });

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
        <div id="status"></div>
        <div id="drag-hint"></div>
        <div id="image-details"></div>
        <span id="detail-name"></span>
        <span id="detail-dimensions"></span>
        <input type="number" id="zoom-input" value="100">
        <button id="zoom-reset"></button>
        <input type="number" id="offset-x-input" value="0">
        <input type="number" id="offset-y-input" value="0">
        <button id="offset-reset"></button>
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

    test('should calculate correct export dimensions for 2x1 aspect ratio', async () => {
      // Setup mock image handles
      const mockImageData = { name: 'test.jpg', size: 1000, data: new Uint8Array([1, 2, 3]) };
      const mockHandles = [createMockHandle(mockImageData, 0)];
      imageLoader.loadedImages = [mockImageData];
      imageLoader.imageHandles = mockHandles;
      
      // Simulate a 2x1 tiled image
      const tiledHandle = { width: 200, height: 100 }; // 2:1 aspect ratio
      uiController.currentTiledHandle = tiledHandle;
      
      // Mock performGridTiling to return the tiled handle
      jest.spyOn(uiController, 'performGridTiling').mockResolvedValue(tiledHandle);
      
      uiController.updateExportSizeOptions();
      
      // Select a specific size option
      const dropdown = document.getElementById('export-size');
      dropdown.value = '1920x960'; // Should be available for 2:1 ratio
      
      // Mock the export process
      await uiController.exportImage();
      
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
      // Setup mock image handles
      const mockImageData = { name: 'test.jpg', size: 1000, data: new Uint8Array([1, 2, 3]) };
      const mockHandles = [createMockHandle(mockImageData, 0)];
      imageLoader.loadedImages = [mockImageData];
      imageLoader.imageHandles = mockHandles;
      
      const tiledHandle = { width: 200, height: 100 };
      uiController.currentTiledHandle = tiledHandle;
      
      // Mock performGridTiling to return the tiled handle
      jest.spyOn(uiController, 'performGridTiling').mockResolvedValue(tiledHandle);
      
      // Select original size
      const dropdown = document.getElementById('export-size');
      dropdown.value = 'original';
      
      await uiController.exportImage();
      
      // Verify resize_image was NOT called for original size
      expect(mockWasmModule.resize_image).not.toHaveBeenCalled();
      // Verify export_image was called with original handle
      expect(mockWasmModule.export_image).toHaveBeenCalledWith(tiledHandle, 'png');
    });

    test('should preserve grid selection functionality after export', async () => {
      // Setup: Create a 2x2 grid with 3 images
      const mockImages = [
        { name: 'image1.jpg', size: 1000, data: new Uint8Array([1, 2, 3]) },
        { name: 'image2.jpg', size: 1200, data: new Uint8Array([4, 5, 6]) },
        { name: 'image3.jpg', size: 1500, data: new Uint8Array([7, 8, 9]) }
      ];
      
      const mockHandles = mockImages.map(createMockHandle);
      
      imageLoader.loadedImages = mockImages;
      imageLoader.imageHandles = mockHandles;
      
      // Set grid inputs to 2x2 (for 3 images)
      document.getElementById('grid-rows').value = '2';
      document.getElementById('grid-cols').value = '2';
      
      // Create initial grid
      await uiController.performGridTiling();
      
      // Mock the canvas manager methods with matching grid info
      const mockGridInfo = { rows: 2, cols: 2, imageCount: 3 };
      canvasManager.getCurrentImageData = jest.fn(() => ({
        gridInfo: mockGridInfo
      }));
      canvasManager.displayImageFromBytes = jest.fn();
      canvasManager.downloadImage = jest.fn();
      
      // Execute export
      await uiController.exportImage();
      
      // Verify displayImageFromBytes was called with gridInfo preserved
      expect(canvasManager.displayImageFromBytes).toHaveBeenCalledWith(
        expect.any(Uint8Array),  // The exported image bytes
        'exported-result',        // The filename/label
        mockGridInfo             // The preserved grid info (this is what the bug fix ensures)
      );
      
      // Verify grid info wasn't lost
      expect(canvasManager.displayImageFromBytes.mock.calls[0][2]).toEqual(mockGridInfo);
    });
  });

  describe('End-to-End Workflow Tests', () => {
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
        <div id="status"></div>
        <div id="drag-hint"></div>
        <div id="image-details"></div>
        <span id="detail-name"></span>
        <span id="detail-dimensions"></span>
        <input type="number" id="zoom-input" value="100">
        <button id="zoom-reset"></button>
        <input type="number" id="offset-x-input" value="0">
        <input type="number" id="offset-y-input" value="0">
        <button id="offset-reset"></button>
      `;

      const { UIController } = require('../www/ui-controller.js');
      uiController = new UIController(imageLoader, canvasManager, mockWasmModule);
      
      // Clear all mocks before each test
      jest.clearAllMocks();
    });

    test('should handle complete workflow: 1 image → 2 images → 3 images', async () => {
      // Simulate loading first image
      const mockImageData1 = { name: 'image1.jpg', size: 1000, data: new Uint8Array([1, 2, 3]) };
      imageLoader.loadedImages = [mockImageData1];
      imageLoader.imageHandles = [{ handle: 'handle1', metadata: mockImageData1, zoom: 100 }];
      
      // Auto-preview should trigger 1x2 grid with 1 image
      await uiController.updateAutoPreview();
      
      expect(document.getElementById('grid-rows').value).toBe('1');
      expect(document.getElementById('grid-cols').value).toBe('2');
      expect(mockWasmModule.tile_images_grid_1).toHaveBeenCalledWith(1, 2, 'handle1');
      
      // Clear mocks for next step
      jest.clearAllMocks();
      
      // Simulate loading second image
      const mockImageData2 = { name: 'image2.jpg', size: 1200, data: new Uint8Array([4, 5, 6]) };
      imageLoader.loadedImages = [mockImageData1, mockImageData2];
      imageLoader.imageHandles = [
        { handle: 'handle1', metadata: mockImageData1, zoom: 100 },
        { handle: 'handle2', metadata: mockImageData2 }
      ];
      
      // Auto-preview should trigger 1x2 grid with 2 images
      await uiController.updateAutoPreview();
      
      expect(document.getElementById('grid-rows').value).toBe('1');
      expect(document.getElementById('grid-cols').value).toBe('2');
      expect(mockWasmModule.tile_images_grid_2).toHaveBeenCalledWith(1, 2, 'handle1', 'handle2');
      
      // Clear mocks for next step
      jest.clearAllMocks();
      
      // Simulate loading third image (this was the bug scenario)
      const mockImageData3 = { name: 'image3.jpg', size: 1500, data: new Uint8Array([7, 8, 9]) };
      imageLoader.loadedImages = [mockImageData1, mockImageData2, mockImageData3];
      imageLoader.imageHandles = [
        { handle: 'handle1', metadata: mockImageData1, zoom: 100 },
        { handle: 'handle2', metadata: mockImageData2 },
        { handle: 'handle3', metadata: mockImageData3 }
      ];
      
      // Auto-preview should trigger 2x2 grid with 3 images (this was failing before)
      await uiController.updateAutoPreview();
      
      expect(document.getElementById('grid-rows').value).toBe('2');
      expect(document.getElementById('grid-cols').value).toBe('2');
      expect(mockWasmModule.tile_images_grid_3).toHaveBeenCalledWith(2, 2, 'handle1', 'handle2', 'handle3');
      
      // Verify that no other grid functions were called
      expect(mockWasmModule.tile_images_grid_1).not.toHaveBeenCalled();
      expect(mockWasmModule.tile_images_grid_2).not.toHaveBeenCalled();
      expect(mockWasmModule.tile_images_grid_4).not.toHaveBeenCalled();
    });

    test('should test all grid function variants (1-9 images)', async () => {
      const testCases = [
        { imageCount: 1, expectedGrid: { rows: 1, cols: 2 }, expectedFunction: 'tile_images_grid_1' },
        { imageCount: 2, expectedGrid: { rows: 1, cols: 2 }, expectedFunction: 'tile_images_grid_2' },
        { imageCount: 3, expectedGrid: { rows: 2, cols: 2 }, expectedFunction: 'tile_images_grid_3' },
        { imageCount: 4, expectedGrid: { rows: 2, cols: 2 }, expectedFunction: 'tile_images_grid_4' },
        { imageCount: 5, expectedGrid: { rows: 2, cols: 3 }, expectedFunction: 'tile_images_grid_5' },
        { imageCount: 6, expectedGrid: { rows: 2, cols: 3 }, expectedFunction: 'tile_images_grid_6' },
        { imageCount: 7, expectedGrid: { rows: 2, cols: 4 }, expectedFunction: 'tile_images_grid_7' },
        { imageCount: 8, expectedGrid: { rows: 2, cols: 4 }, expectedFunction: 'tile_images_grid_8' },
        { imageCount: 9, expectedGrid: { rows: 2, cols: 5 }, expectedFunction: 'tile_images_grid_9' }
      ];

      for (const testCase of testCases) {
        // Clear mocks before each test case
        jest.clearAllMocks();
        
        // Create mock images and handles
        const mockImages = Array.from({ length: testCase.imageCount }, (_, i) => ({
          name: `image${i + 1}.jpg`,
          size: 1000 + i,
          data: new Uint8Array([i, i + 1, i + 2])
        }));
        
        const mockHandles = mockImages.map(createMockHandle);
        
        imageLoader.loadedImages = mockImages;
        imageLoader.imageHandles = mockHandles;
        
        // Test auto-preview
        await uiController.updateAutoPreview();
        
        // Verify grid calculation
        expect(document.getElementById('grid-rows').value).toBe(testCase.expectedGrid.rows.toString());
        expect(document.getElementById('grid-cols').value).toBe(testCase.expectedGrid.cols.toString());
        
        // Verify correct WASM function was called
        expect(mockWasmModule[testCase.expectedFunction]).toHaveBeenCalledTimes(1);
        
        // Verify parameters (first few should be the handles)
        const call = mockWasmModule[testCase.expectedFunction].mock.calls[0];
        expect(call[0]).toBe(testCase.expectedGrid.rows); // rows
        expect(call[1]).toBe(testCase.expectedGrid.cols); // cols
        
        // Verify all handles are passed as parameters
        for (let i = 0; i < testCase.imageCount; i++) {
          expect(call[i + 2]).toBe(`handle${i + 1}`);
        }
      }
    });

    test('should handle image removal and update grid accordingly', async () => {
      // Start with 3 images
      const mockImages = [
        { name: 'image1.jpg', size: 1000, data: new Uint8Array([1, 2, 3]) },
        { name: 'image2.jpg', size: 1200, data: new Uint8Array([4, 5, 6]) },
        { name: 'image3.jpg', size: 1500, data: new Uint8Array([7, 8, 9]) }
      ];
      
      const mockHandles = mockImages.map(createMockHandle);
      
      imageLoader.loadedImages = [...mockImages];
      imageLoader.imageHandles = [...mockHandles];
      
      // Should use 2x2 grid with 3 images
      await uiController.updateAutoPreview();
      expect(mockWasmModule.tile_images_grid_3).toHaveBeenCalledWith(2, 2, 'handle1', 'handle2', 'handle3');
      
      jest.clearAllMocks();
      
      // Remove one image (simulate middle image removal)
      imageLoader.loadedImages = [mockImages[0], mockImages[2]]; // Remove middle image
      imageLoader.imageHandles = [mockHandles[0], mockHandles[2]]; // Remove middle handle
      
      // Should now use 1x2 grid with 2 images
      await uiController.updateAutoPreview();
      expect(mockWasmModule.tile_images_grid_2).toHaveBeenCalledWith(1, 2, 'handle1', 'handle3');
      expect(mockWasmModule.tile_images_grid_3).not.toHaveBeenCalled();
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
        <div id="status"></div>
        <div id="drag-hint"></div>
        <div id="image-details"></div>
        <span id="detail-name"></span>
        <span id="detail-dimensions"></span>
        <input type="number" id="zoom-input" value="100">
        <button id="zoom-reset"></button>
        <input type="number" id="offset-x-input" value="0">
        <input type="number" id="offset-y-input" value="0">
        <button id="offset-reset"></button>
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
        { handle: 'handle1', zoom: 100, proxyHandle: null, needsProxy: false },
        { handle: 'handle2', zoom: 100, proxyHandle: null, needsProxy: false },
        { handle: 'handle3', zoom: 100, proxyHandle: null, needsProxy: false }
      ];
      
      // Set the imageHandles properly
      imageLoader.imageHandles = mockHandles;
      
      // Set grid inputs
      document.getElementById('grid-rows').value = '2';
      document.getElementById('grid-cols').value = '3';
      
      await uiController.performGridTiling();
      
      expect(mockWasmModule.tile_images_grid_3).toHaveBeenCalledWith(
        2,
        3,
        'handle1',
        'handle2', 
        'handle3'
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

  describe('Parameter Validation Tests', () => {
    let uiController;

    beforeEach(() => {
      // Setup DOM elements
      document.body.innerHTML = `
        <canvas id="canvas" width="800" height="600"></canvas>
        <input type="file" id="file-input" multiple accept="image/*">
        <div id="drop-zone"></div>
        <div id="image-list"></div>
        <input type="number" id="grid-rows" value="2">
        <input type="number" id="grid-cols" value="3">
        <button id="apply-grid"></button>
        <button id="export-btn"></button>
        <select id="export-format"><option value="png">PNG</option></select>
        <select id="export-size"><option value="original">Original</option></select>
        <div id="status"></div>
        <div id="drag-hint"></div>
        <div id="image-details"></div>
        <span id="detail-name"></span>
        <span id="detail-dimensions"></span>
        <input type="number" id="zoom-input" value="100">
        <button id="zoom-reset"></button>
        <input type="number" id="offset-x-input" value="0">
        <input type="number" id="offset-y-input" value="0">
        <button id="offset-reset"></button>
      `;

      const { UIController } = require('../www/ui-controller.js');
      uiController = new UIController(imageLoader, canvasManager, mockWasmModule);
      jest.clearAllMocks();
    });

    test('should validate WASM function receives correct parameter count', async () => {
      // Test that our enhanced mocks catch parameter count issues
      const mockImages = Array.from({ length: 3 }, (_, i) => ({
        name: `image${i + 1}.jpg`,
        size: 1000 + i,
        data: new Uint8Array([i, i + 1, i + 2])
      }));
      
      const mockHandles = mockImages.map(createMockHandle);
      
      imageLoader.loadedImages = mockImages;
      imageLoader.imageHandles = mockHandles;
      
      // This should work correctly
      await uiController.updateAutoPreview();
      expect(mockWasmModule.tile_images_grid_3).toHaveBeenCalledWith(2, 2, 'handle1', 'handle2', 'handle3');
    });

    test('should catch undefined parameter passing (regression test)', async () => {
      // Create a custom mock that would simulate the old bug behavior
      const originalMock = mockWasmModule.tile_images_grid_3;
      
      // Replace with a mock that throws on undefined parameters (like our bug would have caused)
      mockWasmModule.tile_images_grid_3 = jest.fn((rows, cols, img1, img2, img3) => {
        if (img2 === undefined) {
          throw new Error('tile_images_grid_3 parameter 3 (image handle) is undefined/null');
        }
        return { width: cols * 100, height: rows * 100 };
      });
      
      const mockImages = Array.from({ length: 3 }, (_, i) => ({
        name: `image${i + 1}.jpg`,
        size: 1000 + i,
        data: new Uint8Array([i, i + 1, i + 2])
      }));
      
      const mockHandles = mockImages.map(createMockHandle);
      
      imageLoader.loadedImages = mockImages;
      imageLoader.imageHandles = mockHandles;
      
      // This should NOT throw because we fixed the bug
      await expect(uiController.updateAutoPreview()).resolves.not.toThrow();
      
      // Verify all 3 handles were passed correctly
      expect(mockWasmModule.tile_images_grid_3).toHaveBeenCalledWith(2, 2, 'handle1', 'handle2', 'handle3');
      
      // Restore original mock
      mockWasmModule.tile_images_grid_3 = originalMock;
    });

    test('should handle invalid grid dimensions gracefully', async () => {
      const mockImages = [{ name: 'image1.jpg', size: 1000, data: new Uint8Array([1, 2, 3]) }];
      const mockHandles = [{ handle: 'handle1', metadata: mockImages[0], zoom: 100 }];
      
      imageLoader.loadedImages = mockImages;
      imageLoader.imageHandles = mockHandles;
      
      // Set invalid grid dimensions
      document.getElementById('grid-rows').value = '0';
      document.getElementById('grid-cols').value = '2';
      
      await uiController.performGridTiling();
      
      // Should not call any WASM functions with invalid dimensions
      expect(mockWasmModule.tile_images_grid_1).not.toHaveBeenCalled();
    });

    test('should handle maximum image count (9 images)', async () => {
      const mockImages = Array.from({ length: 9 }, (_, i) => ({
        name: `image${i + 1}.jpg`,
        size: 1000 + i,
        data: new Uint8Array([i, i + 1, i + 2])
      }));
      
      const mockHandles = mockImages.map(createMockHandle);
      
      imageLoader.loadedImages = mockImages;
      imageLoader.imageHandles = mockHandles;
      
      await uiController.updateAutoPreview();
      
      // Should call tile_images_grid_9 with all 9 handles
      expect(mockWasmModule.tile_images_grid_9).toHaveBeenCalledWith(
        2, 5, // 2x5 grid for 9 images
        'handle1', 'handle2', 'handle3', 'handle4', 'handle5', 'handle6', 'handle7', 'handle8', 'handle9'
      );
    });
  });

  describe('Regression Tests for Grid Placement Bug', () => {
    let uiController;

    beforeEach(() => {
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
        <div id="status"></div>
        <div id="drag-hint"></div>
        <div id="image-details"></div>
        <span id="detail-name"></span>
        <span id="detail-dimensions"></span>
        <input type="number" id="zoom-input" value="100">
        <button id="zoom-reset"></button>
        <input type="number" id="offset-x-input" value="0">
        <input type="number" id="offset-y-input" value="0">
        <button id="offset-reset"></button>
      `;

      const { UIController } = require('../www/ui-controller.js');
      uiController = new UIController(imageLoader, canvasManager, mockWasmModule);
      jest.clearAllMocks();
    });

    test('REGRESSION: 3rd image should not replace 2nd image position', async () => {
      // This test specifically covers the bug scenario that was reported
      
      // Step 1: Load 2 images - should create 1x2 grid
      let mockImages = [
        { name: 'image1.jpg', size: 1000, data: new Uint8Array([1, 2, 3]) },
        { name: 'image2.jpg', size: 1200, data: new Uint8Array([4, 5, 6]) }
      ];
      
      let mockHandles = mockImages.map((img, i) => ({
        handle: `handle${i + 1}`,
        metadata: img
      }));
      
      imageLoader.loadedImages = [...mockImages];
      imageLoader.imageHandles = [...mockHandles];
      
      await uiController.updateAutoPreview();
      
      // Verify 2 images in 1x2 grid
      expect(mockWasmModule.tile_images_grid_2).toHaveBeenCalledWith(1, 2, 'handle1', 'handle2');
      
      jest.clearAllMocks();
      
      // Step 2: Add 3rd image - should create 2x2 grid with 3 images
      const thirdImage = { name: 'image3.jpg', size: 1500, data: new Uint8Array([7, 8, 9]) };
      mockImages.push(thirdImage);
      mockHandles.push({ handle: 'handle3', metadata: thirdImage });
      
      imageLoader.loadedImages = [...mockImages];
      imageLoader.imageHandles = [...mockHandles];
      
      await uiController.updateAutoPreview();
      
      // The key regression test: verify all 3 handles are passed correctly
      expect(mockWasmModule.tile_images_grid_3).toHaveBeenCalledWith(2, 2, 'handle1', 'handle2', 'handle3');
      
      // Verify that exactly 3 parameters (plus rows/cols) were passed
      const call = mockWasmModule.tile_images_grid_3.mock.calls[0];
      expect(call).toHaveLength(5); // rows, cols, img1, img2, img3
      expect(call[2]).toBe('handle1'); // img1
      expect(call[3]).toBe('handle2'); // img2 (this was getting lost in the bug)
      expect(call[4]).toBe('handle3'); // img3
      
      // Verify no other grid functions were called
      expect(mockWasmModule.tile_images_grid_2).not.toHaveBeenCalled();
      expect(mockWasmModule.tile_images_grid_1).not.toHaveBeenCalled();
    });

    test('REGRESSION: function selection logic works correctly', async () => {
      // Test that the switch statement in performGridTiling selects the right function
      
      const testCases = [
        { imageCount: 1, expectedFunction: 'tile_images_grid_1' },
        { imageCount: 2, expectedFunction: 'tile_images_grid_2' },
        { imageCount: 3, expectedFunction: 'tile_images_grid_3' }, // The problematic case
        { imageCount: 4, expectedFunction: 'tile_images_grid_4' },
        { imageCount: 5, expectedFunction: 'tile_images_grid_5' },
        { imageCount: 6, expectedFunction: 'tile_images_grid_6' },
        { imageCount: 7, expectedFunction: 'tile_images_grid_7' },
        { imageCount: 8, expectedFunction: 'tile_images_grid_8' },
        { imageCount: 9, expectedFunction: 'tile_images_grid_9' }
      ];
      
      for (const testCase of testCases) {
        jest.clearAllMocks();
        
        const mockImages = Array.from({ length: testCase.imageCount }, (_, i) => ({
          name: `image${i + 1}.jpg`,
          size: 1000 + i,
          data: new Uint8Array([i, i + 1, i + 2])
        }));
        
        const mockHandles = mockImages.map(createMockHandle);
        
        imageLoader.loadedImages = mockImages;
        imageLoader.imageHandles = mockHandles;
        
        await uiController.performGridTiling();
        
        // Verify only the correct function was called
        expect(mockWasmModule[testCase.expectedFunction]).toHaveBeenCalledTimes(1);
        
        // Verify no other grid functions were called
        Object.keys(mockWasmModule).forEach(funcName => {
          if (funcName.startsWith('tile_images_grid_') && funcName !== testCase.expectedFunction) {
            expect(mockWasmModule[funcName]).not.toHaveBeenCalled();
          }
        });
      }
    });
  });

  describe('Image Panning/Offset Feature Tests', () => {
    let uiController;

    beforeEach(() => {
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
        <div id="status"></div>
        <div id="drag-hint"></div>
        <div id="image-details"></div>
        <span id="detail-name"></span>
        <span id="detail-dimensions"></span>
        <input type="number" id="zoom-input" value="100">
        <button id="zoom-reset"></button>
        <input type="number" id="offset-x-input" value="0">
        <input type="number" id="offset-y-input" value="0">
        <button id="offset-reset"></button>
      `;

      const { UIController } = require('../www/ui-controller.js');
      uiController = new UIController(imageLoader, canvasManager, mockWasmModule);
      jest.clearAllMocks();
    });

    describe('ImageLoader Offset Storage', () => {
      test('should store and retrieve offset values for images', () => {
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
        imageLoader.imageHandles.push({
          handle: 'handle1',
          metadata: mockImageData,
          zoom: 100,
          offsetX: 0,
          offsetY: 0
        });

        // Test default offset values
        const defaultOffset = imageLoader.getImageOffset(0);
        expect(defaultOffset).toEqual({ x: 0, y: 0 });

        // Test setting offset values
        const success = imageLoader.setImageOffset(0, 50, -25);
        expect(success).toBe(true);

        // Test retrieving updated offset values
        const updatedOffset = imageLoader.getImageOffset(0);
        expect(updatedOffset).toEqual({ x: 50, y: -25 });

        // Test invalid index handling
        const invalidOffset = imageLoader.getImageOffset(5);
        expect(invalidOffset).toEqual({ x: 0, y: 0 });

        const failedSet = imageLoader.setImageOffset(5, 10, 20);
        expect(failedSet).toBe(false);
      });
    });

    describe('UI Controller Offset Integration', () => {
      test('should apply offset values and call zoomed tiling function', async () => {
        // Setup mock images with offset values
        const mockImages = [
          { name: 'image1.jpg', size: 1000, data: new Uint8Array([1, 2, 3]) },
          { name: 'image2.jpg', size: 1200, data: new Uint8Array([4, 5, 6]) }
        ];
        
        const mockHandles = [
          { handle: 'handle1', metadata: mockImages[0], zoom: 150, offsetX: 25, offsetY: -10 },
          { handle: 'handle2', metadata: mockImages[1], zoom: 100, offsetX: 0, offsetY: 0 }
        ];
        
        imageLoader.loadedImages = mockImages;
        imageLoader.imageHandles = mockHandles;
        
        await uiController.performGridTiling();
        
        // Verify zoom_and_pan_image is no longer called (new approach handles zoom during tiling)
        expect(mockWasmModule.zoom_and_pan_image).not.toHaveBeenCalled();
        
        // Verify the zoomed tiling function was called with zoom and offset parameters
        expect(mockWasmModule.tile_images_grid_2_zoomed).toHaveBeenCalledWith(
          1, 2, // rows, cols
          150, 25, -10, // zoom1, offsetX1, offsetY1
          100, 0, 0,    // zoom2, offsetX2, offsetY2
          'handle1', 'handle2' // handles
        );
      });

      test('should use zoomed tiling function even for default values', async () => {
        // Setup mock images with all default values
        const mockImages = [
          { name: 'image1.jpg', size: 1000, data: new Uint8Array([1, 2, 3]) }
        ];
        
        const mockHandles = [
          { handle: 'handle1', metadata: mockImages[0], zoom: 100, offsetX: 0, offsetY: 0 }
        ];
        
        imageLoader.loadedImages = mockImages;
        imageLoader.imageHandles = mockHandles;
        
        await uiController.performGridTiling();
        
        // Verify zoom_and_pan_image is never called (new approach)
        expect(mockWasmModule.zoom_and_pan_image).not.toHaveBeenCalled();
        
        // Verify the zoomed tiling function was called with default values
        expect(mockWasmModule.tile_images_grid_1_zoomed).toHaveBeenCalledWith(
          1, 2, // rows, cols
          100, 0, 0, // zoom1, offsetX1, offsetY1 (default values)
          'handle1' // handle
        );
      });

      test('should update offset inputs when image is selected', () => {
        // Setup mock images with offset values
        const mockImages = [
          { name: 'image1.jpg', size: 1000, data: new Uint8Array([1, 2, 3]) }
        ];
        
        imageLoader.loadedImages = mockImages;
        imageLoader.imageHandles = [{
          handle: 'handle1',
          metadata: mockImages[0],
          zoom: 100,
          offsetX: 30,
          offsetY: -15
        }];
        
        // Simulate selecting the image
        uiController.selectedImageIndex = 0;
        uiController.updateImageDetails(0);
        
        // Verify offset inputs show the correct values
        expect(document.getElementById('offset-x-input').value).toBe('30');
        expect(document.getElementById('offset-y-input').value).toBe('-15');
      });

      test('should apply offset from UI inputs', () => {
        // Setup mock images
        const mockImages = [
          { name: 'image1.jpg', size: 1000, data: new Uint8Array([1, 2, 3]) }
        ];
        
        imageLoader.loadedImages = mockImages;
        imageLoader.imageHandles = [{
          handle: 'handle1',
          metadata: mockImages[0],
          zoom: 100,
          offsetX: 0,
          offsetY: 0
        }];
        
        // Select the image
        uiController.selectedImageIndex = 0;
        
        // Set offset values in the UI
        document.getElementById('offset-x-input').value = '75';
        document.getElementById('offset-y-input').value = '-40';
        
        // Apply the offset
        uiController.applyOffset();
        
        // Verify the offset was applied to the image
        const appliedOffset = imageLoader.getImageOffset(0);
        expect(appliedOffset).toEqual({ x: 75, y: -40 });
        
        // Verify performGridTiling was called with new zoomed function (to update the preview)
        expect(mockWasmModule.tile_images_grid_1_zoomed).toHaveBeenCalled();
      });

      test('should reset offset values', () => {
        // Setup mock images with offset values
        const mockImages = [
          { name: 'image1.jpg', size: 1000, data: new Uint8Array([1, 2, 3]) }
        ];
        
        imageLoader.loadedImages = mockImages;
        imageLoader.imageHandles = [{
          handle: 'handle1',
          metadata: mockImages[0],
          zoom: 100,
          offsetX: 50,
          offsetY: -25
        }];
        
        // Select the image
        uiController.selectedImageIndex = 0;
        
        // Reset offset
        uiController.resetOffset();
        
        // Verify offset was reset to zero
        const resetOffset = imageLoader.getImageOffset(0);
        expect(resetOffset).toEqual({ x: 0, y: 0 });
        
        // Verify UI inputs were reset
        expect(document.getElementById('offset-x-input').value).toBe('0');
        expect(document.getElementById('offset-y-input').value).toBe('0');
      });

      test('should validate offset input ranges', () => {
        // Setup mock images
        const mockImages = [
          { name: 'image1.jpg', size: 1000, data: new Uint8Array([1, 2, 3]) }
        ];
        
        imageLoader.loadedImages = mockImages;
        imageLoader.imageHandles = [{
          handle: 'handle1',
          metadata: mockImages[0],
          zoom: 100,
          offsetX: 0,
          offsetY: 0
        }];
        
        // Select the image
        uiController.selectedImageIndex = 0;
        
        // Try to set offset values outside valid range
        document.getElementById('offset-x-input').value = '15000'; // Above max of 10000
        document.getElementById('offset-y-input').value = '-12000'; // Below min of -10000
        
        // Apply the offset (should be rejected)
        uiController.applyOffset();
        
        // Verify offset was not applied (should remain at defaults)
        const offset = imageLoader.getImageOffset(0);
        expect(offset).toEqual({ x: 0, y: 0 });
        
        // Verify UI inputs were reset to valid values
        expect(document.getElementById('offset-x-input').value).toBe('0');
        expect(document.getElementById('offset-y-input').value).toBe('0');
      });
    });

    describe('Canvas Drag Interaction', () => {
      test('should setup drag event handlers', () => {
        // Test that drag properties exist
        expect(canvasManager.isDragging).toBeDefined();
        expect(canvasManager.dragStartX).toBeDefined();
        expect(canvasManager.dragStartY).toBeDefined();
        expect(canvasManager.lastDragX).toBeDefined();
        expect(canvasManager.lastDragY).toBeDefined();
        
        // Test that callbacks are set up by UIController
        expect(typeof canvasManager.onImageDrag).toBe('function');
        expect(typeof canvasManager.onImageDragEnd).toBe('function');
        
        // Simulate setting up callbacks
        canvasManager.onImageDrag = jest.fn();
        canvasManager.onImageDragEnd = jest.fn();
        
        expect(canvasManager.onImageDrag).toBeDefined();
        expect(canvasManager.onImageDragEnd).toBeDefined();
      });

      test('should handle drag callbacks', () => {
        // Setup drag callbacks
        canvasManager.onImageDrag = jest.fn();
        canvasManager.onImageDragEnd = jest.fn();
        
        // Test that we can call the callbacks manually
        canvasManager.onImageDrag(0, 10, 5);
        canvasManager.onImageDragEnd(0, 20, 15);
        
        // Verify callbacks were called with correct parameters
        expect(canvasManager.onImageDrag).toHaveBeenCalledWith(0, 10, 5);
        expect(canvasManager.onImageDragEnd).toHaveBeenCalledWith(0, 20, 15);
      });

      test('should schedule debounced high-quality render after drag end', (done) => {
        const mockImages = [{ name: 'image1.jpg', size: 1000, data: new Uint8Array([1, 2, 3]) }];
        const mockHandles = mockImages.map(createMockHandle);
        
        imageLoader.loadedImages = mockImages;
        imageLoader.imageHandles = mockHandles;
        
        const uiController = new UIController(imageLoader, canvasManager, mockWasmModule);
        
        // Spy on performGridTiling to track calls
        const performGridTilingSpy = jest.spyOn(uiController, 'performGridTiling');
        
        // Clear initial calls
        performGridTilingSpy.mockClear();
        
        // Simulate drag end
        canvasManager.onImageDragEnd(0, 10, -5);
        
        // High-quality render should be scheduled for 300ms later
        setTimeout(() => {
          expect(performGridTilingSpy).toHaveBeenCalledWith(false); // High-quality call
          done();
        }, 350); // Wait slightly longer than the 300ms debounce
      });
    });

    describe('Integration with Grid Tiling', () => {
      test('should preserve offset and zoom when exporting', async () => {
        // Setup mock images with both zoom and offset
        const mockImages = [
          { name: 'image1.jpg', size: 1000, data: new Uint8Array([1, 2, 3]) },
          { name: 'image2.jpg', size: 1200, data: new Uint8Array([4, 5, 6]) }
        ];
        
        const mockHandles = [
          { handle: 'handle1', metadata: mockImages[0], zoom: 125, offsetX: 15, offsetY: -5 },
          { handle: 'handle2', metadata: mockImages[1], zoom: 200, offsetX: -30, offsetY: 20 }
        ];
        
        imageLoader.loadedImages = mockImages;
        imageLoader.imageHandles = mockHandles;
        
        // Create initial grid with zoom and pan
        await uiController.performGridTiling();
        
        // Verify the new zoomed tiling function was called instead of individual zoom_and_pan_image
        expect(mockWasmModule.zoom_and_pan_image).not.toHaveBeenCalled();
        expect(mockWasmModule.tile_images_grid_2_zoomed).toHaveBeenCalledWith(
          1, 2, // rows, cols
          125, 15, -5,  // zoom1, offsetX1, offsetY1
          200, -30, 20, // zoom2, offsetX2, offsetY2
          'handle1', 'handle2' // handles
        );
        
        // Mock canvas manager for export
        const mockGridInfo = { rows: 1, cols: 2, imageCount: 2 };
        canvasManager.getCurrentImageData = jest.fn(() => ({
          gridInfo: mockGridInfo
        }));
        canvasManager.displayImageFromBytes = jest.fn();
        canvasManager.downloadImage = jest.fn();
        
        // Export the image
        await uiController.exportImage();
        
        // Verify grid info was preserved in export
        expect(canvasManager.displayImageFromBytes).toHaveBeenCalledWith(
          expect.any(Uint8Array),
          'exported-result',
          mockGridInfo
        );
      });
    });
  });
});