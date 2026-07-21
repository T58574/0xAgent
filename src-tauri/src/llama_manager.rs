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
    pub threads: u32,
    pub gpu_layers: u32,

    // Sampling params
    pub temp: f32,
    pub predict: i32,
    pub batch_size: u32,
    pub ubatch_size: u32,
    pub min_p: f32,
    pub top_k: u32,
    pub top_p: f32,
    pub repeat_penalty: f32,
    pub seed: i32,
    pub presence_penalty: f32,
    pub frequency_penalty: f32,

    // Flags
    pub flash_attn: bool,
    pub embedding: bool,
    pub cont_batching: bool,
    pub prompt_cache: bool,
    pub mlock: bool,
    pub mmap: bool,

    pub custom_args: Option<String>,
}

pub struct LlamaServerProcess {
    pub child: tokio::process::Child,
    pub port: u16,
}

impl Drop for LlamaServerProcess {
    fn drop(&mut self) {
        let _ = self.child.start_kill();
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LlamaAsset {
    pub name: String,
    pub size: u64,
    pub browser_download_url: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LlamaRelease {
    pub tag_name: String,
    pub name: String,
    pub published_at: String,
    pub body: String,
    pub assets: Vec<LlamaAsset>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SystemSpecs {
    pub cpu_cores: usize,
    pub total_ram_gb: f64,
    pub gpus: Vec<String>,
    pub suggested_preset: String,
}

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

// Fetch available releases from GitHub API
pub async fn get_github_releases() -> Result<Vec<LlamaRelease>, String> {
    let client = reqwest::Client::builder()
        .user_agent("0xAgent")
        .build()
        .map_err(|e| e.to_string())?;

    let res = client.get("https://api.github.com/repos/ggerganov/llama.cpp/releases?per_page=10")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("GitHub API returned error: {}", res.status()));
    }

    let releases: Vec<serde_json::Value> = res.json().await.map_err(|e| e.to_string())?;
    let mut result = Vec::new();

    for r in releases {
        let tag_name = r.get("tag_name").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let name = r.get("name").and_then(|v| v.as_str()).unwrap_or(&tag_name).to_string();
        let published_at = r.get("published_at").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let body = r.get("body").and_then(|v| v.as_str()).unwrap_or("").to_string();

        let mut assets = Vec::new();
        if let Some(assets_arr) = r.get("assets").and_then(|v| v.as_array()) {
            for a in assets_arr {
                let name = a.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                if name.ends_with(".zip") && (name.contains("-win-") || name.contains("-pc-")) {
                    let size = a.get("size").and_then(|v| v.as_u64()).unwrap_or(0);
                    let browser_download_url = a.get("browser_download_url").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    assets.push(LlamaAsset {
                        name,
                        size,
                        browser_download_url,
                    });
                }
            }
        }

        result.push(LlamaRelease {
            tag_name,
            name,
            published_at,
            body,
            assets,
        });
    }

    Ok(result)
}

// Auto-detect PC specifications under Windows
pub fn get_system_specs() -> Result<SystemSpecs, String> {
    let cpu_cores = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4);

    let mut total_ram_gb = 8.0;
    let mut gpus = Vec::new();

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = std::process::Command::new("powershell");
        cmd.args(&["-Command", "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory"]);
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);

        if let Ok(output) = cmd.output() {
            let s = String::from_utf8_lossy(&output.stdout);
            if let Ok(bytes) = s.trim().parse::<u64>() {
                total_ram_gb = (bytes as f64) / (1024.0 * 1024.0 * 1024.0);
            }
        }

        let mut g_cmd = std::process::Command::new("powershell");
        g_cmd.args(&["-Command", "Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name"]);
        g_cmd.creation_flags(CREATE_NO_WINDOW);

