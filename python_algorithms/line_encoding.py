"""
================================================================================
 LINE ENCODING ALGORITHMS
================================================================================

This module implements the digital-to-digital line (signal) encoding schemes
used by the "Line Encoding Lab" in the web simulator.

Every function below takes a string of '0'/'1' characters (a bitstream) and
returns a list of *signal levels* — the voltage/light level that would be put
on the wire during each time slice. Most schemes use ONE level per bit; a few
(RZ, Manchester, Differential Manchester) split each bit into TWO half-bit
time slices because the signal needs to change *within* the bit interval.

Why bother with all of this instead of just sending 0s and 1s as-is?

  * A long run of identical bits (e.g. 00000000) produces a flat, unchanging
    voltage. The receiver's clock recovery circuit needs *transitions* to
    stay synchronized with the sender's clock — a flat line gives it nothing
    to lock onto. This is called "self-clocking" or lack thereof.
  * A constant average voltage (DC component) cannot pass through certain
    transformers/couplers used in real transmission lines.

Each encoding scheme below solves these problems differently, at different
cost (bandwidth, complexity).

No third-party signal-processing library is used — every waveform is built
bit-by-bit so the actual encoding logic is visible and inspectable.
================================================================================
"""

from typing import List, Dict


def _validate_bits(bits: str) -> str:
    """Strip anything that isn't '0' or '1' and make sure something is left."""
    cleaned = ''.join(ch for ch in bits if ch in '01')
    if not cleaned:
        raise ValueError("Input must contain at least one binary digit (0 or 1).")
    return cleaned


# ============================================================
# UNIPOLAR NRZ
# ============================================================
#
# The simplest possible scheme: 1 -> positive voltage, 0 -> zero voltage.
# Only ONE polarity is ever used (hence "unipolar"), which means a long
# run of 1s pushes a strong DC component onto the line — bad for real
# copper links, but useful as a teaching baseline.
# ============================================================
def unipolar_nrz(bits: str) -> List[int]:
    bits = _validate_bits(bits)
    levels = []
    for bit in bits:
        # A '1' is sent as level +1, a '0' is sent as level 0 (no signal).
        levels.append(1 if bit == '1' else 0)
    return levels


# ============================================================
# NRZ-L (Non-Return-to-Zero, Level)
# ============================================================
#
# The voltage LEVEL itself carries the bit value:
#     1 -> +V (high)
#     0 -> -V (low)
# The line only changes state when the *bit value* changes, so a long run
# of the same bit (e.g. 1111) produces a flat line with no transitions —
# the receiver's clock can drift and lose sync.
# ============================================================
def nrz_l(bits: str) -> List[int]:
    bits = _validate_bits(bits)
    levels = []
    for bit in bits:
        # '1' is mapped straight to +1, '0' straight to -1.
        # Note this does NOT depend on the previous bit — it's a direct
        # mapping, which is what makes it "Level" encoding.
        levels.append(1 if bit == '1' else -1)
    return levels


# ============================================================
# NRZ-I (Non-Return-to-Zero, Invert on ones)
# ============================================================
#
# Instead of the level itself meaning something, a *transition* (a flip
# from the previous level) at the start of the bit interval means '1'.
# No transition means '0'. This is "differential" encoding — you must
# know the previous level to decode the current bit.
#
# Advantage over NRZ-L: a run of 1s still produces transitions (good for
# clock recovery). A run of 0s is still a problem, though.
# ============================================================
def nrz_i(bits: str) -> List[int]:
    bits = _validate_bits(bits)
    levels = []
    # We need a "current level" that persists across bits, starting low.
    current_level = -1
    for bit in bits:
        if bit == '1':
            # A '1' means: FLIP the level relative to what it was.
            current_level = -current_level
        # A '0' means: keep the level exactly as it was (no flip).
        levels.append(current_level)
    return levels


