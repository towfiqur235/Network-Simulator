"""
================================================================================
 ERROR DETECTION ALGORITHMS
================================================================================

This module implements the error-DETECTION techniques used by the simulator's
"Error Detection & Correction" section: Parity Check, Two-Dimensional Parity,
Checksum, and Cyclic Redundancy Check (CRC).

Error DETECTION answers one yes/no question:

        "Did the data change in transit?"

It does NOT tell you WHERE the change happened, and (with the exception of
2D parity, in a limited way) it cannot fix the error either — that is the
job of error CORRECTION (see error_correction.py). Detection schemes are
cheaper to compute and check, so they are used far more often; when an
error is detected, the usual fix is simply to ask the sender to
retransmit the data (this is what TCP does).

Every algorithm here is implemented from first principles — no external
checksum/CRC library is used — so every XOR, bit-shift and running sum is
visible in the code.
================================================================================
"""

from typing import Dict, List, Tuple


def _clean_bits(bits: str) -> str:
    return ''.join(ch for ch in bits if ch in '01')


# ============================================================
# PARITY CHECK (single-bit / VRC — Vertical Redundancy Check)
# ============================================================
#
# The simplest error-detection scheme. The sender counts the number of
# 1-bits in the data and appends ONE extra "parity bit" chosen so that
# the TOTAL number of 1s (data + parity bit) matches the desired parity:
#
#     EVEN parity -> total count of 1s must be even
#     ODD  parity -> total count of 1s must be odd
#
# The receiver recomputes the same count over the bits it received
# (including the parity bit). If the parity doesn't match what's
# expected, at least one bit was flipped in transit.
#
# Limitation: parity can only reliably catch an ODD number of bit flips
# (1, 3, 5, ...). If exactly two bits flip, the count of 1s returns to
# the "correct" parity and the error slips through undetected. This is
# why parity alone is considered weak, and why CRC/checksums exist.
# ============================================================
def generate_parity_bit(data_bits: str, even: bool = True) -> str:
    """Compute the single parity bit to append to `data_bits`."""
    data_bits = _clean_bits(data_bits)
    ones = data_bits.count('1')
    if even:
        # We want (ones + parity_bit) to be even.
        parity_bit = '0' if ones % 2 == 0 else '1'
    else:
        # We want (ones + parity_bit) to be odd.
        parity_bit = '1' if ones % 2 == 0 else '0'
    return parity_bit


def parity_encode(data_bits: str, even: bool = True) -> str:
    """Return the data with its parity bit appended (the transmitted codeword)."""
    p = generate_parity_bit(data_bits, even)
    return _clean_bits(data_bits) + p


def parity_check(received_bits: str, even: bool = True) -> Dict:
    """
    Check a received codeword (data bits + parity bit, all together).
    Returns a dict describing whether an error was detected.
    """
    received_bits = _clean_bits(received_bits)
    ones = received_bits.count('1')
    is_even = (ones % 2 == 0)
    # If we expect even parity, the total 1-count over the WHOLE codeword
    # (data + parity bit) must be even; likewise for odd parity.
    expected_even = even
    error_detected = (is_even != expected_even)
    return {
        'received': received_bits,
        'ones_count': ones,
        'parity_scheme': 'even' if even else 'odd',
        'error_detected': error_detected,
    }


