"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, Play, Loader2, CheckCircle, AlertTriangle, Volume2, VolumeX, Pause, RotateCcw } from "lucide-react"
import { createSafeVideoBlob, fixBlobUrl, downloadBlobSafely } from "@/lib/blob-utils"

interface SlideshowConfig {
  images: string[]
  timePerImage: number
  totalDuration: number
  audioUrl?: string
  audioMethod?: string
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
  const [audioStatus, setAudioStatus] = useState<"checking" | "elevenlabs" | "browser" | "missing" | "error">(
    "checking",
  )
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([])

  const addDebugInfo = useCallback((info: string) => {
    console.log("🔧 DEBUG:", info)
    setDebugInfo((prev) => [...prev.slice(-10), `${new Date().toLocaleTimeString()}: ${info}`])
  }, [])

  const checkAudioAvailability = useCallback(async () => {
    if (!config.audioUrl) {
      setAudioStatus("missing")
      addDebugInfo("No audio URL provided")
      return { hasAudio: false, method: "none", duration: 0 }
    }

    if (config.audioUrl.startsWith("data:audio/")) {
      setAudioStatus("elevenlabs")
      addDebugInfo("ElevenLabs audio detected")
      return { hasAudio: true, method: "elevenlabs", duration: config.totalDuration }
    } else if (config.audioUrl.startsWith("tts:")) {
      setAudioStatus("browser")
      addDebugInfo("Browser TTS fallback detected")
      return { hasAudio: true, method: "browser", duration: config.totalDuration }
    } else {
      setAudioStatus("error")
      addDebugInfo("Unknown audio format")
      return { hasAudio: false, method: "error", duration: 0 }
    }
  }, [config.audioUrl, config.totalDuration, addDebugInfo])

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

      // Check audio
      setCurrentStep("Checking audio...")
      setProgress(5)
      const audioInfo = await checkAudioAvailability()

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

      // Setup recording
      setCurrentStep("Setting up video recording...")
      setProgress(30)

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

      // Setup audio if available
      let audioElement: HTMLAudioElement | null = null
      if (audioInfo.hasAudio && config.audioUrl) {
        if (audioInfo.method === "elevenlabs") {
          audioElement = new Audio()
          audioElement.src = config.audioUrl
          audioElement.crossOrigin = "anonymous"
          audioElement.preload = "auto"

          try {
            await new Promise((resolve, reject) => {
              audioElement!.oncanplaythrough = resolve
              audioElement!.onerror = reject
              audioElement!.load()
            })
            addDebugInfo("ElevenLabs audio loaded")
          } catch (audioError) {
            addDebugInfo(`Audio loading failed: ${audioError}`)
            audioElement = null
          }
        }
      }

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
          setCurrentStep("Video generated successfully!")
          setProgress(100)
          addDebugInfo("✅ Video generation completed")
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

      // Start recording
      setCurrentStep("Starting recording...")
      setProgress(40)

      mediaRecorder.start(100) // Record in 100ms chunks
      addDebugInfo("📹 Recording started")

      // Start audio if available
      if (audioElement) {
        try {
          audioElement.currentTime = 0
          await audioElement.play()
          addDebugInfo("🎵 Audio playback started")
        } catch (audioError) {
          addDebugInfo(`Audio playback failed: ${audioError}`)
        }
      } else if (audioInfo.method === "browser" && config.audioUrl) {
        // Browser TTS
        const ttsText = config.audioUrl.replace("tts:", "")
        const utterance = new SpeechSynthesisUtterance(ttsText)
        utterance.rate = 0.9
        speechSynthesis.speak(utterance)
        addDebugInfo("🎵 Browser TTS started")
      }

      // Animation loop
      const startTime = Date.now()
      const timePerImageMs = config.timePerImage * 1000
      const totalDurationMs = config.totalDuration * 1000

