import { useEffect, useRef, useState } from 'react';

/**
 * Simulated playback progress (0..1) for previews until real media URLs exist.
 * Replace with expo-video / expo-audio player status when the backend returns files.
 */
export const useFakePlayback = (durationSec = 15) => {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (!playing) return;
    startRef.current = Date.now() - progress * durationSec * 1000;
    const id = setInterval(() => {
      const p = (Date.now() - startRef.current) / (durationSec * 1000);
      if (p >= 1) {
        setProgress(0);
        setPlaying(false);
      } else setProgress(p);
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, durationSec]);

  return { playing, progress, toggle: () => setPlaying((p) => !p), stop: () => setPlaying(false), seek: setProgress };
};
