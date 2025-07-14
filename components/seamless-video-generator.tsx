"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { Progress } from "@/components/ui/progress"

interface PropertyData {
  address: string
  price: number
  bedrooms: number
  bathrooms: number
  sqft: number
  propertyDescription: string
  script: string
  imageUrls: string[]
}

interface SeamlessVideoGeneratorProps {
  propertyData: PropertyData
  onVideoGenerated: (videoUrl: string) => void
  onError: (error: string) => void
}

interface WordTiming {
  word: string
  startTime: number
  endTime: number
}

interface CaptionChunk {
  text: string
  words: WordTiming[]
  startTime: number
  endTime: number
}

interface HighlightCaption {
  text: string
  startTime: number
  endTime: number
  priority: number // 1-5, higher = more important
}

export function SeamlessVideoGenerator({ propertyData, onVideoGenerated, onError }: SeamlessVideoGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const animationRef = useRef<number | null>(null)

  const [progress, setProgress] = useState(0)

  const loadImage = useCallback((src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
  }, [])

  const createAccurateWordTimings = useCallback((script: string, totalDuration: number): WordTiming[] => {
    const words = script
      .replace(/[^\w\s.,!?'-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0)

    const wordTimings: WordTiming[] = []
    let currentTime = 0.1 // Minimal delay - ElevenLabs starts speaking almost immediately

    words.forEach((word, index) => {
      let wordDuration = 0.35 // Base duration for average word

      if (word.length <= 3)
        wordDuration = 0.25 // Short words
      else if (word.length <= 6)
        wordDuration = 0.35 // Medium words
      else if (word.length <= 10)
        wordDuration = 0.45 // Long words
      else wordDuration = 0.6 // Very long words

      if (word.includes(",")) wordDuration += 0.2
      if (word.includes(".") || word.includes("!") || word.includes("?")) wordDuration += 0.4

      if (/\d/.test(word)) wordDuration += 0.15

      if (word.toLowerCase().includes("bedroom") || word.toLowerCase().includes("bathroom")) {
        wordDuration += 0.1
      }

      wordTimings.push({
        word: word,
        startTime: currentTime,
        endTime: currentTime + wordDuration,
      })

      currentTime += wordDuration + 0.05
    })

    const totalCalculatedTime = currentTime
    const scaleFactor = totalDuration / totalCalculatedTime

    return wordTimings.map((timing) => ({
      ...timing,
      startTime: timing.startTime * scaleFactor,
      endTime: timing.endTime * scaleFactor,
    }))
  }, [])

  const createSyncedCaptions = useCallback((wordTimings: WordTiming[]): CaptionChunk[] => {
    const captions: CaptionChunk[] = []
    let currentPhrase: WordTiming[] = []

    wordTimings.forEach((wordTiming, index) => {
      currentPhrase.push(wordTiming)

      const isEndOfSentence = wordTiming.word.match(/[.!?]$/)
      const isCommaBreak = wordTiming.word.includes(",")
      const isPhraseLength = currentPhrase.length >= 3
      const isLastWord = index === wordTimings.length - 1

      if (isEndOfSentence || isPhraseLength || (isCommaBreak && currentPhrase.length >= 2) || isLastWord) {
        if (currentPhrase.length > 0) {
          captions.push({
            text: currentPhrase
              .map((w) => w.word)
              .join(" ")
              .toUpperCase(),
            words: [...currentPhrase],
            startTime: currentPhrase[0].startTime,
            endTime: currentPhrase[currentPhrase.length - 1].endTime,
          })
          currentPhrase = []
        }
      }
    })

    return captions
  }, [])

  const drawSyncedCaption = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      text: string,
      canvas: HTMLCanvasElement,
      currentTime: number,
      captionData: CaptionChunk,
    ) => {
      if (!text) return

      let visibleText = ""
      if (captionData.words) {
        captionData.words.forEach((wordTiming) => {
          if (currentTime >= wordTiming.startTime && currentTime <= wordTiming.endTime + 0.1) {
            visibleText += wordTiming.word + " "
          }
        })
      }

      if (!visibleText.trim()) return

      const fontSize = Math.floor(canvas.width * 0.08)
      ctx.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`
      ctx.textAlign = "center"

      const words = visibleText.trim().split(" ")
      const lines: string[] = []
      for (let i = 0; i < words.length; i += 3) {
        lines.push(words.slice(i, i + 3).join(" "))
      }

      const lineHeight = fontSize * 1.4
      const startY = canvas.height * 0.72

      lines.forEach((line, lineIndex) => {
        const y = startY + lineIndex * lineHeight

        const textMetrics = ctx.measureText(line)
        const textWidth = textMetrics.width
        const padding = fontSize * 0.5
        const boxWidth = textWidth + padding * 2
        const boxHeight = fontSize + padding
        const boxX = (canvas.width - boxWidth) / 2
        const boxY = y - fontSize * 0.9

        ctx.fillStyle = "rgba(0, 0, 0, 0.9)"
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight)

        ctx.strokeStyle = "#000000"
        ctx.lineWidth = Math.floor(fontSize * 0.15)
        ctx.strokeText(line, canvas.width / 2, y)

        ctx.fillStyle = "#FFFF00"
        ctx.fillText(line, canvas.width / 2, y)
      })
    },
    [],
  )

  const extractHighlightCaptions = useCallback(
    (script: string, duration: number): HighlightCaption[] => {
      const highlights: HighlightCaption[] = []
      const scriptLower = script.toLowerCase()

      console.log("🎯 Extracting key highlights from script...")

      if (scriptLower.includes("attention") || scriptLower.includes("stop") || scriptLower.includes("look")) {
        highlights.push({
          text: "🔥 ATTENTION HOME BUYERS",
          startTime: 0.5,
          endTime: 3.5,
          priority: 5,
        })
      } else {
        highlights.push({
          text: "🏠 STUNNING PROPERTY ALERT",
          startTime: 0.5,
          endTime: 3.5,
          priority: 5,
        })
      }

      const bedroomText = propertyData.bedrooms === 1 ? "1 BEDROOM" : `${propertyData.bedrooms} BEDROOMS`
      const bathroomText =
        propertyData.bathrooms === 1
          ? "1 BATH"
          : propertyData.bathrooms === 1.5
            ? "1.5 BATHS"
            : propertyData.bathrooms === 2.5
              ? "2.5 BATHS"
              : propertyData.bathrooms === 3.5
                ? "3.5 BATHS"
                : `${propertyData.bathrooms} BATHS`

      highlights.push({
        text: `${bedroomText}, ${bathroomText}`,
        startTime: duration * 0.15,
        endTime: duration * 0.25,
        priority: 4,
      })

      highlights.push({
        text: `${propertyData.sqft.toLocaleString()} SQ FT OF LUXURY`,
        startTime: duration * 0.25,
        endTime: duration * 0.35,
        priority: 4,
      })

      let featureText = "PREMIUM FEATURES THROUGHOUT"

      if (propertyData.propertyDescription) {
        const desc = propertyData.propertyDescription.toLowerCase()
        if (desc.includes("kitchen")) featureText = "LUXURY KITCHEN W/ UPGRADES"
        else if (desc.includes("pool")) featureText = "SPARKLING POOL + OUTDOOR SPACE"
        else if (desc.includes("garage")) featureText = "2-CAR GARAGE + STORAGE"
        else if (desc.includes("fireplace")) featureText = "COZY FIREPLACE + OPEN FLOOR PLAN"
        else if (desc.includes("master")) featureText = "SPACIOUS MASTER SUITE"
        else if (desc.includes("yard") || desc.includes("backyard")) featureText = "PRIVATE BACKYARD OASIS"
      } else if (scriptLower.includes("kitchen")) {
        featureText = "GOURMET KITCHEN W/ ISLAND"
      } else if (scriptLower.includes("garage")) {
        featureText = "ATTACHED GARAGE + DRIVEWAY"
      }

      highlights.push({
        text: featureText,
        startTime: duration * 0.35,
        endTime: duration * 0.55,
        priority: 3,
      })

      const locationParts = propertyData.address.split(",")
      const city = locationParts.length > 1 ? locationParts[1].trim().toUpperCase() : "PRIME LOCATION"

      highlights.push({
        text: `📍 ${city} – PRIME LOCATION`,
        startTime: duration * 0.55,
        endTime: duration * 0.7,
        priority: 3,
      })

      const priceText =
        propertyData.price >= 1000000
          ? `$${(propertyData.price / 1000000).toFixed(1)}M – INCREDIBLE VALUE`
          : `$${(propertyData.price / 1000).toFixed(0)}K – WON'T LAST LONG`

      highlights.push({
        text: priceText,
        startTime: duration * 0.7,
        endTime: duration * 0.85,
        priority: 5,
      })

      if (scriptLower.includes("dm") || scriptLower.includes("message")) {
        highlights.push({
          text: "📱 DM ME NOW!",
          startTime: duration * 0.85,
          endTime: duration - 0.5,
          priority: 5,
        })
      } else if (scriptLower.includes("call")) {
        highlights.push({
          text: "📞 CALL TODAY!",
          startTime: duration * 0.85,
          endTime: duration - 0.5,
          priority: 5,
        })
      } else {
        highlights.push({
          text: "💬 CONTACT ME TODAY!",
          startTime: duration * 0.85,
          endTime: duration - 0.5,
          priority: 4,
        })
      }

      console.log(`✅ Created ${highlights.length} highlight captions:`)
      highlights.forEach((h, i) => {
        console.log(`   ${i + 1}. "${h.text}" (${h.startTime.toFixed(1)}s - ${h.endTime.toFixed(1)}s)`)
      })

      return highlights
    },
    [propertyData],
  )

  const drawHighlightCaption = useCallback(
    (ctx: CanvasRenderingContext2D, caption: HighlightCaption, canvas: HTMLCanvasElement, currentTime: number) => {
      const { text, startTime, endTime } = caption

      let opacity = 1

      if (currentTime < startTime + 0.5) {
        opacity = (currentTime - startTime) / 0.5
      } else if (currentTime > endTime - 0.5) {
        opacity = (endTime - currentTime) / 0.5
      }

      opacity = Math.max(0, Math.min(1, opacity))

      if (opacity <= 0) return

      let fontSize = Math.floor(canvas.width * 0.09)

      if (text.length > 25) fontSize = Math.floor(canvas.width * 0.07)
      if (caption.priority >= 5) fontSize = Math.floor(canvas.width * 0.1)

      ctx.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`
      ctx.textAlign = "center"

      const words = text.split(" ")
      const lines: string[] = []

      if (words.length <= 4) {
        lines.push(text)
      } else {
        const midPoint = Math.ceil(words.length / 2)
        lines.push(words.slice(0, midPoint).join(" "))
        lines.push(words.slice(midPoint).join(" "))
      }

      const lineHeight = fontSize * 1.3
      const totalTextHeight = lines.length * lineHeight

      const startY = canvas.height * 0.75

      lines.forEach((line, lineIndex) => {
        const y = startY + lineIndex * lineHeight

        const textMetrics = ctx.measureText(line)
        const textWidth = textMetrics.width
        const padding = fontSize * 0.6
        const boxWidth = textWidth + padding * 2
        const boxHeight = fontSize + padding
        const boxX = (canvas.width - boxWidth) / 2
        const boxY = y - fontSize * 0.9

        ctx.fillStyle = `rgba(0, 0, 0, ${0.85 * opacity})`
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight)

        ctx.strokeStyle = `rgba(0, 0, 0, ${opacity})`
        ctx.lineWidth = Math.floor(fontSize * 0.2)
        ctx.strokeText(line, canvas.width / 2, y)

        ctx.strokeStyle = `rgba(0, 0, 0, ${0.7 * opacity})`
        ctx.lineWidth = Math.floor(fontSize * 0.1)
        ctx.strokeText(line, canvas.width / 2 + 3, y + 3)

        ctx.fillStyle = `rgba(255, 255, 0, ${opacity})`
        ctx.fillText(line, canvas.width / 2, y)

        if (caption.priority >= 4) {
          ctx.shadowColor = `rgba(255, 255, 0, ${0.5 * opacity})`
          ctx.shadowBlur = 10
          ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * opacity})`
          ctx.fillText(line, canvas.width / 2, y)
          ctx.shadowBlur = 0
        }
      })
    },
    [],
  )

  const generateAudio = useCallback(
    async (script: string) => {
      setProgress(10)

      const response = await fetch("/api/generate-complete-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(propertyData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || data.error || "Audio generation failed")
      }

      return data
    },
    [propertyData],
  )

  const generatePerfectVideo = useCallback(async () => {
    try {
      if (!canvasRef.current) {
        throw new Error("Canvas not available")
      }

      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")!

      canvas.width = 576
      canvas.height = 1024

      console.log("🎬 Starting video generation with HIGHLIGHT CAPTIONS")

      const audioData = await generateAudio(propertyData.script)
      setProgress(20)

      if (!audioData.audioUrl) {
        throw new Error("Failed to generate audio")
      }

      console.log(`🎵 Audio duration: ${audioData.duration}s`)

      const audio = audioRef.current!
      audio.src = audioData.audioUrl
      audio.preload = "auto"
      audio.crossOrigin = "anonymous"
      audio.volume = 1.0
      audio.muted = false

      await new Promise((resolve, reject) => {
        audio.oncanplaythrough = () => {
          console.log("✅ Audio loaded and ready at FULL VOLUME")
          resolve(null)
        }
        audio.onerror = reject
        audio.load()
      })

      setProgress(30)

      const highlightCaptions = extractHighlightCaptions(propertyData.script, audioData.duration)

      setProgress(40)

      const loadedImages: HTMLImageElement[] = []
      for (let i = 0; i < propertyData.imageUrls.length; i++) {
        try {
          const img = await loadImage(propertyData.imageUrls[i])
          loadedImages.push(img)
          setProgress(40 + (i / propertyData.imageUrls.length) * 20)
        } catch (error) {
          console.warn(`Failed to load image ${i + 1}:`, error)
        }
      }

      if (loadedImages.length === 0) {
        throw new Error("No images could be loaded")
      }

      setProgress(60)

      const canvasStream = canvas.captureStream(30)

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

      const audioSource = audioContext.createMediaElementSource(audio)

      const gainNode = audioContext.createGain()
      gainNode.gain.value = 2.0

      const audioDestination = audioContext.createMediaStreamDestination()

      audioSource.connect(gainNode)
      gainNode.connect(audioDestination)

      const combinedStream = new MediaStream()

      canvasStream.getVideoTracks().forEach((track) => {
        combinedStream.addTrack(track)
      })

      audioDestination.stream.getAudioTracks().forEach((track) => {
        combinedStream.addTrack(track)
        console.log(`🔊 BOOSTED audio track added: enabled=${track.enabled}`)
      })

      console.log(
        `🎵 Stream setup: ${combinedStream.getVideoTracks().length} video, ${combinedStream.getAudioTracks().length} audio`,
      )

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: "video/webm;codecs=vp9,opus",
        videoBitsPerSecond: 3000000,
        audioBitsPerSecond: 256000,
      })

      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      setProgress(70)

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        console.log(`🏁 Recording complete: ${chunksRef.current.length} chunks`)

        try {
          await audioContext.close()
        } catch (e) {
          console.warn("Audio context cleanup:", e)
        }

        try {
          if (chunksRef.current.length === 0) {
            throw new Error("No video data recorded")
          }

          setProgress(95)

          const videoBlob = new Blob(chunksRef.current, {
            type: "video/webm",
          })

          console.log(`✅ PERFECT video created: ${videoBlob.size} bytes with HIGHLIGHT CAPTIONS`)

          const videoUrl = URL.createObjectURL(videoBlob)
          setProgress(100)

          onVideoGenerated(videoUrl)
        } catch (error) {
          console.error("❌ Video creation failed:", error)
          onError(error instanceof Error ? error.message : "Video creation failed")
        }
      }

      mediaRecorder.onerror = (event) => {
        console.error("❌ MediaRecorder error:", event)
        onError("Recording failed")
      }

      setProgress(75)

      console.log("🎬 Starting SYNCHRONIZED recording...")

      mediaRecorder.start(100)

      await new Promise((resolve) => setTimeout(resolve, 100))

      audio.currentTime = 0
      await audio.play()

      console.log("🎵 Audio and video recording started SIMULTANEOUSLY")

      const recordingStartTime = Date.now()
      const durationMs = audioData.duration * 1000
      const timePerImageMs = Math.max(3000, Math.floor(durationMs / loadedImages.length))

      const animate = () => {
        const elapsed = Date.now() - recordingStartTime
        const elapsedSeconds = elapsed / 1000

        if (elapsed >= durationMs) {
          console.log("🏁 Animation complete - stopping recording")
          audio.pause()
          mediaRecorder.stop()
          return
        }

        const imageIndex = Math.min(Math.floor(elapsed / timePerImageMs), loadedImages.length - 1)

        const currentHighlight = highlightCaptions.find(
          (caption) => elapsedSeconds >= caption.startTime && elapsedSeconds < caption.endTime,
        )

        const img = loadedImages[imageIndex]
        if (img && img.complete) {
          ctx.fillStyle = "#000000"
          ctx.fillRect(0, 0, canvas.width, canvas.height)

          const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
          const scaledWidth = img.width * scale
          const scaledHeight = img.height * scale
          const x = (canvas.width - scaledWidth) / 2
          const y = (canvas.height - scaledHeight) / 2

          ctx.drawImage(img, x, y, scaledWidth, scaledHeight)

          if (currentHighlight) {
            drawHighlightCaption(ctx, currentHighlight, canvas, elapsedSeconds)
          }

          const overlayGradient = ctx.createLinearGradient(0, 0, 0, 100)
          overlayGradient.addColorStop(0, "rgba(0, 0, 0, 0.9)")
          overlayGradient.addColorStop(1, "rgba(0, 0, 0, 0.3)")
          ctx.fillStyle = overlayGradient
          ctx.fillRect(0, 0, canvas.width, 100)

          ctx.fillStyle = "#FFFFFF"
          ctx.font = "bold 18px Arial"
          ctx.textAlign = "left"
          ctx.fillText(propertyData.address, 20, 30)

          ctx.fillStyle = "#FFD700"
          ctx.font = "bold 16px Arial"
          ctx.fillText(`$${propertyData.price.toLocaleString()}`, 20, 50)

          ctx.fillStyle = "#FFFFFF"
          ctx.font = "14px Arial"
          ctx.fillText(
            `${propertyData.bedrooms}BR • ${propertyData.bathrooms}BA • ${propertyData.sqft.toLocaleString()} sqft`,
            20,
            70,
          )
        }

        const recordingProgress = 75 + (elapsed / durationMs) * 20
        setProgress(Math.min(recordingProgress, 95))

        animationRef.current = requestAnimationFrame(animate)
      }

      animate()
    } catch (error) {
      console.error("❌ PERFECT video generation failed:", error)
      onError(error instanceof Error ? error.message : "Video generation failed")
    }
  }, [
    propertyData,
    generateAudio,
    loadImage,
    extractHighlightCaptions,
    drawHighlightCaption,
    onVideoGenerated,
    onError,
  ])

  useEffect(() => {
    generatePerfectVideo()
  }, [generatePerfectVideo])

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" width={576} height={1024} />
      <audio ref={audioRef} preload="auto" className="hidden" />

      <div className="bg-white/80 backdrop-blur-sm border rounded-lg p-6 shadow-lg">
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-700 mb-4">{Math.round(progress)}%</div>
            <Progress value={progress} className="h-4" />
            <p className="text-sm text-gray-500 mt-2">Generating video with HIGHLIGHT CAPTIONS and FULL VOLUME audio</p>
          </div>
        </div>
      </div>
    </div>
  )
}