      const animate = () => {
        const elapsed = Date.now() - startTime

        if (elapsed >= totalDurationMs) {
          // Stop recording
          if (audioElement) {
            audioElement.pause()
          }
          if (speechSynthesis.speaking) {
            speechSynthesis.cancel()
          }
          mediaRecorder.stop()
          addDebugInfo("🏁 Animation completed")
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

          // Add progress indicator
          ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
          ctx.fillRect(10, 10, 120, 40)
          ctx.fillStyle = "#ffffff"
          ctx.font = "12px Arial"
          ctx.fillText(`${imageIndex + 1}/${loadedImages.length}`, 20, 25)
          ctx.fillText(`${(elapsed / 1000).toFixed(1)}s`, 20, 40)
        }

        // Update progress
        const recordingProgress = 40 + (elapsed / totalDurationMs) * 50
        setProgress(recordingProgress)
        setCurrentStep(`Recording: ${(elapsed / 1000).toFixed(1)}s / ${config.totalDuration}s`)

        animationRef.current = requestAnimationFrame(animate)
      }

      animate()
    } catch (error) {
      console.error("Slideshow generation failed:", error)
      addDebugInfo(`❌ Generation failed: ${error}`)
      onError(error instanceof Error ? error.message : "Slideshow generation failed")
      setIsGenerating(false)
    }
  }, [config, onVideoGenerated, onError, checkAudioAvailability, loadImage, addDebugInfo])

  const stopGeneration = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop()
    }
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel()
    }
    setIsGenerating(false)
    addDebugInfo("Generation stopped by user")
  }, [addDebugInfo])

  const resetGeneration = useCallback(() => {
    setVideoUrl(null)
    setProgress(0)
    setCurrentStep("")
    setDebugInfo([])
    setRecordedChunks([])
    addDebugInfo("Generation reset")
  }, [addDebugInfo])

  useEffect(() => {
    checkAudioAvailability()
  }, [checkAudioAvailability])

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" width={config.format.width} height={config.format.height} />

      {!videoUrl && !isGenerating && (
        <div className="text-center space-y-4">
          {/* Audio Status */}
          <div
            className={`border rounded-lg p-4 ${
              audioStatus === "elevenlabs"
                ? "bg-green-50 border-green-200"
                : audioStatus === "browser"
                  ? "bg-blue-50 border-blue-200"
                  : audioStatus === "missing"
                    ? "bg-yellow-50 border-yellow-200"
                    : "bg-red-50 border-red-200"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {audioStatus === "elevenlabs" && <Volume2 className="h-5 w-5 text-green-600" />}
              {audioStatus === "browser" && <Volume2 className="h-5 w-5 text-blue-600" />}
              {audioStatus === "missing" && <VolumeX className="h-5 w-5 text-yellow-600" />}
              {audioStatus === "error" && <AlertTriangle className="h-5 w-5 text-red-600" />}
              <span className="font-medium">
                Audio:{" "}
                {audioStatus === "elevenlabs"
                  ? "✅ ElevenLabs Ready"
                  : audioStatus === "browser"
                    ? "🔄 Browser TTS Ready"
                    : audioStatus === "missing"
                      ? "⚠️ No Audio"
                      : "❌ Error"}
              </span>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-700 mb-2">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Ready to Generate!</span>
            </div>
            <div className="text-sm text-green-600 space-y-1">
              <p>✅ {config.images.length} images loaded</p>
              <p>✅ {config.totalDuration}s duration planned</p>
              <p>✅ TikTok format (9:16)</p>
            </div>
          </div>

          <Button onClick={generateSlideshow} className="w-full" size="lg">
            <Play className="mr-2 h-4 w-4" />
            Generate Video Slideshow
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
            <AlertDescription>Generating slideshow... This may take a few minutes.</AlertDescription>
          </Alert>

          <Button onClick={stopGeneration} variant="destructive" className="w-full">
            <Pause className="mr-2 h-4 w-4" />
            Stop Generation
          </Button>

          {/* Debug Info */}
          <details className="text-left">
            <summary className="text-sm text-gray-600 cursor-pointer">Show Debug Info</summary>
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
              <span className="font-medium">Video Generated Successfully!</span>
            </div>
            <div className="text-sm text-green-600">
              <p>✅ {config.images.length} images included</p>
              <p>✅ {recordedChunks.length} video chunks recorded</p>
              <p>✅ Ready for download</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={resetGeneration} variant="outline" className="flex-1 bg-transparent">
              <RotateCcw className="mr-2 h-4 w-4" />
              Generate Another
            </Button>
            <Button onClick={() => downloadBlobSafely(videoUrl, "slideshow.webm")} className="flex-1">
              <Download className="mr-2 h-4 w-4" />
              Download Video
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
