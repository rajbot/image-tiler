use wasm_bindgen::prelude::*;
use image::{DynamicImage, ImageFormat, RgbaImage, imageops::FilterType};
use std::io::Cursor;

#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);
    
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[wasm_bindgen(start)]
pub fn main() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub struct ImageHandle {
    image: DynamicImage,
}

#[wasm_bindgen]
impl ImageHandle {
    #[wasm_bindgen(constructor)]
    pub fn new() -> ImageHandle {
        ImageHandle {
            image: DynamicImage::new_rgb8(1, 1),
        }
    }

    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.image.width()
    }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.image.height()
    }
}

#[wasm_bindgen]
pub fn create_blank_image(width: u32, height: u32) -> ImageHandle {
    ImageHandle {
        image: DynamicImage::new_rgb8(width, height),
    }
}

#[wasm_bindgen]
pub fn load_image(data: &[u8]) -> Result<ImageHandle, JsValue> {
    let image = image::load_from_memory(data)
        .map_err(|e| JsValue::from_str(&format!("Failed to load image: {}", e)))?;
    
    Ok(ImageHandle { image })
}

#[wasm_bindgen]
pub fn tile_images_2x1(img1: &ImageHandle, img2: &ImageHandle) -> Result<ImageHandle, JsValue> {
    let height = img1.image.height().min(img2.image.height());
    
    let img1_resized = img1.image.resize_exact(
        (img1.image.width() * height) / img1.image.height(),
        height,
        image::imageops::FilterType::Lanczos3
    );
    
    let img2_resized = img2.image.resize_exact(
        (img2.image.width() * height) / img2.image.height(),
        height,
        image::imageops::FilterType::Lanczos3
    );

    let total_width = img1_resized.width() + img2_resized.width();
    let mut result = DynamicImage::new_rgb8(total_width, height);

    image::imageops::overlay(&mut result, &img1_resized, 0, 0);
    image::imageops::overlay(&mut result, &img2_resized, img1_resized.width() as i64, 0);

    Ok(ImageHandle { image: result })
}

#[wasm_bindgen]
pub fn tile_image_with_blank_2x1(img: &ImageHandle) -> Result<ImageHandle, JsValue> {
    let height = img.image.height();
    let width = img.image.width();
    
    let img_resized = img.image.resize_exact(width, height, image::imageops::FilterType::Lanczos3);
    let blank = DynamicImage::new_rgb8(width, height);

    let total_width = width * 2;
    let mut result = DynamicImage::new_rgb8(total_width, height);

    image::imageops::overlay(&mut result, &img_resized, 0, 0);
    image::imageops::overlay(&mut result, &blank, width as i64, 0);

    Ok(ImageHandle { image: result })
}

fn fit_image_in_quadrant(image: &DynamicImage, quad_width: u32, quad_height: u32) -> DynamicImage {
    let img_width = image.width();
    let img_height = image.height();
    
    // Calculate scale to fit within quadrant while maintaining aspect ratio
    let scale_x = quad_width as f32 / img_width as f32;
    let scale_y = quad_height as f32 / img_height as f32;
    let scale = scale_x.min(scale_y);
    
    // Calculate new dimensions
    let new_width = (img_width as f32 * scale) as u32;
    let new_height = (img_height as f32 * scale) as u32;
    
    // Resize the image maintaining aspect ratio
    let resized = image.resize_exact(new_width, new_height, image::imageops::FilterType::Lanczos3);
    
    // Create black quadrant background
    let mut quadrant = DynamicImage::new_rgb8(quad_width, quad_height);
    
    // Center the resized image on the black background
    let x_offset = (quad_width - new_width) / 2;
    let y_offset = (quad_height - new_height) / 2;
    
    image::imageops::overlay(&mut quadrant, &resized, x_offset as i64, y_offset as i64);
    
    quadrant
}

