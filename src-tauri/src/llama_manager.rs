use std::fs;
use std::path::{Path, PathBuf};
use serde::{Serialize, Deserialize};
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager};
use futures_util::StreamExt;
use tokio::io::{AsyncBufReadExt, BufReader};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LlamaServerConfig {
    pub exe_path: Option<String>,
    pub model_path: String,
    pub host: String,
    pub port: u16,
    pub ctx_size: u32,
    pub gpu_layers: u32,
    pub flash_attn: bool,
    pub custom_args: Option<String>,
}

pub struct LlamaServerProcess {
    pub child: tokio::process::Child,
    pub port: u16,
}

impl Drop for LlamaServerProcess {
    fn drop(&mut self) {
        // Force terminate the server process on drop
        let _ = self.child.start_kill();
    }
}

// Get standard paths inside AppData
pub fn get_bin_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    path.push("bin");
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path)
}

pub fn get_models_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    path.push("models");
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path)
}

// Download Llama.cpp binary release from GitHub
pub async fn download_server_release(
    app: AppHandle,
    version: String, // E.g. "b3560"
    build_type: String, // "cpu" or "cuda"
) -> Result<String, String> {
    let bin_dir = get_bin_dir(&app)?;
    
    // Formulate release filename based on selection and current OS (Windows only supported here)
    let filename = if build_type == "cuda" {
        format!("llama-{}-bin-win-cuda-12.4-x64.zip", version)
    } else {
        format!("llama-{}-bin-win-cpu-x64.zip", version)
    };

    let url = format!(
        "https://github.com/ggerganov/llama.cpp/releases/download/{}/{}",
        version, filename
    );

    let temp_zip_path = bin_dir.join(&filename);
    
    // 1. Download ZIP file
    download_file_with_progress(&app, &url, &temp_zip_path, "server").await?;

    // 2. Extract ZIP file
    let _ = app.emit("download-progress", json!({
        "type": "server",
        "status": "extracting",
        "progress": 100
    }));

    extract_zip(&temp_zip_path, &bin_dir)?;
    
    // Clean up temporary zip
    let _ = fs::remove_file(&temp_zip_path);

    // Locate llama-server.exe
    let exe_name = if cfg!(target_os = "windows") { "llama-server.exe" } else { "llama-server" };
    let final_exe_path = bin_dir.join(exe_name);

    if !final_exe_path.exists() {
        return Err("Could not locate llama-server executable inside extracted files".to_string());
    }

    let _ = app.emit("download-progress", json!({
        "type": "server",
        "status": "completed",
        "progress": 100,
        "path": final_exe_path.to_string_lossy().to_string()
    }));

    Ok(final_exe_path.to_string_lossy().to_string())
}

// Download GGUF Model from Hugging Face
pub async fn download_huggingface_model(
    app: AppHandle,
    repo: String,
    filename: String,
) -> Result<String, String> {
    let models_dir = get_models_dir(&app)?;
    let target_path = models_dir.join(&filename);
    
    // Hugging Face resolve URL
    let url = format!("https://huggingface.co/{}/resolve/main/{}", repo, filename);

    download_file_with_progress(&app, &url, &target_path, "model").await?;

    let path_str = target_path.to_string_lossy().to_string();
    let _ = app.emit("download-progress", json!({
        "type": "model",
        "status": "completed",
        "progress": 100,
        "path": path_str.clone()
    }));

    Ok(path_str)
}

// Helper to stream file downloads and emit progress updates to Frontend
async fn download_file_with_progress(
    app: &AppHandle,
    url: &str,
    dest: &Path,
    item_type: &str, // "server" or "model"
) -> Result<(), String> {
    let client = reqwest::Client::new();
    let res = client.get(url)
        .send()
        .await
        .map_err(|e| format!("Failed to submit download request: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Download server returned error code: {}", res.status()));
    }

    let total_size = res.content_length()
        .ok_or_else(|| "Content length not available from download source".to_string())?;

    let mut file = fs::File::create(dest)
        .map_err(|e| format!("Failed to create local destination file: {}", e))?;

    let mut stream = res.bytes_stream();
    let mut downloaded: u64 = 0;
    let mut last_emit = std::time::Instant::now();

    while let Some(chunk_res) = stream.next().await {
        let chunk = chunk_res.map_err(|e| format!("Error during stream chunk read: {}", e))?;
        std::io::Write::write_all(&mut file, &chunk)
            .map_err(|e| format!("Failed to write byte chunk to disk: {}", e))?;
        
        downloaded += chunk.len() as u64;

        // Throttle progress updates to avoid spamming Tauri IPC channel
        if last_emit.elapsed().as_millis() > 200 || downloaded == total_size {
            let progress = ((downloaded as f64 / total_size as f64) * 100.0) as u32;
            let _ = app.emit("download-progress", json!({
                "type": item_type,
                "status": "downloading",
                "progress": progress,
                "downloaded": downloaded,
                "total": total_size
            }));
            last_emit = std::time::Instant::now();
        }
    }

    Ok(())
}

// Helper to extract ZIP files
fn extract_zip(zip_path: &Path, dest_dir: &Path) -> Result<(), String> {
    let file = fs::File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = match file.enclosed_name() {
            Some(path) => dest_dir.join(path),
            None => continue,
        };

        if (*file.name()).ends_with('/') {
            fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(p).map_err(|e| e.to_string())?;
                }
            }
            let mut outfile = fs::File::create(&outpath).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

// Spawns llama-server.exe process with parameters and starts stdout reader pipes
pub fn start_llama_server_process(
    app: AppHandle,
    config: LlamaServerConfig,
) -> Result<LlamaServerProcess, String> {
    let exe_path_str = match config.exe_path {
        Some(ref path) if !path.trim().is_empty() => path.clone(),
        _ => {
            // Check default location
            let default_exe = get_bin_dir(&app)?.join(if cfg!(target_os = "windows") { "llama-server.exe" } else { "llama-server" });
            if !default_exe.exists() {
                return Err("Local llama-server executable not found. Please download it or specify its path in settings.".to_string());
            }
            default_exe.to_string_lossy().to_string()
        }
    };

    let model_path = PathBuf::from(&config.model_path);
    if !model_path.exists() {
        return Err(format!("Specified model file does not exist: {}", config.model_path));
    }

    let mut args = vec![
        "--model".to_string(), config.model_path.clone(),
        "--host".to_string(), config.host.clone(),
        "--port".to_string(), config.port.to_string(),
        "--ctx-size".to_string(), config.ctx_size.to_string(),
        "--n-gpu-layers".to_string(), config.gpu_layers.to_string(),
    ];

    if config.flash_attn {
        args.push("--flash-attn".to_string());
    }

    // Append custom CLI arguments if provided
    if let Some(custom) = config.custom_args {
        for arg in custom.split_whitespace() {
            if !arg.is_empty() {
                args.push(arg.to_string());
            }
        }
    }

    // Spawn Llama Server child process
    let mut command = tokio::process::Command::new(&exe_path_str);
    command.args(&args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    // On Windows, hide command window to keep GUI clean
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = command.spawn()
        .map_err(|e| format!("Failed to spawn local llama-server process: {}", e))?;

    let stdout = child.stdout.take().ok_or("Failed to pipe llama-server stdout channel")?;
    let stderr = child.stderr.take().ok_or("Failed to pipe llama-server stderr channel")?;

    let app_c1 = app.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let _ = app_c1.emit("llama-server-log", line);
        }
    });

    let app_c2 = app.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let _ = app_c2.emit("llama-server-log", line);
        }
    });

    Ok(LlamaServerProcess {
        child,
        port: config.port,
    })
}
