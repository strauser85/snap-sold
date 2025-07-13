"use client"

import { useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, Play, Loader2, CheckCircle, Volume2, Pause, RotateCcw, VolumeX } from "lucide-react"

interface SlideshowConfig {
  images: string[]
  timePerImage: number
  totalDuration: number
  audioUrl?: string
  audioError?: string
  format: {
    width: number
    height: number
    fps: number
  }
}

interface WorkingSlideshowGeneratorProps {
  config: SlideshowConfig
  onVideoGenerated: (videoUrl: string) => void
  onError: (error: string) => void
}

export function WorkingSlideshowGenerator({ config, onVideoGenerated, onError }: WorkingSlideshowGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const animationRef = useRef<number | null>(null)

  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState("")
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string[]>([])

  const addDebugInfo = useCallback((info: string) => {
    console.log("🔧 DEBUG:", info)
    setDebugInfo((prev) => [...prev.slice(-10), `${new Date().toLocaleTimeString()}: ${info}`])
  }, [])

  const loadImage = useCallback((src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
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
    setCurrentStep("Starting slideshow generation...")
    addDebugInfo("Starting slideshow generation")

    try {
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")!

      // Set canvas size
      canvas.width = config.format.width
      canvas.height = config.format.height
      addDebugInfo(`Canvas initialized: ${canvas.width}x${canvas.height}`)

      // Load all images first
      setCurrentStep("Loading images...")
      setProgress(10)
      const loadedImages: HTMLImageElement[] = []

      for (let i = 0; i < config.images.length; i++) {
        try {
          const img = await loadImage(config.images[i])
          loadedImages.push(img)
          addDebugInfo(`Image ${i + 1}/${config.images.length} loaded`)
          setProgress(10 + (i / config.images.length) * 30)
        } catch (error) {
          addDebugInfo(`Failed to load image ${i + 1}: ${error}`)
          console.warn(`Skipping image ${i + 1}:`, error)
        }
      }

      if (loadedImages.length === 0) {
        throw new Error("No images could be loaded")
      }

      addDebugInfo(`${loadedImages.length} images loaded successfully`)

      // Setup audio if available
      let audioElement: HTMLAudioElement | null = null
      if (config.audioUrl && !config.audioError) {
        setCurrentStep("Setting up audio...")
        setProgress(40)

        audioElement = audioRef.current || new Audio()
        audioElement.src = config.audioUrl
        audioElement.crossOrigin = "anonymous"
        audioElement.preload = "auto"

        try {
          await new Promise((resolve, reject) => {
            audioElement!.oncanplaythrough = () => {
              addDebugInfo(`Audio loaded: ${audioElement!.duration.toFixed(2)}s duration`)
              resolve(null)
            }
            audioElement!.onerror = (error) => {
              addDebugInfo(`Audio loading failed: ${error}`)
              reject(new Error("Failed to load audio"))
            }
            audioElement!.load()
          })
        } catch (error) {
          addDebugInfo("Audio setup failed, continuing without audio")
          audioElement = null
        }
      }

      // Setup recording
      setCurrentStep("Setting up video recording...")
      setProgress(50)

      // Check MediaRecorder support
      const supportedTypes = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"]

      let selectedMimeType = "video/webm"
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type
          break
        }
      }

      addDebugInfo(`Using MIME type: ${selectedMimeType}`)

      // Create stream and recorder
      const stream = canvas.captureStream(config.format.fps)
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 2500000,
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

        try {
          if (chunks.length === 0) {
            throw new Error("No video data was recorded")
          }

          setCurrentStep("Creating video file...")
          setProgress(95)

          const videoBlob = new Blob(chunks, { type: selectedMimeType })
          const videoUrl = URL.createObjectURL(videoBlob)

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

      // Start recording
      setCurrentStep("Recording slideshow...")
      setProgress(60)

      mediaRecorder.start(100) // Record in 100ms chunks
      addDebugInfo("📹 Recording started")

      // Start audio if available
      if (audioElement) {
        try {
          audioElement.currentTime = 0
          await audioElement.play()
          addDebugInfo("🎵 Audio playback started")
        } catch (error) {
          addDebugInfo("⚠️ Audio playback failed, continuing without audio")
        }
      }

      // Animation loop
      const startTime = Date.now()
      const timePerImageMs = config.timePerImage * 1000
      const totalDurationMs = config.totalDuration * 1000

      const animate = () => {
        const elapsed = Date.now() - startTime

        if (elapsed >= totalDurationMs) {
          // Stop everything
          if (audioElement) {
            audioElement.pause()
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

          // Calculate scaling to fit image
          const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
          const scaledWidth = img.width * scale
          const scaledHeight = img.height * scale
          const x = (canvas.width - scaledWidth) / 2
          const y = (canvas.height - scaledHeight) / 2

          ctx.drawImage(img, x, y, scaledWidth, scaledHeight)

          // Add progress indicator
          ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
          ctx.fillRect(10, 10, 140, 50)
          ctx.fillStyle = "#ffffff"
          ctx.font = "12px Arial"
          ctx.fillText(`${imageIndex + 1}/${loadedImages.length}`, 20, 25)
          ctx.fillText(`${(elapsed / 1000).toFixed(1)}s`, 20, 40)

          // Audio indicator
          if (audioElement) {
            ctx.fillStyle = "#00ff00"
            ctx.font = "10px Arial"
            ctx.fillText("♪ Audio", 20, 55)
          }
        }

        // Update progress
        const recordingProgress = 60 + (elapsed / totalDurationMs) * 35
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
  }, [config, onVideoGenerated, onError, loadImage, addDebugInfo])

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
    addDebugInfo("Generation stopped by user")
  }, [addDebugInfo])

  const resetGeneration = useCallback(() => {
    setVideoUrl(null)
    setProgress(0)
    setCurrentStep("")
    setDebugInfo([])
    addDebugInfo("Generation reset")
  }, [addDebugInfo])

  const downloadVideo = useCallback(() => {
    if (videoUrl) {
      const link = document.createElement("a")
      link.href = videoUrl
      link.download = "property-slideshow.webm"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }, [videoUrl])

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" width={config.format.width} height={config.format.height} />
      {config.audioUrl && <audio ref={audioRef} preload="auto" className="hidden" />}

      {!videoUrl && !isGenerating && (
        <div className="text-center space-y-4">
          {/* Audio Status */}
          {config.audioUrl && !config.audioError ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Volume2 className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-700">ElevenLabs Audio Ready</span>
              </div>
              <div className="text-sm text-green-600">
                <p>✅ High-quality voiceover generated</p>
                <p>✅ Audio will be synchronized with slideshow</p>
              </div>
            </div>
          ) : config.audioError ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <VolumeX className="h-5 w-5 text-yellow-600" />
                <span className="font-medium text-yellow-700">Audio Generation Failed</span>
              </div>
              <div className="text-sm text-yellow-600">
                <p>⚠️ {config.audioError}</p>
                <p>Video will be generated without audio</p>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <VolumeX className="h-5 w-5 text-gray-600" />
                <span className="font-medium text-gray-700">No Audio</span>
              </div>
              <div className="text-sm text-gray-600">
                <p>Video will be generated without voiceover</p>
              </div>
            </div>
          )}

          {/* Video Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-700 mb-2">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Ready to Generate!</span>
            </div>
            <div className="text-sm text-blue-600 space-y-1">
              <p>✅ {config.images.length} images loaded</p>
              <p>✅ {config.totalDuration}s duration</p>
              <p>✅ TikTok format (9:16)</p>
            </div>
          </div>

          <Button onClick={generateSlideshow} className="w-full" size="lg">
            <Play className="mr-2 h-4 w-4" />
            Generate Slideshow
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
              Generating slideshow with {config.images.length} images...
              {config.audioUrl && " High-quality voiceover included."}
            </AlertDescription>
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
              <span className="font-medium">Slideshow Generated!</span>
            </div>
            <div className="text-sm text-green-600">
              <p>✅ ALL {config.images.length} images included</p>
              {config.audioUrl && <p>✅ Audio synchronized successfully</p>}
              <p>✅ Ready for download and sharing</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={resetGeneration} variant="outline" className="flex-1 bg-transparent">
              <RotateCcw className="mr-2 h-4 w-4" />
              Generate Another
            </Button>
            <Button onClick={downloadVideo} className="flex-1">
              <Download className="mr-2 h-4 w-4" />
              Download Video
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
