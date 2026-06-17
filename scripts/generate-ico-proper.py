import os
from PIL import Image

def generate_ico():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    png_path = os.path.join(current_dir, '../build/icon.png')
    ico_path = os.path.join(current_dir, '../build/icon.ico')

    if not os.path.exists(png_path):
        print(f"Error: Source PNG file not found at {png_path}")
        return

    try:
        # Load the source PNG image
        img = Image.open(png_path)
        
        # Define standard icon sizes required by Windows Explorer
        icon_sizes = [
            (16, 16),
            (24, 24),
            (32, 32),
            (48, 48),
            (64, 64),
            (96, 96),
            (128, 128),
            (256, 256)
        ]
        
        # Save as ICO with all dimensions embedded
        img.save(ico_path, sizes=icon_sizes)
        print(f"Successfully generated high-quality multi-resolution icon.ico at {ico_path}!")
        
    except Exception as e:
        print(f"Error generating icon.ico: {e}")

if __name__ == '__main__':
    generate_ico()
