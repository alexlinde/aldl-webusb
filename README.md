# ALDL WebUSB Interface

A modern web interface for reading GM's [Assembly Line Diagnostic Link](https://en.wikipedia.org/wiki/ALDL) 160 baud interface, using the [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API) right from the browser. This tool is designed to work with an FTDI FT232R-based ALDL cable (like those from [aldlcables.com](https://aldlcables.com/collections/aldl-obd1-cables)).

I bought a [Howell TBI kit](https://howellefi.com/product/tbi-kit-1981-86-cj-4-2l-emissions-legal/) for my 88 Jeep YJ which included a GM 1227747 ECU. This pre-dates OBD2 and includes an ALDL 12-pin interface that transmits serial-ish data at 160 baud. While you can read the MALF codes with a paperclip, I wanted to be able to see and plot the data from the sensors to diagnose the issue and check everything was running smoothly.

Visit **https://aldl.somefamilies.com** to use the tool live.

## Features

- Direct connection to an ALDL interface from the browser using the Web Serial API
- Real-time display of engine sensor data and diagnostic codes
- Support for the GM 160 baud ALDL protocol (Mode A058, for the Howell / GM 1227747 ECU)
- Download a log of a live session, in the same JSON format that `npm run capture` writes
- Playback of logged JSON sessions at real speed, 5x, or max speed, with step and rewind controls
- RPM / MAP (kPa) grids for O2, INT and BLM, with the current cell highlighted live
- MALF diagnostic code table
- Dark/light theme support :)

## Requirements

- A desktop browser with Web Serial API support (Chrome or Edge — Firefox and Safari are not supported)
- An FTDI-based ALDL cable, such as those from [aldlcables.com](https://aldlcables.com/collections/aldl-obd1-cables) — or build one: see [docs/aldl-cable.md](docs/aldl-cable.md)
- A GM vehicle with a 160 baud ALDL diagnostic port — data is read on pin E of the ALDL connector, per the [A058 spec](docs/A058.txt)

## Reference docs

- [docs/aldl-cable.md](docs/aldl-cable.md): buying or building the 160-baud USB cable (pinout, wiring, signal)
- [docs/howell-jp1-kit.md](docs/howell-jp1-kit.md): Howell JP-1 TBI kit specs, vacuum routing, wiring and troubleshooting, summarized from Howell's install guide
- [docs/A058.txt](docs/A058.txt): GM A058 data stream specification

## How it works

GM's 160 baud ALDL protocol isn't a standard UART baud rate — each "bit" is actually a pulse whose width encodes its value, so it can't be read directly as serial data. The trick is to open the port at **1600 baud, 8N1** (10x the nominal rate): that yields one UART byte per ALDL bit, and bit 3 of that byte lands squarely in the middle of the pulse, sampling it at the right moment to decode a 0 or 1. The stream starts with 9+ sync ones, followed by 20 data bytes, each preceded by its own 0 start bit.

## Test data

There's a [test log file](https://github.com/alexlinde/aldl-webusb/raw/refs/heads/main/test/aldl_log_20250430_193619.json) if you want to try playback without a live connection.

## Development

```bash
npm ci
npm run dev     # start the dev server
npm test        # run tests
npm run lint    # lint
npm run build   # production build
```

## Diagnostics tooling

- **Markers:** the "Mark" control in the UI attaches a short note (e.g. "A/C on", "warm idle") to the latest frame. Notes are saved in downloaded logs as an optional `note` field.
- **`window.aldl`:** the page exposes a console / automation API that returns plain strings or JSON: `help()`, `status()`, `recent(n)`, `summary(seconds)`, `segments()`, `mark(text)`, `codes()`, `csv()`, `log()`. Try `aldl.help()` in the browser console.
- **`npm run analyze`:** decode and summarize a downloaded log from the command line, using the same decoder as the UI:

```bash
npm run analyze -- <log.json> [--rows] [--csv out.csv] [--from SEC] [--to SEC] [--segments]
```

It prints overall stats (idle RPM / IAC / MAP, a hunting indicator, closed-loop %, O2 crossing rate, MALF codes), plus a summary per marker segment when the log has notes. `--rows` prints the decoded frame table, `--from` / `--to` slice by seconds from the start, and `--csv` writes the decoded rows.

- **`npm run capture`:** log straight from the ALDL cable to a file with no browser, using the same decoder as the UI. This replaces the standalone Python [aldl-logger](https://github.com/alexlinde/aldl-logger) project, which is now superseded. The output uses the same JSON format as the web app's downloads, so it loads in the app and in `npm run analyze`.

```bash
npm run capture -- [--port /dev/tty.usbserial-XXXX] [--out file.json] [--notes FILE] [--quiet]
```

Without `--port` it auto-picks the single FTDI / CP210x / CH340 cable (and lists ports if there are none or several). The log is `aldl_log_YYYYMMDD_HHMMSS.json` in the current directory unless `--out` is given; it is flushed after every frame and closed on Ctrl+C or unplug. Each frame is printed as a decoded line unless `--quiet`. Any line typed in the terminal becomes a `note` on the next frame; with `--notes FILE`, lines appended to that file do the same, so another process can mark events while capture runs in the background:

```bash
echo "unplugged IAC" >> notes.txt
```

## Deployment

The app is a static Vite build, deployed on [Vercel](https://vercel.com/). Once the repo is linked, pushes to `main` auto-deploy. To deploy manually:

```bash
npx vercel
```
