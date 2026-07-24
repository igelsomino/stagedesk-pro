use base64::{engine::general_purpose, Engine as _};
use rodio::{
    source::SeekError, ChannelCount, Decoder, DeviceSinkBuilder, MixerDeviceSink, Player, Sample,
    SampleRate, Source,
};
use serde::Serialize;
use serde_json::Value;
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::Mutex,
    time::{Duration, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, State};

const PROJECT_FILE_NAME: &str = "project.json";

#[derive(Default)]
struct CurrentProject {
    path: Mutex<Option<PathBuf>>,
}

#[derive(Default)]
struct NativeAudio {
    current: Mutex<Option<NativeAudioPlayback>>,
}

struct NativeAudioPlayback {
    _sink: MixerDeviceSink,
    player: Player,
}

struct NativeAudioEnvelope<S>
where
    S: Source,
{
    input: S,
    sample_index: u64,
    samples_per_second: f32,
    target_volume: f32,
    fade_in: f32,
    fade_out: f32,
    duration: Option<f32>,
}

impl<S> NativeAudioEnvelope<S>
where
    S: Source,
{
    fn new(
        input: S,
        target_volume: f32,
        fade_in: f32,
        fade_out: f32,
        duration: Option<f32>,
    ) -> Self {
        let samples_per_second = input.sample_rate().get() as f32 * input.channels().get() as f32;
        Self {
            input,
            sample_index: 0,
            samples_per_second,
            target_volume,
            fade_in,
            fade_out,
            duration,
        }
    }

    fn elapsed_seconds(&self) -> f32 {
        if self.samples_per_second <= 0.0 {
            0.0
        } else {
            self.sample_index as f32 / self.samples_per_second
        }
    }

    fn gain(&self) -> f32 {
        let elapsed = self.elapsed_seconds();
        let mut gain = self.target_volume;
        if self.fade_in > 0.0 && elapsed < self.fade_in {
            gain *= (elapsed / self.fade_in).clamp(0.0, 1.0);
        }
        if let Some(duration) = self.duration {
            if self.fade_out > 0.0 {
                let remaining = (duration - elapsed).max(0.0);
                if remaining < self.fade_out {
                    gain *= (remaining / self.fade_out).clamp(0.0, 1.0);
                }
            }
        }
        gain.clamp(0.0, 1.0)
    }
}

impl<S> Iterator for NativeAudioEnvelope<S>
where
    S: Source,
{
    type Item = Sample;

    fn next(&mut self) -> Option<Self::Item> {
        let gain = self.gain();
        let sample = self.input.next()?;
        self.sample_index = self.sample_index.saturating_add(1);
        Some(sample * gain)
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        self.input.size_hint()
    }
}

impl<S> Source for NativeAudioEnvelope<S>
where
    S: Source,
{
    fn current_span_len(&self) -> Option<usize> {
        self.input.current_span_len()
    }

    fn channels(&self) -> ChannelCount {
        self.input.channels()
    }

    fn sample_rate(&self) -> SampleRate {
        self.input.sample_rate()
    }

    fn total_duration(&self) -> Option<Duration> {
        self.input.total_duration()
    }

    fn try_seek(&mut self, pos: Duration) -> Result<(), SeekError> {
        self.input.try_seek(pos)?;
        self.sample_index = (pos.as_secs_f32() * self.samples_per_second).max(0.0) as u64;
        Ok(())
    }
}

#[derive(Serialize)]
struct ProjectEntry {
    name: String,
    path: String,
    #[serde(rename = "projectId")]
    project_id: Option<String>,
    #[serde(rename = "updatedAt")]
    updated_at: Option<String>,
}

#[derive(Serialize)]
struct ProjectOpenResult {
    project: Value,
    path: String,
}

#[tauri::command]
fn app_ready() -> &'static str {
    "studio-copione-ready"
}

#[tauri::command]
fn current_project_folder_path(state: State<CurrentProject>) -> Result<Option<String>, String> {
    Ok(state
        .path
        .lock()
        .map_err(|error| error.to_string())?
        .as_ref()
        .map(|path| path.to_string_lossy().to_string()))
}

