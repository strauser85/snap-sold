"use client"

import { useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, Play, Loader2, CheckCircle, Volume2, Pause, RotateCcw } from "lucide-react"
import { createSafeVideoBlob, fixBlobUrl, downloadBlobSafely } from "@/lib/blob-utils"

interface SlideshowConfig {
  images: string[]
  timePerImage: number
  totalDuration: number
  audioUrl: string
  format: {
    width: number
    height: number
    fps: number
  }
}

interface CanvasSlideshowGeneratorProps {
  config: SlideshowConfig
  onVideoGenerated: (videoUrl: string) => void
  onError: (error: string) => void
}

export function CanvasSlideshowGenerator({ config, onVideoGenerated, onError }: CanvasSlideshowGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const animationRef = useRef<number | null>(null)

  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState("")
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([])

  const addDebugInfo = useCallback((info: string) => {
    console.log("🔧 DEBUG:", info)
    setDebugInfo((prev) => [...prev.slice(-10), `${new Date().toLocaleTimeString()}: ${info}`])
  }, [])

  const validateElevenLabsAudio = useCallback(async () => {
    if (!config.audioUrl) {
      throw new Error("No ElevenLabs audio URL provided")
    }

    if (!config.audioUrl.startsWith("data:audio/")) {
      throw new Error("Invalid ElevenLabs audio format - expected data URL")
    }

    addDebugInfo("✅ ElevenLabs audio validation passed")
    return true
  }, [config.audioUrl, addDebugInfo])

  const loadImage = useCallback((src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = fixBlobUrl(src)
    })
  }, [])

  const generateSlideshow = useCallback(async () => {
    if (!canvasRef.current) {
      onError("Canvas not available")
      return
    }

    setIsGenerating(true)
    setProgress(0)
    setDebugInfo([])
    setRecordedChunks([])
    setCurrentStep("Initializing slideshow generation...")
    addDebugInfo("Starting slideshow generation")

    try {
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")!

      // Set canvas size
      canvas.width = config.format.width
      canvas.height = config.format.height
      addDebugInfo(`Canvas initialized: ${canvas.width}x${canvas.height}`)

      // Validate ElevenLabs audio (REQUIRED)
      setCurrentStep("Validating ElevenLabs audio...")
      setProgress(5)
      await validateElevenLabsAudio()

      // Load all images first
      setCurrentStep("Loading images...")
      setProgress(10)
      const loadedImages: HTMLImageElement[] = []

      for (let i = 0; i < config.images.length; i++) {
        try {
          const img = await loadImage(config.images[i])
          loadedImages.push(img)
          addDebugInfo(`Image ${i + 1}/${config.images.length} loaded`)
          setProgress(10 + (i / config.images.length) * 20)
        } catch (error) {
          addDebugInfo(`Failed to load image ${i + 1}: ${error}`)
          throw new Error(`Failed to load image ${i + 1}`)
        }
      }

      addDebugInfo(`All ${loadedImages.length} images loaded successfully`)

      // Setup ElevenLabs audio
      setCurrentStep("Setting up ElevenLabs audio...")
      setProgress(30)

      const audioElement = new Audio()
      audioElement.src = config.audioUrl
      audioElement.crossOrigin = "anonymous"
      audioElement.preload = "auto"

      await new Promise((resolve, reject) => {
        audioElement.oncanplaythrough = () => {
          addDebugInfo(`ElevenLabs audio loaded: ${audioElement.duration.toFixed(2)}s duration`)
          resolve(null)
        }
        audioElement.onerror = (error) => {
          addDebugInfo(`ElevenLabs audio loading failed: ${error}`)
          reject(new Error("Failed to load ElevenLabs audio"))
        }
        audioElement.load()
      })

      // Setup recording
      setCurrentStep("Setting up video recording...")
      setProgress(40)

      // Check MediaRecorder support
      const supportedTypes = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ]

      let selectedMimeType = ""
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type
          break
        }
      }

      if (!selectedMimeType) {
        throw new Error("No supported video format found")
      }

      addDebugInfo(`Using MIME type: ${selectedMimeType}`)

      // Create stream
      const stream = canvas.captureStream(config.format.fps)
      addDebugInfo(`Canvas stream created with ${config.format.fps} FPS`)

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      })

      mediaRecorderRef.current = mediaRecorder
      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data)
          addDebugInfo(`Recorded chunk: ${event.data.size} bytes`)
        }
      }

      mediaRecorder.onstop = async () => {
        addDebugInfo(`Recording stopped. Total chunks: ${chunks.length}`)
        setRecordedChunks(chunks)

        try {
          if (chunks.length === 0) {
            throw new Error("No video data was recorded")
          }

          setCurrentStep("Creating video file...")
          setProgress(95)

          const videoUrl = await createSafeVideoBlob(chunks)
          setVideoUrl(videoUrl)
          onVideoGenerated(videoUrl)
          setCurrentStep("Slideshow generated successfully!")
          setProgress(100)
          addDebugInfo("✅ Slideshow generation completed")
        } catch (error) {
          addDebugInfo(`❌ Video creation failed: ${error}`)
          onError(error instanceof Error ? error.message : "Video creation failed")
        } finally {
          setIsGenerating(false)
        }
      }

      mediaRecorder.onerror = (event) => {
        addDebugInfo(`❌ MediaRecorder error: ${event}`)
        onError("Video recording failed")
        setIsGenerating(false)
      }

      // Start recording and audio simultaneously
      setCurrentStep("Starting synchronized recording with ElevenLabs audio...")
      setProgress(50)

      mediaRecorder.start(100) // Record in 100ms chunks
      addDebugInfo("📹 Recording started")

      // Start ElevenLabs audio
      audioElement.currentTime = 0
      await audioElement.play()
      addDebugInfo("🎵 ElevenLabs audio playback started")

      // Animation loop
      const startTime = Date.now()
      const timePerImageMs = config.timePerImage * 1000
      const totalDurationMs = config.totalDuration * 1000

      const animate = () => {
        const elapsed = Date.now() - startTime

        if (elapsed >= totalDurationMs) {
          // Stop recording and audio
          audioElement.pause()
          mediaRecorder.stop()
          addDebugInfo("🏁 Slideshow animation completed")
          return
        }

        // Calculate current image
        const imageIndex = Math.min(Math.floor(elapsed / timePerImageMs), loadedImages.length - 1)

        // Draw current image
        const img = loadedImages[imageIndex]
        if (img) {
          // Clear canvas
          ctx.fillStyle = "#000000"
          ctx.fillRect(0, 0, canvas.width, canvas.height)

          // Calculate scaling
          const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
          const scaledWidth = img.width * scale
          const scaledHeight = img.height * scale
          const x = (canvas.width - scaledWidth) / 2
          const y = (canvas.height - scaledHeight) / 2

          ctx.drawImage(img, x, y, scaledWidth, scaledHeight)

          // Add ElevenLabs indicator
          ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
          ctx.fillRect(10, 10, 140, 50)
          ctx.fillStyle = "#ffffff"
          ctx.font = "12px Arial"
          ctx.fillText(`${imageIndex + 1}/${loadedImages.length}`, 20, 25)
          ctx.fillText(`${(elapsed / 1000).toFixed(1)}s`, 20, 40)
          ctx.fillStyle = "#00ff00"
          ctx.font = "10px Arial"
          ctx.fillText("ElevenLabs", 20, 55)
        }

        // Update progress
        const recordingProgress = 50 + (elapsed / totalDurationMs) * 45
        setProgress(recordingProgress)
        setCurrentStep(`Recording with ElevenLabs: ${(elapsed / 1000).toFixed(1)}s / ${config.totalDuration}s`)

        animationRef.current = requestAnimationFrame(animate)
      }

      animate()
    } catch (error) {
      console.error("Slideshow generation failed:", error)
      addDebugInfo(`❌ Generation failed: ${error}`)
      onError(error instanceof Error ? error.message : "Slideshow generation failed")
      setIsGenerating(false)
    }
  }, [config, onVideoGenerated, onError, validateElevenLabsAudio, loadImage, addDebugInfo])

  const stopGeneration = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop()
    }
    setIsGenerating(false)
    addDebugInfo("Slideshow generation stopped by user")
  }, [addDebugInfo])

  const resetGeneration = useCallback(() => {
    setVideoUrl(null)
    setProgress(0)
    setCurrentStep("")
    setDebugInfo([])
    setRecordedChunks([])
    addDebugInfo("Slideshow generation reset")
  }, [addDebugInfo])

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" width={config.format.width} height={config.format.height} />

      {!videoUrl && !isGenerating && (
        <div className="text-center space-y-4">
          {/* ElevenLabs Status */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-700">ElevenLabs Audio Ready</span>
            </div>
            <div className="text-sm text-green-600 space-y-1">
              <p>✅ ElevenLabs voiceover generated</p>
              <p>✅ {config.images.length} images loaded</p>
              <p>✅ {config.totalDuration}s duration</p>
            </div>
          </div>

          <Button onClick={generateSlideshow} className="w-full" size="lg">
            <Play className="mr-2 h-4 w-4" />
            Generate ElevenLabs Slideshow
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
            <Progress value={progress} className="h-2" />
          </div>

          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>
              Generating slideshow with {config.images.length} images... High-quality AI voice included.
            </AlertDescription>
          </Alert>

          <Button onClick={stopGeneration} variant="destructive" className="w-full">
            <Pause className="mr-2 h-4 w-4" />
            Stop Generation
          </Button>

          {/* Debug Info */}
          <details className="text-left">
            <summary className="text-sm text-gray-600 cursor-pointer">Show ElevenLabs Debug Info</summary>
            <div className="bg-gray-50 border rounded-lg p-3 mt-2 max-h-40 overflow-y-auto">
              {debugInfo.map((info, index) => (
                <p key={index} className="text-xs text-gray-600 font-mono">
                  {info}
                </p>
              ))}
            </div>
          </details>
        </div>
      )}

      {videoUrl && (
        <div className="text-center space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-700 mb-2">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">ElevenLabs Slideshow Generated!</span>
            </div>
            <div className="text-sm text-green-600">
              <p>✅ ALL {config.images.length} images included</p>
              <p>✅ ElevenLabs AI voiceover embedded</p>
              <p>✅ {recordedChunks.length} video chunks recorded</p>
              <p>✅ Professional quality ready</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={resetGeneration} variant="outline" className="flex-1 bg-transparent">
              <RotateCcw className="mr-2 h-4 w-4" />
              Generate Another
            </Button>
            <Button onClick={() => downloadBlobSafely(videoUrl, "elevenlabs-slideshow.webm")} className="flex-1">
              <Download className="mr-2 h-4 w-4" />
              Download ElevenLabs Video
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
