import os
import re
import time
import base64
import sys
import json
from datetime import timedelta
from flask import Flask, request, jsonify, render_template, session, send_from_directory
from PIL import Image, ImageOps, ImageFilter, ImageEnhance
from io import BytesIO
from sticker_packs import draw_sticker_pack, STICKER_PACK_OPTIONS

RESOURCE_DIR = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
APP_DATA_DIR = os.path.dirname(sys.executable) if getattr(sys, 'frozen', False) else RESOURCE_DIR
BUNDLED_STATIC_DIR = os.path.join(RESOURCE_DIR, 'static')
PHOTOS_DIR = os.path.join(APP_DATA_DIR, 'static', 'photos')
SETTINGS_PATH = os.path.join(APP_DATA_DIR, 'photobooth_settings.json')
DEFAULT_SETTINGS = {
    'session_duration_minutes': 4,
}
FRAME_WIDTH = 1182
# A modest footer below the fourth photo keeps the strip balanced without
# leaving an oversized blank area.
FRAME_HEIGHT = 3700


def load_settings():
    settings = DEFAULT_SETTINGS.copy()
    try:
        if os.path.exists(SETTINGS_PATH):
            with open(SETTINGS_PATH, 'r', encoding='utf-8') as settings_file:
                saved_settings = json.load(settings_file)
            if isinstance(saved_settings, dict):
                settings.update(saved_settings)
    except (OSError, json.JSONDecodeError):
        pass

    try:
        settings['session_duration_minutes'] = max(1, min(30, int(settings['session_duration_minutes'])))
    except (TypeError, ValueError):
        settings['session_duration_minutes'] = DEFAULT_SETTINGS['session_duration_minutes']
    return settings


def save_settings(settings):
    temporary_path = f'{SETTINGS_PATH}.tmp'
    with open(temporary_path, 'w', encoding='utf-8') as settings_file:
        json.dump(settings, settings_file, indent=2)
    os.replace(temporary_path, SETTINGS_PATH)


settings = load_settings()
if not os.path.exists(SETTINGS_PATH):
    save_settings(settings)

# PyInstaller extracts bundled files to a temporary folder for every run.
# Serve bundled web assets explicitly so uploaded photos can persist beside EXE.
app = Flask(__name__, static_folder=None)
# Secure secret key for session management – persists across restarts
# so that existing client session cookies remain valid.
_secret_path = os.path.join(APP_DATA_DIR, '.flask_secret')
if os.path.exists(_secret_path):
    with open(_secret_path, 'rb') as _f:
        app.secret_key = _f.read()
else:
    app.secret_key = os.urandom(24)
    with open(_secret_path, 'wb') as _f:
        _f.write(app.secret_key)
# Keep the server session alive for the configured kiosk duration plus a buffer.
app.permanent_session_lifetime = timedelta(minutes=settings['session_duration_minutes'] + 1)

# Ensure static/photos directory exists
os.makedirs(PHOTOS_DIR, exist_ok=True)


@app.route('/static/photos/<path:filename>')
def serve_photo(filename):
    """Serve persistent photos saved beside this executable."""
    return send_from_directory(PHOTOS_DIR, filename)


@app.route('/api/photo/download/<path:filename>')
def download_photo(filename):
    """Force a local browser download for a saved photo or collage."""
    return send_from_directory(
        PHOTOS_DIR,
        filename,
        as_attachment=True,
        download_name=os.path.basename(filename),
    )


@app.route('/static/<path:filename>')
def serve_static_asset(filename):
    """Serve CSS, JavaScript, and other bundled assets."""
    return send_from_directory(BUNDLED_STATIC_DIR, filename)

def sanitize_filename(name: str) -> str:
    """Return a filesystem‑safe version of a user supplied name."""
    cleaned = re.sub(r'[^a-zA-Z0-9\s_-]', '', name).strip()
    return cleaned.replace(' ', '_')


