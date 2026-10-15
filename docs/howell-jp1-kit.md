# Howell EFI JP-1 TBI Kit (Jeep 258 CID / 4.2L six)

Reference summary, kept in case Howell stops publishing the install guide. Summarized (not copied) from the OCR'd text of the original; consult the original where available.

| | |
|---|---|
| Source document | `Model-JP1-EFI-Kit-for-JEEP-258-CID-4.2-6-Cylinder.pdf` (14 pages, "Installation Manual, Model JP-1 EFI Kit for Jeep 258 CID (4.2) 6 Cylinder Engines (1972-1991)") |
| Product page | https://howellefi.com/product/tbi-kit-1987-91-yj-wrangler-4-2l-emissions-legal/ |
| Maker | Howell Engine Developments, Inc., 6201 Industrial Way, Marine City, MI 48039 |
| Phone / fax | 810-765-5100 / 810-765-1503 (phone support 8:30-18:00 Eastern, per the PDF) |
| Emissions status | CARB Executive Order D-452 (the JP-1 kit carries an E.O. tag and an under-hood decal) |

OCR caveats are marked **[OCR?]**. Inferences not stated in the source are marked **[inferred]**. The PDF's figures (vacuum schematic, Dura-Spark wiring diagram on p.12) did not survive text extraction; only their captions/labels are available.

## What the kit is

- A new GM 2-barrel throttle body from the 4.3L V6 (TBI, integral TPS and idle air control motor), fitted to the stock Jeep intake manifold through a supplied adaptor plate.
- Controlled by a GM ECM, inputs: coolant sensor, MAP, heated O2 sensor, TPS, plus a tach signal and vehicle speed.
- Based on GM 1986-91 4.3L V6 TBI hardware and electronics. Backup (limp-home) modes and on-vehicle diagnostics work like those model years.
- **No spark control.** The ECM does not control timing as it does on GM engines; it takes RPM from the Jeep's electronic ignition (Dura-Spark) via a tach lead.
- ECM is GM PN **1227747**, "used in most light duty truck TBI engines 1987-1991". Calibration PROM (Howell JP-1, matched to the 258) and a Cal-pack (L-6, limp-home) are inside it. This is the ECM and A058 ALDL stream decoded by this repo (see [A058.txt](A058.txt)).

### Parts list

| # | Part | Numbers given |
|---|---|---|
| 1 | Two-barrel TB unit with TPS and IAC | (E.O. tag on JP-1) |
| 2 | ECM | GM 1227747 |
| 3 | Howell wiring harness (CJ and Wrangler harnesses differ) | |
| 4 | Calibration PROM (in ECM) | |
| 5 | Cal-pack, L-6, limp-home (in ECM) | |
| 6 | MAP sensor | GM 16165793 |
| 7 | Coolant sensor | GM 25036979 |
| 8 | O2 sensor + 18 mm mounting bung | single-wire GM 25166816; JP-1 kit ships heated GM **25312184** |
| 9 | In-line high-pressure electric fuel pump | HED FP 257 |
| 10 | High-flow in-line fuel filter | Fram G3802A |
| 11 | Fuel line kit | |
| 12 | Fuel pump relay | GM 14089936 |
| 13 | Vehicle speed sensor (JP-1 only) | HED VSS263 |
| 14 | Small parts kit | |
| 15 | Service manual (basic troubleshooting) | |
| 16 | Under-hood vacuum diagram / E.O. label (JP-1 only) | |

Also supplied (mentioned in text): 2-barrel adaptor plate and gasket/cap screws, mechanical fuel pump block-off plate and gasket, ignition jumper wire, firewall grommet, 5/16" fuel hose, reducers, clamps, tie-wraps/mounts, Weatherpack connectors.

### Removed from the carbureted Jeep

Mechanical fuel pump (block-off plate fitted), THERMAC air cleaner, carburetor and all its vacuum/electrical connections (idle solenoid, 4 in. Hg beige vacuum switch, bowl vent to canister, stepper motor, WOT switch, electric choke heater, throttle return spring), the old fuel line/filter from pump to carb, vapor/fuel return line from the Jeep filter to the driver's-side metal return, and the following emission parts: upstream/downstream check valves and pulse-air/air pump + diverter valve, decel valve and bracket, 4 & 10 in. vacuum switch assembly, PCV solenoid, knock sensor, solenoid brackets, air cleaner stud bracket, throttle return spring bracket, block fuel line bracket. Original coolant temp switch, knock sensor and O2 sensor are removed; the knock sensor hole stays open. The Dual CTO valve is left in place.

Only two carb vacuum lines are reconnected: PCV/canister line and the thermal vacuum switch/distributor advance line.

