/** AstroBase Component: DailyReportModal — Daily end-of-sol debrief, resource deltas & cause chains. */
import { useState } from 'react';
import copy from '../../content/i18n/en.json';
import { OBJECTIVES, type DayReport, type GameState } from '../../engine';
import { cx, fmtSigned, fmtValue } from '../format';
import { Button } from './Button';
import { Modal } from './Modal';
import { objectiveName } from '../objectives';
import { WhyChain } from './WhyChain';

interface DailyReportModalProps {
  open: boolean;
  report: DayReport;
  game: GameState;
  onClose: () => void;
  onDebrief: () => void;
  tutorialActive: boolean;
}

export function DailyReportModal({
  open,
  report,
  game,
  onClose,
  onDebrief,
  tutorialActive,
}: DailyReportModalProps) {
  const [whyOpen, setWhyOpen] = useState(false);
  const dayLabel = game.config.location === 'mars' ? 'Sol' : 'Day';
  const finished = report.outcome !== null;
  const tutorial = copy.tutorial[4];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      eyebrow={`${dayLabel} ${String(report.day).padStart(2, '0')} report`}
      title={<span aria-live="assertive">{report.headline}</span>}
      tone={report.outcome?.result === 'failure' ? 'danger' : report.shed.length > 0 ? 'warn' : 'default'}
      footer={
        finished ? (
          <Button variant="primary" onClick={onDebrief}>
            View mission debrief
          </Button>
        ) : (
          <Button variant="primary" onClick={onClose}>
            Next {dayLabel.toLowerCase()}
          </Button>
        )
      }
    >
      {report.objectivesCompleted.length > 0 && (
        <div className="mb-4 rounded-lg border border-ok/50 bg-ok/10 p-3 text-sm">
          {report.objectivesCompleted.map((id) => (
            <div key={id}>
              Objective complete: <strong>{objectiveName(game, id).name}</strong> (+
              {OBJECTIVES.find((o) => o.id === id)?.rewardSP} SP)
            </div>
          ))}
        </div>
      )}

      <h3 className="panel-title mb-2">Changes</h3>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-panel-2 text-left text-xs text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Resource
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Before
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                After
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Change
              </th>
            </tr>
          </thead>
          <tbody>
            {report.deltas.map((d) => {
              const delta = d.after - d.before;
              const decimals =
                d.unit === 'kcal' || d.unit === 'BP' || d.unit === 'SP' || d.unit === '' ? 0 : 1;
              const worse = d.key === 'avgDose' ? delta > 0.05 : delta < -0.05;
              const better = d.key === 'avgDose' ? false : delta > 0.05;
              return (
                <tr key={d.key} className="border-t border-border">
                  <th scope="row" className="px-3 py-1.5 text-left font-normal">
                    {d.label}
                  </th>
                  <td className="num px-3 py-1.5 text-right text-muted">
                    {fmtValue(d.before, d.unit)} {d.unit}
                  </td>
                  <td className="num px-3 py-1.5 text-right">
                    {fmtValue(d.after, d.unit)} {d.unit}
                  </td>
                  <td
                    className={cx('num px-3 py-1.5 text-right', worse && 'text-danger', better && 'text-ok')}
                  >
                    {fmtSigned(delta, decimals)}
                    <span className="sr-only">{worse ? ' (worse)' : better ? ' (better)' : ''}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4" data-tutorial="why">
        <Button
          variant="secondary"
          onClick={() => setWhyOpen((v) => !v)}
          aria-expanded={whyOpen}
          className="w-full justify-between"
        >
          <span>Why did this happen?</span>
          <span aria-hidden="true">{whyOpen ? '−' : '+'}</span>
        </Button>
        {tutorialActive && !whyOpen && (
          <div className="mt-2 rounded-lg border border-info bg-info/10 p-3 text-sm" role="note">
            <strong className="block">{tutorial.title}</strong>
            {tutorial.text}
          </div>
        )}
        {whyOpen && (
          <div className="mt-3">
            <WhyChain chains={report.chains} />
          </div>
        )}
      </div>

      {report.tips.length > 0 && (
        <div className="mt-4 space-y-2">
          <h3 className="panel-title">Tips</h3>
          {report.tips.map((tip) => (
            <p key={tip} className="rounded-lg border-l-4 border-info bg-panel-2/60 p-3 text-sm">
              {tip}
            </p>
          ))}
        </div>
      )}

      {report.crewQuote && (
        <figure className="mt-4 rounded-lg bg-panel-2/60 p-3 text-sm">
          <blockquote>“{report.crewQuote.text}”</blockquote>
          <figcaption className="mt-1 text-xs text-muted">
            {copy.roles[report.crewQuote.role]} {report.crewQuote.name}
          </figcaption>
        </figure>
      )}
    </Modal>
  );
}
