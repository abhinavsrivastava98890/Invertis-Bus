"""
Real-time Attendance Module
Handles live face recognition and attendance logging.
"""

import cv2
import numpy as np
from typing import Dict, Optional, Tuple
import time
from modules.detection import FaceDetector, resize_frame
from modules.recognition import FaceRecognizer, decode_embedding


class RealtimeAttendance:
    """
    Real-time face recognition and attendance logging.
    Recognizes faces from webcam and logs attendance.
    """

    def __init__(
        self,
        confidence_threshold: float = 0.45,
        duplicate_window_minutes: int = 5
    ):
        """
        Initialize real-time recognition system.

        Args:
            confidence_threshold: Distance threshold for face matching (lower = stricter)
            duplicate_window_minutes: Time window to avoid duplicate attendance
        """
        self.confidence_threshold = confidence_threshold
        self.duplicate_window_minutes = duplicate_window_minutes

        self.detector = FaceDetector(min_detection_confidence=0.7)
        self.recognizer = FaceRecognizer(model="hog", num_jitters=2)

        # Cache for face encodings (to avoid repeated queries)
        self.cached_embeddings = {}
        self.cache_timestamp = 0
        self.cache_ttl = 60  # Cache valid for 60 seconds
        
        # State tracking for liveness (blink detection)
        self.liveness_state = {}

    def update_embeddings_cache(self, database) -> int:
        """
        Load all embeddings from database into memory.

        Args:
            database: Database instance

        Returns:
            Number of embeddings loaded
        """
        embeddings_data = database.get_all_embeddings()

        self.cached_embeddings = {}
        for student_id, embedding_str in embeddings_data:
            if student_id not in self.cached_embeddings:
                self.cached_embeddings[student_id] = []

            try:
                embedding = decode_embedding(embedding_str)
                self.cached_embeddings[student_id].append(embedding)
            except Exception as e:
                print(f"Error decoding embedding for {student_id}: {e}")

        self.cache_timestamp = time.time()
        return len(embeddings_data)

    def recognize_face(
        self,
        face_image: np.ndarray,
        database
    ) -> Tuple[Optional[Dict], float]:
        """
        Recognize a face and return student information.

        Args:
            face_image: Cropped face image
            database: Database instance

        Returns:
            Tuple of (student_info dict, confidence) or (None, distance)
        """
        # Generate encoding for detected face
        face_encoding = self.recognizer.get_face_encoding(face_image)

        if face_encoding is None:
            return None, 1.0

        # Find best match from cached embeddings
        best_match = None
        best_distance = 1.0

        for student_id, embeddings in self.cached_embeddings.items():
            if not embeddings:
                continue

            # Compare against all embeddings for student
            for stored_encoding in embeddings:
                distance = np.linalg.norm(face_encoding - stored_encoding)

                if distance < best_distance:
                    best_distance = distance
                    best_match = student_id

        # Check if within threshold
        if best_match and best_distance <= self.confidence_threshold:
            student_info = database.get_student(best_match)
            confidence = 1.0 - (best_distance / self.confidence_threshold)  # 0-1 scale
            return student_info, confidence

        return None, best_distance

    def start_recognition(
        self,
        database,
        camera_id: int = 0,
        timeout_seconds: float = 300.0
    ):
        """
        Start real-time face recognition from webcam.

        Args:
            database: Database instance
            camera_id: Webcam index
            timeout_seconds: Session timeout (default 5 minutes)
        """
        cap = cv2.VideoCapture(camera_id)

        if not cap.isOpened():
            print("Error: Cannot open webcam")
            return

        # Load embeddings into cache
        num_embeddings = self.update_embeddings_cache(database)
        print(f"Loaded {num_embeddings} embeddings for recognition")

        # Track recognized faces in current session
        recognized_faces = {}  # {student_id: last_recognition_time}
        session_start = time.time()

        print("\nStarting real-time face recognition...")
        print(f"Confidence threshold: {self.confidence_threshold}")
        print("Press 'q' to exit\n")

        try:
            frame_count = 0
            fps_start = time.time()
            fps = 0

            while True:
                ret, frame = cap.read()

                if not ret:
                    print("Error reading frame")
                    break

                frame_count += 1

                # Calculate FPS every 30 frames
                if frame_count % 30 == 0:
                    fps_end = time.time()
                    fps = 30 / (fps_end - fps_start)
                    fps_start = fps_end

                # Resize for faster processing, but preserve enough detail for accuracy
                frame = resize_frame(frame, max_width=800)
                display_frame = frame.copy()

                # Detect faces
                detections, _ = self.detector.detect_faces(frame)

                if detections:
                    # Process each detected face
                    for detection in detections:
                        x_min, y_min, x_max, y_max = detection['bbox']
                        face_image = detection['face']

                        # Recognize face
                        student_info, confidence = self.recognize_face(face_image, database)

                        if student_info:
                            # Student recognized
                            student_id = student_info['student_id']
                            name = student_info['name']
                            fee_status = student_info['fee_status']

                            # Determine color based on fee status
                            if fee_status == 'paid':
                                color = (0, 255, 0)  # Green
                                status_text = "✓ PAID - ACCESS GRANTED"
                                text_color = (0, 255, 0)
                            else:
                                color = (0, 0, 255)  # Red
                                status_text = "✗ UNPAID - FEES PENDING"
                                text_color = (0, 0, 255)

                            # Draw bounding box
                            cv2.rectangle(display_frame, (x_min, y_min), (x_max, y_max), color, 3)

                            # Draw name and status
                            cv2.putText(
                                display_frame,
                                f"{name}",
                                (x_min, y_min - 40),
                                cv2.FONT_HERSHEY_SIMPLEX,
                                0.8,
                                color,
                                2
                            )

                            cv2.putText(
                                display_frame,
                                f"ID: {student_id}",
                                (x_min, y_min - 10),
                                cv2.FONT_HERSHEY_SIMPLEX,
                                0.6,
                                color,
                                1
                            )

                            cv2.putText(
                                display_frame,
                                f"Confidence: {confidence:.2f}",
                                (x_min, y_max + 25),
                                cv2.FONT_HERSHEY_SIMPLEX,
                                0.6,
                                color,
                                1
                            )

                            cv2.putText(
                                display_frame,
                                status_text,
                                (x_min, y_max + 50),
                                cv2.FONT_HERSHEY_SIMPLEX,
                                0.7,
                                text_color,
                                2
                            )

                            # Handle Liveness Detection
                            current_time = time.time()
                            if student_id not in self.liveness_state:
                                self.liveness_state[student_id] = {
                                    'blinked': False, 
                                    'eyes_closed_frames': 0,
                                    'last_seen': current_time
                                }
                            
                            # Reset liveness if the person has been out of frame for more than 4 seconds
                            if current_time - self.liveness_state[student_id].get('last_seen', current_time) > 4.0:
                                self.liveness_state[student_id]['blinked'] = False
                                self.liveness_state[student_id]['eyes_closed_frames'] = 0
                                
                            self.liveness_state[student_id]['last_seen'] = current_time
                                
                            is_live = self.liveness_state[student_id]['blinked']
                            
                            if not is_live:
                                # Not yet verified as live, check for blink
                                ear = self.recognizer.get_eye_aspect_ratio(face_image)
                                if ear is not None:
                                    if ear < 0.19:  # Strict threshold for fully closed eyes to prevent false positives
                                        self.liveness_state[student_id]['eyes_closed_frames'] += 1
                                    elif ear >= 0.19 and self.liveness_state[student_id]['eyes_closed_frames'] >= 1:
                                        self.liveness_state[student_id]['blinked'] = True
                                        is_live = True
                                        
                            if not is_live:
                                # Prompt user to blink
                                cv2.putText(
                                    display_frame,
                                    "Please blink to verify...",
                                    (x_min, y_max + 75),
                                    cv2.FONT_HERSHEY_SIMPLEX,
                                    0.7,
                                    (0, 165, 255),  # Orange
                                    2
                                )
                            else:
                                # Log attendance if not recently logged and verified live
                                if student_id not in recognized_faces or \
                                   (current_time - recognized_faces[student_id]) > (self.duplicate_window_minutes * 60):

                                    # Check database for recent attendance
                                    if not database.check_duplicate_attendance(student_id, self.duplicate_window_minutes):
                                        database.log_attendance(
                                            student_id=student_id,
                                            name=name,
                                            fee_status=fee_status,
                                            confidence=confidence,
                                            device_id="webcam"
                                        )
                                        recognized_faces[student_id] = current_time
                                        print(f"✓ Attendance logged: {name} ({student_id}) - {fee_status.upper()} (LIVE)")

                        else:
                            # Face not recognized
                            color = (255, 0, 0)  # Blue - unknown
                            cv2.rectangle(display_frame, (x_min, y_min), (x_max, y_max), color, 2)
                            cv2.putText(
                                display_frame,
                                "UNKNOWN FACE",
                                (x_min, y_min - 10),
                                cv2.FONT_HERSHEY_SIMPLEX,
                                0.6,
                                color,
                                1
                            )

                # Display statistics
                cv2.putText(
                    display_frame,
                    f"FPS: {fps:.1f}",
                    (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 255, 0),
                    2
                )

                cv2.putText(
                    display_frame,
                    f"Faces Detected: {len(detections)}",
                    (10, 60),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 255, 0),
                    2
                )

                elapsed_time = int(time.time() - session_start)
                cv2.putText(
                    display_frame,
                    f"Time: {elapsed_time}s",
                    (10, 90),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 255, 0),
                    2
                )

                # Display frame
                cv2.imshow("Face Recognition - Attendance System", display_frame)

                # Check for exit
                key = cv2.waitKey(1) & 0xFF
                if key == ord('q'):
                    print("Exiting recognition mode...")
                    break

                # Check timeout
                if time.time() - session_start > timeout_seconds:
                    print("Session timeout reached")
                    break

        except Exception as e:
            print(f"Error during recognition: {e}")

        finally:
            cap.release()
            cv2.destroyAllWindows()

            # Print session summary
            print("\n" + "="*50)
            print("SESSION SUMMARY")
            print("="*50)
            print(f"Total faces recognized: {len(recognized_faces)}")
            print(f"Session duration: {int(time.time() - session_start)} seconds")
            print("="*50 + "\n")

    def release(self):
        """Release resources."""
        self.detector.release()

    def __del__(self):
        """Destructor."""
        self.release()