To be emissions legal the Jeep must still have a working catalytic converter, EGR valve, charcoal canister and purge, PCV valve, and a vehicle speed sensor in the speedometer cable drive.

## Key specs

| Item | Value / rule |
|---|---|
| Fuel pump operating pressure | 12-15 psi "at all times" (pump spec) |
| Fuel pressure at TBI (check) | 11-12 psi, tee into the high-pressure line to measure |
| Fuel pressure too high | Above 12 psi at TBI is flagged as a rich-running cause |
| Bypass/return pressure | Should not exceed 5-6 psi; a restricted return causes flooding |
| Pump location | Inside frame rail above the transmission shield plate, or on the shield. Mount at or below mid-level of the fuel tank. Pump electrical terminals are on the outlet (high-pressure) end |
| Filter placement | Filter **before** the pump; high-pressure pumps seize easily and this is not warranted. Filter attaches to the rear main fuel line with ~12" of flexible hose; hose support is enough, no clamp |
| Pressure line | 5/16" from pump to the **driver's-side** fitting at the back of the TBI. Steel is allowed but join to the pump with a short rubber section (noise isolation). No high-pressure hose needed |
| Return line | 1/4" or 5/16" from right rear of the TBI along the left firewall to the old vapor-return line near the vapor/vent steel lines |
| Initial timing | **6-8 deg BTDC at idle with vacuum advance disconnected** (higher than OEM). The only adjustment on the kit |
| Idle speed / mixture | No adjustment, except the throttle-stop procedure below |
| MAP hose | Dedicated line from the TBI vacuum tap at the right rear to the MAP sensor only, **12" max**, nothing tee'd in. Sensor mounted vacuum nipple pointing down, level with or above the TBI base |
| O2 sensor | Heated (JP-1). 18 mm bung; 1981-91 manifolds should already have one. If not, bung in the pipe ~3" downstream of the manifold flange (7/8" hole). Any mounting angle. Extend the lead by splicing on the harness side, not the sensor side |
| Coolant sensor | 3/8" NPT hole on the left side of the engine (old temp switch hole, or the water-heated manifold hole). Use pipe sealant |
| Tach signal | White labeled wire to coil **negative** terminal |
| ECM power | Switched 12 V hot in both CRANK and RUN (not ACC). Within 1 V of battery (install check) and within 0.5 V while running (troubleshooting check). 14 or 16 ga from fuse block |
| ECM location | Needs air circulation; do not bury under carpet |
| Scanner entry | 1988 or 1989 GM light-duty truck; 4.3L V6, engine code **Z** |
| Alt. scanner VIN digits | 3rd digit **C**, 8th digit **Z**, 10th digit **J or K** [OCR?: stray space in "C ", J/K read as year codes 1988/1989, inferred] |
| Throttle linkage | Ball stud on throttle lever plate; integral torsion return spring, no separate spring. Check WOT, bend vertical linkage to clear EGR; later Jeeps may need the ball stud on the inboard side; link plate may need grinding or the power-brake fitting replaced for clearance |
| Install time | 6-12 hours (their estimate) |

### Air cleaner options named

GM 10" open element 12342081 / 12342082; K&N 9" 60-1120 / 60-1110; K&N 7" x 2" 60-1320, 7" x 3" 60-1330; Moroso 8-1/2" 66-310.

## Vacuum routing

Port letters are cast/lettered on the TBI. The Howell vacuum schematic (not extractable) legend distinguishes **ported** and **manifold** vacuum. The under-hood diagram is based on a 1990 Wrangler; earlier years vary slightly.

