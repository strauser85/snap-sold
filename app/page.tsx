"use client"

import { useState, useRef, useCallback, type ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import {
  Loader2,
  Download,
  AlertCircle,
  CheckCircle,
  XCircle,
  ImageIcon,
  Wand2,
  FileText,
  Upload,
  Sparkles,
  RefreshCw,
} from "lucide-react"
import { Textarea } from "@/components/ui/textarea"

interface UploadedImage {
  file: File
  previewUrl: string
  blobUrl?: string
  id: string
  isUploading?: boolean
  uploadError?: string
}

export default function VideoGenerator() {
  const [address, setAddress] = useState("")
  const [price, setPrice] = useState<number | string>("")
  const [bedrooms, setBedrooms] = useState<number | string>("")
  const [bathrooms, setBathrooms] = useState<number | string>("")
  const [sqft, setSqft] = useState<number | string>("")
  const [propertyDescription, setPropertyDescription] = useState("")
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [generatedScript, setGeneratedScript] = useState("")
  const [scriptMethod, setScriptMethod] = useState<string>("")

  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingScript, setIsGeneratingScript] = useState(false)
  const [progress, setProgress] = useState(0)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  const MAX_IMAGES = 30

  // Compress image
  const compressImage = (file: File, maxWidth = 800, quality = 0.8): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")!
      const img = new Image()

      img.onload = () => {
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height)
        canvas.width = img.width * ratio
        canvas.height = img.height * ratio

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(
          (blob) => {
            const compressedFile = new File([blob!], file.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            })
            resolve(compressedFile)
          },
          "image/jpeg",
          quality,
        )
      }

      img.src = URL.createObjectURL(file)
    })
  }

  // Upload to blob
  const uploadImageToBlob = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append("file", file)

    const response = await fetch("/api/upload-image", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Upload failed")
    }

    const data = await response.json()
    return data.url
  }

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files = Array.from(event.target.files)
      const remainingSlots = MAX_IMAGES - uploadedImages.length

      for (let i = 0; i < Math.min(files.length, remainingSlots); i++) {
        const file = files[i]
        const imageId = `img-${Date.now()}-${i}`

        const newImage: UploadedImage = {
          file,
          previewUrl: URL.createObjectURL(file),
          id: imageId,
          isUploading: true,
        }

        setUploadedImages((prev) => [...prev, newImage])

        try {
          const compressedFile = await compressImage(file)
          const blobUrl = await uploadImageToBlob(compressedFile)

          setUploadedImages((prev) =>
            prev.map((img) => (img.id === imageId ? { ...img, blobUrl, isUploading: false } : img)),
          )
        } catch (error) {
          setUploadedImages((prev) =>
            prev.map((img) =>
              img.id === imageId
                ? {
                    ...img,
                    isUploading: false,
                    uploadError: error instanceof Error ? error.message : "Upload failed",
                  }
                : img,
            ),
          )
        }
      }
    }
  }

  const removeImage = (id: string) => {
    setUploadedImages((prev) => {
      const imageToRemove = prev.find((img) => img.id === id)
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.previewUrl)
      }
      return prev.filter((img) => img.id !== id)
    })
  }

  const generateAIScript = async () => {
    if (!address || !price || !bedrooms || !bathrooms || !sqft) {
      setError("Please fill in all property details first.")
      return
    }

    setIsGeneratingScript(true)
    setError(null)

    try {
      const response = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          price: Number(price),
          bedrooms: Number(bedrooms),
          bathrooms: Number(bathrooms),
          sqft: Number(sqft),
          propertyDescription: propertyDescription.trim(),
          imageCount: uploadedImages.length,
        }),
      })

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`)
      }

      const data = await response.json()
      setGeneratedScript(data.script)
      setScriptMethod(data.method)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate script.")

      // Fallback script
      let basicScript = `Stop scrolling! This property is about to BLOW YOUR MIND!

Welcome to ${address}! This stunning home features ${bedrooms} bedroom${Number(bedrooms) !== 1 ? "s" : ""} and ${bathrooms} bathroom${Number(bathrooms) !== 1 ? "s" : ""}, with ${Number(sqft).toLocaleString()} square feet of pure luxury!`

      if (propertyDescription.trim()) {
        basicScript += `

