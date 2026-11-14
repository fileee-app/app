//! What the app does natively: the desktops' file dialogs, reading local files in parts, and making
//! thumbnails. TS imports it from `fileee/native`.

use std::{
    fs::File,
    io::{Read, Seek, SeekFrom},
    path::Path,
};

use nsh_core::{file_dialog::OpenDialog, prelude::*};
use sha2::{Digest, Sha256};

#[native_module("fileee/native")]
fn native(registry: &mut Registry) {
    registry.module::<LocalFiles>().module::<Media>();
}

/// A local file to upload.
#[derive(Debug, Clone, JsObject)]
pub struct LocalFile {
    /// Its absolute path.
    pub path: String,
    /// Its name.
    pub name: String,
    /// Its size in bytes.
    pub size: f64,
    /// The folders it sits in under what was picked or dropped, outermost first; empty for a file picked alone.
    pub dirs: Vec<String>,
}

// A dropped or picked folder can hold a whole disk; stop listing well before memory is a concern.
const MAX_FILES: usize = 10_000;

/// Finder drags files as reference URLs (`file:///.file/id=…`), whose paths no file API opens.
#[cfg(target_os = "macos")]
fn real_path(path: &str) -> String {
    use objc2_foundation::{NSString, NSURL};

    if !path.starts_with("/.file/id=") {
        return path.to_owned();
    }

    NSURL::URLWithString(&NSString::from_str(&format!("file://{path}")))
        .and_then(|url| url.filePathURL())
        .and_then(|url| url.path())
        .map_or_else(|| path.to_owned(), |p| p.to_string())
}

#[cfg(not(target_os = "macos"))]
fn real_path(path: &str) -> String {
    path.to_owned()
}

fn collect(path: &Path, dirs: &[String], out: &mut Vec<LocalFile>) -> Result<(), String> {
    let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    let meta = std::fs::metadata(path).map_err(|e| format!("{name}: {e}"))?;

    if meta.is_dir() {
        let inside = [dirs, &[name]].concat();
        let mut entries: Vec<_> = std::fs::read_dir(path)
            .map_err(|e| format!("{}: {e}", path.display()))?
            .filter_map(Result::ok)
            .map(|e| e.path())
            .collect();

        entries.sort();

        for entry in entries {
            // Hidden files (.DS_Store, .git) are almost never meant to be uploaded.
            if entry.file_name().is_some_and(|n| n.to_string_lossy().starts_with('.')) {
                continue;
            }

            collect(&entry, &inside, out)?;
        }
    } else if meta.is_file() {
        if out.len() >= MAX_FILES {
            return Err(format!("That's more than {MAX_FILES} files. Upload fewer at a time."));
        }

        out.push(LocalFile {
            path: path.to_string_lossy().into_owned(),
            name,
            size: meta.len() as f64,
            dirs: dirs.to_vec(),
        });
    }

    Ok(())
}

/// Local files: the system's open dialog, and their bytes.
#[module]
pub struct LocalFiles;

#[module]
impl LocalFiles {
    /// Shows the system's open dialog for files, or for one folder with `folder`, and resolves with
    /// every file to upload (a folder's with the folders they sit in); `[]` when cancelled. Rejects
    /// where there is no file dialog: phones and tablets, and Linux without a file chooser portal.
    pub async fn pick(folder: bool) -> Result<Vec<LocalFile>, String> {
        let dialog = if folder {
            OpenDialog::folders().button_label("Upload")
        } else {
            OpenDialog::files().multiple(true).button_label("Upload")
        };
        let Some(paths) = pick_paths(dialog).await? else {
            return Ok(Vec::new());
        };
        let mut out = Vec::new();

        for path in paths {
            collect(&path, &[], &mut out)?;
        }

        Ok(out)
    }

    /// The files at local paths (`file:` URLs' paths from a drop): a file as it is, a folder's files
    /// with the folders they sit in.
    pub fn expand(paths: Vec<String>) -> Result<Vec<LocalFile>, String> {
        let mut out = Vec::new();

        for path in paths {
            collect(Path::new(&real_path(&path)), &[], &mut out)?;
        }

        Ok(out)
    }

    /// `length` bytes of the file at `path` from `start` (fewer at its end).
    pub fn read(path: String, start: f64, length: f64) -> Result<Vec<u8>, String> {
        let mut file = File::open(&path).map_err(|e| e.to_string())?;
        let mut bytes = Vec::with_capacity(length as usize);

        file.seek(SeekFrom::Start(start as u64)).map_err(|e| e.to_string())?;
        file.take(length as u64).read_to_end(&mut bytes).map_err(|e| e.to_string())?;

        Ok(bytes)
    }

