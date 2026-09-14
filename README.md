# ALDL WebUSB Interface

A modern web interface for reading GM's [Assembly Line Diagnostic Link](https://en.wikipedia.org/wiki/ALDL) 160 baud interface, using the [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API) right from the browser. This tool is designed to work with an FTDI FT232R-based ALDL cable (like those from [aldlcable.com](http://aldlcable.com/)).

I bought a [Howell TBI kit](https://howellefi.com/product/tbi-kit-1981-86-cj-4-2l-emissions-legal/) for my 88 Jeep YJ which included a GM 1227747 ECU. This pre-dates OBD2 and includes an ALDL 12-pin interface that transmits serial-ish data at 160 baud. While you can read the MALF codes with a paperclip, I wanted to be able to see and plot the data from the sensors to diagnose the issue and check everything was running smoothly.

Visit **https://aldl.somefamilies.com** to use the tool live.

## Features

- Direct connection to an ALDL interface from the browser using the Web Serial API
- Real-time display of engine sensor data and diagnostic codes
- Support for the GM 160 baud ALDL protocol (Mode A058, for the Howell / GM 1227747 ECU)
- Download a log of a live session, in the same JSON format used by [aldl-logger](https://github.com/alexlinde/aldl-logger)
- Playback of logged JSON sessions at real speed, 5x, or max speed, with step and rewind controls
- RPM / MAP (kPa) grids for O2, INT and BLM, with the current cell highlighted live
- MALF diagnostic code table
- Dark/light theme support :)

## Requirements

- A desktop browser with Web Serial API support (Chrome or Edge — Firefox and Safari are not supported)
- An FTDI-based ALDL cable, such as those from [aldlcable.com](http://aldlcable.com/)
- A GM vehicle with a 160 baud ALDL diagnostic port — data is read on pin E of the ALDL connector, per the [A058 spec](docs/A058.txt)

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

## Deployment

The app is a static Vite build, deployed on [Vercel](https://vercel.com/). Once the repo is linked, pushes to `main` auto-deploy. To deploy manually:

```bash
npx vercel
```
