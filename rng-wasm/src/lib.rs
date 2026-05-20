use wasm_bindgen::prelude::*;

const FNV_OFFSET: u32 = 2166136261;
const FNV_PRIME: u32 = 16777619;
const LEHMER_MULT: u32 = 279470273;
const LEHMER_MOD: u32 = 4294967291;
const KNUTH_MIX: u32 = 2654435761;

const NAME_GIVE_PIECE_AT_START: u32 = stable_string_hash_bytes(b"GIVE_PIECE_AT_START");
const NAME_GACHAPON_RARITY: u32 = stable_string_hash_bytes(b"GACHAPON_RARITY");
const NAME_GACHAPON_COMMON: u32 = stable_string_hash_bytes(b"GACHAPON_COMMON");
const NAME_GACHAPON_RARE: u32 = stable_string_hash_bytes(b"GACHAPON_RARE");
const NAME_GACHAPON_EPIC: u32 = stable_string_hash_bytes(b"GACHAPON_EPIC");
const NAME_GACHAPON_LEGENDARY: u32 = stable_string_hash_bytes(b"GACHAPON_LEGENDARY");

const GACHAPON_NAMES: [u32; 4] = [
    NAME_GACHAPON_COMMON,
    NAME_GACHAPON_RARE,
    NAME_GACHAPON_EPIC,
    NAME_GACHAPON_LEGENDARY,
];

// Size of each Gambits_<R> pool, baked from extract_gambits.py output.
// Update both these constants and the JS GAMBIT_POOL_SIZES if the game ever
// adds new gambits.
const POOL_SIZE_COMMON: u8 = 68;
const POOL_SIZE_RARE: u8 = 65;
const POOL_SIZE_EPIC: u8 = 47;
const POOL_SIZE_LEGENDARY: u8 = 20;
const POOL_SIZES: [u8; 4] = [
    POOL_SIZE_COMMON,
    POOL_SIZE_RARE,
    POOL_SIZE_EPIC,
    POOL_SIZE_LEGENDARY,
];
const MAX_POOL_SIZE: usize = POOL_SIZE_COMMON as usize;

const fn stable_string_hash_bytes(s: &[u8]) -> u32 {
    let mut h = FNV_OFFSET;
    let mut i = 0;
    while i < s.len() {
        h ^= s[i] as u32;
        h = h.wrapping_mul(FNV_PRIME);
        i += 1;
    }
    h
}

#[inline(always)]
fn long_hash_code(v: i64) -> u32 {
    let bits = v as u64;
    ((bits & 0xFFFFFFFF) ^ (bits >> 32)) as u32
}

#[inline(always)]
fn occurrence_seed(seed: u32, name_hash: u32, wave: i32, counter: u32) -> u32 {
    let mut h = FNV_OFFSET;
    h ^= seed;
    h = h.wrapping_mul(FNV_PRIME);
    h ^= name_hash;
    h = h.wrapping_mul(FNV_PRIME);
    h ^= wave as u32;
    h = h.wrapping_mul(FNV_PRIME);
    h ^= long_hash_code((counter as i64).wrapping_mul(KNUTH_MIX as i64));
    h.wrapping_mul(FNV_PRIME)
}

#[inline(always)]
fn lehmer_next(state: u32) -> u32 {
    state.wrapping_mul(LEHMER_MULT) % LEHMER_MOD
}

#[inline(always)]
fn lehmer_range(seed: u32, lo: i32, hi: i32) -> i32 {
    let nxt = lehmer_next(seed);
    let v = (nxt as f32) / 4294967296.0_f32;
    let span = (hi - lo) as f32;
    let scaled = v * span;
    lo + (scaled as f64).floor() as i32
}

#[inline(always)]
fn occurrence_int(seed: u32, name_hash: u32, wave: i32, counter: u32, lo: i32, hi: i32) -> i32 {
    lehmer_range(occurrence_seed(seed, name_hash, wave, counter), lo, hi)
}

const PIECE_PAWN: u8 = 0;
const PIECE_ROOK: u8 = 1;
const PIECE_KNIGHT: u8 = 2;
const PIECE_BISHOP: u8 = 3;
const PIECE_QUEEN: u8 = 4;
const PIECE_KING: u8 = 5;

