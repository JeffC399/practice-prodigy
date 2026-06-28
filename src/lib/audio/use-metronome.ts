"use client";

import { useEffect, useState, useCallback } from "react";
import {
  metronomeEngine,
  type MetronomeConfig,
  type MetronomeState,
} from "./metronome";

export function useMetronome() {
  const [state, setState] = useState<MetronomeState>(() =>
    metronomeEngine.getState(),
  );

  useEffect(() => {
    return metronomeEngine.subscribe(setState);
  }, []);

  // Stop on unmount so navigating away cuts the audio.
  useEffect(() => {
    return () => {
      metronomeEngine.stop();
    };
  }, []);

  const start = useCallback(async (config: MetronomeConfig) => {
    await metronomeEngine.start(config);
  }, []);

  const stop = useCallback(() => {
    metronomeEngine.stop();
  }, []);

  return { state, start, stop };
}