#[tauri::command]
fn list_project_folders(app: AppHandle) -> Result<Vec<ProjectEntry>, String> {
    let root = projects_root_path(&app)?;
    let mut entries = Vec::new();

    for entry in fs::read_dir(root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if !path.is_dir() || !path.join(PROJECT_FILE_NAME).exists() {
            continue;
        }

        let modified = path
            .join(PROJECT_FILE_NAME)
            .metadata()
            .ok()
            .and_then(|metadata| metadata.modified().ok())
            .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
            .map(|duration| duration.as_secs().to_string());

        let project_id = fs::read_to_string(path.join(PROJECT_FILE_NAME))
            .ok()
            .and_then(|contents| serde_json::from_str::<Value>(&contents).ok())
            .and_then(|project| project.get("id").and_then(Value::as_str).map(str::to_string));

        entries.push(ProjectEntry {
            name: path
                .file_name()
                .map(|name| name.to_string_lossy().to_string())
                .unwrap_or_else(|| "progetto".to_string()),
            path: path.to_string_lossy().to_string(),
            project_id,
            updated_at: modified,
        });
    }

    entries.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    Ok(entries)
}

#[tauri::command]
fn create_project_folder(
    app: AppHandle,
    state: State<CurrentProject>,
    project_name: String,
    project_json: String,
) -> Result<String, String> {
    let root = projects_root_path(&app)?;
    let project_path = unique_project_path(&root, &project_name);
    fs::create_dir_all(&project_path).map_err(|error| error.to_string())?;
    write_project(&project_path, &project_json, Some(&app))?;
    write_last_project_path(&app, &project_path)?;
    *state.path.lock().map_err(|error| error.to_string())? = Some(project_path.clone());
    Ok(project_path.to_string_lossy().to_string())
}