#[inline(always)]
fn classify_piece(roll: i32) -> u8 {
    if roll < 60 { PIECE_PAWN }
    else if roll < 70 { PIECE_KING }
    else if roll < 80 { PIECE_KNIGHT }
    else if roll < 90 { PIECE_BISHOP }
    else if roll < 95 { PIECE_ROOK }
    else { PIECE_QUEEN }
}

#[inline(always)]
fn simulate_starters(seed: u32) -> [u8; 3] {
    let mut out = [0u8; 3];
    let mut offset = 0u8;
    for i in 0..3u32 {
        let lo = if offset >= 2 { 60 } else { 0 };
        let roll = occurrence_int(seed, NAME_GIVE_PIECE_AT_START, 0, i, lo, 100);
        let p = classify_piece(roll);
        if p == PIECE_PAWN { offset += 1; }
        out[i as usize] = p;
    }
    out
}

#[inline(always)]
fn gachapon_roll(seed: u32, wave: i32, counter: u32) -> i32 {
    occurrence_int(seed, NAME_GACHAPON_RARITY, wave, counter, 0, 101)
}

#[inline(always)]
fn rarity_tier(roll: i32) -> u8 {
    if roll > 89 { 3 }       // LEGENDARY
    else if roll > 69 { 2 }  // EPIC
    else if roll > 39 { 1 }  // RARE
    else { 0 }               // COMMON
}

/// Initial pool (account-unlock filtered) per rarity tier. `len[tier]`
/// is the size of the usable pool for that tier; `idx[tier][0..len]`
/// are the surviving poolIndex values in the order the game iterates
/// them (which matches `Gambits_<R>` minus excluded items).
#[derive(Clone, Copy)]
struct FilteredPools {
    len: [u8; 4],
    idx: [[u8; MAX_POOL_SIZE]; 4],
}

const FULL_POOLS: FilteredPools = build_full_pools();

const fn build_full_pools() -> FilteredPools {
    let mut p = FilteredPools {
        len: [0; 4],
        idx: [[0; MAX_POOL_SIZE]; 4],
    };
    let mut tier = 0;
    while tier < 4 {
        let n = POOL_SIZES[tier] as usize;
        let mut i = 0;
        while i < n {
            p.idx[tier][i] = i as u8;
            i += 1;
        }
        p.len[tier] = n as u8;
        tier += 1;
    }
    p
}

/// Build the per-rarity pools after removing the user's locked/excluded
/// gambits. `excluded` is a list of words packed the same way as gambit
/// targets: bits[0..2]=rarity, bits[8..16]=poolIndex.
#[inline]
fn build_filtered_pools(excluded: &[u32]) -> FilteredPools {
    // poolIndex is < 128, so a u128 bitmask per rarity covers it.
    let mut mask = [0u128; 4];
    for &w in excluded {
        let rarity = (w & 0x3) as usize;
        let pi = ((w >> 8) & 0xFF) as usize;
        if rarity < 4 && pi < 128 {
            mask[rarity] |= 1u128 << pi;
        }
    }
    let mut p = FilteredPools {
        len: [0; 4],
        idx: [[0; MAX_POOL_SIZE]; 4],
    };
    for tier in 0..4 {
        let pool_size = POOL_SIZES[tier] as usize;
        let m = mask[tier];
        let mut len = 0u8;
        for i in 0..pool_size {
            if (m >> i) & 1 == 0 {
                p.idx[tier][len as usize] = i as u8;
                len += 1;
            }
        }
        p.len[tier] = len;
    }
    p
}

/// Simulate the 3-pick gambit selection a single gachapon performs once
/// `rarity_tier` is known. Mirrors `GambitLibrary.SelectGambits` with
/// `canBeDamped=false`. The initial pool comes from `pools` (which has
/// account-locked gambits stripped) — within that, each pick removes by
/// index, preserving order to match C# `List<T>.RemoveAt`.
///
/// `counter_base` is the per-rarity counter BEFORE this gachapon's first
/// pick. Returns 3 poolIndex values (or `u8::MAX` if the pool ran out).
#[inline(always)]
fn simulate_gambit_picks(
    seed: u32,
    wave: i32,
    counter_base: u32,
    tier: u8,
    pools: &FilteredPools,
) -> [u8; 3] {
    let tier_i = tier as usize;
    let name_hash = GACHAPON_NAMES[tier_i];

    let mut pool = pools.idx[tier_i];
    let mut len = pools.len[tier_i] as usize;
    let mut picks = [u8::MAX; 3];
    for i in 0..3 {
        if len == 0 { break; }
        let counter = counter_base + i as u32;
        let idx = occurrence_int(seed, name_hash, wave, counter, 0, len as i32) as usize;
        picks[i] = pool[idx];
        for j in idx..(len - 1) {
            pool[j] = pool[j + 1];
        }
        len -= 1;
    }
    picks
}