# ============================================================
# RZ (Return-to-Zero)
# ============================================================
#
# Every bit interval is split into two halves. The first half carries the
# bit's polarity (+V for 1, -V for 0); the signal always RETURNS TO ZERO
# in the second half, regardless of the bit value. Because the signal
# always dips back to zero, there is *always* a transition inside every
# bit interval, so the clock never loses sync.
#
# The cost: this needs twice the bandwidth of a one-level-per-bit scheme,
# since we're effectively sending two symbols per bit.
# ============================================================
def rz(bits: str) -> List[int]:
    bits = _validate_bits(bits)
    levels = []
    for bit in bits:
        polarity = 1 if bit == '1' else -1
        # First half-interval: the bit's polarity.
        levels.append(polarity)
        # Second half-interval: always back to zero.
        levels.append(0)
    return levels


# ============================================================
# MANCHESTER ENCODING
# ============================================================
#
# Used by classic 10BASE-T Ethernet. Manchester XORs the clock with NRZ-L
# data so that EVERY bit interval contains exactly one transition in the
# middle — this doubles as both the data AND the clock signal.
#
# IEEE 802.3 convention used here:
#     bit 1 -> high-to-low transition mid-bit   (+1 then -1)
#     bit 0 -> low-to-high transition mid-bit   (-1 then +1)
#
# Because every bit guarantees a transition, Manchester is perfectly
# self-clocking, at the cost of double bandwidth (two levels per bit).
# ============================================================
def manchester(bits: str) -> List[int]:
    bits = _validate_bits(bits)
    levels = []
    for bit in bits:
        if bit == '1':
            levels.extend([1, -1])   # high, then low: "1"
        else:
            levels.extend([-1, 1])   # low, then high: "0"
    return levels


# ============================================================
# DIFFERENTIAL MANCHESTER
# ============================================================
#
# Like Manchester, there is ALWAYS a transition in the middle of every bit
# (for clocking). But the bit's VALUE is carried differently:
#     bit 0 -> there IS an additional transition at the START of the interval
#     bit 1 -> there is NO transition at the start (level just continues)
#
# This makes it "differential" — like NRZ-I, you need the previous level
# to decode the next bit. Used by Token Ring (IEEE 802.5). It is more
# noise-resistant than plain Manchester because it only cares about the
# PRESENCE/ABSENCE of a transition, not the absolute polarity.
# ============================================================
def differential_manchester(bits: str) -> List[int]:
    bits = _validate_bits(bits)
    levels = []
    # Level carried over from the end of the previous bit interval.
    level = 1
    for bit in bits:
        if bit == '0':
            # '0': flip the level BEFORE the bit starts (extra transition).
            level = -level
        # '1': no flip at the start — level carries straight through.
        first_half = level
        # The mid-bit transition happens unconditionally (for clocking).
        level = -level
        second_half = level
        levels.append(first_half)
        levels.append(second_half)
    return levels


# ============================================================
# AMI (Alternate Mark Inversion)
# ============================================================
#
# A bipolar scheme: binary 0 is sent as zero voltage (no pulse). Each
# binary 1 ("mark") is sent as a pulse whose polarity ALTERNATES every
# time — first +V, next -V, next +V, and so on.
#
# Benefit: no DC component (positive and negative pulses cancel out over
# time), and a simple built-in error check — if two consecutive 1-pulses
# ever have the SAME polarity, that's called a "bipolar violation" and
# signals a transmission error.
#
# Weakness: a long run of 0s still produces a flat line (no pulses at
# all), which is why real T1 lines pair AMI with B8ZS.
# ============================================================
def ami(bits: str) -> List[int]:
    bits = _validate_bits(bits)
    levels = []
    polarity = 1
    for bit in bits:
        if bit == '1':
            # Flip polarity FIRST, then use it — so pulses alternate
            # +1, -1, +1, -1 ... starting with -1 for the very first mark.
            polarity = -polarity
            levels.append(polarity)
        else:
            levels.append(0)
    return levels


# ============================================================
# PSEUDOTERNARY
# ============================================================
#
# The exact mirror image of AMI: binary 1 is sent as zero voltage, and
# each binary 0 alternates polarity (+V, -V, +V, ...). Used in some ISDN
# basic-rate interfaces. Same DC-balance benefit as AMI, but now it is
# long runs of 1s (not 0s) that threaten clock sync.
# ============================================================
def pseudoternary(bits: str) -> List[int]:
    bits = _validate_bits(bits)
    levels = []
    polarity = 1
    for bit in bits:
        if bit == '0':
            polarity = -polarity
            levels.append(polarity)
        else:
            levels.append(0)
    return levels


