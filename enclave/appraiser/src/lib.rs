//! Pure logic of the TAKSIR appraiser enclave (blueprint Section 3), tested
//! natively. `main.rs` is the thin WASI layer around it.

pub mod data;
pub mod flow;
pub mod output;
pub mod reply;
pub mod request;
#[cfg(target_os = "wasi")]
pub mod wasi_http;
