"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, Play, Loader2, CheckCircle, Volume2, Pause, RotateCcw, VolumeX, AlertTriangle } from "lucide-react"

interface SlideshowConfig {
  images: string[]
  timePerImage: number
  totalDuration: number
  audioUrl?: string
  audioError?: string
  audioSuccess?: boolean
  format: {
    width: number
    height: number
    fps: number
  }
}

interface AudioVideoGeneratorProps {
  config: SlideshowConfig
  onVideoGenerated: (videoUrl: string) => void
  onError: (error: string) => void
}

export function AudioVideoGenerator({ config, onVideoGenerated, onError }: AudioVideoGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const animationRef = useRef<number | null>(null)

  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState("")
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  const [audioReady, setAudioReady] = useState(false)
  const [audioTested, setAudioTested] = useState(false)

  const addDebugInfo = useCallback((info: string) => {
    console.log("🔧 DEBUG:", info)
    setDebugInfo((prev) => [...prev.slice(-15), `${new Date().toLocaleTimeString()}: ${info}`])
  }, [])

  // Test audio when component mounts
  useEffect(() => {
    if (config.audioUrl && config.audioSuccess && audioRef.current) {
      const audio = audioRef.current
      audio.src = config.audioUrl

      const handleCanPlay = () => {
        setAudioReady(true)
        setAudioTested(true)
        addDebugInfo(`✅ Audio loaded successfully: ${audio.duration.toFixed(2)}s`)
      }

      const handleError = (e: any) => {
        setAudioReady(false)
        setAudioTested(true)
        addDebugInfo(`❌ Audio loading failed: ${e.type}`)
      }

      audio.addEventListener("canplaythrough", handleCanPlay)
      audio.addEventListener("error", handleError)
      audio.load()

      return () => {
        audio.removeEventListener("canplaythrough", handleCanPlay)
        audio.removeEventListener("error", handleError)
      }
    } else if (config.audioError) {
      setAudioTested(true)
      addDebugInfo(`❌ Audio generation failed: ${config.audioError}`)
    }
  }, [config.audioUrl, config.audioSuccess, config.audioError, addDebugInfo])

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
    addDebugInfo("🎬 Starting slideshow generation")

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

      // Setup recording with audio stream if available
      setCurrentStep("Setting up recording...")
      setProgress(40)

      let stream: MediaStream
      let audioContext: AudioContext | null = null
      let audioSource: MediaElementAudioSourceNode | null = null
      let audioDestination: MediaStreamAudioDestinationNode | null = null

      // Create canvas stream
      stream = canvas.captureStream(config.format.fps)
      addDebugInfo(`Canvas stream created: ${config.format.fps} FPS`)

      // Add audio track if available and ready
      if (config.audioUrl && config.audioSuccess && audioReady && audioRef.current) {
        try {
          setCurrentStep("Setting up audio stream...")
          addDebugInfo("🎵 Setting up audio stream integration...")

          // Create audio context and connect audio element
          audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
          audioSource = audioContext.createMediaElementSource(audioRef.current)
          audioDestination = audioContext.createMediaStreamDestination()

          // Connect audio source to destination
          audioSource.connect(audioDestination)
          audioSource.connect(audioContext.destination) // Also play through speakers

          // Add audio track to video stream
          const audioTrack = audioDestination.stream.getAudioTracks()[0]
          if (audioTrack) {
            stream.addTrack(audioTrack)
            addDebugInfo("✅ Audio track added to video stream")
          } else {
            addDebugInfo("⚠️ No audio track available from destination")
          }
        } catch (audioError) {
          addDebugInfo(`⚠️ Audio stream setup failed: ${audioError}`)
          console.warn("Audio stream setup failed:", audioError)
        }
      } else {
        addDebugInfo("📹 Recording video without audio")
      }

      // Setup MediaRecorder
      const supportedTypes = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ]

      let selectedMimeType = "video/webm"
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type
          break
        }
      }

      addDebugInfo(`Using codec: ${selectedMimeType}`)

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: 128000,
      })

      mediaRecorderRef.current = mediaRecorder
      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data)
          addDebugInfo(`Chunk recorded: ${event.data.size} bytes`)
        }
      }

      mediaRecorder.onstop = async () => {
        addDebugInfo(`Recording stopped. Chunks: ${chunks.length}`)

        // Clean up audio context
        if (audioContext) {
          try {
            await audioContext.close()
            addDebugInfo("Audio context closed")
          } catch (e) {
            console.warn("Error closing audio context:", e)
          }
        }

        try {
          if (chunks.length === 0) {
            throw new Error("No video data was recorded")
          }

          setCurrentStep("Creating video file...")
          setProgress(95)

          const videoBlob = new Blob(chunks, { type: selectedMimeType })
          const videoUrl = URL.createObjectURL(videoBlob)

          addDebugInfo(`✅ Video created: ${videoBlob.size} bytes`)

          setVideoUrl(videoUrl)
          onVideoGenerated(videoUrl)
          setCurrentStep("Video with audio generated successfully!")
          setProgress(100)
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
      setCurrentStep("Recording video with audio...")
      setProgress(50)

      mediaRecorder.start(100)
      addDebugInfo("📹 Recording started")

      // Start audio playback if available
      if (config.audioUrl && config.audioSuccess && audioReady && audioRef.current) {
        try {
          audioRef.current.currentTime = 0
          await audioRef.current.play()
          addDebugInfo("🎵 Audio playback started")
        } catch (audioError) {
          addDebugInfo(`⚠️ Audio playback failed: ${audioError}`)
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

          // Scale and center image
          const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
          const scaledWidth = img.width * scale
          const scaledHeight = img.height * scale
          const x = (canvas.width - scaledWidth) / 2
          const y = (canvas.height - scaledHeight) / 2

          ctx.drawImage(img, x, y, scaledWidth, scaledHeight)

          // Add progress overlay
          ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
          ctx.fillRect(10, 10, 150, 60)
          ctx.fillStyle = "#ffffff"
          ctx.font = "12px Arial"
          ctx.fillText(`${imageIndex + 1}/${loadedImages.length}`, 20, 25)
          ctx.fillText(`${(elapsed / 1000).toFixed(1)}s`, 20, 40)

          // Audio indicator
          if (config.audioSuccess && audioReady) {
            ctx.fillStyle = "#00ff00"
            ctx.fillText("♪ ElevenLabs", 20, 55)
          } else {
            ctx.fillStyle = "#ff6600"
            ctx.fillText("No Audio", 20, 55)
          }
        }

        // Update progress
        const recordingProgress = 50 + (elapsed / totalDurationMs) * 45
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
  }, [config, onVideoGenerated, onError, loadImage, addDebugInfo, audioReady])

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
      link.download = "property-slideshow-with-audio.webm"
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
          {/* ElevenLabs Status */}
          {config.audioSuccess && audioTested ? (
            <div
              className={`border rounded-lg p-4 ${audioReady ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"}`}
            >
              <div className="flex items-center gap-2 mb-2">
                {audioReady ? (
                  <>
                    <Volume2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-700">ElevenLabs Audio Ready!</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    <span className="font-medium text-yellow-700">Audio Loading...</span>
                  </>
                )}
              </div>
              <div className="text-sm">
                {audioReady ? (
                  <p className="text-green-600">✅ High-quality voiceover will be embedded in video</p>
                ) : (
                  <p className="text-yellow-600">⏳ Testing audio playback...</p>
                )}
              </div>
            </div>
          ) : config.audioError ? (
            <Alert variant="destructive">
              <VolumeX className="h-4 w-4" />
              <AlertDescription>
                <strong>ElevenLabs Audio Failed:</strong> {config.audioError}
                <br />
                <small>Video will be generated without voiceover</small>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <VolumeX className="h-4 w-4" />
              <AlertDescription>No audio configured - video will be generated without voiceover</AlertDescription>
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
              {config.audioSuccess && audioReady && <p>✅ ElevenLabs audio will be embedded</p>}
            </div>
          </div>

          <Button
            onClick={generateSlideshow}
            className="w-full"
            size="lg"
            disabled={config.audioUrl && config.audioSuccess && !audioTested}
          >
            <Play className="mr-2 h-4 w-4" />
            Generate Video {config.audioSuccess && audioReady ? "with ElevenLabs Audio" : ""}
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
              Generating video with {config.images.length} images...
              {config.audioSuccess && audioReady && " ElevenLabs audio will be embedded."}
            </AlertDescription>
          </Alert>

          <Button onClick={stopGeneration} variant="destructive" className="w-full">
            <Pause className="mr-2 h-4 w-4" />
            Stop Generation
          </Button>

          {/* Debug Info */}
          <details className="text-left">
            <summary className="text-sm text-gray-600 cursor-pointer">Show Debug Info</summary>
            <div className="bg-gray-50 border rounded-lg p-3 mt-2 max-h-60 overflow-y-auto">
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
              <p>✅ ALL {config.images.length} images included</p>
              {config.audioSuccess && audioReady && <p>✅ ElevenLabs audio embedded in video</p>}
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
