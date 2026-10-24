import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import copy from '../../content/i18n/en.json';
import type { ModuleId } from '../../engine';
import { useGameStore } from '../../store/gameStore';
import { useMission, type MissionView } from '../../store/selectors';
import { ActionBar } from '../components/ActionBar';
import { AlertList } from '../components/AlertList';
import { BaseView } from '../components/BaseView';
import { BuildModal } from '../components/BuildModal';
import { Button } from '../components/Button';
import { CrewPanel } from '../components/CrewPanel';
import { DailyReportModal } from '../components/DailyReportModal';
import { EventModal } from '../components/EventModal';
import { LazyHistoryChart as HistoryChart } from '../components/LazyHistoryChart';
import { MissionHeader } from '../components/MissionHeader';
import { Modal } from '../components/Modal';
import { ObjectivesPanel } from '../components/ObjectivesPanel';
import { PowerPanel } from '../components/PowerPanel';
import { ResourcePanel } from '../components/ResourcePanel';
import { SettingsModal } from '../components/SettingsModal';
import { TutorialOverlay } from '../components/TutorialOverlay';
import { cx } from '../format';
import { playAlertTone } from '../hooks/alertTone';
import { useMediaQuery } from '../hooks/useMediaQuery';

type Tab = 'base' | 'power' | 'crew';

const TUTORIAL_TABS: Record<number, Tab> = { 1: 'power', 2: 'power' };
const TARGET_TABS: Record<string, Tab> = {
  'power-flow': 'power',
  crew: 'crew',
  modules: 'base',
  weather: 'base',
};

export function PlayPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const demo = params.get('demo') === '1';
  const view = useMission();

  useEffect(() => {
    const store = useGameStore.getState();
    if (demo) {
      if (!store.game?.config.demo) store.startDemo();
      return;
    }
    if (!store.game && !store.loadSaved()) navigate('/setup', { replace: true });
  }, [demo, navigate]);

  if (!view) {
    return <div className="flex min-h-screen items-center justify-center text-muted">Loading mission…</div>;
  }
  return <MissionControl view={view} />;
}

