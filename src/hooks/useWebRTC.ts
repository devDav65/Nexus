"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
}

export type CallState = "idle" | "calling" | "ringing" | "connected" | "ended"

interface UseWebRTCOptions {
  callId: string
  currentUserId: string
  isInitiator: boolean
  callType: "audio" | "video"
  onStateChange?: (state: CallState) => void
  onRemoteStream?: (stream: MediaStream) => void
}

export function useWebRTC({ callId, currentUserId, isInitiator, callType, onStateChange, onRemoteStream }: UseWebRTCOptions) {
  const supabase = createClient()
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const channelRef = useRef<any>(null)
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([])
  const offerSent = useRef(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [callState, setCallState] = useState<CallState>(isInitiator ? "calling" : "ringing")

  const updateState = useCallback((state: CallState) => {
    setCallState(state)
    onStateChange?.(state)
  }, [onStateChange])

  const getLocalMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video"
          ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }
          : false,
      })
      localStreamRef.current = stream
      setLocalStream(stream)
      return stream
    } catch (err) {
      console.error("getUserMedia:", err)
      return null
    }
  }, [callType])

  const createPC = useCallback((stream: MediaStream, channel: any) => {
    const pc = new RTCPeerConnection(ICE_SERVERS)
    pcRef.current = pc

    stream.getTracks().forEach(t => pc.addTrack(t, stream))

    pc.ontrack = (e) => {
      const remoteStream = e.streams[0]
      if (remoteStream) onRemoteStream?.(remoteStream)
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        channel.send({
          type: "broadcast",
          event: "ice",
          payload: { from: currentUserId, candidate: e.candidate.toJSON() },
        })
      }
    }

    pc.onconnectionstatechange = () => {
      console.log("PC state:", pc.connectionState)
      if (pc.connectionState === "connected") {
        updateState("connected")
        supabase.from("calls")
          .update({ status: "active", started_at: new Date().toISOString() })
          .eq("id", callId)
      }
      if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        updateState("ended")
      }
    }

    return pc
  }, [callId, currentUserId, onRemoteStream, updateState])

  useEffect(() => {
    let mounted = true

    const init = async () => {
      const stream = await getLocalMedia()
      if (!stream || !mounted) return

      // Canal signaling
      const channel = supabase.channel(`call:${callId}`, {
        config: { broadcast: { self: false, ack: false } },
      })
      channelRef.current = channel

      channel
        // ── Destinataire reçoit l'offer ──
        .on("broadcast", { event: "offer" }, async ({ payload }) => {
          if (payload.from === currentUserId) return
          console.log("Reçu offer")

          const pc = createPC(stream, channel)

          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))

          // Appliquer les ICE candidates en attente
          for (const c of pendingCandidates.current) {
            try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch {}
          }
          pendingCandidates.current = []

          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)

          channel.send({
            type: "broadcast",
            event: "answer",
            payload: { from: currentUserId, sdp: answer },
          })
        })

        // ── Appelant reçoit l'answer ──
        .on("broadcast", { event: "answer" }, async ({ payload }) => {
          if (payload.from === currentUserId) return
          console.log("Reçu answer")
          const pc = pcRef.current
          if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
        })

        // ── ICE candidates ──
        .on("broadcast", { event: "ice" }, async ({ payload }) => {
          if (payload.from === currentUserId) return
          const pc = pcRef.current
          if (!pc || !payload.candidate) return

          if (pc.remoteDescription) {
            try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)) } catch {}
          } else {
            // Stocker en attente si remote desc pas encore setté
            pendingCandidates.current.push(payload.candidate)
          }
        })

        // ── Fin d'appel ──
        .on("broadcast", { event: "end_call" }, () => {
          console.log("Appel terminé par l'autre")
          updateState("ended")
        })

        // ── Présence : le destinataire signale qu'il est prêt ──
        .on("broadcast", { event: "ready" }, async ({ payload }) => {
          if (payload.from === currentUserId) return
          // Le destinataire est prêt → l'appelant envoie l'offer maintenant
          if (isInitiator && !offerSent.current) {
            console.log("Destinataire prêt, envoi offer")
            offerSent.current = true
            const pc = createPC(stream, channel)
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            channel.send({
              type: "broadcast",
              event: "offer",
              payload: { from: currentUserId, sdp: offer },
            })
          }
        })

        .subscribe(async (status) => {
          if (status !== "SUBSCRIBED") return
          console.log("Canal connecté, isInitiator:", isInitiator)

          // Tout le monde signale qu'il est prêt
          channel.send({
            type: "broadcast",
            event: "ready",
            payload: { from: currentUserId },
          })

          // Si appelant, attendre 500ms puis envoyer l'offer
          // (au cas où le destinataire était déjà connecté)
          if (isInitiator) {
            setTimeout(async () => {
              if (!offerSent.current && mounted) {
                console.log("Timeout fallback: envoi offer")
                offerSent.current = true
                const pc = createPC(stream, channel)
                const offer = await pc.createOffer()
                await pc.setLocalDescription(offer)
                channel.send({
                  type: "broadcast",
                  event: "offer",
                  payload: { from: currentUserId, sdp: offer },
                })
              }
            }, 1500)
          }
        })
    }

    init()

    return () => {
      mounted = false
      localStreamRef.current?.getTracks().forEach(t => t.stop())
      pcRef.current?.close()
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [callId])

  const endCall = useCallback(async () => {
    channelRef.current?.send({
      type: "broadcast",
      event: "end_call",
      payload: { from: currentUserId },
    })
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    pcRef.current?.close()
    await supabase.from("calls")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", callId)
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    updateState("ended")
  }, [callId, currentUserId, updateState])

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0]
    if (track) track.enabled = !track.enabled
    return track ? !track.enabled : false
  }, [])

  const toggleCamera = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0]
    if (track) track.enabled = !track.enabled
    return track ? !track.enabled : false
  }, [])

  return { localStream, callState, endCall, toggleMute, toggleCamera }
}