// Filter wire format (u32 words):
//   word 0: bits[0..3]=slot0_piece, [3]=slot0_any,
//           [4..7]=slot1_piece, [7]=slot1_any,
//           [8..11]=slot2_piece, [11]=slot2_any,
//           bit[12]=unordered, bit[13]=has_gambit_filter,
//           bit[14]=has_exclusions,
//           bits[16..24]=num_gachapons (max 32),
//           bits[24..32]=gambit_max_gach (0..32, only if has_gambit_filter)
//   per gachapon (2 words):
//     word: wave (i32 packed as u32)
//     word: bits[0..7]=counter, [8..10]=tier_min (0..3), [10..12]=tier_max,
//           [16..24]=roll_min (0..100), [24..32]=roll_max (0..100)
//   if has_gambit_filter:
//     word: num_targets
//     per target (1 word each): bits[0..2]=rarity (0..3), bits[8..16]=poolIndex
//   if has_exclusions:
//     word: num_excluded
//     per excluded (1 word each): same packing as targets

#[inline(always)]
fn matches_starters(starters: [u8; 3], filter_word: u32, unordered: bool) -> bool {
    let s0 = (filter_word & 0x7) as u8;
    let a0 = (filter_word >> 3) & 1 != 0;
    let s1 = ((filter_word >> 4) & 0x7) as u8;
    let a1 = (filter_word >> 7) & 1 != 0;
    let s2 = ((filter_word >> 8) & 0x7) as u8;
    let a2 = (filter_word >> 11) & 1 != 0;
    if unordered {
        let mut want = [0u8; 6];
        let mut got = [0u8; 6];
        if !a0 { want[s0 as usize] += 1; }
        if !a1 { want[s1 as usize] += 1; }
        if !a2 { want[s2 as usize] += 1; }
        for &p in &starters { got[p as usize] += 1; }
        for i in 0..6 {
            if want[i] > got[i] { return false; }
        }
        true
    } else {
        (a0 || s0 == starters[0]) && (a1 || s1 == starters[1]) && (a2 || s2 == starters[2])
    }
}

#[inline(always)]
fn matches_gachapons(seed: u32, filters: &[u32], num: usize) -> bool {
    let base = 1usize;
    for i in 0..num {
        let wave = filters[base + i * 2] as i32;
        let packed = filters[base + i * 2 + 1];
        let counter = packed & 0xFF;
        let tier_min = ((packed >> 8) & 0x3) as u8;
        let tier_max = ((packed >> 10) & 0x3) as u8;
        let roll_min = ((packed >> 16) & 0xFF) as i32;
        let roll_max = ((packed >> 24) & 0xFF) as i32;
        let roll = gachapon_roll(seed, wave, counter);
        if roll < roll_min || roll > roll_max { return false; }
        let tier = rarity_tier(roll);
        if tier < tier_min || tier > tier_max { return false; }
    }
    true
}

/// True if any of the target (rarity, poolIndex) pairs appears in one of
/// the first `max_gach` gachapons. Wave model: gachapon #N opens at wave
/// N+1 (the existing app convention used by `defaultGachapon`). The
/// per-rarity pool comes from `pools` (after applying user exclusions).
#[inline(always)]
fn matches_gambit_filter(
    seed: u32,
    max_gach: u32,
    targets: &[u32],
    pools: &FilteredPools,
) -> bool {
    let mut want_mask: u8 = 0;
    for &t in targets {
        let rarity = (t & 0x3) as u8;
        want_mask |= 1u8 << rarity;
    }
    if want_mask == 0 || max_gach == 0 { return false; }

    let mut per_rarity_counter = [0u32; 4];
    for g in 0..max_gach {
        let wave = (g + 1) as i32;
        let rarity_roll = occurrence_int(seed, NAME_GACHAPON_RARITY, wave, g, 0, 101);
        let tier = rarity_tier(rarity_roll);
        if (want_mask >> tier) & 1 == 1 {
            let picks = simulate_gambit_picks(
                seed,
                wave,
                per_rarity_counter[tier as usize],
                tier,
                pools,
            );
            for &t in targets {
                let tr = (t & 0x3) as u8;
                if tr != tier { continue; }
                let pi = ((t >> 8) & 0xFF) as u8;
                if picks[0] == pi || picks[1] == pi || picks[2] == pi {
                    return true;
                }
            }
        }
        per_rarity_counter[tier as usize] += 3;
    }
    false
}