#[wasm_bindgen]
pub fn tile_images_2x2_with_blanks_1(img1: &ImageHandle) -> Result<ImageHandle, JsValue> {
    let target_width = 800;
    let target_height = 800;
    let quad_width = target_width / 2;
    let quad_height = target_height / 2;

    let img1_fitted = fit_image_in_quadrant(&img1.image, quad_width, quad_height);
    let blank = DynamicImage::new_rgb8(quad_width, quad_height);

    let mut result = DynamicImage::new_rgb8(target_width, target_height);

    image::imageops::overlay(&mut result, &img1_fitted, 0, 0);
    image::imageops::overlay(&mut result, &blank, quad_width as i64, 0);
    image::imageops::overlay(&mut result, &blank, 0, quad_height as i64);
    image::imageops::overlay(&mut result, &blank, quad_width as i64, quad_height as i64);

    Ok(ImageHandle { image: result })
}

#[wasm_bindgen]
pub fn tile_images_2x2_with_blanks_2(img1: &ImageHandle, img2: &ImageHandle) -> Result<ImageHandle, JsValue> {
    let target_width = 800;
    let target_height = 800;
    let quad_width = target_width / 2;
    let quad_height = target_height / 2;

    let img1_fitted = fit_image_in_quadrant(&img1.image, quad_width, quad_height);
    let img2_fitted = fit_image_in_quadrant(&img2.image, quad_width, quad_height);
    let blank = DynamicImage::new_rgb8(quad_width, quad_height);

    let mut result = DynamicImage::new_rgb8(target_width, target_height);

    image::imageops::overlay(&mut result, &img1_fitted, 0, 0);
    image::imageops::overlay(&mut result, &img2_fitted, quad_width as i64, 0);
    image::imageops::overlay(&mut result, &blank, 0, quad_height as i64);
    image::imageops::overlay(&mut result, &blank, quad_width as i64, quad_height as i64);

    Ok(ImageHandle { image: result })
}

#[wasm_bindgen]
pub fn tile_images_2x2_with_blanks_3(img1: &ImageHandle, img2: &ImageHandle, img3: &ImageHandle) -> Result<ImageHandle, JsValue> {
    let target_width = 800;
    let target_height = 800;
    let quad_width = target_width / 2;
    let quad_height = target_height / 2;

    let img1_fitted = fit_image_in_quadrant(&img1.image, quad_width, quad_height);
    let img2_fitted = fit_image_in_quadrant(&img2.image, quad_width, quad_height);
    let img3_fitted = fit_image_in_quadrant(&img3.image, quad_width, quad_height);
    let blank = DynamicImage::new_rgb8(quad_width, quad_height);

    let mut result = DynamicImage::new_rgb8(target_width, target_height);

    image::imageops::overlay(&mut result, &img1_fitted, 0, 0);
    image::imageops::overlay(&mut result, &img2_fitted, quad_width as i64, 0);
    image::imageops::overlay(&mut result, &img3_fitted, 0, quad_height as i64);
    image::imageops::overlay(&mut result, &blank, quad_width as i64, quad_height as i64);

    Ok(ImageHandle { image: result })
}

#[wasm_bindgen]
pub fn tile_images_2x2(
    img1: &ImageHandle, 
    img2: &ImageHandle, 
    img3: &ImageHandle, 
    img4: &ImageHandle
) -> Result<ImageHandle, JsValue> {
    let target_width = 800;
    let target_height = 800;
    let quad_width = target_width / 2;
    let quad_height = target_height / 2;

    let img1_fitted = fit_image_in_quadrant(&img1.image, quad_width, quad_height);
    let img2_fitted = fit_image_in_quadrant(&img2.image, quad_width, quad_height);
    let img3_fitted = fit_image_in_quadrant(&img3.image, quad_width, quad_height);
    let img4_fitted = fit_image_in_quadrant(&img4.image, quad_width, quad_height);

    let mut result = DynamicImage::new_rgb8(target_width, target_height);

    image::imageops::overlay(&mut result, &img1_fitted, 0, 0);
    image::imageops::overlay(&mut result, &img2_fitted, quad_width as i64, 0);
    image::imageops::overlay(&mut result, &img3_fitted, 0, quad_height as i64);
    image::imageops::overlay(&mut result, &img4_fitted, quad_width as i64, quad_height as i64);

    Ok(ImageHandle { image: result })
}

