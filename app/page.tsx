"use client"

import { useState, useMemo, type ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Play, Download, AlertCircle, CheckCircle, XCircle, ImageIcon } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"

interface GenerationProgress {
  step: string
  progress: number
}

interface VideoResult {
  videoUrl: string
  listing: any // This will now be the manually entered data
  script: string
}

interface UploadedImage {
  file: File
  previewUrl: string
}

export default function VideoGenerator() {
  const [address, setAddress] = useState("")
  const [price, setPrice] = useState<number | string>("")
  const [bedrooms, setBedrooms] = useState<number | string>("")
  const [bathrooms, setBathrooms] = useState<number | string>("")
  const [sqft, setSqft] = useState<number | string>("")
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])

  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState<GenerationProgress | null>(null)
  const [result, setResult] = useState<VideoResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const generatedScript = useMemo(() => {
    if (!address || !price || !bedrooms || !bathrooms || !sqft) {
      return "Enter property details to generate a script."
    }
    const priceFormatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(Number(price))

    return `🏡 Welcome to ${address}! This stunning home features ${bedrooms} bedroom${
      Number(bedrooms) !== 1 ? "s" : ""
    } and ${bathrooms} bathroom${
      Number(bathrooms) !== 1 ? "s" : ""
    }, with ${Number(sqft).toLocaleString()} square feet of luxurious living space. Priced at ${priceFormatted}, this property is an incredible opportunity you won't want to miss! Schedule a tour today! 📞✨`
  }, [address, price, bedrooms, bathrooms, sqft])

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files = Array.from(event.target.files)
      const newImages: UploadedImage[] = files.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      }))
      setUploadedImages((prev) => [...prev, ...newImages])
    }
  }

  const removeImage = (index: number) => {
    setUploadedImages((prev) => {
      const newImages = [...prev]
      URL.revokeObjectURL(newImages[index].previewUrl) // Clean up object URL
      newImages.splice(index, 1)
      return newImages
    })
  }

  const handleGenerateVideo = async () => {
    if (!address || !price || !bedrooms || !bathrooms || !sqft || uploadedImages.length === 0) {
      setError("Please fill in all property details and upload at least one image.")
      return
    }

    setIsLoading(true)
    setError(null)
    setResult(null)
    setProgress(null)

    try {
      // Step 1: Upload images to Vercel Blob
      setProgress({ step: "Uploading images...", progress: 10 })
      const imageUrls: string[] = []
      for (const img of uploadedImages) {
        const response = await fetch("/api/upload-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: img.file.name, contentType: img.file.type }),
        })
        if (!response.ok) {
          throw new Error(`Failed to get upload token for ${img.file.name}`)
        }
        const { url, token } = await response.json()

        const uploadRes = await fetch(url, {
          method: "PUT",
          headers: {
            "x-blob-token": token,
            "Content-Type": img.file.type,
          },
          body: img.file,
        })

        if (!uploadRes.ok) {
          throw new Error(`Failed to upload image ${img.file.name}`)
        }
        const uploadedBlob = await uploadRes.json()
        imageUrls.push(uploadedBlob.url)
      }
      setProgress({ step: "Images uploaded!", progress: 30 })

      // Step 2: Prepare data for video generation API
      const propertyData = {
        address,
        price: Number(price),
        bedrooms: Number(bedrooms),
        bathrooms: Number(bathrooms),
        sqft: Number(sqft),
        description: generatedScript, // Use the locally generated script
        imageUrls: imageUrls, // Pass uploaded image URLs
      }

      // Step 3: Call the video generation API
      setProgress({ step: "Generating video...", progress: 50 })
      const response = await fetch("/api/generate-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(propertyData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate video.")
      }

      const data = await response.json()
      setResult(data)
      setProgress({ step: "Video generated successfully!", progress: 100 })
    } catch (err) {
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
    uploadedImages.forEach((img) => URL.revokeObjectURL(img.previewUrl)) // Clean up
    setUploadedImages([])
    setResult(null)
    setError(null)
    setProgress(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">SnapSold</h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            Enter property details to create a TikTok-style video with AI voiceover
          </p>
        </div>

        {/* Form */}
        <Card className="shadow-lg border-0">
          <CardContent className="p-6 space-y-6">
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
            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="images" className="text-sm font-medium text-gray-700">
                Upload Property Images (Max 5)
              </Label>
              <Input
                id="images"
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                className="h-12 text-base file:text-indigo-600 file:font-medium"
                disabled={isLoading || uploadedImages.length >= 5}
              />
              <div className="mt-4 grid grid-cols-3 gap-2">
                {uploadedImages.map((img, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={img.previewUrl || "/placeholder.svg"}
                      alt={`Property image ${index + 1}`}
                      className="w-full h-24 object-cover rounded-md border border-gray-200"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeImage(index)}
                      disabled={isLoading}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {uploadedImages.length === 0 && (
                  <div className="col-span-3 text-center text-gray-500 text-sm py-4">
                    <ImageIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    No images uploaded yet.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="generated-script" className="text-sm font-medium text-gray-700">
                Generated Voiceover Script
              </Label>
              <Textarea
                id="generated-script"
                value={generatedScript}
                readOnly
                className="min-h-[100px] text-base bg-gray-50"
              />
            </div>

            <Button
              onClick={handleGenerateVideo}
              disabled={
                isLoading || !address || !price || !bedrooms || !bathrooms || !sqft || uploadedImages.length === 0
              }
              className="w-full h-12 text-base font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Video...
                </>
              ) : (
                "Generate Video"
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
            <div className="aspect-[9/16] bg-gray-100 rounded-lg flex items-center justify-center min-h-[300px]">
              {result ? (
                <div className="text-center space-y-4 w-full">
                  <div className="bg-black rounded-lg aspect-[9/16] flex items-center justify-center relative overflow-hidden">
                    {/* In a real app, you'd use a <video> tag here with result.videoUrl */}
                    <CheckCircle className="h-16 w-16 text-green-400" />
                    <div className="absolute bottom-4 left-4 right-4 text-white">
                      <p className="text-sm font-medium">{result.listing.address}</p>
                      <p className="text-xs opacity-80">Video generated successfully!</p>
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
                          <p className="font-medium text-gray-700">Beds/Baths:</p>
                          <p className="text-gray-600">
                            {result.listing.bedrooms}/{result.listing.bathrooms}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-700">Square Feet:</p>
                          <p className="text-gray-600">{result.listing.sqft?.toLocaleString()}</p>
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
                  <p className="text-sm text-gray-500">Your generated video will appear here</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
