use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use chrono::{DateTime, Duration, Utc};
use clap::{Parser, Subcommand};
use hmac::{Hmac, Mac};
use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::fs;
use std::path::PathBuf;
use subtle::ConstantTimeEq;

type HmacSha256 = Hmac<Sha256>;

const AUTHOR: &str = "Manus AI";

#[derive(Parser, Debug)]
#[command(name = "offline-pin-guard")]
#[command(about = "Secure offline PIN bundle generation and verification for edge-safe transaction flows")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand, Debug)]
enum Commands {
    Generate(GenerateArgs),
    Verify(VerifyArgs),
}

#[derive(Parser, Debug)]
struct GenerateArgs {
    #[arg(long)]
    user_id: String,
    #[arg(long)]
    device_id: String,
    #[arg(long)]
    pin: String,
    #[arg(long)]
    master_key: String,
    #[arg(long, default_value_t = 168)]
    ttl_hours: i64,
    #[arg(long, default_value_t = 24)]
    require_online_sync_hours: i64,
    #[arg(long, default_value_t = 3)]
    max_offline_attempts: u32,
    #[arg(long, default_value_t = 30)]
    offline_lockout_minutes: i64,
    #[arg(long)]
    output: Option<PathBuf>,
}

#[derive(Parser, Debug)]
struct VerifyArgs {
    #[arg(long)]
    bundle_file: PathBuf,
    #[arg(long)]
    pin: String,
    #[arg(long)]
    master_key: String,
    #[arg(long)]
    output: Option<PathBuf>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct OfflinePinBundle {
    user_id: String,
    device_id: String,
    encrypted_pin_hash: String,
    nonce: String,
    created_at: DateTime<Utc>,
    expires_at: DateTime<Utc>,
    last_sync_at: DateTime<Utc>,
    failed_attempts: u32,
    locked_until: Option<DateTime<Utc>>,
    offline_transactions: u32,
    offline_amount_minor: u64,
    version: u32,
    max_offline_attempts: u32,
    offline_lockout_minutes: i64,
    require_online_sync_hours: i64,
    checksum: String,
}

#[derive(Debug, Serialize)]
struct VerificationResult {
    valid: bool,
    remaining_attempts: u32,
    requires_online_sync: bool,
    locked_until: Option<DateTime<Utc>>,
    message: String,
    updated_bundle: OfflinePinBundle,
}

#[derive(Debug, Serialize, Deserialize)]
struct GenerateOutput {
    author: String,
    bundle: OfflinePinBundle,
}

fn main() {
    if let Err(err) = run() {
        eprintln!("{}", err);
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let cli = Cli::parse();
    match cli.command {
        Commands::Generate(args) => generate_bundle(args),
        Commands::Verify(args) => verify_bundle(args),
    }
}

fn generate_bundle(args: GenerateArgs) -> Result<(), String> {
    let device_key = derive_device_key(args.master_key.as_bytes(), &args.device_id)?;
    let password_hash = hash_pin(&args.pin)?;
    let encrypted_payload = encrypt_pin_hash(&device_key, password_hash.as_bytes())?;

    let now = Utc::now();
    let mut bundle = OfflinePinBundle {
        user_id: args.user_id,
        device_id: args.device_id,
        encrypted_pin_hash: B64.encode(encrypted_payload.ciphertext),
        nonce: B64.encode(encrypted_payload.nonce),
        created_at: now,
        expires_at: now + Duration::hours(args.ttl_hours),
        last_sync_at: now,
        failed_attempts: 0,
        locked_until: None,
        offline_transactions: 0,
        offline_amount_minor: 0,
        version: 1,
        max_offline_attempts: args.max_offline_attempts,
        offline_lockout_minutes: args.offline_lockout_minutes,
        require_online_sync_hours: args.require_online_sync_hours,
        checksum: String::new(),
    };
    bundle.checksum = compute_checksum(&bundle, args.master_key.as_bytes())?;

    let output = serde_json::to_string_pretty(&GenerateOutput { author: AUTHOR.to_string(), bundle: bundle.clone() })
        .map_err(|e| format!("failed to serialize bundle: {e}"))?;

    if let Some(path) = args.output {
        fs::write(&path, format!("{}\n", output)).map_err(|e| format!("failed to write bundle to {}: {e}", path.display()))?;
    }

    println!("{}", output);
    Ok(())
}

fn verify_bundle(args: VerifyArgs) -> Result<(), String> {
    let input = fs::read_to_string(&args.bundle_file)
        .map_err(|e| format!("failed to read bundle file {}: {e}", args.bundle_file.display()))?;

    let mut bundle = parse_bundle(&input)?;
    let expected_checksum = compute_checksum(&bundle, args.master_key.as_bytes())?;
    if bundle.checksum.as_bytes().ct_eq(expected_checksum.as_bytes()).unwrap_u8() != 1 {
        let result = VerificationResult {
            valid: false,
            remaining_attempts: bundle.max_offline_attempts.saturating_sub(bundle.failed_attempts),
            requires_online_sync: true,
            locked_until: bundle.locked_until,
            message: "Bundle integrity check failed; online sync is required".to_string(),
            updated_bundle: bundle,
        };
        return emit_verification_result(result, args.output.as_ref());
    }

    let now = Utc::now();
    if now > bundle.expires_at {
        let result = VerificationResult {
            valid: false,
            remaining_attempts: bundle.max_offline_attempts.saturating_sub(bundle.failed_attempts),
            requires_online_sync: true,
            locked_until: bundle.locked_until,
            message: "Offline PIN bundle has expired; online sync is required".to_string(),
            updated_bundle: bundle,
        };
        return emit_verification_result(result, args.output.as_ref());
    }

    if let Some(locked_until) = bundle.locked_until {
        if now < locked_until {
            let result = VerificationResult {
                valid: false,
                remaining_attempts: 0,
                requires_online_sync: false,
                locked_until: Some(locked_until),
                message: format!("Device is locked until {}", locked_until.to_rfc3339()),
                updated_bundle: bundle,
            };
            return emit_verification_result(result, args.output.as_ref());
        }
    }

    if now > bundle.last_sync_at + Duration::hours(bundle.require_online_sync_hours) {
        let result = VerificationResult {
            valid: false,
            remaining_attempts: bundle.max_offline_attempts.saturating_sub(bundle.failed_attempts),
            requires_online_sync: true,
            locked_until: bundle.locked_until,
            message: "Offline PIN bundle requires online sync before further use".to_string(),
            updated_bundle: bundle,
        };
        return emit_verification_result(result, args.output.as_ref());
    }

    let device_key = derive_device_key(args.master_key.as_bytes(), &bundle.device_id)?;
    let nonce = B64.decode(bundle.nonce.as_bytes()).map_err(|e| format!("failed to decode nonce: {e}"))?;
    let ciphertext = B64
        .decode(bundle.encrypted_pin_hash.as_bytes())
        .map_err(|e| format!("failed to decode encrypted pin hash: {e}"))?;
    let decrypted_hash = decrypt_pin_hash(&device_key, &nonce, &ciphertext)?;
    let password_hash_str = String::from_utf8(decrypted_hash).map_err(|e| format!("failed to parse decrypted password hash: {e}"))?;

    if verify_pin(&args.pin, &password_hash_str)? {
        bundle.failed_attempts = 0;
        bundle.locked_until = None;
        bundle.checksum = compute_checksum(&bundle, args.master_key.as_bytes())?;
        let result = VerificationResult {
            valid: true,
            remaining_attempts: bundle.max_offline_attempts,
            requires_online_sync: false,
            locked_until: None,
            message: "PIN verified successfully".to_string(),
            updated_bundle: bundle,
        };
        return emit_verification_result(result, args.output.as_ref());
    }

    bundle.failed_attempts += 1;
    let mut remaining_attempts = bundle.max_offline_attempts.saturating_sub(bundle.failed_attempts);
    let mut locked_until = None;
    let mut message = format!("Invalid PIN; {} attempts remaining", remaining_attempts);
    if bundle.failed_attempts >= bundle.max_offline_attempts {
        let lock_until = now + Duration::minutes(bundle.offline_lockout_minutes);
        bundle.locked_until = Some(lock_until);
        bundle.failed_attempts = 0;
        remaining_attempts = 0;
        locked_until = Some(lock_until);
        message = format!("Too many failed attempts; device locked until {}", lock_until.to_rfc3339());
    }
    bundle.checksum = compute_checksum(&bundle, args.master_key.as_bytes())?;

    let result = VerificationResult {
        valid: false,
        remaining_attempts,
        requires_online_sync: false,
        locked_until,
        message,
        updated_bundle: bundle,
    };
    emit_verification_result(result, args.output.as_ref())
}

fn parse_bundle(input: &str) -> Result<OfflinePinBundle, String> {
    if let Ok(wrapper) = serde_json::from_str::<GenerateOutput>(input) {
        return Ok(wrapper.bundle);
    }
    serde_json::from_str(input).map_err(|e| format!("failed to parse bundle JSON: {e}"))
}

fn emit_verification_result(result: VerificationResult, output: Option<&PathBuf>) -> Result<(), String> {
    let json = serde_json::to_string_pretty(&result).map_err(|e| format!("failed to serialize verification result: {e}"))?;
    if let Some(path) = output {
        fs::write(path, format!("{}\n", json)).map_err(|e| format!("failed to write verification result to {}: {e}", path.display()))?;
    }
    println!("{}", json);
    Ok(())
}

fn hash_pin(pin: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(pin.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|e| format!("failed to hash pin: {e}"))
}

fn verify_pin(pin: &str, encoded_hash: &str) -> Result<bool, String> {
    let parsed = PasswordHash::new(encoded_hash).map_err(|e| format!("failed to parse stored password hash: {e}"))?;
    Ok(Argon2::default().verify_password(pin.as_bytes(), &parsed).is_ok())
}

fn derive_device_key(master_key: &[u8], device_id: &str) -> Result<[u8; 32], String> {
    let mut mac = <HmacSha256 as Mac>::new_from_slice(master_key)
        .map_err(|e| format!("failed to initialize key derivation: {e}"))?;
    mac.update(device_id.as_bytes());
    let bytes = mac.finalize().into_bytes();
    let mut key = [0u8; 32];
    key.copy_from_slice(&bytes[..32]);
    Ok(key)
}

struct EncryptedPayload {
    nonce: [u8; 12],
    ciphertext: Vec<u8>,
}

fn encrypt_pin_hash(device_key: &[u8; 32], plaintext: &[u8]) -> Result<EncryptedPayload, String> {
    let cipher = Aes256Gcm::new_from_slice(device_key).map_err(|e| format!("failed to initialize cipher: {e}"))?;
    let mut nonce = [0u8; 12];
    OsRng.fill_bytes(&mut nonce);
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce), plaintext)
        .map_err(|e| format!("failed to encrypt pin hash: {e}"))?;
    Ok(EncryptedPayload { nonce, ciphertext })
}

