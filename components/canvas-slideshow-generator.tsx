"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Loader2, Play, Pause, RefreshCw, XCircle } from "lucide-react"
import { createSafeVideoBlob, fixBlobUrl, downloadBlobSafely } from "@/lib/blob-utils"

interface CanvasSlideshowGeneratorProps {
  config: any // Slideshow configuration
  onVideoGenerated: (videoUrl: string) => void
  onError: (error: string) => void
}

export const CanvasSlideshowGenerator: React.FC<CanvasSlideshowGeneratorProps> = ({
  config,
  onVideoGenerated,
  onError,
}) => {
  const [progress, setProgress] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null)
  const [audioSourceNode, setAudioSourceNode] = useState<AudioBufferSourceNode | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [chunks, setChunks] = useState<Blob[]>([])

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  useEffect(() => {
    const setup = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Initialize audio context
        const newAudioContext = new AudioContext()
        setAudioContext(newAudioContext)

        // Load audio if URL is provided
        if (config.audioUrl && !config.audioUrl.startsWith("tts:")) {
          console.log("Loading audio from URL:", config.audioUrl)
          const response = await fetch(fixBlobUrl(config.audioUrl))
          const arrayBuffer = await response.arrayBuffer()
          const newAudioBuffer = await newAudioContext.decodeAudioData(arrayBuffer)
          setAudioBuffer(newAudioBuffer)
        }

        // Prepare canvas
        const canvas = canvasRef.current
        if (!canvas) throw new Error("Canvas not initialized")

        canvas.width = config.format.width
        canvas.height = config.format.height

        // Load initial image
        await loadImage(config.images[0])
        setStartTime(new Date().getTime())

        setIsLoading(false)
      } catch (err: any) {
        console.error("Setup failed:", err)
        setError(err.message || "Slideshow setup failed")
        onError(err.message || "Slideshow setup failed")
        setIsLoading(false)
      }
    }

    setup()

    return () => {
      if (audioContext) {
        audioContext.close()
      }
    }
  }, [config, onError])

  useEffect(() => {
    if (!canvasRef.current || isLoading || error) return

    let animationFrameId: number

    const drawFrame = async () => {
      const canvas = canvasRef.current!
      const ctx = canvas.getContext("2d")!
      const now = new Date().getTime()
      const elapsedTime = now - startTime
      const imageIndex = Math.floor(elapsedTime / (config.timePerImage * 1000))

      if (imageIndex < config.images.length) {
        if (imageIndex !== currentImageIndex) {
          await loadImage(config.images[imageIndex])
          setCurrentImageIndex(imageIndex)
        }

        setProgress(Math.min(100, (elapsedTime / (config.totalDuration * 1000)) * 100))
        animationFrameId = requestAnimationFrame(drawFrame)
      } else {
        setProgress(100)
        cancelAnimationFrame(animationFrameId)
        stopRecording()
      }
    }

    const startRecording = async () => {
      try {
        const canvas = canvasRef.current!
        const stream = canvas.captureStream(config.format.fps)

        // Add audio track if available
        if (audioBuffer && audioContext) {
          const gainNode = audioContext.createGain()
          gainNode.gain.value = 0.75 // Adjust volume
          const destination = audioContext.createMediaStreamDestination()
          gainNode.connect(destination)

          const track = destination.stream.getAudioTracks()[0]
          stream.addTrack(track)

          const newAudioSourceNode = audioContext.createBufferSource()
          newAudioSourceNode.buffer = audioBuffer
          newAudioSourceNode.connect(gainNode)
          newAudioSourceNode.start()
          setAudioSourceNode(newAudioSourceNode)
        } else if (config.audioUrl?.startsWith("tts:")) {
          // Browser TTS fallback
          const tts = window.speechSynthesis
          const utterance = new SpeechSynthesisUtterance(config.audioUrl.substring(4))
          utterance.rate = 0.9 // Adjust speed
          tts.speak(utterance)
        }

        const recorder = new MediaRecorder(stream, {
          mimeType: "video/webm;codecs=vp9,opus",
        })

        mediaRecorderRef.current = recorder

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            setChunks((prev) => [...prev, event.data])
          }
        }

        recorder.onstop = async () => {
          try {
            console.log("Recording stopped")
            const videoUrl = await createSafeVideoBlob(chunks)
            onVideoGenerated(videoUrl)
          } catch (blobError: any) {
            console.error("Blob creation failed:", blobError)
            setError(blobError.message || "Video generation failed")
            onError(blobError.message || "Video generation failed")
          } finally {
            setIsPlaying(false)
            setIsLoading(false)
          }
        }

        recorder.start()
        setIsPlaying(true)
        setStartTime(new Date().getTime())
        drawFrame()
      } catch (recordError: any) {
        console.error("Recording failed:", recordError)
        setError(recordError.message || "Video recording failed")
        onError(recordError.message || "Video recording failed")
        setIsPlaying(false)
        setIsLoading(false)
      }
    }

    startRecording()

    return () => {
      cancelAnimationFrame(animationFrameId)
      stopRecording()
    }
  }, [config, currentImageIndex, isLoading, error, onVideoGenerated, onError])

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop()
      console.log("Stopping recorder...")
    }

    if (audioSourceNode) {
      audioSourceNode.stop()
    }

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel()
    }
  }

  const loadImage = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        const canvas = canvasRef.current
        if (!canvas) {
          reject(new Error("Canvas not initialized"))
          return
        }

        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Canvas context not available"))
          return
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve()
      }
      img.onerror = (err) => {
        console.error("Image load error:", err)
        reject(err)
      }
      img.src = fixBlobUrl(src)
    })
  }

  const togglePlayback = () => {
    if (isPlaying) {
      stopRecording()
    } else {
      // Restart slideshow
      setChunks([])
      setCurrentImageIndex(0)
      setIsLoading(false)
    }
    setIsPlaying(!isPlaying)
  }

  const handleDownload = async () => {
    if (videoRef.current) {
      try {
        const videoUrl = videoRef.current.src
        await downloadBlobSafely(videoUrl, "slideshow.webm")
      } catch (downloadError: any) {
        console.error("Download failed:", downloadError)
        setError(downloadError.message || "Download failed")
      }
    }
  }

  const handleRetry = () => {
    setError(null)
    setChunks([])
    setCurrentImageIndex(0)
    setIsLoading(false)
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="relative aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        {isLoading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Progress value={progress} className="flex-1 mr-4 h-2" />
        <span className="text-sm text-gray-500">{progress.toFixed(1)}%</span>
      </div>

      <div className="flex justify-center gap-2">
        <Button onClick={togglePlayback} disabled={isLoading} variant="outline" className="w-24 bg-transparent">
          {isPlaying ? (
            <>
              <Pause className="mr-2 h-4 w-4" />
              Pause
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              {progress === 100 ? "Restart" : "Play"}
            </>
          )}
        </Button>
        {progress === 100 && (
          <Button onClick={handleRetry} variant="outline" className="w-24 bg-transparent">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        )}
      </div>
    </div>
  )
}