# ============================================================
# TWO-DIMENSIONAL PARITY (2D Parity / Longitudinal + Vertical Redundancy Check)
# ============================================================
#
# Single-bit parity can't catch two simultaneous bit flips. 2D parity
# improves on this by arranging the data into a GRID (rows x columns),
# then computing:
#
#     - one parity bit for EVERY ROW   (a "row parity" column on the right)
#     - one parity bit for EVERY COLUMN (a "column parity" row on the bottom)
#
# If a single bit flips, its row parity AND its column parity will both
# fail, which pinpoints the intersection — the exact bit — that flipped.
# (This makes 2D parity a light form of error CORRECTION too, for the
# single-bit-error case, though it is normally taught as a detection
# scheme because larger error patterns can still slip through.)
# ============================================================
def two_d_parity_encode(data_rows: List[str], even: bool = True) -> Dict:
    """
    data_rows: a list of equal-length bit strings, e.g. ['1101','1010','0110'].
    Returns the row parities, the column parity row, and the full grid.
    """
    if not data_rows:
        raise ValueError("Need at least one row of data.")
    width = len(data_rows[0])
    if any(len(r) != width for r in data_rows):
        raise ValueError("All rows must be the same length.")

    row_parities = [generate_parity_bit(row, even) for row in data_rows]

    # Column parity: for each column index, gather that bit from every row
    # (INCLUDING the row-parity column) and compute its parity the same way.
    col_parities = []
    for col in range(width):
        column_bits = ''.join(row[col] for row in data_rows)
        col_parities.append(generate_parity_bit(column_bits, even))
    # The parity of the row-parity column itself (bottom-right corner bit).
    corner_bit = generate_parity_bit(''.join(row_parities), even)

    return {
        'rows': data_rows,
        'row_parities': row_parities,
        'col_parities': col_parities,
        'corner_bit': corner_bit,
    }


def two_d_parity_check(data_rows: List[str], row_parities: List[str],
                        col_parities: List[str], corner_bit: str,
                        even: bool = True) -> Dict:
    """
    Recompute all parities over the RECEIVED grid and compare against the
    RECEIVED parity bits. Returns which row(s)/column(s) failed, which (for
    a single-bit error) identifies the exact corrupted bit.
    """
    width = len(data_rows[0])
    bad_rows = []
    for i, row in enumerate(data_rows):
        if generate_parity_bit(row, even) != row_parities[i]:
            bad_rows.append(i)

    bad_cols = []
    for col in range(width):
        column_bits = ''.join(row[col] for row in data_rows)
        if generate_parity_bit(column_bits, even) != col_parities[col]:
            bad_cols.append(col)

    corner_ok = generate_parity_bit(''.join(row_parities), even) == corner_bit

    error_detected = bool(bad_rows or bad_cols or not corner_ok)
    # A single flipped DATA bit shows up as exactly one bad row AND one bad
    # column — their intersection is the corrupted bit's location.
    pinpointed = None
    if len(bad_rows) == 1 and len(bad_cols) == 1:
        pinpointed = (bad_rows[0], bad_cols[0])

    return {
        'bad_rows': bad_rows,
        'bad_cols': bad_cols,
        'corner_ok': corner_ok,
        'error_detected': error_detected,
        'pinpointed_bit': pinpointed,   # (row, col) if a single bit error was located
    }


# ============================================================
# CHECKSUM
# ============================================================
#
# Used by IP, TCP, and UDP headers. The idea: split the data into equal-
# sized blocks (traditionally 16 bits), add all the blocks together using
# ONE'S-COMPLEMENT addition, then send the ONE'S COMPLEMENT of that final
# sum as the checksum.
#
# One's-complement addition: after a normal binary addition, if there is
# a carry-out bit beyond the block width, that carry is NOT discarded —
# it is wrapped around and added back into the low end of the sum. This
# is sometimes called "end-around carry".
#
# At the receiver: add all the blocks together WITH the checksum block
# included. If nothing was corrupted, the one's-complement sum of
# (data blocks + checksum) comes out as all 1-bits (every bit set) —
# this all-ones value is checked for directly.
# ============================================================
def _ones_complement_add(a: int, b: int, bit_width: int) -> int:
    """Add two `bit_width`-bit numbers with end-around carry (one's-complement addition)."""
    mask = (1 << bit_width) - 1
    total = a + b
    # If the sum overflowed past bit_width bits, wrap the overflow bit
    # back around and add it to the low end ("end-around carry").
    carry = total >> bit_width
    total = (total & mask) + carry
    # A second wrap-around is occasionally needed if adding the carry
    # itself produced another overflow.
    if total > mask:
        total = (total & mask) + 1
    return total