fn decrypt_pin_hash(device_key: &[u8; 32], nonce: &[u8], ciphertext: &[u8]) -> Result<Vec<u8>, String> {
    if nonce.len() != 12 {
        return Err("invalid nonce length; expected 12 bytes".to_string());
    }
    let cipher = Aes256Gcm::new_from_slice(device_key).map_err(|e| format!("failed to initialize cipher: {e}"))?;
    cipher
        .decrypt(Nonce::from_slice(nonce), ciphertext)
        .map_err(|e| format!("failed to decrypt pin hash: {e}"))
}

#[derive(Serialize)]
struct ChecksumPayload<'a> {
    user_id: &'a str,
    device_id: &'a str,
    encrypted_pin_hash: &'a str,
    nonce: &'a str,
    created_at: String,
    expires_at: String,
    last_sync_at: String,
    failed_attempts: u32,
    locked_until: Option<String>,
    offline_transactions: u32,
    offline_amount_minor: u64,
    version: u32,
    max_offline_attempts: u32,
    offline_lockout_minutes: i64,
    require_online_sync_hours: i64,
}

fn compute_checksum(bundle: &OfflinePinBundle, master_key: &[u8]) -> Result<String, String> {
    let payload = ChecksumPayload {
        user_id: &bundle.user_id,
        device_id: &bundle.device_id,
        encrypted_pin_hash: &bundle.encrypted_pin_hash,
        nonce: &bundle.nonce,
        created_at: bundle.created_at.to_rfc3339(),
        expires_at: bundle.expires_at.to_rfc3339(),
        last_sync_at: bundle.last_sync_at.to_rfc3339(),
        failed_attempts: bundle.failed_attempts,
        locked_until: bundle.locked_until.map(|value| value.to_rfc3339()),
        offline_transactions: bundle.offline_transactions,
        offline_amount_minor: bundle.offline_amount_minor,
        version: bundle.version,
        max_offline_attempts: bundle.max_offline_attempts,
        offline_lockout_minutes: bundle.offline_lockout_minutes,
        require_online_sync_hours: bundle.require_online_sync_hours,
    };

    let payload_bytes = serde_json::to_vec(&payload).map_err(|e| format!("failed to serialize checksum payload: {e}"))?;
    let mut mac = <HmacSha256 as Mac>::new_from_slice(master_key)
        .map_err(|e| format!("failed to initialize checksum hmac: {e}"))?;
    mac.update(&payload_bytes);
    Ok(B64.encode(mac.finalize().into_bytes()))
}
