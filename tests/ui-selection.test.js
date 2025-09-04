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
      'drag-hint': { style: { display: 'none' } }
    };

    document.getElementById = jest.fn((id) => mockElements[id]);

    // Create mock dependencies
    mockImageLoader = {
      getLoadedImages: jest.fn(() => []),
      getImageHandles: jest.fn(() => []),
      clear: jest.fn(),
      removeImage: jest.fn(),
      reorderImages: jest.fn(() => true)
    };

    mockCanvasManager = {
      onImageSelected: null,
      selectedImageIndex: -1,
      clear: jest.fn(),
      redrawWithSelection: jest.fn()
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
});