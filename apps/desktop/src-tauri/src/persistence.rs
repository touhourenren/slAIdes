use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::thread;
use std::time::Duration;
use tauri::Manager;
use uuid::Uuid;
use zip::write::SimpleFileOptions;
use zip::{ZipArchive, ZipWriter};

const MAX_ARCHIVE_SIZE: u64 = 512 * 1024 * 1024;
const ARCHIVE_VERSION: u64 = 1;
const CURRENT_SCHEMA_VERSION: u64 = 2;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BinaryEntry {
    pub path: String,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveProjectRequest {
    pub path: String,
    pub document_json: String,
    pub metadata_json: String,
    #[serde(default)]
    pub assets: Vec<BinaryEntry>,
    #[serde(default)]
    pub thumbnails: Vec<BinaryEntry>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenProjectResult {
    pub document_json: String,
    pub metadata_json: String,
    pub assets: Vec<BinaryEntryResult>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BinaryEntryResult {
    pub path: String,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StageAssetRequest {
    pub tab_id: String,
    pub hash: String,
    pub extension: String,
    pub bytes: Vec<u8>,
}

fn safe_entry_name(name: &str) -> Result<(), String> {
    let path = Path::new(name);
    if name.contains('\0') || path.is_absolute() {
        return Err(format!("unsafe archive path: {name}"));
    }
    if path.components().any(|part| {
        matches!(
            part,
            Component::ParentDir | Component::RootDir | Component::Prefix(_)
        )
    }) {
        return Err(format!("unsafe archive path: {name}"));
    }
    Ok(())
}

fn validate_json(document_json: &str, metadata_json: &str) -> Result<(), String> {
    let document: serde_json::Value = serde_json::from_str(document_json)
        .map_err(|error| format!("invalid document.json: {error}"))?;
    let metadata: serde_json::Value = serde_json::from_str(metadata_json)
        .map_err(|error| format!("invalid metadata.json: {error}"))?;
    let document_schema = document
        .get("schemaVersion")
        .and_then(|value| value.as_u64())
        .ok_or("document schemaVersion is missing")?;
    if !(1..=CURRENT_SCHEMA_VERSION).contains(&document_schema) {
        return Err("unsupported document schemaVersion".into());
    }
    if metadata.get("format").and_then(|value| value.as_str()) != Some("slaides")
        || metadata
            .get("archiveVersion")
            .and_then(|value| value.as_u64())
            != Some(ARCHIVE_VERSION)
    {
        return Err("unsupported archive metadata".into());
    }
    let metadata_schema = metadata
        .get("schemaVersion")
        .and_then(|value| value.as_u64())
        .ok_or("metadata schemaVersion is missing")?;
    if metadata_schema != document_schema {
        return Err("document and metadata schemaVersion differ".into());
    }
    if !(1..=CURRENT_SCHEMA_VERSION).contains(&metadata_schema) {
        return Err("unsupported metadata schemaVersion".into());
    }
    Ok(())
}

fn write_archive(request: &SaveProjectRequest, output: &Path) -> Result<(), String> {
    validate_json(&request.document_json, &request.metadata_json)?;
    let file = File::create(output).map_err(|error| error.to_string())?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    zip.start_file("document.json", options)
        .map_err(|error| error.to_string())?;
    zip.write_all(request.document_json.as_bytes())
        .map_err(|error| error.to_string())?;
    zip.start_file("metadata.json", options)
        .map_err(|error| error.to_string())?;
    zip.write_all(request.metadata_json.as_bytes())
        .map_err(|error| error.to_string())?;
    for entry in request.assets.iter().chain(request.thumbnails.iter()) {
        safe_entry_name(&entry.path)?;
        zip.start_file(&entry.path, options)
            .map_err(|error| error.to_string())?;
        zip.write_all(&entry.bytes)
            .map_err(|error| error.to_string())?;
    }
    let mut file = zip.finish().map_err(|error| error.to_string())?;
    file.flush().map_err(|error| error.to_string())?;
    file.sync_all().map_err(|error| error.to_string())?;
    Ok(())
}

fn read_archive(path: &Path) -> Result<OpenProjectResult, String> {
    let file = File::open(path).map_err(|error| error.to_string())?;
    if file.metadata().map_err(|error| error.to_string())?.len() > MAX_ARCHIVE_SIZE {
        return Err("archive exceeds size limit".into());
    }
    let mut zip = ZipArchive::new(file).map_err(|error| error.to_string())?;
    let mut seen = HashSet::new();
    let mut total = 0_u64;
    let mut document_bytes = None;
    let mut metadata_bytes = None;
    let mut asset_bytes = HashMap::<String, Vec<u8>>::new();

    for index in 0..zip.len() {
        let mut entry = zip.by_index(index).map_err(|error| error.to_string())?;
        let name = entry.name().to_string();
        safe_entry_name(&name)?;
        if !seen.insert(name.clone()) {
            return Err(format!("duplicate archive entry: {name}"));
        }
        total = total.saturating_add(entry.size());
        if total > MAX_ARCHIVE_SIZE {
            return Err("expanded archive exceeds size limit".into());
        }
        if entry.is_dir() {
            continue;
        }
        let mut bytes = Vec::new();
        entry
            .read_to_end(&mut bytes)
            .map_err(|error| format!("invalid archive entry {name}: {error}"))?;
        match name.as_str() {
            "document.json" => document_bytes = Some(bytes),
            "metadata.json" => metadata_bytes = Some(bytes),
            _ if name.starts_with("assets/") => {
                asset_bytes.insert(name, bytes);
            }
            _ if name.starts_with("thumbnails/") => {
                // Derived data: reading validates CRC, but thumbnails are optional.
            }
            _ => return Err(format!("unexpected archive entry: {name}")),
        }
    }

    let document_json = String::from_utf8(document_bytes.ok_or("missing document.json")?)
        .map_err(|error| format!("document.json is not UTF-8: {error}"))?;
    let metadata_json = String::from_utf8(metadata_bytes.ok_or("missing metadata.json")?)
        .map_err(|error| format!("metadata.json is not UTF-8: {error}"))?;
    validate_json(&document_json, &metadata_json)?;

    let document: serde_json::Value = serde_json::from_str(&document_json)
        .map_err(|error| format!("invalid document.json: {error}"))?;
    let references = document
        .get("assets")
        .and_then(|value| value.as_array())
        .ok_or("document.json assets must be an array")?;
    let mut assets = Vec::new();
    for reference in references {
        let local_path = reference
            .get("localPath")
            .and_then(|value| value.as_str())
            .ok_or("asset reference is missing localPath")?;
        let expected_hash = reference
            .get("hash")
            .and_then(|value| value.as_str())
            .ok_or("asset reference is missing hash")?;
        safe_entry_name(local_path)?;
        if !local_path.starts_with("assets/") {
            return Err(format!("asset path is outside assets/: {local_path}"));
        }
        let bytes = asset_bytes
            .remove(local_path)
            .ok_or_else(|| format!("missing referenced asset: {local_path}"))?;
        let actual_hash = format!("{:x}", Sha256::digest(&bytes));
        if actual_hash != expected_hash {
            return Err(format!("asset hash mismatch: {local_path}"));
        }
        assets.push(BinaryEntryResult {
            path: local_path.to_string(),
            bytes,
        });
    }
    if let Some((path, _)) = asset_bytes.into_iter().next() {
        return Err(format!("unreferenced asset entry: {path}"));
    }

    Ok(OpenProjectResult {
        document_json,
        metadata_json,
        assets,
        warnings: Vec::new(),
    })
}

fn inspect_archive(path: &Path) -> Result<(), String> {
    read_archive(path).map(|_| ())
}

fn atomic_replace(path: &Path, temp: &Path) -> Result<(), String> {
    let backup = path.with_extension("slaides.bak");
    if path.exists() {
        if backup.exists() {
            fs::remove_file(&backup).map_err(|error| error.to_string())?;
        }
        fs::rename(path, &backup).map_err(|error| error.to_string())?;
    }
    let mut last_error = None;
    for attempt in 0..3 {
        match fs::rename(temp, path) {
            Ok(()) => {
                if backup.exists() {
                    let _ = fs::remove_file(&backup);
                }
                if let Some(parent) = path.parent() {
                    if let Ok(directory) = File::open(parent) {
                        let _ = directory.sync_all();
                    }
                }
                return Ok(());
            }
            Err(error) => {
                last_error = Some(error.to_string());
                thread::sleep(Duration::from_millis(50 * (attempt + 1)));
            }
        }
    }
    if !path.exists() && backup.exists() {
        let _ = fs::rename(&backup, path);
    }
    Err(last_error.unwrap_or_else(|| "atomic replace failed".into()))
}

#[tauri::command]
pub fn save_project_atomic(request: SaveProjectRequest) -> Result<(), String> {
    let path = PathBuf::from(&request.path);
    let parent = path.parent().ok_or("project path has no parent")?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let filename = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or("invalid filename")?;
    let temp = parent.join(format!(".{filename}.{}.tmp", Uuid::new_v4()));
    write_archive(&request, &temp)?;
    inspect_archive(&temp)?;
    atomic_replace(&path, &temp)
}

#[tauri::command]
pub fn write_recovery(request: SaveProjectRequest) -> Result<(), String> {
    save_project_atomic(request)
}

#[tauri::command]
pub fn discard_recovery(path: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    if path.extension().and_then(|value| value.to_str()) != Some("slaides") {
        return Err("recovery archive must use the .slaides extension".into());
    }
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
pub fn stage_asset(app: tauri::AppHandle, request: StageAssetRequest) -> Result<String, String> {
    Uuid::parse_str(&request.tab_id).map_err(|_| "invalid tab id")?;
    if request.hash.len() != 64 || !request.hash.bytes().all(|value| value.is_ascii_hexdigit()) {
        return Err("invalid asset hash".into());
    }
    if request.extension.is_empty()
        || !request
            .extension
            .bytes()
            .all(|value| value.is_ascii_alphanumeric())
    {
        return Err("invalid asset extension".into());
    }
    let actual_hash = format!("{:x}", Sha256::digest(&request.bytes));
    if actual_hash != request.hash.to_ascii_lowercase() {
        return Err("asset hash mismatch".into());
    }
    let root = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("staging")
        .join(&request.tab_id);
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    let path = root.join(format!(
        "{}.{}",
        request.hash.to_ascii_lowercase(),
        request.extension.to_ascii_lowercase()
    ));
    if !path.exists() {
        let mut file = File::create(&path).map_err(|error| error.to_string())?;
        file.write_all(&request.bytes)
            .map_err(|error| error.to_string())?;
        file.sync_all().map_err(|error| error.to_string())?;
    }
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn read_asset(app: tauri::AppHandle, path: String) -> Result<Vec<u8>, String> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("staging");
    let requested = PathBuf::from(path);
    if requested
        .components()
        .any(|part| matches!(part, Component::ParentDir))
        || !requested.starts_with(&root)
    {
        return Err("asset path is outside the staging directory".into());
    }
    fs::read(requested).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn discard_staged_assets(app: tauri::AppHandle, tab_id: String) -> Result<(), String> {
    Uuid::parse_str(&tab_id).map_err(|_| "invalid tab id")?;
    let path = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("staging")
        .join(tab_id);
    match fs::remove_dir_all(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
pub fn open_project(path: String) -> Result<OpenProjectResult, String> {
    read_archive(Path::new(&path))
}

#[tauri::command]
pub fn inspect_recovery(path: String) -> Result<OpenProjectResult, String> {
    read_archive(Path::new(&path))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn metadata() -> String {
        r#"{"format":"slaides","archiveVersion":1,"schemaVersion":1}"#.into()
    }

    fn test_path() -> PathBuf {
        std::env::temp_dir().join(format!("slaides-persistence-{}.slaides", Uuid::new_v4()))
    }

    #[test]
    fn rejects_parent_paths() {
        assert!(safe_entry_name("../secret").is_err());
        assert!(safe_entry_name("assets/good.png").is_ok());
    }

    #[test]
    fn archive_round_trip_allows_missing_thumbnails() {
        let path = test_path();
        let request = SaveProjectRequest {
            path: path.to_string_lossy().into_owned(),
            document_json: r#"{"schemaVersion":1,"assets":[]}"#.into(),
            metadata_json: metadata(),
            assets: Vec::new(),
            thumbnails: Vec::new(),
        };
        write_archive(&request, &path).unwrap();
        let opened = read_archive(&path).unwrap();
        assert_eq!(opened.assets.len(), 0);
        let _ = fs::remove_file(path);
    }

    #[test]
    fn rejects_unknown_schema_and_missing_assets() {
        assert!(validate_json(r#"{"schemaVersion":3}"#, &metadata()).is_err());

        let path = test_path();
        let request = SaveProjectRequest {
            path: path.to_string_lossy().into_owned(),
            document_json:
                r#"{"schemaVersion":1,"assets":[{"localPath":"assets/abc.png","hash":"abc"}]}"#
                    .into(),
            metadata_json: metadata(),
            assets: Vec::new(),
            thumbnails: Vec::new(),
        };
        write_archive(&request, &path).unwrap();
        assert!(read_archive(&path)
            .unwrap_err()
            .contains("missing referenced asset"));
        let _ = fs::remove_file(path);
    }
}
