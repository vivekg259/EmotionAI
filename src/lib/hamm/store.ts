import { buildSample } from "@/lib/hamm/sample";
import type { FaceSample, HumanLog, Session } from "@/lib/hamm/types";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type HammState = {
  consentedAt: number | null;
  cameraConsent: boolean;
  sessions: Session[];
  humanLogs: HumanLog[];
  faceSamples: FaceSample[];
  consent: () => void;
  setCameraConsent: (value: boolean) => void;
  addSession: (session: Session) => void;
  addSessions: (sessions: Session[]) => void;
  deleteSession: (id: string) => void;
  setHumanMinutes: (date: string, minutes: number) => void;
  addFaceSample: (sample: FaceSample) => void;
  loadSample: () => void;
  deleteStoredData: () => void;
};

export const useHamm = create<HammState>()(
  persist(
    (set) => ({
      consentedAt: null,
      cameraConsent: false,
      sessions: [],
      humanLogs: [],
      faceSamples: [],
      consent: () => set({ consentedAt: Date.now() }),
      setCameraConsent: (cameraConsent) => set({ cameraConsent }),
      addSession: (session) =>
        set((state) => {
          const hadSample = state.sessions.some((item) => item.sample);
          return {
            sessions: [...state.sessions.filter((item) => !item.sample), session],
            humanLogs: hadSample ? [] : state.humanLogs,
            faceSamples: hadSample ? [] : state.faceSamples,
          };
        }),
      addSessions: (incoming) =>
        set((state) => {
          if (incoming.length === 0) return state;
          const hadSample = state.sessions.some((item) => item.sample);
          return {
            sessions: [...state.sessions.filter((item) => !item.sample), ...incoming],
            humanLogs: hadSample ? [] : state.humanLogs,
            faceSamples: hadSample ? [] : state.faceSamples,
          };
        }),
      deleteSession: (id) =>
        set((state) => ({
          sessions: state.sessions.filter((session) => session.id !== id),
        })),
      setHumanMinutes: (date, minutes) =>
        set((state) => {
          const rest = state.humanLogs.filter((log) => log.date !== date);
          if (minutes <= 0) return { humanLogs: rest };
          return {
            humanLogs: [...rest, { date, minutes: Math.round(minutes) }],
          };
        }),
      addFaceSample: (sample) =>
        set((state) => ({
          faceSamples: [...state.faceSamples, sample].slice(-24),
        })),
      loadSample: () => {
        const sample = buildSample();
        set({
          sessions: sample.sessions,
          humanLogs: sample.humanLogs,
          faceSamples: [],
        });
      },
      deleteStoredData: () =>
        set({
          sessions: [],
          humanLogs: [],
          faceSamples: [],
          cameraConsent: false,
        }),
    }),
    {
      name: "hamm-v1",
      skipHydration: true,
      partialize: (state) => ({
        consentedAt: state.consentedAt,
        cameraConsent: state.cameraConsent,
        sessions: state.sessions,
        humanLogs: state.humanLogs,
        faceSamples: state.faceSamples,
      }),
    },
  ),
);
