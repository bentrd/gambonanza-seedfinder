use wasm_bindgen::prelude::*;

const FNV_OFFSET: u32 = 2166136261;
const FNV_PRIME: u32 = 16777619;
const LEHMER_MULT: u32 = 279470273;
const LEHMER_MOD: u32 = 4294967291;
const KNUTH_MIX: u32 = 2654435761;

const NAME_GIVE_PIECE_AT_START: u32 = stable_string_hash_bytes(b"GIVE_PIECE_AT_START");
const NAME_GACHAPON_RARITY: u32 = stable_string_hash_bytes(b"GACHAPON_RARITY");

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

// Filter wire format (u32 words):
//   word 0: bits[0..3]=slot0_piece, [3]=slot0_any,
//           [4..7]=slot1_piece, [7]=slot1_any,
//           [8..11]=slot2_piece, [11]=slot2_any,
//           bit[12]=unordered, bits[16..24]=num_gachapons (max 32)
//   per gachapon (2 words):
//     word: wave (i32 packed as u32)
//     word: bits[0..7]=counter, [8..10]=tier_min (0..3), [10..12]=tier_max,
//           [16..24]=roll_min (0..100), [24..32]=roll_max (0..100)

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

#[wasm_bindgen]
pub fn search_range(
    seed_start: u32,
    seed_end: u32,
    filters: &[u32],
    out_buf: &mut [u32],
) -> u32 {
    if filters.is_empty() { return 0; }
    let f0 = filters[0];
    let unordered = (f0 >> 12) & 1 != 0;
    let num_gach = ((f0 >> 16) & 0xFF) as usize;
    let cap = out_buf.len();
    let mut written = 0usize;
    let mut seed = seed_start;
    while seed < seed_end && written < cap {
        let starters = simulate_starters(seed);
        if matches_starters(starters, f0, unordered) {
            if num_gach == 0 || matches_gachapons(seed, filters, num_gach) {
                out_buf[written] = seed;
                written += 1;
            }
        }
        seed = seed.wrapping_add(1);
        if seed == 0 && seed_start != 0 { break; } // u32 wraparound guard
    }
    written as u32
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
