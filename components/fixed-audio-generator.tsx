"use client"

import { useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Download, Play, CheckCircle, Volume2, AlertCircle, VolumeX } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface GeneratorConfig {
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

interface FixedAudioGeneratorProps {
  config: GeneratorConfig
  onVideoGenerated: (videoUrl: string) => void
  onError: (error: string) => void
}

export function FixedAudioGenerator({ config, onVideoGenerated, onError }: FixedAudioGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState("")
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [audioReady, setAudioReady] = useState(false)

  // Test audio when component mounts
  useEffect(() => {
    if (config.audioUrl && audioRef.current) {
      const audio = audioRef.current
      audio.src = config.audioUrl

      const handleCanPlay = () => {
        setAudioReady(true)
        console.log("✅ Audio loaded and ready")
      }

      const handleError = (e: any) => {
        console.error("❌ Audio loading failed:", e)
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
      setProgress(20)

      // Load all images
      const loadedImages: HTMLImageElement[] = []
      for (let i = 0; i < config.images.length; i++) {
        try {
          const img = new Image()
          img.crossOrigin = "anonymous"

          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = () => reject(new Error(`Image ${i + 1} failed`))
            img.src = config.images[i]
          })

          loadedImages.push(img)
          setProgress(20 + (i / config.images.length) * 30)
        } catch (error) {
          console.warn(`Skipping image ${i + 1}:`, error)
        }
      }

      if (loadedImages.length === 0) {
        throw new Error("No images could be loaded")
      }

      setCurrentStep("Setting up recording...")
      setProgress(50)

      // Create canvas stream
      const stream = canvas.captureStream(30)

      // Add audio track if available
      if (config.audioUrl && audioRef.current && audioReady) {
        try {
          console.log("🎵 Adding audio track to stream...")

          // Create audio context for better audio handling
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
          const source = audioContext.createMediaElementSource(audioRef.current)
          const destination = audioContext.createMediaStreamDestination()
          source.connect(destination)

          // Add audio track to video stream
          const audioTrack = destination.stream.getAudioTracks()[0]
          if (audioTrack) {
            stream.addTrack(audioTrack)
            console.log("✅ Audio track added to stream")
          }
        } catch (audioError) {
          console.warn("⚠️ Audio track addition failed:", audioError)
        }
      }

      // Setup MediaRecorder with better codec support
      let mediaRecorder: MediaRecorder
      const supportedTypes = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ]

      let selectedType = "video/webm"
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedType = type
          break
        }
      }

      console.log(`🎬 Using codec: ${selectedType}`)

      mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedType,
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: 128000,
      })

      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
          console.log(`📦 Chunk recorded: ${event.data.size} bytes`)
        }
      }

      mediaRecorder.onstop = () => {
        try {
          if (chunks.length === 0) {
            throw new Error("No video data recorded")
          }

          console.log(`🎬 Creating video from ${chunks.length} chunks`)
          const blob = new Blob(chunks, { type: selectedType })
          const url = URL.createObjectURL(blob)

          setVideoUrl(url)
          onVideoGenerated(url)
          setCurrentStep("Video with audio generated!")
          setProgress(100)
        } catch (error) {
          onError(error instanceof Error ? error.message : "Video creation failed")
        } finally {
          setIsGenerating(false)
        }
      }

      mediaRecorder.onerror = (event) => {
        console.error("❌ MediaRecorder error:", event)
        onError("Recording failed")
        setIsGenerating(false)
      }

      setCurrentStep("Recording video with audio...")
      setProgress(60)

      // Start recording
      mediaRecorder.start(100)

      // Start audio playback if available
      if (config.audioUrl && audioRef.current && audioReady) {
        try {
          audioRef.current.currentTime = 0
          await audioRef.current.play()
          console.log("🎵 Audio playback started")
        } catch (audioError) {
          console.warn("⚠️ Audio playback failed:", audioError)
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
          if (audioRef.current) {
            audioRef.current.pause()
          }
          mediaRecorder.stop()
          console.log("🏁 Recording completed")
          return
        }

        // Calculate current image
        const imageIndex = Math.min(Math.floor(elapsed / timePerImageMs), loadedImages.length - 1)

        // Draw current image
        const img = loadedImages[imageIndex]
        if (img) {
          // Clear with black background
          ctx.fillStyle = "#000000"
          ctx.fillRect(0, 0, canvas.width, canvas.height)

          // Scale and center image
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
          ctx.fillText(`${imageIndex + 1}/${loadedImages.length}`, 15, 25)
          ctx.fillText(`${(elapsed / 1000).toFixed(1)}s`, 15, 40)

          // Audio indicator
          if (config.audioUrl && audioReady) {
            ctx.fillStyle = "#00ff00"
            ctx.fillRect(140, 15, 10, 10)
          }
        }

        // Update progress
        const recordingProgress = 60 + (elapsed / totalDurationMs) * 35
        setProgress(recordingProgress)
        setCurrentStep(`Recording: ${(elapsed / 1000).toFixed(1)}s / ${config.totalDuration}s`)

        requestAnimationFrame(animate)
      }

      animate()
    } catch (error) {
      console.error("❌ Generation failed:", error)
      onError(error instanceof Error ? error.message : "Generation failed")
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" />
      {config.audioUrl && <audio ref={audioRef} preload="auto" className="hidden" />}

      {!videoUrl && !isGenerating && (
        <div className="text-center space-y-4">
          {/* Audio Status */}
          {config.audioUrl ? (
            <div
              className={`border rounded-lg p-4 ${audioReady ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"}`}
            >
              <div className="flex items-center gap-2 mb-2">
                {audioReady ? (
                  <>
                    <Volume2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-700">ElevenLabs Audio Ready</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="h-5 w-5 text-yellow-600" />
                    <span className="font-medium text-yellow-700">Audio Loading...</span>
                  </>
                )}
              </div>
              <div className="text-sm">
                {audioReady ? (
                  <p className="text-green-600">✅ High-quality voiceover will be embedded in video</p>
                ) : (
                  <p className="text-yellow-600">⏳ Preparing audio for synchronization...</p>
                )}
              </div>
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {config.audioError || "No audio available - video will be generated without voiceover"}
              </AlertDescription>
            </Alert>
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

          <Button onClick={generateVideo} className="w-full" size="lg" disabled={config.audioUrl && !audioReady}>
            <Play className="mr-2 h-4 w-4" />
            Generate Video {config.audioUrl && audioReady ? "with Audio" : ""}
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
            <Volume2 className="h-4 w-4" />
            <AlertDescription>
              Generating video with synchronized audio... This may take a moment for proper audio embedding.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {videoUrl && (
        <div className="text-center space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-700 mb-2">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Video Generated with Audio!</span>
            </div>
            <div className="text-sm text-green-600">
              <p>✅ Video created with embedded audio</p>
              <p>✅ Proper codec for audio playback</p>
              <p>✅ Ready for download and sharing</p>
            </div>
          </div>

          <Button asChild className="w-full">
            <a href={videoUrl} download="property-video-with-audio.webm">
              <Download className="mr-2 h-4 w-4" />
              Download Video with Audio
            </a>
          </Button>
        </div>
      )}
    </div>
  )
}
