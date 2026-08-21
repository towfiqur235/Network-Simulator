"""
================================================================================
 ERROR CORRECTION ALGORITHMS
================================================================================

This module implements Hamming(7,4) error correction, used by the "Error
Detection & Correction" section of the simulator.

Error detection (see error_detection.py) can only tell you THAT something
went wrong. Error CORRECTION goes one step further:

        Error Detection
              |
              v
        Find whether an error exists
              |
        Error Correction
              |
              v
        Find WHERE the error occurred
              |
              v
        Correct the corrupted bit

Hamming(7,4) takes 4 data bits and adds 3 parity bits, positioned so that
each parity bit "covers" a specific, overlapping subset of the 7
transmitted bit positions. Because the coverage patterns overlap, the
PATTERN of which parity checks fail (called the "syndrome") maps
directly onto the POSITION of a single flipped bit — allowing the
receiver to locate and flip it back automatically, with no
retransmission needed. This is why Hamming codes are called
"single-error-correcting" codes.

Bit position layout used throughout this file (1-indexed, matching the
convention used in the web UI):

    Position:   1    2    3    4    5    6    7
    Content:    P1   P2   D1   P4   D2   D3   D4

    P1 = parity bit 1 (covers positions 1, 3, 5, 7)
    P2 = parity bit 2 (covers positions 2, 3, 6, 7)
    P4 = parity bit 4 (covers positions 4, 5, 6, 7)
    D1..D4 = the four original data bits, placed into the remaining slots
================================================================================
"""

from typing import Dict, List


def _validate_4_data_bits(data_bits: str) -> List[int]:
    cleaned = ''.join(ch for ch in data_bits if ch in '01')
    cleaned = (cleaned + '0000')[:4]   # pad/truncate to exactly 4 bits, like the UI does
    return [int(b) for b in cleaned]


# ============================================================
# HAMMING CODE
# ============================================================

def hamming_encode(data_bits: str) -> Dict:
    """
    Encode 4 data bits into a 7-bit Hamming codeword.

    We build an 8-element array (index 0 unused, so positions line up
    1-to-1 with the "Position" numbers used everywhere else in this
    file) and fill it in this order:

        1. Place the 4 data bits into positions 3, 5, 6, 7 — these are
           the positions that are NOT a power of two, which is exactly
           where Hamming codes put data bits (positions 1, 2, 4 are
           reserved for parity).
        2. Compute each parity bit as the XOR of the data bits it covers.
           XOR gives "even parity": the parity bit is chosen so that the
           total number of 1-bits among the positions it covers
           (parity bit included) is always even.
    """
    d = _validate_4_data_bits(data_bits)   # [D1, D2, D3, D4]

    c = [0] * 8   # c[0] is unused padding; real bits live at c[1..7]
    c[3] = d[0]   # D1
    c[5] = d[1]   # D2
    c[6] = d[2]   # D3
    c[7] = d[3]   # D4

    # P1 covers positions 1,3,5,7 -> P1 itself is c[1], and it must make
    # the XOR of {c1,c3,c5,c7} equal to 0, i.e. c1 = c3^c5^c7.
    c[1] = c[3] ^ c[5] ^ c[7]
    # P2 covers positions 2,3,6,7.
    c[2] = c[3] ^ c[6] ^ c[7]
    # P4 covers positions 4,5,6,7.
    c[4] = c[5] ^ c[6] ^ c[7]

    codeword = c[1:8]   # 7-bit transmitted codeword, positions 1..7 in order
    return {
        'data': ''.join(str(b) for b in d),
        'codeword': codeword,
        'codeword_str': ''.join(str(b) for b in codeword),
        'p1': c[1], 'p2': c[2], 'p4': c[4],
    }


def inject_error(codeword: List[int], position: int) -> Dict:
    """
    Simulate transmission noise flipping exactly one bit.

    `position` is 1-indexed (1..7), matching the Hamming position layout
    documented at the top of this file.
    """
    if not (1 <= position <= 7):
        raise ValueError("Bit position must be between 1 and 7.")
    corrupted = list(codeword)
    corrupted[position - 1] = 1 - corrupted[position - 1]   # flip 0<->1
    return {'corrupted': corrupted, 'corrupted_str': ''.join(str(b) for b in corrupted), 'error_position': position}


def calculate_syndrome(received: List[int]) -> Dict:
    """
    Receiver-side detection: recompute each parity check over the
    RECEIVED bits and see whether it still comes out even.

    The three individual check results (0 = parity held / 1 = parity
    violated) are combined into a single "syndrome" value:

        syndrome = P1_check + 2*P2_check + 4*P4_check

    This is exactly the binary number P4P2P1 read as decimal — and, by
    the way Hamming positions were assigned, that decimal number IS the
    1-indexed position of the flipped bit (0 means "no error").
    """
    c = [0] + list(received)   # re-insert the unused padding slot so indices line up

    # Recompute each parity bit's expected value the same way the
    # ENCODER did, then XOR it against the actual received bit at that
    # parity position. A non-zero result means that parity check failed.
    p1_check = c[1] ^ c[3] ^ c[5] ^ c[7]
    p2_check = c[2] ^ c[3] ^ c[6] ^ c[7]
    p4_check = c[4] ^ c[5] ^ c[6] ^ c[7]

    syndrome = p1_check + p2_check * 2 + p4_check * 4

    return {
        'p1_check': p1_check,
        'p2_check': p2_check,
        'p4_check': p4_check,
        'syndrome': syndrome,
        'syndrome_binary': format(syndrome, '03b'),   # e.g. "101"
        'error_position': syndrome,   # 0 means "no error detected"
    }


def correct_error(received: List[int]) -> Dict:
    """
    Full receiver-side detect + correct pipeline:

        Corrupted Data
              |
              v
        Calculate Syndrome
              |
              v
        Find Error Position
              |
              v
        Flip Incorrect Bit
              |
              v
        Corrected Data
    """
    syndrome_info = calculate_syndrome(received)
    syndrome = syndrome_info['syndrome']

    corrected = list(received)
    if syndrome != 0:
        # The syndrome value IS the 1-indexed position of the bad bit.
        corrected[syndrome - 1] = 1 - corrected[syndrome - 1]

    # Once corrected, the original 4 data bits live back at positions
    # 3, 5, 6, 7 (see the encoder above).
    recovered_data = ''.join(str(corrected[p - 1]) for p in (3, 5, 6, 7))

    return {
        **syndrome_info,
        'received': ''.join(str(b) for b in received),
        'corrected': corrected,
        'corrected_str': ''.join(str(b) for b in corrected),
        'recovered_data': recovered_data,
        'error_was_present': syndrome != 0,
    }


if __name__ == '__main__':
    print("=== Hamming(7,4) demo ===")
    enc = hamming_encode('1011')
    print(f"Data 1011 -> codeword {enc['codeword_str']}  (P1={enc['p1']} P2={enc['p2']} P4={enc['p4']})")

    injected = inject_error(enc['codeword'], position=5)
    print(f"Error injected at position 5: {injected['corrupted_str']}")

    result = correct_error(injected['corrupted'])
    print(f"Syndrome = {result['syndrome_binary']} (decimal {result['syndrome']}) "
          f"-> error at position {result['error_position']}")
    print(f"Corrected codeword: {result['corrected_str']}")
    print(f"Recovered data bits: {result['recovered_data']} "
          f"(matches original: {result['recovered_data'] == enc['data']})")
