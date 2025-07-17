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

  const numberToWords = (num: number): string => {
    const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]
    const teens = [
      "ten",
      "eleven",
      "twelve",
      "thirteen",
      "fourteen",
      "fifteen",
      "sixteen",
      "seventeen",
      "eighteen",
      "nineteen",
    ]
    const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]

    if (num === 0) return "zero"
    if (num < 10) return ones[num]
    if (num < 20) return teens[num - 10]
    if (num < 100) {
      const tenDigit = Math.floor(num / 10)
      const oneDigit = num % 10
      return tens[tenDigit] + (oneDigit > 0 ? " " + ones[oneDigit] : "")
    }
    if (num < 1000) {
      const hundreds = Math.floor(num / 100)
      const remainder = num % 100
      return ones[hundreds] + " hundred" + (remainder > 0 ? " " + numberToWords(remainder) : "")
    }
    return num.toString()
  }

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

      const safePrice = Number(price) || 0
      const safeBedrooms = Number(bedrooms) || 0
      const safeBathrooms = Number(bathrooms) || 0
      const safeSqft = Number(sqft) || 0

      const bedroomsText =
        safeBedrooms === 1 ? `${numberToWords(safeBedrooms)} bedroom` : `${numberToWords(safeBedrooms)} bedrooms`
      const bathroomsText =
        safeBathrooms === 1 ? `${numberToWords(safeBathrooms)} bathroom` : `${numberToWords(safeBathrooms)} bathrooms`

      let basicScript = `Stop scrolling! This property is about to blow your mind!\n\nWelcome to ${address}! This stunning home features ${bedroomsText} and ${bathroomsText}, with ${safeSqft.toLocaleString()} square feet of pure luxury!`

      if (propertyDescription.trim()) {
        basicScript += `\n\nBut wait, there's more! ${propertyDescription.trim()}`
      }

      basicScript += `\n\nPriced at ${safePrice.toLocaleString()} dollars, this property is an incredible opportunity! Don't let this slip away! Message me now!`

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

  // FIXED: Generate ONLY key property detail captions with PROPER WORDS and COLORS
  const generatePropertyCaptions = (duration: number): Caption[] => {
    const captions: Caption[] = []

    try {
      // Safely extract and validate all values
      const safeAddress = typeof address === "string" && address.trim() ? address.trim() : ""
      const safePrice = typeof price === "string" || typeof price === "number" ? Number(price) : 0
      const safeBedrooms = typeof bedrooms === "string" || typeof bedrooms === "number" ? Number(bedrooms) : 0
      const safeBathrooms = typeof bathrooms === "string" || typeof bathrooms === "number" ? Number(bathrooms) : 0
      const safeSqft = typeof sqft === "string" || typeof sqft === "number" ? Number(sqft) : 0

      // Only proceed if we have valid data
      if (safeAddress && safePrice > 0 && safeBedrooms > 0 && safeBathrooms > 0 && safeSqft > 0) {
        // Create property detail captions with FULL WORDS (no abbreviations)
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

        // Add location caption
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

        // Add key features from description
        if (typeof propertyDescription === "string" && propertyDescription.trim()) {
          const features = propertyDescription
            .split(/[,.!;]/)
            .map((s) => s.trim())
            .filter((s) => s.length > 3 && s.length < 25)
            .slice(0, 2) // Max 2 features

          features.forEach((feature, index) => {
            propertyDetails.push({
              text: feature.toUpperCase(),
              type: "feature" as const,
              startTime: duration * (0.45 + index * 0.1),
              duration: 2.0,
            })
          })
        }

        // Convert to caption format with safe timing
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

    console.log(`✅ Generated ${captions.length} property captions`)
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

      // Step 1: Generate audio (0-15%)
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

      // Step 2: Generate property captions (15-20%)
      const captions = generatePropertyCaptions(duration)
      setProgress(20)

      // Step 3: Load images (20-35%)
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

      // Step 4: Setup audio element (35-40%) - SILENT
      audio.src = audioUrl
      audio.preload = "auto"
      audio.crossOrigin = "anonymous"
      audio.volume = 1.0
      audio.muted = true // MUTED - NO PREVIEW
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

      // Step 5: Setup recording (40-45%)
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      if (audioContext.state === "suspended") {
        await audioContext.resume()
      }

      const audioSource = audioContext.createMediaElementSource(audio)
      const audioDestination = audioContext.createMediaStreamDestination()
      audioSource.connect(audioDestination)
      // NO connection to speakers - silent generation

      const canvasStream = canvas.captureStream(30)
      const combinedStream = new MediaStream()

      canvasStream.getVideoTracks().forEach((track) => combinedStream.addTrack(track))
      audioDestination.stream.getAudioTracks().forEach((track) => combinedStream.addTrack(track))

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: "video/webm;codecs=vp9,opus",
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: 128000,
      })

      const chunks: Blob[] = []
      setProgress(45)

      // Step 6: Record video (45-75%)
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

            // Step 7: Convert to MP4 (75-95%)
            console.log("🔄 Converting to MP4...")
            const formData = new FormData()
            formData.append("webm", webmBlob)

            const convertResponse = await fetch("/api/convert-to-mp4", {
              method: "POST",
              body: formData,
            })

            if (!convertResponse.ok) {
              console.warn("⚠️ MP4 conversion failed, using WebM")
              // Fallback to WebM
              const videoUrl = URL.createObjectURL(webmBlob)
              setVideoUrl(videoUrl)

              const link = document.createElement("a")
              link.href = videoUrl
              link.download = "property-video.webm"
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)

              resolve()
              return
            }

            const { mp4Url } = await convertResponse.json()
            console.log("✅ MP4 conversion successful")
            setProgress(95)

            // Auto-download MP4
            const link = document.createElement("a")
            link.href = mp4Url
            link.download = "property-video.mp4"
            link.target = "_blank"
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)

            setVideoUrl(mp4Url)
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

        // Start recording
        mediaRecorder.start(100)
        audio.currentTime = 0
        audio.muted = false // Unmute for recording only
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

          // Find current caption
          const currentCaption = captions.find(
            (caption) => elapsedSeconds >= caption.startTime && elapsedSeconds <= caption.endTime,
          )

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

            // Draw FIXED property captions with PROPER COLORS
            if (currentCaption && currentCaption.text) {
              const fontSize = Math.floor(canvas.width * 0.08)
              ctx.font = `900 ${fontSize}px Arial, sans-serif`
              ctx.textAlign = "center"

              // FIXED CAPTION COLORS - BRIGHT AND VISIBLE
              let captionColor = "#FFFFFF" // Default white
              if (currentCaption.type === "price") captionColor = "#00FF00" // Bright green for price
              if (currentCaption.type === "location") captionColor = "#FF4444" // Bright red for location
              if (currentCaption.type === "bedrooms") captionColor = "#00CCFF" // Bright cyan for bedrooms
              if (currentCaption.type === "bathrooms") captionColor = "#FF00FF" // Bright magenta for bathrooms
              if (currentCaption.type === "sqft") captionColor = "#FFFF00" // Bright yellow for sqft
              if (currentCaption.type === "feature") captionColor = "#FF8800" // Bright orange for features

              const words = currentCaption.text.split(" ")
              const lines: string[] = []

              // Break into lines (max 2 words per line)
              for (let i = 0; i < words.length; i += 2) {
                lines.push(words.slice(i, i + 2).join(" "))
              }

              const lineHeight = fontSize * 1.2
              const startY = canvas.height * 0.7

              lines.forEach((line, lineIndex) => {
                const y = startY + lineIndex * lineHeight

                // THICK BLACK OUTLINE for readability
                ctx.strokeStyle = "#000000"
                ctx.lineWidth = Math.floor(fontSize * 0.2)
                ctx.strokeText(line, canvas.width / 2, y)

                // BRIGHT COLORED TEXT
                ctx.fillStyle = captionColor
                ctx.fillText(line, canvas.width / 2, y)
              })
            }

            // Property info overlay
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

            {/* Progress Bar - CLEAN */}
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

        {/* CLEAN SUCCESS - NO NOISE */}
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
