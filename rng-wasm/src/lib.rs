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
const NAME_SHOP_TOKEN: u32 = stable_string_hash_bytes(b"SHOP_TOKEN");
const NAME_SHOP_TOKEN_SECOND_PASS: u32 = stable_string_hash_bytes(b"SHOP_TOKEN_SECOND_PASS");
const NAME_SHOP_TOKEN_ALTERNATIVES: u32 = stable_string_hash_bytes(b"SHOP_TOKEN_ALTERNATIVES");
const NAME_SHOP_TOKEN_NEW_TILE_ALTERNATIVE: u32 =
    stable_string_hash_bytes(b"SHOP_TOKEN_NEW_TILE_ALTERNATIVE");

const GACHAPON_NAMES: [u32; 4] = [
    NAME_GACHAPON_COMMON,
    NAME_GACHAPON_RARE,
    NAME_GACHAPON_EPIC,
    NAME_GACHAPON_LEGENDARY,
];

// Size of each Gambits_<R> pool, i.e. how many entries `GambitLibrary.Initialize`
// drops into each rarity bucket while walking `GambitsInfo` in order.
// These MUST stay in sync with `public/game/gambits.json`, which is the same
// data extracted from the game build (the TS side derives its pools from that
// file, so a mismatch here silently desynchronises predictions from the UI).
// The `gambit_pool_sizes_match_extracted_data` test pins them.
const POOL_SIZE_COMMON: u8 = 66;
const POOL_SIZE_RARE: u8 = 63;
const POOL_SIZE_EPIC: u8 = 51;
const POOL_SIZE_LEGENDARY: u8 = 20;
const POOL_SIZES: [u8; 4] = [
    POOL_SIZE_COMMON,
    POOL_SIZE_RARE,
    POOL_SIZE_EPIC,
    POOL_SIZE_LEGENDARY,
];

/// Widest rarity pool - sizes the fixed-capacity `FilteredPools::idx` rows.
/// Computed as a real max rather than aliasing one tier, so re-balancing the
/// pools can never silently overflow those arrays.
const MAX_POOL_SIZE: usize = max_pool_size();

const fn max_pool_size() -> usize {
    let mut max = 0usize;
    let mut i = 0;
    while i < POOL_SIZES.len() {
        if (POOL_SIZES[i] as usize) > max {
            max = POOL_SIZES[i] as usize;
        }
        i += 1;
    }
    max
}

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
/// account-locked gambits stripped) - within that, each pick removes by
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

/* -------------------------- Shop tokens ---------------------------------
 *
 * Each shop offers `m_TokenAvailableToBuy = 3` token slots (the C# field
 * default `= 2` is stale dev-time data; the serialized scene value is 3).
 * We ignore the +1 fourth slot from the `TokenGambit` gambit - bare
 * fresh-run assumption.
 *
 * Two subtleties worth flagging - both bugs in our first port that the
 * decompiled code does *not* match the obvious reading of:
 *
 *  1. The saved & spawned tokens come from the FIRST pass (`array3`),
 *     not the second pass. The second pass overwrites `array`/`array2`
 *     locally, but `DataManager.Data.Tokens = array3` at the end and
 *     `SpawnToken` instantiates `m_TokenToBuy[array3[i]]`. So second
 *     pass + alternatives are essentially counter-advancing dead code
 *     w.r.t. the visible result - we still simulate them to keep the
 *     downstream counters in sync, but only the first pass populates
 *     `types`.
 *
 *  2. `GetRandomOccurrence` reads `DataManager.Data.CurrentWave` (the
 *     saved field), not the live `ChessDataManager.m_CurrentWave`.
 *     `HandleShopSave` syncs the saved field from the live one - but
 *     it runs *after* `ComputeToken` in `ShopCanvas.OnEnable`. So shop
 *     N's `ComputeToken` reads the previous shop's saved wave value,
 *     i.e. `wave = N − 1` for the hash. The gachapon hash (which fires
 *     much later, when the player clicks a GAMBIT token) reads the
 *     post-sync value, i.e. `wave = N`.
 *
 * `ShopCanvas.ComputeToken` (post-tutorial branch):
 *   for slot in 0..2:                                    // first pass: discarded
 *       GetRandomOccurrence("SHOP_TOKEN", 0, 6)
 *   for slot in 0..2:                                    // second pass: actual
 *       array[slot] = m_TokenToBuy[ GetRandomOccurrence("SHOP_TOKEN_SECOND_PASS", 0, 6) ]
 *   if both slots are the same TokenType:
 *       slot_to_replace = GetRandomOccurrence("SHOP_TOKEN_ALTERNATIVES", 0, 2)
 *       filtered = m_TokenToBuy.where(t.TokenType != currentType && t != NONE)
 *       array[slot_to_replace] = filtered[ GetRandomOccurrence("SHOP_TOKEN_NEW_TILE_ALTERNATIVE", 0, filtered.len) ]
 *
 * The `m_TokenToBuy` array (length 6) was extracted from the ShopCanvas
 * MonoBehaviour body - see extract_gambits.py / docs. Tutorial branch's
 * hard-coded `[0, 3, 5]` indices serve as a sanity check that index 0
 * is GAMBIT, 3 is CHESS_PIECE, 5 is TILE.
 */
