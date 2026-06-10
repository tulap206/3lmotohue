import os
from PIL import Image, ImageDraw

def make_circle(image_path):
    img = Image.open(image_path).convert("RGBA")
    width, height = img.size
    
    # Create a circular mask
    mask = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, width, height), fill=255)
    
    # Apply mask
    result = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    result.paste(img, (0, 0), mask=mask)
    return result

# We want to crop logo.jpg to a circle
circular_logo = make_circle("public/logo.jpg")

# 1. Save PNG versions (including apple-icon and favicon PNG components)
png_paths = [
    "app/icon.png",
    "app/apple-icon.png",
    "public/apple-icon.png",
    "public/icon-light-32x32.png",
    "public/icon-dark-32x32.png",
    "public/icon-192.png",
    "public/icon-512.png"
]

for path in png_paths:
    # Resize accordingly if needed
    if "32x32" in path:
        size = (32, 32)
    elif "192" in path:
        size = (192, 192)
    elif "512" in path:
        size = (512, 512)
    elif "apple-icon" in path:
        size = (180, 180) # Apple touch icon size
    else:
        size = (32, 32) # Standard icon
        
    resized = circular_logo.resize(size, Image.Resampling.LANCZOS)
    # Ensure directory exists
    os.makedirs(os.path.dirname(path), exist_ok=True)
    resized.save(path, "PNG")
    print(f"Saved PNG to {path}")

# 2. Save ICO versions (both public/favicon.ico and app/favicon.ico)
ico_sizes = [(16, 16), (32, 32), (48, 48), (256, 256)]
ico_imgs = []
for size in ico_sizes:
    ico_imgs.append(circular_logo.resize(size, Image.Resampling.LANCZOS))

# Ensure directories exist
os.makedirs("public", exist_ok=True)
os.makedirs("app", exist_ok=True)

ico_imgs[1].save("public/favicon.ico", format="ICO", sizes=ico_sizes)
ico_imgs[1].save("app/favicon.ico", format="ICO", sizes=ico_sizes)
print("Saved ICO to public/favicon.ico and app/favicon.ico")

# 3. Re-create public/icon.svg with circular base64 PNG
import base64
from io import BytesIO

buffered = BytesIO()
circular_logo.resize((32, 32), Image.Resampling.LANCZOS).save(buffered, format="PNG")
img_str = base64.b64encode(buffered.getvalue()).decode()

svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <image href="data:image/png;base64,{img_str}" width="32" height="32"/>
</svg>'''

with open("public/icon.svg", "w") as f:
    f.write(svg_content)
print("Saved SVG to public/icon.svg")
