"""
Registration Module
Handles live face registration workflow through webcam.
"""

import cv2
import numpy as np
from typing import List, Tuple
import time
from modules.detection import FaceDetector, resize_frame
from modules.recognition import FaceRecognizer, encode_embedding


class LiveRegistration:
    """
    Live face registration workflow.
    Captures multiple face frames from webcam and stores embeddings.
    """

    def __init__(
        self,
        num_captures: int = 100,
        capture_interval: float = 0.2,
        min_face_area: int = 15000
    ):
        """
        Initialize registration system.

        Args:
            num_captures: Number of face frames to capture (default 100)
            capture_interval: Time between captures in seconds
            min_face_area: Minimum face area in pixels (to ensure quality)
        """
        self.num_captures = num_captures
        self.capture_interval = capture_interval
        self.min_face_area = min_face_area

        self.detector = FaceDetector(min_detection_confidence=0.7)
        self.recognizer = FaceRecognizer()
        
        # Cache for embeddings during capture phase
        self.captured_embeddings: List[np.ndarray] = []

    def capture_faces(
        self,
        camera_id: int = 0,
        timeout: float = 600.0
    ) -> Tuple[List[np.ndarray], bool]:
        """
        Capture multiple face frames from webcam.

        Args:
            camera_id: Webcam camera index (default 0)
            timeout: Maximum time to wait for captures (seconds)

        Returns:
            Tuple of (face_images list, success boolean)
        """
        cap = cv2.VideoCapture(camera_id)

        if not cap.isOpened():
            print("Error: Cannot open webcam")
            return [], False

        captured_faces = []
        self.captured_embeddings = []
        start_time = time.time()
        last_capture_time = 0

        print(f"Capturing {self.num_captures} face frames...")
        print("Move your face around for better angle coverage")

        try:
            while len(captured_faces) < self.num_captures:
                ret, frame = cap.read()

                if not ret:
                    print("Error reading frame")
                    break

                # Resize for faster processing, but preserve enough detail for accuracy
                frame = resize_frame(frame, max_width=800)

                # Detect faces
                detections, _ = self.detector.detect_faces(frame)

                # Display instructions
                display_frame = frame.copy()
                status_text = f"Captured: {len(captured_faces)}/{self.num_captures}"
                cv2.putText(
                    display_frame,
                    status_text,
                    (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1.0,
                    (0, 255, 0),
                    2
                )

                if detections:
                    # Draw detected faces
                    for detection in detections:
                        x_min, y_min, x_max, y_max = detection['bbox']
                        face_area = (x_max - x_min) * (y_max - y_min)

                        # Check if face area is sufficient
                        if face_area < self.min_face_area:
                            color = (0, 0, 255)  # Red - too small
                            text = "Face too small"
                        else:
                            color = (0, 255, 0)  # Green - good

                        cv2.rectangle(display_frame, (x_min, y_min), (x_max, y_max), color, 2)

                    # Capture largest face at interval
                    current_time = time.time()
                    if current_time - last_capture_time >= self.capture_interval:
                        # Get largest face
                        largest_detection = max(
                            detections,
                            key=lambda d: (d['bbox'][2] - d['bbox'][0]) * (d['bbox'][3] - d['bbox'][1])
                        )

                        face_area = ((largest_detection['bbox'][2] - largest_detection['bbox'][0]) *
                                    (largest_detection['bbox'][3] - largest_detection['bbox'][1]))

                        if face_area >= self.min_face_area:
                            captured_faces.append(largest_detection['face'].copy())
                            if 'embedding' in largest_detection:
                                self.captured_embeddings.append(largest_detection['embedding'])
                            last_capture_time = current_time
                            print(f"  - Captured frame {len(captured_faces)}/{self.num_captures}")

                else:
                    text = "No face detected"
                    cv2.putText(
                        display_frame,
                        text,
                        (10, 60),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.8,
                        (0, 0, 255),
                        2
                    )

                # Display frame
                cv2.imshow("Face Registration - Capturing Faces", display_frame)

                # Check timeout
                if time.time() - start_time > timeout:
                    print("Timeout: Could not capture all faces")
                    break

                # Press 'q' to cancel, 's' to skip/accelerate
                key = cv2.waitKey(1) & 0xFF
                if key == ord('q'):
                    print("Registration cancelled by user")
                    captured_faces = []
                    break
                elif key == ord('s'):
                    # Reduce interval for faster capture
                    self.capture_interval = max(0.1, self.capture_interval - 0.1)

        except Exception as e:
            print(f"Error during capture: {e}")
            captured_faces = []

        finally:
            cap.release()
            cv2.destroyAllWindows()

        success = len(captured_faces) == self.num_captures
        return captured_faces, success

    def generate_encodings(self, face_images: List[np.ndarray]) -> List[Tuple[np.ndarray, float]]:
        """
        Generate encodings using internally cached embeddings from the capture phase.
        We ignore the passed face_images to avoid re-running detection on tight crops.

        Args:
            face_images: List of captured faces (kept for signature compatibility)

        Returns:
            List of (encoding, quality_score) tuples
        """
        print(f"Generating {len(self.captured_embeddings)} face encodings...")
        
        encodings = []
        for i, embedding in enumerate(self.captured_embeddings):
            # The embedding is already a normalized 512D array from InsightFace
            # We can set a default quality score of 1.0 since InsightFace already filtered it
            encodings.append((embedding, 1.0))
            print(f"  - Encoding {i+1}/{len(self.captured_embeddings)}: Generated")

        return encodings

    def average_encoding(self, encodings: List[np.ndarray]) -> np.ndarray:
        """
        Average multiple face encodings for more robust matching.
        The resulting vector must be L2 normalized for Cosine Similarity.

        Args:
            encodings: List of face encodings

        Returns:
            Normalized averaged encoding
        """
        if len(encodings) == 0:
            raise ValueError("No encodings provided")

        avg = np.mean(encodings, axis=0)
        norm = np.linalg.norm(avg)
        if norm > 0:
            avg = avg / norm
        return avg

    def select_best_encodings(
        self,
        encoding_scores: List[Tuple[np.ndarray, float]],
        num_select: int = None
    ) -> List[np.ndarray]:
        """
        Select best quality encodings.

        Args:
            encoding_scores: List of (encoding, quality_score) tuples
            num_select: Number to select (default all)

        Returns:
            List of selected encodings
        """
        if num_select is None:
            num_select = len(encoding_scores)

        # Sort by quality score (descending)
        sorted_scores = sorted(encoding_scores, key=lambda x: x[1], reverse=True)

        # Select top encodings
        selected = [enc for enc, _ in sorted_scores[:num_select]]

        return selected

    def register_student_interactive(
        self,
        database,
        camera_id: int = 0
    ) -> bool:
        """
        Interactive student registration workflow.

        Args:
            database: Database instance
            camera_id: Webcam index

        Returns:
            True if registration successful
        """
        print("\n" + "="*50)
        print("STUDENT REGISTRATION")
        print("="*50)

        # Get student information
        try:
            name = input("Enter student name: ").strip()
            if not name:
                print("Name cannot be empty")
                return False

            student_id = input("Enter student ID: ").strip()
            if not student_id:
                print("Student ID cannot be empty")
                return False

            fee_status = input("Enter fee status (paid/unpaid) [default: unpaid]: ").strip().lower()
            if fee_status not in ['paid', 'unpaid']:
                fee_status = 'unpaid'

            phone = input("Enter phone (optional): ").strip()
            email = input("Enter email (optional): ").strip()

        except KeyboardInterrupt:
            print("\nRegistration cancelled")
            return False

        # Capture faces
        face_images, capture_success = self.capture_faces(camera_id=camera_id)

        if not capture_success:
            print(f"Failed to capture {self.num_captures} face images")
            return False

        # Generate encodings
        encoding_scores = self.generate_encodings(face_images)

        if len(encoding_scores) == 0:
            print("Failed to generate encodings from captured faces")
            return False

        # Select best encodings
        best_encodings = self.select_best_encodings(encoding_scores, num_select=max(1, len(encoding_scores)))

        # Average them for more robust matching
        avg_encoding = self.average_encoding(best_encodings)

        # Register in database
        db_success = database.register_student(
            student_id=student_id,
            name=name,
            fee_status=fee_status,
            phone=phone,
            email=email
        )

        if not db_success:
            print("Failed to register student in database")
            return False

        # Store encodings
        num_stored = 0
        for encoding, quality in encoding_scores:
            embedding_str = encode_embedding(encoding)
            if database.store_embedding(student_id, embedding_str, quality):
                num_stored += 1

        # Store averaged encoding with higher priority
        avg_embedding_str = encode_embedding(avg_encoding)
        database.store_embedding(student_id, avg_embedding_str, 1.0)  # Quality 1.0 for average

        print("\n" + "="*50)
        print("REGISTRATION SUCCESSFUL!")
        print("="*50)
        print(f"Name: {name}")
        print(f"Student ID: {student_id}")
        print(f"Fee Status: {fee_status}")
        print(f"Encodings stored: {num_stored + 1}")
        print("="*50 + "\n")

        return True

    def release(self):
        """Release resources."""
        self.detector.release()

    def __del__(self):
        """Destructor."""
        self.release()
