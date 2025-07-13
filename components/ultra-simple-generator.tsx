"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Download, Play, CheckCircle, Volume2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface GeneratorConfig {
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

interface UltraSimpleGeneratorProps {
  config: GeneratorConfig
  onVideoGenerated: (videoUrl: string) => void
  onError: (error: string) => void
}

export function UltraSimpleGenerator({ config, onVideoGenerated, onError }: UltraSimpleGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState("")
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  const generateVideo = async () => {
    if (!canvasRef.current) {
      onError("Canvas not available")
      return
    }

    setIsGenerating(true)
    setProgress(0)
    setCurrentStep("Starting generation...")

    try {
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")!

      // Set canvas size
      canvas.width = config.format.width
      canvas.height = config.format.height

      setCurrentStep("Loading images...")
      setProgress(20)

      // Load images one by one
      const loadedImages: HTMLImageElement[] = []

      for (let i = 0; i < config.images.length; i++) {
        try {
          const img = new Image()
          img.crossOrigin = "anonymous"

          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = () => reject(new Error(`Failed to load image ${i + 1}`))
            img.src = config.images[i]
          })

          loadedImages.push(img)
          setProgress(20 + (i / config.images.length) * 30)
        } catch (error) {
          console.warn(`Image ${i + 1} failed to load, skipping:`, error)
        }
      }

      if (loadedImages.length === 0) {
        throw new Error("No images could be loaded")
      }

      setCurrentStep("Setting up recording...")
      setProgress(50)

      // Create media recorder
      const stream = canvas.captureStream(30)
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm",
      })

      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        try {
          if (chunks.length === 0) {
            throw new Error("No video data recorded")
          }

          const blob = new Blob(chunks, { type: "video/webm" })
          const url = URL.createObjectURL(blob)

          setVideoUrl(url)
          onVideoGenerated(url)
          setCurrentStep("Video generated successfully!")
          setProgress(100)
        } catch (error) {
          onError(error instanceof Error ? error.message : "Failed to create video")
        } finally {
          setIsGenerating(false)
        }
      }

      mediaRecorder.onerror = () => {
        onError("Recording failed")
        setIsGenerating(false)
      }

      setCurrentStep("Recording video...")
      setProgress(60)

      // Setup audio if available
      let audio: HTMLAudioElement | null = null
      if (config.audioUrl) {
        try {
          audio = new Audio(config.audioUrl)
          audio.preload = "auto"

          await new Promise<void>((resolve) => {
            audio!.oncanplaythrough = () => resolve()
            audio!.onerror = () => resolve() // Continue without audio if it fails
            audio!.load()
          })
        } catch (error) {
          console.warn("Audio setup failed, continuing without audio:", error)
          audio = null
        }
      }

      // Start recording
      mediaRecorder.start(100)

      // Start audio if available
      if (audio) {
        try {
          await audio.play()
        } catch (error) {
          console.warn("Audio playback failed:", error)
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
          if (audio) {
            audio.pause()
          }
          mediaRecorder.stop()
          return
        }

        // Calculate current image
        const imageIndex = Math.min(Math.floor(elapsed / timePerImageMs), loadedImages.length - 1)

        // Draw current image
        const img = loadedImages[imageIndex]
        if (img) {
          // Clear canvas with black background
          ctx.fillStyle = "#000000"
          ctx.fillRect(0, 0, canvas.width, canvas.height)

          // Calculate scaling to fit image in canvas
          const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
          const scaledWidth = img.width * scale
          const scaledHeight = img.height * scale
          const x = (canvas.width - scaledWidth) / 2
          const y = (canvas.height - scaledHeight) / 2

          // Draw image
          ctx.drawImage(img, x, y, scaledWidth, scaledHeight)

          // Add simple overlay
          ctx.fillStyle = "rgba(0, 0, 0, 0.5)"
          ctx.fillRect(10, 10, 100, 30)
          ctx.fillStyle = "#ffffff"
          ctx.font = "12px Arial"
          ctx.fillText(`${imageIndex + 1}/${loadedImages.length}`, 15, 25)
        }

        // Update progress
        const recordingProgress = 60 + (elapsed / totalDurationMs) * 35
        setProgress(recordingProgress)
        setCurrentStep(`Recording: ${(elapsed / 1000).toFixed(1)}s`)

        requestAnimationFrame(animate)
      }

      animate()
    } catch (error) {
      console.error("Generation failed:", error)
      onError(error instanceof Error ? error.message : "Generation failed")
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" />

      {!videoUrl && !isGenerating && (
        <div className="text-center space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-700 mb-2">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Ready to Generate!</span>
            </div>
            <div className="text-sm text-blue-600 space-y-1">
              <p>✅ {config.images.length} images loaded</p>
              <p>✅ {config.totalDuration}s duration</p>
              {config.audioUrl && (
                <p className="flex items-center gap-1">
                  <Volume2 className="h-3 w-3" />
                  ElevenLabs audio ready
                </p>
              )}
            </div>
          </div>

          <Button onClick={generateVideo} className="w-full" size="lg">
            <Play className="mr-2 h-4 w-4" />
            Generate Video
          </Button>
        </div>
      )}

      {isGenerating && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{currentStep}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Generating video with {config.images.length} images...</AlertDescription>
          </Alert>
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
              <p>✅ Video created successfully</p>
              <p>✅ Ready for download</p>
            </div>
          </div>

          <Button asChild className="w-full">
            <a href={videoUrl} download="property-video.webm">
              <Download className="mr-2 h-4 w-4" />
              Download Video
            </a>
          </Button>
        </div>
      )}
    </div>
  )
}
