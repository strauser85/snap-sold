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
  Grid3X3,
  List,
  Info,
} from "lucide-react"
import Textarea from "@/components/ui/textarea"

interface GenerationProgress {
  step: string
  progress: number
}

interface VideoResult {
  videoUrl: string
  audioUrl: string
  script: string
  listing: any
  metadata: any
}

interface UploadedImage {
  file: File
  previewUrl: string
  base64: string
  id: string
}

export default function VideoGenerator() {
  const [address, setAddress] = useState("")
  const [price, setPrice] = useState<number | string>("")
  const [bedrooms, setBedrooms] = useState<number | string>("")
  const [bathrooms, setBathrooms] = useState<number | string>("")
  const [sqft, setSqft] = useState<number | string>("")
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [generatedScript, setGeneratedScript] = useState("")
  const [imageViewMode, setImageViewMode] = useState<"grid" | "list">("grid")
  const [scriptMethod, setScriptMethod] = useState<string>("")

  const [isLoading, setIsLoading] = useState(false)
  const [isGeneratingScript, setIsGeneratingScript] = useState(false)
  const [progress, setProgress] = useState<GenerationProgress | null>(null)
  const [result, setResult] = useState<VideoResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const MAX_IMAGES = 20

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = (error) => reject(error)
    })
  }

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files = Array.from(event.target.files)
      const remainingSlots = MAX_IMAGES - uploadedImages.length

      for (let i = 0; i < Math.min(files.length, remainingSlots); i++) {
        const file = files[i]

        try {
          const base64 = await fileToBase64(file)
          const newImage: UploadedImage = {
            file,
            previewUrl: URL.createObjectURL(file),
            base64: base64,
            id: `img-${Date.now()}-${i}`,
          }
          setUploadedImages((prev) => [...prev, newImage])
        } catch (error) {
          console.error("Error converting file to base64:", error)
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

  const moveImage = (id: string, direction: "up" | "down") => {
    setUploadedImages((prev) => {
      const currentIndex = prev.findIndex((img) => img.id === id)
      if (currentIndex === -1) return prev

      const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1
      if (newIndex < 0 || newIndex >= prev.length) return prev

      const newArray = [...prev]
      const [movedItem] = newArray.splice(currentIndex, 1)
      newArray.splice(newIndex, 0, movedItem)
      return newArray
    })
  }

  const generateAIScript = async () => {
    if (!address || !price || !bedrooms || !bathrooms || !sqft) {
      setError("Please fill in all property details first.")
      return
    }

    setIsGeneratingScript(true)
    setError(null)
    setScriptMethod("")

    try {
      console.log("Calling script generation API...")

      const response = await fetch("/api/generate-script", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address,
          price: Number(price),
          bedrooms: Number(bedrooms),
          bathrooms: Number(bathrooms),
          sqft: Number(sqft),
          imageCount: uploadedImages.length,
        }),
      })

      console.log("API response status:", response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("API error:", errorText)
        throw new Error(`API returned ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      console.log("Script generated successfully:", data.method)

      setGeneratedScript(data.script)
      setScriptMethod(data.method)
    } catch (err) {
      console.error("Script generation failed:", err)
      setError(err instanceof Error ? err.message : "Failed to generate script.")

      // Fallback to basic script if API completely fails
      const basicScript = `🏡 Welcome to ${address}! This stunning home features ${bedrooms} bedroom${Number(bedrooms) !== 1 ? "s" : ""} and ${bathrooms} bathroom${Number(bathrooms) !== 1 ? "s" : ""}, with ${Number(sqft).toLocaleString()} square feet of luxurious living space. Priced at $${Number(price).toLocaleString()}, this property is an incredible opportunity you won't want to miss! Schedule a tour today! 📞✨`

      setGeneratedScript(basicScript)
      setScriptMethod("emergency")
    } finally {
      setIsGeneratingScript(false)
    }
  }

  const handleGenerateVideo = async () => {
    if (!address || !price || !bedrooms || !bathrooms || !sqft || !generatedScript || uploadedImages.length === 0) {
      setError("Please fill in all details, generate a script, and upload at least one image.")
      return
    }

    setIsLoading(true)
    setError(null)
    setResult(null)
    setProgress(null)

    try {
      setProgress({ step: `Processing ${uploadedImages.length} images...`, progress: 20 })
      await new Promise((resolve) => setTimeout(resolve, 1000))

      setProgress({ step: "Generating AI voiceover...", progress: 40 })
      await new Promise((resolve) => setTimeout(resolve, 1000))

      setProgress({ step: "Creating multi-image TikTok video...", progress: 60 })

      const response = await fetch("/api/generate-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address,
          price: Number(price),
          bedrooms: Number(bedrooms),
          bathrooms: Number(bathrooms),
          sqft: Number(sqft),
          script: generatedScript,
          imageUrls: uploadedImages.map((img) => img.base64),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate video.")
      }

      const data = await response.json()
      setResult(data)
      setProgress({ step: "Multi-image TikTok video generated successfully!", progress: 100 })
    } catch (err) {
      console.error("Generation error:", err)
      setError(err instanceof Error ? err.message : "An unexpected error occurred.")
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
    setGeneratedScript("")
    setScriptMethod("")
    uploadedImages.forEach((img) => URL.revokeObjectURL(img.previewUrl))
    setUploadedImages([])
    setResult(null)
    setError(null)
    setProgress(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">SnapSold</h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            Create viral TikTok videos with AI-powered scripts and multiple property images
          </p>
        </div>

        {/* Form */}
        <Card className="shadow-lg border-0">
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="address" className="text-sm font-medium text-gray-700">
                  Property Address
                </Label>
                <Input
                  id="address"
                  type="text"
                  placeholder="e.g., 123 Main St, Anytown, USA"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-12 text-base"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price" className="text-sm font-medium text-gray-700">
                  Price ($)
                </Label>
                <Input
                  id="price"
                  type="number"
                  placeholder="e.g., 500000"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="h-12 text-base"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bedrooms" className="text-sm font-medium text-gray-700">
                  Bedrooms
                </Label>
                <Input
                  id="bedrooms"
                  type="number"
                  placeholder="e.g., 3"
                  value={bedrooms}
                  onChange={(e) => setBedrooms(e.target.value)}
                  className="h-12 text-base"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bathrooms" className="text-sm font-medium text-gray-700">
                  Bathrooms
                </Label>
                <Input
                  id="bathrooms"
                  type="number"
                  placeholder="e.g., 2.5"
                  value={bathrooms}
                  onChange={(e) => setBathrooms(e.target.value)}
                  className="h-12 text-base"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sqft" className="text-sm font-medium text-gray-700">
                  Square Footage
                </Label>
                <Input
                  id="sqft"
                  type="number"
                  placeholder="e.g., 2500"
                  value={sqft}
                  onChange={(e) => setSqft(e.target.value)}
                  className="h-12 text-base"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="images" className="text-sm font-medium text-gray-700">
                  Upload Property Images (Max {MAX_IMAGES}) - {uploadedImages.length} uploaded
                </Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setImageViewMode(imageViewMode === "grid" ? "list" : "grid")}
                    className="h-8"
                  >
                    {imageViewMode === "grid" ? <List className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Input
                id="images"
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                className="h-12 text-base file:text-indigo-600 file:font-medium"
                disabled={isLoading || uploadedImages.length >= MAX_IMAGES}
              />

              {/* Image Display */}
              {uploadedImages.length > 0 && (
                <div className="border rounded-lg p-4 bg-gray-50 max-h-80 overflow-y-auto">
                  {imageViewMode === "grid" ? (
                    <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                      {uploadedImages.map((img, index) => (
                        <div key={img.id} className="relative group">
                          <img
                            src={img.previewUrl || "/placeholder.svg"}
                            alt={`Property image ${index + 1}`}
                            className="w-full h-20 object-cover rounded-md border border-gray-200"
                          />
                          <div className="absolute top-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1 rounded">
                            {index + 1}
                          </div>
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
                  ) : (
                    <div className="space-y-2">
                      {uploadedImages.map((img, index) => (
                        <div key={img.id} className="flex items-center gap-3 p-2 bg-white rounded border">
                          <img
                            src={img.previewUrl || "/placeholder.svg"}
                            alt={`Property image ${index + 1}`}
                            className="w-12 h-12 object-cover rounded"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium">Image {index + 1}</p>
                            <p className="text-xs text-gray-500">{img.file.name}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => moveImage(img.id, "up")}
                              disabled={index === 0 || isLoading}
                              className="h-6 w-6 p-0"
                            >
                              ↑
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => moveImage(img.id, "down")}
                              disabled={index === uploadedImages.length - 1 || isLoading}
                              className="h-6 w-6 p-0"
                            >
                              ↓
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => removeImage(img.id)}
                              disabled={isLoading}
                              className="h-6 w-6 p-0"
                            >
                              <XCircle className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {uploadedImages.length === 0 && (
                <div className="text-center text-gray-500 text-sm py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  <ImageIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p>No images uploaded yet.</p>
                  <p className="text-xs">Upload up to {MAX_IMAGES} property images for your video</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="generated-script" className="text-sm font-medium text-gray-700">
                  AI-Generated TikTok Script
                  {scriptMethod && (
                    <span className="ml-2 text-xs text-gray-500">
                      (
                      {scriptMethod === "AI"
                        ? "AI-powered"
                        : scriptMethod === "fallback"
                          ? "Smart template"
                          : "Basic template"}
                      )
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
                placeholder="Click 'Generate Script' to create an AI-powered TikTok script, or write your own..."
                className="min-h-[120px] text-base"
                disabled={isLoading}
              />
              {scriptMethod === "fallback" && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    AI generation unavailable - using smart template. You can edit the script above.
                  </AlertDescription>
                </Alert>
              )}
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
                uploadedImages.length === 0
              }
              className="w-full h-12 text-base font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Multi-Image TikTok Video...
                </>
              ) : (
                `Generate TikTok Video (${uploadedImages.length} images)`
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

        {/* Video Preview Area */}
        <Card className="shadow-lg border-0">
          <CardContent className="p-6">
            <div className="aspect-[9/16] bg-gray-100 rounded-lg flex items-center justify-center min-h-[400px] max-w-sm mx-auto">
              {result ? (
                <div className="text-center space-y-4 w-full">
                  <div className="bg-black rounded-lg aspect-[9/16] flex items-center justify-center relative overflow-hidden">
                    {result.videoUrl.includes("sample-videos") ? (
                      <CheckCircle className="h-16 w-16 text-green-400" />
                    ) : (
                      <video
                        src={result.videoUrl}
                        controls
                        className="w-full h-full object-cover"
                        poster="/placeholder.svg?height=400&width=225"
                      />
                    )}
                    <div className="absolute bottom-4 left-4 right-4 text-white">
                      <p className="text-sm font-medium">{result.listing.address}</p>
                      <p className="text-xs opacity-80">Multi-image TikTok video ready!</p>
                    </div>
                  </div>

                  {/* Property Details */}
                  {result.listing && (
                    <div className="text-left space-y-3 text-sm bg-gray-50 p-4 rounded-lg">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="font-medium text-gray-700">Address:</p>
                          <p className="text-gray-600">{result.listing.address}</p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-700">Price:</p>
                          <p className="text-gray-600 font-semibold text-green-600">
                            ${result.listing.price?.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-700">Images Used:</p>
                          <p className="text-gray-600">{uploadedImages.length} photos</p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-700">Duration:</p>
                          <p className="text-gray-600">{result.metadata?.duration}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button onClick={resetForm} variant="outline" className="flex-1 bg-transparent">
                      Generate Another
                    </Button>
                    {result.videoUrl && (
                      <Button asChild className="flex-1">
                        <a href={result.videoUrl} target="_blank" rel="noopener noreferrer">
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto">
                    <Play className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500">Your multi-image TikTok video will appear here</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
