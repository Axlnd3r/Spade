//! Pure logic of the TAKSIR appraiser enclave (blueprint Section 3), tested
//! natively. `main.rs` is the thin WASI layer around it.

pub mod data;
pub mod output;
pub mod reply;
pub mod request;
