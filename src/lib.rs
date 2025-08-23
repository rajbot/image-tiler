use wasm_bindgen::prelude::*;
use image::{DynamicImage, ImageFormat};
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

    let img1_resized = img1.image.resize_exact(quad_width, quad_height, image::imageops::FilterType::Lanczos3);
    let img2_resized = img2.image.resize_exact(quad_width, quad_height, image::imageops::FilterType::Lanczos3);
    let img3_resized = img3.image.resize_exact(quad_width, quad_height, image::imageops::FilterType::Lanczos3);
    let img4_resized = img4.image.resize_exact(quad_width, quad_height, image::imageops::FilterType::Lanczos3);

    let mut result = DynamicImage::new_rgb8(target_width, target_height);

    image::imageops::overlay(&mut result, &img1_resized, 0, 0);
    image::imageops::overlay(&mut result, &img2_resized, quad_width as i64, 0);
    image::imageops::overlay(&mut result, &img3_resized, 0, quad_height as i64);
    image::imageops::overlay(&mut result, &img4_resized, quad_width as i64, quad_height as i64);

    Ok(ImageHandle { image: result })
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