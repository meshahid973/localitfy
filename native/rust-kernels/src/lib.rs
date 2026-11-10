//! Experimental, read-only NAPI-RS kernels. Never mutate Localtify's database or files.
//! Keep predictable summation order so JS/audio ranking remains numerically comparable.

use napi::{Error, Result, Status};
use napi_derive::napi;
use std::path::Path;

fn invalid(message: &str) -> Error {
    Error::new(Status::InvalidArg, message.to_owned())
}

fn dimension(value: u32) -> Result<usize> {
    let dim = value as usize;
    if dim == 0 || dim > 16_384 {
        return Err(invalid("Invalid vector dimension"));
    }
    Ok(dim)
}

fn dot(left: &[f64], right: &[f64]) -> f64 {
    let mut sum = 0.0;
    for i in 0..left.len() {
        sum += left[i] * right[i];
    }
    sum
}

/// Row-major matrix of candidate vectors times row-major matrix of seed/cluster vectors.
/// Returns row-major scores. This is a single NAPI crossing per batch, not one per dot.
fn dot_matrix_inner(rows: &[f64], columns: &[f64], dim: usize) -> Result<Vec<f64>> {
    if rows.len() % dim != 0 || columns.len() % dim != 0 {
        return Err(invalid("Vector matrix size is not a multiple of dimension"));
    }
    let r = rows.len() / dim;
    let c = columns.len() / dim;
    if r > 50_000 || c > 512 || r.checked_mul(c).unwrap_or(usize::MAX) > 2_000_000 {
        return Err(invalid("Vector matrix exceeds kernel limits"));
    }
    if !rows.iter().chain(columns.iter()).all(|x| x.is_finite()) {
        return Err(invalid("Vector contains non-finite values"));
    }
    let mut result = Vec::with_capacity(r * c);
    for row in rows.chunks_exact(dim) {
        for column in columns.chunks_exact(dim) {
            result.push(dot(row, column));
        }
    }
    Ok(result)
}

#[napi]
pub fn dot_matrix(rows: &[f64], columns: &[f64], dimensions: u32) -> Result<Vec<f64>> {
    dot_matrix_inner(rows, columns, dimension(dimensions)?)
}

/// Match candidate pair indexes to vectors packed in row-major order.
/// Index arrays are Uint32Array values and have equal length.
fn pair_dots_inner(vectors: &[f64], left: &[u32], right: &[u32], dim: usize) -> Result<Vec<f64>> {
    if vectors.len() % dim != 0 || left.len() != right.len() {
        return Err(invalid("Invalid pair matrix dimensions"));
    }
    let count = vectors.len() / dim;
    if count > 50_000 || left.len() > 2_000_000 {
        return Err(invalid("Pair matrix exceeds kernel limits"));
    }
    if !vectors.iter().all(|x| x.is_finite()) {
        return Err(invalid("Pair matrix contains non-finite values"));
    }
    let mut result = Vec::with_capacity(left.len());
    for (&a, &b) in left.iter().zip(right.iter()) {
        let a = a as usize;
        let b = b as usize;
        if a >= count || b >= count {
            return Err(invalid("Pair index is outside the vector matrix"));
        }
        result.push(dot(&vectors[a*dim..(a+1)*dim], &vectors[b*dim..(b+1)*dim]));
    }
    Ok(result)
}

#[napi]
pub fn pair_dots(vectors: &[f64], left: &[u32], right: &[u32], dimensions: u32) -> Result<Vec<f64>> {
    pair_dots_inner(vectors, left, right, dimension(dimensions)?)
}


/// Center and normalize all library audio vectors in a *single* native call.
/// Mirrors listening-signals.cjs libraryMean/centered: row-order mean
/// accumulation, scalar square summation and the same 1e-9 zero threshold.
/// The caller retains JS as the opt-out/failure fallback.
fn center_audio_inner(vectors: &[f64], dim: usize) -> Result<Vec<f64>> {
    if vectors.is_empty() || vectors.len() % dim != 0 || vectors.len() > 1_500_000 {
        return Err(invalid("Invalid centered audio matrix size"));
    }
    let rows = vectors.len() / dim;
    if rows > 10_000 || !vectors.iter().all(|value| value.is_finite()) {
        return Err(invalid("Invalid or non-finite centered audio matrix"));
    }
    let mut mean = vec![0.0; dim];
    for row in vectors.chunks_exact(dim) {
        for i in 0..dim {
            mean[i] += row[i] / rows as f64;
        }
    }
    let mut centered = Vec::with_capacity(vectors.len());
    for row in vectors.chunks_exact(dim) {
        let offset = centered.len();
        let mut magnitude = 0.0;
        for i in 0..dim {
            let value = row[i] - mean[i];
            centered.push(value);
            magnitude += value * value;
        }
        let norm = magnitude.sqrt();
        if norm > 1e-9 {
            for value in &mut centered[offset..] {
                *value /= norm;
            }
        } else {
            centered[offset..].fill(0.0);
        }
    }
    Ok(centered)
}

