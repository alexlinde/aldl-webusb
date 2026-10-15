# ALDL 160-baud USB cable

How to buy or build a USB cable that reads GM's 160-baud ALDL data stream (A058, GM 1227747 ECM, as on the Howell JP-1 kit) with this project. Written so a replacement can be made if the commercial cable disappears.

## Buying one

- **aldlcables.com** (OBD Diagnostics, Inc.) — [ALDL 12-pin USB Cable](https://aldlcables.com/products/aldl-12-pin-usb-cable), $69.95 (sold out as of Oct 2026); also a cheaper "Jumperless" 12-pin version and a bare-pin cable. The store says the cable "works on cars that have the serial data pin on pin M or pin E" and that a 10 kΩ resistor for 160-baud cars is built in, enabled with a jumper. Formerly sold at aldlcable.com. Collection: <https://aldlcables.com/collections/aldl-obd1-cables>.
- **Moates ALDU1 / XtremeALDL** — USB, self-powered, with a switch selecting 10k or open on A–B. Not tested with this project.

Whatever you buy, it must be a **plain FTDI USB-serial bridge** (no microcontroller translating the protocol) so the host can open it at 1600 baud and see raw pulses. The cable used on this Jeep enumerates as **FTDI FT232R, USB `0403:6001`** (macOS: `/dev/tty.usbserial-XXXXXXXX`).

## The connector

GM 12-pin ALDL, under the dash. Looking at the face of the vehicle-side connector:

```
 F  E  D  C  B  A
 G  H  J  K  L  M      (no letter I)
```

| Pin | Use | Needed? |
|---|---|---|
| **A** | Ground | **Yes** |
| B | Diagnostic enable (jumper to A = diagnostic/"paperclip" mode; 10 kΩ to A = ALDL mode) | Optional |
| **E** | **160-baud serial data** (per the A058 spec: "read data on pin E") | **Yes** |
| G | Fuel pump test on many GM vehicles — **may carry 12 V** | Never connect |
| M | 8192-baud serial data (later ECMs) | Not used here |

Pin functions vary between vehicles and harnesses; the Howell harness follows the GM truck layout above. **Connect only A and E** unless you know what else is on your harness.

**Mode resistor:** the A058 spec sends the same 20-byte frame in open, 10k and shorted modes, and this Jeep streams data with A–B open (MW2 shows no diagnostic switch bits). So no resistor is needed for this ECM. Shorting A–B puts the ECM into diagnostic mode (flashes codes, fixed spark/IAC behaviour) — don't leave it shorted while logging.

## Building one

### Parts

- An FTDI FT232R USB-to-TTL adapter at **5 V logic**: e.g. FTDI's **TTL-232R-5V** cable, or an FT232RL breakout with its VCCIO jumper set to 5 V. (FT232R inputs are 5 V tolerant when VCCIO is 5 V.) Other bridges (CP2102, CH340) may work if the OS allows 1600 baud; the web app's device filter includes them, but they are untested.
- A GM 12-pin ALDL mating connector or two crimp pins (bare pins pushed into the cavities work for a bench lead).
- Optional, recommended: a **1–4.7 kΩ series resistor** on the data line to protect the ECM output and the FTDI input. *(Inferred good practice, not from a GM document.)*
- Optional: 10 kΩ resistor + switch between A and B for ECMs that need ALDL mode.

### Wiring

| FTDI side | ALDL pin |
|---|---|
| GND | **A** |
| RXD (via the optional series resistor) | **E** |
| TXD | not connected (160 baud is receive-only) |
| VCC / 5 V | **not connected** — the ECM powers its own line |

No inverter or level shifter. The ECM's data line idles high (≈5 V) and pulls low for each bit — the same idle polarity as a TTL UART, so the FTDI sees each ALDL bit's falling edge as a UART start bit. The bit inversion happens in software (`ALDLBitDecoder`).

Classic RS-232 interfaces (e.g. the Tech Edge two-transistor design) put an inverting transistor stage in front of a ±12 V serial port. Those output the opposite polarity and **will not work** with this project's decoder without inverting the sampled bit.

### Verify before plugging into the computer

1. Key on, engine off. Multimeter between **E** (+) and **A** (−): expect roughly 4–5 V, flickering slightly as data is sent. *(Expected from the spec; confirm on your vehicle.)*
2. Confirm **A** is ground: near 0 Ω to chassis.
3. Confirm nothing on the pins you are using reads 12 V.

## Signal and decoding

From the A058 spec and [Tech Edge's 160-baud write-up](https://www.techedge.com.au/vehicle/aldl160/160serial.htm):

- **160 bits/s, 6.25 ms per bit.** Every bit starts with a falling edge. A short low pulse is a **0**, a long low pulse is a **1**. Tech Edge's measured timings for two ECM families:

  | Section (µs) | VN | C3 |
  |---|---|---|
  | Start (low) | 500 | 351 |
  | Data | 4,750 | 1,557 |
  | Stop (high) | 1,000 | 4,381 |

- **Frame:** sync of 9 consecutive 1s, then 20 bytes, each sent as a 0 start bit plus 8 data bits, most significant bit first. About 1.19 s per frame.
- **Reading it:** open the port at **1600 baud, 8N1** (10× the bit rate). Each ALDL bit then produces exactly one UART byte; bit 3 of that byte samples the middle of the pulse. Bit 3 = 0 means the line was still low (long pulse → ALDL **1**); bit 3 = 1 means a 0. See `src/services/aldlBitDecoder.ts`.
- 1600 baud is non-standard. Chrome's Web Serial and Node `serialport` both set it fine on macOS with an FT232R.

## Using it

- **Browser:** <https://aldl.somefamilies.com> → Connect (Chrome or Edge, desktop).
- **Command line:** `npm run capture` (auto-detects FTDI/CP210x/CH340), `npm run analyze -- <log.json>`.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Device not listed | Not an FTDI/CP210x/CH340 bridge (tick "any device" in the web app or pass `--port`); USB cable is charge-only |
| Port opens, no frames | Wrong pin (E vs M), no ground on A, key off, or an inverting (RS-232 style) interface |
| Steady framing errors | Poor ground, long or noisy lead, or an ECM with different timings |
| Frames decode but values look wrong | Different data stream: this project decodes A058 only |
