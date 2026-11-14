import { useNavigate } from 'react-router-dom';
import { eventDef, type GameState } from '../../engine';
import { Button } from './Button';
import { Modal } from './Modal';

interface EventModalProps {
  game: GameState;
  eventKey: string;
  onClose: () => void;
}

/** Shown at the start of a day when an event is forecast or has begun. */
export function EventModal({ game, eventKey, onClose }: EventModalProps) {
  const navigate = useNavigate();
  const event = game.scheduledEvents.find((e) => e.key === eventKey);
  if (!event) return null;
  const def = eventDef(event.defId);
  const dayLabel = game.config.location === 'mars' ? 'sol' : 'day';
  const inDays = event.startDay - game.day;
  const forecast = inDays > 0;
  const endDay = event.startDay + event.durationDays - 1;
  const when = forecast
    ? `Expected ${inDays === 1 ? `tomorrow (${dayLabel} ${event.startDay})` : `in ${inDays} ${dayLabel}s (${dayLabel} ${event.startDay})`}`
    : event.durationDays > 1
      ? `In progress until the end of ${dayLabel} ${endDay}`
      : `Happening ${event.startDay === game.day ? 'today' : 'now'}`;
  const tau = event.params.tau;

  return (
    <Modal
      open
      onClose={onClose}
      tone={def.kind === 'resupply' ? 'default' : 'warn'}
      eyebrow={forecast ? 'Forecast' : 'Event'}
      title={`${def.name}${tau ? ` (τ ≈ ${tau.toFixed(1)})` : ''}`}
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              onClose();
              navigate(`/library#${def.text.libraryKey}`);
            }}
          >
            Learn more
          </Button>
          <Button variant="primary" onClick={onClose}>
            Got it
          </Button>
        </>
      }
    >
      <p className="text-sm font-medium text-warn">{when}</p>
      <p className="mt-2">{forecast ? def.text.forecast : def.text.start}</p>
      <p className="mt-2 text-muted">{def.text.effect}</p>
      <div className="mt-4 rounded-lg bg-panel-2/60 p-3 text-sm">
        <div className="panel-title mb-1">What engineers do</div>
        {def.text.engineers}
      </div>
      <p className="mt-3 text-xs text-muted">Teaches: {def.teaches}</p>
    </Modal>
  );
}
