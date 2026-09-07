"use client";

import { useCallback, useRef, useState } from "react";
import { ICE_SERVERS } from "@/lib/config";
import type { ClientMessage, ServerMessage } from "@/types";

export interface UseWebRTCOptions {
  /** Send a signaling message to a specific peer via the WebSocket. */
  sendMessage: (message: ClientMessage) => void;
  /** The local camera/mic stream (may be null when joining without media). */
  getLocalStream: () => MediaStream | null;
  /** Our own peer id, used for the deterministic polite/impolite bit. */
  getSelfPeerId: () => string;
}

export interface WebRTCMeshApi {
  /** Create peer connections to (and send offers to) existing participants. */
  initiateToPeers: (peerIds: string[]) => void;
  /** Route offer/answer/ice-candidate messages from the signaling server. */
  handleServerMessage: (message: ServerMessage) => void;
  /**
   * Replace the outgoing video track on every peer connection
   * (screen share on / off / camera restore). Falls back to addTrack +
   * renegotiation when no video sender exists yet.
   */
  replaceOutgoingVideoTrack: (track: MediaStreamTrack | null, stream: MediaStream | null) => void;
  /**
   * Add any local tracks that are not yet sent to each peer (e.g. a camera or
   * microphone enabled after joining). Triggers renegotiation through
   * onnegotiationneeded.
   */
  syncLocalTracks: (stream: MediaStream | null) => void;
  /** Tear down a single peer (participant left). */
  removePeer: (peerId: string) => void;
  /** Tear down everything (leaving the meeting). */
  cleanup: () => void;
  /** Peer ids that currently have a remote stream. */
  remotePeerIds: string[];
  getRemoteStream: (peerId: string) => MediaStream | null;
  connectionStates: Record<string, RTCPeerConnectionState>;
}

type SdpMessage = Extract<ServerMessage, { sdp: unknown }>;

/**
 * Native WebRTC P2P Mesh (PRD §17, §19-§23).
 *
 * One RTCPeerConnection per remote participant. Local tracks are added to
 * every peer connection; remote tracks are collected into one MediaStream
 * per peer. Offers are normally initiated by the newly-joining participant;
 * later renegotiations (screen share, late camera) are driven by
 * `onnegotiationneeded` with a lightweight perfect-negotiation guard against
 * SDP glare (deterministic polite/impolite bit from the peer id comparison).
 */
