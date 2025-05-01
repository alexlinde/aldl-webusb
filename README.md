# ALDL WebUSB Interface

A modern web interface for reading GM's [Assembly Line Diagnostic Link](https://en.wikipedia.org/wiki/ALDL) 160 baud interface. This tool is designed to work with an FTDI FT232R-based ALDL cable (like those from [aldlcable.com](http://aldlcable.com/)).

I bought a [Howell TBI kit](https://howellefi.com/product/tbi-kit-1981-86-cj-4-2l-emissions-legal/) for my 88 Jeep YJ which included a GM 1227747 ECU. This pre-dates OBD2 and includes an ALDL 12-pin interface that transmits serial-ish data at 160 baud. While you can read the MALF codes with a paperclip, I wanted to be able to see and plot the data from the sensors to diagnose the issue and check everything was running smoothly, 

If you're in the same situation, visit https://alexlinde.github.io/aldl-webusb/ to use the tool live. There's a [test log file](https://github.com/alexlinde/aldl-webusb/raw/refs/heads/main/test/aldl_log_20250430_193619.json) if you want to simulate it running. 

## Features

- Direct connection to ALDL interface using WebUSB from a browser
- Real-time display of engine sensor data and diagnostic codes
- Support for GM 160 baud ALDL protocol (Mode A058, for the Howell / GM 1227747 ECU)
- Test data playback mode for development - you can log using [aldl-logger](https://github.com/alexlinde/aldl-logger)
- RPM / MAP (kPA) grid for O2, INT and BLM
- Dark/light theme support :)

### Prerequisites

- Modern web browser with WebUSB Serial support (Chrome, Edge, etc.)
- Compatible ALDL to USB interface hardware (tested with FTDI FT232R)
- GM vehicle with 160 baud ALDL diagnostic port
