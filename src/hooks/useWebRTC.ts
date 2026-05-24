"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

export type CallState = "calling" | "ringing" | "connected" | "ended"
export type CallEndReason = "ended" | "rejected" | "missed" | "error" | null

interface Options {
  callId: string
  currentUserId: string
  isInitiator: boolean
  callType: "audio" | "video"
  onStateChange?: (s: CallState) => void
  onEndReason?: (r: CallEndReason) => void
  onRemoteStream?: (stream: MediaStream) => void
}

// TURN servers multiples pour meilleure connectivité mobile ↔ PC
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  // TURN freemium — Metered (plus fiable qu'openrelay)
  {
    urls: [
      "turn:relay1.expressturn.com:3480",
      "turn:relay1.expressturn.com:3480?transport=tcp",
    ],
    username: "efIVAB8ZUPB4AAAAGN5FZQ",
    credential: "8UfzBPJHTYpEMn6e",
  },
  // TURN de secours
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
]

export function useWebRTC({
  callId, currentUserId, isInitiator, callType,
  onStateChange, onEndReason, onRemoteStream,
}: Options) {
  const supabase = createClient()
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const channelRef = useRef<any>(null)
  const pendingRef = useRef<RTCIceCandidateInit[]>([])
  const remoteSetRef = useRef(false)
  const mountedRef = useRef(true)
  const offerSentRef = useRef(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [callState, setCallState] = useState<CallState>(isInitiator ? "calling" : "ringing")

  const updateState = useCallback((s: CallState) => {
    if (!mountedRef.current) return
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

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    pcRef.current?.close()
    pcRef.current = null
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }, [])

  const getStream = useCallback(async (): Promise<MediaStream | null> => {
    // Essayer d'abord avec vidéo + audio, puis audio seul en fallback
    const constraints = [
      {
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
        video: callType === "video" ? {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: "user",
        } : false,
      },
      // Fallback sans constraints spécifiques
      { audio: true, video: callType === "video" },
      // Fallback audio only si vidéo échoue
      ...(callType === "video" ? [{ audio: true, video: false }] : []),
    ]

    for (const c of constraints) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(c as MediaStreamConstraints)
        console.log("✅ Stream obtenu:", stream.getTracks().map(t => `${t.kind}:${t.label}`))
        return stream
      } catch (err: any) {
        console.warn("getUserMedia échoué avec", JSON.stringify(c), "→", err.name)
      }
    }
    console.error("❌ Impossible d'obtenir le stream audio/video")
    return null
  }, [callType])

  const createPC = useCallback((stream: MediaStream) => {
    if (pcRef.current) {
      console.log("PC déjà créé, skip")
      return pcRef.current
    }

    console.log("🔧 Création RTCPeerConnection")
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    pcRef.current = pc

    // Ajouter tous les tracks du stream local
    stream.getTracks().forEach(track => {
      console.log("➕ Track ajouté:", track.kind, track.label)
      pc.addTrack(track, stream)
    })

    // Recevoir le stream distant
    pc.ontrack = (e) => {
      console.log("🎵 Track distant reçu:", e.track.kind, "streams:", e.streams.length)
      if (e.streams[0]) {
        onRemoteStream?.(e.streams[0])
      }
    }

    // Envoyer les ICE candidates
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        console.log("🧊 ICE candidate:", e.candidate.type, e.candidate.protocol)
        send("ice", { candidate: e.candidate.toJSON() })
      } else {
        console.log("🧊 ICE gathering terminé")
      }
    }

    pc.onicegatheringstatechange = () => {
      console.log("ICE gathering:", pc.iceGatheringState)
    }

    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection:", pc.iceConnectionState)
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        console.log("🎉 CONNECTÉ!")
        updateState("connected")
        supabase.from("calls")
          .update({ status: "active", started_at: new Date().toISOString() })
          .eq("id", callId)
      }
      if (pc.iceConnectionState === "failed") {
        console.log("❌ ICE failed, tentative restart...")
        pc.restartIce()
      }
      if (pc.iceConnectionState === "disconnected") {
        console.log("⚠️ ICE disconnected")
        // Attendre 5s avant de fermer
        setTimeout(() => {
          if (pc.iceConnectionState === "disconnected") updateState("ended")
        }, 5000)
      }
      if (pc.iceConnectionState === "closed") {
        updateState("ended")
      }
    }

    pc.onconnectionstatechange = () => {
      console.log("Connection state:", pc.connectionState)
    }

    return pc
  }, [callId, send, onRemoteStream, updateState])

  const makeOffer = useCallback(async (stream: MediaStream) => {
    if (offerSentRef.current || pcRef.current) return
    offerSentRef.current = true
    console.log("📤 Création de l'offer")
    const pc = createPC(stream)
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: callType === "video",
    })
    await pc.setLocalDescription(offer)
    console.log("📤 Offer envoyé, SDP type:", offer.type)
    send("offer", { sdp: pc.localDescription })
  }, [createPC, send, callType])

  useEffect(() => {
    mountedRef.current = true

    const init = async () => {
      const channel = supabase.channel(`rtc:${callId}`, {
        config: { broadcast: { self: false, ack: false } },
      })
      channelRef.current = channel

      // ── Callee reçoit l'offer ──────────────────────────
      channel.on("broadcast", { event: "offer" }, async ({ payload }) => {
        if (payload.from === currentUserId) return
        console.log("📨 Offer reçu du caller")

        const stream = await getStream()
        if (!stream || !mountedRef.current) return
        localStreamRef.current = stream
        if (mountedRef.current) setLocalStream(stream)

        const pc = createPC(stream)
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
        remoteSetRef.current = true

        // Appliquer les ICE en attente
        for (const c of pendingRef.current) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch {}
        }
        pendingRef.current = []

        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        console.log("📤 Answer envoyé")
        send("answer", { sdp: pc.localDescription })
      })

      // ── Caller reçoit l'answer ─────────────────────────
      channel.on("broadcast", { event: "answer" }, async ({ payload }) => {
        if (payload.from === currentUserId) return
        console.log("📨 Answer reçu du callee")
        const pc = pcRef.current
        if (pc && !remoteSetRef.current) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
          remoteSetRef.current = true
          for (const c of pendingRef.current) {
            try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch {}
          }
          pendingRef.current = []
        }
      })

      // ── ICE candidates ─────────────────────────────────
      channel.on("broadcast", { event: "ice" }, async ({ payload }) => {
        if (payload.from === currentUserId || !payload.candidate) return
        const pc = pcRef.current
        if (pc && remoteSetRef.current) {
          try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)) }
          catch (e) { console.warn("ICE candidate error:", e) }
        } else {
          console.log("⏳ ICE en attente (remote desc pas encore set)")
          pendingRef.current.push(payload.candidate)
        }
      })

      // ── Fin d'appel ────────────────────────────────────
      channel.on("broadcast", { event: "end_call" }, ({ payload }) => {
        if (payload.from === currentUserId) return
        console.log("📞 Fin d'appel reçu:", payload.reason)
        cleanup()
        onEndReason?.(payload.reason ?? "ended")
        updateState("ended")
      })

      // ── Ready signal ───────────────────────────────────
      channel.on("broadcast", { event: "ready" }, async ({ payload }) => {
        if (payload.from === currentUserId || !isInitiator) return
        console.log("✅ Callee prêt, envoi offer")

        const stream = await getStream()
        if (!stream || !mountedRef.current) return
        localStreamRef.current = stream
        if (mountedRef.current) setLocalStream(stream)
        makeOffer(stream)
      })

      channel.subscribe(async (status) => {
        if (status !== "SUBSCRIBED" || !mountedRef.current) return
        console.log("📡 Canal prêt, initiateur:", isInitiator)
        send("ready", {})

        // Fallback caller — envoie offer après 3s si ready pas reçu
        if (isInitiator) {
          setTimeout(async () => {
            if (!mountedRef.current || offerSentRef.current) return
            console.log("⏰ Fallback: envoi offer sans attendre ready")
            const stream = await getStream()
            if (!stream || !mountedRef.current) return
            localStreamRef.current = stream
            if (mountedRef.current) setLocalStream(stream)
            makeOffer(stream)
          }, 3000)
        }
      })
    }

    init()

    return () => {
      mountedRef.current = false
      cleanup()
    }
  }, [callId])

  const endCall = useCallback(async (reason: CallEndReason = "ended") => {
    send("end_call", { reason })
    await supabase.from("calls")
      .update({
        status: reason === "rejected" ? "rejected" : "ended",
        ended_at: new Date().toISOString(),
      })
      .eq("id", callId)
    cleanup()
    onEndReason?.(reason)
    updateState("ended")
  }, [callId, send, cleanup, updateState, onEndReason])

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
