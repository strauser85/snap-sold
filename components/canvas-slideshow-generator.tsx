"use client"

import { useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, Play, Loader2, CheckCircle, AlertTriangle, Volume2, VolumeX } from "lucide-react"

interface SlideshowConfig {
  images: string[]
  timePerImage: number
  totalDuration: number
  audioUrl?: string
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
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState("")
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  const [audioStatus, setAudioStatus] = useState<"checking" | "found" | "missing" | "error">("checking")

  const addDebugInfo = (info: string) => {
    console.log("🔧 DEBUG:", info)
    setDebugInfo((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${info}`])
  }

  const checkAudioAvailability = useCallback(async () => {
    if (!config.audioUrl) {
      setAudioStatus("missing")
      addDebugInfo("No audio URL provided")
      return false
    }

    try {
      addDebugInfo(`Testing audio URL: ${config.audioUrl}`)
      const response = await fetch(config.audioUrl, { method: "HEAD" })

      if (response.ok) {
        addDebugInfo(`Audio URL accessible: ${response.status}`)
        setAudioStatus("found")
        return true
      } else {
        addDebugInfo(`Audio URL failed: ${response.status}`)
        setAudioStatus("error")
        return false
      }
    } catch (error) {
      addDebugInfo(`Audio URL error: ${error}`)
      setAudioStatus("error")
      return false
    }
  }, [config.audioUrl])

  const generateSlideshow = useCallback(async () => {
    if (!canvasRef.current) {
      onError("Canvas not available")
      return
    }

    setIsGenerating(true)
    setProgress(0)
    setDebugInfo([])
    setCurrentStep("Starting slideshow generation...")
    addDebugInfo("Slideshow generation started")

    try {
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")!

      // Set canvas size for TikTok format
      canvas.width = config.format.width
      canvas.height = config.format.height
      addDebugInfo(`Canvas size: ${canvas.width}x${canvas.height}`)

      // Check audio availability first
      setCurrentStep("Checking audio availability...")
      setProgress(5)
      const hasAudio = await checkAudioAvailability()
      addDebugInfo(`Audio available: ${hasAudio}`)

      setCurrentStep("Loading images...")
      setProgress(10)

      // Load all images
      const loadedImages: HTMLImageElement[] = []
      for (let i = 0; i < config.images.length; i++) {
        const img = new Image()
        img.crossOrigin = "anonymous"

        await new Promise((resolve, reject) => {
          img.onload = () => {
            addDebugInfo(`Image ${i + 1} loaded: ${img.width}x${img.height}`)
            resolve(null)
          }
          img.onerror = (error) => {
            addDebugInfo(`Image ${i + 1} failed to load`)
            reject(error)
          }
          img.src = config.images[i]
        })

        loadedImages.push(img)
        setProgress(10 + (i / config.images.length) * 20)
      }

      addDebugInfo(`All ${loadedImages.length} images loaded successfully`)

      setCurrentStep("Setting up recording...")
      setProgress(30)

      // Create MediaRecorder with audio support if available
      const stream = canvas.captureStream(config.format.fps)
      addDebugInfo(`Canvas stream created with ${stream.getTracks().length} tracks`)

      // Try to add audio track if available
      if (hasAudio && config.audioUrl) {
        try {
          setCurrentStep("Loading audio for real-time mixing...")
          setProgress(35)

          // Create audio element and try to capture its stream
          const audio = new Audio()
          audio.crossOrigin = "anonymous"
          audio.src = config.audioUrl
          audio.muted = true // Prevent actual playback during capture

          await new Promise((resolve, reject) => {
            audio.onloadeddata = resolve
            audio.onerror = reject
            audio.load()
          })

          // Try to capture audio stream (if supported)
          if (audio.captureStream) {
            const audioStream = audio.captureStream()
            const audioTracks = audioStream.getAudioTracks()

            if (audioTracks.length > 0) {
              stream.addTrack(audioTracks[0])
              addDebugInfo("Audio track added to stream successfully")
            } else {
              addDebugInfo("No audio tracks found in audio stream")
            }
          } else {
            addDebugInfo("Audio capture not supported by browser")
          }
        } catch (audioError) {
          addDebugInfo(`Audio integration failed: ${audioError}`)
        }
      }

      // Set up MediaRecorder
      const mimeType = hasAudio ? "video/webm;codecs=vp9,opus" : "video/webm;codecs=vp9"
      addDebugInfo(`Using MIME type: ${mimeType}`)

      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
          addDebugInfo(`Recorded chunk: ${event.data.size} bytes`)
        }
      }

      const recordingPromise = new Promise<Blob>((resolve) => {
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: "video/webm" })
          addDebugInfo(`Final video blob: ${blob.size} bytes`)
          resolve(blob)
        }
      })

      // Start recording
      mediaRecorder.start(1000) // Record in 1-second chunks
      addDebugInfo("Recording started")

      setCurrentStep("Recording slideshow...")
      setProgress(40)

      // If we have audio, start playing it for recording
      let audioElement: HTMLAudioElement | null = null
      if (hasAudio && config.audioUrl) {
        try {
          audioElement = new Audio()
          audioElement.crossOrigin = "anonymous"
          audioElement.src = config.audioUrl
          audioElement.volume = 1.0
          await audioElement.play()
          addDebugInfo("Audio playback started for recording")
        } catch (audioError) {
          addDebugInfo(`Audio playback failed: ${audioError}`)
        }
      }

      // Create slideshow animation
      let currentImageIndex = 0
      const startTime = Date.now()
      const timePerImageMs = config.timePerImage * 1000

      const animate = () => {
        const elapsed = Date.now() - startTime
        const totalDurationMs = config.totalDuration * 1000

        if (elapsed >= totalDurationMs) {
          // Stop audio
          if (audioElement) {
            audioElement.pause()
            addDebugInfo("Audio playback stopped")
          }
          // Stop recording
          mediaRecorder.stop()
          addDebugInfo("Recording stopped")
          return
        }

        // Calculate which image to show
        const imageIndex = Math.floor(elapsed / timePerImageMs)
        if (imageIndex < loadedImages.length) {
          currentImageIndex = imageIndex
        }

        // Clear canvas
        ctx.fillStyle = "#000000"
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Draw current image
        if (loadedImages[currentImageIndex]) {
          const img = loadedImages[currentImageIndex]

          // Calculate scaling to fit TikTok format
          const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
          const scaledWidth = img.width * scale
          const scaledHeight = img.height * scale
          const x = (canvas.width - scaledWidth) / 2
          const y = (canvas.height - scaledHeight) / 2

          ctx.drawImage(img, x, y, scaledWidth, scaledHeight)

          // Add image counter
          ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
          ctx.fillRect(10, 10, 120, 30)
          ctx.fillStyle = "#ffffff"
          ctx.font = "16px Arial"
          ctx.fillText(`${currentImageIndex + 1}/${loadedImages.length}`, 20, 30)

          // Add audio indicator
          if (hasAudio && audioElement && !audioElement.paused) {
            ctx.fillStyle = "rgba(255, 0, 0, 0.8)"
            ctx.fillRect(canvas.width - 40, 10, 30, 30)
            ctx.fillStyle = "#ffffff"
            ctx.font = "12px Arial"
            ctx.fillText("🎵", canvas.width - 35, 30)
          }
        }

        // Update progress
        const recordingProgress = 40 + (elapsed / totalDurationMs) * 50
        setProgress(recordingProgress)
        setCurrentStep(`Recording image ${currentImageIndex + 1}/${loadedImages.length}...`)

        requestAnimationFrame(animate)
      }

      animate()

      // Wait for recording to complete
      const videoBlob = await recordingPromise
      addDebugInfo("Recording completed successfully")

      setCurrentStep("Finalizing video...")
      setProgress(95)

      const finalUrl = URL.createObjectURL(videoBlob)
      setVideoUrl(finalUrl)
      onVideoGenerated(finalUrl)
      setCurrentStep("Slideshow completed!")
      setProgress(100)
      setIsGenerating(false)

      addDebugInfo("Slideshow generation completed successfully")
    } catch (error) {
      console.error("Slideshow generation failed:", error)
      addDebugInfo(`Generation failed: ${error}`)
      onError(error instanceof Error ? error.message : "Slideshow generation failed")
      setIsGenerating(false)
    }
  }, [config, onVideoGenerated, onError, checkAudioAvailability])

  // Test audio function
  const testAudio = useCallback(async () => {
    if (!config.audioUrl) return

    try {
      const audio = new Audio()
      audio.crossOrigin = "anonymous"
      audio.src = config.audioUrl
      await audio.play()
      addDebugInfo("Audio test playback successful")
    } catch (error) {
      addDebugInfo(`Audio test failed: ${error}`)
    }
  }, [config.audioUrl])

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" width={config.format.width} height={config.format.height} />

      {!videoUrl && !isGenerating && (
        <div className="text-center space-y-4">
          {/* Audio Status */}
          <div
            className={`border rounded-lg p-4 ${
              audioStatus === "found"
                ? "bg-green-50 border-green-200"
                : audioStatus === "missing"
                  ? "bg-yellow-50 border-yellow-200"
                  : audioStatus === "error"
                    ? "bg-red-50 border-red-200"
                    : "bg-gray-50 border-gray-200"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {audioStatus === "found" && <Volume2 className="h-5 w-5 text-green-600" />}
              {audioStatus === "missing" && <VolumeX className="h-5 w-5 text-yellow-600" />}
              {audioStatus === "error" && <AlertTriangle className="h-5 w-5 text-red-600" />}
              <span className="font-medium">
                Audio Status:{" "}
                {audioStatus === "found"
                  ? "✅ Available"
                  : audioStatus === "missing"
                    ? "⚠️ No Audio"
                    : audioStatus === "error"
                      ? "❌ Error"
                      : "🔍 Checking..."}
              </span>
            </div>
            {config.audioUrl && (
              <div className="flex gap-2">
                <Button onClick={checkAudioAvailability} variant="outline" size="sm">
                  Check Audio
                </Button>
                <Button onClick={testAudio} variant="outline" size="sm">
                  Test Audio
                </Button>
              </div>
            )}
          </div>

          {/* Generation Status */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-700 mb-2">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Slideshow Ready!</span>
            </div>
            <div className="text-sm text-green-600 space-y-1">
              <p>✅ {config.images.length} images loaded</p>
              <p>✅ {config.timePerImage}s per image</p>
              <p>✅ {config.totalDuration}s total duration</p>
              <p>✅ TikTok format (9:16)</p>
              {audioStatus === "found" && <p>✅ Audio will be included</p>}
              {audioStatus !== "found" && <p>⚠️ Video-only (no audio)</p>}
            </div>
          </div>

          <Button onClick={generateSlideshow} className="w-full" size="lg">
            <Play className="mr-2 h-4 w-4" />
            Generate Slideshow with ALL {config.images.length} Images
            {audioStatus === "found" && " + Audio"}
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
              Creating slideshow with {config.images.length} images...
              {audioStatus === "found" && " Audio integration in progress."}
            </AlertDescription>
          </Alert>

          {/* Debug Info */}
          <div className="bg-gray-50 border rounded-lg p-3 max-h-40 overflow-y-auto">
            <p className="text-xs font-medium text-gray-700 mb-2">Debug Log:</p>
            {debugInfo.map((info, index) => (
              <p key={index} className="text-xs text-gray-600 font-mono">
                {info}
              </p>
            ))}
          </div>
        </div>
      )}

      {videoUrl && (
        <div className="text-center space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-700 mb-2">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Video Generated!</span>
            </div>
            <div className="text-sm text-green-600">
              <p>✅ ALL {config.images.length} images included</p>
              <p>✅ {config.totalDuration} seconds duration</p>
              <p>✅ TikTok format ready</p>
              {audioStatus === "found" && <p>✅ Audio should be included</p>}
            </div>
          </div>

          <Button asChild className="w-full" size="lg">
            <a href={videoUrl} download="property-slideshow.webm">
              <Download className="mr-2 h-4 w-4" />
              Download Video
            </a>
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
    </div>
  )
}
