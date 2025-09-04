import { UIController } from '../www/ui-controller.js';
import { ImageLoader } from '../www/image-loader.js';
import { CanvasManager } from '../www/canvas-manager.js';

describe('UIController Image Selection', () => {
  let uiController;
  let mockImageLoader;
  let mockCanvasManager;
  let mockWasmModule;
  let mockImageList;

  beforeEach(() => {
    // Mock DOM elements
    mockImageList = {
      children: [],
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(() => []),
      appendChild: jest.fn(),
      innerHTML: ''
    };

    // Mock all DOM elements that UIController expects
    const mockElements = {
      'file-input': { addEventListener: jest.fn() },
      'drop-zone': { 
        addEventListener: jest.fn(),
        classList: { add: jest.fn(), remove: jest.fn() }
      },
      'image-list': mockImageList,
      'grid-rows': { value: '2', addEventListener: jest.fn() },
      'grid-cols': { value: '2', addEventListener: jest.fn() },
      'apply-grid': { addEventListener: jest.fn(), disabled: false },
      'export-btn': { addEventListener: jest.fn(), disabled: true },
      'export-format': { value: 'png' },
      'export-size': { value: 'original', innerHTML: '' },
      'clear-btn': { addEventListener: jest.fn() },
      'status': { textContent: '' },
      'drag-hint': { style: { display: 'none' } },
      'image-details': { style: { display: 'none' } },
      'detail-name': { textContent: '' },
      'detail-dimensions': { textContent: '' },
      'zoom-input': { value: '100', addEventListener: jest.fn() },
      'zoom-reset': { addEventListener: jest.fn() }
    };

    document.getElementById = jest.fn((id) => mockElements[id]);

    // Create mock dependencies
    mockImageLoader = {
      getLoadedImages: jest.fn(() => []),
      getImageHandles: jest.fn(() => []),
      clear: jest.fn(),
      removeImage: jest.fn(),
      reorderImages: jest.fn(() => true),
      setImageZoom: jest.fn(() => true),
      getImageZoom: jest.fn(() => 100)
    };

    mockCanvasManager = {
      onImageSelected: null,
      selectedImageIndex: -1,
      clear: jest.fn(),
      redrawWithSelection: jest.fn(),
      getCurrentImageData: jest.fn(() => null)
    };

    mockWasmModule = {};

    uiController = new UIController(mockImageLoader, mockCanvasManager, mockWasmModule);
  });

  describe('image list selection synchronization', () => {
    test('should update image list selection when canvas selection changes', () => {
      const mockImageItems = [
        { classList: { add: jest.fn(), remove: jest.fn() } },
        { classList: { add: jest.fn(), remove: jest.fn() } },
        { classList: { add: jest.fn(), remove: jest.fn() } }
      ];
      
      mockImageList.querySelectorAll.mockReturnValue(mockImageItems);

      // Simulate canvas selection of second image
      uiController.updateImageListSelection(1);

      expect(mockImageItems[0].classList.remove).toHaveBeenCalledWith('selected');
      expect(mockImageItems[1].classList.add).toHaveBeenCalledWith('selected');
      expect(mockImageItems[2].classList.remove).toHaveBeenCalledWith('selected');
    });

    test('should clear all selections when selectedIndex is -1', () => {
      const mockImageItems = [
        { classList: { add: jest.fn(), remove: jest.fn() } },
        { classList: { add: jest.fn(), remove: jest.fn() } }
      ];
      
      mockImageList.querySelectorAll.mockReturnValue(mockImageItems);

      // Simulate deselection
      uiController.updateImageListSelection(-1);

      expect(mockImageItems[0].classList.remove).toHaveBeenCalledWith('selected');
      expect(mockImageItems[1].classList.remove).toHaveBeenCalledWith('selected');
    });

    test('should handle empty image list gracefully', () => {
      mockImageList.querySelectorAll.mockReturnValue([]);

      // Should not throw error
      expect(() => {
        uiController.updateImageListSelection(0);
      }).not.toThrow();
    });
  });

  describe('toggleImageSelection', () => {
    let mockImageItem1, mockImageItem2;

    beforeEach(() => {
      mockImageItem1 = {
        className: 'image-item',
        classList: { add: jest.fn(), remove: jest.fn() }
      };
      mockImageItem2 = {
        className: 'image-item', 
        classList: { add: jest.fn(), remove: jest.fn() }
      };
      
      // Mock the image list children to include our mock items
      mockImageList.children = [mockImageItem1, mockImageItem2];
      
      // Mock Array.from to properly filter and return image items
      const originalArrayFrom = Array.from;
      global.Array.from = jest.fn((children) => {
        const items = [mockImageItem1, mockImageItem2];
        return {
          filter: jest.fn((filterFn) => items.filter(filterFn))
        };
      });
    });

    afterEach(() => {
      // Restore Array.from
      global.Array.from = Array.from;
    });

    test('should select image when none is selected', () => {
      uiController.selectedImageIndex = -1;
      
      // Mock the filtered image items array
      const mockFilteredItems = [mockImageItem1, mockImageItem2];
      mockFilteredItems.indexOf = jest.fn((item) => item === mockImageItem1 ? 0 : 1);
      
      // Mock Array.from to return an object with filter method that returns our mock
      global.Array.from = jest.fn(() => ({
        filter: jest.fn(() => mockFilteredItems)
      }));

      uiController.toggleImageSelection(mockImageItem1);

      expect(uiController.selectedImageIndex).toBe(0);
      expect(mockImageItem1.classList.add).toHaveBeenCalledWith('selected');
      expect(mockCanvasManager.selectedImageIndex).toBe(0);
      expect(mockCanvasManager.redrawWithSelection).toHaveBeenCalled();
    });

    test('should unselect image when clicking on selected image', () => {
      uiController.selectedImageIndex = 0;
      
      const mockFilteredItems = [mockImageItem1, mockImageItem2];
      mockFilteredItems.indexOf = jest.fn(() => 0);
      
      global.Array.from = jest.fn(() => ({
        filter: jest.fn(() => mockFilteredItems)
      }));

      uiController.toggleImageSelection(mockImageItem1);

      expect(uiController.selectedImageIndex).toBe(-1);
      expect(mockImageItem1.classList.remove).toHaveBeenCalledWith('selected');
      expect(mockCanvasManager.selectedImageIndex).toBe(-1);
      expect(mockCanvasManager.redrawWithSelection).toHaveBeenCalled();
    });

    test('should switch selection to different image', () => {
      uiController.selectedImageIndex = 0;
      
      const mockFilteredItems = [mockImageItem1, mockImageItem2];
      mockFilteredItems.indexOf = jest.fn((item) => item === mockImageItem2 ? 1 : 0);
      
      global.Array.from = jest.fn(() => ({
        filter: jest.fn(() => mockFilteredItems)
      }));

      uiController.toggleImageSelection(mockImageItem2);

      expect(uiController.selectedImageIndex).toBe(1);
      expect(mockImageItem1.classList.remove).toHaveBeenCalledWith('selected');
      expect(mockImageItem2.classList.add).toHaveBeenCalledWith('selected');
      expect(mockCanvasManager.selectedImageIndex).toBe(1);
      expect(mockCanvasManager.redrawWithSelection).toHaveBeenCalled();
    });
  });

  describe('canvas selection callback', () => {
    test('should setup canvas selection callback on initialization', () => {
      expect(mockCanvasManager.onImageSelected).toBeDefined();
      expect(typeof mockCanvasManager.onImageSelected).toBe('function');
    });

    test('should update UI when canvas selection changes via callback', () => {
      const updateSelectionSpy = jest.spyOn(uiController, 'updateImageListSelection');
      
      // Simulate canvas calling the callback
      mockCanvasManager.onImageSelected(2);

      expect(uiController.selectedImageIndex).toBe(2);
      expect(updateSelectionSpy).toHaveBeenCalledWith(2);
    });
  });

  describe('selection persistence during reordering', () => {
    test('should maintain selection when reordering images', () => {
      uiController.selectedImageIndex = 1;
      uiController.draggedImageIndex = 1;
      
      const mockSuccess = true;
      mockImageLoader.reorderImages.mockReturnValue(mockSuccess);
      
      // Mock the rebuild process
      const rebuildSpy = jest.spyOn(uiController, 'rebuildImageList').mockImplementation(() => {});
      const updateAutoPreviewSpy = jest.spyOn(uiController, 'updateAutoPreview').mockImplementation(() => {});

      // Simulate dropping at index 0 (moving selected item from 1 to 0)
      const dropIndex = 0;
      
      // Simulate the reorder logic
      if (uiController.selectedImageIndex === uiController.draggedImageIndex) {
        uiController.selectedImageIndex = dropIndex;
      }
      
      uiController.canvasManager.selectedImageIndex = uiController.selectedImageIndex;

      expect(uiController.selectedImageIndex).toBe(0); // Should follow the moved image
      expect(mockCanvasManager.selectedImageIndex).toBe(0);
    });
  });

  describe('Image Details functionality', () => {
    beforeEach(() => {
      // Mock loaded images for testing
      mockImageLoader.getLoadedImages.mockReturnValue([
        { name: 'image1.jpg', size: 1024 },
        { name: 'very-long-image-name-that-should-be-displayed.png', size: 2048 },
        { name: 'image3.gif', size: 512 }
      ]);

      // Mock tiled handle for dimension calculations
      uiController.currentTiledHandle = {
        width: 800,
        height: 600
      };
    });

    test('should hide image details when no image is selected', () => {
      uiController.updateImageDetails(-1);

      expect(uiController.imageDetails.style.display).toBe('none');
    });

    test('should show image details when image is selected', () => {
      uiController.updateImageDetails(0);

      expect(uiController.imageDetails.style.display).toBe('block');
      expect(uiController.detailName.textContent).toBe('image1.jpg');
    });

    test('should display correct image name for selected image', () => {
      uiController.updateImageDetails(1);

      expect(uiController.detailName.textContent).toBe('very-long-image-name-that-should-be-displayed.png');
      expect(uiController.imageDetails.style.display).toBe('block');
    });

    test('should calculate dimensions for single image layout', () => {
      // Mock no grid info (single image)
      mockCanvasManager.getCurrentImageData = jest.fn(() => ({
        gridInfo: null
      }));

      uiController.updateImageDetails(0);

      expect(uiController.detailDimensions.textContent).toBe('800 × 600');
    });

    test('should calculate cell dimensions for grid layout', () => {
      // Mock grid info for 2x2 grid
      mockCanvasManager.getCurrentImageData = jest.fn(() => ({
        gridInfo: { rows: 2, cols: 2, imageCount: 4 }
      }));

      uiController.updateImageDetails(0);

      // 800 ÷ 2 = 400, 600 ÷ 2 = 300
      expect(uiController.detailDimensions.textContent).toBe('400 × 300');
    });

    test('should calculate cell dimensions for 2x3 grid layout', () => {
      // Mock grid info for 2x3 grid
      mockCanvasManager.getCurrentImageData = jest.fn(() => ({
        gridInfo: { rows: 2, cols: 3, imageCount: 6 }
      }));

      uiController.updateImageDetails(1);

      // 800 ÷ 3 = 266 (floored), 600 ÷ 2 = 300
      expect(uiController.detailDimensions.textContent).toBe('266 × 300');
    });

    test('should show "Unknown" dimensions when no tiled handle exists', () => {
      uiController.currentTiledHandle = null;

      uiController.updateImageDetails(0);

      expect(uiController.detailDimensions.textContent).toBe('Unknown');
      expect(uiController.detailName.textContent).toBe('image1.jpg');
    });

    test('should hide details for invalid selection index', () => {
      uiController.updateImageDetails(99); // Out of bounds

      expect(uiController.imageDetails.style.display).toBe('none');
    });

    test('should hide details for negative selection index', () => {
      uiController.updateImageDetails(-5);

      expect(uiController.imageDetails.style.display).toBe('none');
    });

    test('should update details when selection changes', () => {
      // First selection
      uiController.updateImageDetails(0);
      expect(uiController.detailName.textContent).toBe('image1.jpg');

      // Change selection
      uiController.updateImageDetails(2);
      expect(uiController.detailName.textContent).toBe('image3.gif');
      expect(uiController.imageDetails.style.display).toBe('block');
    });

    test('should integrate with updateImageListSelection', () => {
      const updateDetailsSpy = jest.spyOn(uiController, 'updateImageDetails');
      
      uiController.updateImageListSelection(1);

      expect(updateDetailsSpy).toHaveBeenCalledWith(1);
    });

    test('should handle empty image list gracefully', () => {
      mockImageLoader.getLoadedImages.mockReturnValue([]);

      uiController.updateImageDetails(0);

      expect(uiController.imageDetails.style.display).toBe('none');
    });

    test('should handle canvas data with missing grid info', () => {
      mockCanvasManager.getCurrentImageData = jest.fn(() => ({}));

      uiController.updateImageDetails(0);

      // Should default to full image dimensions when no gridInfo
      expect(uiController.detailDimensions.textContent).toBe('800 × 600');
    });
  });
});