But wait, there's more! ${propertyDescription.trim()}`
      }

      basicScript += `

Priced at $${Number(price).toLocaleString()}, this property is an incredible opportunity! Don't let this slip away! DM me NOW!`

      setGeneratedScript(basicScript)
      setScriptMethod("fallback")
    } finally {
      setIsGeneratingScript(false)
    }
  }

  const loadImage = useCallback((src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
  }, [])

  const generateAudio = async (script: string): Promise<{ audioUrl: string; duration: number }> => {
    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error("ElevenLabs API key not configured")
    }

    const cleanScript = script
      .replace(/[^\w\s.,!?'-]/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\$(\d+)/g, "$1 dollars")
      .trim()

    const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM", {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: cleanScript,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.7,
          similarity_boost: 0.8,
          style: 0.3,
          use_speaker_boost: true,
        },
        output_format: "mp3_44100_128",
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`)
    }

    const audioBlob = await response.blob()
    if (audioBlob.size === 0) {
      throw new Error("Empty audio response")
    }

    const arrayBuffer = await audioBlob.arrayBuffer()
    const base64Audio = Buffer.from(arrayBuffer).toString("base64")
    const audioUrl = `data:audio/mpeg;base64,${base64Audio}`

    const wordCount = cleanScript.split(" ").length
    const estimatedDuration = Math.max(15, Math.ceil((wordCount / 150) * 60))

    return { audioUrl, duration: estimatedDuration }
  }

  const generateCaptions = (script: string, duration: number) => {
    const sentences = script
      .replace(/[^\w\s.,!?'-]/g, " ")
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0)
      .map((s) => s.trim())

    const captions = []
    let currentTime = 0.5
    const timePerSentence = (duration - 1) / sentences.length

    sentences.forEach((sentence) => {
      if (sentence.length > 0) {
        const words = sentence.split(" ")
        const phrases = []

        for (let i = 0; i < words.length; i += 3) {
          const phrase = words.slice(i, i + 3).join(" ")
          if (phrase.trim()) {
            phrases.push(phrase.trim().toUpperCase())
          }
        }

        const phraseTime = timePerSentence / phrases.length

        phrases.forEach((phrase, phraseIndex) => {
          const startTime = currentTime + phraseIndex * phraseTime
          const endTime = startTime + phraseTime - 0.1

          captions.push({
            text: phrase,
            startTime: Math.max(0, startTime),
            endTime: Math.min(duration, endTime),
          })
        })
      }

      currentTime += timePerSentence
    })

    return captions
  }

  const handleGenerateVideo = async () => {
    if (!address || !price || !bedrooms || !bathrooms || !sqft || !generatedScript || uploadedImages.length === 0) {
      setError("Please fill in all details, generate a script, and upload at least one image.")
      return
    }

    const successfulImages = uploadedImages.filter((img) => img.blobUrl)
    if (successfulImages.length === 0) {
      setError("No images were successfully uploaded.")
      return
    }

    setIsGenerating(true)
    setError(null)
    setVideoUrl(null)
    setProgress(0)

    try {
      if (!canvasRef.current || !audioRef.current) {
        throw new Error("Canvas or audio not available")
      }

      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")!
      const audio = audioRef.current

      canvas.width = 576
      canvas.height = 1024

      // Step 1: Generate audio (0-20%)
      setProgress(5)
      const { audioUrl, duration } = await generateAudio(generatedScript)
      setProgress(20)

      // Step 2: Generate captions (20-25%)
      const captions = generateCaptions(generatedScript, duration)
      setProgress(25)

      // Step 3: Load images (25-40%)
      const imageUrls = successfulImages.map((img) => img.blobUrl!)
      const loadedImages: HTMLImageElement[] = []

      for (let i = 0; i < imageUrls.length; i++) {
        try {
          const img = await loadImage(imageUrls[i])
          loadedImages.push(img)
          setProgress(25 + (i / imageUrls.length) * 15)
        } catch (error) {
          console.warn(`Failed to load image ${i + 1}:`, error)
        }
      }

      if (loadedImages.length === 0) {
        throw new Error("No images could be loaded")
      }

      setProgress(40)

      // Step 4: Setup audio (40-45%)
      audio.src = audioUrl
      audio.preload = "auto"
      audio.crossOrigin = "anonymous"

      await new Promise<void>((resolve, reject) => {
        audio.oncanplaythrough = () => resolve()
        audio.onerror = reject
        audio.load()
      })

      setProgress(45)

      // Step 5: Setup recording (45-50%)
      const canvasStream = canvas.captureStream(30)
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const audioSource = audioContext.createMediaElementSource(audio)
      const audioDestination = audioContext.createMediaStreamDestination()

      audioSource.connect(audioDestination)

      const combinedStream = new MediaStream()
      canvasStream.getVideoTracks().forEach((track) => {
        combinedStream.addTrack(track)
      })
      audioDestination.stream.getAudioTracks().forEach((track) => {
        combinedStream.addTrack(track)
      })

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: "video/webm;codecs=vp9,opus",
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: 128000,
      })

      const chunks: Blob[] = []

      setProgress(50)

      // Step 6: Record video (50-95%)
      await new Promise<void>((resolve, reject) => {
        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunks.push(event.data)
          }
        }

        mediaRecorder.onstop = async () => {
          try {
            await audioContext.close()
          } catch (e) {
            console.warn("Audio context cleanup:", e)
          }

          try {
            if (chunks.length === 0) {
              throw new Error("No video data recorded")
            }

            const videoBlob = new Blob(chunks, { type: "video/webm" })
            const videoUrl = URL.createObjectURL(videoBlob)
            setVideoUrl(videoUrl)

            // Auto-download
            const link = document.createElement("a")
            link.href = videoUrl
            link.download = "property-video.webm"
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)

            resolve()
          } catch (error) {
            reject(error)
          }
        }

        mediaRecorder.onerror = (event) => {
          reject(new Error("Recording failed"))
        }

        mediaRecorder.start(100)

        // Start audio and animation
        audio.currentTime = 0
        audio.play()

        const startTime = Date.now()
        const durationMs = duration * 1000
        const timePerImageMs = Math.max(2000, Math.floor(durationMs / loadedImages.length))

        const animate = () => {
          const elapsed = Date.now() - startTime
          const elapsedSeconds = elapsed / 1000

          if (elapsed >= durationMs) {
            audio.pause()
            mediaRecorder.stop()
            return
          }

          // Calculate current image
          const imageIndex = Math.min(Math.floor(elapsed / timePerImageMs), loadedImages.length - 1)

          // Find current caption
          const currentCaptionData = captions.find(
            (caption) => elapsedSeconds >= caption.startTime && elapsedSeconds <= caption.endTime,
          )

          // Draw current image
          const img = loadedImages[imageIndex]
          if (img) {
            // Clear canvas
            ctx.fillStyle = "#000000"
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            // Draw image
            const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
            const scaledWidth = img.width * scale
            const scaledHeight = img.height * scale
            const x = (canvas.width - scaledWidth) / 2
            const y = (canvas.height - scaledHeight) / 2

            ctx.drawImage(img, x, y, scaledWidth, scaledHeight)

            // Draw captions
            if (currentCaptionData) {
              const fontSize = Math.floor(canvas.width * 0.08)
              ctx.font = `900 ${fontSize}px Arial, sans-serif`
              ctx.textAlign = "center"

              const words = currentCaptionData.text.split(" ")
              const lines: string[] = []

              for (let i = 0; i < words.length; i += 2) {
                lines.push(words.slice(i, i + 2).join(" "))
              }

              const lineHeight = fontSize * 1.3
              const startY = canvas.height * 0.75

              lines.forEach((line, lineIndex) => {
                const y = startY + lineIndex * lineHeight

                // Black outline
                ctx.strokeStyle = "#000000"
                ctx.lineWidth = Math.floor(fontSize * 0.2)
                ctx.strokeText(line, canvas.width / 2, y)

                // Yellow text
                ctx.fillStyle = "#FFFF00"
                ctx.fillText(line, canvas.width / 2, y)
              })
            }

            // Property info overlay
            ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
            ctx.fillRect(0, 0, canvas.width, 80)

            ctx.fillStyle = "#FFFFFF"
            ctx.font = "bold 16px Arial"
            ctx.textAlign = "left"
            ctx.fillText(address, 15, 25)

            ctx.fillStyle = "#FFD700"
            ctx.font = "bold 14px Arial"
            ctx.fillText(`$${Number(price).toLocaleString()}`, 15, 45)

            ctx.fillStyle = "#FFFFFF"
            ctx.font = "12px Arial"
            ctx.fillText(`${bedrooms}BR • ${bathrooms}BA • ${Number(sqft).toLocaleString()} sqft`, 15, 65)
          }

          // Update progress
          const recordingProgress = 50 + (elapsed / durationMs) * 45
          setProgress(Math.min(95, recordingProgress))

          requestAnimationFrame(animate)
        }

        animate()
      })

      setProgress(100)
      setIsGenerating(false)
    } catch (error) {
      console.error("Video generation failed:", error)
      setError(error instanceof Error ? error.message : "Video generation failed")
      setIsGenerating(false)
      setProgress(0)
    }
  }

  const resetForm = () => {
    setAddress("")
    setPrice("")
    setBedrooms("")
    setBathrooms("")
    setSqft("")
    setPropertyDescription("")
    setGeneratedScript("")
    setScriptMethod("")
    uploadedImages.forEach((img) => URL.revokeObjectURL(img.previewUrl))
    setUploadedImages([])
    setVideoUrl(null)
    setError(null)
    setIsGenerating(false)
    setProgress(0)
  }

  const uploadedCount = uploadedImages.filter((img) => img.blobUrl).length
  const uploadingCount = uploadedImages.filter((img) => img.isUploading).length
  const failedCount = uploadedImages.filter((img) => img.uploadError).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center p-4">
      <canvas ref={canvasRef} className="hidden" width={576} height={1024} />
      <audio ref={audioRef} preload="auto" className="hidden" />

      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="h-8 w-8 text-purple-600" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent tracking-tight">
              SnapSold
            </h1>
            <Sparkles className="h-8 w-8 text-pink-600" />
          </div>
          <p className="text-lg text-gray-600 leading-relaxed">Create viral listing videos that sell homes fast</p>
        </div>

        {/* Form */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="address">Property Address</Label>
                <Input
                  id="address"
                  type="text"
                  placeholder="e.g., 123 Main St, Anytown, USA"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-12"
                  disabled={isGenerating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price ($)</Label>
                <Input
                  id="price"
                  type="number"
                  placeholder="e.g., 500000"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="h-12"
                  disabled={isGenerating}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bedrooms">Bedrooms</Label>
                <Input
                  id="bedrooms"
                  type="number"
                  placeholder="e.g., 3"
                  value={bedrooms}
                  onChange={(e) => setBedrooms(e.target.value)}
                  className="h-12"
                  disabled={isGenerating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bathrooms">Bathrooms</Label>
                <Input
                  id="bathrooms"
                  type="number"
                  placeholder="e.g., 2.5"
                  value={bathrooms}
                  onChange={(e) => setBathrooms(e.target.value)}
                  className="h-12"
                  disabled={isGenerating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sqft">Square Footage</Label>
                <Input
                  id="sqft"
                  type="number"
                  placeholder="e.g., 2500"
                  value={sqft}
                  onChange={(e) => setSqft(e.target.value)}
                  className="h-12"
                  disabled={isGenerating}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="property-description" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Property Description & Key Features (Optional)
              </Label>
              <Textarea
                id="property-description"
                value={propertyDescription}
                onChange={(e) => setPropertyDescription(e.target.value)}
                placeholder="Describe unique features, amenities, recent upgrades..."
                className="min-h-[100px]"
                disabled={isGenerating}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="images">
                  Upload Property Images (Max {MAX_IMAGES})
                  <span className="ml-2 text-xs text-gray-500">
                    {uploadedCount} uploaded, {uploadingCount} uploading, {failedCount} failed
                  </span>
                </Label>
              </div>

              <Input
                id="images"
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                className="h-12"
                disabled={isGenerating || uploadedImages.length >= MAX_IMAGES}
              />

              {uploadingCount > 0 && (
                <Alert>
                  <Upload className="h-4 w-4" />
                  <AlertDescription>Uploading {uploadingCount} image(s)...</AlertDescription>
                </Alert>
              )}

              {failedCount > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{failedCount} image(s) failed to upload.</AlertDescription>
                </Alert>
              )}

              {uploadedImages.length > 0 && (
                <div className="border rounded-lg p-4 bg-gray-50 max-h-80 overflow-y-auto">
                  <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                    {uploadedImages.map((img, index) => (
                      <div key={img.id} className="relative group">
                        <img
                          src={img.previewUrl || "/placeholder.svg"}
                          alt={`Property image ${index + 1}`}
                          className="w-full h-20 object-cover rounded-md border"
                        />
                        <div className="absolute top-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1 rounded">
                          {index + 1}
                        </div>
                        {img.isUploading && (
                          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-md">
                            <Loader2 className="h-4 w-4 text-white animate-spin" />
                          </div>
                        )}
                        {img.uploadError && (
                          <div className="absolute inset-0 bg-red-500 bg-opacity-50 flex items-center justify-center rounded-md">
                            <XCircle className="h-4 w-4 text-white" />
                          </div>
                        )}
                        {img.blobUrl && (
                          <div className="absolute top-1 right-6 bg-green-500 bg-opacity-75 rounded-full p-1">
                            <CheckCircle className="h-3 w-3 text-white" />
                          </div>
                        )}
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeImage(img.id)}
                          disabled={isGenerating}
                        >
                          <XCircle className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {uploadedImages.length === 0 && (
                <div className="text-center text-gray-500 text-sm py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  <ImageIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p>No images uploaded yet.</p>
                  <p className="text-xs">Upload up to {MAX_IMAGES} property images</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="generated-script">
                  AI-Generated TikTok Script
                  {scriptMethod && (
                    <span className="ml-2 text-xs text-gray-500">
                      ({scriptMethod === "OpenAI" ? "AI-powered" : "Template"})
                    </span>
                  )}
                </Label>
                <Button
                  onClick={generateAIScript}
                  disabled={
                    isGeneratingScript || isGenerating || !address || !price || !bedrooms || !bathrooms || !sqft
                  }
                  variant="outline"
                  size="sm"
                  className="h-8 bg-transparent"
                >
                  {isGeneratingScript ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-1 h-3 w-3" />
                      Generate Script
                    </>
                  )}
                </Button>
              </div>
              <Textarea
                id="generated-script"
                value={generatedScript}
                onChange={(e) => setGeneratedScript(e.target.value)}
                placeholder="Click 'Generate Script' to create an AI-powered TikTok script..."
                className="min-h-[120px]"
                disabled={isGenerating}
              />
            </div>

            {/* Progress Bar */}
            {isGenerating && (
              <div className="space-y-2">
                <Progress value={progress} className="h-4" />
                <div className="text-center text-sm font-medium text-gray-600">{Math.round(progress)}%</div>
              </div>
            )}

            {/* SINGLE GENERATE BUTTON */}
            <Button
              onClick={handleGenerateVideo}
              disabled={
                isGenerating ||
                !address ||
                !price ||
                !bedrooms ||
                !bathrooms ||
                !sqft ||
                !generatedScript ||
                uploadedImages.length === 0 ||
                uploadingCount > 0 ||
                uploadedCount === 0
              }
              className="w-full h-16 text-xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 shadow-lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                  Generating Video...
                </>
              ) : (
                <>
                  <Sparkles className="mr-3 h-6 w-6" />
                  Generate Video
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-3">
                <p>{error}</p>
                <Button onClick={() => setError(null)} variant="outline" size="sm" className="bg-white">
                  <RefreshCw className="mr-2 h-3 w-3" />
                  Try Again
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Success Message */}
        {videoUrl && !isGenerating && (
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <div className="flex items-center justify-center gap-2 text-green-700">
                    <CheckCircle className="h-6 w-6" />
                    <span className="font-bold text-lg">✅ Video Generated & Downloaded!</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button onClick={resetForm} variant="outline" className="flex-1 bg-transparent">
                    Generate Another
                  </Button>
                  <Button
                    asChild
                    className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-lg h-12"
                  >
                    <a href={videoUrl} download="property-video.webm">
                      <Download className="mr-2 h-5 w-5" />
                      Download Again
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