#[wasm_bindgen]  
pub fn tile_images_grid_1(rows: u32, cols: u32, img1: &ImageHandle) -> Result<ImageHandle, JsValue> {
    tile_images_grid_impl(rows, cols, vec![img1])
}

#[wasm_bindgen]  
pub fn tile_images_grid_2(rows: u32, cols: u32, img1: &ImageHandle, img2: &ImageHandle) -> Result<ImageHandle, JsValue> {
    tile_images_grid_impl(rows, cols, vec![img1, img2])
}

#[wasm_bindgen]  
pub fn tile_images_grid_3(rows: u32, cols: u32, img1: &ImageHandle, img2: &ImageHandle, img3: &ImageHandle) -> Result<ImageHandle, JsValue> {
    tile_images_grid_impl(rows, cols, vec![img1, img2, img3])
}

#[wasm_bindgen]  
pub fn tile_images_grid_4(rows: u32, cols: u32, img1: &ImageHandle, img2: &ImageHandle, img3: &ImageHandle, img4: &ImageHandle) -> Result<ImageHandle, JsValue> {
    tile_images_grid_impl(rows, cols, vec![img1, img2, img3, img4])
}

#[wasm_bindgen]  
pub fn tile_images_grid_5(rows: u32, cols: u32, img1: &ImageHandle, img2: &ImageHandle, img3: &ImageHandle, img4: &ImageHandle, img5: &ImageHandle) -> Result<ImageHandle, JsValue> {
    tile_images_grid_impl(rows, cols, vec![img1, img2, img3, img4, img5])
}

#[wasm_bindgen]  
pub fn tile_images_grid_6(rows: u32, cols: u32, img1: &ImageHandle, img2: &ImageHandle, img3: &ImageHandle, img4: &ImageHandle, img5: &ImageHandle, img6: &ImageHandle) -> Result<ImageHandle, JsValue> {
    tile_images_grid_impl(rows, cols, vec![img1, img2, img3, img4, img5, img6])
}

#[wasm_bindgen]  
pub fn tile_images_grid_7(rows: u32, cols: u32, img1: &ImageHandle, img2: &ImageHandle, img3: &ImageHandle, img4: &ImageHandle, img5: &ImageHandle, img6: &ImageHandle, img7: &ImageHandle) -> Result<ImageHandle, JsValue> {
    tile_images_grid_impl(rows, cols, vec![img1, img2, img3, img4, img5, img6, img7])
}

#[wasm_bindgen]  
pub fn tile_images_grid_8(rows: u32, cols: u32, img1: &ImageHandle, img2: &ImageHandle, img3: &ImageHandle, img4: &ImageHandle, img5: &ImageHandle, img6: &ImageHandle, img7: &ImageHandle, img8: &ImageHandle) -> Result<ImageHandle, JsValue> {
    tile_images_grid_impl(rows, cols, vec![img1, img2, img3, img4, img5, img6, img7, img8])
}

#[wasm_bindgen]  
pub fn tile_images_grid_9(rows: u32, cols: u32, img1: &ImageHandle, img2: &ImageHandle, img3: &ImageHandle, img4: &ImageHandle, img5: &ImageHandle, img6: &ImageHandle, img7: &ImageHandle, img8: &ImageHandle, img9: &ImageHandle) -> Result<ImageHandle, JsValue> {
    tile_images_grid_impl(rows, cols, vec![img1, img2, img3, img4, img5, img6, img7, img8, img9])
}