function MissionControl({ view }: { view: MissionView }) {
  const navigate = useNavigate();
  const wide = useMediaQuery('(min-width: 1280px)');
  const narrow = !useMediaQuery('(min-width: 768px)');
  const { game } = view;

  const lastReport = useGameStore((s) => s.lastReport);
  const reportOpen = useGameStore((s) => s.reportOpen);
  const notices = useGameStore((s) => s.notices);
  const tutorialStep = useGameStore((s) => s.tutorialStep);
  const muted = useGameStore((s) => s.settings.muted);
  const canUndo = useGameStore((s) => s.previous !== null);
  const store = useGameStore.getState;

  const [tab, setTab] = useState<Tab>('base');
  const [buildOpen, setBuildOpen] = useState(false);
  const [buildFocus, setBuildFocus] = useState<ModuleId | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);

  const dayLabel = view.dayLabel;
  const anyModal = buildOpen || historyOpen || settingsOpen || reportOpen || confirmAbandon;

  // Keep the tutorial target visible on the tabbed layout.
  useEffect(() => {
    if (tutorialStep !== null && TUTORIAL_TABS[tutorialStep]) setTab(TUTORIAL_TABS[tutorialStep]);
  }, [tutorialStep]);

  useEffect(() => {
    if (!highlight) return;
    const timer = window.setTimeout(() => setHighlight(null), 2500);
    return () => window.clearTimeout(timer);
  }, [highlight]);

  const endDay = useCallback(() => {
    const report = store().endDay();
    if (report && !muted && report.alerts.some((a) => a.level === 'red')) playAlertTone();
  }, [muted, store]);

  const selectAlert = (target: string) => {
    if (!wide && TARGET_TABS[target]) setTab(TARGET_TABS[target]);
    if (target === 'modules') {
      setBuildFocus(null);
      setBuildOpen(true);
      return;
    }
    setHighlight(target);
    window.requestAnimationFrame(() =>
      document.getElementById(target)?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
    );
  };

  const openModule = (module: ModuleId) => {
    setBuildFocus(module);
    setBuildOpen(true);
  };

  const finished = game.outcome !== null;
  const redAlert = view.alerts.find((a) => a.level === 'red');
  const demoGuide = game.config.demo ? (copy.demoGuide as Record<string, string>)[String(game.day)] : null;
  const notice = !reportOpen && tutorialStep === null && !anyModal ? notices[0] : undefined;

  const baseSection = (
    <section aria-labelledby="base-title" className="panel overflow-hidden" id="modules">
      <div className="flex items-baseline justify-between px-4 pt-3">
        <h2 id="base-title" className="panel-title">
          Base view
        </h2>
        <span className="text-xs text-muted">Select a module to build or repair</span>
      </div>
      <div className="p-2">
        <BaseView game={game} served={view.preview.served} onSelect={openModule} />
      </div>
    </section>
  );

  return (
    <div data-location={game.config.location} className="flex min-h-screen flex-col">
      <MissionHeader
        view={view}
        hasReport={lastReport !== null}
        onReport={() => store().openReport()}
        onHistory={() => setHistoryOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        onHelp={() => store().startTutorial()}
      />

      {narrow && (
        <p className="border-b border-border bg-panel px-4 py-2 text-sm text-muted">
          AstroBase works best on a laptop or tablet. Everything still works here, one panel at a time.
        </p>
      )}
      {demoGuide && !finished && (
        <div className="border-b border-info/40 bg-info/10 px-4 py-2 text-sm" role="note">
          <strong className="mr-1">Demo guide.</strong>
          {demoGuide}
        </div>
      )}
      {redAlert && !finished && (
        <div className="border-b border-danger/50 bg-danger/10 px-4 py-2 text-sm" role="alert">
          <strong className="mr-1 text-danger">Critical:</strong>
          {redAlert.message}
        </div>
      )}
      {finished && !reportOpen && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-panel px-4 py-3">
          <span className="font-medium">
            {game.outcome?.result === 'success' ? 'Mission complete.' : 'The mission has ended.'}
          </span>
          <Button variant="primary" size="sm" onClick={() => navigate('/debrief')}>
            View debrief
          </Button>
        </div>
      )}

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-3 py-3">
        {wide ? (
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-3 space-y-3">
              <ResourcePanel view={view} highlight={highlight} />
              <ObjectivesPanel game={game} />
            </div>
            <div className="col-span-6 space-y-3">
              {baseSection}
              <PowerPanel view={view} />
            </div>
            <div className="col-span-3 space-y-3">
              <AlertList alerts={view.alerts} onSelect={selectAlert} />
              <CrewPanel view={view} highlight={highlight === 'crew'} />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <ResourcePanel view={view} highlight={highlight} />
            <div
              role="tablist"
              aria-label="Mission panels"
              className="flex gap-1 rounded-xl border border-border bg-panel p-1"
            >
              {(['base', 'power', 'crew'] as Tab[]).map((t) => (
                <button
                  key={t}
                  role="tab"
                  type="button"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={cx(
                    'min-h-[44px] flex-1 rounded-lg text-sm font-medium',
                    tab === t ? 'bg-panel-2 text-text' : 'text-muted hover:text-text',
                  )}
                >
                  {t === 'base' ? 'Base' : t === 'power' ? 'Power' : 'Crew'}
                </button>
              ))}
            </div>
            <div role="tabpanel">
              {tab === 'base' && (
                <div className="space-y-3">
                  {baseSection}
                  <AlertList alerts={view.alerts} onSelect={selectAlert} />
                  <ObjectivesPanel game={game} />
                </div>
              )}
              {tab === 'power' && <PowerPanel view={view} />}
              {tab === 'crew' && <CrewPanel view={view} highlight={highlight === 'crew'} />}
            </div>
          </div>
        )}
      </main>

      {!finished && (
        <div className="sticky bottom-0 z-20">
          <ActionBar
            view={view}
            canUndo={canUndo}
            onBuild={() => {
              setBuildFocus(null);
              setBuildOpen(true);
            }}
            onEndDay={endDay}
          />
        </div>
      )}

      <BuildModal open={buildOpen} onClose={() => setBuildOpen(false)} view={view} focusModule={buildFocus} />

      {lastReport && (
        <DailyReportModal
          key={lastReport.day}
          open={reportOpen}
          report={lastReport}
          game={game}
          tutorialActive={tutorialStep === 4}
          onClose={() => store().closeReport()}
          onDebrief={() => {
            store().closeReport();
            navigate('/debrief');
          }}
        />
      )}

      {notice && (
        <EventModal game={game} eventKey={notice.eventKey} onClose={() => store().dismissNotice()} />
      )}

      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} size="xl" title="Mission history">
        <HistoryChart game={game} />
      </Modal>

      <SettingsModal
        open={settingsOpen}
        seed={game.config.seed}
        onClose={() => setSettingsOpen(false)}
        onRestartTutorial={() => {
          setSettingsOpen(false);
          store().startTutorial();
        }}
        onAbandon={() => {
          setSettingsOpen(false);
          setConfirmAbandon(true);
        }}
      />

      <Modal
        open={confirmAbandon}
        onClose={() => setConfirmAbandon(false)}
        title="Abandon this mission?"
        tone="danger"
        footer={
          <>
            <Button onClick={() => setConfirmAbandon(false)}>Keep playing</Button>
            <Button
              variant="danger"
              onClick={() => {
                store().abandonMission();
                navigate('/setup');
              }}
            >
              Abandon mission
            </Button>
          </>
        }
      >
        <p>
          Your saved progress will be deleted. You can start the same mission again with code{' '}
          <span className="num">{game.config.seed}</span>.
        </p>
      </Modal>

      {tutorialStep !== null && tutorialStep < 4 && !reportOpen && (
        <TutorialOverlay
          step={tutorialStep}
          endLabel={`End ${dayLabel}`}
          onStep={(s) => store().setTutorialStep(s)}
          onSkip={() => store().finishTutorial()}
        />
      )}
    </div>
  );
}
