use serde::Serialize;

pub const OPENAI_COMPATIBLE_API_KEY_ENV: &str =
    minutes_core::config::OPENAI_COMPATIBLE_DESKTOP_API_KEY_ENV;
pub const ANTHROPIC_API_KEY_ENV: &str = "ANTHROPIC_API_KEY";

const OPENAI_COMPATIBLE_SERVICE: &str = "Minutes OpenAI-compatible Summaries";
const OPENAI_COMPATIBLE_ACCOUNT: &str = "default";
const ANTHROPIC_SERVICE: &str = "Minutes Claude Chat";
const ANTHROPIC_ACCOUNT: &str = "default";
#[cfg(target_os = "macos")]
const ERR_SEC_ITEM_NOT_FOUND: i32 = -25300;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenAiCompatibleSecretStatus {
    pub supported: bool,
    pub key_set: bool,
    pub stored_key_set: bool,
    pub storage_label: &'static str,
    pub env_var: &'static str,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnthropicSecretStatus {
    pub supported: bool,
    pub key_set: bool,
    pub stored_key_set: bool,
    pub storage_label: &'static str,
    pub env_var: &'static str,
    pub message: String,
}

pub fn hydrate_openai_compatible_api_key_env() -> OpenAiCompatibleSecretStatus {
    hydrate_env_from_keychain(
        OPENAI_COMPATIBLE_API_KEY_ENV,
        load_openai_compatible_api_key,
    );
    openai_compatible_secret_status()
}

pub fn openai_compatible_secret_status() -> OpenAiCompatibleSecretStatus {
    let env_key_set = std::env::var(OPENAI_COMPATIBLE_API_KEY_ENV).is_ok();
    let stored_key_set = load_openai_compatible_api_key().ok().flatten().is_some();
    let key_set = env_key_set || stored_key_set;

    OpenAiCompatibleSecretStatus {
        supported: keychain_supported(),
        key_set,
        stored_key_set,
        storage_label: storage_label(),
        env_var: OPENAI_COMPATIBLE_API_KEY_ENV,
        message: secret_status_message(key_set, stored_key_set, OPENAI_COMPATIBLE_API_KEY_ENV),
    }
}

pub fn save_openai_compatible_api_key(api_key: &str) -> Result<(), String> {
    save_api_key(
        OPENAI_COMPATIBLE_SERVICE,
        OPENAI_COMPATIBLE_ACCOUNT,
        api_key,
        OPENAI_COMPATIBLE_API_KEY_ENV,
    )
}

pub fn clear_openai_compatible_api_key() -> Result<(), String> {
    clear_secret(OPENAI_COMPATIBLE_SERVICE, OPENAI_COMPATIBLE_ACCOUNT)
}

pub fn hydrate_anthropic_api_key_env() -> AnthropicSecretStatus {
    hydrate_env_from_keychain(ANTHROPIC_API_KEY_ENV, load_anthropic_api_key);
    anthropic_secret_status()
}

pub fn anthropic_secret_status() -> AnthropicSecretStatus {
    let env_key_set = std::env::var(ANTHROPIC_API_KEY_ENV).is_ok();
    let stored_key_set = load_anthropic_api_key().ok().flatten().is_some();
    let key_set = env_key_set || stored_key_set;

    AnthropicSecretStatus {
        supported: keychain_supported(),
        key_set,
        stored_key_set,
        storage_label: storage_label(),
        env_var: ANTHROPIC_API_KEY_ENV,
        message: secret_status_message(key_set, stored_key_set, ANTHROPIC_API_KEY_ENV),
    }
}

pub fn save_anthropic_api_key(api_key: &str) -> Result<(), String> {
    save_api_key(
        ANTHROPIC_SERVICE,
        ANTHROPIC_ACCOUNT,
        api_key,
        ANTHROPIC_API_KEY_ENV,
    )
}

pub fn clear_anthropic_api_key() -> Result<(), String> {
    clear_secret(ANTHROPIC_SERVICE, ANTHROPIC_ACCOUNT)
}