#[tauri::command]
fn open_project_folder(
    app: AppHandle,
    state: State<CurrentProject>,
    project_path: Option<String>,
) -> Result<ProjectOpenResult, String> {
    let path = project_path
        .map(PathBuf::from)
        .ok_or_else(|| "Percorso progetto mancante".to_string())?;
    let project = read_project(&path)?;
    write_last_project_path(&app, &path)?;
    *state.path.lock().map_err(|error| error.to_string())? = Some(path.clone());
    Ok(ProjectOpenResult {
        project,
        path: path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn open_last_project_folder(
    app: AppHandle,
    state: State<CurrentProject>,
) -> Result<Option<ProjectOpenResult>, String> {
    let Some(path) = read_last_project_path(&app)? else {
        return Ok(None);
    };
    if !path.join(PROJECT_FILE_NAME).exists() {
        return Ok(None);
    }

    let project = read_project(&path)?;
    *state.path.lock().map_err(|error| error.to_string())? = Some(path.clone());
    Ok(Some(ProjectOpenResult {
        project,
        path: path.to_string_lossy().to_string(),
    }))
}

#[tauri::command]
fn rename_project_folder(
    app: AppHandle,
    state: State<CurrentProject>,
    project_path: String,
    project_name: String,
) -> Result<ProjectEntry, String> {
    let current_path = project_path_in_root(&app, &project_path)?;
    let project = read_project(&current_path)?;
    let root = projects_root_path(&app)?;
    let target_path = root.join(safe_folder_name(&project_name));

    if target_path != current_path {
        if target_path.exists() {
            return Err("Esiste già un progetto con questo nome".to_string());
        }
        fs::rename(&current_path, &target_path).map_err(|error| error.to_string())?;
    }

    let mut project = project;
    if let Some(object) = project.as_object_mut() {
        object.insert("name".to_string(), Value::String(project_name.clone()));
        object.insert(
            "rootPath".to_string(),
            Value::String(target_path.to_string_lossy().to_string()),
        );
    }
    let project_json = serde_json::to_string_pretty(&project).map_err(|error| error.to_string())?;
    write_project(&target_path, &project_json, Some(&app))?;

    let mut state_path = state.path.lock().map_err(|error| error.to_string())?;
    if state_path.as_ref() == Some(&current_path) {
        *state_path = Some(target_path.clone());
        write_last_project_path(&app, &target_path)?;
    }

    Ok(ProjectEntry {
        name: project_name,
        path: target_path.to_string_lossy().to_string(),
        project_id: project.get("id").and_then(Value::as_str).map(str::to_string),
        updated_at: project_updated_at(&target_path),
    })
}

#[tauri::command]
fn delete_project_folder(
    app: AppHandle,
    state: State<CurrentProject>,
    project_path: String,
) -> Result<(), String> {
    let current_path = project_path_in_root(&app, &project_path)?;
    fs::remove_dir_all(&current_path).map_err(|error| error.to_string())?;

    let mut state_path = state.path.lock().map_err(|error| error.to_string())?;
    if state_path.as_ref() == Some(&current_path) {
        *state_path = None;
        let _ = fs::remove_file(last_project_file_path(&app)?);
    }

    Ok(())
}

#[tauri::command]
fn save_project_folder(
    app: AppHandle,
    state: State<CurrentProject>,
    project_json: String,
) -> Result<String, String> {
    let path = state
        .path
        .lock()
        .map_err(|error| error.to_string())?
        .clone()
        .ok_or_else(|| "Nessuna cartella progetto aperta".to_string())?;
    write_project(&path, &project_json, Some(&app))?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn load_project_json(state: State<CurrentProject>) -> Result<Option<String>, String> {
    let Some(path) = state
        .path
        .lock()
        .map_err(|error| error.to_string())?
        .clone()
    else {
        return Ok(None);
    };
    let project = read_project(&path)?;
    serde_json::to_string_pretty(&project)
        .map(Some)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_project_json(
    app: AppHandle,
    state: State<CurrentProject>,
    project_json: String,
) -> Result<String, String> {
    save_project_folder(app, state, project_json)
}

#[tauri::command]
fn write_media_asset(
    state: State<CurrentProject>,
    target_path: String,
    data_base64: String,
) -> Result<(), String> {
    let path = state
        .path
        .lock()
        .map_err(|error| error.to_string())?
        .clone()
        .ok_or_else(|| "Nessuna cartella progetto aperta".to_string())?;
    let target_file = path.join(relative_project_path(&target_path));

    if let Some(parent) = target_file.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let bytes = general_purpose::STANDARD
        .decode(data_base64)
        .map_err(|error| error.to_string())?;
    fs::write(target_file, bytes).map_err(|error| error.to_string())
}

#[tauri::command]
fn move_media_asset(
    state: State<CurrentProject>,
    source_path: String,
    target_path: String,
) -> Result<(), String> {
    let path = state
        .path
        .lock()
        .map_err(|error| error.to_string())?
        .clone()
        .ok_or_else(|| "Nessuna cartella progetto aperta".to_string())?;
    let source_file = path.join(relative_project_path(&source_path));
    let target_file = path.join(relative_project_path(&target_path));

    if !source_file.exists() {
        return Ok(());
    }
    if target_file.exists() {
        return Err(
            "Esiste già un file media con lo stesso nome nella cartella destinazione".to_string(),
        );
    }
    if let Some(parent) = target_file.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::rename(source_file, target_file).map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_media_asset(state: State<CurrentProject>, target_path: String) -> Result<(), String> {
    let path = state
        .path
        .lock()
        .map_err(|error| error.to_string())?
        .clone()
        .ok_or_else(|| "Nessuna cartella progetto aperta".to_string())?;
    let target = path.join(relative_project_path(&target_path));

    if !target.exists() {
        return Ok(());
    }
    if target.is_dir() {
        fs::remove_dir_all(target).map_err(|error| error.to_string())
    } else {
        fs::remove_file(target).map_err(|error| error.to_string())
    }
}

#[tauri::command]
fn read_media_asset_data_url(
    app: AppHandle,
    state: State<CurrentProject>,
    target_path: String,
    source_path: Option<String>,
) -> Result<String, String> {
    let project_path = state
        .path
        .lock()
        .map_err(|error| error.to_string())?
        .clone();
    let project_file = project_path
        .as_ref()
        .map(|path| path.join(relative_project_path(&target_path)))
        .filter(|path| {
            path.exists()
                && path
                    .metadata()
                    .map(|metadata| metadata.len() > 0)
                    .unwrap_or(false)
        });
    let source_file = match (project_file, source_path.as_deref()) {
        (Some(path), _) => path,
        (None, Some(source_path)) => bundled_media_source(source_path, Some(&app))?,
        (None, None) => return Err(format!("File media non trovato: {target_path}")),
    };
    let bytes = fs::read(&source_file).map_err(|error| error.to_string())?;
    let mime = mime_type_for_path(&source_file);
    Ok(format!(
        "data:{mime};base64,{}",
        general_purpose::STANDARD.encode(bytes)
    ))
}

#[tauri::command]
fn play_audio_asset(
    app: AppHandle,
    state: State<CurrentProject>,
    audio: State<NativeAudio>,
    target_path: String,
    source_path: Option<String>,
    volume: Option<f32>,
    fade_in: Option<f32>,
    fade_out: Option<f32>,
    start_at: Option<f32>,
    duration: Option<f32>,
    loop_audio: Option<bool>,
) -> Result<Option<f32>, String> {
    let project_path = state
        .path
        .lock()
        .map_err(|error| error.to_string())?
        .clone();
    let project_file = project_path
        .as_ref()
        .map(|path| path.join(relative_project_path(&target_path)))
        .filter(|path| path.exists());
    let target = match (project_file, source_path.as_deref()) {
        (Some(path), _) => path,
        (None, Some(source_path)) => bundled_media_source(source_path, Some(&app))?,
        (None, None) => return Err(format!("File media non trovato: {target_path}")),
    };

    let sink = DeviceSinkBuilder::open_default_sink()
        .map_err(|error| format!("Dispositivo audio non disponibile: {error}"))?;
    let player = Player::connect_new(sink.mixer());
    player.set_volume(1.0);

    let file = fs::File::open(&target).map_err(|error| error.to_string())?;
    let decoder = Decoder::try_from(file)
        .map_err(|error| format!("File audio non decodificabile: {error}"))?;
    let start = Duration::from_secs_f32(start_at.unwrap_or(0.0).max(0.0));
    let segment_duration = duration
        .filter(|value| value.is_finite() && *value > 0.0)
        .map(Duration::from_secs_f32);
    let total_duration = decoder.total_duration();
    let playback_duration = if loop_audio.unwrap_or(false) {
        None
    } else {
        segment_duration
            .or_else(|| total_duration.and_then(|total| total.checked_sub(start)))
            .map(|value| value.as_secs_f32())
    };

    let target_volume = volume.unwrap_or(0.7).clamp(0.0, 1.0);
    let fade_in_seconds = fade_in.unwrap_or(0.0).clamp(0.0, 120.0);
    let fade_out_seconds = fade_out.unwrap_or(0.0).clamp(0.0, 120.0);
    let source: Box<dyn Source + Send> = if loop_audio.unwrap_or(false) {
        if let Some(segment_duration) = segment_duration {
            Box::new(
                decoder
                    .skip_duration(start)
                    .take_duration(segment_duration)
                    .repeat_infinite(),
            )
        } else {
            Box::new(decoder.skip_duration(start).repeat_infinite())
        }
    } else if let Some(segment_duration) = segment_duration {
        Box::new(decoder.skip_duration(start).take_duration(segment_duration))
    } else {
        Box::new(decoder.skip_duration(start))
    };
    player.append(NativeAudioEnvelope::new(
        source,
        target_volume,
        fade_in_seconds,
        fade_out_seconds,
        playback_duration,
    ));
    player.play();

    let mut current = audio.current.lock().map_err(|error| error.to_string())?;
    if let Some(previous) = current.take() {
        previous.player.stop();
    }
    *current = Some(NativeAudioPlayback {
        _sink: sink,
        player,
    });
    Ok(playback_duration)
}

#[tauri::command]
fn pause_audio_asset(audio: State<NativeAudio>) -> Result<(), String> {
    if let Some(current) = audio
        .current
        .lock()
        .map_err(|error| error.to_string())?
        .as_ref()
    {
        current.player.pause();
    }
    Ok(())
}

#[tauri::command]
fn resume_audio_asset(audio: State<NativeAudio>) -> Result<(), String> {
    if let Some(current) = audio
        .current
        .lock()
        .map_err(|error| error.to_string())?
        .as_ref()
    {
        current.player.play();
    }
    Ok(())
}

#[tauri::command]
fn stop_audio_asset(audio: State<NativeAudio>) -> Result<(), String> {
    if let Some(current) = audio
        .current
        .lock()
        .map_err(|error| error.to_string())?
        .take()
    {
        current.player.stop();
    }
    Ok(())
}

#[tauri::command]
fn desktop_project_path(state: State<CurrentProject>) -> Result<String, String> {
    current_project_folder_path(state)?
        .ok_or_else(|| "Nessuna cartella progetto aperta".to_string())
}

#[tauri::command]
fn save_pdf_to_downloads(
    app: AppHandle,
    file_name: String,
    data_base64: String,
) -> Result<String, String> {
    let downloads = app
        .path()
        .download_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&downloads).map_err(|error| error.to_string())?;
    let safe_name = safe_file_name(&file_name, "export.pdf");
    let path = unique_file_path(&downloads, &safe_name);
    let bytes = general_purpose::STANDARD
        .decode(data_base64)
        .map_err(|error| error.to_string())?;
    fs::write(&path, bytes).map_err(|error| error.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
    let status = if cfg!(target_os = "macos") {
        Command::new("open").arg(path).status()
    } else if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", "start", "", &path])
            .status()
    } else {
        Command::new("xdg-open").arg(path).status()
    }
    .map_err(|error| error.to_string())?;

    if status.success() {
        Ok(())
    } else {
        Err("Apertura file non riuscita".to_string())
    }
}

fn projects_root_path(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("projects");
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    Ok(root)
}

fn project_path_in_root(app: &AppHandle, project_path: &str) -> Result<PathBuf, String> {
    let root = fs::canonicalize(projects_root_path(app)?).map_err(|error| error.to_string())?;
    let path = fs::canonicalize(PathBuf::from(project_path)).map_err(|error| error.to_string())?;
    if !path.starts_with(&root) || !path.join(PROJECT_FILE_NAME).exists() {
        return Err("Percorso progetto non valido".to_string());
    }
    Ok(path)
}

fn project_updated_at(project_path: &Path) -> Option<String> {
    project_path
        .join(PROJECT_FILE_NAME)
        .metadata()
        .ok()
        .and_then(|metadata| metadata.modified().ok())
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs().to_string())
}

fn unique_project_path(root: &Path, name: &str) -> PathBuf {
    let safe_name = safe_folder_name(name);
    let mut path = root.join(&safe_name);
    let mut index = 2;
    while path.exists() {
        path = root.join(format!("{safe_name}-{index}"));
        index += 1;
    }
    path
}

fn safe_folder_name(name: &str) -> String {
    let mut output = String::new();
    for character in name.trim().to_lowercase().chars() {
        if character.is_ascii_alphanumeric()
            || character == '.'
            || character == '_'
            || character == '-'
        {
            output.push(character);
        } else if !output.ends_with('-') {
            output.push('-');
        }
    }
    let output = output.trim_matches('-').to_string();
    if output.is_empty() {
        "progetto".to_string()
    } else {
        output
    }
}

fn safe_file_name(name: &str, fallback: &str) -> String {
    let mut output = String::new();
    for character in name.trim().chars() {
        if character.is_ascii_alphanumeric()
            || character == '.'
            || character == '_'
            || character == '-'
        {
            output.push(character);
        } else if !output.ends_with('-') {
            output.push('-');
        }
    }
    let output = output.trim_matches('-').to_string();
    if output.is_empty() {
        fallback.to_string()
    } else {
        output
    }
}

fn unique_file_path(directory: &Path, file_name: &str) -> PathBuf {
    let path = directory.join(file_name);
    if !path.exists() {
        return path;
    }

    let file_path = Path::new(file_name);
    let stem = file_path
        .file_stem()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "export".to_string());
    let extension = file_path
        .extension()
        .map(|value| value.to_string_lossy().to_string());

    for index in 1.. {
        let next_name = match &extension {
            Some(extension) => format!("{stem}-{index}.{extension}"),
            None => format!("{stem}-{index}"),
        };
        let next_path = directory.join(next_name);
        if !next_path.exists() {
            return next_path;
        }
    }

    unreachable!()
}

fn mime_type_for_path(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_lowercase()
        .as_str()
    {
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "ogg" => "audio/ogg",
        "m4a" => "audio/mp4",
        "flac" => "audio/flac",
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "mp4" => "video/mp4",
        "mov" => "video/quicktime",
        "m4v" => "video/x-m4v",
        "webm" => "video/webm",
        _ => "application/octet-stream",
    }
}

fn read_project(project_path: &Path) -> Result<Value, String> {
    let project_path = fs::canonicalize(project_path).map_err(|error| error.to_string())?;
    let raw = fs::read_to_string(project_path.join(PROJECT_FILE_NAME))
        .map_err(|error| error.to_string())?;
    let mut project = serde_json::from_str::<Value>(&raw).map_err(|error| error.to_string())?;
    hydrate_script_files(&project_path, &mut project)?;
    Ok(project)
}

fn write_project(
    project_path: &Path,
    project_json: &str,
    app: Option<&AppHandle>,
) -> Result<(), String> {
    let mut project =
        serde_json::from_str::<Value>(project_json).map_err(|error| error.to_string())?;
    if let Some(object) = project.as_object_mut() {
        object.insert(
            "rootPath".to_string(),
            Value::String(project_path.to_string_lossy().to_string()),
        );
    }

    fs::create_dir_all(project_path).map_err(|error| error.to_string())?;
    let project_json = serde_json::to_string_pretty(&project).map_err(|error| error.to_string())?;
    fs::write(project_path.join(PROJECT_FILE_NAME), project_json)
        .map_err(|error| error.to_string())?;
    write_script_files(project_path, project.get("scripts"))?;
    write_media_folders(project_path, project.get("media"), app)?;
    Ok(())
}

fn hydrate_script_files(project_path: &Path, project: &mut Value) -> Result<(), String> {
    let Some(scripts) = project.get_mut("scripts").and_then(Value::as_array_mut) else {
        return Ok(());
    };
    hydrate_script_nodes(project_path, scripts)
}

fn hydrate_script_nodes(project_path: &Path, nodes: &mut [Value]) -> Result<(), String> {
    for node in nodes {
        let kind = node.get("kind").and_then(Value::as_str).unwrap_or_default();
        if kind == "markdown" {
            if let Some(path) = node.get("path").and_then(Value::as_str) {
                let file_path = project_path.join(relative_project_path(path));
                if file_path.exists() {
                    let content =
                        fs::read_to_string(file_path).map_err(|error| error.to_string())?;
                    if let Some(object) = node.as_object_mut() {
                        object.insert("content".to_string(), Value::String(content));
                    }
                }
            }
            continue;
        }

        if let Some(children) = node.get_mut("children").and_then(Value::as_array_mut) {
            hydrate_script_nodes(project_path, children)?;
        }
    }

    Ok(())
}

fn write_script_files(project_path: &Path, scripts: Option<&Value>) -> Result<(), String> {
    let Some(nodes) = scripts.and_then(Value::as_array) else {
        return Ok(());
    };
    write_script_nodes(project_path, nodes)
}

fn write_script_nodes(project_path: &Path, nodes: &[Value]) -> Result<(), String> {
    for node in nodes {
        let kind = node.get("kind").and_then(Value::as_str).unwrap_or_default();
        let path = node.get("path").and_then(Value::as_str).unwrap_or_default();
        let file_path = project_path.join(relative_project_path(path));

        if kind == "folder" {
            fs::create_dir_all(&file_path).map_err(|error| error.to_string())?;
            if let Some(children) = node.get("children").and_then(Value::as_array) {
                write_script_nodes(project_path, children)?;
            }
            continue;
        }

        if kind == "markdown" {
            if let Some(parent) = file_path.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            let content = node
                .get("content")
                .and_then(Value::as_str)
                .unwrap_or_default();
            fs::write(file_path, content).map_err(|error| error.to_string())?;
        }
    }

    Ok(())
}

fn write_media_folders(
    project_path: &Path,
    media: Option<&Value>,
    app: Option<&AppHandle>,
) -> Result<(), String> {
    let Some(nodes) = media.and_then(Value::as_array) else {
        return Ok(());
    };
    write_media_nodes(project_path, nodes, app)
}

fn write_media_nodes(
    project_path: &Path,
    nodes: &[Value],
    app: Option<&AppHandle>,
) -> Result<(), String> {
    for node in nodes {
        let kind = node.get("kind").and_then(Value::as_str).unwrap_or_default();
        let path = node.get("path").and_then(Value::as_str).unwrap_or_default();
        let file_path = project_path.join(relative_project_path(path));

        if kind == "folder" {
            fs::create_dir_all(&file_path).map_err(|error| error.to_string())?;
            if let Some(children) = node.get("children").and_then(Value::as_array) {
                write_media_nodes(project_path, children, app)?;
            }
            continue;
        }

        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }

        let should_write_source = match fs::metadata(&file_path) {
            Ok(metadata) => metadata.len() == 0,
            Err(_) => true,
        };

        if should_write_source {
            if let Some(source_path) = node.get("sourcePath").and_then(Value::as_str) {
                let source_file = bundled_media_source(source_path, app)?;
                fs::copy(source_file, &file_path).map_err(|error| error.to_string())?;
            } else if !file_path.exists() {
                fs::write(&file_path, []).map_err(|error| error.to_string())?;
            }
        }
    }

    Ok(())
}

fn bundled_media_source(source_path: &str, app: Option<&AppHandle>) -> Result<PathBuf, String> {
    let relative_path = relative_project_path(source_path);
    let without_sample_media = relative_path
        .strip_prefix("sample-media")
        .ok()
        .map(PathBuf::from);
    let mut candidates = Vec::new();

    if let Some(app) = app {
        if let Ok(resource_dir) = app.path().resource_dir() {
            candidates.push(resource_dir.join(&relative_path));
            candidates.push(resource_dir.join("public").join(&relative_path));
            candidates.push(
                resource_dir
                    .join("_up_")
                    .join("public")
                    .join(&relative_path),
            );
            if let Some(path) = &without_sample_media {
                candidates.push(resource_dir.join(path));
                candidates.push(resource_dir.join("sample-media").join(path));
            }
        }
    }

    if let Ok(current_dir) = std::env::current_dir() {
        candidates.push(current_dir.join("../public").join(&relative_path));
        candidates.push(current_dir.join("public").join(&relative_path));
    }

    let attempted = candidates
        .iter()
        .map(|path| path.display().to_string())
        .collect::<Vec<_>>()
        .join(", ");

    candidates
        .into_iter()
        .find(|path| path.exists())
        .ok_or_else(|| {
            format!(
                "Media di esempio non disponibile: {source_path}. Percorsi verificati: {attempted}"
            )
        })
}

fn relative_project_path(path: &str) -> PathBuf {
    path.split('/')
        .filter(|part| !part.is_empty())
        .fold(PathBuf::new(), |mut output, part| {
            output.push(part);
            output
        })
}

fn last_project_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&app_dir).map_err(|error| error.to_string())?;
    Ok(app_dir.join("last-project.txt"))
}

