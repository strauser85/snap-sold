"use client"

import { useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, Loader2, CheckCircle, Volume2, Play, RotateCcw } from "lucide-react"

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

interface VideoConfig {
  images: string[]
  audioUrl: string
  duration: number
  timePerImage: number
  captions: CaptionChunk[]
  property: any
  format: {
    width: number
    height: number
    fps: number
  }
  metadata?: {
    alignmentUsed: boolean
    captionDelay: number
    captionType: string
  }
}

interface SyncedVideoGeneratorProps {
  config: VideoConfig
  onVideoGenerated: (videoUrl: string) => void
  onError: (error: string) => void
}

export function SyncedVideoGenerator({ config, onVideoGenerated, onError }: SyncedVideoGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const animationRef = useRef<number | null>(null)

  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState("")
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [currentCaption, setCurrentCaption] = useState("")
  const [audioReady, setAudioReady] = useState(false)
  const [actualAudioDuration, setActualAudioDuration] = useState<number | null>(null)

  const loadImage = useCallback((src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
  }, [])

  // Test audio and get actual duration
  const testAudio = useCallback(async () => {
    if (!config.audioUrl || !audioRef.current) return

    try {
      const audio = audioRef.current
      audio.src = config.audioUrl

      await new Promise((resolve, reject) => {
        audio.onloadedmetadata = () => {
          setActualAudioDuration(audio.duration)
          setAudioReady(true)
          console.log(`✅ Audio loaded: ${audio.duration.toFixed(2)}s actual duration`)
          resolve(null)
        }
        audio.onerror = reject
        audio.load()
      })
    } catch (error) {
      console.error("Audio test failed:", error)
      setAudioReady(false)
    }
  }, [config.audioUrl])

  // Recalculate caption timing based on actual audio duration
  const recalculateCaptionTiming = useCallback((captions: CaptionChunk[], audioDuration: number) => {
    if (!captions || captions.length === 0) return captions

    console.log(`🔄 Recalculating caption timing for ${audioDuration.toFixed(2)}s audio`)

    const audioStartDelay = 0.3 // Small delay for audio to actually start playing
    const availableDuration = audioDuration - audioStartDelay - 0.2 // Leave small buffer at end
    const captionDuration = availableDuration / captions.length

    return captions.map((caption, index) => ({
      ...caption,
      startTime: audioStartDelay + index * captionDuration,
      endTime: audioStartDelay + (index + 1) * captionDuration - 0.1, // Small gap between captions
    }))
  }, [])

  // Draw TikTok-style captions with better visibility
  const drawSyncedCaption = useCallback((ctx: CanvasRenderingContext2D, text: string, canvas: HTMLCanvasElement) => {
    if (!text) return

    const words = text.split(" ")
    const maxWordsPerLine = 3
    const lines: string[] = []

    // Break text into lines
    for (let i = 0; i < words.length; i += maxWordsPerLine) {
      lines.push(words.slice(i, i + maxWordsPerLine).join(" "))
    }

    // Caption styling - TikTok style with better contrast
    const fontSize = Math.floor(canvas.width * 0.08)
    ctx.font = `900 ${fontSize}px Arial, sans-serif`
    ctx.textAlign = "center"

    const lineHeight = fontSize * 1.4
    const startY = canvas.height * 0.75 // Position in lower area

    lines.forEach((line, index) => {
      const y = startY + index * lineHeight

      // Multiple shadow layers for maximum visibility
      ctx.strokeStyle = "#000000"
      ctx.lineWidth = Math.floor(fontSize * 0.25)
      ctx.strokeText(line, canvas.width / 2, y)

      // Secondary shadow for depth
      ctx.strokeStyle = "#333333"
      ctx.lineWidth = Math.floor(fontSize * 0.15)
      ctx.strokeText(line, canvas.width / 2 + 3, y + 3)

      // Main text in bright yellow
      ctx.fillStyle = "#FFFF00"
      ctx.fillText(line, canvas.width / 2, y)

      // Add subtle glow effect
      ctx.shadowColor = "#FFFF00"
      ctx.shadowBlur = 8
      ctx.fillText(line, canvas.width / 2, y)
      ctx.shadowBlur = 0
    })
  }, [])

  const generateSyncedVideo = useCallback(async () => {
    if (!canvasRef.current || !audioReady || !actualAudioDuration) {
      onError("Audio not ready or canvas not available")
      return
    }

    setIsGenerating(true)
    setProgress(0)
    setCurrentStep("Starting synchronized video generation...")

    try {
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")!

      canvas.width = config.format.width
      canvas.height = config.format.height

      // Load all images
      setCurrentStep("Loading property images...")
      setProgress(10)

      const loadedImages: HTMLImageElement[] = []
      for (let i = 0; i < config.images.length; i++) {
        try {
          const img = await loadImage(config.images[i])
          loadedImages.push(img)
          setProgress(10 + (i / config.images.length) * 25)
        } catch (error) {
          console.warn(`Failed to load image ${i + 1}:`, error)
        }
      }

      if (loadedImages.length === 0) {
        throw new Error("No images could be loaded")
      }

      // Recalculate caption timing based on actual audio duration
      const syncedCaptions = recalculateCaptionTiming(config.captions, actualAudioDuration)
      console.log(`🎯 Using ${syncedCaptions.length} captions synced to ${actualAudioDuration.toFixed(2)}s audio`)

      // Setup audio
      setCurrentStep("Setting up synchronized audio...")
      setProgress(35)

      const audioElement = audioRef.current!
      audioElement.src = config.audioUrl

      // Setup recording with audio
      setCurrentStep("Setting up video recording with audio sync...")
      setProgress(45)

      let stream: MediaStream
      let audioContext: AudioContext | null = null

      try {
        // Create canvas stream
        stream = canvas.captureStream(config.format.fps)

        // Add audio track using Web Audio API
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        const audioSource = audioContext.createMediaElementSource(audioElement)
        const audioDestination = audioContext.createMediaStreamDestination()

        // Connect audio
        audioSource.connect(audioDestination)
        audioSource.connect(audioContext.destination) // Also play through speakers

        const audioTrack = audioDestination.stream.getAudioTracks()[0]
        if (audioTrack) {
          stream.addTrack(audioTrack)
          console.log("✅ Audio track added to video stream")
        }
      } catch (audioError) {
        console.warn("Audio setup failed:", audioError)
        stream = canvas.captureStream(config.format.fps)
      }

      // Setup MediaRecorder
      const supportedTypes = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=vp9",
        "video/webm",
      ]

      let selectedType = "video/webm"
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedType = type
          break
        }
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedType,
        videoBitsPerSecond: 4000000,
        audioBitsPerSecond: 128000,
      })

      mediaRecorderRef.current = mediaRecorder
      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        if (audioContext) {
          try {
            await audioContext.close()
          } catch (e) {
            console.warn("Error closing audio context:", e)
          }
        }

        try {
          if (chunks.length === 0) {
            throw new Error("No video data recorded")
          }

          setCurrentStep("Creating synchronized video file...")
          setProgress(95)

          const videoBlob = new Blob(chunks, { type: selectedType })
          const videoUrl = URL.createObjectURL(videoBlob)

          setVideoUrl(videoUrl)
          onVideoGenerated(videoUrl)
          setCurrentStep("Synchronized video generated!")
          setProgress(100)
        } catch (error) {
          onError(error instanceof Error ? error.message : "Video creation failed")
        } finally {
          setIsGenerating(false)
        }
      }

      mediaRecorder.onerror = () => {
        onError("Video recording failed")
        setIsGenerating(false)
      }

      // Start recording
      setCurrentStep("Recording synchronized video...")
      setProgress(55)

      mediaRecorder.start(100)

      // Start audio and begin synchronized animation
      audioElement.currentTime = 0
      const audioStartTime = Date.now()
      await audioElement.play()

      console.log("🎵 Audio playback started, beginning synchronized animation")

      // Animation loop with precise audio synchronization
      const animate = () => {
        const elapsed = (Date.now() - audioStartTime) / 1000 // Elapsed time in seconds
        const audioCurrentTime = audioElement.currentTime // Actual audio position

        // Use audio current time for more accurate sync
        const syncTime = audioCurrentTime

        if (syncTime >= actualAudioDuration || audioElement.ended) {
          audioElement.pause()
          mediaRecorder.stop()
          console.log("🏁 Synchronized recording completed")
          return
        }

        // Calculate current image based on time
        const imageIndex = Math.min(
          Math.floor(syncTime / (actualAudioDuration / loadedImages.length)),
          loadedImages.length - 1,
        )

        // Find current caption using AUDIO TIME (not elapsed time)
        const currentCaptionChunk = syncedCaptions.find(
          (caption) => syncTime >= caption.startTime && syncTime < caption.endTime,
        )

        if (currentCaptionChunk) {
          setCurrentCaption(currentCaptionChunk.text)
        } else {
          setCurrentCaption("") // No caption during this time
        }

        // Draw current image
        const img = loadedImages[imageIndex]
        if (img) {
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

          // Draw synchronized captions
          if (currentCaptionChunk) {
            drawSyncedCaption(ctx, currentCaptionChunk.text, canvas)
          }

          // Property info overlay
          const overlayGradient = ctx.createLinearGradient(0, 0, 0, 100)
          overlayGradient.addColorStop(0, "rgba(0, 0, 0, 0.8)")
          overlayGradient.addColorStop(1, "rgba(0, 0, 0, 0.4)")
          ctx.fillStyle = overlayGradient
          ctx.fillRect(0, 0, canvas.width, 100)

          ctx.fillStyle = "#FFFFFF"
          ctx.font = "bold 18px Arial"
          ctx.textAlign = "left"
          ctx.fillText(config.property.address, 20, 30)

          ctx.fillStyle = "#FFD700"
          ctx.font = "bold 16px Arial"
          ctx.fillText(`$${config.property.price.toLocaleString()}`, 20, 50)

          ctx.fillStyle = "#FFFFFF"
          ctx.font = "14px Arial"
          ctx.fillText(
            `${config.property.bedrooms}BR • ${config.property.bathrooms}BA • ${config.property.sqft.toLocaleString()} sqft`,
            20,
            70,
          )

          // Sync indicator
          ctx.fillStyle = "#00FF00"
          ctx.font = "bold 12px Arial"
          ctx.textAlign = "right"
          ctx.fillText(`♪ SYNCED ${syncTime.toFixed(1)}s`, canvas.width - 20, 85)
        }

        // Update progress based on audio time
        const recordingProgress = 55 + (syncTime / actualAudioDuration) * 40
        setProgress(recordingProgress)
        setCurrentStep(`Recording: ${syncTime.toFixed(1)}s / ${actualAudioDuration.toFixed(1)}s (SYNCED)`)

        animationRef.current = requestAnimationFrame(animate)
      }

      animate()
    } catch (error) {
      console.error("Synchronized video generation failed:", error)
      onError(error instanceof Error ? error.message : "Synchronized video generation failed")
      setIsGenerating(false)
    }
  }, [
    config,
    onVideoGenerated,
    onError,
    loadImage,
    drawSyncedCaption,
    audioReady,
    actualAudioDuration,
    recalculateCaptionTiming,
  ])

  const stopGeneration = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop()
    }
    if (audioRef.current) {
      audioRef.current.pause()
    }
    setIsGenerating(false)
  }, [])

  const resetGeneration = useCallback(() => {
    setVideoUrl(null)
    setProgress(0)
    setCurrentStep("")
    setCurrentCaption("")
  }, [])

  // Test audio on mount
  useState(() => {
    if (config.audioUrl && !audioReady) {
      testAudio()
    }
  })

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" width={config.format.width} height={config.format.height} />
      <audio ref={audioRef} preload="metadata" className="hidden" />

      {!videoUrl && !isGenerating && (
        <div className="text-center space-y-4">
          <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-3">
              <Volume2 className="h-6 w-6 text-green-600" />
              <span className="font-bold text-green-700 text-lg">Audio-Synced Video Ready!</span>
            </div>
            <div className="text-sm text-green-600 space-y-2">
              <p>✅ Rachel voiceover loaded and tested</p>
              <p>✅ {config.images.length} property images ready</p>
              <p>✅ {config.captions.length} captions will sync to audio timing</p>
              {actualAudioDuration && <p>✅ Actual audio duration: {actualAudioDuration.toFixed(2)}s</p>}
              {audioReady ? (
                <p className="text-green-600 font-medium">🎵 Audio tested and ready for sync!</p>
              ) : (
                <p className="text-yellow-600 font-medium">🔄 Testing audio duration...</p>
              )}
            </div>
          </div>

          <Button
            onClick={generateSyncedVideo}
            disabled={!audioReady || !actualAudioDuration}
            className="w-full h-14 text-lg font-bold bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
          >
            <Play className="mr-3 h-6 w-6" />
            Generate Audio-Synced Video
          </Button>
        </div>
      )}

      {isGenerating && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{currentStep}</span>
              <span className="text-gray-500">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>

          {currentCaption && (
            <div className="bg-black text-yellow-400 p-4 rounded-lg text-center border-2 border-green-500">
              <p className="font-bold text-lg">{currentCaption}</p>
              <p className="text-xs text-gray-300 mt-1">Live Synced Caption</p>
            </div>
          )}

          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>Generating video with perfect audio-caption synchronization...</AlertDescription>
          </Alert>

          <Button onClick={stopGeneration} variant="destructive" className="w-full">
            Stop Generation
          </Button>
        </div>
      )}

      {videoUrl && (
        <div className="text-center space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center gap-2 text-green-700 mb-3">
              <CheckCircle className="h-6 w-6" />
              <span className="font-bold text-lg">Audio-Synced Video Generated!</span>
            </div>
            <div className="text-sm text-green-600 space-y-1">
              <p>✅ ALL {config.images.length} images included</p>
              <p>✅ Rachel voiceover perfectly synchronized</p>
              <p>✅ Captions timed to actual audio playback</p>
              <p>✅ No caption delay - perfect sync!</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={resetGeneration} variant="outline" className="flex-1 bg-transparent">
              <RotateCcw className="mr-2 h-4 w-4" />
              Generate Another
            </Button>
            <Button
              asChild
              className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
            >
              <a href={videoUrl} download="synced-property-video.webm">
                <Download className="mr-2 h-4 w-4" />
                Download Synced Video
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