        if let Ok(output) = g_cmd.output() {
            let s = String::from_utf8_lossy(&output.stdout);
            for line in s.lines() {
                let name = line.trim();
                if !name.is_empty() && !gpus.contains(&name.to_string()) {
                    gpus.push(name.to_string());
                }
            }
        }
    }

    let has_nvidia = gpus.iter().any(|name| name.to_lowercase().contains("nvidia"));
    let has_amd = gpus.iter().any(|name| name.to_lowercase().contains("amd") || name.to_lowercase().contains("radeon"));

    let suggested_preset = if total_ram_gb >= 24.0 && has_nvidia {
        "Powerful Nvidia GPU (RTX / 24GB+ RAM)".to_string()
    } else if total_ram_gb >= 16.0 && has_amd {
        "AMD Radeon GPU (HIP / 16GB+ RAM)".to_string()
    } else if total_ram_gb >= 16.0 {
        "Medium Spec PC (CPU/Low-GPU / 16GB RAM)".to_string()
    } else {
        "Weak PC (CPU-only / 8GB RAM)".to_string()
    };

    Ok(SystemSpecs {
        cpu_cores,
        total_ram_gb,
        gpus,
        suggested_preset,
    })
}

// Scans custom models path for downloaded *.gguf model files
pub fn list_downloaded_models(custom_dir: Option<String>, app: &AppHandle) -> Result<Vec<String>, String> {
    let models_dir = match custom_dir {
        Some(ref path) if !path.trim().is_empty() => PathBuf::from(path),
        _ => get_models_dir(app)?,
    };

    let mut models = Vec::new();
    if let Ok(entries) = fs::read_dir(models_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext == "gguf" {
                        if let Some(name) = path.file_name() {
                            models.push(name.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
    }

    models.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
    Ok(models)
}

// Download Llama.cpp binary release ZIP from a direct asset URL and unzip it
pub async fn download_server_release(
    app: AppHandle,
    url: String,
    filename: String,
) -> Result<String, String> {
    let bin_dir = get_bin_dir(&app)?;
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
    let mut final_exe_path = bin_dir.join(exe_name);

    if !final_exe_path.exists() {
        if let Ok(entries) = fs::read_dir(&bin_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_dir() {
                    let nested = p.join(exe_name);
                    if nested.exists() {
                        let dest = bin_dir.join(exe_name);
                        let _ = fs::rename(&nested, &dest);
                        break;
                    }
                }
            }
        }
    }

    final_exe_path = bin_dir.join(exe_name);
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
    item_type: &str,
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
        "--threads".to_string(), config.threads.to_string(),
        "--n-gpu-layers".to_string(), config.gpu_layers.to_string(),
        "--temp".to_string(), config.temp.to_string(),
        "--predict".to_string(), config.predict.to_string(),
        "--batch-size".to_string(), config.batch_size.to_string(),
        "--ubatch-size".to_string(), config.ubatch_size.to_string(),
        "--min-p".to_string(), config.min_p.to_string(),
        "--top-k".to_string(), config.top_k.to_string(),
        "--top-p".to_string(), config.top_p.to_string(),
        "--repeat-penalty".to_string(), config.repeat_penalty.to_string(),
        "--seed".to_string(), config.seed.to_string(),
        "--presence-penalty".to_string(), config.presence_penalty.to_string(),
        "--frequency-penalty".to_string(), config.frequency_penalty.to_string(),
    ];

    if config.flash_attn {
        args.push("--flash-attn".to_string());
        args.push("on".to_string());
    }
    if config.embedding {
        args.push("--embedding".to_string());
    }
    if config.cont_batching {
        args.push("--cont-batching".to_string());
    }
    if config.prompt_cache {
        args.push("--prompt-cache-all".to_string());
    }
    if config.mlock {
        args.push("--mlock".to_string());
    }
    if !config.mmap {
        args.push("--no-mmap".to_string());
    }

    if let Some(custom) = config.custom_args {
        for arg in custom.split_whitespace() {
            if !arg.is_empty() {
                args.push(arg.to_string());
            }
        }
    }

    let mut command = tokio::process::Command::new(&exe_path_str);
    command.args(&args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

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