def apply_photo_filter(image: Image.Image, filter_name: str) -> Image.Image:
    """Apply the same named filter choices available in the admin editor."""
    image = image.convert('RGB')
    filter_name = filter_name if filter_name in {
        'normal', 'grayscale', 'sepia', 'cyan', 'neon', 'contrast'
    } else 'normal'

    if filter_name == 'grayscale':
        return ImageOps.grayscale(image).convert('RGB')
    if filter_name == 'sepia':
        filtered = ImageOps.colorize(ImageOps.grayscale(image), '#372217', '#f1d4a0')
        filtered = ImageEnhance.Contrast(filtered).enhance(0.9)
        return ImageEnhance.Brightness(filtered).enhance(0.95)
    if filter_name in {'cyan', 'neon'}:
        hue_shift = 128 if filter_name == 'cyan' else 206
        hue, saturation, value = image.convert('HSV').split()
        hue = hue.point(lambda pixel: (pixel + hue_shift) % 256)
        filtered = Image.merge('HSV', (hue, saturation, value)).convert('RGB')
        return ImageEnhance.Color(filtered).enhance(1.1 if filter_name == 'cyan' else 1.4)
    if filter_name == 'contrast':
        filtered = ImageEnhance.Contrast(image).enhance(1.4)
        return ImageEnhance.Brightness(filtered).enhance(1.05)
    return image

@app.route('/')
def kiosk():
    return render_template('kiosk.html')

@app.route('/admin')
def admin():
    return render_template('admin.html', sticker_packs=STICKER_PACK_OPTIONS)


@app.route('/api/settings')
def get_settings():
    """Return the kiosk-safe portion of the venue configuration."""
    return jsonify({'session_duration_minutes': settings['session_duration_minutes']})


