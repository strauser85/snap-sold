"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Download, Play, CheckCircle, Volume2 } from "lucide-react"

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

interface SimpleSlideshowGeneratorProps {
  config: SlideshowConfig
  onVideoGenerated: (videoUrl: string) => void
  onError: (error: string) => void
}

export function SimpleSlideshowGenerator({ config, onVideoGenerated, onError }: SimpleSlideshowGeneratorProps) {
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

      canvas.width = config.format.width
      canvas.height = config.format.height

      setCurrentStep("Loading images...")
      setProgress(10)

      // Load all images
      const images: HTMLImageElement[] = []
      for (let i = 0; i < config.images.length; i++) {
        const img = new Image()
        img.crossOrigin = "anonymous"

        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = config.images[i]
        })

        images.push(img)
        setProgress(10 + (i / config.images.length) * 30)
      }

      setCurrentStep("Setting up recording...")
      setProgress(40)

      // Setup recording
      const stream = canvas.captureStream(30)
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
      })

      const chunks: Blob[] = []
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" })
        const url = URL.createObjectURL(blob)
        setVideoUrl(url)
        onVideoGenerated(url)
        setCurrentStep("Video generated!")
        setProgress(100)
        setIsGenerating(false)
      }

      setCurrentStep("Recording video...")
      setProgress(50)

      // Setup audio
      const audio = new Audio(config.audioUrl)
      audio.preload = "auto"

      await new Promise((resolve) => {
        audio.oncanplaythrough = resolve
        audio.load()
      })

      // Start recording and audio
      mediaRecorder.start()
      audio.play()

      // Animation loop
      const startTime = Date.now()
      const animate = () => {
        const elapsed = Date.now() - startTime
        const imageIndex = Math.min(Math.floor(elapsed / (config.timePerImage * 1000)), images.length - 1)

        if (elapsed >= config.totalDuration * 1000) {
          audio.pause()
          mediaRecorder.stop()
          return
        }

        // Draw current image
        const img = images[imageIndex]
        if (img) {
          ctx.fillStyle = "#000"
          ctx.fillRect(0, 0, canvas.width, canvas.height)

          const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
          const w = img.width * scale
          const h = img.height * scale
          const x = (canvas.width - w) / 2
          const y = (canvas.height - h) / 2

          ctx.drawImage(img, x, y, w, h)
        }

        const recordProgress = 50 + (elapsed / (config.totalDuration * 1000)) * 45
        setProgress(recordProgress)
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
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-700 mb-2">
              <Volume2 className="h-5 w-5" />
              <span className="font-medium">ElevenLabs Audio Ready</span>
            </div>
            <div className="text-sm text-green-600">
              <p>✅ {config.images.length} images loaded</p>
              <p>✅ {config.totalDuration}s duration</p>
              <p>✅ High-quality voiceover</p>
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
        </div>
      )}

      {videoUrl && (
        <div className="text-center space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-700 mb-2">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Video Generated!</span>
            </div>
          </div>

          <Button asChild className="w-full">
            <a href={videoUrl} download="slideshow.webm">
              <Download className="mr-2 h-4 w-4" />
              Download Video
            </a>
          </Button>
        </div>
      )}
    </div>
  )
}