/// Inner search loop, shared by `search_range` and `search_paginated`.
/// Iterates seeds in [seed_start, seed_end), writes matches to `out_buf`
/// up to the per-call `match_cap`, and returns `(matches_written,
/// next_seed_to_scan)` — the second value is the resume cursor for the
/// paginated entry point.
///
/// `seed_end == 0` is a sentinel meaning "no upper bound" — keep
/// scanning until the cursor wraps off the top of the u32 space.
/// (Necessary because the seed space is 2^32 which doesn't fit in u32,
/// so JS can't pass the true upper bound through wasm-bindgen.)
#[inline(always)]
fn search_inner(
    seed_start: u32,
    seed_end: u32,
    filters: &[u32],
    out_buf: &mut [u32],
    match_cap: u32,
) -> (u32, u32) {
    if filters.is_empty() { return (0, seed_start); }
    let f0 = filters[0];
    let unordered = (f0 >> 12) & 1 != 0;
    let has_gambit = (f0 >> 13) & 1 != 0;
    let has_excl = (f0 >> 14) & 1 != 0;
    let num_gach = ((f0 >> 16) & 0xFF) as usize;
    let gambit_max_gach = ((f0 >> 24) & 0xFF) as u32;

    // Locate the gambit-filter section (right after the gachapon rows).
    let mut cursor = 1 + num_gach * 2;
    let (gambit_max, gambit_targets): (u32, &[u32]) = if has_gambit
        && cursor < filters.len()
    {
        let num_targets = filters[cursor] as usize;
        let tstart = cursor + 1;
        let tend = (tstart + num_targets).min(filters.len());
        cursor = tend;
        (gambit_max_gach, &filters[tstart..tend])
    } else {
        (0, &[])
    };

    // Exclusion section follows.
    let pools = if has_excl && cursor < filters.len() {
        let num_excl = filters[cursor] as usize;
        let estart = cursor + 1;
        let eend = (estart + num_excl).min(filters.len());
        build_filtered_pools(&filters[estart..eend])
    } else {
        FULL_POOLS
    };

    let buf_cap = out_buf.len() as u32;
    let cap = if match_cap == 0 { buf_cap } else { match_cap.min(buf_cap) };
    let bounded = seed_end != 0;
    let mut written: u32 = 0;
    let mut seed = seed_start;
    while written < cap {
        if bounded && seed >= seed_end { break; }
        let starters = simulate_starters(seed);
        if matches_starters(starters, f0, unordered) {
            let pass_gach = num_gach == 0 || matches_gachapons(seed, filters, num_gach);
            if pass_gach {
                let pass_gambit = !has_gambit
                    || matches_gambit_filter(seed, gambit_max, gambit_targets, &pools);
                if pass_gambit {
                    out_buf[written as usize] = seed;
                    written += 1;
                }
            }
        }
        seed = seed.wrapping_add(1);
        if seed == 0 && seed_start != 0 {
            // u32 wraparound — we've finished the entire seed space.
            return (written, 0);
        }
    }
    (written, seed)
}

/// Full-range scan. Returns number of matches written to `out_buf`. The
/// `out_buf` size is the only cap. Existing callers (the vitest suite)
/// continue to use this entry point.
#[wasm_bindgen]
pub fn search_range(
    seed_start: u32,
    seed_end: u32,
    filters: &[u32],
    out_buf: &mut [u32],
) -> u32 {
    let (written, _) = search_inner(seed_start, seed_end, filters, out_buf, 0);
    written
}

