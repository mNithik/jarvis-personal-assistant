//! Wasm module validation for future skill plugins.
//!
//! Full execution sandbox (wasmtime guest, fuel limits) is deferred post–G+.

use wasmparser::{Parser, Payload};

pub const MAX_WASM_MODULE_BYTES: usize = 8 * 1024 * 1024;

pub fn validate_wasm_module(bytes: &[u8]) -> Result<(), String> {
    if bytes.is_empty() {
        return Err("Wasm module is empty.".to_string());
    }
    if bytes.len() > MAX_WASM_MODULE_BYTES {
        return Err(format!(
            "Wasm module exceeds max size of {} bytes.",
            MAX_WASM_MODULE_BYTES
        ));
    }

    let mut parser = Parser::new(0);
    let mut saw_module = false;
    for payload in parser.parse_all(bytes) {
        let payload = payload.map_err(|error| format!("Invalid Wasm module: {error}"))?;
        if matches!(payload, Payload::Version { .. }) {
            saw_module = true;
        }
    }

    if !saw_module {
        return Err("Input is not a valid Wasm module.".to_string());
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_minimal_wasm_module() {
        let minimal = b"\0asm\x01\0\0\0";
        validate_wasm_module(minimal).expect("minimal module");
    }

    #[test]
    fn rejects_invalid_bytes() {
        assert!(validate_wasm_module(b"not wasm").is_err());
    }

    #[test]
    fn rejects_empty_input() {
        assert!(validate_wasm_module(b"").is_err());
    }
}