fn tile_images_grid_impl(rows: u32, cols: u32, images: Vec<&ImageHandle>) -> Result<ImageHandle, JsValue> {
    if rows == 0 || cols == 0 {
        return Err(JsValue::from_str("Rows and columns must be greater than 0"));
    }

    console_log!("Grid placement: {}x{} grid, {} images", rows, cols, images.len());

    let grid_capacity = (rows * cols) as usize;

    // Calculate dimensions for each cell based on the largest image
    let mut max_width = 0;
    let mut max_height = 0;
    
    for img in &images {
        if img.image.width() > max_width {
            max_width = img.image.width();
        }
        if img.image.height() > max_height {
            max_height = img.image.height();
        }
    }

    let cell_width = max_width;
    let cell_height = max_height;
    let final_width = cell_width * cols;
    let final_height = cell_height * rows;

    // Create result image with black background
    let mut result = RgbaImage::new(final_width, final_height);
    
    // Fill with black
    for pixel in result.pixels_mut() {
        *pixel = image::Rgba([0, 0, 0, 255]);
    }

    // Place images in grid
    console_log!("Grid placement: {}x{} grid, {} images", rows, cols, images.len());
    for (index, img_handle) in images.iter().enumerate().take(grid_capacity) {
        let row = (index as u32) / cols;
        let col = (index as u32) % cols;
        
        console_log!("Image {}: placing at grid position ({}, {}) -> pixel offset ({}, {})", 
                    index, row, col, col * cell_width, row * cell_height);
        
        let fitted_image = fit_image_in_quadrant(&img_handle.image, cell_width, cell_height);
        
        // Calculate position to center the fitted image in the cell
        let x_offset = col * cell_width;
        let y_offset = row * cell_height;
        
        // Overlay the fitted image
        image::imageops::overlay(&mut result, &fitted_image, x_offset as i64, y_offset as i64);
    }

    Ok(ImageHandle { image: DynamicImage::ImageRgba8(result) })
}

#[wasm_bindgen]
pub fn resize_image(handle: &ImageHandle, width: u32, height: u32) -> ImageHandle {
    let resized = handle.image.resize(width, height, FilterType::Lanczos3);
    ImageHandle { image: resized }
}

fn create_proxy_image_impl(handle: &ImageHandle, max_dimension: u32) -> Result<ImageHandle, String> {
    let original_width = handle.image.width();
    let original_height = handle.image.height();
    
    // Check if proxy is needed (either dimension exceeds max_dimension)
    if original_width <= max_dimension && original_height <= max_dimension {
        return Ok(ImageHandle { image: handle.image.clone() });
    }
    
    // Calculate new dimensions maintaining aspect ratio
    let (new_width, new_height) = if original_width > original_height {
        // Landscape: limit width to max_dimension
        let new_width = max_dimension;
        let new_height = (original_height as f32 * (max_dimension as f32 / original_width as f32)) as u32;
        (new_width, new_height.max(1))
    } else {
        // Portrait or square: limit height to max_dimension
        let new_height = max_dimension;
        let new_width = (original_width as f32 * (max_dimension as f32 / original_height as f32)) as u32;
        (new_width.max(1), new_height)
    };
    
    // Resize with high-quality filter for good preview quality
    let proxy_image = handle.image.resize(new_width, new_height, FilterType::Lanczos3);
    
    Ok(ImageHandle { image: proxy_image })
}

#[wasm_bindgen]
pub fn create_proxy_image(handle: &ImageHandle, max_dimension: u32) -> Result<ImageHandle, JsValue> {
    let original_width = handle.image.width();
    let original_height = handle.image.height();
    
    console_log!("Creating proxy image: original {}x{}, max dimension {}", 
                 original_width, original_height, max_dimension);
    
    match create_proxy_image_impl(handle, max_dimension) {
        Ok(proxy_handle) => {
            console_log!("Proxy dimensions: {}x{}", proxy_handle.image.width(), proxy_handle.image.height());
            Ok(proxy_handle)
        },
        Err(e) => Err(JsValue::from_str(&e))
    }
}

#[wasm_bindgen]
pub fn needs_proxy_image(handle: &ImageHandle, threshold: u32) -> bool {
    let width = handle.image.width();
    let height = handle.image.height();
    width > threshold || height > threshold
}

