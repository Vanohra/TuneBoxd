import { useState } from 'react';

/**
 * Small single-series column chart (one hue: the accent). Bars are anchored to
 * the baseline with rounded tops; hovering or focusing a bar shows its exact
 * value. The highest bar is labeled directly, and "Show table" gives the same
 * numbers as a table (so nothing depends on seeing the bars).
 *
 * data: [{ label, fullLabel?, value }]; units: [singular, plural]
 */
export default function BarChart({ data, title, units = ['entry', 'entries'] }) {
  const [showTable, setShowTable] = useState(false);
  const max = Math.max(1, ...data.map((d) => d.value));
  const peakIndex = data.findIndex((d) => d.value === max && d.value > 0);
  const describe = (d) => `${d.fullLabel ?? d.label}: ${d.value} ${units[d.value === 1 ? 0 : 1]}`;

  return (
    <figure className="bar-chart">
      <figcaption className="bar-chart-header">
        <span className="bar-chart-title">{title}</span>
        <button type="button" className="link-button small" onClick={() => setShowTable((open) => !open)} aria-expanded={showTable}>
          {showTable ? 'Show chart' : 'Show table'}
        </button>
      </figcaption>
      {showTable ? (
        <table className="chart-table">
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col" className="numeric">
                {units[1][0].toUpperCase() + units[1].slice(1)}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <td>{d.fullLabel ?? d.label}</td>
                <td className="numeric">{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="bar-chart-plot" role="list" aria-label={title}>
          {data.map((d, index) => (
            <div key={d.label} className="bar-slot" role="listitem" tabIndex={0} aria-label={describe(d)}>
              <span className="bar-tooltip" aria-hidden="true">
                {describe(d)}
              </span>
              <span className="bar-track">
                <span className={`bar${d.value === 0 ? ' is-zero' : ''}`} style={{ height: `${(d.value / max) * 100}%` }}>
                  {index === peakIndex && <span className="bar-value">{d.value}</span>}
                </span>
              </span>
              <span className="bar-label" aria-hidden="true">
                {d.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </figure>
  );
}