#[napi]
pub fn center_audio_vectors(vectors: &[f64], dimensions: u32) -> Result<Vec<f64>> {
    center_audio_inner(vectors, dimension(dimensions)?)
}


/// Decode and normalize contiguous little-endian Float32 CLAP vectors.
/// Mirrors Buffer.readFloatLE + scalar Float64 norm in readNormalizedVector().
/// A malformed vector rejects the entire batch, so JS can skip only that row.
fn decode_normalized_audio_inner(bytes: &[u8], dim: usize) -> Result<Vec<f64>> {
    let stride = dim.checked_mul(4).ok_or_else(|| invalid("Invalid audio decoder dimensions"))?;
    if bytes.is_empty() || bytes.len() % stride != 0 || bytes.len() / 4 > 1_500_000 {
        return Err(invalid("Invalid audio decoder byte length"));
    }
    let count = bytes.len() / stride;
    if count > 10_000 {
        return Err(invalid("Audio decoder batch too large"));
    }
    let mut result = Vec::with_capacity(count * dim);
    for row in bytes.chunks_exact(stride) {
        let offset = result.len();
        let mut square = 0.0_f64;
        for index in 0..dim {
            let i = index * 4;
            let value = f32::from_le_bytes([row[i], row[i + 1], row[i + 2], row[i + 3]]) as f64;
            if !value.is_finite() {
                return Err(invalid("Non-finite audio profile value"));
            }
            result.push(value);
            square += value * value;
        }
        let norm = square.sqrt();
        if !norm.is_finite() || norm <= 0.0 {
            return Err(invalid("Zero or invalid audio vector norm"));
        }
        for value in &mut result[offset..] {
            *value /= norm;
        }
    }
    Ok(result)
}

#[napi]
pub fn decode_normalized_audio(bytes: &[u8], dimensions: u32) -> Result<Vec<f64>> {
    decode_normalized_audio_inner(bytes, dimension(dimensions)?)
}

#[napi(object)]
pub struct ScanResult {
    pub files: Vec<String>,
    pub truncated: bool,
}

fn partial_file(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    [".part", ".tmp", ".download", ".crdownload"]
        .iter().any(|ext| lower.ends_with(ext))
}

fn visit(
    folder: &Path,
    depth: usize,
    limit: usize,
    extensions: &[String],
    result: &mut ScanResult,
) {
    if depth > 12 || result.files.len() >= limit {
        return;
    }
    let entries = match std::fs::read_dir(folder) {
        Ok(entries) => entries,
        Err(_) => return, // Matches the original JS skip-on-unreadable-folder behavior.
    };
    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => { result.truncated = true; return; }
        };
        if result.files.len() >= limit {
            result.truncated = true;
            return;
        }
        let os_name = entry.file_name();
        let name = match os_name.to_str() {
            Some(value) => value.to_owned(),
            None => { result.truncated = true; return; }
        };
        if name.starts_with('.') {
            continue;
        }
        let kind = match entry.file_type() {
            Ok(kind) => kind,
            Err(_) => { result.truncated = true; return; }
        };
        if kind.is_dir() {
            if depth < 12 && name != "localitfy-bin" && name != "spotify-covers" {
                visit(&entry.path(), depth + 1, limit, extensions, result);
            }
        } else if kind.is_file() && !partial_file(&name) {
            let allowed = entry.path().extension().and_then(|s| s.to_str())
                .map(|ext| extensions.iter().any(|accepted| accepted.eq_ignore_ascii_case(ext)))
                .unwrap_or(false);
            if allowed {
                let candidate = entry.path();
                match candidate.to_str() {
                    Some(file) => result.files.push(file.to_owned()),
                    None => { result.truncated = true; return; }
                }
            }
        }
    }
}