def _split_into_blocks(bits: str, block_size: int) -> List[str]:
    # Pad on the right with zeros so the bitstream divides evenly into blocks.
    padded = bits + '0' * ((-len(bits)) % block_size)
    return [padded[i:i + block_size] for i in range(0, len(padded), block_size)]


def checksum_generate(data_bits: str, block_size: int = 8) -> Dict:
    """
    Compute the checksum for `data_bits`, split into `block_size`-bit blocks.
    Returns the running sum, the final one's-complement sum, and the
    checksum itself (the bitwise complement of that sum).
    """
    data_bits = _clean_bits(data_bits)
    blocks = _split_into_blocks(data_bits, block_size)
    mask = (1 << block_size) - 1

    running_sum = 0
    steps = []
    for block in blocks:
        value = int(block, 2)
        new_sum = _ones_complement_add(running_sum, value, block_size)
        steps.append({'block': block, 'value': value, 'running_sum_after': new_sum})
        running_sum = new_sum

    # The checksum transmitted on the wire is the ONE'S COMPLEMENT
    # (bitwise NOT, within block_size bits) of the final running sum.
    checksum = (~running_sum) & mask

    return {
        'blocks': blocks,
        'steps': steps,
        'sum': running_sum,
        'checksum': checksum,
        'checksum_bits': format(checksum, f'0{block_size}b'),
    }


def checksum_verify(data_bits: str, checksum_bits: str, block_size: int = 8) -> Dict:
    """
    Receiver-side check: add all data blocks PLUS the received checksum
    block together. If nothing was corrupted, the one's-complement sum
    comes out as all 1s (i.e. equal to `mask`).
    """
    data_bits = _clean_bits(data_bits)
    blocks = _split_into_blocks(data_bits, block_size) + [checksum_bits]
    mask = (1 << block_size) - 1

    running_sum = 0
    for block in blocks:
        value = int(block, 2)
        running_sum = _ones_complement_add(running_sum, value, block_size)

    valid = (running_sum == mask)   # all bits set == "all-ones" success pattern
    return {
        'final_sum': running_sum,
        'final_sum_bits': format(running_sum, f'0{block_size}b'),
        'valid': valid,
        'error_detected': not valid,
    }


# ============================================================
# CRC - CYCLIC REDUNDANCY CHECK
# ============================================================
#
# CRC is a far stronger error-detection technique than simple parity or
# checksums, and is what Ethernet frames, ZIP files, and this simulator's
# Data Link layer use.
#
# Main steps:
#
# 1. Take the original binary data.
# 2. Append (generator_length - 1) zero bits to the end. This "makes room"
#    for the remainder that the division below will produce.
# 3. Perform MODULO-2 DIVISION of the augmented data by the generator
#    polynomial (also given as a bit pattern, e.g. '1011').
# 4. Modulo-2 division uses XOR instead of normal subtraction — there is
#    no "borrowing" the way there is in decimal long division.
# 5. The bits left over after the division completes are the CRC
#    remainder (its length is always generator_length - 1 bits).
# 6. The sender APPENDS the remainder to the ORIGINAL data (replacing the
#    zeros that were appended in step 2) to form the final "codeword"
#    that actually goes out on the wire.
#
# At the receiver: divide the RECEIVED codeword (data + CRC bits) by the
# SAME generator. If nothing was corrupted, the remainder of THIS
# division comes out as all zeros. Any non-zero remainder means the data
# was corrupted somewhere in transit.
# ============================================================
def xor_divide(dividend_bits: str, generator: str) -> Dict:
    """
    Perform modulo-2 (XOR) division of `dividend_bits` by `generator`,
    exactly the way it is done by hand on paper / on a whiteboard.

    Returns the list of individual XOR steps (for step-by-step display)
    plus the final remainder.
    """
    work = [int(b) for b in dividend_bits]
    # The generator determines how many bits participate in each XOR —
    # it also determines how many bits the remainder will end up being
    # (generator_length - 1).
    generator_length = len(generator)
    generator_bits = [int(b) for b in generator]

    steps = []
    # We slide the generator along the dividend, one position at a time.
    # We can only XOR at a position whose leading bit is '1' — dividing
    # by (XORing with) the generator where the leading bit is 0 would be
    # like dividing by zero in ordinary long division, so at those
    # positions we simply leave a 0 in the quotient and move on (the
    # "before" bits are already all effectively unchanged).
    for i in range(0, len(work) - generator_length + 1):
        if work[i] == 1:
            before = ''.join(str(b) for b in work[i:i + generator_length])
            # XOR the generator bit-by-bit into the working window.
            # XOR is used instead of subtraction because modulo-2
            # arithmetic has no concept of "borrowing" — 1-1=0, 0-1
            # wraps to 1, which is exactly what XOR already gives us.
            for j in range(generator_length):
                work[i + j] ^= generator_bits[j]
            after = ''.join(str(b) for b in work[i:i + generator_length])
            steps.append({'position': i, 'before': before, 'generator': generator, 'after': after})

    # Whatever is left in the trailing (generator_length - 1) positions
    # once we've slid all the way through is the CRC remainder.
    remainder = ''.join(str(b) for b in work[len(work) - (generator_length - 1):])
    return {'remainder': remainder, 'steps': steps, 'final_register': ''.join(str(b) for b in work)}


