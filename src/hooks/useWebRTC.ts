"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

export type CallState = "calling" | "ringing" | "connected" | "ended"

interface Options {
  callId: string
  currentUserId: string
  isInitiator: boolean
  callType: "audio" | "video"
  onStateChange?: (s: CallState) => void
  onRemoteStream?: (stream: MediaStream) => void
}

export function useWebRTC({ callId, currentUserId, isInitiator, callType, onStateChange, onRemoteStream }: Options) {
  const supabase = createClient()
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const channelRef = useRef<any>(null)
  const pendingRef = useRef<RTCIceCandidateInit[]>([])
  const remoteSetRef = useRef(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [callState, setCallState] = useState<CallState>(isInitiator ? "calling" : "ringing")

  const updateState = useCallback((s: CallState) => {
    setCallState(s)
    onStateChange?.(s)
  }, [onStateChange])

  const send = useCallback((event: string, data: any) => {
    channelRef.current?.send({
      type: "broadcast",
      event,
      payload: { from: currentUserId, ...data },
    })
  }, [currentUserId])

  const applyPending = useCallback(async (pc: RTCPeerConnection) => {
    for (const c of pendingRef.current) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch {}
    }
    pendingRef.current = []
  }, [])

  const createPC = useCallback((stream: MediaStream) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        {
          urls: "turn:openrelay.metered.ca:443",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        {
          urls: "turn:openrelay.metered.ca:443?transport=tcp",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
      ],
    })

    stream.getTracks().forEach(t => pc.addTrack(t, stream))

    pc.ontrack = (e) => {
      console.log("✅ Track distant reçu:", e.track.kind)
      if (e.streams[0]) onRemoteStream?.(e.streams[0])
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        console.log("ICE local:", e.candidate.type)
        send("ice", { candidate: e.candidate.toJSON() })
      }
    }

    pc.oniceconnectionstatechange = () => {
      console.log("ICE state:", pc.iceConnectionState)
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        updateState("connected")
        supabase.from("calls")
          .update({ status: "active", started_at: new Date().toISOString() })
          .eq("id", callId)
      }
      if (pc.iceConnectionState === "failed") {
        console.log("ICE failed, restart...")
        pc.restartIce()
      }
      if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "closed") {
        updateState("ended")
      }
    }

    pcRef.current = pc
    return pc
  }, [callId, send, onRemoteStream, updateState])

  useEffect(() => {
    let mounted = true

    const init = async () => {
      // 1. Obtenir le flux local
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === "video"
            ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }
            : false,
        })
        localStreamRef.current = stream
        setLocalStream(stream)
      } catch (err) {
        console.error("getUserMedia:", err)
        return
      }

      if (!mounted) return

      // 2. Canal signaling
      const channel = supabase.channel(`rtc:${callId}`, {
        config: { broadcast: { self: false, ack: false } },
      })
      channelRef.current = channel

      // ── Réception offer (côté destinataire) ──
      channel.on("broadcast", { event: "offer" }, async ({ payload }) => {
        if (payload.from === currentUserId) return
        console.log("📨 Offer reçu")
        const pc = createPC(stream)
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
        remoteSetRef.current = true
        await applyPending(pc)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        send("answer", { sdp: answer })
      })

      // ── Réception answer (côté appelant) ──
      channel.on("broadcast", { event: "answer" }, async ({ payload }) => {
        if (payload.from === currentUserId) return
        console.log("📨 Answer reçu")
        const pc = pcRef.current
        if (pc && !remoteSetRef.current) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
          remoteSetRef.current = true
          await applyPending(pc)
        }
      })

      // ── ICE candidates ──
      channel.on("broadcast", { event: "ice" }, async ({ payload }) => {
        if (payload.from === currentUserId || !payload.candidate) return
        const pc = pcRef.current
        if (pc && remoteSetRef.current) {
          try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)) } catch {}
        } else {
          pendingRef.current.push(payload.candidate)
        }
      })

      // ── Fin d'appel par l'autre ──
      channel.on("broadcast", { event: "end_call" }, ({ payload }) => {
        if (payload.from === currentUserId) return
        console.log("📞 Appel terminé par l'autre")
        localStreamRef.current?.getTracks().forEach(t => t.stop())
        pcRef.current?.close()
        updateState("ended")
      })

      // ── Prêt → l'appelant envoie l'offer ──
      channel.on("broadcast", { event: "ready" }, async ({ payload }) => {
        if (payload.from === currentUserId) return
        if (!isInitiator || pcRef.current) return
        console.log("✅ Destinataire prêt, envoi offer")
        const pc = createPC(stream)
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callType === "video" })
        await pc.setLocalDescription(offer)
        send("offer", { sdp: offer })
      })

      channel.subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return
        console.log("📡 Canal connecté, initiateur:", isInitiator)

        // Signaler sa présence
        send("ready", {})

        // Fallback : appelant envoie offer après 2s si pas de réponse ready
        if (isInitiator) {
          setTimeout(async () => {
            if (!mounted || pcRef.current) return
            console.log("⏰ Fallback offer")
            const pc = createPC(stream)
            const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callType === "video" })
            await pc.setLocalDescription(offer)
            send("offer", { sdp: offer })
          }, 2000)
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
    // Notifier l'autre IMMÉDIATEMENT
    send("end_call", {})

    localStreamRef.current?.getTracks().forEach(t => t.stop())
    pcRef.current?.close()

    await supabase.from("calls")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", callId)

    if (channelRef.current) supabase.removeChannel(channelRef.current)
    updateState("ended")
  }, [callId, send, updateState])

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0]
    if (track) { track.enabled = !track.enabled; return !track.enabled }
    return false
  }, [])

  const toggleCamera = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0]
    if (track) { track.enabled = !track.enabled; return !track.enabled }
    return false
  }, [])

  return { localStream, callState, endCall, toggleMute, toggleCamera }
}