fn write_last_project_path(app: &AppHandle, path: &Path) -> Result<(), String> {
    fs::write(
        last_project_file_path(app)?,
        path.to_string_lossy().as_bytes(),
    )
    .map_err(|error| error.to_string())
}

fn read_last_project_path(app: &AppHandle) -> Result<Option<PathBuf>, String> {
    let path_file = last_project_file_path(app)?;
    if !path_file.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(path_file).map_err(|error| error.to_string())?;
    let path = content.trim();
    if path.is_empty() {
        return Ok(None);
    }
    Ok(Some(PathBuf::from(path)))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|_app, argv, _cwd| {
            println!("StageDesk Pro received a second instance request: {argv:?}");
        }));
    }

    builder
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|_app| {
            #[cfg(target_os = "linux")]
            {
                use tauri_plugin_deep_link::DeepLinkExt;

                _app.deep_link().register_all()?;
            }

            Ok(())
        })
        .manage(CurrentProject::default())
        .manage(NativeAudio::default())
        .invoke_handler(tauri::generate_handler![
            app_ready,
            current_project_folder_path,
            list_project_folders,
            create_project_folder,
            open_project_folder,
            open_last_project_folder,
            rename_project_folder,
            delete_project_folder,
            save_project_folder,
            load_project_json,
            save_project_json,
            write_media_asset,
            move_media_asset,
            delete_media_asset,
            read_media_asset_data_url,
            play_audio_asset,
            pause_audio_asset,
            resume_audio_asset,
            stop_audio_asset,
            save_pdf_to_downloads,
            open_path,
            desktop_project_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