    /// The SHA-256 of the file at `path`, in hex.
    pub fn sha256(path: String) -> Result<String, String> {
        let mut file = File::open(&path).map_err(|e| e.to_string())?;
        let mut hasher = Sha256::new();

        std::io::copy(&mut file, &mut hasher).map_err(|e| e.to_string())?;

        Ok(hex(&hasher.finalize()))
    }
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// What an image holds: its size, a thumbnail and its photo details.
#[derive(Debug, Clone, Default, JsObject)]
pub struct ImageInfo {
    /// Its width in pixels.
    pub width: f64,
    /// Its height in pixels.
    pub height: f64,
    /// A JPEG at most 320 pixels on its longer side.
    pub thumbnail: Vec<u8>,
    /// The camera's make and model.
    pub camera: Option<String>,
    /// When it was taken, as the camera wrote it (`2024-05-01T10:30:00`).
    pub taken_at: Option<String>,
    /// Where it was taken.
    pub latitude: Option<f64>,
    /// Where it was taken.
    pub longitude: Option<f64>,
}

const THUMB_SIZE: u32 = 320;

/// Decoding images, as the web app does in the browser.
#[module]
pub struct Media;

#[module]
impl Media {
    /// Reads an image's size, makes its thumbnail and reads its EXIF. Rejects for bytes that are no
    /// image it can decode (JPEG, PNG, GIF, WebP, BMP, TIFF).
    pub fn image(bytes: Vec<u8>) -> Result<ImageInfo, String> {
        let decoded = image::load_from_memory(&bytes).map_err(|e| e.to_string())?;
        let mut info = exif_of(&bytes);
        let mut thumbnail = Vec::new();

        decoded
            .thumbnail(THUMB_SIZE, THUMB_SIZE)
            .into_rgb8()
            .write_with_encoder(image::codecs::jpeg::JpegEncoder::new_with_quality(&mut thumbnail, 80))
            .map_err(|e| e.to_string())?;

        info.width = decoded.width() as f64;
        info.height = decoded.height() as f64;
        info.thumbnail = thumbnail;

        Ok(info)
    }

    /// The SHA-256 of `bytes`, in hex.
    pub fn sha256(bytes: Vec<u8>) -> String {
        hex(&Sha256::digest(&bytes))
    }
}

fn exif_of(bytes: &[u8]) -> ImageInfo {
    use exif::{In, Tag, Value};

    let Ok(exif) = exif::Reader::new().read_from_container(&mut std::io::Cursor::new(bytes)) else {
        return ImageInfo::default();
    };
    let text = |tag| {
        exif.get_field(tag, In::PRIMARY)
            .map(|f| f.display_value().to_string().trim_matches('"').trim().to_owned())
            .filter(|s| !s.is_empty())
    };
    let degrees = |tag, reference| {
        let field = exif.get_field(tag, In::PRIMARY)?;
        let Value::Rational(parts) = &field.value else { return None };
        let [d, m, s] = parts.get(0..3)? else { return None };
        let value = d.to_f64() + m.to_f64() / 60.0 + s.to_f64() / 3600.0;
        let negative = text(reference).is_some_and(|r| r.starts_with('S') || r.starts_with('W'));

        value.is_finite().then_some(if negative { -value } else { value })
    };
    let camera = [text(Tag::Make), text(Tag::Model)].into_iter().flatten().collect::<Vec<_>>().join(" ");

    ImageInfo {
        camera: (!camera.is_empty()).then(|| camera.chars().take(200).collect()),
        // "2024:05:01 10:30:00" → "2024-05-01T10:30:00"
        taken_at: text(Tag::DateTimeOriginal).filter(|t| t.len() >= 19).map(|t| {
            let t = t.replace(' ', "T");
            format!("{}-{}-{}", &t[0..4], &t[5..7], &t[8..])
        }),
        latitude: degrees(Tag::GPSLatitude, Tag::GPSLatitudeRef).filter(|v| v.abs() <= 90.0),
        longitude: degrees(Tag::GPSLongitude, Tag::GPSLongitudeRef).filter(|v| v.abs() <= 180.0),
        ..ImageInfo::default()
    }
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use objc2_foundation::{NSString, NSURL};

    #[test]
    fn finder_reference_urls_resolve_to_paths() {
        let file = std::fs::canonicalize("Cargo.toml").unwrap();
        let url = NSURL::fileURLWithPath(&NSString::from_str(file.to_str().unwrap()));
        // As a drag's pasteboard has it: `file:///.file/id=…`.
        let uri = url.fileReferenceURL().unwrap().absoluteString().unwrap().to_string();
        let reference = uri.strip_prefix("file://").unwrap();

        assert!(reference.starts_with("/.file/id="), "{reference}");
        assert_eq!(super::real_path(reference), file.to_str().unwrap());
        assert_eq!(super::real_path("/tmp/a b"), "/tmp/a b");
    }
}