/// Paginated scan — stops once either `out_buf` fills OR `match_cap`
/// matches have been written, whichever comes first. Returns a 2-element
/// vec `[matches_written, resume_cursor]`. `resume_cursor` is the next
/// seed to scan (== `seed_end` if the range was exhausted; == `0` if the
/// scan walked off the top of the u32 space).
#[wasm_bindgen]
pub fn search_paginated(
    seed_start: u32,
    seed_end: u32,
    filters: &[u32],
    out_buf: &mut [u32],
    match_cap: u32,
) -> Vec<u32> {
    let (written, cursor) = search_inner(
        seed_start, seed_end, filters, out_buf, match_cap,
    );
    vec![written, cursor]
}

/// Per-seed inspector: returns the 3 gambit pool indices for the gachapon
/// at index `gach_idx` (0-based), under the same simplified wave model
/// used by `matches_gambit_filter`. `excluded` is the same packed-word
/// list the search kernel consumes — pass an empty slice for the full
/// "all unlocked" pool.
///
/// Output layout: `[rarity, pick0, pick1, pick2, rarityRoll]`. `rarity`
/// is 0..3, picks are 0..pool_size-1 or 255 if the pool ran out.
#[wasm_bindgen(js_name = predictGachaponGambits)]
pub fn predict_gachapon_gambits_js(
    seed: u32,
    gach_idx: u32,
    excluded: &[u32],
) -> Vec<i32> {
    let pools = if excluded.is_empty() {
        FULL_POOLS
    } else {
        build_filtered_pools(excluded)
    };
    let mut per_rarity_counter = [0u32; 4];
    for g in 0..gach_idx {
        let wave = (g + 1) as i32;
        let r = occurrence_int(seed, NAME_GACHAPON_RARITY, wave, g, 0, 101);
        let tier = rarity_tier(r);
        per_rarity_counter[tier as usize] += 3;
    }
    let wave = (gach_idx + 1) as i32;
    let rarity_roll = occurrence_int(seed, NAME_GACHAPON_RARITY, wave, gach_idx, 0, 101);
    let tier = rarity_tier(rarity_roll);
    let picks = simulate_gambit_picks(
        seed,
        wave,
        per_rarity_counter[tier as usize],
        tier,
        &pools,
    );
    vec![
        tier as i32,
        picks[0] as i32,
        picks[1] as i32,
        picks[2] as i32,
        rarity_roll,
    ]
}

/// Returns a flat `[lo, num, piece] × 3` array (9 i32s) so the main thread
/// can render the inspector without a TS RNG port.
#[wasm_bindgen(js_name = simulateStarters)]
pub fn simulate_starters_js(seed: u32) -> Vec<i32> {
    let mut out = Vec::with_capacity(9);
    let mut offset = 0u8;
    for i in 0..3u32 {
        let lo = if offset >= 2 { 60 } else { 0 };
        let roll = occurrence_int(seed, NAME_GIVE_PIECE_AT_START, 0, i, lo, 100);
        let p = classify_piece(roll);
        if p == PIECE_PAWN { offset += 1; }
        out.push(lo);
        out.push(roll);
        out.push(p as i32);
    }
    out
}

#[wasm_bindgen(js_name = gachaponRoll)]
pub fn gachapon_roll_js(seed: u32, wave: i32, counter: u32) -> i32 {
    gachapon_roll(seed, wave, counter)
}

#[wasm_bindgen]
pub fn inspect_starter_rolls(seed: u32) -> Vec<i32> {
    let mut out = Vec::with_capacity(6);
    let mut offset = 0u8;
    for i in 0..3u32 {
        let lo = if offset >= 2 { 60 } else { 0 };
        let roll = occurrence_int(seed, NAME_GIVE_PIECE_AT_START, 0, i, lo, 100);
        let p = classify_piece(roll);
        if p == PIECE_PAWN { offset += 1; }
        out.push(roll);
        out.push(p as i32);
    }
    out
}

