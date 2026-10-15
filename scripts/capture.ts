import { closeSync, existsSync, fsyncSync, openSync, readFileSync, statSync, unlinkSync, writeSync } from 'node:fs'
import { SerialPort } from 'serialport'
import { ALDLBitDecoder } from '../src/services/aldlBitDecoder'
import { ALDLProcessor } from '../src/services/aldlProcessor'
import {
  CAPTURE_BAUD,
  LineSplitter,
  LogFileFormat,
  NoteQueue,
  logFilename,
  pickPort,
  serializeEntry,
} from '../src/services/captureCore'
import { decodeRow, formatRows } from '../src/services/logAnalysis'

const USAGE =
  'Usage: npm run capture -- [--port /dev/tty.usbserial-XXXX] [--out file.json] [--notes FILE] [--quiet]'

function fail(message: string): never {
  console.error(`error: ${message}`)
  process.exit(1)
}

function parseArgs(args: string[]) {
  const opts: { port?: string; out?: string; notes?: string; quiet: boolean } = { quiet: false }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--help') fail(USAGE)
    else if (a === '--quiet') opts.quiet = true
    else if (a === '--port' || a === '--out' || a === '--notes') {
      const v = args[++i]
      if (!v) fail(`${a} needs a value.\n${USAGE}`)
      opts[a.slice(2) as 'port' | 'out' | 'notes'] = v
    } else fail(`unknown option ${a}\n${USAGE}`)
  }
  return opts
}

const HEADER_EVERY = 20

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2))

  let path = opts.port
  if (!path) {
    const picked = pickPort(await SerialPort.list())
    if (!picked.ok) fail(picked.message)
    path = picked.path
  }

  const outPath = opts.out ?? logFilename(new Date())
  const fd = openSync(outPath, 'w')
  const format = new LogFileFormat()
  const write = (text: string) => {
    writeSync(fd, text)
    fsyncSync(fd)
  }
  write(format.start())

  const notes = new NoteQueue()
  const addNote = (text: string) => {
    const t = notes.add(text)
    if (t) console.error(`marked: ${t}`)
  }

  const processor = new ALDLProcessor()
  let frames = 0
  let startT: number | undefined
  let lastErrors = 0
  let closed = false

  const decoder = new ALDLBitDecoder((frame) => {
    const now = new Date()
    const note = notes.take()
    write(format.append(serializeEntry(frame, now, note)))
    frames++
    if (!opts.quiet) {
      const row = decodeRow({
        timestamp: now.getTime(),
        raw: frame,
        signals: processor.processFrame(frame),
        note,
      })
      startT ??= row.t
      const lines = formatRows([row], { startT }).split('\n')
      if ((frames - 1) % HEADER_EVERY === 0) console.log(lines[0])
      console.log(lines[1])
    }
    if (decoder.framingErrors !== lastErrors) {
      lastErrors = decoder.framingErrors
      console.error(`framing errors: ${lastErrors}`)
    }
  })

  const port = new SerialPort({ path, baudRate: CAPTURE_BAUD, dataBits: 8, stopBits: 1, parity: 'none', autoOpen: false })

  let poll: NodeJS.Timeout | undefined
  const finish = (code: number, reason?: string) => {
    if (closed) return
    closed = true
    if (poll) clearInterval(poll)
    if (reason) console.error(reason)
    try {
      write(format.end())
      closeSync(fd)
    } catch (error) {
      console.error(`error closing ${outPath}: ${error instanceof Error ? error.message : error}`)
      code = 1
    }
    console.error(`Wrote ${frames} frames to ${outPath}`)
    const done = () => process.exit(code)
    if (port.isOpen) port.close(done)
    else done()
  }

  port.on('data', (buf: Buffer) => {
    for (const b of buf) decoder.pushUartByte(b)
  })
  port.on('error', (error) => finish(1, `serial error: ${error.message}`))
  port.on('close', () => finish(0, 'Port closed.'))
  process.on('SIGINT', () => finish(0, '\nStopping.'))
  process.on('SIGTERM', () => finish(0, 'Stopping.'))

  port.open((error) => {
    if (error) {
      closed = true
      closeSync(fd)
      unlinkSync(outPath)
      fail(`could not open ${path} at ${CAPTURE_BAUD} baud: ${error.message}`)
    }
    console.error(`Capturing from ${path} at ${CAPTURE_BAUD} baud to ${outPath}. Ctrl+C to stop; type a line to mark.`)
  })

  const stdinLines = new LineSplitter()
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (chunk: string) => stdinLines.push(chunk).forEach(addNote))
  process.stdin.on('error', () => {})

  if (opts.notes) {
    const file = opts.notes
    // Only lines appended after capture starts count as notes.
    let offset = existsSync(file) ? statSync(file).size : 0
    const fileLines = new LineSplitter()
    poll = setInterval(() => {
      if (!existsSync(file)) return
      const size = statSync(file).size
      if (size < offset) offset = 0
      if (size === offset) return
      const text = readFileSync(file).subarray(offset, size).toString('utf8')
      offset = size
      fileLines.push(text).forEach(addNote)
    }, 500)
  }
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