fn hydrate_env_from_keychain(env_var: &'static str, load: fn() -> Result<Option<String>, String>) {
    if std::env::var(env_var).is_ok() {
        return;
    }
    if let Ok(Some(key)) = load() {
        std::env::set_var(env_var, key);
    }
}

fn save_api_key(
    service: &str,
    account: &str,
    api_key: &str,
    env_var: &'static str,
) -> Result<(), String> {
    if api_key.trim().is_empty() {
        return Err("Paste an API key first.".into());
    }
    save_secret(service, account, api_key, env_var)
}

fn secret_status_message(key_set: bool, stored_key_set: bool, env_var: &'static str) -> String {
    if stored_key_set {
        return "Key saved in macOS Keychain.".into();
    }
    if key_set {
        return format!("Using {} from this app environment.", env_var);
    }
    if keychain_supported() {
        return "Paste a key once. Minutes stores it in macOS Keychain.".into();
    }

    format!(
        "Keychain storage is unavailable on this OS. Set {} before launching Minutes.",
        env_var
    )
}

#[cfg(target_os = "macos")]
fn keychain_supported() -> bool {
    true
}

#[cfg(not(target_os = "macos"))]
fn keychain_supported() -> bool {
    false
}

#[cfg(target_os = "macos")]
fn storage_label() -> &'static str {
    "macOS Keychain"
}

#[cfg(not(target_os = "macos"))]
fn storage_label() -> &'static str {
    "environment variable"
}

#[cfg(target_os = "macos")]
pub fn load_openai_compatible_api_key() -> Result<Option<String>, String> {
    load_secret(OPENAI_COMPATIBLE_SERVICE, OPENAI_COMPATIBLE_ACCOUNT)
}

#[cfg(not(target_os = "macos"))]
pub fn load_openai_compatible_api_key() -> Result<Option<String>, String> {
    Ok(None)
}

#[cfg(target_os = "macos")]
pub fn load_anthropic_api_key() -> Result<Option<String>, String> {
    load_secret(ANTHROPIC_SERVICE, ANTHROPIC_ACCOUNT)
}

#[cfg(not(target_os = "macos"))]
pub fn load_anthropic_api_key() -> Result<Option<String>, String> {
    Ok(None)
}

#[cfg(target_os = "macos")]
fn load_secret(service: &str, account: &str) -> Result<Option<String>, String> {
    let password = match security_framework::passwords::get_generic_password(service, account) {
        Ok(password) => password,
        Err(error) if error.code() == ERR_SEC_ITEM_NOT_FOUND => return Ok(None),
        Err(error) => return Err(format!("Could not read Keychain: {}", error)),
    };

    let key = String::from_utf8(password)
        .map_err(|error| format!("Keychain returned invalid UTF-8: {}", error))?
        .trim_end_matches(['\r', '\n'])
        .to_string();

    if key.is_empty() {
        Ok(None)
    } else {
        Ok(Some(key))
    }
}

#[cfg(target_os = "macos")]
fn save_secret(
    service: &str,
    account: &str,
    api_key: &str,
    _env_var: &'static str,
) -> Result<(), String> {
    security_framework::passwords::set_generic_password(service, account, api_key.as_bytes())
        .map_err(|error| format!("Could not save API key to Keychain: {}", error))
}

#[cfg(not(target_os = "macos"))]
fn save_secret(
    _service: &str,
    _account: &str,
    _api_key: &str,
    env_var: &'static str,
) -> Result<(), String> {
    Err(format!(
        "Keychain storage is unavailable on this OS. Set {} before launching Minutes.",
        env_var
    ))
}

#[cfg(target_os = "macos")]
fn clear_secret(service: &str, account: &str) -> Result<(), String> {
    match security_framework::passwords::delete_generic_password(service, account) {
        Ok(()) => Ok(()),
        Err(error) if error.code() == ERR_SEC_ITEM_NOT_FOUND => Ok(()),
        Err(error) => Err(format!("Could not update Keychain: {}", error)),
    }
}

#[cfg(not(target_os = "macos"))]
fn clear_secret(_service: &str, _account: &str) -> Result<(), String> {
    Ok(())
}
