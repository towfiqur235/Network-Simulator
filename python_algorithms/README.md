# Python Algorithms — Reference Implementation

This folder is a **standalone, dependency-free educational reference** for the
networking algorithms that power *Inside the Wire*. It has nothing to do with
running the web app — the app is a plain HTML/CSS/JS front end
(see `../index.html` and `../src/`) and works exactly as before with no
server or build step. This folder exists so a student can open one small
Python file and read exactly how an algorithm works, independent of any UI
code, animation, or DOM manipulation.

The JavaScript in `../src/js/` (`encoding.js`, `crc.js`, `hamming.js`,
`framing.js`) implements the *same* algorithms for the interactive browser
labs. Both implementations were checked against each other and produce
identical results for the same inputs — for example, encoding data
`11010011101100` with generator `1011` in both the web CRC lab and
`error_detection.crc_generate()` here gives the same remainder (`100`) and
codeword.

## Layout

```
python_algorithms/
├── README.md              — this file
├── algorithms.py           — single entry point that imports everything
│                             below and runs a worked demo of every
│                             algorithm end-to-end
├── line_encoding.py         — NRZ-L, NRZ-I, RZ, Manchester, Differential
│                             Manchester, AMI, Pseudoternary, 2B1Q, MLT-3,
│                             4B/5B, B8ZS, HDB3
├── error_detection.py       — Parity Check, Two-Dimensional Parity,
│                             Checksum (one's-complement), CRC
├── error_correction.py      — Hamming(7,4): encode, inject error,
│                             calculate syndrome, correct
└── framing.py                — Byte (character) stuffing/destuffing,
                              bit stuffing/destuffing
```

## Design principles

- **Nothing is hidden behind a library call.** There is no
  `zlib.crc32(...)` or `some_crc_library.calculate(...)` anywhere in this
  folder. Every XOR, division step, running sum, and bit flip is written
  out explicitly so the logic is visible and inspectable line by line.
- **Heavily commented.** Every algorithm starts with a large banner
  comment explaining *why* the technique exists and what problem it
  solves, followed by inline comments explaining *why* each operation is
  performed — not just restating what the code obviously does.
- **Pure functions, plain data.** Every function takes bit-strings (or
  lists of ints) in and returns a plain `dict`/`list` out — no classes,
  no hidden global state, no framework. You can import any function into
  a Python shell and experiment immediately.

## Running it

Requires only the Python 3 standard library — nothing to `pip install`.

```bash
cd python_algorithms
python3 algorithms.py
```

This runs a worked example of every algorithm and prints the intermediate
steps (XOR division steps, syndrome calculation, stuffed/destuffed output,
etc.) so you can see each one working end-to-end.

You can also run any individual module directly to see just its own demo,
e.g.:

```bash
python3 error_correction.py
python3 line_encoding.py
```

Or import functions directly in your own script / REPL:

```python
from error_detection import crc_generate, crc_check
result = crc_generate('11010011101100', '1011')
print(result['codeword'])          # '11010011101100100'
print(crc_check(result['codeword'], '1011')['error_detected'])   # False
```

## Algorithms implemented

| Category | Algorithms |
|---|---|
| Line Encoding | Unipolar NRZ, NRZ-L, NRZ-I, RZ, Manchester, Differential Manchester, AMI, Pseudoternary, 2B1Q, MLT-3, 4B/5B (+ NRZI), B8ZS, HDB3 |
| Error Detection | Parity Check (even/odd), Two-Dimensional Parity, Checksum (one's-complement, end-around carry), CRC (modulo-2 / XOR division) |
| Error Correction | Hamming(7,4) — encode, single-bit error injection, syndrome calculation, automatic correction |
| Framing | Byte (character) stuffing/destuffing (FLAG + ESC), Bit stuffing/destuffing (five-1s rule, `01111110` flag) |

## Connecting this to the simulator later

This package is intentionally UI-free so it can later be wrapped by a thin
backend (a small Flask/FastAPI service, for example) that the JavaScript
front end calls over HTTP, if the project ever wants the browser labs to
delegate their math to a real Python process instead of re-implementing it
in JavaScript. No such backend exists today — the front end's JavaScript
implementations remain the ones actually driving the interactive labs.
