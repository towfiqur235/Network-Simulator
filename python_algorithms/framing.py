"""
================================================================================
 FRAMING / DATA LINK OPERATIONS
================================================================================

This module implements the frame-delimiting techniques used by the
simulator's "Framing Lab": Byte (Character) Stuffing and Bit Stuffing.

Both address the same underlying problem: the Data Link layer marks the
start and end of every frame with a special reserved bit/byte pattern
(the FLAG). But what happens if that exact pattern shows up naturally
INSIDE the data being sent? The receiver would misinterpret it as the
end of the frame and truncate the message. "Stuffing" inserts extra
bits/bytes into the data stream so the FLAG pattern can never appear by
accident inside the payload — the receiver reverses this
("destuffing") to recover the original data exactly.
================================================================================
"""

from typing import Dict, List

FLAG_BYTE = '~'      # stands in for the real flag byte (e.g. 0x7E) for readability
ESC_BYTE = '\\'      # the escape byte
BIT_FLAG_PATTERN = '01111110'   # the classic HDLC flag pattern


# ============================================================
# BYTE (CHARACTER) STUFFING
# ============================================================
#
# Used when frames are delimited by a special FLAG byte. If that exact
# byte value — or the ESCAPE byte itself — appears naturally in the data,
# the sender inserts an ESC byte immediately before it. The receiver,
# upon seeing an ESC byte, knows to treat the NEXT byte as literal data
# rather than as a control character, and simply discards the ESC byte.
#
# This guarantees the two-byte sequence the receiver is scanning for
# (a bare, un-escaped FLAG) can only ever appear at the true frame
# boundaries.
# ============================================================
def byte_stuff(message: str) -> Dict:
    stuffed_chars: List[str] = []
    inserted_esc_positions: List[int] = []   # positions (in the stuffed body) of inserted ESC bytes

    for ch in message:
        if ch == FLAG_BYTE or ch == ESC_BYTE:
            # This byte is indistinguishable from a control character —
            # escape it so the receiver treats it as literal data.
            stuffed_chars.append(ESC_BYTE)
            inserted_esc_positions.append(len(stuffed_chars) - 1)
            stuffed_chars.append(ch)
        else:
            stuffed_chars.append(ch)

    stuffed_body = ''.join(stuffed_chars)
    # The final frame on the wire is bracketed by an un-escaped FLAG byte
    # at the very start and very end.
    framed = FLAG_BYTE + stuffed_body + FLAG_BYTE

    return {
        'original': message,
        'stuffed_body': stuffed_body,
        'framed': framed,
        'esc_positions_in_body': inserted_esc_positions,
    }


def byte_destuff(framed: str) -> str:
    """
    Reverse byte_stuff(): strip the two boundary FLAG bytes, then scan the
    body — whenever an ESC byte is seen, discard it and copy the NEXT
    byte through literally (skipping the usual "is this a FLAG/ESC?"
    check for that one byte).
    """
    if len(framed) < 2 or framed[0] != FLAG_BYTE or framed[-1] != FLAG_BYTE:
        raise ValueError("Framed input must start and end with the FLAG byte.")
    body = framed[1:-1]

    destuffed_chars: List[str] = []
    i = 0
    while i < len(body):
        if body[i] == ESC_BYTE:
            # Skip the ESC byte itself; the byte right after it is
            # literal data, even if it happens to equal FLAG or ESC.
            destuffed_chars.append(body[i + 1])
            i += 2
        else:
            destuffed_chars.append(body[i])
            i += 1

    return ''.join(destuffed_chars)


# ============================================================
# BIT STUFFING
# ============================================================
#
# Used by bit-oriented protocols like HDLC, whose FLAG pattern is
# 01111110 (six consecutive 1-bits sandwiched between two 0-bits). To
# guarantee this exact 8-bit pattern can never occur naturally inside
# the data, the sender inserts a single extra '0' bit into the data
# stream after every run of FIVE consecutive 1-bits it sees — this caps
# any run of 1s inside the payload at five, so six-in-a-row (the flag)
# is structurally impossible outside the real boundary markers.
#
# The receiver watches the incoming bitstream: every time it counts five
# consecutive 1-bits, it knows the very next bit MUST be a stuffed 0
# (inserted by the sender) and discards it, restoring the original data.
# ============================================================
def bit_stuff(bitstream: str) -> Dict:
    bitstream = ''.join(ch for ch in bitstream if ch in '01')

    stuffed_chars: List[str] = []
    run_of_ones = 0
    stuffed_bit_positions: List[int] = []   # positions (in the stuffed body) of inserted 0s

    for bit in bitstream:
        stuffed_chars.append(bit)
        if bit == '1':
            run_of_ones += 1
            if run_of_ones == 5:
                # We've just emitted the 5th consecutive 1 — insert an
                # extra 0 right now, before a 6th one could ever appear
                # and accidentally form the flag pattern.
                stuffed_chars.append('0')
                stuffed_bit_positions.append(len(stuffed_chars) - 1)
                run_of_ones = 0   # the stuffed 0 resets the run count
        else:
            run_of_ones = 0

    stuffed_body = ''.join(stuffed_chars)
    framed = BIT_FLAG_PATTERN + stuffed_body + BIT_FLAG_PATTERN

    return {
        'original': bitstream,
        'stuffed_body': stuffed_body,
        'framed': framed,
        'stuffed_bit_positions_in_body': stuffed_bit_positions,
    }


def bit_destuff(framed: str) -> str:
    """
    Reverse bit_stuff(): strip the two 8-bit FLAG patterns bracketing the
    frame, then scan the body bit by bit. Every time five consecutive
    1-bits have been seen, the NEXT bit is a stuffed 0 inserted purely
    for framing purposes — discard it rather than copying it to the
    output, and reset the run counter.
    """
    if len(framed) < 16 or framed[:8] != BIT_FLAG_PATTERN or framed[-8:] != BIT_FLAG_PATTERN:
        raise ValueError("Framed input must start and end with the flag pattern 01111110.")
    body = framed[8:-8]

    destuffed_chars: List[str] = []
    run_of_ones = 0
    i = 0
    while i < len(body):
        bit = body[i]
        if run_of_ones == 5:
            # This bit is a stuffed 0 — verify and discard it, don't copy it out.
            run_of_ones = 0
            i += 1
            continue
        destuffed_chars.append(bit)
        if bit == '1':
            run_of_ones += 1
        else:
            run_of_ones = 0
        i += 1

    return ''.join(destuffed_chars)


if __name__ == '__main__':
    print("=== Byte Stuffing demo ===")
    bs = byte_stuff('AB~CD\\EF')
    print(f"Original: AB~CD\\EF")
    print(f"Framed:   {bs['framed']}")
    print(f"Destuffed matches original: {byte_destuff(bs['framed']) == 'AB~CD\\EF'}")

    print("\n=== Bit Stuffing demo ===")
    bits = bit_stuff('0111111011111011')
    print(f"Original: 0111111011111011")
    print(f"Framed:   {bits['framed']}")
    print(f"Destuffed matches original: {bit_destuff(bits['framed']) == '0111111011111011'}")
