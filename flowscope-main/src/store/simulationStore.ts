import { create } from 'zustand';
import { createInitialEngineState, tickEngine } from '../simulation/engine';
import type { ScenarioId, SimRequest } from '../types/simulation';

type SimulationStore = ReturnType<typeof createInitialEngineState> & {
  isRunning: boolean;
  speed: number;
  scenarioId: ScenarioId;
  selectedTraceId: string | null;
  autoFollow: boolean;
  start: () => void;
  stop: () => void;
  reset: () => void;
  step: () => void;
  setScenario: (value: ScenarioId) => void;
  setSpeed: (value: number) => void;
  setSelectedTraceId: (value: string | null) => void;
  setAutoFollow: (value: boolean) => void;
  getLeadTrace: () => SimRequest | null;
};

let timer: number | null = null;

const stopTimer = () => {
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
};

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  ...createInitialEngineState(),
  isRunning: false,
  speed: 1,
  scenarioId: 'steady',
  selectedTraceId: null,
  autoFollow: true,
  start: () => {
    stopTimer();
    set({ isRunning: true });
    timer = window.setInterval(() => {
      const { isRunning, scenarioId } = get();
      if (!isRunning) return;
      set((state) => tickEngine(state, scenarioId));
    }, Math.max(180, 880 / get().speed));
  },
  stop: () => {
    stopTimer();
    set({ isRunning: false });
  },
  reset: () => {
    stopTimer();
    set({
      ...createInitialEngineState(),
      isRunning: false,
      speed: get().speed,
      scenarioId: get().scenarioId,
      selectedTraceId: null,
      autoFollow: true,
    });
  },
  step: () => set((state) => tickEngine(state, get().scenarioId)),
  setScenario: (value) => set({ scenarioId: value }),
  setSpeed: (value) => {
    set({ speed: value });
    if (get().isRunning) get().start();
  },
  setSelectedTraceId: (value) => set({ selectedTraceId: value }),
  setAutoFollow: (value) => set({ autoFollow: value }),
  getLeadTrace: () => {
    const { selectedTraceId, requestsById, completed } = get();
    if (selectedTraceId) {
      return requestsById[selectedTraceId] ?? completed.find((item) => item.id === selectedTraceId) ?? null;
    }
    return Object.values(requestsById)[0] ?? completed[0] ?? null;
  },
}));
