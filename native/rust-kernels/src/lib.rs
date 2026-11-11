//! Experimental, read-only NAPI-RS kernels. Never mutate Localtify's database or files.
//! Keep predictable summation order so JS/audio ranking remains numerically comparable.

use napi::{Error, Result, Status};
use napi::bindgen_prelude::Float64Array;
use napi_derive::napi;

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

/// Write a complete score matrix directly to an exclusive JS-owned buffer.
/// Validate every input before mutating the caller's destination.
#[napi]
pub fn dot_matrix_into(rows: &[f64], columns: &[f64], mut output: Float64Array, dimensions: u32) -> Result<()> {
    let dim = dimension(dimensions)?;
    if rows.len() % dim != 0 || columns.len() % dim != 0 {
        return Err(invalid("Vector matrix size is not a multiple of dimension"));
    }
    let row_count = rows.len() / dim;
    let col_count = columns.len() / dim;
    if row_count > 50_000 || col_count > 512 ||
        row_count.checked_mul(col_count).unwrap_or(usize::MAX) > 2_000_000 ||
        output.len() != row_count * col_count {
        return Err(invalid("Invalid matrix output shape"));
    }
    if !rows.iter().chain(columns.iter()).all(|v| v.is_finite()) {
        return Err(invalid("Vector contains non-finite values"));
    }
    let destination = unsafe { output.as_mut() };
    for (i, row) in rows.chunks_exact(dim).enumerate() {
        for (j, column) in columns.chunks_exact(dim).enumerate() {
            destination[i * col_count + j] = dot(row, column);
        }
    }
    Ok(())
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


/// Stream validated duplicate scores directly into a JS-owned typed array.
#[napi]
pub fn pair_dots_into(vectors: &[f64], left: &[u32], right: &[u32], mut output: Float64Array, dimensions: u32) -> Result<()> {
    let dim = dimension(dimensions)?;
    if vectors.len() % dim != 0 || left.len() != right.len() ||
        output.len() != left.len() {
        return Err(invalid("Invalid pair output dimensions"));
    }
    let count = vectors.len() / dim;
    if count > 50_000 || left.len() > 2_000_000 ||
        !vectors.iter().all(|v| v.is_finite()) ||
        left.iter().chain(right.iter()).any(|&index| index as usize >= count) {
        return Err(invalid("Invalid pair index or vector"));
    }
    let destination = unsafe { output.as_mut() };
    for (index, (&a, &b)) in left.iter().zip(right.iter()).enumerate() {
        let a = a as usize;
        let b = b as usize;
        destination[index] = dot(&vectors[a*dim..(a+1)*dim], &vectors[b*dim..(b+1)*dim]);
    }
    Ok(())
}

/// Validate decoded PCM and compute its energy in one native pass.
#[napi]
pub fn pcm_sum_squares(samples: &[f32]) -> Result<f64> {
    if samples.is_empty() || samples.len() > 1_000_000 {
        return Err(invalid("Invalid PCM sample count"));
    }
    let mut total = 0.0_f64;
    for &sample in samples {
        if !sample.is_finite() { return Err(invalid("Invalid PCM sample")); }
        let value = sample as f64;
        total += value * value;
    }
    Ok(total)
}

/// Decode contiguous little-endian Float32 CLAP profiles into a *fresh* JS-owned
/// Float64Array in-place, without creating or copying a Rust return vector.
fn decode_normalized_audio_into_inner(bytes: &[u8], output: &mut [f64], dim: usize) -> Result<()> {
    let stride = dim.checked_mul(4).ok_or_else(|| invalid("Invalid audio decoder dimensions"))?;
    if bytes.is_empty() || bytes.len() % stride != 0 || bytes.len() / 4 > 1_500_000 ||
       output.len() != bytes.len() / 4 {
        return Err(invalid("Invalid audio decoder byte length"));
    }
    let count = bytes.len() / stride;
    if count > 10_000 { return Err(invalid("Audio decoder batch too large")); }
    for (row_index, row) in bytes.chunks_exact(stride).enumerate() {
        let dest = &mut output[row_index * dim..(row_index + 1) * dim];
        let mut square = 0.0_f64;
        for (index, target) in dest.iter_mut().enumerate() {
            let i = index * 4;
            let value = f32::from_le_bytes([row[i], row[i+1], row[i+2], row[i+3]]) as f64;
            if !value.is_finite() { return Err(invalid("Non-finite audio profile value")); }
            *target = value;
            square += value * value;
        }
        let norm = square.sqrt();
        if !norm.is_finite() || norm <= 0.0 {
            return Err(invalid("Zero or invalid audio vector norm"));
        }
        for value in dest { *value /= norm; }
    }
    Ok(())
}

#[cfg(test)]
fn decode_normalized_audio_inner(bytes: &[u8], dim: usize) -> Result<Vec<f64>> {
    let mut result = vec![0.0; bytes.len() / 4];
    decode_normalized_audio_into_inner(bytes, &mut result, dim)?;
    Ok(result)
}

#[napi]
pub fn decode_normalized_audio_into(bytes: &[u8], mut output: Float64Array, dimensions: u32) -> Result<()> {
    // Both arguments are fresh local allocations in a synchronous native call.
    decode_normalized_audio_into_inner(bytes, unsafe { output.as_mut() }, dimension(dimensions)?)
}


/// Run all Lloyd iterations in one Rust call instead of returning a score matrix
/// across the Node-API bridge on every pass. The seeded centers are supplied by
/// JS so its deterministic SHA-256 seed choices and existing mix policy remain.
#[napi(object)]
pub struct ClusterResult {
    pub centers: Vec<f64>,
    pub assignment: Vec<i32>,
    pub cohesion: f64,
}

fn cluster_from_centers_inner(points: &[f64], initial: &[f64], dim: usize, minimum: usize) -> Result<ClusterResult> {
    if points.is_empty() || initial.is_empty() || points.len() % dim != 0 ||
       initial.len() % dim != 0 || points.len() > 1_500_000 {
        return Err(invalid("Invalid clustering matrix shape"));
    }
    let rows = points.len() / dim;
    let groups = initial.len() / dim;
    if rows > 10_000 || groups > 32 || rows.checked_mul(groups).unwrap_or(usize::MAX) > 2_000_000 ||
       minimum > rows || !points.iter().chain(initial.iter()).all(|value| value.is_finite()) {
        return Err(invalid("Invalid clustering size or non-finite feature"));
    }
    let mut centers = initial.to_vec();
    let mut assignments = vec![-1_i32; rows];
    let mut similarity = vec![];
    for _pass in 0..12 {
        similarity = dot_matrix_inner(points, &centers, dim)?;
        let mut next = vec![0_i32; rows];
        let mut sizes = vec![0_usize; groups];
        for i in 0..rows {
            let mut best = 0;
            for c in 1..groups {
                if similarity[i * groups + c] > similarity[i * groups + best] { best = c; }
            }
            next[i] = best as i32;
            sizes[best] += 1;
        }
        for c in 0..groups {
            if sizes[c] >= minimum { continue; }
            let mut movable: Vec<(f64, usize)> = (0..rows)
                .filter(|&i| next[i] != c as i32)
                .map(|i| (similarity[i * groups + next[i] as usize] -
                           similarity[i * groups + c], i))
                .collect();
            movable.sort_by(|a, b|
                a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal)
                    .then_with(|| a.1.cmp(&b.1)));
            for (_, i) in movable {
                if sizes[c] >= minimum { break; }
                let previous = next[i] as usize;
                if sizes[previous] <= minimum { continue; }
                sizes[previous] -= 1;
                next[i] = c as i32;
                sizes[c] += 1;
            }
        }
        let changed = next.iter().zip(assignments.iter()).any(|(a, b)| a != b);
        assignments = next;
        if !changed { break; }
        for c in 0..groups {
            let mut mean = vec![0.0_f64; dim];
            let mut members = 0;
            for i in 0..rows {
                if assignments[i] == c as i32 {
                    members += 1;
                    let offset = i * dim;
                    for j in 0..dim { mean[j] += points[offset + j]; }
                }
            }
            if members > 0 && dot(&mean, &mean) > 1e-12 {
                let norm = dot(&mean, &mean).sqrt();
                if norm > 1e-9 {
                    for value in &mut mean { *value /= norm; }
                } else {
                    mean.fill(0.0);
                }
                centers[c * dim..(c + 1) * dim].copy_from_slice(&mean);
            }
        }
    }
    let mut cohesion = 0.0;
    for i in 0..rows { cohesion += similarity[i * groups + assignments[i] as usize]; }
    if !cohesion.is_finite() || !centers.iter().all(|value| value.is_finite()) {
        return Err(invalid("Invalid clustering result"));
    }
    Ok(ClusterResult { centers, assignment: assignments, cohesion })
}

#[napi]
pub fn cluster_from_centers(points: &[f64], initial: &[f64], dimensions: u32, minimum: u32) -> Result<ClusterResult> {
    cluster_from_centers_inner(points, initial, dimension(dimensions)?, minimum as usize)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pcm_energy_matches_js_and_rejects_non_finite() {
        assert_eq!(pcm_sum_squares(&[0.5, -0.5, 1.0]).unwrap(), 1.5);
        assert!(pcm_sum_squares(&[f32::NAN]).is_err());
        assert!(pcm_sum_squares(&[]).is_err());
    }

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
    fn lloyd_clustering_preserves_assignments_and_bounds() {
        let points = [1.0, 0.0, 0.9, 0.1, -1.0, 0.0, -0.9, -0.1];
        let centers = [1.0, 0.0, -1.0, 0.0];
        let result = cluster_from_centers_inner(&points, &centers, 2, 1).unwrap();
        assert_eq!(result.assignment, vec![0, 0, 1, 1]);
        assert!(result.cohesion > 3.0);
        assert!(cluster_from_centers_inner(&points, &centers, 3, 1).is_err());
        assert!(cluster_from_centers_inner(&points, &centers, 2, 10).is_err());
    }


}
