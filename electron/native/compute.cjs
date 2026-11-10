"use strict";

// Both helpers return null on any unavailable/invalid native result.
// Callers MUST keep the original JS calculation as their fallback.
const { getAddon, warnOnce } = require("./backend.cjs");

function tryDotMatrix(rows, columns) {
  const native = getAddon("similarity");
  if (!native || typeof native.dotMatrix !== "function" || !rows.length || !columns.length) return null;
  const dim = rows[0]?.length;
  if (!Number.isSafeInteger(dim) || dim < 1 || dim > 16384 || rows.length * columns.length > 2000000) return null;
  if (rows.some((v) => !v || v.length !== dim) || columns.some((v) => !v || v.length !== dim)) return null;
  try {
    const packedRows = new Float64Array(rows.length * dim);
    const packedColumns = new Float64Array(columns.length * dim);
    rows.forEach((row, i) => packedRows.set(row, i * dim));
    columns.forEach((row, i) => packedColumns.set(row, i * dim));
    const result = native.dotMatrix(packedRows, packedColumns, dim);
    if (!Array.isArray(result) || result.length !== rows.length * columns.length ||
      result.some((n) => !Number.isFinite(n))) throw new Error("Invalid dot-matrix output");
    // Canary a few cells before trusting the native backend. A bad build MUST fail closed.
    for (const idx of [0, result.length - 1]) {
      const i = Math.floor(idx / columns.length), j = idx % columns.length;
      let expected = 0;
      for (let k = 0; k < dim; k++) expected += rows[i][k] * columns[j][k];
      if (Math.abs(result[idx] - expected) > 1e-9) throw new Error("Dot-matrix parity mismatch");
    }
    return result;
  } catch (error) { warnOnce("similarity", error); return null; }
}

function tryPairDots(bucket, vectors) {
  const native = getAddon("duplicates");
  if (!native || typeof native.pairDots !== "function" || bucket.length < 2) return null;
  const items = bucket.map((item) => vectors.get(item.id));
  const dim = items[0]?.length;
  if (!Number.isSafeInteger(dim) || dim < 1 || dim > 16384 ||
    items.some((v) => !v || v.length !== dim) || bucket.length * (bucket.length - 1) / 2 > 2000000) return null;
  try {
    const packed = new Float64Array(bucket.length * dim);
    items.forEach((item, i) => packed.set(item, i * dim));
    const left = [], right = [];
    for (let i=0; i<bucket.length; i++) for(let j=i+1; j<bucket.length; j++) {
      left.push(i); right.push(j);
    }
    const result = native.pairDots(packed, Uint32Array.from(left), Uint32Array.from(right), dim);
    if (!Array.isArray(result) || result.length !== left.length ||
      result.some((n) => !Number.isFinite(n))) throw new Error("Invalid duplicate-pair output");
    for(const idx of [0, result.length - 1]) {
      let expected = 0;
      for(let k=0; k<dim; k++) expected += items[left[idx]][k] * items[right[idx]][k];
      if(Math.abs(expected-result[idx]) > 1e-9) throw new Error("Duplicate-pair parity mismatch");
    }
    return result;
  } catch(error) { warnOnce("duplicates", error); return null; }
}
module.exports = { tryDotMatrix, tryPairDots };