const TOKEN_GAMBIT: u8 = 0;
const TOKEN_CHESS_PIECE: u8 = 1;
const TOKEN_TILE: u8 = 2;

/// `m_TokenToBuy[i].TokenType` for i in 0..6, in PPtr order from the
/// ShopCanvas scene component.
const TOKEN_PREFAB_TYPES: [u8; 6] = [
    TOKEN_GAMBIT,       // 0
    TOKEN_CHESS_PIECE,  // 1
    TOKEN_CHESS_PIECE,  // 2
    TOKEN_CHESS_PIECE,  // 3
    TOKEN_TILE,         // 4
    TOKEN_TILE,         // 5
];
const TOKEN_PREFAB_COUNT: i32 = 6;
const SHOP_TOKEN_SLOTS: u32 = 3;

/// Pre-built filtered prefab lists for the "alternatives" pass. When
/// both slots roll the same TokenType, we pick from the prefabs whose
/// TokenType differs (and isn't NONE). Indexed by the "current" type.
/// Each row holds (len, indices[..len]).
struct AltsTable {
    len: [u8; 3],
    idx: [[u8; 6]; 3],
}

const fn build_alts() -> AltsTable {
    let mut tbl = AltsTable {
        len: [0; 3],
        idx: [[0; 6]; 3],
    };
    let mut cur = 0u8;
    while cur < 3 {
        let mut n = 0u8;
        let mut i = 0u8;
        while (i as usize) < TOKEN_PREFAB_TYPES.len() {
            if TOKEN_PREFAB_TYPES[i as usize] != cur {
                tbl.idx[cur as usize][n as usize] = i;
                n += 1;
            }
            i += 1;
        }
        tbl.len[cur as usize] = n;
        cur += 1;
    }
    tbl
}
const ALTS: AltsTable = build_alts();

/// Outcome of simulating one shop's `ComputeToken`. `types` holds the
/// resolved TokenType for each of the 2 slots; `alts_consumed` is true
/// when the all-same-type fallback fired (so callers can advance the
/// shared alternatives counters).
#[derive(Clone, Copy)]
struct ShopTokens {
    types: [u8; SHOP_TOKEN_SLOTS as usize],
    alts_consumed: bool,
}

impl ShopTokens {
    #[inline(always)]
    fn has_gambit(&self) -> bool {
        self.types.iter().any(|&t| t == TOKEN_GAMBIT)
    }
    /// Number of GAMBIT slots in this shop (0..=2 with 3 slots after the
    /// alternatives swap). Caps the player's max spins at this wave.
    #[inline(always)]
    fn gambit_count(&self) -> u32 {
        self.types.iter().filter(|&&t| t == TOKEN_GAMBIT).count() as u32
    }
}

/// Running counter set, shared across all shops in a single run.
#[derive(Clone, Copy, Default)]
struct ShopCounters {
    /// Incremented per slot of every shop, twice each.
    first_pass: u32,
    second_pass: u32,
    /// Only advanced on shops where all-same-type triggers.
    alts_slot: u32,
    alts_replacement: u32,
}

