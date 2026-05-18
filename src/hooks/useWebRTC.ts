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

export function useWebRTC({ callId, currentUserId, isInitiator, callType, onStateChange, onEndReason, onRemoteStream }: Options) {
  const supabase = createClient()
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const channelRef = useRef<any>(null)
  const pendingRef = useRef<RTCIceCandidateInit[]>([])
  const remoteSetRef = useRef(false)
  const offerCreated = useRef(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [callState, setCallState] = useState<CallState>(isInitiator ? "calling" : "ringing")

  const updateState = useCallback((s: CallState) => {
    setCallState(s); onStateChange?.(s)
  }, [onStateChange])

  const send = useCallback((event: string, data: any) => {
    channelRef.current?.send({ type: "broadcast", event, payload: { from: currentUserId, ...data } })
  }, [currentUserId])

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    pcRef.current?.close()
    if (channelRef.current) supabase.removeChannel(channelRef.current)
  }, [])

  const createPC = useCallback((stream: MediaStream) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
        { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
        { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
      ],
    })
    stream.getTracks().forEach(t => pc.addTrack(t, stream))
    pc.ontrack = (e) => { if (e.streams[0]) onRemoteStream?.(e.streams[0]) }
    pc.onicecandidate = (e) => { if (e.candidate) send("ice", { candidate: e.candidate.toJSON() }) }
    pc.oniceconnectionstatechange = () => {
      if (["connected","completed"].includes(pc.iceConnectionState)) {
        updateState("connected")
        supabase.from("calls").update({ status: "active", started_at: new Date().toISOString() }).eq("id", callId)
      }
      if (pc.iceConnectionState === "failed") pc.restartIce()
      if (["disconnected","closed"].includes(pc.iceConnectionState)) updateState("ended")
    }
    pcRef.current = pc
    return pc
  }, [callId, send, onRemoteStream, updateState])

  useEffect(() => {
    let mounted = true
    const init = async () => {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } : false,
        })
        localStreamRef.current = stream
        setLocalStream(stream)
      } catch (err) {
        console.error("getUserMedia:", err)
        onEndReason?.("error")
        return
      }
      if (!mounted) return

      const channel = supabase.channel(`rtc:${callId}`, { config: { broadcast: { self: false, ack: false } } })
      channelRef.current = channel

      channel
        .on("broadcast", { event: "offer" }, async ({ payload }) => {
          if (payload.from === currentUserId) return
          const pc = createPC(stream)
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
          remoteSetRef.current = true
          for (const c of pendingRef.current) { try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch {} }
          pendingRef.current = []
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          send("answer", { sdp: answer })
        })
        .on("broadcast", { event: "answer" }, async ({ payload }) => {
          if (payload.from === currentUserId) return
          const pc = pcRef.current
          if (pc && !remoteSetRef.current) {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
            remoteSetRef.current = true
            for (const c of pendingRef.current) { try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch {} }
            pendingRef.current = []
          }
        })
        .on("broadcast", { event: "ice" }, async ({ payload }) => {
          if (payload.from === currentUserId || !payload.candidate) return
          const pc = pcRef.current
          if (pc && remoteSetRef.current) { try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)) } catch {} }
          else pendingRef.current.push(payload.candidate)
        })
        .on("broadcast", { event: "end_call" }, ({ payload }) => {
          if (payload.from === currentUserId) return
          const reason = payload.reason ?? "ended"
          console.log("📞 Fin appel:", reason)
          onEndReason?.(reason)
          cleanup()
          updateState("ended")
        })
        .on("broadcast", { event: "ready" }, async ({ payload }) => {
          if (payload.from === currentUserId || !isInitiator || pcRef.current) return
          offerCreated.current = true
          const pc = createPC(stream)
          const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callType === "video" })
          await pc.setLocalDescription(offer)
          send("offer", { sdp: offer })
        })
        .subscribe(async (status) => {
          if (status !== "SUBSCRIBED") return
          send("ready", {})
          if (isInitiator) {
            setTimeout(async () => {
              if (!mounted || offerCreated.current) return
              offerCreated.current = true
              const pc = createPC(stream)
              const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callType === "video" })
              await pc.setLocalDescription(offer)
              send("offer", { sdp: offer })
            }, 2000)
          }
        })
    }
    init()
    return () => { mounted = false; cleanup() }
  }, [callId])

  const endCall = useCallback(async (reason: CallEndReason = "ended") => {
    send("end_call", { reason })
    await supabase.from("calls")
      .update({ status: reason === "rejected" ? "rejected" : "ended", ended_at: new Date().toISOString() })
      .eq("id", callId)
    cleanup()
    onEndReason?.(reason)
    updateState("ended")
  }, [callId, send, cleanup, updateState, onEndReason])

  const toggleMute = useCallback(() => {
    const t = localStreamRef.current?.getAudioTracks()[0]
    if (t) { t.enabled = !t.enabled; return !t.enabled }
    return false
  }, [])

  const toggleCamera = useCallback(() => {
    const t = localStreamRef.current?.getVideoTracks()[0]
    if (t) { t.enabled = !t.enabled; return !t.enabled }
    return false
  }, [])

  return { localStream, callState, endCall, toggleMute, toggleCamera }
}