#[wasm_bindgen]
pub fn zoom_image(handle: &ImageHandle, zoom_percentage: u32) -> Result<ImageHandle, JsValue> {
    if zoom_percentage == 0 {
        return Err(JsValue::from_str("Zoom percentage must be greater than 0"));
    }
    
    let zoom_factor = zoom_percentage as f32 / 100.0;
    let original_width = handle.image.width();
    let original_height = handle.image.height();
    
    console_log!("Zooming image {}x{} by {}%", original_width, original_height, zoom_percentage);
    
    if zoom_percentage == 100 {
        // No zoom needed, return copy of original
        return Ok(ImageHandle { image: handle.image.clone() });
    } else if zoom_percentage > 100 {
        // Zoom in: crop to center and scale up
        let crop_factor = 1.0 / zoom_factor;
        let crop_width = (original_width as f32 * crop_factor) as u32;
        let crop_height = (original_height as f32 * crop_factor) as u32;
        
        // Ensure minimum crop size
        let crop_width = crop_width.max(1);
        let crop_height = crop_height.max(1);
        
        // Center the crop
        let crop_x = (original_width.saturating_sub(crop_width)) / 2;
        let crop_y = (original_height.saturating_sub(crop_height)) / 2;
        
        console_log!("Zoom in: cropping {}x{} at ({},{}) then scaling to {}x{}", 
                     crop_width, crop_height, crop_x, crop_y, original_width, original_height);
        
        let cropped = handle.image.crop_imm(crop_x, crop_y, crop_width, crop_height);
        let zoomed = cropped.resize(original_width, original_height, FilterType::Lanczos3);
        Ok(ImageHandle { image: zoomed })
    } else {
        // Zoom out: resize smaller and center with transparent padding
        let new_width = (original_width as f32 * zoom_factor) as u32;
        let new_height = (original_height as f32 * zoom_factor) as u32;
        
        // Ensure minimum size
        let new_width = new_width.max(1);
        let new_height = new_height.max(1);
        
        console_log!("Zoom out: resizing to {}x{} then centering in {}x{}", 
                     new_width, new_height, original_width, original_height);
        
        let resized = handle.image.resize(new_width, new_height, FilterType::Lanczos3);
        
        // Create transparent canvas at original size
        let mut result = DynamicImage::new_rgba8(original_width, original_height);
        
        // Center the resized image
        let x_offset = (original_width.saturating_sub(new_width)) / 2;
        let y_offset = (original_height.saturating_sub(new_height)) / 2;
        
        image::imageops::overlay(&mut result, &resized, x_offset as i64, y_offset as i64);
        Ok(ImageHandle { image: result })
    }
}

