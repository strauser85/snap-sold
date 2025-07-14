import { type NextRequest, NextResponse } from "next/server"

interface SlideshowRequest {
  images: string[]
  audioUrl: string
  duration: number
  captions: any[]
  property: any
}

export async function POST(request: NextRequest) {
  try {
    const data: SlideshowRequest = await request.json()

    console.log("🎬 Simple slideshow API called")
    console.log(`📍 Property: ${data.property.address}`)
    console.log(`🖼️ Images: ${data.images.length}`)
    console.log(`⏱️ Duration: ${data.duration}s`)

    // Create a simple HTML slideshow that can be saved as video
    const slideshowHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Property Video - ${data.property.address}</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background: black;
            font-family: Arial, sans-serif;
            overflow: hidden;
        }
        .slideshow-container {
            position: relative;
            width: 576px;
            height: 1024px;
            margin: 0 auto;
            background: black;
        }
        .slide {
            position: absolute;
            width: 100%;
            height: 100%;
            opacity: 0;
            transition: opacity 0.5s ease-in-out;
        }
        .slide.active {
            opacity: 1;
        }
        .slide img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .property-info {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.4));
            color: white;
            padding: 20px;
            z-index: 10;
        }
        .address {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .price {
            font-size: 16px;
            color: #FFD700;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .details {
            font-size: 14px;
        }
        .caption {
            position: absolute;
            bottom: 200px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.8);
            color: #FFFF00;
            padding: 15px 25px;
            border-radius: 10px;
            font-size: 24px;
            font-weight: 900;
            text-align: center;
            max-width: 80%;
            z-index: 10;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
        }
        .controls {
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 20;
        }
        button {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 10px 20px;
            margin: 0 5px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
        }
        button:hover {
            background: #45a049;
        }
        .instructions {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255,255,255,0.95);
            color: black;
            padding: 30px;
            border-radius: 15px;
            text-align: center;
            max-width: 400px;
            z-index: 100;
        }
    </style>
</head>
<body>
    <div class="slideshow-container">
        <div class="property-info">
            <div class="address">${data.property.address}</div>
            <div class="price">$${data.property.price.toLocaleString()}</div>
            <div class="details">${data.property.bedrooms}BR • ${data.property.bathrooms}BA • ${data.property.sqft.toLocaleString()} sqft</div>
        </div>
        
        ${data.images
          .map(
            (img, index) => `
            <div class="slide ${index === 0 ? "active" : ""}" data-index="${index}">
                <img src="${img}" alt="Property image ${index + 1}" />
            </div>
        `,
          )
          .join("")}
        
        <div class="caption" id="caption"></div>
        
        <div class="controls">
            <button onclick="playSlideshow()">▶️ Play Slideshow</button>
            <button onclick="downloadInstructions()">📥 Download Instructions</button>
        </div>
        
        <div class="instructions" id="instructions">
            <h3>🎬 Property Video Ready!</h3>
            <p><strong>This slideshow contains:</strong></p>
            <ul style="text-align: left;">
                <li>✅ ${data.images.length} property images</li>
                <li>✅ Rachel voiceover (${data.duration}s)</li>
                <li>✅ ${data.captions.length} captions</li>
            </ul>
            <p><strong>To create video:</strong></p>
            <ol style="text-align: left; font-size: 12px;">
                <li>Click "Play Slideshow"</li>
                <li>Use screen recording software</li>
                <li>Or use browser dev tools to record</li>
            </ol>
            <button onclick="closeInstructions()">Got it!</button>
        </div>
    </div>

    <audio id="voiceover" preload="auto">
        <source src="${data.audioUrl}" type="audio/mpeg">
    </audio>

    <script>
        const slides = document.querySelectorAll('.slide');
        const caption = document.getElementById('caption');
        const audio = document.getElementById('voiceover');
        const captions = ${JSON.stringify(data.captions)};
        
        let currentSlide = 0;
        let isPlaying = false;
        
        function showSlide(index) {
            slides.forEach(slide => slide.classList.remove('active'));
            slides[index].classList.add('active');
        }
        
        function updateCaption(time) {
            const currentCaption = captions.find(cap => 
                time >= cap.startTime && time < cap.endTime
            );
            caption.textContent = currentCaption ? currentCaption.text : '';
        }
        
        function playSlideshow() {
            if (isPlaying) return;
            isPlaying = true;
            
            document.querySelector('.controls').style.display = 'none';
            
            audio.currentTime = 0;
            audio.play();
            
            const slideInterval = ${(data.duration * 1000) / data.images.length};
            let slideIndex = 0;
            
            const slideTimer = setInterval(() => {
                if (slideIndex < slides.length - 1) {
                    slideIndex++;
                    showSlide(slideIndex);
                }
            }, slideInterval);
            
            audio.ontimeupdate = () => {
                updateCaption(audio.currentTime);
            };
            
            audio.onended = () => {
                clearInterval(slideTimer);
                isPlaying = false;
                document.querySelector('.controls').style.display = 'block';
                caption.textContent = '✅ Slideshow Complete!';
            };
        }
        
        function closeInstructions() {
            document.getElementById('instructions').style.display = 'none';
        }
        
        function downloadInstructions() {
            const instructions = \`
Property Video Package - ${data.property.address}

CONTENTS:
- ${data.images.length} property images
- Rachel voiceover (${data.duration} seconds)
- ${data.captions.length} text captions

INSTRUCTIONS:
1. Save this HTML file
2. Open in browser
3. Click "Play Slideshow"
4. Use screen recording to capture video
5. Or import assets into video editing software

CAPTIONS:
\${captions.map(cap => \`\${cap.startTime.toFixed(1)}s: \${cap.text}\`).join('\\n')}

This package contains everything needed for your property video!
            \`;
            
            const blob = new Blob([instructions], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'property-video-instructions.txt';
            a.click();
            URL.revokeObjectURL(url);
        }
    </script>
</body>
</html>`

    // Convert HTML to blob URL
    const htmlBlob = new Blob([slideshowHTML], { type: "text/html" })
    const htmlUrl = URL.createObjectURL(htmlBlob)

    console.log("✅ Simple slideshow HTML created")

    return NextResponse.json({
      success: true,
      videoUrl: htmlUrl,
      method: "html-slideshow",
      message: "Interactive slideshow created - can be screen recorded to create video",
    })
  } catch (error) {
    console.error("❌ Simple slideshow creation failed:", error)
    return NextResponse.json(
      {
        error: "Slideshow creation failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
