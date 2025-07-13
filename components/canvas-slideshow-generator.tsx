"use client"

import { useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, Play, Loader2, CheckCircle } from "lucide-react"

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

  const generateSlideshow = useCallback(async () => {
    if (!canvasRef.current) {
      onError("Canvas not available")
      return
    }

    setIsGenerating(true)
    setProgress(0)
    setCurrentStep("Initializing Canvas slideshow with audio...")

    try {
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")!

      // Set canvas size for TikTok format
      canvas.width = config.format.width
      canvas.height = config.format.height

      setCurrentStep("Loading images...")
      setProgress(10)

      // Load all images
      const loadedImages: HTMLImageElement[] = []
      for (let i = 0; i < config.images.length; i++) {
        const img = new Image()
        img.crossOrigin = "anonymous"

        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = config.images[i]
        })

        loadedImages.push(img)
        setProgress(10 + (i / config.images.length) * 20)
      }

      setCurrentStep("Setting up audio and video recording...")
      setProgress(30)

      // Create video stream from canvas
      const videoStream = canvas.captureStream(config.format.fps)

      // Create audio context and load audio if available
      let audioContext: AudioContext | null = null
      let audioBuffer: AudioBuffer | null = null
      let combinedStream = videoStream

      if (config.audioUrl) {
        try {
          setCurrentStep("Loading AI voiceover audio...")
          setProgress(35)

          // Load audio file
          const audioResponse = await fetch(config.audioUrl)
          const audioArrayBuffer = await audioResponse.arrayBuffer()

          // Create audio context
          audioContext = new AudioContext()
          audioBuffer = await audioContext.decodeAudioData(audioArrayBuffer)

          // Create audio stream
          const audioDestination = audioContext.createMediaStreamDestination()
          const audioSource = audioContext.createBufferSource()
          audioSource.buffer = audioBuffer
          audioSource.connect(audioDestination)

          // Combine video and audio streams
          const audioTrack = audioDestination.stream.getAudioTracks()[0]
          const videoTrack = videoStream.getVideoTracks()[0]

          combinedStream = new MediaStream([videoTrack, audioTrack])

          console.log("✅ Audio loaded and combined with video stream")
          setCurrentStep("Audio and video streams combined!")
          setProgress(40)
        } catch (audioError) {
          console.warn("Audio loading failed, continuing with video only:", audioError)
          setCurrentStep("Audio failed, creating video-only slideshow...")
        }
      }

      // Set up MediaRecorder with combined stream
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: "video/webm;codecs=vp9,opus",
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
        setCurrentStep("Slideshow with audio completed!")
        setProgress(100)
        setIsGenerating(false)

        // Clean up audio context
        if (audioContext) {
          audioContext.close()
        }
      }

      // Start recording
      mediaRecorder.start()
      setCurrentStep("Recording slideshow with audio...")
      setProgress(50)

      // Start audio playback if available
      if (audioContext && audioBuffer) {
        const audioSource = audioContext.createBufferSource()
        audioSource.buffer = audioBuffer
        audioSource.connect(audioContext.destination)
        audioSource.start()
        console.log("🎵 Audio playback started")
      }

      // Create slideshow animation
      let currentImageIndex = 0
      const startTime = Date.now()
      const timePerImageMs = config.timePerImage * 1000

      const animate = () => {
        const elapsed = Date.now() - startTime
        const totalDurationMs = config.totalDuration * 1000

        if (elapsed >= totalDurationMs) {
          // Slideshow complete
          mediaRecorder.stop()
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

          // Add audio indicator if audio is playing
          if (config.audioUrl) {
            ctx.fillStyle = "rgba(255, 0, 0, 0.8)"
            ctx.fillRect(canvas.width - 40, 10, 30, 30)
            ctx.fillStyle = "#ffffff"
            ctx.font = "12px Arial"
            ctx.fillText("🎵", canvas.width - 35, 30)
          }
        }

        // Update progress
        const recordingProgress = 50 + (elapsed / totalDurationMs) * 45
        setProgress(recordingProgress)
        setCurrentStep(`Recording image ${currentImageIndex + 1}/${loadedImages.length} with audio...`)

        requestAnimationFrame(animate)
      }

      animate()
    } catch (error) {
      console.error("Canvas slideshow generation failed:", error)
      onError(error instanceof Error ? error.message : "Slideshow generation failed")
      setIsGenerating(false)
    }
  }, [config, onVideoGenerated, onError])

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" width={config.format.width} height={config.format.height} />

      {!videoUrl && !isGenerating && (
        <div className="text-center space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-700 mb-2">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Canvas Slideshow Ready!</span>
            </div>
            <div className="text-sm text-green-600 space-y-1">
              <p>✅ {config.images.length} images loaded</p>
              <p>✅ {config.timePerImage}s per image</p>
              <p>✅ {config.totalDuration}s total duration</p>
              <p>✅ TikTok format (9:16)</p>
              {config.audioUrl && <p>✅ AI voiceover ready</p>}
            </div>
          </div>

          <Button onClick={generateSlideshow} className="w-full" size="lg">
            <Play className="mr-2 h-4 w-4" />
            Generate Slideshow with ALL {config.images.length} Images
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
              Creating slideshow with ALL {config.images.length} images... This may take {config.totalDuration} seconds.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {videoUrl && (
        <div className="text-center space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-700 mb-2">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Slideshow Generated Successfully!</span>
            </div>
            <div className="text-sm text-green-600">
              <p>✅ ALL {config.images.length} images used</p>
              <p>✅ {config.totalDuration} seconds duration</p>
              <p>✅ TikTok format ready</p>
            </div>
          </div>

          <Button asChild className="w-full" size="lg">
            <a href={videoUrl} download="property-slideshow.webm">
              <Download className="mr-2 h-4 w-4" />
              Download Slideshow Video
            </a>
          </Button>
        </div>
      )}
    </div>
  )
}