/// Simulate one shop's `ComputeToken` post-tutorial path. Returns the
/// 3 TokenType outcomes the player will actually see. `shop_index` is
/// 1-indexed (shop 1 = first shop after the first WIN); internally we
/// hash with `wave = shop_index − 1` because `ComputeToken` runs before
/// `HandleShopSave` syncs the saved CurrentWave.
///
/// `counters` is updated in place so the caller can chain shops
/// sequentially - the alternatives counters in particular advance
/// conditionally on the second-pass result of each shop.
#[inline(always)]
fn simulate_shop_tokens(
    seed: u32,
    shop_index: i32,
    counters: &mut ShopCounters,
) -> ShopTokens {
    let rng_wave = shop_index - 1;

    // First pass: results SAVED to Data.Tokens (array3) - these are the
    // tokens the player actually sees in the shop.
    let mut types = [0u8; SHOP_TOKEN_SLOTS as usize];
    for slot in 0..SHOP_TOKEN_SLOTS as usize {
        let pick = occurrence_int(
            seed, NAME_SHOP_TOKEN, rng_wave, counters.first_pass, 0, TOKEN_PREFAB_COUNT,
        ) as u8;
        counters.first_pass += 1;
        types[slot] = TOKEN_PREFAB_TYPES[pick as usize];
    }

    // Second pass: results overwrite `array`/`array2` in the C# code
    // but NOT `array3`, so they don't change the spawned tokens. We
    // still need them because the alternatives check below is gated on
    // the second-pass result being all-same-type.
    let mut second_pass_types = [0u8; SHOP_TOKEN_SLOTS as usize];
    for slot in 0..SHOP_TOKEN_SLOTS as usize {
        let pick = occurrence_int(
            seed,
            NAME_SHOP_TOKEN_SECOND_PASS,
            rng_wave,
            counters.second_pass,
            0,
            TOKEN_PREFAB_COUNT,
        ) as u8;
        counters.second_pass += 1;
        second_pass_types[slot] = TOKEN_PREFAB_TYPES[pick as usize];
    }

    // Alternatives - also doesn't touch the visible tokens, but
    // advances `alts_slot` + `alts_replacement` counters conditionally.
    let mut alts_consumed = false;
    let all_same = (1..SHOP_TOKEN_SLOTS as usize)
        .all(|i| second_pass_types[i] == second_pass_types[0]);
    if all_same {
        let current = second_pass_types[0];
        let alt_len = ALTS.len[current as usize] as i32;
        if alt_len > 0 {
            let _ = occurrence_int(
                seed,
                NAME_SHOP_TOKEN_ALTERNATIVES,
                rng_wave,
                counters.alts_slot,
                0,
                SHOP_TOKEN_SLOTS as i32,
            );
            counters.alts_slot += 1;
            let _ = occurrence_int(
                seed,
                NAME_SHOP_TOKEN_NEW_TILE_ALTERNATIVE,
                rng_wave,
                counters.alts_replacement,
                0,
                alt_len,
            );
            counters.alts_replacement += 1;
            alts_consumed = true;
        }
    }

    ShopTokens { types, alts_consumed }
}

