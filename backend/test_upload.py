import requests
import json
import os

# Create a small dummy image for testing
dummy_image_path = "test_image.jpg"
with open(dummy_image_path, "wb") as f:
    f.write(b"dummy image content")

url = "http://127.0.0.1:8000/api/incidents/upload"

metadata = {
    "person_type": "Unknown",
    "location": "Bus 101 Front Camera",
    "notes": "Testing the new AWS and MongoDB upload system"
}

print("Sending request to backend...")

try:
    with open(dummy_image_path, "rb") as image_file:
        files = {"image": (dummy_image_path, image_file, "image/jpeg")}
        data = {"metadata": json.dumps(metadata)}
        
        response = requests.post(url, files=files, data=data)
        
        print("\n--- Response from Server ---")
        print(f"Status Code: {response.status_code}")
        try:
            print("Response JSON:")
            print(json.dumps(response.json(), indent=2))
        except ValueError:
            print(response.text)
            
except Exception as e:
    print(f"An error occurred: {e}")
finally:
    # Clean up the dummy image
    if os.path.exists(dummy_image_path):
        os.remove(dummy_image_path)
