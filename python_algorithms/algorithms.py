"""
================================================================================
 ALGORITHMS.PY — single entry point / demo runner for the whole package
================================================================================

This file does not re-implement anything — every algorithm lives in its
own clearly-named module (line_encoding.py, error_detection.py,
error_correction.py, framing.py) so each can be read independently.

algorithms.py simply re-exports everything in one place for convenience,
and — when run directly — walks through every algorithm with a worked
example, so you can verify the whole package end-to-end with:

    python3 algorithms.py

Nothing here talks to the web front-end. This package is a standalone,
dependency-free educational reference: the JavaScript in ../src/js
implements the same logic for the interactive browser UI, but this
Python package is what you should read to see the algorithms in their
clearest, most explicit form.
================================================================================
"""

from line_encoding import (
    unipolar_nrz, nrz_l, nrz_i, rz, manchester, differential_manchester,
    ami, pseudoternary, two_b1q, mlt3, four_b5b_encode, four_b5b_then_nrzi,
    b8zs, hdb3, LINE_ENCODING_SCHEMES,
)
from error_detection import (
    generate_parity_bit, parity_encode, parity_check,
    two_d_parity_encode, two_d_parity_check,
    checksum_generate, checksum_verify,
    xor_divide, crc_generate, crc_check, flip_bit,
)
from error_correction import (
    hamming_encode, inject_error, calculate_syndrome, correct_error,
)
from framing import (
    byte_stuff, byte_destuff, bit_stuff, bit_destuff,
)


def _section(title: str) -> None:
    print("\n" + "=" * 64)
    print(title)
    print("=" * 64)


def demo_line_encoding() -> None:
    _section("LINE ENCODING")
    bits = '11010010'
    for name, fn in LINE_ENCODING_SCHEMES.items():
        print(f"  {name:>15}: {bits} -> {fn(bits)}")


def demo_error_detection() -> None:
    _section("ERROR DETECTION — Parity Check")
    data = '1011000'
    codeword = parity_encode(data, even=True)
    print(f"  data={data} -> codeword (with even parity bit) = {codeword}")
    print(f"  check (no error):    {parity_check(codeword, even=True)}")
    corrupted = flip_bit(codeword, 3)
    print(f"  check (1 bit flipped @3): {parity_check(corrupted, even=True)}")

    _section("ERROR DETECTION — Two-Dimensional Parity")
    grid = two_d_parity_encode(['1101', '1010', '0110'], even=True)
    print(f"  rows: {grid['rows']}")
    print(f"  row parities: {grid['row_parities']}   col parities: {grid['col_parities']}   corner: {grid['corner_bit']}")
    # Simulate a single-bit error at row 1, col 2.
    corrupted_rows = list(grid['rows'])
    row_list = list(corrupted_rows[1])
    row_list[2] = '1' if row_list[2] == '0' else '0'
    corrupted_rows[1] = ''.join(row_list)
    check = two_d_parity_check(corrupted_rows, grid['row_parities'], grid['col_parities'], grid['corner_bit'], even=True)
    print(f"  after flipping bit at row=1,col=2: {check}")

    _section("ERROR DETECTION — Checksum")
    data_bits = '1101011000100110'
    gen = checksum_generate(data_bits, block_size=8)
    print(f"  data={data_bits}  checksum={gen['checksum_bits']}")
    print(f"  verify (no error):    {checksum_verify(data_bits, gen['checksum_bits'], 8)}")
    print(f"  verify (data corrupted): "
          f"{checksum_verify(flip_bit(data_bits, 0), gen['checksum_bits'], 8)}")

    _section("ERROR DETECTION — CRC")
    crc = crc_generate('11010011101100', '1011')
    print(f"  data=11010011101100  generator=1011")
    print(f"  augmented={crc['augmented']}  remainder={crc['remainder']}  codeword={crc['codeword']}")
    print(f"  receiver check (no error):  {crc_check(crc['codeword'], '1011')}")
    print(f"  receiver check (bit error): {crc_check(flip_bit(crc['codeword'], 5), '1011')}")


def demo_error_correction() -> None:
    _section("ERROR CORRECTION — Hamming(7,4)")
    enc = hamming_encode('1011')
    print(f"  data=1011 -> codeword={enc['codeword_str']}  (P1={enc['p1']} P2={enc['p2']} P4={enc['p4']})")
    injected = inject_error(enc['codeword'], position=5)
    print(f"  error injected @ position 5 -> {injected['corrupted_str']}")
    result = correct_error(injected['corrupted'])
    print(f"  syndrome={result['syndrome_binary']} (decimal {result['syndrome']}) "
          f"-> error position {result['error_position']}")
    print(f"  corrected codeword={result['corrected_str']}  recovered data={result['recovered_data']} "
          f"(matches original: {result['recovered_data'] == enc['data']})")


def demo_framing() -> None:
    _section("FRAMING — Byte Stuffing")
    bs = byte_stuff('AB~CD\\EF')
    print(f"  original='AB~CD\\\\EF' -> framed={bs['framed']}")
    print(f"  destuffed matches original: {byte_destuff(bs['framed']) == 'AB~CD\\EF'}")

    _section("FRAMING — Bit Stuffing")
    stuffed = bit_stuff('0111111011111011')
    print(f"  original=0111111011111011 -> framed={stuffed['framed']}")
    print(f"  destuffed matches original: {bit_destuff(stuffed['framed']) == '0111111011111011'}")


if __name__ == '__main__':
    demo_line_encoding()
    demo_error_detection()
    demo_error_correction()
    demo_framing()
    print("\nAll demos ran successfully.\n")