// Filter wire format (u32 words):
//   word 0: bits[0..3]=slot0_piece, [3]=slot0_any,
//           [4..7]=slot1_piece, [7]=slot1_any,
//           [8..11]=slot2_piece, [11]=slot2_any,
//           bit[12]=unordered, bit[13]=has_gambit_filter,
//           bit[14]=has_exclusions, bit[15]=gambit_match_all,
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

    // First pass: rarity + roll checks (cheap, every gachapon row).
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

    // Second pass: reachability. With 3 token slots per shop and the
    // all-same-type alternatives swap, a shop offers 0..=2 GAMBIT
    // tokens (3-of-a-kind always gets one swapped). So a filter row
    // `(wave W, counter C)` is reachable iff:
    //   - wave W's shop offers ≥ 1 GAMBIT (a spin can happen there), AND
    //   - the sum of GAMBIT slots in waves 1..W-1 is ≥ C (the player
    //     could have accumulated `counter = C` before arriving at W).
    //
    // We walk shops 1..max_wave once and build a `prior_gambits[wave]`
    // prefix-sum (counting slots, not just shops) so per-row checks are O(1).
    let mut max_wave: i32 = 0;
    for i in 0..num {
        let w = filters[base + i * 2] as i32;
        if w > max_wave { max_wave = w; }
    }
    if max_wave <= 0 { return true; }
    let mut has_gambit = [false; 65];
    let mut prior_gambits = [0u32; 65]; // prefix sum of GAMBIT *slot* counts
    let cap = has_gambit.len() as i32 - 1;
    let mut counters = ShopCounters::default();
    let mut w = 1i32;
    while w <= max_wave && w <= cap {
        let tokens = simulate_shop_tokens(seed, w, &mut counters);
        has_gambit[w as usize] = tokens.has_gambit();
        prior_gambits[w as usize] =
            prior_gambits[(w - 1) as usize] + tokens.gambit_count();
        w += 1;
    }
    for i in 0..num {
        let wave = filters[base + i * 2] as i32;
        let packed = filters[base + i * 2 + 1];
        let counter = packed & 0xFF;
        if wave <= 0 || wave > cap { return false; }
        if !has_gambit[wave as usize] { return false; }
        if prior_gambits[(wave - 1) as usize] < counter { return false; }
    }
    true
}

/// True if any of the target (rarity, poolIndex) pairs appears in one of
/// the first `max_gach` gachapons the player can ACTUALLY spin. We
/// walk the "spin every GAMBIT slot in order" trajectory - i.e., the
/// player's k-th spin happens at the wave of the k-th GAMBIT slot in
/// chronological order. A wave with 0 GAMBIT slots contributes no
/// spins; a wave with 2 GAMBIT slots (max after the alternatives swap)
/// contributes two consecutive counters at the same wave.
///
/// Replaces the old diagonal-walk (`wave = counter+1`) which falsely
/// matched seeds whose diagonal cells happened to contain the target
/// but were unreachable due to missing GAMBIT tokens.
///
/// We probe up to ~16 shops; that's more than enough to find ~32
/// spins which is the user's max filter target.
const TRAJECTORY_MAX_SHOPS: i32 = 32;
const MAX_GAMBIT_TARGETS: usize = 256;
const UNMATCHED_TARGET: usize = usize::MAX;

#[inline(always)]
fn add_unique_target(
    target_words: &mut [u32; MAX_GAMBIT_TARGETS],
    target_count: &mut usize,
    target: u32,
) -> bool {
    for i in 0..*target_count {
        if target_words[i] == target { return true; }
    }
    if *target_count >= MAX_GAMBIT_TARGETS { return false; }
    target_words[*target_count] = target;
    *target_count += 1;
    true
}

#[inline(always)]
fn find_target_index(
    target_words: &[u32; MAX_GAMBIT_TARGETS],
    target_count: usize,
    target: u32,
) -> Option<usize> {
    for i in 0..target_count {
        if target_words[i] == target { return Some(i); }
    }
    None
}

fn augment_combo_target(
    target_idx: usize,
    adjacency: &[u32; MAX_GAMBIT_TARGETS],
    spin_match: &mut [usize; 32],
    seen_spins: &mut u32,
) -> bool {
    let mut spins = adjacency[target_idx];
    while spins != 0 {
        let bit = spins & spins.wrapping_neg();
        let spin = bit.trailing_zeros() as usize;
        spins &= spins - 1;
        if (*seen_spins & bit) != 0 { continue; }
        *seen_spins |= bit;
        let current = spin_match[spin];
        if current == UNMATCHED_TARGET
            || augment_combo_target(current, adjacency, spin_match, seen_spins)
        {
            spin_match[spin] = target_idx;
            return true;
        }
    }
    false
}

fn combo_match_count(target_count: usize, adjacency: &[u32; MAX_GAMBIT_TARGETS]) -> usize {
    let mut spin_match = [UNMATCHED_TARGET; 32];
    let mut count = 0usize;
    for target_idx in 0..target_count {
        let mut seen_spins = 0u32;
        if augment_combo_target(target_idx, adjacency, &mut spin_match, &mut seen_spins) {
            count += 1;
        }
    }
    count
}

