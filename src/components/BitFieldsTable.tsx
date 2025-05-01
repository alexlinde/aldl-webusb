import { FC, useState, useEffect } from 'react'
import { Signal, BitField } from '../types/aldl'

interface BitFieldsTableProps {
  signals: Signal[]
  visiblePids: Set<string>
  onTogglePid: (pidName: string) => void
}

const BitFieldsTable: FC<BitFieldsTableProps> = ({ 
  signals, 
  visiblePids, 
  onTogglePid,
}) => {
  const [bitFields, setBitFields] = useState<BitField[]>([])

  useEffect(() => {
    // Collect all bit fields from signals
    const allBitFields = signals
      .filter(signal => signal.bitFields)
      .flatMap(signal => signal.bitFields!)
    setBitFields(allBitFields)
  }, [signals])

  const malBits = bitFields.filter(bit => bit.type === 'MALF' && bit.value)
  const nonMalBits = bitFields.filter(bit => bit.type !== 'MALF')

  const renderValueCell = (bit: BitField) => {
    const value = bit.value ? '1' : '0'
    return bit.description ? (
      <td title={bit.description}>{value}</td>
    ) : (
      <td>{value}</td>
    )
  }

  return (
    <div className="bit-fields-container">
      <div className="pid-toggle-buttons">
        {Array.from(new Set(bitFields.map(bit => bit.pidName)))
          .filter(pidName => bitFields.some(bit => bit.pidName === pidName && bit.type !== 'MALF'))
          .map(pidName => (
            <button
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
        <tbody>
          {nonMalBits
            .filter(bit => visiblePids.has(bit.pidName))
            .map((bit, index) => (
              <tr key={`${bit.pidName}-${bit.bitName}-${index}`}>
                <td>{bit.pidName}</td>
                <td>{bit.bitName}</td>
                {renderValueCell(bit)}
              </tr>
            ))}
        </tbody>
      </table>
      {malBits.length > 0 && (
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
            <tbody>
              {malBits.map((bit, index) => (
                <tr key={`${bit.pidName}-${bit.bitName}-${index}`}>
                  <td>{bit.pidName}</td>
                  <td>{bit.bitName}</td>
                  {renderValueCell(bit)}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

export default BitFieldsTable 