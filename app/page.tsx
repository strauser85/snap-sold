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

interface Caption {
  text: string
  startTime: number
  endTime: number
  type: "bedrooms" | "bathrooms" | "sqft" | "price" | "location" | "feature"
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

  const compressImage = (file: File, maxWidth = 1200, quality = 0.7): Promise<File> => {
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

  const uploadImageToBlob = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append("file", file)

    const response = await fetch("/api/upload-image", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = "Upload failed"

      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.error || errorMessage
      } catch {
        errorMessage = `Upload failed (${response.status})`
      }

      throw new Error(errorMessage)
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
          console.error("Upload error for image:", imageId, error)
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

  const generatePropertyCaptions = (duration: number): Caption[] => {
    const captions: Caption[] = []

    try {
      const safeAddress = typeof address === "string" && address.trim() ? address.trim() : ""
      const safePrice = typeof price === "string" || typeof price === "number" ? Number(price) : 0
      const safeBedrooms = typeof bedrooms === "string" || typeof bedrooms === "number" ? Number(bedrooms) : 0
      const safeBathrooms = typeof bathrooms === "string" || typeof bathrooms === "number" ? Number(bathrooms) : 0
      const safeSqft = typeof sqft === "string" || typeof sqft === "number" ? Number(sqft) : 0

      if (safeAddress && safePrice > 0 && safeBedrooms > 0 && safeBathrooms > 0 && safeSqft > 0) {
        const propertyDetails = [
          {
            text: `${safeBedrooms} ${safeBedrooms === 1 ? "BEDROOM" : "BEDROOMS"}`,
            type: "bedrooms" as const,
            startTime: duration * 0.15,
            duration: 2.5,
          },
          {
            text: `${safeBathrooms} ${safeBathrooms === 1 ? "BATHROOM" : "BATHROOMS"}`,
            type: "bathrooms" as const,
            startTime: duration * 0.25,
            duration: 2.5,
          },
          {
            text: `${safeSqft.toLocaleString()} SQUARE FEET`,
            type: "sqft" as const,
            startTime: duration * 0.35,
            duration: 2.5,
          },
          {
            text: `$${safePrice.toLocaleString()}`,
            type: "price" as const,
            startTime: duration * 0.65,
            duration: 3.0,
          },
        ]

        if (safeAddress.length > 0) {
          const locationText = safeAddress.includes(",")
            ? safeAddress.split(",")[0].trim().toUpperCase()
            : safeAddress.toUpperCase()

          if (locationText.length > 0 && locationText.length < 50) {
            propertyDetails.push({
              text: locationText,
              type: "location" as const,
              startTime: duration * 0.75,
              duration: 2.5,
            })
          }
        }

        if (typeof propertyDescription === "string" && propertyDescription.trim()) {
          const features = propertyDescription
            .split(/[,.!;]/)
            .map((s) => s.trim())
            .filter((s) => s.length > 3 && s.length < 25)
            .slice(0, 2)

          features.forEach((feature, index) => {
            propertyDetails.push({
              text: feature.toUpperCase(),
              type: "feature" as const,
              startTime: duration * (0.45 + index * 0.1),
              duration: 2.0,
            })
          })
        }

        propertyDetails.forEach((detail) => {
          const startTime = Math.max(0, detail.startTime)
          const endTime = Math.min(duration - 0.5, startTime + detail.duration)

          if (startTime < endTime && detail.text && detail.text.length > 0) {
            captions.push({
              text: detail.text,
              startTime,
              endTime,
              type: detail.type,
            })
          }
        })
      }
    } catch (error) {
      console.error("Caption generation error:", error)
    }

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

      setProgress(5)
      const audioResponse = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: generatedScript }),
      })

      if (!audioResponse.ok) {
        const errorData = await audioResponse.json()
        throw new Error(errorData.details || errorData.error || "Audio generation failed")
      }

      const { audioUrl, duration } = await audioResponse.json()
      setProgress(15)

      const captions = generatePropertyCaptions(duration)
      setProgress(20)

      const imageUrls = successfulImages.map((img) => img.blobUrl!)
      const loadedImages: HTMLImageElement[] = []

      for (let i = 0; i < imageUrls.length; i++) {
        try {
          const img = await loadImage(imageUrls[i])
          loadedImages.push(img)
          setProgress(20 + (i / imageUrls.length) * 15)
        } catch (error) {
          console.warn(`Failed to load image ${i + 1}:`, error)
        }
      }

      if (loadedImages.length === 0) {
        throw new Error("No images could be loaded")
      }

      setProgress(35)

      audio.src = audioUrl
      audio.preload = "auto"
      audio.crossOrigin = "anonymous"
      audio.volume = 1.0
      audio.muted = true
      audio.loop = false
      audio.autoplay = false

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Audio loading timeout")), 10000)

        const onCanPlay = () => {
          clearTimeout(timeout)
          audio.removeEventListener("canplaythrough", onCanPlay)
          audio.removeEventListener("error", onError)
          resolve()
        }

        const onError = () => {
          clearTimeout(timeout)
          audio.removeEventListener("canplaythrough", onCanPlay)
          audio.removeEventListener("error", onError)
          reject(new Error("Audio loading failed"))
        }

        audio.addEventListener("canplaythrough", onCanPlay)
        audio.addEventListener("error", onError)
        audio.load()
      })

      setProgress(40)

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      if (audioContext.state === "suspended") {
        await audioContext.resume()
      }

      const audioSource = audioContext.createMediaElementSource(audio)
      const audioDestination = audioContext.createMediaStreamDestination()
      audioSource.connect(audioDestination)

      const canvasStream = canvas.captureStream(30)
      const combinedStream = new MediaStream()

      canvasStream.getVideoTracks().forEach((track) => combinedStream.addTrack(track))
      audioDestination.stream.getAudioTracks().forEach((track) => combinedStream.addTrack(track))

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: "video/webm;codecs=vp9,opus",
        videoBitsPerSecond: 2000000,
        audioBitsPerSecond: 128000,
      })

      const chunks: Blob[] = []
      setProgress(45)

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

            const webmBlob = new Blob(chunks, { type: "video/webm" })
            setProgress(75)

            const formData = new FormData()
            formData.append("file", webmBlob, "video.webm")

            const uploadResponse = await fetch("/api/upload-image", {
              method: "POST",
              body: formData,
            })

            if (!uploadResponse.ok) {
              throw new Error("Video upload failed")
            }

            const { url: webmUrl } = await uploadResponse.json()

            const convertResponse = await fetch("/api/convert-to-mp4", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ webmUrl }),
            })

            if (convertResponse.ok) {
              const { mp4Url } = await convertResponse.json()
              setProgress(95)

              const link = document.createElement("a")
              link.href = mp4Url
              link.download = "property-video.mp4"
              link.target = "_blank"
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)

              setVideoUrl(mp4Url)
            } else {
              const link = document.createElement("a")
              link.href = webmUrl
              link.download = "property-video.webm"
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)

              setVideoUrl(webmUrl)
            }

            resolve()
          } catch (error) {
            console.error("Processing error:", error)
            reject(error)
          }
        }

        mediaRecorder.onerror = (event) => {
          console.error("MediaRecorder error:", event)
          reject(new Error("Recording failed"))
        }

        mediaRecorder.start(100)
        audio.currentTime = 0
        audio.muted = false
        audio.play().catch(console.error)

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

          const imageIndex = Math.min(Math.floor(elapsed / timePerImageMs), loadedImages.length - 1)

          const currentCaption = captions.find(
            (caption) => elapsedSeconds >= caption.startTime && elapsedSeconds <= caption.endTime,
          )

          const img = loadedImages[imageIndex]
          if (img) {
            ctx.fillStyle = "#000000"
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
            const scaledWidth = img.width * scale
            const scaledHeight = img.height * scale
            const x = (canvas.width - scaledWidth) / 2
            const y = (canvas.height - scaledHeight) / 2

            ctx.drawImage(img, x, y, scaledWidth, scaledHeight)

            if (currentCaption && currentCaption.text) {
              const fontSize = Math.floor(canvas.width * 0.08)
              ctx.font = `900 ${fontSize}px Arial, sans-serif`
              ctx.textAlign = "center"

              // ALL CAPTIONS ARE BRIGHT YELLOW
              const captionColor = "#FFFF00"

              const words = currentCaption.text.split(" ")
              const lines: string[] = []

              for (let i = 0; i < words.length; i += 2) {
                lines.push(words.slice(i, i + 2).join(" "))
              }

              const lineHeight = fontSize * 1.2
              const startY = canvas.height * 0.7

              lines.forEach((line, lineIndex) => {
                const y = startY + lineIndex * lineHeight

                ctx.strokeStyle = "#000000"
                ctx.lineWidth = Math.floor(fontSize * 0.2)
                ctx.strokeText(line, canvas.width / 2, y)

                ctx.fillStyle = captionColor
                ctx.fillText(line, canvas.width / 2, y)
              })
            }

            ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
            ctx.fillRect(0, 0, canvas.width, 80)

            ctx.fillStyle = "#FFFFFF"
            ctx.font = "bold 16px Arial"
            ctx.textAlign = "left"
            ctx.fillText(address || "Property", 15, 25)

            ctx.fillStyle = "#FFD700"
            ctx.font = "bold 14px Arial"
            ctx.fillText(`$${Number(price || 0).toLocaleString()}`, 15, 45)

            ctx.fillStyle = "#FFFFFF"
            ctx.font = "12px Arial"
            const safeBedrooms = Number(bedrooms || 0)
            const safeBathrooms = Number(bathrooms || 0)
            const safeSqft = Number(sqft || 0)
            const bedroomsText = safeBedrooms === 1 ? "bedroom" : "bedrooms"
            const bathroomsText = safeBathrooms === 1 ? "bathroom" : "bathrooms"
            ctx.fillText(
              `${safeBedrooms} ${bedroomsText} • ${safeBathrooms} ${bathroomsText} • ${safeSqft.toLocaleString()} sqft`,
              15,
              65,
            )
          }

          const recordingProgress = 45 + (elapsed / durationMs) * 30
          setProgress(Math.min(75, recordingProgress))

          requestAnimationFrame(animate)
        }

        animate()
      })

      setProgress(100)
      setIsGenerating(false)
    } catch (error) {
      console.error("Video generation error:", error)
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
                  <AlertDescription>
                    {failedCount} image(s) failed to upload. Try again or use smaller images.
                  </AlertDescription>
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

            {isGenerating && (
              <div className="space-y-2">
                <Progress value={progress} className="h-4" />
                <div className="text-center text-sm font-medium text-gray-600">{Math.round(progress)}%</div>
              </div>
            )}

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

        {videoUrl && !isGenerating && (
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <Button onClick={resetForm} variant="outline" className="w-full bg-transparent">
                  Generate Another Video
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
