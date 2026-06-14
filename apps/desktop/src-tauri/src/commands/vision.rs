use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

use crate::db::log_action;

pub fn capture_center_screenshot(app_data_dir: &Path) -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let screenshot_dir = app_data_dir.join("screenshots");
        fs::create_dir_all(&screenshot_dir)
            .map_err(|error| format!("Failed to create screenshot directory: {}", error))?;
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let screenshot_path = screenshot_dir.join(format!("jarvis-gateway-ocr-{timestamp}.png"));
        let screenshot_path_string = screenshot_path.to_string_lossy().replace('\'', "''");
        let script = format!(
            "Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; \
             $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; \
             $x = [int]($bounds.Left + ($bounds.Width * 0.2)); \
             $y = [int]($bounds.Top + ($bounds.Height * 0.2)); \
             $width = [int]($bounds.Width * 0.6); \
             $height = [int]($bounds.Height * 0.6); \
             $bitmap = New-Object System.Drawing.Bitmap $width, $height; \
             $graphics = [System.Drawing.Graphics]::FromImage($bitmap); \
             $graphics.CopyFromScreen($x, $y, 0, 0, $bitmap.Size); \
             $bitmap.Save('{path}', [System.Drawing.Imaging.ImageFormat]::Png); \
             $graphics.Dispose(); \
             $bitmap.Dispose();",
            path = screenshot_path_string
        );

        let status = Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .status()
            .map_err(|error| format!("Failed to capture screen region: {}", error))?;
        if !status.success() {
            return Err("Windows could not capture the screen region.".to_string());
        }

        Ok(screenshot_path)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app_data_dir;
        Err("Screen capture is currently implemented for Windows only.".to_string())
    }
}

pub fn extract_ocr_text(db_path: &Path, image_path: &Path) -> Result<String, String> {
    if !image_path.exists() {
        return Err(format!(
            "That image does not exist: {}",
            image_path.to_string_lossy()
        ));
    }

    let output = Command::new("tesseract")
        .arg(image_path)
        .arg("stdout")
        .output()
        .or_else(|_| {
            Command::new(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
                .arg(image_path)
                .arg("stdout")
                .output()
        })
        .map_err(|error| {
            format!(
                "OCR needs Tesseract installed and available on PATH or at C:\\Program Files\\Tesseract-OCR. I could not start it: {}",
                error
            )
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "Tesseract could not read text from that image.".to_string()
        } else {
            stderr
        });
    }

    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    log_action(
        db_path,
        &format!("OCR image {}", image_path.to_string_lossy()),
        "extract_image_ocr_text",
        "success",
        if text.is_empty() { "empty" } else { "text" },
    )?;

    Ok(text)
}

pub fn read_screen_via_ocr(db_path: &Path, app_data_dir: &Path) -> Result<String, String> {
    let screenshot = capture_center_screenshot(app_data_dir)?;
    let text = extract_ocr_text(db_path, &screenshot)?;
    if text.is_empty() {
        Ok("I captured the screen but could not read any text from it.".to_string())
    } else {
        Ok(format!("Here is what I read from the screen:\n{text}"))
    }
}