#[napi]
pub fn scan_audio_files(root: String, limit: u32, extensions: Vec<String>) -> Result<ScanResult> {
    if limit > 50_000 || extensions.len() > 64 ||
       extensions.iter().any(|ext| ext.is_empty() || ext.len() > 16 ||
           !ext.as_bytes().iter().all(|c| c.is_ascii_alphanumeric())) {
        return Err(invalid("Invalid audio scan bounds or extension"));
    }
    let mut result = ScanResult { files: Vec::new(), truncated: false };
    if limit == 0 {
        return Ok(result);
    }
    visit(Path::new(&root), 0, limit as usize, &extensions, &mut result);
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dot_matrix_matches_scalar_and_row_order() {
        let values = dot_matrix_inner(&[1., 2., 3., 4.], &[2., 0., -1., 3.], 2).unwrap();
        assert_eq!(values, vec![2., 5., 6., 9.]);
        assert!(dot_matrix_inner(&[1.], &[2.,3.], 2).is_err());
    }

    #[test]
    fn pair_dots_are_ordered_and_bounded() {
        let values = pair_dots_inner(&[1., 0., 0., 1., 0.5, 0.5], &[0, 1], &[2, 2], 2).unwrap();
        assert_eq!(values, vec![0.5, 0.5]);
        assert!(pair_dots_inner(&[1., 0.], &[0], &[1], 2).is_err());
    }

    #[test]
    fn center_audio_matches_js_scalar_contract_and_rejects_invalid_rows() {
        let rows = [1.0, 0.0, 0.0, 1.0, -1.0, 0.0];
        let actual = center_audio_inner(&rows, 2).unwrap();
        let mean = [0.0, 1.0 / 3.0];
        for (index, row) in rows.chunks_exact(2).enumerate() {
            let mut expected = [row[0] - mean[0], row[1] - mean[1]];
            let norm = (expected[0] * expected[0] + expected[1] * expected[1]).sqrt();
            if norm > 1e-9 { expected[0] /= norm; expected[1] /= norm; }
            for col in 0..2 {
                assert!((actual[index * 2 + col] - expected[col]).abs() < 1e-12);
            }
        }
        let identical = center_audio_inner(&[1.0, 2.0, 1.0, 2.0], 2).unwrap();
        assert_eq!(identical, vec![0.0; 4]);
        assert!(center_audio_inner(&[f64::NAN, 1.0], 2).is_err());
        assert!(center_audio_inner(&[1.0, 2.0, 3.0], 2).is_err());
    }

    #[test]
    fn audio_decoder_matches_float32_scalar_and_rejects_bad_rows() {
        let input: Vec<u8> = [1.0f32, 2.0, -3.0, 4.0]
            .iter().flat_map(|value| value.to_le_bytes()).collect();
        let decoded = decode_normalized_audio_inner(&input, 2).unwrap();
        let first = 5.0f64.sqrt();
        let second = 25.0f64.sqrt();
        assert!((decoded[0] - 1.0/first).abs() < 1e-12);
        assert!((decoded[1] - 2.0/first).abs() < 1e-12);
        assert!((decoded[2] + 3.0/second).abs() < 1e-12);
        assert!((decoded[3] - 4.0/second).abs() < 1e-12);
        assert!(decode_normalized_audio_inner(&[0u8; 8], 2).is_err());
        assert!(decode_normalized_audio_inner(&[1u8; 7], 2).is_err());
    }

    #[test]
    fn scanner_follows_hidden_partial_depth_and_extension_contract() {
        let folder = std::env::temp_dir().join(format!("localtify-rust-test-{}",std::process::id()));
        std::fs::create_dir_all(folder.join("album")).unwrap();
        std::fs::write(folder.join("album").join("one.mp3"), b"test").unwrap();
        std::fs::write(folder.join("album").join("two.crdownload"), b"test").unwrap();
        std::fs::write(folder.join("album").join(".hidden.mp3"), b"test").unwrap();
        let mut result = ScanResult { files: Vec::new(), truncated: false };
        visit(&folder,0,100,&["mp3".to_owned()],&mut result);
        assert_eq!(result.files.len(),1);
        assert!(result.files[0].ends_with("one.mp3"));
        let _ = std::fs::remove_dir_all(folder);
    }
}
