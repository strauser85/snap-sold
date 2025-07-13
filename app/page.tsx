"use client"

import { useState, type ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Loader2,
  Play,
  Download,
  AlertCircle,
  CheckCircle,
  XCircle,
  ImageIcon,
  Wand2,
  FileText,
  Volume2,
  Upload,
} from "lucide-react"
import Textarea from "@/components/ui/textarea"
import { WorkingSlideshowGenerator } from "@/components/working-slideshow-generator"

interface GenerationProgress {
  step: string
  progress: number
}

interface VideoResult {
  videoUrl: string
  audioUrl?: string
  script: string
  listing: any
  metadata: any
}

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

  const [isLoading, setIsLoading] = useState(false)
  const [isGeneratingScript, setIsGeneratingScript] = useState(false)
  const [progress, setProgress] = useState<GenerationProgress | null>(null)
  const [result, setResult] = useState<VideoResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [slideshowConfig, setSlideshowConfig] = useState<any>(null)
  const [showGenerator, setShowGenerator] = useState(false)

  const MAX_IMAGES = 20

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
      let basicScript = `🏡 Welcome to ${address}! This stunning home features ${bedrooms} bedroom${Number(bedrooms) !== 1 ? "s" : ""} and ${bathrooms} bathroom${Number(bathrooms) !== 1 ? "s" : ""}, with ${Number(sqft).toLocaleString()} square feet of luxurious living space.`

      if (propertyDescription.trim()) {
        basicScript += ` ${propertyDescription.trim()}`
      }

      basicScript += ` Priced at $${Number(price).toLocaleString()}, this property is an incredible opportunity! Contact me today! 📞✨`

      setGeneratedScript(basicScript)
      setScriptMethod("fallback")
    } finally {
      setIsGeneratingScript(false)
    }
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

    setIsLoading(true)
    setError(null)
    setResult(null)
    setProgress(null)

    try {
      setProgress({ step: "Preparing slideshow generation...", progress: 25 })

      const imageUrls = successfulImages.map((img) => img.blobUrl!)

      const response = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          price: Number(price),
          bedrooms: Number(bedrooms),
          bathrooms: Number(bathrooms),
          sqft: Number(sqft),
          propertyDescription: propertyDescription.trim(),
          script: generatedScript,
          imageUrls: imageUrls,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }

      const data = await response.json()

      if (data.success && data.slideshowConfig) {
        setSlideshowConfig({
          images: imageUrls,
          timePerImage: data.slideshowConfig.timePerImage,
          totalDuration: data.slideshowConfig.totalDuration,
          audioUrl: data.slideshowConfig.audioUrl,
          audioError: data.slideshowConfig.audioError,
          format: data.slideshowConfig.format,
        })

        setShowGenerator(true)
        setProgress({ step: "Slideshow generator ready!", progress: 100 })
      } else {
        throw new Error("Failed to prepare slideshow")
      }
    } catch (err) {
      console.error("Generation error:", err)
      setError(err instanceof Error ? err.message : "Video generation failed")
    } finally {
      setIsLoading(false)
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
    setResult(null)
    setError(null)
    setProgress(null)
    setSlideshowConfig(null)
    setShowGenerator(false)
  }

  const uploadedCount = uploadedImages.filter((img) => img.blobUrl).length
  const uploadingCount = uploadedImages.filter((img) => img.isUploading).length
  const failedCount = uploadedImages.filter((img) => img.uploadError).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">SnapSold</h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            Create viral TikTok videos with AI-powered scripts and ElevenLabs voiceover
          </p>
        </div>

        {/* Form */}
        <Card className="shadow-lg border-0">
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
                  disabled={isLoading}
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
                  disabled={isLoading}
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
                  disabled={isLoading}
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
                  disabled={isLoading}
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
                  disabled={isLoading}
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
                disabled={isLoading}
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
                disabled={isLoading || uploadedImages.length >= MAX_IMAGES}
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
                          disabled={isLoading}
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
                  disabled={isGeneratingScript || !address || !price || !bedrooms || !bathrooms || !sqft}
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
                disabled={isLoading}
              />
            </div>

            <Button
              onClick={handleGenerateVideo}
              disabled={
                isLoading ||
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
              className="w-full h-12 text-base font-medium bg-indigo-600 hover:bg-indigo-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Preparing Slideshow...
                </>
              ) : (
                `Generate Slideshow (${uploadedCount} images ready)`
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Progress */}
        {progress && (
          <Card className="shadow-lg border-0">
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{progress.step}</span>
                  <span className="text-gray-500">{progress.progress}%</span>
                </div>
                <Progress value={progress.progress} className="h-2" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Video Preview */}
        <Card className="shadow-lg border-0">
          <CardContent className="p-6">
            <div className="aspect-[9/16] bg-gray-100 rounded-lg flex items-center justify-center min-h-[400px] max-w-sm mx-auto">
              {result ? (
                <div className="text-center space-y-4 w-full">
                  <div className="bg-black rounded-lg aspect-[9/16] flex items-center justify-center relative overflow-hidden">
                    <video src={result.videoUrl} controls className="w-full h-full object-cover" preload="metadata" />
                    <div className="absolute bottom-4 left-4 right-4 text-white bg-black bg-opacity-50 p-2 rounded">
                      <p className="text-sm font-medium">{result.listing?.address}</p>
                      <p className="text-xs opacity-80 flex items-center gap-1">
                        <Volume2 className="h-3 w-3" />
                        Property Slideshow
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={resetForm} variant="outline" className="flex-1 bg-transparent">
                      Generate Another
                    </Button>
                    <Button asChild className="flex-1">
                      <a href={result.videoUrl} download="property-slideshow.webm">
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </a>
                    </Button>
                  </div>
                </div>
              ) : showGenerator && slideshowConfig ? (
                <WorkingSlideshowGenerator
                  config={slideshowConfig}
                  onVideoGenerated={(videoUrl) => {
                    setResult({
                      videoUrl,
                      audioUrl: slideshowConfig.audioUrl,
                      script: generatedScript,
                      listing: { address, price: Number(price) },
                      metadata: { imageCount: slideshowConfig.images.length },
                    })
                    setShowGenerator(false)
                  }}
                  onError={(error) => {
                    setError(error)
                    setShowGenerator(false)
                  }}
                />
              ) : (
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto">
                    <Play className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500">Your slideshow will appear here</p>
                  <p className="text-xs text-gray-400">ElevenLabs voiceover included</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
