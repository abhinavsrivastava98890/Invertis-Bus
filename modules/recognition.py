"""
Face Recognition Module - Using InsightFace (MobileFaceNet)
Handles face encoding generation and face matching.
"""

import os
import numpy as np
import math
from typing import Tuple, Optional, List
import insightface
from insightface.app import FaceAnalysis

# Global singleton for InsightFace app
_INSIGHTFACE_APP = None

def _get_insightface_app():
    """Load InsightFace app (lazy load)."""
    global _INSIGHTFACE_APP
    if _INSIGHTFACE_APP is None:
        try:
            # Initialize MobileFaceNet model (buffalo_s is lightweight and perfectly optimized for Raspberry Pi 4)
            # It will download automatically if not found in root
            _INSIGHTFACE_APP = FaceAnalysis(name='buffalo_s', root='models', providers=['CPUExecutionProvider'])
            _INSIGHTFACE_APP.prepare(ctx_id=0, det_size=(640, 640))
        except Exception as e:
            print(f"Error initializing InsightFace: {e}")
    return _INSIGHTFACE_APP


class FaceRecognizer:
    """
    Face recognition using InsightFace (MobileFaceNet).
    Generates 512-dimensional face encodings for comparison.
    """

    def __init__(
        self,
        model: str = "hog",  # Kept for compatibility, not used in InsightFace
        num_jitters: int = 1 # Kept for compatibility, InsightFace doesn't use jitters natively
    ):
        """
        Initialize face recognizer.
        """
        self.app = _get_insightface_app()

    def get_face_encoding(self, face_image: np.ndarray) -> Optional[np.ndarray]:
        """
        Generate face encoding from a face image using InsightFace.
        If face_image is already an embedding (from new detector), return it.
        """
        try:
            # If face_image is already a 1D embedding array
            if face_image is not None and face_image.ndim == 1:
                return face_image
                
            if self.app is None:
                return None

            # InsightFace expects BGR format, which is the default from OpenCV
            faces = self.app.get(face_image)
            
            if faces:
                # Return the embedding of the largest face detected
                largest_face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
                # Normalize embedding for better cosine similarity matching
                embedding = largest_face.embedding
                norm = np.linalg.norm(embedding)
                if norm > 0:
                    embedding = embedding / norm
                return embedding
                
            return None

        except Exception as e:
            print(f"Error generating encoding: {e}")
            return None

    def get_eye_aspect_ratio(self, face_image: np.ndarray) -> Optional[float]:
        """
        Calculate the Eye Aspect Ratio (EAR) for blink detection.
        Since we switched to InsightFace, the landmarks are different.
        buffalo_s RetinaFace provides 5 landmarks (eyes, nose, mouth).
        We cannot reliably do EAR blink detection with only 5 points.
        Returning None disables blink detection temporarily.
        """
        return None

    def compare_faces(
        self,
        encoding: np.ndarray,
        stored_encodings: List[np.ndarray],
        tolerance: float = 0.40 # Adjusted for Cosine Distance
    ) -> List[bool]:
        """
        Compare a face encoding against multiple stored encodings using Cosine Distance.
        """
        distances = self.face_distance(encoding, stored_encodings)
        return [dist <= tolerance for dist in distances]

    def face_distance(
        self,
        encoding: np.ndarray,
        stored_encodings: List[np.ndarray]
    ) -> np.ndarray:
        """
        Calculate Cosine distances between encoding and stored encodings.
        Cosine Distance = 1.0 - Cosine Similarity
        (lower = more similar)
        """
        distances = []
        for stored in stored_encodings:
            # Since embeddings are L2 normalized, dot product is cosine similarity
            sim = np.dot(encoding, stored)
            # Clip between -1.0 and 1.0 to avoid precision issues
            sim = max(min(sim, 1.0), -1.0)
            # Cosine distance
            dist = 1.0 - sim
            distances.append(dist)
            
        return np.array(distances)

    def find_best_match(
        self,
        encoding: np.ndarray,
        stored_encodings: List[Tuple[np.ndarray, str]],
        tolerance: float = 0.40 # Adjusted for Cosine Distance
    ) -> Tuple[Optional[str], float]:
        """
        Find best matching stored face.
        """
        if not stored_encodings:
            return None, 1.0

        # Extract just encodings for comparison
        encodings_only = [enc[0] for enc in stored_encodings]

        # Calculate distances
        distances = self.face_distance(encoding, encodings_only)

        # Find minimum distance
        min_distance_idx = np.argmin(distances)
        min_distance = distances[min_distance_idx]

        # Check if within tolerance
        if min_distance <= tolerance:
            student_id = stored_encodings[min_distance_idx][1]
            return student_id, min_distance

        return None, min_distance

    def get_encoding_from_file(self, image_path: str) -> Optional[np.ndarray]:
        """
        Load image from file and get encoding.
        """
        import cv2
        try:
            image = cv2.imread(image_path)
            if image is None:
                return None
            return self.get_face_encoding(image)
        except Exception as e:
            print(f"Error loading image: {e}")
            return None

    def batch_encode_faces(
        self,
        face_images: List[np.ndarray]
    ) -> List[Optional[np.ndarray]]:
        """
        Generate encodings for multiple face images.
        """
        encodings = []
        for face_image in face_images:
            encoding = self.get_face_encoding(face_image)
            encodings.append(encoding)
        return encodings


def encode_embedding(embedding: np.ndarray) -> str:
    """
    Encode numpy array to string for database storage.
    """
    return ",".join(map(str, embedding))


def decode_embedding(embedding_str: str) -> np.ndarray:
    """
    Decode string back to numpy array.
    """
    return np.array([float(x) for x in embedding_str.split(",")])

