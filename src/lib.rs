use wasm_bindgen::prelude::*;
use image::{DynamicImage, ImageFormat, imageops::FilterType};
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
pub fn resize_image(handle: &ImageHandle, width: u32, height: u32) -> ImageHandle {
    let resized = handle.image.resize(width, height, FilterType::Lanczos3);
    ImageHandle { image: resized }
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

    // Note: export functions use wasm-bindgen and can't be tested in native mode
    // They will be tested in WASM integration tests instead
}