export function useWebRTC(options: UseWebRTCOptions): WebRTCMeshApi {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const makingOfferRef = useRef<Set<string>>(new Set());
  const ignoreOfferRef = useRef<Set<string>>(new Set());
  const videoSendersRef = useRef<Map<string, RTCRtpSender>>(new Map());
  const restartsRef = useRef<Map<string, number>>(new Map());

  const [remotePeerIds, setRemotePeerIds] = useState<string[]>([]);
  const [, setStreamsVersion] = useState<number>(0);
  const [connectionStates, setConnectionStates] = useState<
    Record<string, RTCPeerConnectionState>
  >({});

  const syncPeerIds = useCallback(() => {
    setRemotePeerIds([...remoteStreamsRef.current.keys()]);
    setStreamsVersion((v) => v + 1);
  }, []);

  const isPolite = useCallback(
    (peerId: string) => optionsRef.current.getSelfPeerId() < peerId,
    [],
  );

  const flushCandidates = useCallback(async (peerId: string) => {
    const pc = peersRef.current.get(peerId);
    const buffered = pendingCandidatesRef.current.get(peerId);
    if (!pc || !buffered || buffered.length === 0) return;
    pendingCandidatesRef.current.set(peerId, []);
    for (const candidate of buffered) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        // Candidates for an ignored/rolled-back offer are expected to fail.
        if (!ignoreOfferRef.current.has(peerId)) {
          console.warn("addIceCandidate failed", error);
        }
      }
    }
  }, []);

  const attachNegotiationHandler = useCallback((peerId: string, pc: RTCPeerConnection) => {
    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current.add(peerId);
        await pc.setLocalDescription();
        const description = pc.localDescription;
        if (description) {
          optionsRef.current.sendMessage({
            type: "offer",
            target_peer_id: peerId,
            sdp: { type: "offer", sdp: description.sdp },
          });
        }
      } catch (error) {
        console.error("negotiation failed", error);
      } finally {
        makingOfferRef.current.delete(peerId);
      }
    };
  }, []);

  const createPeer = useCallback(
    (peerId: string, autoNegotiate: boolean): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peersRef.current.set(peerId, pc);

      if (autoNegotiate) {
        attachNegotiationHandler(peerId, pc);
      }

      // Add our local tracks to every peer connection (PRD §24).
      const localStream = optionsRef.current.getLocalStream();
      if (localStream) {
        for (const track of localStream.getTracks()) {
          pc.addTrack(track, localStream);
        }
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          const sender = pc.getSenders().find((s) => s.track === videoTrack);
          if (sender) videoSendersRef.current.set(peerId, sender);
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          optionsRef.current.sendMessage({
            type: "ice-candidate",
            target_peer_id: peerId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (event) => {
        let stream = remoteStreamsRef.current.get(peerId);
        if (!stream) {
          stream = new MediaStream();
          remoteStreamsRef.current.set(peerId, stream);
        }
        if (!stream.getTracks().includes(event.track)) {
          stream.addTrack(event.track);
        }
        syncPeerIds();
      };

      pc.onconnectionstatechange = () => {
        setConnectionStates((prev) => ({ ...prev, [peerId]: pc.connectionState }));
        if (pc.connectionState === "failed") {
          // One ICE restart attempt before giving up on the peer.
          const attempts = (restartsRef.current.get(peerId) ?? 0) + 1;
          restartsRef.current.set(peerId, attempts);
          if (attempts <= 1) pc.restartIce();
        }
      };

      return pc;
    },
    [attachNegotiationHandler, syncPeerIds],
  );

  const initiateToPeers = useCallback(
    (peerIds: string[]) => {
      for (const peerId of peerIds) {
        if (!peersRef.current.has(peerId)) {
          const pc = createPeer(peerId, true);
          if (pc.signalingState === "stable") {
            pc.onnegotiationneeded?.(new Event("negotiationneeded"));
          }
        }
      }
    },
    [createPeer],
  );

  const handleOffer = useCallback(
    async (peerId: string, sdp: RTCSessionDescriptionInit) => {
      let pc = peersRef.current.get(peerId);
      if (!pc) {
        // An existing participant offering to us (we never created the PC).
        pc = createPeer(peerId, false);
      }

      const offerCollision =
        makingOfferRef.current.has(peerId) || pc.signalingState !== "stable";
      const ignoreOffer = !isPolite(peerId) && offerCollision;
      if (ignoreOffer) {
        ignoreOfferRef.current.add(peerId);
        return;
      }
      ignoreOfferRef.current.delete(peerId);

      await pc.setRemoteDescription(sdp);
      await flushCandidates(peerId);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      optionsRef.current.sendMessage({
        type: "answer",
        target_peer_id: peerId,
        sdp: { type: "answer", sdp: answer.sdp ?? "" },
      });
      // Future renegotiations (e.g. our own screen share) go through the
      // negotiation handler; the initial negotiation is now complete.
      attachNegotiationHandler(peerId, pc);
    },
    [attachNegotiationHandler, createPeer, flushCandidates, isPolite],
  );

  const handleAnswer = useCallback(
    async (peerId: string, sdp: RTCSessionDescriptionInit) => {
      const pc = peersRef.current.get(peerId);
      if (!pc) return;
      if (ignoreOfferRef.current.has(peerId)) return;
      try {
        if (pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(sdp);
          await flushCandidates(peerId);
        }
      } catch (error) {
        console.error("setRemoteDescription(answer) failed", error);
      }
    },
    [flushCandidates],
  );

  const handleIceCandidate = useCallback(
    async (peerId: string, candidate: RTCIceCandidateInit) => {
      const pc = peersRef.current.get(peerId);
      // Buffer candidates that arrive before the remote description is set
      // (PRD §21: the frontend must handle candidate timing).
      if (!pc || !pc.remoteDescription) {
        const buffered = pendingCandidatesRef.current.get(peerId) ?? [];
        buffered.push(candidate);
        pendingCandidatesRef.current.set(peerId, buffered);
        return;
      }
      if (ignoreOfferRef.current.has(peerId)) return;
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.warn("addIceCandidate failed", error);
      }
    },
    [],
  );

  const handleServerMessage = useCallback(
    (message: ServerMessage) => {
      const sdpMessage = message as SdpMessage;
      switch (message.type) {
        case "offer":
          void handleOffer(sdpMessage.from_peer_id, sdpMessage.sdp);
          break;
        case "answer":
          void handleAnswer(sdpMessage.from_peer_id, sdpMessage.sdp);
          break;
        case "ice-candidate":
          void handleIceCandidate(message.from_peer_id, message.candidate);
          break;
        default:
          break;
      }
    },
    [handleAnswer, handleIceCandidate, handleOffer],
  );

  const replaceOutgoingVideoTrack = useCallback(
    (track: MediaStreamTrack | null, stream: MediaStream | null) => {
      for (const [peerId, pc] of peersRef.current) {
        const sender =
          videoSendersRef.current.get(peerId) ??
          pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          // Same transceiver, new source — no renegotiation needed.
          sender
            .replaceTrack(track)
            .catch((error) => console.error("replaceTrack failed", error));
        } else if (track && stream) {
          // We joined without a video track: add one and renegotiate.
          pc.addTrack(track, stream);
          videoSendersRef.current.set(peerId, pc.getSenders().find((s) => s.track === track)!);
        }
      }
    },
    [],
  );

  const syncLocalTracks = useCallback((stream: MediaStream | null) => {
    if (!stream) return;
    for (const [peerId, pc] of peersRef.current) {
      const sent = new Set(pc.getSenders().map((sender) => sender.track));
      for (const track of stream.getTracks()) {
        if (sent.has(track)) continue;
        pc.addTrack(track, stream);
        if (track.kind === "video") {
          const sender = pc.getSenders().find((s) => s.track === track);
          if (sender) videoSendersRef.current.set(peerId, sender);
        }
      }
    }
  }, []);

  const removePeer = useCallback(
    (peerId: string) => {
      const pc = peersRef.current.get(peerId);
      if (pc) {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.onnegotiationneeded = null;
        pc.onconnectionstatechange = null;
        pc.close();
      }
      peersRef.current.delete(peerId);
      remoteStreamsRef.current.delete(peerId);
      pendingCandidatesRef.current.delete(peerId);
      makingOfferRef.current.delete(peerId);
      ignoreOfferRef.current.delete(peerId);
      videoSendersRef.current.delete(peerId);
      restartsRef.current.delete(peerId);
      syncPeerIds();
      setConnectionStates((prev) => {
        const next = { ...prev };
        delete next[peerId];
        return next;
      });
    },
    [syncPeerIds],
  );

  const cleanup = useCallback(() => {
    for (const peerId of [...peersRef.current.keys()]) {
      removePeer(peerId);
    }
  }, [removePeer]);

  const getRemoteStream = useCallback(
    (peerId: string) => remoteStreamsRef.current.get(peerId) ?? null,
    [],
  );

  return {
    initiateToPeers,
    handleServerMessage,
    replaceOutgoingVideoTrack,
    syncLocalTracks,
    removePeer,
    cleanup,
    remotePeerIds,
    getRemoteStream,
    connectionStates,
  };
}
