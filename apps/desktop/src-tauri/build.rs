fn main() {
    let embedded_terminal = std::env::var("CARGO_FEATURE_EMBEDDED_TERMINAL").is_ok();
    let embedded_capability_path = std::path::Path::new("capabilities/embedded-terminal.json");

    if embedded_terminal {
        std::fs::write(
            embedded_capability_path,
            r#"{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "embedded-terminal",
  "description": "PTY access for the Builder embedded terminal",
  "windows": ["main"],
  "permissions": ["pty:default"]
}
"#,
        )
        .expect("write embedded-terminal capability");
    } else if embedded_capability_path.exists() {
        std::fs::remove_file(embedded_capability_path)
            .expect("remove embedded-terminal capability");
    }

    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=capabilities/default.json");
    tauri_build::build();
}
