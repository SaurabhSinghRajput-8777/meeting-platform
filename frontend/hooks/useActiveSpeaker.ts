"use client";

import { useEffect, useRef, useState } from "react";

export interface SpeakerStreamEntry {
  id: string;
  stream: MediaStream | null;
  isLocal: boolean;
}

/**
 * Lightweight active-speaker heuristic (PRD §29): an AudioContext analyser per
 * stream, sampled a few times per second; the loudest stream above a
 * threshold is the active speaker. No complex audio intelligence.
 *
 * Remote streams are also played through hidden <audio> elements here —
 * required for Chrome to route remote WebRTC audio through Web Audio (and it
 * guarantees audible playback independently of the video tiles).
 */
export function useActiveSpeaker(entries: SpeakerStreamEntry[]): string | null {
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const key = entries
    .filter((entry) => entry.stream)
    .map((entry) => entry.id)
    .sort()
    .join("|");

  useEffect(() => {
    if (!key) {
      setActiveSpeakerId(null);
      return;
    }

    const audioElements: HTMLAudioElement[] = [];
    const analysers = new Map<string, { analyser: AnalyserNode; data: Uint8Array<ArrayBuffer> }>();
    let audioContext: AudioContext | null = null;

    try {
      audioContext = new AudioContext();
      void audioContext.resume().catch(() => undefined); // created after the join click
      for (const entry of entriesRef.current) {
        if (!entry.stream) continue;
        if (!entry.isLocal) {
          const audio = document.createElement("audio");
          audio.autoplay = true;
          audio.setAttribute("playsinline", "true");
          audio.srcObject = entry.stream;
          document.body.appendChild(audio);
          audioElements.push(audio);
        }
        const source = audioContext.createMediaStreamSource(entry.stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser); // not connected to destination: no echo
        analysers.set(entry.id, {
          analyser,
          data: new Uint8Array(analyser.frequencyBinCount),
        });
      }
    } catch (error) {
      console.warn("Active speaker detection unavailable", error);
    }

    const SPEAKING_THRESHOLD = 0.06;
    const interval = window.setInterval(() => {
      let loudestId: string | null = null;
      let loudestLevel = 0;
      for (const [id, { analyser, data }] of analysers) {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) sum += data[i] * data[i];
        const rms = Math.sqrt(sum / data.length) / 255;
        if (rms > loudestLevel) {
          loudestLevel = rms;
          loudestId = id;
        }
      }
      setActiveSpeakerId(loudestLevel >= SPEAKING_THRESHOLD ? loudestId : null);
    }, 300);

    return () => {
      window.clearInterval(interval);
      audioElements.forEach((audio) => audio.remove());
      audioContext?.close().catch(() => undefined);
    };
  }, [key]);

  return activeSpeakerId;
}