def crc_generate(data_bits: str, generator: str) -> Dict:
    """
    Full sender-side CRC generation: augment the data with zeros, divide,
    and attach the remainder to build the final transmitted codeword.
    """
    data_bits = _clean_bits(data_bits)
    generator = _clean_bits(generator)
    if generator[0] != '1':
        raise ValueError("Generator polynomial must start with a 1 bit.")

    # Step 2: append (generator_length - 1) zeros to make room for the CRC.
    augmented = data_bits + '0' * (len(generator) - 1)

    # Steps 3-5: modulo-2 division to obtain the remainder.
    division = xor_divide(augmented, generator)
    remainder = division['remainder']

    # Step 6: the CRC remainder replaces the appended zeros, giving the
    # final codeword that actually gets transmitted.
    codeword = data_bits + remainder

    return {
        'data': data_bits,
        'generator': generator,
        'augmented': augmented,
        'division_steps': division['steps'],
        'remainder': remainder,
        'codeword': codeword,
    }


def crc_check(received_codeword: str, generator: str) -> Dict:
    """
    Receiver-side CRC check: divide the RECEIVED codeword by the same
    generator. A non-zero remainder means the data was corrupted.
    """
    received_codeword = _clean_bits(received_codeword)
    generator = _clean_bits(generator)
    division = xor_divide(received_codeword, generator)
    remainder = division['remainder']
    is_valid = (set(remainder) <= {'0'})   # remainder is all zeros -> no error detected
    return {
        'received': received_codeword,
        'division_steps': division['steps'],
        'remainder': remainder,
        'error_detected': not is_valid,
    }


def flip_bit(bits: str, position: int) -> str:
    """Utility: flip a single bit at `position` (0-indexed) — used to simulate transmission noise."""
    chars = list(bits)
    chars[position] = '1' if chars[position] == '0' else '0'
    return ''.join(chars)


if __name__ == '__main__':
    print("=== Parity Check demo ===")
    codeword = parity_encode('1011000', even=True)
    print(f"Codeword (data+parity): {codeword}")
    print(parity_check(codeword, even=True))
    print(parity_check(flip_bit(codeword, 2), even=True))

    print("\n=== Checksum demo ===")
    gen = checksum_generate('1101011000100110', block_size=8)
    print(f"Checksum bits: {gen['checksum_bits']}")
    print(checksum_verify('1101011000100110', gen['checksum_bits'], block_size=8))

    print("\n=== CRC demo ===")
    crc = crc_generate('11010011101100', '1011')
    print(f"Codeword: {crc['codeword']}  (remainder={crc['remainder']})")
    print(crc_check(crc['codeword'], '1011'))
    print(crc_check(flip_bit(crc['codeword'], 3), '1011'))
