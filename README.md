# ThePhotoBooth

ThePhotoBooth is a Python web-based photo booth application that lets customers take webcam photos, view them in a personal gallery, and save them as photo-strip style collages. It includes a kiosk-style customer experience and an admin interface for reviewing, editing, printing, and downloading sessions.

## What this project does

This project combines:

- A customer-facing kiosk interface for entering a name, taking photos, and viewing the finished collage
- A gallery view that shows previous sessions for the logged-in customer
- An admin panel for browsing customer folders, applying filters, adding text overlays, and saving or downloading edited collages
- A local file storage system under the static photos folder so sessions are preserved between runs

The app is built with Flask, Pillow, and OpenCV and runs locally in the browser.

## Project structure

- app.py: main Flask application; serves the kiosk and admin pages and handles API routes for sessions, uploads, editing, and deletion
- photobooth.py: older standalone photobooth script that captures images from the webcam and creates a PNG/GIF strip
- photobooth_config.py: camera and image layout settings
- templates/: HTML templates for the kiosk and admin UI
- static/: CSS, JavaScript, and uploaded photo assets
- static/photos/: generated customer session folders and saved images

## Requirements

Before you start, make sure you have:

- Python 3.8 or newer
- A working webcam connected to the machine
- A modern browser with camera permissions enabled

## Setup

1. Open a terminal in the project folder.

2. Create and activate a virtual environment:

   On Windows:

   ```powershell
   python -m venv .venv
   .\.venv\Scripts\activate
   ```

   On macOS/Linux:

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. Install the required packages:

   ```bash
   pip install Flask pillow opencv-python cryptography
   ```

4. Optional: if you want to enable Imgur uploads, install:

   ```bash
   pip install imgurpython
   ```

## Running the app

Start the Flask web app:

```bash
python app.py
```

To start the app with ad-hoc SSL (HTTPS) enabled, which is often required for webcam access on some modern browsers:

```bash
python app.py --ssl
```

Then open one of these URLs in your browser:

- Kiosk: http://localhost:5000/ (or https://localhost:5000/ if using --ssl)
- Admin panel: http://localhost:5000/admin (or https://localhost:5000/admin if using --ssl)

## Using the app

### Customer experience

1. Open the kiosk page.
2. Enter your name.
3. Choose how many photos you want to take.
4. Allow camera access when prompted.
5. Capture the photos and review the finished collage.
6. Your images are automatically stored in a folder under static/photos.

### Admin experience

1. Open the admin page.
2. Select a customer session from the left-hand list.
3. Apply filters or add text overlay.
4. Save the edited collage, print it, or download it.

## Configuration

The main visual and camera settings are defined in photobooth_config.py.

Common settings you may want to adjust:

- camera_port: webcam index to use
- ramp_frames: camera warm-up frames
- wait_time: countdown timing between captures
- strip_rows / strip_columns: collage layout size
- footer / gif_footer: optional footer image files

If your webcam is not detected correctly, try changing camera_port to another value such as 1 or 2.

## Photo storage

Captured images are stored in the static/photos folder, organized by customer name. Each session creates its own folder so galleries and admin views can load images by customer.

## Troubleshooting

### Camera not working

- Make sure your webcam is plugged in and not already being used by another app.
- Try changing camera_port in photobooth_config.py.
- Allow browser camera access when prompted.

### Missing packages

If you get import errors, reinstall dependencies:

```bash
pip install --upgrade Flask pillow opencv-python cryptography
```

### SSL/Cryptography Error

If you run the app with `--ssl` and get a `TypeError` related to ad-hoc certificates, ensure the `cryptography` library is installed:

```bash
pip install cryptography
```

### Port already in use

If port 5000 is already occupied, change the port in app.py:

```python
app.run(host='0.0.0.0', port=5000, debug=True)
```

## Notes

- The web app is the main interface for this project.
- photobooth.py is a standalone script and is not required for the Flask app to run.
- The app stores files locally by default; it does not require a database.

## Building Executables

You can build a standalone executable that doesn't require Python to be installed. The project includes a `ThePhotoBooth.spec` file configured to package the app along with its `templates` and `static` directories.

First, ensure you have PyInstaller installed:
```bash
pip install pyinstaller
```

### Build on Windows (.exe)
Run the following command in the project directory:
```powershell
pyinstaller ThePhotoBooth.spec
```
The standalone `.exe` will be generated in the `dist` folder as `dist\ThePhotoBooth.exe`.

### Build on Ubuntu / Linux
To create an executable for your Ubuntu server, you must run the build command **on the Ubuntu machine** (PyInstaller does not support cross-compiling from Windows to Linux).

Run the following command on your Ubuntu server:
```bash
pyinstaller ThePhotoBooth.spec
```
The Linux executable will be generated in the `dist` folder as `dist/ThePhotoBooth`.
