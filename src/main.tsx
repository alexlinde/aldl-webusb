import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ALDLProcessor } from './services/aldlProcessor'
import { SerialInterface } from './services/serialInterface'
import { DataService } from './services/dataService'

/**
 * The services live at module scope, not in component state: they own a serial
 * port and a playback timer, so there must be exactly one of each for the life
 * of the page. StrictMode's double render is then a non-issue.
 */
const processor = new ALDLProcessor()
const dataService = new DataService(processor, new SerialInterface())

const container = document.getElementById('root')
if (!container) throw new Error('No #root element to mount into.')

createRoot(container).render(
  <StrictMode>
    <App processor={processor} dataService={dataService} />
  </StrictMode>,
)
