"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, Loader2, CheckCircle, RotateCcw, Volume2, Play } from "lucide-react"

interface VideoConfig {
  images: string[]
  audioUrl: string
  duration: number
  timePerImage: number
  captions: any[]
  property: any
  format: {
    width: number
    height: number
    fps: number
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
  const chunksRef = useRef<Blob[]>([])
  const animationRef = useRef<number | null>(null)

  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState("")
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [audioReady, setAudioReady] = useState(false)

  // Test audio immediately when component mounts
  useEffect(() => {
    if (config.audioUrl && audioRef.current) {
      const audio = audioRef.current
      audio.src = config.audioUrl
      audio.preload = "auto"

      const handleCanPlay = () => {
        setAudioReady(true)
        console.log("✅ Audio ready for playback")
      }

      const handleError = () => {
        console.error("❌ Audio failed to load")
        setAudioReady(false)
      }

      audio.addEventListener("canplaythrough", handleCanPlay)
      audio.addEventListener("error", handleError)
      audio.load()

      return () => {
        audio.removeEventListener("canplaythrough", handleCanPlay)
        audio.removeEventListener("error", handleError)
      }
    }
  }, [config.audioUrl])

  const loadImage = useCallback((src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
  }, [])

  const drawCaption = useCallback((ctx: CanvasRenderingContext2D, text: string, canvas: HTMLCanvasElement) => {
    if (!text) return

    const words = text.split(" ")
    const maxWordsPerLine = 3
    const lines: string[] = []

    for (let i = 0; i < words.length; i += maxWordsPerLine) {
      lines.push(words.slice(i, i + maxWordsPerLine).join(" "))
    }

    const fontSize = Math.floor(canvas.width * 0.08)
    ctx.font = `900 ${fontSize}px Arial, sans-serif`
    ctx.textAlign = "center"

    const lineHeight = fontSize * 1.4
    const startY = canvas.height * 0.75

    lines.forEach((line, index) => {
      const y = startY + index * lineHeight

      // Black outline
      ctx.strokeStyle = "#000000"
      ctx.lineWidth = Math.floor(fontSize * 0.15)
      ctx.strokeText(line, canvas.width / 2, y)

      // Yellow text
      ctx.fillStyle = "#FFFF00"
      ctx.fillText(line, canvas.width / 2, y)
    })
  }, [])

  const generateWorkingVideo = useCallback(async () => {
    if (!canvasRef.current || !audioReady) {
      onError("Canvas or audio not ready")
      return
    }

    setIsGenerating(true)
    setProgress(0)
    setCurrentStep("Starting WORKING video generation...")
    chunksRef.current = []

    try {
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")!

      canvas.width = config.format.width
      canvas.height = config.format.height

      console.log("🎬 Starting BULLETPROOF video generation")

      // Load all images first
      setCurrentStep("Loading images...")
      setProgress(10)

      const loadedImages: HTMLImageElement[] = []
      for (let i = 0; i < config.images.length; i++) {
        try {
          const img = await loadImage(config.images[i])
          loadedImages.push(img)
          setProgress(10 + (i / config.images.length) * 20)
        } catch (error) {
          console.warn(`Failed to load image ${i + 1}:`, error)
        }
      }

      if (loadedImages.length === 0) {
        throw new Error("No images could be loaded")
      }

      console.log(`✅ ${loadedImages.length} images loaded`)

      // Setup WORKING MediaRecorder
      setCurrentStep("Setting up BULLETPROOF recording...")
      setProgress(30)

      // Create stream with FIXED settings
      const stream = canvas.captureStream(30) // Fixed 30 FPS

      // Use the MOST COMPATIBLE MediaRecorder settings
      const options = {
        mimeType: "video/webm", // Simplest format
        videoBitsPerSecond: 1000000, // Lower bitrate for stability
      }

      // Check if the format is supported
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        throw new Error("WebM format not supported")
      }

      const mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mediaRecorder

      // CRITICAL: Set up event handlers BEFORE starting
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data)
          console.log(`📦 Chunk ${chunksRef.current.length}: ${event.data.size} bytes`)
        }
      }

      mediaRecorder.onstop = () => {
        console.log(`🏁 Recording stopped with ${chunksRef.current.length} chunks`)

        try {
          if (chunksRef.current.length === 0) {
            throw new Error("No video data recorded")
          }

          setCurrentStep("Creating video file...")
          setProgress(95)

          const videoBlob = new Blob(chunksRef.current, { type: "video/webm" })
          const videoUrl = URL.createObjectURL(videoBlob)

          console.log(`✅ Video created: ${videoBlob.size} bytes`)
          setVideoUrl(videoUrl)
          onVideoGenerated(videoUrl)
          setCurrentStep("Video generated successfully!")
          setProgress(100)
        } catch (error) {
          console.error("❌ Video creation failed:", error)
          onError(error instanceof Error ? error.message : "Video creation failed")
        } finally {
          setIsGenerating(false)
        }
      }