#[inline(always)]
fn matches_gambit_filter(
    seed: u32,
    max_gach: u32,
    targets: &[u32],
    pools: &FilteredPools,
    match_all: bool,
) -> bool {
    let mut want_mask: u8 = 0;
    let mut target_words = [0u32; MAX_GAMBIT_TARGETS];
    let mut target_count = 0usize;
    for &t in targets {
        let rarity = t & 0x3;
        let pool_idx = (t >> 8) & 0xFF;
        let target = (pool_idx << 8) | rarity;
        want_mask |= 1u8 << rarity;
        if !add_unique_target(&mut target_words, &mut target_count, target) {
            return false;
        }
    }
    if want_mask == 0 || max_gach == 0 { return false; }
    if match_all && target_count > max_gach as usize { return false; }

    let mut adjacency = [0u32; MAX_GAMBIT_TARGETS];
    let mut shop_counters = ShopCounters::default();
    let mut per_rarity_counter = [0u32; 4];
    let mut spins_done: u32 = 0;

    let mut wave = 1i32;
    while wave <= TRAJECTORY_MAX_SHOPS && spins_done < max_gach {
        let tokens = simulate_shop_tokens(seed, wave, &mut shop_counters);
        for _ in 0..tokens.gambit_count() {
            if spins_done >= max_gach { break; }
            let rarity_roll = occurrence_int(
                seed, NAME_GACHAPON_RARITY, wave, spins_done, 0, 101,
            );
            let tier = rarity_tier(rarity_roll);
            if (want_mask >> tier) & 1 == 1 {
                let tier_idx = tier as usize;
                let picks = simulate_gambit_picks(
                    seed,
                    wave,
                    per_rarity_counter[tier_idx],
                    tier,
                    pools,
                );
                let spin_bit = 1u32 << spins_done;
                let mut touched = false;
                for &pick in &picks {
                    if pick == u8::MAX { continue; }
                    let target = ((pick as u32) << 8) | tier as u32;
                    let Some(target_idx) = find_target_index(
                        &target_words,
                        target_count,
                        target,
                    ) else { continue; };
                    if !match_all { return true; }
                    adjacency[target_idx] |= spin_bit;
                    touched = true;
                }
                if match_all && touched && combo_match_count(target_count, &adjacency) == target_count {
                    return true;
                }
            }
            per_rarity_counter[tier as usize] += 3;
            spins_done += 1;
        }
        wave += 1;
    }
    false
}

