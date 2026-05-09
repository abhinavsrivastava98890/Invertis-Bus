"""
Face Detection Module - Using MediaPipe
Handles face detection from webcam frames and returns bounding boxes.
"""

import cv2
import mediapipe as mp
import numpy as np
from typing import List, Tuple, Optional


class FaceDetector:
    """
    Face detection using MediaPipe.
    MediaPipe is more efficient and accurate than Haar Cascade.
    """

    def __init__(self, min_detection_confidence: float = 0.5):
        """
        Initialize MediaPipe face detection.

        Args:
            min_detection_confidence: Minimum confidence threshold (0.0 to 1.0)
        """
        self.mp_face_detection = mp.solutions.face_detection
        self.detector = self.mp_face_detection.FaceDetection(
            model_selection=0,  # 0 = short-range (close faces), 1 = full-range
            min_detection_confidence=min_detection_confidence
        )
        self.mp_drawing = mp.solutions.drawing_utils

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
            Each detection contains: 'bbox', 'confidence', 'face'
        """
        # Convert BGR to RGB for MediaPipe
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.detector.process(rgb_frame)

        detections = []
        frame_height, frame_width, _ = frame.shape

        if results.detections:
            for detection in results.detections:
                confidence = detection.location_data.relative_bounding_box
                
                # Extract bounding box coordinates
                x_min = int(confidence.xmin * frame_width)
                y_min = int(confidence.ymin * frame_height)
                width = int(confidence.width * frame_width)
                height = int(confidence.height * frame_height)

                # Add padding to ensure full face capture
                padding = 10
                x_min = max(0, x_min - padding)
                y_min = max(0, y_min - padding)
                x_max = min(frame_width, x_min + width + padding)
                y_max = min(frame_height, y_min + height + padding)

                # Crop face region
                face_crop = frame[y_min:y_max, x_min:x_max].copy()

                # Skip if face region is too small
                if face_crop.shape[0] < 50 or face_crop.shape[1] < 50:
                    continue

                detection_dict = {
                    'bbox': (x_min, y_min, x_max, y_max),
                    'confidence': detection.detections[0].score[0] if hasattr(detection, 'detections') else 0.0,
                    'face': face_crop,
                    'center': ((x_min + x_max) // 2, (y_min + y_max) // 2)
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

        Args:
            frame: Input frame
            detections: List of detection dictionaries
            thickness: Line thickness
            color: RGB color (B, G, R)

        Returns:
            Frame with drawn detections
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
        """Release MediaPipe resources."""
        if self.detector:
            self.detector.close()

    def __del__(self):
        """Destructor to ensure resources are released."""
        self.release()


def resize_frame(frame: np.ndarray, max_width: int = 640) -> np.ndarray:
    """
    Resize frame for faster processing while maintaining aspect ratio.

    Args:
        frame: Input frame
        max_width: Maximum width (default 640 for real-time performance)

    Returns:
        Resized frame
    """
    height, width = frame.shape[:2]

    if width > max_width:
        scale = max_width / width
        new_height = int(height * scale)
        resized = cv2.resize(frame, (max_width, new_height))
        return resized

    return frame
