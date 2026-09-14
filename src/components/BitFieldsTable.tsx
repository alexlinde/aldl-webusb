import { FC, useMemo } from 'react'
import { BitField, Signal } from '../types/aldl'

interface BitFieldsTableProps {
  /** Signals of the frame selected in the main table. */
  signals: Signal[]
  visiblePids: ReadonlySet<string>
  onTogglePid: (pidName: string) => void
  /** False before the first frame, so "no codes" is not claimed too early. */
  hasData: boolean
}

function renderRows(bits: BitField[]) {
  return bits.map((bit) => (
    <tr key={`${bit.pidName}-${bit.bitName}`}>
      <td>{bit.pidName}</td>
      <td>{bit.bitName}</td>
      <td title={bit.description}>{bit.value ? '1' : '0'}</td>
    </tr>
  ))
}

const BitFieldsTable: FC<BitFieldsTableProps> = ({
  signals,
  visiblePids,
  onTogglePid,
  hasData,
}) => {
  const bitFields = useMemo(
    () => signals.flatMap((signal) => signal.bitFields ?? []),
    [signals],
  )

  const malfBits = useMemo(
    () => bitFields.filter((bit) => bit.type === 'MALF' && bit.value),
    [bitFields],
  )

  const togglePids = useMemo(() => {
    const names: string[] = []
    for (const bit of bitFields) {
      if (bit.type !== 'MALF' && !names.includes(bit.pidName)) {
        names.push(bit.pidName)
      }
    }
    return names
  }, [bitFields])

  const visibleBits = useMemo(
    () =>
      bitFields.filter(
        (bit) => bit.type !== 'MALF' && visiblePids.has(bit.pidName),
      ),
    [bitFields, visiblePids],
  )

  return (
    <div className="bit-fields-container">
      <div className="pid-toggle-buttons">
        {togglePids.map((pidName) => (
          <button
            type="button"
            key={pidName}
            className={visiblePids.has(pidName) ? 'active' : ''}
            onClick={() => onTogglePid(pidName)}
          >
            {pidName}
          </button>
        ))}
      </div>
      <table className="bit-fields-table">
        <thead>
          <tr>
            <th>PID</th>
            <th>Bit</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>{renderRows(visibleBits)}</tbody>
      </table>
      {malfBits.length > 0 && (
        <>
          <h3>Malfunction Indicators</h3>
          <table className="bit-fields-table">
            <thead>
              <tr>
                <th>PID</th>
                <th>Bit</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>{renderRows(malfBits)}</tbody>
          </table>
        </>
      )}
      {malfBits.length === 0 && hasData && (
        <p className="no-malfunctions">No malfunction codes</p>
      )}
    </div>
  )
}

export default BitFieldsTable