# ============================================================
# 2B1Q (Two Binary, One Quaternary)
# ============================================================
#
# A multilevel line code: every PAIR of bits is mapped to ONE of four
# voltage levels. Because each transmitted symbol now carries 2 bits
# instead of 1, the required signal bandwidth is halved compared to a
# two-level code sending the same bit rate. Used in ISDN and early DSL.
#
# Mapping used here (a common convention):
#     00 -> -3      01 -> -1      11 -> +1      10 -> +3
# ============================================================
_TWO_B1_Q_MAP: Dict[str, int] = {'00': -3, '01': -1, '11': 1, '10': 3}


def two_b1q(bits: str) -> List[int]:
    bits = _validate_bits(bits)
    # 2B1Q needs an even number of bits — pad with a trailing 0 if needed.
    if len(bits) % 2 != 0:
        bits += '0'
    levels = []
    for i in range(0, len(bits), 2):
        pair = bits[i:i + 2]
        levels.append(_TWO_B1_Q_MAP[pair])
    return levels


# ============================================================
# MLT-3 (Multi-Level Transmit — 3 levels)
# ============================================================
#
# Uses three voltage levels: -1, 0, +1, arranged in a fixed cycle:
#     0 -> +1 -> 0 -> -1 -> 0 -> +1 -> ...
# A bit '1' advances one step around this cycle; a bit '0' leaves the
# level exactly where it was (no step). Because the signal only ever
# moves one small step at a time, the highest frequency component of the
# transmitted signal is much lower than an equivalent NRZI signal at the
# same bit rate — this reduces electromagnetic interference (EMI), which
# is why 100BASE-TX Fast Ethernet uses it (after 4B/5B coding).
# ============================================================
def mlt3(bits: str) -> List[int]:
    bits = _validate_bits(bits)
    cycle = [0, 1, 0, -1]   # the fixed 4-step cycle described above
    idx = 0
    levels = []
    for bit in bits:
        if bit == '1':
            idx = (idx + 1) % len(cycle)
        # A '0' does not move the index at all.
        levels.append(cycle[idx])
    return levels


# ============================================================
# 4B/5B BLOCK CODING
# ============================================================
#
# Not a *line* code by itself — it is a preprocessing step that runs
# BEFORE line encoding (typically NRZI). Every 4 data bits are replaced
# with a 5-bit "code group" chosen from a fixed lookup table so that no
# code group has more than a small, bounded number of leading/trailing
# zeros. This guarantees that whatever line code follows will still see
# frequent transitions, even if the ORIGINAL data was a long run of 0s.
#
# The cost is a flat 25% overhead: 5 bits are sent for every 4 data bits.
# Used in 100BASE-TX / FDDI (100 Mbps Ethernet), normally followed by
# NRZI line encoding — which is exactly what `four_b5b_then_nrzi` does.
# ============================================================
FOUR_B5B_TABLE: Dict[str, str] = {
    '0000': '11110', '0001': '01001', '0010': '10100', '0011': '10101',
    '0100': '01010', '0101': '01011', '0110': '01110', '0111': '01111',
    '1000': '10010', '1001': '10011', '1010': '10110', '1011': '10111',
    '1100': '11010', '1101': '11011', '1110': '11100', '1111': '11101',
}


def four_b5b_encode(bits: str) -> str:
    """Translate a bitstream into its 4B/5B code-group representation."""
    bits = _validate_bits(bits)
    # Pad to a multiple of 4 bits — real hardware pads with a known
    # idle/fill pattern; here we simply pad with zeros for clarity.
    while len(bits) % 4 != 0:
        bits += '0'
    coded = ''
    for i in range(0, len(bits), 4):
        nibble = bits[i:i + 4]
        coded += FOUR_B5B_TABLE[nibble]
    return coded


def four_b5b_then_nrzi(bits: str) -> List[int]:
    """4B/5B block-codes the data, then line-encodes the result with NRZI."""
    coded = four_b5b_encode(bits)
    return nrz_i(coded)