#[wasm_bindgen]
pub fn inspect_gachapon_rolls(seed: u32, max_wave: u32, max_counter: u32) -> Vec<i32> {
    let mut out = Vec::with_capacity((max_wave * max_counter) as usize);
    for w in 1..=max_wave {
        for c in 0..max_counter {
            out.push(gachapon_roll(seed, w as i32, c));
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pieces_to_names(p: [u8; 3]) -> [&'static str; 3] {
        let n = ["PAWN", "ROOK", "KNIGHT", "BISHOP", "QUEEN", "KING"];
        [n[p[0] as usize], n[p[1] as usize], n[p[2] as usize]]
    }

    // Reproduce predict_gachapon_gambits_js without the wasm wrapper so we
    // can call it from a native cargo test. Uses the full (all-unlocked)
    // pool — exclusion behaviour is covered by `excludes_reduce_pool_size`.
    fn predict_native(seed: u32, gach_idx: u32) -> (u8, [u8; 3], i32) {
        let mut per_rarity_counter = [0u32; 4];
        for g in 0..gach_idx {
            let wave = (g + 1) as i32;
            let r = occurrence_int(seed, NAME_GACHAPON_RARITY, wave, g, 0, 101);
            per_rarity_counter[rarity_tier(r) as usize] += 3;
        }
        let wave = (gach_idx + 1) as i32;
        let rr = occurrence_int(seed, NAME_GACHAPON_RARITY, wave, gach_idx, 0, 101);
        let tier = rarity_tier(rr);
        let picks = simulate_gambit_picks(
            seed,
            wave,
            per_rarity_counter[tier as usize],
            tier,
            &FULL_POOLS,
        );
        (tier, picks, rr)
    }

    // Vectors generated from predict_gambits.py (the Python reference,
    // which threads through the verified gambonanza_rng.py port).
    //   (seed, gach_idx, expected_tier, expected_picks, expected_roll)
    const GAMBIT_VECTORS: &[(u32, u32, u8, [u8; 3], i32)] = &[
        (1,    0, 1, [36, 0, 18], 44),     // seed=1   gach#1 RARE
        (1,    1, 0, [6, 7, 50],  11),     // seed=1   gach#2 COMMON
        (1,    4, 0, [33, 16, 9], 10),     // seed=1   gach#5 COMMON
        (798,  3, 2, [1, 45, 44], 87),     // seed=798 gach#4 EPIC
        (8308, 4, 3, [12, 14, 5], 96),     // seed=8308 gach#5 LEGENDARY (LuckyCoin)
    ];

    #[test]
    fn matches_python_gambit_reference() {
        for &(seed, idx, exp_tier, exp_picks, exp_roll) in GAMBIT_VECTORS {
            let (tier, picks, rr) = predict_native(seed, idx);
            assert_eq!(tier, exp_tier, "tier seed={} idx={}", seed, idx);
            assert_eq!(picks, exp_picks, "picks seed={} idx={}", seed, idx);
            assert_eq!(rr, exp_roll, "roll seed={} idx={}", seed, idx);
        }
    }

    #[test]
    fn gachapon_name_hashes_are_distinct() {
        let mut all = [
            NAME_GACHAPON_RARITY,
            NAME_GACHAPON_COMMON,
            NAME_GACHAPON_RARE,
            NAME_GACHAPON_EPIC,
            NAME_GACHAPON_LEGENDARY,
        ];
        all.sort();
        for w in all.windows(2) { assert_ne!(w[0], w[1]); }
    }

    fn pack_target(rarity: u8, pool_idx: u8) -> u32 {
        ((pool_idx as u32) << 8) | (rarity as u32 & 0x3)
    }

    #[test]
    fn excludes_reduce_pool_size() {
        // Lock 5 legendaries — the remaining pool should be 15 and never
        // contain those poolIndices, regardless of seed.
        let excluded = [
            pack_target(3, 0),  // legendary poolIdx 0 (Apocalypse)
            pack_target(3, 4),  // poolIdx 4 (Emperor)
            pack_target(3, 14), // poolIdx 14 (LuckyCoin)
            pack_target(3, 17), // poolIdx 17 (Skydiver)
            pack_target(3, 19), // poolIdx 19 (WhiteCrown)
        ];
        let pools = build_filtered_pools(&excluded);
        assert_eq!(pools.len[3], 15);
        let blocked = [0u8, 4, 14, 17, 19];
        for i in 0..15 {
            assert!(!blocked.contains(&pools.idx[3][i as usize]));
        }
        // Common pool untouched.
        assert_eq!(pools.len[0], 68);
    }

    #[test]
    fn excludes_shift_picks() {
        // Seed 8308 gach#5 with full pool gives [12,14,5] -> LuckyCoin in slot.
        // Excluding LuckyCoin's poolIdx (14) must give a different set, and
        // 14 must not appear in any slot.
        let excluded = [pack_target(3, 14)];
        let pools = build_filtered_pools(&excluded);
        let seed: u32 = 8308;
        let mut per_rarity_counter = [0u32; 4];
        for g in 0..4u32 {
            let r = occurrence_int(seed, NAME_GACHAPON_RARITY, (g + 1) as i32, g, 0, 101);
            per_rarity_counter[rarity_tier(r) as usize] += 3;
        }
        let wave = 5i32;
        let picks = simulate_gambit_picks(seed, wave, per_rarity_counter[3], 3, &pools);
        assert!(!picks.contains(&14u8), "LuckyCoin (14) leaked into picks: {picks:?}");
    }

    // Vectors generated from gambonanza_rng.py — see seedfinder/.
    // (seed, hash[0..3], starter_rolls[0..3], pieces[0..3], gach[1..5])
    const VECTORS: &[(u32, [u32; 3], [i32; 3], [&str; 3], [i32; 5])] = &[
        (1, [735603344, 404471571, 742229161], [14, 16, 61], ["PAWN", "PAWN", "KING"], [44, 11, 47, 4, 10]),
        (2, [281688179, 1176328496, 1408872294], [72, 39, 42], ["KNIGHT", "PAWN", "PAWN"], [64, 90, 49, 51, 22]),
        (3, [3853788058, 23297565, 811725159], [71, 93, 6], ["KNIGHT", "ROOK", "PAWN"], [37, 76, 31, 73, 48]),
        (42, [1892609611, 3929854472, 1255821246], [71, 73, 50], ["KNIGHT", "KNIGHT", "PAWN"], [37, 97, 23, 9, 0]),
        (798, [915154207, 1100536476, 3901437778], [97, 98, 95], ["QUEEN", "QUEEN", "QUEEN"], [53, 57, 42, 87, 59]),
        (1234, [1866672291, 2322025728, 359946646], [92, 61, 97], ["ROOK", "KING", "QUEEN"], [60, 85, 43, 24, 40]),
        (8308, [2178821269, 1296024562, 1372272444], [79, 86, 86], ["KNIGHT", "BISHOP", "BISHOP"], [47, 18, 39, 59, 96]),
        (9865, [3338823304, 2657068491, 873701857], [72, 75, 91], ["KNIGHT", "KNIGHT", "ROOK"], [14, 7, 5, 79, 72]),
        (12785269, [2745436388, 2323249799, 1753956797], [96, 98, 99], ["QUEEN", "QUEEN", "QUEEN"], [94, 98, 95, 97, 8]),
        (3735928559, [1462957814, 2037927545, 654162755], [29, 75, 62], ["PAWN", "KNIGHT", "KING"], [99, 76, 18, 0, 93]),
    ];

    #[test]
    fn matches_python_reference() {
        for &(seed, expect_hash, expect_rolls, expect_pieces, expect_gach) in VECTORS {
            for c in 0..3u32 {
                let h = occurrence_seed(seed, NAME_GIVE_PIECE_AT_START, 0, c);
                assert_eq!(h, expect_hash[c as usize], "hash seed={} counter={}", seed, c);
            }

            let mut offset = 0u8;
            for c in 0..3u32 {
                let lo = if offset >= 2 { 60 } else { 0 };
                let roll = occurrence_int(seed, NAME_GIVE_PIECE_AT_START, 0, c, lo, 100);
                if classify_piece(roll) == PIECE_PAWN { offset += 1; }
                assert_eq!(roll, expect_rolls[c as usize], "roll seed={} counter={}", seed, c);
            }

            let pieces = pieces_to_names(simulate_starters(seed));
            assert_eq!(pieces, expect_pieces, "pieces seed={}", seed);

            let waves: [(i32, u32); 5] = [(1, 0), (2, 1), (3, 2), (4, 3), (5, 4)];
            for (i, &(w, c)) in waves.iter().enumerate() {
                let r = gachapon_roll(seed, w, c);
                assert_eq!(r, expect_gach[i], "gach seed={} wave={} counter={}", seed, w, c);
            }
        }
    }
}