| TBI port | Goes to | Notes |
|---|---|---|
| **A** | Dual CTO valve | Per text: "CTO valve gets vacuum from port A" |
| **AD** | Distributor vacuum advance | Distributor line is tee'd into the line "from port AD to the CTO valve". **[OCR?]** The text mixes "A" and "AD"; they may be the same port or two ports. Not resolvable from text. The schematic shows the CTO routing |
| **C** | PCV line (3/8" port), full-time vacuum | Evap purge signal is tee'd into this PCV line |
| **FD** | MAP sensor only | Rear of TBI; no tees; 12" max. **[OCR?]** "FD" could be a misread of "PD"/"FP"; the rear/right-rear location matches the MAP tap |

Other connections:

- Purge signal from canister goes to the Dual CTO valve on the engine (tee'd into the PCV line from port C, see above).
- Fuel tank vent line to the canister is already in place. The canister's last vent (the old carburetor bowl vent) is **plugged or capped**. Canister sits under the washer bottle and has 4 vent tubes.
- EGR valve vacuum comes from the Dual CTO valve.
- Dual CTO valve is for CA-legal JP-1 kits; earlier Jeeps without one need OEM PN J3238932 (also Standard PN PVS61). Non-CA kits may use the stock CTO system or eliminate it, and some earlier non-emission setups may run better with **manifold** vacuum to the distributor advance.
- Everything else (transfer case vacuum switch, A/C controls, brake booster, etc.) connects directly to the intake manifold, not the TBI.
- Crankcase vent line from the rear of the rocker cover goes to the bottom of the air cleaner (filtered air).
- Intake manifold heater (late models): on below 160 F when running; keep it working. Its blue wire from the relay (right of the battery) needs switched 12 V, or run direct power through a switch.
- Allen-bolt heads on the adaptor: mound RTV on top of each bolt head (a 1/4"-3/8" mound **[OCR?]** "%"-3/8"") and let it set 4-24 h to avoid vacuum leaks.

## Wiring

### Engine side

1. **Grounds:** harness grounds go to an existing threaded hole toward the rear of the intake manifold.
2. **Starter solenoid:** labeled **orange** = battery power, lug on the battery-side stud of the solenoid (or positive post of the starter). Labeled **purple** = crank signal, lug on the opposite (starter) stud. Right fender well solenoid or starter.
3. **White** labeled wire: coil negative, for tach. Multiple-spark-discharge ignitions need a special tach filter (call Howell). Aftermarket ignitions (MSD, Mallory, Jacobs, etc.) may not trigger the built-in tach filter; call Howell if the engine won't start.
4. Two injector connectors on top of the TBI, plus TPS and IAC (4-pin) plugs. MAP and coolant sensor connectors as above.
5. A branch toward the passenger side of the firewall carries the **fuel pump relay and fuses** (battery power and pump power), mounted on the right side of the firewall. The pump lead breaks out here (power and ground) and goes to the frame-mounted pump through a two-pin Weatherpack.
6. **VSS** threads in series between the transfer case speedometer drive and the speedometer cable, plugs into the harness.

### Inside the vehicle

- Fuse block (the PDF calls it the "triple fuse block"), diagnostic (ALDL) connector under the dash or on the heater housing. SES (check engine) lamp: a 12 V bulb in a socket, in the dash.
- ECM fuse block fed with switched 12 V that is live in **crank and run**. If the SES lamp goes out during cranking, the supply is on an accessory terminal and the engine will not start.
- Mount the ECM in the OEM ECU location (computer-controlled-carb Jeeps) or in space above the heater ducts (older). 1972-80 need a 1-1/2" firewall hole with the supplied grommet.
- Full-voltage rule: compare voltage at the ECM fuse block with the battery. If more than 1 V low, fix it, or run a separate battery feed through an ignition-controlled relay or dash toggle. Low voltage causes hard starts and poor idle.

### Dura-Spark / computer-controlled-carb harness (models with feedback carb)

Non-computer-carb Jeeps are already wired directly from distributor to module and skip this part. For 1981-91 Dura-Spark Jeeps, the PDF has a wiring diagram on p.12 (image only, not in the text). Text notes:

- Remove the old carb computer and its harness; three wires stay on the engine harness plus manifold heater relay wiring: coolant temp sender (purple, left rear of valve cover), manifold heater (pink), manifold heater switch (light green-black).
- Locations are numbered on the back of the old computer connector (remove the black retainer clip). Wire **47** (light green-black, orange on some) is cut and spliced to **59** (orange) at/near the main harness junction. Wire **18** (purple) is cut and spliced to the supplied ignition-module jumper wire. Some models need a direct splice at the module connector (purple). Earlier Jeeps may lack the numbered connector, the same colors, or the Dura-Spark module connector.
- 1987-91 jumper: unplug the 2- and 4-pin connectors from the ignition module (under the coolant bottle), release the 4-pin lock, put the jumper in the open **"C"** position, relock, run the jumper to the junction and splice to 18. Reconnect.
- Keeping the old wire marked "A1" or "A57" (yellow) gives a switched 12 V source option. **[OCR?]** Text reads `Al" OR A57"`; "A1" inferred.
- Remaining wires from the old computer connector are cut and removed.

## Start-up and learning

1. Key on: pump runs 2-3 s then the ECM shuts it off until cranking. First prime may not fill the TBI and line; a few seconds of cranking completes it. Smooths out after a few seconds as air purges from the injectors. Check for fuel leaks and exhaust-heat contact; cooling system must be full.
2. If it won't start: loosen the high-pressure line at the TBI (rag around it) and cycle the key to push air out of the pump line.
3. SES lamp: on with key on, stays on while cranking, off once running. Lamp comes on whenever any backup mode is active.
4. **Learning:** in closed loop the ECM learns (BLM) a calibration to match the engine, adapting to weather, barometer and altitude, held in memory while the battery is connected and charged. **Disconnecting the battery erases it**; the ECM reverts to the stock Howell JP-1 program and starts relearning as soon as the vehicle is driven.
5. The JP-1 PROM assumes: EGR on ported vacuum through the Dual CTO valve, ported vacuum to the distributor, 6-8 deg BTDC initial timing, and a good catalytic converter.
6. Self-diagnosis: key on, jumper the ALDL (paper clip) and read SES flashes per any GM TBI service manual or Howell's manual. Scan tool settings above.

## Service notes

1. Fit the under-hood vacuum/E.O. decal (JP-1).
2. Otherwise follow Jeep OEM maintenance intervals.
3. Kit assumes a mechanically sound engine: no intake or exhaust manifold leaks.
4. No idle speed or air/fuel adjustments; only initial timing (6-8 BTDC, vacuum advance disconnected).
5. Aftermarket ignition: see tach filter note above.
6. Never remove the cal PROM with the harness connected (battery power is always present on the connectors). PROM swap: remove ECM, unplug connectors one at a time, take off cover (2 screws), pull the larger of the two PROMs straight up, fit the new one (keyed), reassemble. The smaller removable chip is the Cal-pack.
7. The CARB/EPA exemption means no component modification or ECM reprogramming without Howell/CARB consent.

## Troubleshooting (symptom, then checks in the order given)

### Engine cranks but won't fire or start

1. **Spark while cranking:** inductive timing light, or a plug on a plug wire grounded to the engine. No spark: fix ignition first.
2. **SES lamp at key on:** if dark, harness is not powered or grounded; check grounds, fuses, power. Powered correctly: lamp on and pump runs 3 s.
3. **Lamp during cranking:** if it goes out, ECM is on an accessory terminal; move to a true ignition source.
4. **Pump during cranking:** have someone listen or look underneath. No pump means no tach reference (check the white lead on coil negative; aftermarket ignition note). Pump on: continue.
5. **Injector spray during cranking** (air cleaner off): none means the pump may be unprimed. Loosen the driver's-side high-pressure line, rag, key on until fuel comes out, retighten, retry. Weak spray: tee in a gauge, expect 11-12 psi. No fuel at all: suspect low voltage; measure fuse block to ground while cranking vs battery terminals while cranking, should be within 1 V. If not, temporarily run a hot wire from the battery to the ECM fuse block and see if it starts; if so, fix the supply.
6. **Too much fuel / flooding:** hold the throttle fully open and crank ("clear flood" mode; injectors should stop spraying). Cause can be a restricted or plugged bypass return line. Test: hose from the TBI return outlet into a 5-gallon can; if it then runs right, fix the restriction. Return pressure should not exceed 5-6 psi.

### Engine starts but idles poorly or dies

1. **System voltage at the ECM fuse block** must be within 0.5 V of battery while running. Suspect firewall pass-through connections or thin wire; temporarily run a 14 ga bypass wire from the battery to the fuse block. If better, feed the ECM fuses from the battery through an ignition-controlled relay.
2. **Rich / black smoke at idle and low speed:** check for excess return pressure putting TBI fuel pressure above 12 psi.
3. **Decel off-idle stall, idle drop, or low rolling idle:** use the Idle Air Adjustment below.

If none of this resolves it, contact Howell (phone above; PDF gives an e-mail of the form `mhowell@howell-efi.com` **[OCR?]** OCR read "mhovveIl@howell-efi.com", spelling inferred).

## Idle air adjustment (throttle stop screw)

Prep: grind the throttle stop screw plug flat and drill into it so a **T-20 Torx** driver can reach the screw.

1. Jumper terminals **A and B** of the ALDL connector.
2. Key on, engine off.
3. Unplug the 4-pin idle air control (IAC) connector at the TBI.
4. Remove the ALDL jumper.
5. Start the engine.
6. While idling, turn the throttle stop screw to raise base idle RPM as desired. (No target RPM is given in the source.)
7. Engine off.
8. Reconnect the IAC connector. Done.

## Warranty / returns (one line)

30-day return (unused, prepaid, less shipping), 90-day defect warranty, 15% restocking on used returns in good condition, 25% on unusable or needing repair; terms as printed in the original PDF.

## This vehicle

1988 Jeep YJ. Notes from diagnosis on 2026-10-14:

- Hunting idle traced to poor injector atomization: both injectors spit droplets rather than a fine spray, driver side worse. No leak-down drips after shutoff.
- Fuel pressure test pending (spec above: 11-12 psi at the TBI, return not over 5-6 psi).
- Initial timing measured at about 12 deg, method unknown (vacuum advance state not recorded), against the 6-8 deg BTDC spec with vacuum advance disconnected. Needs a recheck with the advance disconnected.
- Related context: [A058.txt](A058.txt) for the ALDL data stream decoded by this repo.
