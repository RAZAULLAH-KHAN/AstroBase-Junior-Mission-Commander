/** AstroBase Component: SettingsModal — Audio, theme, speed, and mission reset preferences. */
import { useGameStore } from '../../store/gameStore';
import { Button } from './Button';
import { Modal } from './Modal';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onRestartTutorial: () => void;
  onAbandon: () => void;
  seed: string;
}

function Toggle({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg bg-panel-2/60 p-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted">{help}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 accent-[rgb(var(--accent))]"
      />
    </label>
  );
}

export function SettingsModal({ open, onClose, onRestartTutorial, onAbandon, seed }: SettingsModalProps) {
  const settings = useGameStore((s) => s.settings);
  const update = useGameStore((s) => s.updateSettings);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Settings"
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="space-y-2">
        <Toggle
          label="Large text"
          help="Makes all text bigger."
          checked={settings.largeText}
          onChange={(v) => update({ largeText: v })}
        />
        <Toggle
          label="Alert sound"
          help="Plays a short tone when a critical alert appears. Off by default."
          checked={!settings.muted}
          onChange={(v) => update({ muted: !v })}
        />
      </div>
      <div className="mt-4 rounded-lg bg-panel-2/60 p-3 text-sm">
        <div className="text-muted">Mission code</div>
        <div className="num text-base">{seed}</div>
        <p className="mt-1 text-xs text-muted">Share this code so others can play the same mission.</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={onRestartTutorial}>Replay tutorial</Button>
        <Button variant="danger" onClick={onAbandon}>
          Abandon mission
        </Button>
      </div>
    </Modal>
  );
}