#[wasm_bindgen]
pub fn zoom_and_pan_image(
    handle: &ImageHandle, 
    zoom_percentage: u32, 
    offset_x: i32, 
    offset_y: i32
) -> Result<ImageHandle, JsValue> {
    if zoom_percentage == 0 {
        return Err(JsValue::from_str("Zoom percentage must be greater than 0"));
    }
    
    let zoom_factor = zoom_percentage as f32 / 100.0;
    let original_width = handle.image.width();
    let original_height = handle.image.height();
    
    console_log!("Zooming and panning image {}x{} by {}% with offset ({}, {})", 
                 original_width, original_height, zoom_percentage, offset_x, offset_y);
    
    if zoom_percentage == 100 && offset_x == 0 && offset_y == 0 {
        // No transformation needed, return copy of original
        return Ok(ImageHandle { image: handle.image.clone() });
    }
    
    if zoom_percentage == 100 && (offset_x != 0 || offset_y != 0) {
        // 100% zoom with offset: treat as zoom out case to apply offset
        let _zoom_factor = 1.0;
        let _new_width = original_width;
        let _new_height = original_height;
        
        // Create transparent canvas at original size
        let mut result = DynamicImage::new_rgba8(original_width, original_height);
        
        // Apply offset to positioning (center + offset)
        let base_x_offset = 0; // Since we're not resizing, base is 0
        let base_y_offset = 0;
        
        let x_offset = (base_x_offset as i32 + offset_x).max(-(original_width as i32)).min(original_width as i32);
        let y_offset = (base_y_offset as i32 + offset_y).max(-(original_height as i32)).min(original_height as i32);
        
        image::imageops::overlay(&mut result, &handle.image, x_offset as i64, y_offset as i64);
        return Ok(ImageHandle { image: result });
    }
    
    if zoom_percentage > 100 {
        // Zoom in: crop with offset and scale up
        let crop_factor = 1.0 / zoom_factor;
        let crop_width = (original_width as f32 * crop_factor) as u32;
        let crop_height = (original_height as f32 * crop_factor) as u32;
        
        // Ensure minimum crop size
        let crop_width = crop_width.max(1);
        let crop_height = crop_height.max(1);
        
        // Apply offset to crop position 
        // For zoom in: positive offset should move the view right/down, which means cropping from left/top
        // So we subtract the offset from the crop position
        let base_crop_x = (original_width.saturating_sub(crop_width)) / 2;
        let base_crop_y = (original_height.saturating_sub(crop_height)) / 2;
        
        // Scale offset by crop factor (smaller crop means offset has more effect)
        let scaled_offset_x = (offset_x as f32 * crop_factor) as i32;
        let scaled_offset_y = (offset_y as f32 * crop_factor) as i32;
        
        // Invert the offset direction for cropping (positive offset = crop from left/top)
        let crop_x = (base_crop_x as i32 - scaled_offset_x).max(0).min((original_width - crop_width) as i32) as u32;
        let crop_y = (base_crop_y as i32 - scaled_offset_y).max(0).min((original_height - crop_height) as i32) as u32;
        
        console_log!("Zoom in with pan: cropping {}x{} at ({},{}) then scaling to {}x{}", 
                     crop_width, crop_height, crop_x, crop_y, original_width, original_height);
        
        let cropped = handle.image.crop_imm(crop_x, crop_y, crop_width, crop_height);
        let zoomed = cropped.resize(original_width, original_height, FilterType::Lanczos3);
        Ok(ImageHandle { image: zoomed })
    } else {
        // Zoom out: resize smaller and position with offset
        let new_width = (original_width as f32 * zoom_factor) as u32;
        let new_height = (original_height as f32 * zoom_factor) as u32;
        
        // Ensure minimum size
        let new_width = new_width.max(1);
        let new_height = new_height.max(1);
        
        console_log!("Zoom out with pan: resizing to {}x{} then positioning with offset ({},{}) in {}x{}", 
                     new_width, new_height, offset_x, offset_y, original_width, original_height);
        
        let resized = handle.image.resize(new_width, new_height, FilterType::Lanczos3);
        
        // Create transparent canvas at original size
        let mut result = DynamicImage::new_rgba8(original_width, original_height);
        
        // Apply offset to positioning
        let base_x_offset = (original_width.saturating_sub(new_width)) / 2;
        let base_y_offset = (original_height.saturating_sub(new_height)) / 2;
        
        let x_offset = (base_x_offset as i32 + offset_x).max(0).min((original_width - new_width) as i32) as u32;
        let y_offset = (base_y_offset as i32 + offset_y).max(0).min((original_height - new_height) as i32) as u32;
        
        image::imageops::overlay(&mut result, &resized, x_offset as i64, y_offset as i64);
        Ok(ImageHandle { image: result })
    }
}

