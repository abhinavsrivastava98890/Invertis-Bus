import sys
import json
import face_recognition

def generate_encoding(image_path):
    try:
        # Load the image
        image = face_recognition.load_image_file(image_path)
        
        # Get encodings
        encodings = face_recognition.face_encodings(image)
        
        if len(encodings) > 0:
            # We found at least one face
            encoding = encodings[0]
            # Convert to comma-separated string exactly like modules/recognition.py
            encoding_str = ",".join(map(str, encoding))
            print(json.dumps({"success": True, "encoding": encoding_str}))
        else:
            print(json.dumps({"success": False, "error": "No face detected in the image."}))
            
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Image path not provided."}))
        sys.exit(1)
        
    image_path = sys.argv[1]
    generate_encoding(image_path)
