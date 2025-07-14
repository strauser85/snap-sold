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

  // Generate natural word timings
  const createNaturalWordTimings = useCallback((script: string, totalDuration: number): WordTiming[] => {
    const words = script
      .replace(/[^\w\s.,!?'-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0)

    const wordTimings: WordTiming[] = []
    let currentTime = 0.5

    words.forEach((word) => {
      let wordDuration = 0.35

      if (word.length > 6) wordDuration += 0.15
      if (word.length > 10) wordDuration += 0.2
      if (word.includes(",")) wordDuration += 0.2
      if (word.includes(".") || word.includes("!") || word.includes("?")) wordDuration += 0.4
      if (/\d/.test(word)) wordDuration += 0.15
      if (word.toLowerCase().includes("bedroom") || word.toLowerCase().includes("bathroom")) wordDuration += 0.1

      wordTimings.push({
        word: word,
        startTime: currentTime,
        endTime: currentTime + wordDuration,
      })

      currentTime += wordDuration + 0.05
    })

    const totalCalculatedTime = currentTime
    const scaleFactor = (totalDuration - 1) / totalCalculatedTime

    return wordTimings.map((timing) => ({
      ...timing,
      startTime: timing.startTime * scaleFactor,
      endTime: timing.endTime * scaleFactor,
    }))
  }, [])

  const createNaturalCaptions = useCallback((wordTimings: WordTiming[]): CaptionChunk[] => {
    const captions: CaptionChunk[] = []
    let currentPhrase: WordTiming[] = []

    wordTimings.forEach((wordTiming) => {
      currentPhrase.push(wordTiming)

      const isEndOfSentence = wordTiming.word.match(/[.!?]$/)
      const isCommaBreak = wordTiming.word.includes(",")
      const isPhraseLength = currentPhrase.length >= 4
      const isNaturalPause = ["and", "but", "with", "that", "this"].includes(wordTiming.word.toLowerCase())

      if (
        isEndOfSentence ||
        isPhraseLength ||
        (isCommaBreak && currentPhrase.length >= 2) ||
        (isNaturalPause && currentPhrase.length >= 3)
      ) {
        if (currentPhrase.length > 0) {
          captions.push({
            text: currentPhrase.map((w) => w.word).join(" "),
            words: [...currentPhrase],
            startTime: currentPhrase[0].startTime,
            endTime: currentPhrase[currentPhrase.length - 1].endTime,
          })
          currentPhrase = []
        }
      }
    })

    if (currentPhrase.length > 0) {
      captions.push({
        text: currentPhrase.map((w) => w.word).join(" "),
        words: [...currentPhrase],
        startTime: currentPhrase[0].startTime,
        endTime: currentPhrase[currentPhrase.length - 1].endTime,
      })
    }

    return captions
  }, [])

  // Draw captions
  const drawCaption = useCallback(
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
          if (currentTime >= wordTiming.startTime) {
            visibleText += wordTiming.word + " "
          }
        })
      } else {
        visibleText = text
      }

      if (!visibleText.trim()) return

      const fontSize = Math.floor(canvas.width * 0.07)
      ctx.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`
      ctx.textAlign = "center"

      const words = visibleText.trim().split(" ")
      const lines: string[] = []
      for (let i = 0; i < words.length; i += 3) {
        lines.push(words.slice(i, i + 3).join(" "))
      }

      const lineHeight = fontSize * 1.3
      const startY = canvas.height * 0.75

      lines.forEach((line, lineIndex) => {
        const y = startY + lineIndex * lineHeight

        const textMetrics = ctx.measureText(line)
        const textWidth = textMetrics.width
        const padding = fontSize * 0.4
        const boxWidth = textWidth + padding * 2
        const boxHeight = fontSize + padding * 0.8
        const boxX = (canvas.width - boxWidth) / 2
        const boxY = y - fontSize * 0.8

        ctx.fillStyle = "rgba(0, 0, 0, 0.85)"
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight)

        ctx.strokeStyle = "#000000"
        ctx.lineWidth = Math.floor(fontSize * 0.12)
        ctx.strokeText(line, canvas.width / 2, y)

        ctx.fillStyle = "#FFFF00"
        ctx.fillText(line, canvas.width / 2, y)
      })
    },
    [],
  )

  // Generate ElevenLabs audio
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

  // Main generation function with FIXED audio embedding
  const generateCompleteVideo = useCallback(async () => {
    try {
      if (!canvasRef.current) {
        throw new Error("Canvas not available")
      }

      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")!

      canvas.width = 576
      canvas.height = 1024

      console.log("🎬 Starting video generation with PROPER audio embedding")

      // Step 1: Generate audio
      const audioData = await generateAudio(propertyData.script)
      setProgress(20)

      if (!audioData.audioUrl) {
        throw new Error("Failed to generate audio")
      }

      // Step 2: Setup audio element
      const audio = audioRef.current!
      audio.src = audioData.audioUrl
      audio.preload = "auto"
      audio.crossOrigin = "anonymous"

      await new Promise((resolve, reject) => {
        audio.oncanplaythrough = resolve
        audio.onerror = reject
        audio.load()
      })

      setProgress(30)

      // Step 3: Create timing data
      const wordTimings = createNaturalWordTimings(propertyData.script, audioData.duration)
      const naturalCaptions = createNaturalCaptions(wordTimings)
      setProgress(40)

      // Step 4: Load images
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

      // Step 5: Setup recording with PROPER audio capture
      console.log("🎵 Setting up PROPER audio capture...")

      // Create canvas stream
      const canvasStream = canvas.captureStream(30)

      // Create audio context and capture audio properly
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

      // Create audio source from the audio element
      const audioSource = audioContext.createMediaElementSource(audio)

      // Create destination for capturing audio
      const audioDestination = audioContext.createMediaStreamDestination()

      // Connect audio source to destination (this captures the audio)
      audioSource.connect(audioDestination)

      // IMPORTANT: Also connect to speakers so we can hear it during generation
      audioSource.connect(audioContext.destination)

      // Create combined stream with both video and audio
      const combinedStream = new MediaStream()

      // Add video track
      canvasStream.getVideoTracks().forEach((track) => {
        combinedStream.addTrack(track)
      })

      // Add audio track
      audioDestination.stream.getAudioTracks().forEach((track) => {
        combinedStream.addTrack(track)
      })

      console.log(`🎵 Combined stream tracks: ${combinedStream.getTracks().length}`)
      console.log(`📹 Video tracks: ${combinedStream.getVideoTracks().length}`)
      console.log(`🔊 Audio tracks: ${combinedStream.getAudioTracks().length}`)

      // Use MediaRecorder with the combined stream
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: "video/webm;codecs=vp8,opus", // VP8 + Opus for better compatibility
        videoBitsPerSecond: 2000000,
        audioBitsPerSecond: 128000,
      })

      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      setProgress(70)

      // Setup recording handlers
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data)
          console.log(`📦 Chunk recorded: ${event.data.size} bytes`)
        }
      }

      mediaRecorder.onstop = async () => {
        console.log(`🏁 Recording stopped with ${chunksRef.current.length} chunks`)

        // Clean up audio context
        try {
          await audioContext.close()
        } catch (e) {
          console.warn("Error closing audio context:", e)
        }

        try {
          if (chunksRef.current.length === 0) {
            throw new Error("No video data recorded")
          }

          setProgress(95)

          // Create video blob
          const videoBlob = new Blob(chunksRef.current, {
            type: "video/webm",
          })

          console.log(`✅ Video blob created: ${videoBlob.size} bytes`)

          if (videoBlob.size === 0) {
            throw new Error("Generated video file is empty")
          }

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
        onError("Recording failed - please try again")
      }

      // Step 6: Start recording
      setProgress(75)

      console.log("🎬 Starting MediaRecorder...")
      mediaRecorder.start(100) // Record in small chunks

      // Start audio playback (NOT muted - we need the audio to be captured)
      audio.currentTime = 0
      audio.muted = false // IMPORTANT: Don't mute the audio!
      await audio.play()

      console.log("🎵 Audio playback started (unmuted for capture)")

      // Animation loop
      const startTime = Date.now()
      const durationMs = audioData.duration * 1000
      const timePerImageMs = Math.max(3000, Math.floor(durationMs / loadedImages.length))

      const animate = () => {
        const elapsed = Date.now() - startTime
        const elapsedSeconds = elapsed / 1000

        if (elapsed >= durationMs) {
          console.log("🏁 Animation complete - stopping recording")
          audio.pause()
          mediaRecorder.stop()
          return
        }

        // Calculate current image
        const imageIndex = Math.min(Math.floor(elapsed / timePerImageMs), loadedImages.length - 1)

        // Find current caption
        const currentCaptionChunk = naturalCaptions.find(
          (caption) => elapsedSeconds >= caption.startTime && elapsedSeconds < caption.endTime,
        )

        // Draw frame
        const img = loadedImages[imageIndex]
        if (img && img.complete) {
          // Clear canvas
          ctx.fillStyle = "#000000"
          ctx.fillRect(0, 0, canvas.width, canvas.height)

          // Draw image
          const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
          const scaledWidth = img.width * scale
          const scaledHeight = img.height * scale
          const x = (canvas.width - scaledWidth) / 2
          const y = (canvas.height - scaledHeight) / 2

          ctx.drawImage(img, x, y, scaledWidth, scaledHeight)

          // Draw caption
          if (currentCaptionChunk) {
            drawCaption(ctx, currentCaptionChunk.text, canvas, elapsedSeconds, currentCaptionChunk)
          }

          // Property overlay
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

        // Update progress
        const recordingProgress = 75 + (elapsed / durationMs) * 20
        setProgress(Math.min(recordingProgress, 95))

        animationRef.current = requestAnimationFrame(animate)
      }

      animate()
    } catch (error) {
      console.error("❌ Video generation failed:", error)
      onError(error instanceof Error ? error.message : "Video generation failed")
    }
  }, [
    propertyData,
    generateAudio,
    loadImage,
    createNaturalWordTimings,
    createNaturalCaptions,
    drawCaption,
    onVideoGenerated,
    onError,
  ])

  // Start generation when component mounts
  useEffect(() => {
    generateCompleteVideo()
  }, [generateCompleteVideo])

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" width={576} height={1024} />
      <audio ref={audioRef} preload="auto" className="hidden" />

      <div className="bg-white/80 backdrop-blur-sm border rounded-lg p-6 shadow-lg">
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-700 mb-4">{Math.round(progress)}%</div>
            <Progress value={progress} className="h-4" />
          </div>
        </div>
      </div>
    </div>
  )
}