@app.route('/api/admin/settings', methods=['POST'])
def update_settings():
    """Persist venue timer settings."""
    data = request.json or {}

    try:
        duration = int(data.get('session_duration_minutes'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Enter a whole number of minutes'}), 400
    if not 1 <= duration <= 30:
        return jsonify({'error': 'Session duration must be between 1 and 30 minutes'}), 400

    settings['session_duration_minutes'] = duration
    settings.pop('admin_pin', None)
    save_settings(settings)
    app.permanent_session_lifetime = timedelta(minutes=duration + 1)
    return jsonify({'status': 'success', 'session_duration_minutes': duration})

# ---------------------------------------------------------------------------
# Session handling – the kiosk start endpoint also acts as a login
# ---------------------------------------------------------------------------
@app.before_request
def make_session_permanent():
    session.permanent = True

@app.route('/api/session/start', methods=['POST'])
def start_session():
    data = request.json or {}
    customer_name = data.get('customer_name', 'Guest').strip() or 'Guest'
    sanitized_name = sanitize_filename(customer_name)
    session_dir_name = sanitized_name
    session_path = os.path.join(PHOTOS_DIR, session_dir_name)
    os.makedirs(session_path, exist_ok=True)
    # Store in Flask session for later requests
    session['customer_name'] = customer_name
    session['session_dir'] = session_dir_name
    return jsonify({
        'session_dir': session_dir_name,
        'customer_name': customer_name
    })

# ---------------------------------------------------------------------------
# Photo upload – accepts images, stores each with a unique timestamp suffix, builds collage
# ---------------------------------------------------------------------------
@app.route('/api/session/upload', methods=['POST'])
def upload_photos():
    data = request.json or {}
    # Prefer the session‑stored directory if not explicitly supplied
    session_dir = data.get('session_dir') or session.get('session_dir')
    image_data_list = data.get('images', [])
    image_filter = data.get('image_filter', 'normal')
    if not session_dir or not image_data_list:
        return jsonify({'error': 'Missing session_dir or images'}), 400
    session_path = os.path.join(PHOTOS_DIR, session_dir)
    if not os.path.exists(session_path):
        return jsonify({'error': 'Session directory not found'}), 404
    saved_files = []
    pil_images = []
    session_timestamp = str(int(time.time()))
    for idx, img_base64 in enumerate(image_data_list):
        try:
            if ',' in img_base64:
                img_base64 = img_base64.split(',')[1]
            img_bytes = base64.b64decode(img_base64)
            img = Image.open(BytesIO(img_bytes)).convert('RGB')
            # Apply an Unsharp Mask to significantly increase photo sharpness
            img = img.filter(ImageFilter.UnsharpMask(radius=1.5, percent=100, threshold=3))
            
            # Save individual photo – timestamp ensures uniqueness within user folder
            filename = f"capture_{session_timestamp}_{idx + 1}.jpg"
            filepath = os.path.join(session_path, filename)
            img.save(filepath, 'JPEG', quality=100, subsampling=0)
            saved_files.append(f"/static/photos/{session_dir}/{filename}")
            pil_images.append(img)
        except Exception as e:
            return jsonify({'error': f"Failed to process image {idx + 1}: {str(e)}"}), 500
    # Build vertical collage
    collage_url = None
    if pil_images:
        try:
            # Dimensions for 600 DPI (doubled from 300 DPI for higher resolution)
            # 50mm x 157mm frame with a subtle footer below the last photo.
            frame_w, frame_h = FRAME_WIDTH, FRAME_HEIGHT
            # 43.3mm x 31.8mm photo
            photo_w, photo_h = 1022, 752
            # 300 DPI alternative:
            # frame_w, frame_h = 591, 1772
            # photo_w, photo_h = 511, 376
            
            # Margins
            left_margin = (frame_w - photo_w) // 2
            top_margin = left_margin
            gutter = 80
            
            frame_color_hex = data.get('frame_color', '#ffffff')
            try:
                bg_color = tuple(int(frame_color_hex.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))
            except Exception:
                bg_color = (255, 255, 255)
            
            collage = Image.new('RGB', (frame_w, frame_h), bg_color)
            current_y = top_margin
            
            for img in pil_images:
                # Crop/resize photo to exact dimensions
                scaled_img = ImageOps.fit(apply_photo_filter(img, image_filter), (photo_w, photo_h), Image.Resampling.LANCZOS)
                collage.paste(scaled_img, (left_margin, current_y))
                current_y += photo_h + gutter
            
            # Apply sticker pack if selected
            sticker_pack = data.get('sticker_pack', 'none')
            if sticker_pack and sticker_pack != 'none':
                draw_sticker_pack(collage, sticker_pack)
                
            collage_filename = f"collage_{session_timestamp}.jpg"
            collage_filepath = os.path.join(session_path, collage_filename)
            collage.save(collage_filepath, 'JPEG', quality=100, subsampling=0)
            collage_url = f"/static/photos/{session_dir}/{collage_filename}"
        except Exception as e:
            return jsonify({'error': f"Failed to build collage: {str(e)}"}), 500
    return jsonify({
        'status': 'success',
        'files': saved_files,
        'collage_url': collage_url,
        'session_timestamp': session_timestamp
    })

@app.route('/api/session/render_preview', methods=['POST'])
def render_preview():
    data = request.json or {}
    session_dir = data.get('session_dir') or session.get('session_dir')
    image_data_list = data.get('images', [])
    session_timestamp = data.get('session_timestamp')
    frame_color_hex = data.get('frame_color', '#ffffff')
    image_filter = data.get('image_filter', 'normal')
    layer_type = data.get('layer_type', 'full')
    
    if not session_dir:
        return jsonify({'error': 'Missing session_dir'}), 400
        
    if not image_data_list and not session_timestamp:
        return jsonify({'error': 'Missing images and session_timestamp'}), 400

    try:
        frame_w, frame_h = FRAME_WIDTH, FRAME_HEIGHT
        photo_w, photo_h = 1022, 752
        # 300 DPI alternative:
        # frame_w, frame_h = 591, 1772
        # photo_w, photo_h = 511, 376
        left_margin = (frame_w - photo_w) // 2
        top_margin = left_margin
        gutter = 80

        if layer_type == 'stickers_only':
            collage = Image.new('RGBA', (frame_w, frame_h), (0, 0, 0, 0))
            sticker_pack = data.get('sticker_pack', 'none')
            if sticker_pack and sticker_pack != 'none':
                draw_sticker_pack(collage, sticker_pack)
            buffer = BytesIO()
            collage.save(buffer, 'PNG')
            buffer.seek(0)
            base64_str = base64.b64encode(buffer.getvalue()).decode('utf-8')
            return jsonify({
                'status': 'success',
                'preview_data': f"data:image/png;base64,{base64_str}"
            })

        try:
            bg_color = tuple(int(frame_color_hex.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))
        except Exception:
            bg_color = (255, 255, 255)

        collage = Image.new('RGB', (frame_w, frame_h), bg_color)
        current_y = top_margin
        
        # Load from base64 list OR from local files
        pil_images = []
        if image_data_list:
            for img_base64 in image_data_list:
                if ',' in img_base64:
                    img_base64 = img_base64.split(',')[1]
                img_bytes = base64.b64decode(img_base64)
                img = Image.open(BytesIO(img_bytes)).convert('RGB')
                pil_images.append(img)
        else:
            session_path = os.path.join(PHOTOS_DIR, session_dir)
            for i in range(1, 5):
                filepath = os.path.join(session_path, f"capture_{session_timestamp}_{i}.jpg")
                if os.path.exists(filepath):
                    img = Image.open(filepath).convert('RGB')
                    pil_images.append(img)
                    
        if not pil_images:
            return jsonify({'error': 'No images found to preview'}), 400

        for img in pil_images:
            # Apply unsharp mask to match capture flow, only if loaded from disk, but let's do it for all to be consistent
            img = img.filter(ImageFilter.UnsharpMask(radius=1.5, percent=100, threshold=3))
            scaled_img = ImageOps.fit(apply_photo_filter(img, image_filter), (photo_w, photo_h), Image.Resampling.LANCZOS)
            collage.paste(scaled_img, (left_margin, current_y))
            current_y += photo_h + gutter

        # Apply sticker pack if selected
        sticker_pack = data.get('sticker_pack', 'none')
        if sticker_pack and sticker_pack != 'none':
            draw_sticker_pack(collage, sticker_pack)

        buffer = BytesIO()
        collage.save(buffer, 'JPEG', quality=85)
        buffer.seek(0)
        base64_str = base64.b64encode(buffer.getvalue()).decode('utf-8')
        return jsonify({
            'status': 'success',
            'preview_data': f"data:image/jpeg;base64,{base64_str}"
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/session/edit_existing', methods=['POST'])
def edit_existing():
    """Rebuilds the collage for an existing session with new frame color and stickers."""
    data = request.json or {}
    session_dir = data.get('session_dir')
    session_timestamp = data.get('session_timestamp')
    frame_color_hex = data.get('frame_color', '#ffffff')
    sticker_pack = data.get('sticker_pack', 'none')
    image_filter = data.get('image_filter', 'normal')
    
    if not session_dir or not session_timestamp:
        return jsonify({'error': 'Missing session_dir or session_timestamp'}), 400
        
    session_path = os.path.join(PHOTOS_DIR, session_dir)
    if not os.path.exists(session_path):
        return jsonify({'error': 'Session directory not found'}), 404
        
    try:
        frame_w, frame_h = FRAME_WIDTH, FRAME_HEIGHT
        photo_w, photo_h = 1022, 752
        # 300 DPI alternative:
        # frame_w, frame_h = 591, 1772
        # photo_w, photo_h = 511, 376
        left_margin = (frame_w - photo_w) // 2
        top_margin = left_margin
        gutter = 80
        
        try:
            bg_color = tuple(int(frame_color_hex.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))
        except Exception:
            bg_color = (255, 255, 255)
            
        collage = Image.new('RGB', (frame_w, frame_h), bg_color)
        current_y = top_margin
        # Generate a new timestamp to uniquely identify this edit
        edit_timestamp = str(int(time.time()))
        
        images_found = False
        for i in range(1, 5):
            old_filepath = os.path.join(session_path, f"capture_{session_timestamp}_{i}.jpg")
            if os.path.exists(old_filepath):
                images_found = True
                img = Image.open(old_filepath).convert('RGB')
                scaled_img = ImageOps.fit(apply_photo_filter(img, image_filter), (photo_w, photo_h), Image.Resampling.LANCZOS)
                collage.paste(scaled_img, (left_margin, current_y))
                current_y += photo_h + gutter
                
        if not images_found:
            return jsonify({'error': 'No original capture images found'}), 404
            
        if sticker_pack and sticker_pack != 'none':
            draw_sticker_pack(collage, sticker_pack)
            
        # Save as an edited collage under the same session
        collage_filename = f"collage_edited_{session_timestamp}_{edit_timestamp}.jpg"
        collage_filepath = os.path.join(session_path, collage_filename)
        collage.save(collage_filepath, 'JPEG', quality=100, subsampling=0)
        collage_url = f"/static/photos/{session_dir}/{collage_filename}"
        
        return jsonify({
            'status': 'success',
            'collage_url': collage_url
        })
    except Exception as e:
        return jsonify({'error': f"Failed to edit collage: {str(e)}"}), 500


# ---------------------------------------------------------------------------
# Admin – list all sessions
# ---------------------------------------------------------------------------
@app.route('/api/admin/sessions', methods=['GET'])
def get_sessions():
    try:
        sessions = []
        if os.path.exists(PHOTOS_DIR):
            for folder_name in sorted(os.listdir(PHOTOS_DIR)):
                folder_path = os.path.join(PHOTOS_DIR, folder_name)
                if not os.path.isdir(folder_path): continue
                customer_name = folder_name.replace('_', ' ')
                
                sessions_dict = {}
                for file_name in os.listdir(folder_path):
                    if not (file_name.endswith('.jpg') or file_name.endswith('.gif')):
                        continue
                    
                    parts = file_name.split('_')
                    if len(parts) >= 2:
                        if file_name.startswith('capture_'):
                            ts = parts[1]
                        elif file_name.startswith('collage_edited_'):
                            # collage_edited_{session_ts}.jpg  OR  collage_edited_{session_ts}_{edit_ts}.jpg
                            ts = parts[2].split('.')[0]
                        elif file_name.startswith('collage_'):
                            ts = parts[1].split('.')[0]
                        elif file_name.startswith('animation_'):
                            ts = parts[1].split('.')[0]
                        else:
                            continue
                            
                        if ts not in sessions_dict:
                            try:
                                formatted_time = time.ctime(int(ts))
                            except:
                                formatted_time = ts
                            sessions_dict[ts] = {
                                'folder': folder_name,
                                'customer_name': customer_name,
                                'timestamp': ts,
                                'time': formatted_time,
                                'files': [],
                                'collage_url': None,
                                'collage_edited_urls': [],
                                'gif_url': None
                            }
                        
                        file_path = f"/static/photos/{folder_name}/{file_name}"
                        if file_name.startswith('capture_'):
                            sessions_dict[ts]['files'].append(file_path)
                        elif file_name.startswith('collage_edited_'):
                            sessions_dict[ts]['collage_edited_urls'].append(file_path)
                        elif file_name.startswith('collage_'):
                            sessions_dict[ts]['collage_url'] = file_path
                        elif file_name.startswith('animation_'):
                            sessions_dict[ts]['gif_url'] = file_path
                
                for ts in sessions_dict:
                    sess = sessions_dict[ts]
                    sess['files'].sort()
                    sess['collage_edited_urls'].sort()
                    sessions.append(sess)
        
        sessions.sort(key=lambda x: x['timestamp'], reverse=True)
        return jsonify({'sessions': sessions})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ---------------------------------------------------------------------------
# Customer – retrieve only their own sessions
# ---------------------------------------------------------------------------
@app.route('/api/customer/gallery', methods=['GET'])
def customer_gallery():
    customer_name = session.get('customer_name')
    if not customer_name:
        return jsonify({'error': 'Not logged in'}), 401
    sessions = []
    sanitized_name = sanitize_filename(customer_name)
    folder_path = os.path.join(PHOTOS_DIR, sanitized_name)
    
    if os.path.exists(folder_path) and os.path.isdir(folder_path):
        sessions_dict = {}
        for file_name in os.listdir(folder_path):
            if not (file_name.endswith('.jpg') or file_name.endswith('.gif')):
                continue
                
            parts = file_name.split('_')
            if len(parts) >= 2:
                if file_name.startswith('capture_'):
                    ts = parts[1]
                elif file_name.startswith('collage_edited_'):
                    ts = parts[2].split('.')[0]
                elif file_name.startswith('collage_'):
                    ts = parts[1].split('.')[0]
                elif file_name.startswith('animation_'):
                    ts = parts[1].split('.')[0]
                else:
                    continue
                    
                if ts not in sessions_dict:
                    sessions_dict[ts] = {
                        'folder': sanitized_name,
                        'customer_name': customer_name,
                        'timestamp': ts,
                        'files': [],
                        'collage_url': None,
                        'collage_edited_urls': [],
                        'gif_url': None
                    }
                
                file_path = f"/static/photos/{sanitized_name}/{file_name}"
                if file_name.startswith('capture_'):
                    sessions_dict[ts]['files'].append(file_path)
                elif file_name.startswith('collage_edited_'):
                    sessions_dict[ts]['collage_edited_urls'].append(file_path)
                elif file_name.startswith('collage_'):
                    sessions_dict[ts]['collage_url'] = file_path
                elif file_name.startswith('animation_'):
                    sessions_dict[ts]['gif_url'] = file_path
        
        for ts in sorted(sessions_dict.keys(), reverse=True):
            sess = sessions_dict[ts]
            sess['files'].sort()
            sess['collage_edited_urls'].sort()
            sessions.append(sess)
            
    return jsonify({'sessions': sessions})

# ---------------------------------------------------------------------------
# Delete photo
# ---------------------------------------------------------------------------
@app.route('/api/customer/photo', methods=['DELETE'])
def delete_photo():
    customer_name = session.get('customer_name')
    if not customer_name:
        return jsonify({'error': 'Not logged in'}), 401
    
    data = request.json or {}
    file_url = data.get('file_url')
    if not file_url:
        return jsonify({'error': 'Missing file_url'}), 400
        
    sanitized_name = sanitize_filename(customer_name)
    # Ensure the user can only delete their own photos
    expected_prefix = f"/static/photos/{sanitized_name}/"
    if not file_url.startswith(expected_prefix):
        return jsonify({'error': 'Unauthorized to delete this file'}), 403
        
    filename = file_url[len(expected_prefix):]
    # Prevent directory traversal
    if '/' in filename or '\\' in filename:
        return jsonify({'error': 'Invalid filename'}), 400
        
    file_path = os.path.join(PHOTOS_DIR, sanitized_name, filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
            return jsonify({'status': 'success'})
        except Exception as e:
            return jsonify({'error': f'Failed to delete file: {str(e)}'}), 500
    else:
        return jsonify({'error': 'File not found'}), 404

# ---------------------------------------------------------------------------
# Admin edit save
# ---------------------------------------------------------------------------
@app.route('/api/admin/save_edit', methods=['POST'])
def save_edit():
    data = request.json or {}
    session_dir = data.get('session_dir')
    timestamp = data.get('timestamp')
    edited_img_base64 = data.get('image')
    if not session_dir or not edited_img_base64:
        return jsonify({'error': 'Missing session_dir or image data'}), 400
    session_path = os.path.join(PHOTOS_DIR, session_dir)
    if not os.path.exists(session_path):
        return jsonify({'error': 'Session directory not found'}), 404
    try:
        if ',' in edited_img_base64:
            edited_img_base64 = edited_img_base64.split(',')[1]
        img_bytes = base64.b64decode(edited_img_base64)
        img = Image.open(BytesIO(img_bytes)).convert('RGB')
        # Use current time as unique edit identifier to support multiple edits
        import time as time_mod
        edit_ts = str(int(time_mod.time()))
        filename = f"collage_edited_{timestamp}_{edit_ts}.jpg" if timestamp else f"collage_edited_{edit_ts}.jpg"
        filepath = os.path.join(session_path, filename)
        img.save(filepath, 'JPEG', quality=95)
        return jsonify({
            'status': 'success',
            'collage_edited_url': f"/static/photos/{session_dir}/{filename}"
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------
@app.route('/api/customer/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'status': 'logged out'})

if __name__ == '__main__':
    import sys
    use_ssl = '--ssl' in sys.argv
    ssl_ctx = 'adhoc' if use_ssl else None
    if use_ssl:
        print("Starting Flask with adhoc SSL (HTTPS) enabled.")
    app.run(host='0.0.0.0', port=5000, debug=True, ssl_context=ssl_ctx)