# ============================================================
# B8ZS (Bipolar with 8-Zero Substitution)
# ============================================================
#
# Starts from plain AMI, but watches for any run of EIGHT consecutive
# zeros. When found, that run is replaced with a special 8-bit pattern
# containing two deliberate "bipolar violations" (two pulses of the SAME
# polarity in a row) that a receiver can recognize as the B8ZS signature
# and undo, recovering the original eight zero bits. This guarantees a
# pulse at least once every 8 bit periods, fixing AMI's zero-run problem.
# Used on North American T1/DS1 lines.
#
# Substitution patterns (V = violation, B = normal bipolar pulse),
# relative to the polarity of the last pulse sent (lastPol):
#     if lastPol == +1:  0 0 0 +1 -1 0 -1 +1
#     if lastPol == -1:  0 0 0 -1 +1 0 +1 -1
# (the pattern's last pulse always matches lastPol's sign so alternation
#  continues correctly afterwards)
# ============================================================
def b8zs(bits: str) -> List[int]:
    bits = _validate_bits(bits)
    levels: List[int] = []
    last_pol = 1
    i = 0
    n = len(bits)
    while i < n:
        if bits[i:i + 8] == '00000000':
            if last_pol == 1:
                pattern = [0, 0, 0, 1, -1, 0, -1, 1]
            else:
                pattern = [0, 0, 0, -1, 1, 0, 1, -1]
            levels.extend(pattern)
            last_pol = pattern[-1]
            i += 8
        else:
            bit = bits[i]
            if bit == '1':
                last_pol = -last_pol
                levels.append(last_pol)
            else:
                levels.append(0)
            i += 1
    return levels


# ============================================================
# HDB3 (High-Density Bipolar 3-Zero Substitution)
# ============================================================
#
# Similar idea to B8ZS but with a shorter trigger: any run of just FOUR
# zeros gets substituted. The substitution pattern depends on the PARITY
# of the number of pulses (1-bits) sent since the last substitution, so
# that the overall pulse count keeps the line DC-balanced:
#
#   * If an ODD number of pulses have occurred since the last substitution:
#         insert  0 0 0 V   (V takes the SAME polarity as the last pulse —
#                            this is the "bipolar violation")
#   * If an EVEN number of pulses have occurred since the last substitution:
#         insert  B 0 0 V   (B is a normal pulse with OPPOSITE polarity to
#                            the last pulse, V matches B — two violations
#                            of the same polarity in a row)
#
# Used on European E1 telephony lines.
# ============================================================
def hdb3(bits: str) -> List[int]:
    bits = _validate_bits(bits)
    levels: List[int] = []
    last_pol = -1     # polarity of the most recent real pulse
    pulse_count = 0   # pulses sent since the last substitution
    i = 0
    n = len(bits)
    while i < n:
        if bits[i:i + 4] == '0000':
            odd = (pulse_count % 2 == 1)
            if odd:
                # 000V — violation reuses the last pulse's polarity.
                pattern = [0, 0, 0, last_pol]
            else:
                # B00V — a normal pulse of opposite polarity, then a
                # violation that matches it.
                make_up = -last_pol
                pattern = [make_up, 0, 0, make_up]
            levels.extend(pattern)
            last_pol = pattern[-1]
            pulse_count = 0
            i += 4
        else:
            bit = bits[i]
            if bit == '1':
                last_pol = -last_pol
                levels.append(last_pol)
                pulse_count += 1
            else:
                levels.append(0)
            i += 1
    return levels


# A lookup table so callers/UIs can iterate over every scheme generically.
LINE_ENCODING_SCHEMES = {
    'unipolar': unipolar_nrz,
    'nrzl': nrz_l,
    'nrzi': nrz_i,
    'rz': rz,
    'manchester': manchester,
    'diffmanchester': differential_manchester,
    'ami': ami,
    'pseudoternary': pseudoternary,
    'twob1q': two_b1q,
    'mlt3': mlt3,
    'fourb5b': four_b5b_then_nrzi,
    'b8zs': b8zs,
    'hdb3': hdb3,
}


if __name__ == '__main__':
    # Small self-test / demonstration when this file is run directly.
    sample = '1101 0010'
    print(f"Sample bitstream: {sample!r}\n")
    for name, fn in LINE_ENCODING_SCHEMES.items():
        print(f"{name:>15}: {fn(sample)}")
