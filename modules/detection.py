"""
Face Detection Module - Using InsightFace (MobileFaceNet)
Handles face detection from webcam frames and returns bounding boxes and embeddings.
"""

import cv2
import numpy as np
from typing import List, Tuple, Optional
from modules.recognition import _get_insightface_app

class FaceDetector:
    """
    Face detection using InsightFace RetinaFace.
    This replaces MediaPipe to perfectly integrate with MobileFaceNet.
    """

    def __init__(self, min_detection_confidence: float = 0.5):
        """
        Initialize InsightFace detection.
        """
        self.app = _get_insightface_app()
        self.min_confidence = min_detection_confidence

    def detect_faces(
        self, 
        frame: np.ndarray
    ) -> Tuple[List[dict], np.ndarray]:
        """
        Detect faces in a frame.

        Args:
            frame: Input frame (BGR format from OpenCV)

        Returns:
            Tuple of (detections list, RGB frame)
            Each detection contains: 'bbox', 'confidence', 'face' (which is the embedding)
        """
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        detections = []

        if self.app is not None:
            faces = self.app.get(frame)
            
            for face in faces:
                if face.det_score >= self.min_confidence:
                    bbox = face.bbox.astype(int)
                    
                    # Extract bounding box to create face_crop for UI
                    x_min = max(0, bbox[0])
                    y_min = max(0, bbox[1])
                    x_max = min(frame.shape[1], bbox[2])
                    y_max = min(frame.shape[0], bbox[3])
                    
                    if x_max > x_min and y_max > y_min:
                        face_crop = frame[y_min:y_max, x_min:x_max].copy()
                    else:
                        face_crop = np.zeros((10, 10, 3), dtype=np.uint8)
                    
                    # Normalize the embedding for Cosine Similarity
                    embedding = face.embedding
                    norm = np.linalg.norm(embedding)
                    if norm > 0:
                        embedding = embedding / norm
                        
                    detection_dict = {
                        'bbox': (bbox[0], bbox[1], bbox[2], bbox[3]),
                        'confidence': face.det_score,
                        'face': face_crop,          # Keep crop for UI
                        'embedding': embedding,     # Add embedding for logic
                        'center': ((bbox[0] + bbox[2]) // 2, (bbox[1] + bbox[3]) // 2)
                    }
                    detections.append(detection_dict)

        return detections, rgb_frame

    def draw_detections(
        self, 
        frame: np.ndarray, 
        detections: List[dict],
        thickness: int = 2,
        color: Tuple[int, int, int] = (0, 255, 0)
    ) -> np.ndarray:
        """
        Draw bounding boxes on frame.
        """
        annotated_frame = frame.copy()

        for detection in detections:
            x_min, y_min, x_max, y_max = detection['bbox']
            cv2.rectangle(
                annotated_frame,
                (x_min, y_min),
                (x_max, y_max),
                color,
                thickness
            )

        return annotated_frame

    def release(self):
        """Cleanup resources."""
        pass

    def __del__(self):
        pass


def resize_frame(frame: np.ndarray, max_width: int = 800) -> np.ndarray:
    """
    Resize frame for faster processing while maintaining aspect ratio.
    """
    height, width = frame.shape[:2]

    if width > max_width:
        scale = max_width / width
        new_height = int(height * scale)
        resized = cv2.resize(frame, (max_width, new_height))
        return resized

    return frame
