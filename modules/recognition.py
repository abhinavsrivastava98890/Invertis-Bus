"""
Face Recognition Module - Using face_recognition (dlib ResNet)
Handles face encoding generation and face matching.
"""

import face_recognition
import numpy as np
from typing import Tuple, Optional, List


class FaceRecognizer:
    """
    Face recognition using face_recognition library with dlib ResNet embeddings.
    Generates 128-dimensional face encodings for comparison.
    """

    def __init__(
        self,
        model: str = "hog",
        num_jitters: int = 1
    ):
        """
        Initialize face recognizer.

        Args:
            model: Model to use - 'hog' (faster, CPU) or 'cnn' (slower, GPU)
            num_jitters: Number of times to re-sample (1 = fast, higher = accurate)
        """
        self.model = model
        self.num_jitters = num_jitters

    def get_face_encoding(self, face_image: np.ndarray) -> Optional[np.ndarray]:
        """
        Generate face encoding from a face image.

        Args:
            face_image: Cropped face image (BGR format)

        Returns:
            128-dimensional encoding or None if no face detected
        """
        try:
            # Convert BGR to RGB
            rgb_image = face_recognition.load_image_file(face_image[:, :, ::-1])

            # Get face encodings
            encodings = face_recognition.face_encodings(
                rgb_image,
                model=self.model,
                num_jitters=self.num_jitters
            )

            if len(encodings) > 0:
                return encodings[0]  # Return first/largest face encoding
            return None

        except Exception as e:
            print(f"Error generating encoding: {e}")
            return None

    def compare_faces(
        self,
        encoding: np.ndarray,
        stored_encodings: List[np.ndarray],
        tolerance: float = 0.6
    ) -> List[bool]:
        """
        Compare a face encoding against multiple stored encodings.

        Args:
            encoding: Test face encoding
            stored_encodings: List of stored face encodings
            tolerance: How much distance to tolerate (0.6 = default)

        Returns:
            List of boolean matches
        """
        return face_recognition.compare_faces(
            stored_encodings,
            encoding,
            tolerance=tolerance
        )

    def face_distance(
        self,
        encoding: np.ndarray,
        stored_encodings: List[np.ndarray]
    ) -> np.ndarray:
        """
        Calculate Euclidean distances between encoding and stored encodings.

        Args:
            encoding: Test face encoding
            stored_encodings: List of stored face encodings

        Returns:
            Array of distances (lower = more similar)
        """
        return face_recognition.face_distance(stored_encodings, encoding)

    def find_best_match(
        self,
        encoding: np.ndarray,
        stored_encodings: List[Tuple[np.ndarray, str]],
        tolerance: float = 0.6
    ) -> Tuple[Optional[str], float]:
        """
        Find best matching stored face.

        Args:
            encoding: Test face encoding
            stored_encodings: List of (encoding, student_id) tuples
            tolerance: Distance tolerance

        Returns:
            Tuple of (student_id, distance) or (None, 1.0) if no match
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

        Args:
            image_path: Path to image file

        Returns:
            Face encoding or None
        """
        try:
            image = face_recognition.load_image_file(image_path)
            encodings = face_recognition.face_encodings(image, model=self.model)

            if len(encodings) > 0:
                return encodings[0]
            return None

        except Exception as e:
            print(f"Error loading image: {e}")
            return None

    def batch_encode_faces(
        self,
        face_images: List[np.ndarray]
    ) -> List[Optional[np.ndarray]]:
        """
        Generate encodings for multiple face images.

        Args:
            face_images: List of face images

        Returns:
            List of encodings (None for failed encodings)
        """
        encodings = []
        for face_image in face_images:
            encoding = self.get_face_encoding(face_image)
            encodings.append(encoding)
        return encodings


def encode_embedding(embedding: np.ndarray) -> str:
    """
    Encode numpy array to string for database storage.

    Args:
        embedding: NumPy array (128-dimensional)

    Returns:
        Comma-separated string
    """
    return ",".join(map(str, embedding))


def decode_embedding(embedding_str: str) -> np.ndarray:
    """
    Decode string back to numpy array.

    Args:
        embedding_str: Comma-separated string

    Returns:
        NumPy array
    """
    return np.array([float(x) for x in embedding_str.split(",")])