#[wasm_bindgen]
pub fn export_image(handle: &ImageHandle, format: &str) -> Result<Vec<u8>, JsValue> {
    let mut buffer = Vec::new();
    let mut cursor = Cursor::new(&mut buffer);

    let image_format = match format.to_lowercase().as_str() {
        "png" => ImageFormat::Png,
        "jpeg" | "jpg" => ImageFormat::Jpeg,
        "webp" => ImageFormat::WebP,
        _ => return Err(JsValue::from_str("Unsupported format")),
    };

    handle.image.write_to(&mut cursor, image_format)
        .map_err(|e| JsValue::from_str(&format!("Failed to export image: {}", e)))?;

    Ok(buffer)
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{RgbImage, ImageBuffer, Rgb};

    fn create_test_image(width: u32, height: u32, color: [u8; 3]) -> DynamicImage {
        let img: RgbImage = ImageBuffer::from_fn(width, height, |_, _| {
            Rgb(color)
        });
        DynamicImage::ImageRgb8(img)
    }

    #[test]
    fn test_fit_image_in_quadrant_landscape() {
        let landscape_img = create_test_image(200, 100, [255, 0, 0]); // Red 2:1 landscape
        let fitted = fit_image_in_quadrant(&landscape_img, 400, 400);
        
        assert_eq!(fitted.width(), 400);
        assert_eq!(fitted.height(), 400);
        
        // Image should be scaled to fit width, centered vertically
        // Original was 200x100, scaled to 400x200, centered in 400x400 quadrant
    }

    #[test]
    fn test_fit_image_in_quadrant_portrait() {
        let portrait_img = create_test_image(100, 200, [0, 255, 0]); // Green 1:2 portrait
        let fitted = fit_image_in_quadrant(&portrait_img, 400, 400);
        
        assert_eq!(fitted.width(), 400);
        assert_eq!(fitted.height(), 400);
        
        // Image should be scaled to fit height, centered horizontally
        // Original was 100x200, scaled to 200x400, centered in 400x400 quadrant
    }

    #[test]
    fn test_fit_image_in_quadrant_square() {
        let square_img = create_test_image(300, 300, [0, 0, 255]); // Blue square
        let fitted = fit_image_in_quadrant(&square_img, 400, 400);
        
        assert_eq!(fitted.width(), 400);
        assert_eq!(fitted.height(), 400);
        
        // Square image should be scaled to fit exactly
    }

    // create_blank_image is a WASM function - tested in integration tests

    // Test helper function directly (not exposed to WASM)
    #[test]
    fn test_internal_image_operations() {
        let test_img = create_test_image(100, 100, [255, 0, 0]);
        
        // Test direct image operations that don't involve WASM bindings
        assert_eq!(test_img.width(), 100);
        assert_eq!(test_img.height(), 100);
    }

    #[test]
    fn test_create_proxy_image_large() {
        let large_img = create_test_image(2000, 1500, [255, 0, 0]); // Red 2000x1500
        let handle = ImageHandle { image: large_img };
        
        // Should create proxy with max dimension 800
        let proxy_result = create_proxy_image_impl(&handle, 800);
        assert!(proxy_result.is_ok());
        
        let proxy = proxy_result.unwrap();
        // Landscape image should be limited by width
        assert_eq!(proxy.image.width(), 800);
        assert_eq!(proxy.image.height(), 600); // 1500 * (800/2000) = 600
    }

    #[test]
    fn test_create_proxy_image_small() {
        let small_img = create_test_image(600, 400, [0, 255, 0]); // Green 600x400
        let handle = ImageHandle { image: small_img };
        
        // Should return original (no proxy needed)
        let proxy_result = create_proxy_image_impl(&handle, 800);
        assert!(proxy_result.is_ok());
        
        let proxy = proxy_result.unwrap();
        assert_eq!(proxy.image.width(), 600);
        assert_eq!(proxy.image.height(), 400);
    }

    #[test]
    fn test_needs_proxy_image() {
        let small_img = ImageHandle { image: create_test_image(800, 600, [255, 0, 0]) };
        let large_img = ImageHandle { image: create_test_image(1500, 1200, [0, 255, 0]) };
        
        assert!(!needs_proxy_image(&small_img, 1000));
        assert!(needs_proxy_image(&large_img, 1000));
    }

    // Note: export functions use wasm-bindgen and can't be tested in native mode
    // They will be tested in WASM integration tests instead
}