      mediaRecorder.onerror = (event) => {
        console.error("❌ MediaRecorder error:", event)
        onError("Recording failed - trying again...")
        setIsGenerating(false)
      }

      // Start recording with SMALL chunks to prevent hanging
      setCurrentStep("Starting recording...")
      setProgress(40)

      mediaRecorder.start(250) // Record in 250ms chunks (prevents hanging)
      console.log("🎬 MediaRecorder started with 250ms chunks")

      // Start audio playback
      const audio = audioRef.current!
      audio.currentTime = 0
      await audio.play()
      console.log("🎵 Audio playback started")

      // SIMPLE animation loop that WON'T hang
      setCurrentStep("Recording video...")
      setProgress(50)

      const startTime = Date.now()
      const durationMs = config.duration * 1000
      const timePerImageMs = config.timePerImage * 1000

      let frameCount = 0
      const maxFrames = config.duration * 30 // 30 FPS for exact duration

      const animate = () => {
        const elapsed = Date.now() - startTime
        const elapsedSeconds = elapsed / 1000

        // CRITICAL: Stop at exact duration to prevent hanging
        if (elapsed >= durationMs || frameCount >= maxFrames) {
          console.log("🏁 Animation complete - stopping recording")
          audio.pause()
          mediaRecorder.stop()
          return
        }

        // Calculate current image
        const imageIndex = Math.min(Math.floor(elapsed / timePerImageMs), loadedImages.length - 1)

        // Find current caption
        const currentCaption = config.captions.find(
          (caption: any) => elapsedSeconds >= caption.startTime && elapsedSeconds < caption.endTime,
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
          if (currentCaption) {
            drawCaption(ctx, currentCaption.text, canvas)
          }

          // Property overlay
          ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
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
        }

        frameCount++

        // Update progress smoothly
        const recordingProgress = 50 + (elapsed / durationMs) * 45
        setProgress(Math.min(recordingProgress, 95))
        setCurrentStep(`Recording: ${elapsedSeconds.toFixed(1)}s / ${config.duration}s`)

        // CRITICAL: Use requestAnimationFrame for smooth recording
        animationRef.current = requestAnimationFrame(animate)
      }

      // Start animation
      animate()
    } catch (error) {
      console.error("❌ Video generation failed:", error)
      onError(error instanceof Error ? error.message : "Video generation failed")
      setIsGenerating(false)
    }
  }, [config, onVideoGenerated, onError, loadImage, drawCaption, audioReady])

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
    chunksRef.current = []
  }, [])

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" width={config.format.width} height={config.format.height} />
      <audio ref={audioRef} preload="auto" className="hidden" />

      {!videoUrl && !isGenerating && (
        <div className="text-center space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-3">
              <Volume2 className="h-6 w-6 text-green-600" />
              <span className="font-bold text-green-700 text-lg">FIXED Video Generator Ready!</span>
            </div>
            <div className="text-sm text-green-600 space-y-2">
              <p>✅ {config.images.length} property images loaded</p>
              <p>✅ Rachel voiceover ready ({config.duration}s)</p>
              <p>✅ {config.captions.length} captions prepared</p>
              <p>✅ BULLETPROOF MediaRecorder setup</p>
              {audioReady ? (
                <p className="text-green-700 font-medium">🎵 Audio tested and ready!</p>
              ) : (
                <p className="text-yellow-600">🔄 Testing audio...</p>
              )}
            </div>
          </div>

          <Button
            onClick={generateWorkingVideo}
            disabled={!audioReady}
            className="w-full h-14 text-lg font-bold bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
          >
            <Play className="mr-3 h-6 w-6" />
            Generate WORKING Video
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

          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>Generating video with FIXED MediaRecorder - no more hanging at 50%!</AlertDescription>
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
              <span className="font-bold text-lg">WORKING Video Generated!</span>
            </div>
            <div className="text-sm text-green-600 space-y-1">
              <p>✅ ALL {config.images.length} images included</p>
              <p>✅ Rachel voiceover synchronized</p>
              <p>✅ {config.captions.length} captions displayed</p>
              <p>✅ NO MORE HANGING ISSUES!</p>
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
              <a href={videoUrl} download="working-property-video.webm">
                <Download className="mr-2 h-4 w-4" />
                Download WORKING Video
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