/// Inner search loop, shared by `search_range` and `search_paginated`.
/// Iterates seeds in [seed_start, seed_end), writes matches to `out_buf`
/// up to the per-call `match_cap`, and returns `(matches_written,
/// next_seed_to_scan)` - the second value is the resume cursor for the
/// paginated entry point.
///
/// `seed_end == 0` is a sentinel meaning "no upper bound" - keep
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
    let gambit_match_all = (f0 >> 15) & 1 != 0;
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
                    || matches_gambit_filter(
                        seed,
                        gambit_max,
                        gambit_targets,
                        &pools,
                        gambit_match_all,
                    );
                if pass_gambit {
                    out_buf[written as usize] = seed;
                    written += 1;
                }
            }
        }
        seed = seed.wrapping_add(1);
        if seed == 0 && seed_start != 0 {
            // u32 wraparound - we've finished the entire seed space.
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

/// Paginated scan - stops once either `out_buf` fills OR `match_cap`
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

/// Per-seed inspector for an arbitrary `(wave, counter)` cell - using
/// the actual "spin every GAMBIT slot in order" trajectory for prior
/// spins (so the per-rarity counter accumulation matches what the
/// search kernel uses). This keeps cell-hover picks consistent with
/// the filter's actual hit detection.
///
/// `excluded` is the same packed-word list the search kernel consumes;
/// pass an empty slice for the full "all unlocked" pool.
///
/// Output: `[rarity, pick0, pick1, pick2, rarityRoll]`. `rarity` is
/// 0..3, picks are 0..pool_size-1 or 255 if the pool ran out.
#[wasm_bindgen(js_name = predictGachaponAt)]
pub fn predict_gachapon_at_js(
    seed: u32,
    wave: u32,
    counter: u32,
    excluded: &[u32],
) -> Vec<i32> {
    let pools = if excluded.is_empty() {
        FULL_POOLS
    } else {
        build_filtered_pools(excluded)
    };

    // Walk the trajectory for `counter` prior spins, accumulating
    // per-rarity counter at each step.
    let mut shop_counters = ShopCounters::default();
    let mut per_rarity_counter = [0u32; 4];
    let mut spins_done: u32 = 0;
    let mut w = 1i32;
    while w <= TRAJECTORY_MAX_SHOPS && spins_done < counter {
        let tokens = simulate_shop_tokens(seed, w, &mut shop_counters);
        for _ in 0..tokens.gambit_count() {
            if spins_done >= counter { break; }
            let r = occurrence_int(seed, NAME_GACHAPON_RARITY, w, spins_done, 0, 101);
            per_rarity_counter[rarity_tier(r) as usize] += 3;
            spins_done += 1;
        }
        w += 1;
    }

    let target_wave = wave as i32;
    let rarity_roll = occurrence_int(seed, NAME_GACHAPON_RARITY, target_wave, counter, 0, 101);
    let tier = rarity_tier(rarity_roll);
    let picks = simulate_gambit_picks(
        seed,
        target_wave,
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

/// Per-seed inspector: returns the 3 gambit pool indices for the gachapon
/// at index `gach_idx` (0-based), under the same simplified wave model
/// used by `matches_gambit_filter`. `excluded` is the same packed-word
/// list the search kernel consumes - pass an empty slice for the full
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

/// Per-seed shop-token inspector. Returns the token TokenTypes for
/// every shop from wave 1 up to and including `max_wave`. Output layout:
/// `[wave1_slot0, wave1_slot1, wave2_slot0, wave2_slot1, …]` - values
/// are `0 = GAMBIT`, `1 = CHESS_PIECE`, `2 = TILE`.
#[wasm_bindgen(js_name = inspectShopTokens)]
pub fn inspect_shop_tokens_js(seed: u32, max_wave: u32) -> Vec<i32> {
    let mut out = Vec::with_capacity((max_wave as usize) * 2);
    let mut counters = ShopCounters::default();
    for w in 1..=max_wave {
        let tokens = simulate_shop_tokens(seed, w as i32, &mut counters);
        for slot in 0..SHOP_TOKEN_SLOTS as usize {
            out.push(tokens.types[slot] as i32);
        }
    }
    out
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
    // pool - exclusion behaviour is covered by `excludes_reduce_pool_size`.
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

    // Vectors cross-checked against an independent Python port of the game's
    // own RNG (SeedUtils.Hash + LehmerRandom.Range + GambitLibrary.SelectGambits,
    // transcribed from the decompiled C#).
    //
    // The rarity roll and tier depend only on the seed, so they are identical
    // to the previous revision of this table. The pick indices are drawn with
    // `hi = remaining pool size`, so they moved when POOL_SIZE_COMMON 68->66,
    // POOL_SIZE_RARE 64->63 and POOL_SIZE_EPIC 48->51 were corrected against
    // the shipped build. LEGENDARY was unchanged (20), hence the 8308 vector is
    // untouched; the seed=1 RARE draw happens to land on the same three indices
    // either way.
    //   (seed, gach_idx, expected_tier, expected_picks, expected_roll)
    const GAMBIT_VECTORS: &[(u32, u32, u8, [u8; 3], i32)] = &[
        (1,    0, 1, [35, 0, 17], 44),     // seed=1   gach#1 RARE
        (1,    1, 0, [6, 5, 48],  11),     // seed=1   gach#2 COMMON
        (1,    4, 0, [32, 16, 9], 10),     // seed=1   gach#5 COMMON
        (798,  3, 2, [1, 49, 48], 87),     // seed=798 gach#4 EPIC
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
    fn gambit_filter_can_require_all_targets() {
        // ALL mode means "can pick every selected gambit", so targets
        // must be satisfiable across distinct gachapons. Seed 26's fifth
        // reachable spin offers legendary poolIdx [12, 14, 5], but only
        // one can be picked there, so [12, 14] is not a valid combo.
        assert!(!matches_gambit_filter(
            26,
            5,
            &[pack_target(3, 12), pack_target(3, 14)],
            &FULL_POOLS,
            true,
        ));
        assert!(matches_gambit_filter(
            26,
            5,
            &[pack_target(3, 12), pack_target(3, 14)],
            &FULL_POOLS,
            false,
        ));

        // Seed 1 has reachable spin #1 with rare poolIdx 35 (Pendant) and
        // spin #2 with common poolIdx 38 (OldIdol), so these can both be
        // picked. OldIdol was common poolIdx 39 before Gambit_Shield - an
        // earlier COMMON - was dropped from the build; same gambit, shifted
        // index.
        assert!(matches_gambit_filter(
            1,
            2,
            &[pack_target(1, 35), pack_target(0, 38)],
            &FULL_POOLS,
            true,
        ));
    }

    #[test]
    fn excludes_reduce_pool_size() {
        // Lock 5 legendaries - the remaining pool should be 15 and never
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
        // Other pools keep their current game sizes.
        assert_eq!(pools.len[0], 66);
        assert_eq!(pools.len[1], 63);
        assert_eq!(pools.len[2], 51);
    }

    /// Pins the pool sizes to the data extracted from the game build and keeps
    /// `MAX_POOL_SIZE` an honest maximum. If a rebalance ever makes a non-COMMON
    /// tier the largest, this fails instead of overflowing `FilteredPools::idx`.
    #[test]
    fn gambit_pool_sizes_match_extracted_data() {
        // GambitLibrary.GambitsInfo (level0) has 200 entries; Initialize walks
        // it in order and buckets by SO_Gambit.Rarity.
        assert_eq!(POOL_SIZES, [66, 63, 51, 20]);
        assert_eq!(POOL_SIZES.iter().map(|&n| n as u32).sum::<u32>(), 200);

        let true_max = POOL_SIZES.iter().copied().max().unwrap() as usize;
        assert_eq!(MAX_POOL_SIZE, true_max);
        for &n in POOL_SIZES.iter() {
            assert!(n as usize <= MAX_POOL_SIZE);
        }
    }

    fn simulate_shop_sequence(seed: u32, up_to_wave: i32) -> Vec<[u8; 3]> {
        let mut counters = ShopCounters::default();
        let mut out = Vec::new();
        for w in 1..=up_to_wave {
            let r = simulate_shop_tokens(seed, w, &mut counters);
            out.push(r.types);
        }
        out
    }

    // Vectors generated from predict_shop_tokens.py with the corrected
    // model (first-pass = visible, wave = shop − 1). Each entry =
    // (seed, shop_index, [slot0, slot1, slot2]).
    // TokenType: 0=GAMBIT, 1=CHESS_PIECE, 2=TILE.
    const TOKEN_VECTORS: &[(u32, i32, [u8; 3])] = &[
        // seed 2107291 shop 1 = [TILE,TILE,TILE] - the user-reported
        // in-game observation that exposed the off-by-one fix.
        (2107291, 1, [2, 2, 2]),
        (2107291, 3, [1, 0, 1]),  // CHESS/GAMBIT/CHESS
        (798,     1, [0, 1, 0]),  // GAMBIT/CHESS/GAMBIT - 2 gambits
        (798,     7, [0, 1, 1]),  // GAMBIT/CHESS/CHESS
        (8308,    1, [0, 2, 2]),  // GAMBIT/TILE/TILE
        (8308,    2, [1, 2, 0]),  // CHESS/TILE/GAMBIT
    ];

    #[test]
    fn matches_python_shop_token_reference() {
        for &(seed, shop, expected) in TOKEN_VECTORS {
            let seq = simulate_shop_sequence(seed, shop);
            let got = seq[shop as usize - 1];
            assert_eq!(got, expected, "seed={} shop={}", seed, shop);
        }
    }

    #[test]
    fn shop_can_offer_multiple_gambits() {
        // seed=798 shop 1 = [GAMBIT, CHESS_PIECE, GAMBIT] = 2 GAMBITs.
        let seq = simulate_shop_sequence(798, 1);
        let shop = seq[0];
        let count = shop.iter().filter(|&&t| t == TOKEN_GAMBIT).count();
        assert_eq!(count, 2, "expected 2 GAMBITs in seed=798 shop=1: {shop:?}");
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

    // Vectors generated from gambonanza_rng.py - see seedfinder/.
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
