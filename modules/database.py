"""
Database Module - SQLite Operations
Handles all database operations for students, embeddings, and attendance.
"""

import sqlite3
import os
from datetime import datetime
from typing import List, Tuple, Optional, Dict
import json


class AttendanceDatabase:
    """
    SQLite database management for attendance system.
    Tables: students, embeddings, attendance
    """

    def __init__(self, db_path: str = "data/attendance.db"):
        """
        Initialize database connection.

        Args:
            db_path: Path to SQLite database file
        """
        self.db_path = db_path

        # Create data directory if it doesn't exist
        os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)

        self.conn = None
        self.cursor = None
        self.connect()
        self.create_tables()

    def connect(self):
        """Establish database connection."""
        try:
            self.conn = sqlite3.connect(self.db_path)
            self.conn.row_factory = sqlite3.Row  # Enable column access by name
            self.cursor = self.conn.cursor()
            print(f"Database connected: {self.db_path}")
        except sqlite3.Error as e:
            print(f"Database connection error: {e}")
            raise

    def create_tables(self):
        """Create required tables if they don't exist."""
        try:
            # Students table
            self.cursor.execute("""
                CREATE TABLE IF NOT EXISTS students (
                    student_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    fee_status TEXT DEFAULT 'unpaid',
                    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    phone TEXT,
                    email TEXT
                )
            """)

            # Embeddings table (can have multiple embeddings per student)
            self.cursor.execute("""
                CREATE TABLE IF NOT EXISTS embeddings (
                    embedding_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    student_id TEXT NOT NULL,
                    embedding TEXT NOT NULL,
                    capture_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    quality_score REAL DEFAULT 0.0,
                    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
                )
            """)

            # Attendance table
            self.cursor.execute("""
                CREATE TABLE IF NOT EXISTS attendance (
                    attendance_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    student_id TEXT NOT NULL,
                    name TEXT,
                    check_in_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    fee_status TEXT,
                    confidence REAL DEFAULT 0.0,
                    device_id TEXT DEFAULT 'desktop',
                    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
                )
            """)

            # Sync Queue table for cloud upload
            self.cursor.execute("""
                CREATE TABLE IF NOT EXISTS sync_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    image_path TEXT NOT NULL,
                    person_type TEXT NOT NULL,
                    metadata TEXT,
                    status TEXT DEFAULT 'PENDING',
                    retry_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Create indexes for faster queries
            self.cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_attendance_student 
                ON attendance(student_id)
            """)
            self.cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_attendance_date 
                ON attendance(check_in_time)
            """)
            self.cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_embeddings_student 
                ON embeddings(student_id)
            """)
            self.cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_sync_status 
                ON sync_queue(status)
            """)

            self.conn.commit()
            print("Database tables created/verified")

        except sqlite3.Error as e:
            print(f"Error creating tables: {e}")
            raise

    # ==================== STUDENT OPERATIONS ====================

    def register_student(
        self,
        student_id: str,
        name: str,
        fee_status: str = "unpaid",
        phone: str = "",
        email: str = ""
    ) -> bool:
        """
        Register a new student.

        Args:
            student_id: Unique student identifier
            name: Student name
            fee_status: 'paid' or 'unpaid'
            phone: Optional phone number
            email: Optional email

        Returns:
            True if successful, False otherwise
        """
        try:
            self.cursor.execute("""
                INSERT OR REPLACE INTO students 
                (student_id, name, fee_status, phone, email)
                VALUES (?, ?, ?, ?, ?)
            """, (student_id, name, fee_status, phone, email))

            self.conn.commit()
            print(f"Student registered: {name} ({student_id})")
            return True

        except sqlite3.Error as e:
            print(f"Error registering student: {e}")
            return False

    def get_student(self, student_id: str) -> Optional[Dict]:
        """
        Retrieve student details.

        Args:
            student_id: Student ID

        Returns:
            Student dictionary or None
        """
        try:
            self.cursor.execute(
                "SELECT * FROM students WHERE student_id = ?",
                (student_id,)
            )
            row = self.cursor.fetchone()
            return dict(row) if row else None

        except sqlite3.Error as e:
            print(f"Error retrieving student: {e}")
            return None

    def update_fee_status(self, student_id: str, fee_status: str) -> bool:
        """
        Update student fee status.

        Args:
            student_id: Student ID
            fee_status: 'paid' or 'unpaid'

        Returns:
            True if successful
        """
        try:
            self.cursor.execute(
                "UPDATE students SET fee_status = ? WHERE student_id = ?",
                (fee_status, student_id)
            )
            self.conn.commit()
            return True

        except sqlite3.Error as e:
            print(f"Error updating fee status: {e}")
            return False

    def update_student_details(
        self,
        student_id: str,
        name: str,
        fee_status: str,
        phone: str,
        email: str
    ) -> bool:
        """
        Update all editable student details.

        Args:
            student_id: Student ID
            name: New name
            fee_status: 'paid' or 'unpaid'
            phone: New phone number
            email: New email

        Returns:
            True if successful
        """
        try:
            self.cursor.execute(
                """
                UPDATE students 
                SET name = ?, fee_status = ?, phone = ?, email = ?
                WHERE student_id = ?
                """,
                (name, fee_status, phone, email, student_id)
            )
            self.conn.commit()
            return self.cursor.rowcount > 0

        except sqlite3.Error as e:
            print(f"Error updating student details: {e}")
            return False

    def get_all_students(self) -> List[Dict]:
        """
        Retrieve all registered students.

        Returns:
            List of student dictionaries
        """
        try:
            self.cursor.execute("SELECT * FROM students")
            rows = self.cursor.fetchall()
            return [dict(row) for row in rows]

        except sqlite3.Error as e:
            print(f"Error retrieving students: {e}")
            return []

    def delete_student(self, student_id: str) -> bool:
        """
        Delete a student and all their associated data (embeddings, attendance).

        Args:
            student_id: Student ID

        Returns:
            True if successful
        """
        try:
            # First delete from attendance and embeddings explicitly
            # in case foreign key cascades are disabled in sqlite
            self.cursor.execute("DELETE FROM attendance WHERE student_id = ?", (student_id,))
            self.cursor.execute("DELETE FROM embeddings WHERE student_id = ?", (student_id,))
            
            # Delete the student
            self.cursor.execute("DELETE FROM students WHERE student_id = ?", (student_id,))
            
            # Check if a student was actually deleted
            if self.cursor.rowcount > 0:
                self.conn.commit()
                print(f"Student {student_id} and associated data deleted.")
                return True
            else:
                print(f"Student {student_id} not found.")
                return False

        except sqlite3.Error as e:
            print(f"Error deleting student: {e}")
            return False

    # ==================== EMBEDDING OPERATIONS ====================

    def store_embedding(
        self,
        student_id: str,
        embedding_str: str,
        quality_score: float = 0.0
    ) -> bool:
        """
        Store face embedding for a student.

        Args:
            student_id: Student ID
            embedding_str: Encoded embedding string
            quality_score: Quality metric (0-1)

        Returns:
            True if successful
        """
        try:
            self.cursor.execute("""
                INSERT INTO embeddings 
                (student_id, embedding, quality_score)
                VALUES (?, ?, ?)
            """, (student_id, embedding_str, quality_score))

            self.conn.commit()
            return True

        except sqlite3.Error as e:
            print(f"Error storing embedding: {e}")
            return False

    def get_embeddings(self, student_id: str) -> List[str]:
        """
        Retrieve all embeddings for a student.

        Args:
            student_id: Student ID

        Returns:
            List of embedding strings
        """
        try:
            self.cursor.execute(
                "SELECT embedding FROM embeddings WHERE student_id = ? ORDER BY quality_score DESC",
                (student_id,)
            )
            rows = self.cursor.fetchall()
            return [row[0] for row in rows]

        except sqlite3.Error as e:
            print(f"Error retrieving embeddings: {e}")
            return []

    def get_all_embeddings(self) -> List[Tuple[str, str]]:
        """
        Retrieve all stored embeddings with student IDs.

        Returns:
            List of (student_id, embedding_str) tuples
        """
        try:
            self.cursor.execute("""
                SELECT student_id, embedding FROM embeddings
                ORDER BY student_id, quality_score DESC
            """)
            rows = self.cursor.fetchall()
            return [(row[0], row[1]) for row in rows]

        except sqlite3.Error as e:
            print(f"Error retrieving embeddings: {e}")
            return []

    # ==================== ATTENDANCE OPERATIONS ====================

    def log_attendance(
        self,
        student_id: str,
        name: str,
        fee_status: str,
        confidence: float = 0.0,
        device_id: str = "desktop"
    ) -> bool:
        """
        Log attendance record.

        Args:
            student_id: Student ID
            name: Student name
            fee_status: Fee status
            confidence: Match confidence (0-1)
            device_id: Device identifier

        Returns:
            True if successful
        """
        try:
            self.cursor.execute("""
                INSERT INTO attendance 
                (student_id, name, fee_status, confidence, device_id)
                VALUES (?, ?, ?, ?, ?)
            """, (student_id, name, fee_status, confidence, device_id))

            self.conn.commit()
            return True

        except sqlite3.Error as e:
            print(f"Error logging attendance: {e}")
            return False

    def check_duplicate_attendance(
        self,
        student_id: str,
        time_window_minutes: int = 5
    ) -> bool:
        """
        Check if student has already checked in recently.

        Args:
            student_id: Student ID
            time_window_minutes: Time window to check (default 5 minutes)

        Returns:
            True if already checked in, False otherwise
        """
        try:
            self.cursor.execute("""
                SELECT attendance_id FROM attendance
                WHERE student_id = ?
                AND datetime(check_in_time) > datetime('now', ?)
                ORDER BY check_in_time DESC
                LIMIT 1
            """, (student_id, f"-{time_window_minutes} minutes"))

            result = self.cursor.fetchone()
            return result is not None

        except sqlite3.Error as e:
            print(f"Error checking duplicate: {e}")
            return False

    def get_attendance_records(
        self,
        student_id: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict]:
        """
        Retrieve attendance records with optional filters.

        Args:
            student_id: Optional student ID filter
            date_from: Optional start date (YYYY-MM-DD)
            date_to: Optional end date (YYYY-MM-DD)
            limit: Maximum records to return

        Returns:
            List of attendance records
        """
        try:
            query = "SELECT * FROM attendance WHERE 1=1"
            params = []

            if student_id:
                query += " AND student_id = ?"
                params.append(student_id)

            if date_from:
                query += " AND DATE(check_in_time) >= ?"
                params.append(date_from)

            if date_to:
                query += " AND DATE(check_in_time) <= ?"
                params.append(date_to)

            query += " ORDER BY check_in_time DESC LIMIT ?"
            params.append(limit)

            self.cursor.execute(query, params)
            rows = self.cursor.fetchall()
            return [dict(row) for row in rows]

        except sqlite3.Error as e:
            print(f"Error retrieving attendance: {e}")
            return []

    def get_today_attendance(self) -> List[Dict]:
        """
        Get attendance records for today.

        Returns:
            List of attendance records
        """
        try:
            self.cursor.execute("""
                SELECT student_id, name, fee_status, COUNT(*) as count, 
                       MIN(check_in_time) as check_in_time,
                       MAX(check_in_time) as last_check_in
                FROM attendance
                WHERE DATE(check_in_time) = DATE('now')
                GROUP BY student_id
                ORDER BY check_in_time DESC
            """)
            rows = self.cursor.fetchall()
            return [dict(row) for row in rows]

        except sqlite3.Error as e:
            print(f"Error retrieving today's attendance: {e}")
            return []

    def get_statistics(self) -> Dict:
        """
        Get database statistics.

        Returns:
            Dictionary with stats
        """
        try:
            stats = {}

            self.cursor.execute("SELECT COUNT(*) FROM students")
            stats['total_students'] = self.cursor.fetchone()[0]

            self.cursor.execute("SELECT COUNT(*) FROM embeddings")
            stats['total_embeddings'] = self.cursor.fetchone()[0]

            self.cursor.execute("SELECT COUNT(*) FROM attendance")
            stats['total_attendance'] = self.cursor.fetchone()[0]

            self.cursor.execute("""
                SELECT COUNT(*) FROM attendance 
                WHERE DATE(check_in_time) = DATE('now')
            """)
            stats['today_attendance'] = self.cursor.fetchone()[0]

            return stats

        except sqlite3.Error as e:
            print(f"Error retrieving statistics: {e}")
            return {}

    # ==================== SYNC QUEUE OPERATIONS ====================

    def add_to_sync_queue(self, image_path: str, person_type: str, metadata: dict) -> bool:
        """Add a new incident to the sync queue."""
        try:
            self.cursor.execute("""
                INSERT INTO sync_queue (image_path, person_type, metadata)
                VALUES (?, ?, ?)
            """, (image_path, person_type, json.dumps(metadata)))
            self.conn.commit()
            return True
        except sqlite3.Error as e:
            print(f"Error adding to sync queue: {e}")
            return False

    def get_pending_syncs(self, limit: int = 10) -> List[Dict]:
        """Get pending items from the sync queue."""
        try:
            self.cursor.execute("""
                SELECT * FROM sync_queue 
                WHERE status = 'PENDING' 
                ORDER BY created_at ASC LIMIT ?
            """, (limit,))
            return [dict(row) for row in self.cursor.fetchall()]
        except sqlite3.Error as e:
            print(f"Error getting pending syncs: {e}")
            return []

    def mark_sync_completed(self, queue_id: int) -> bool:
        """Mark a queue item as SYNCED."""
        try:
            self.cursor.execute("""
                UPDATE sync_queue SET status = 'SYNCED' WHERE id = ?
            """, (queue_id,))
            self.conn.commit()
            return True
        except sqlite3.Error as e:
            print(f"Error marking sync completed: {e}")
            return False

    def increment_sync_retry(self, queue_id: int) -> bool:
        """Increment retry count for a failed sync."""
        try:
            self.cursor.execute("""
                UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?
            """, (queue_id,))
            self.conn.commit()
            return True
        except sqlite3.Error as e:
            print(f"Error incrementing retry count: {e}")
            return False

    # ==================== UTILITY OPERATIONS ====================

    def export_attendance_csv(self, output_path: str = "attendance_export.csv") -> bool:
        """
        Export attendance records to CSV.

        Args:
            output_path: Path to save CSV file

        Returns:
            True if successful
        """
        try:
            import csv
            from datetime import datetime

            records = self.get_attendance_records(limit=10000)

            with open(output_path, 'w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=['student_id', 'name', 'check_in_time', 'fee_status', 'confidence'])
                writer.writeheader()
                writer.writerows(records)

            print(f"Attendance exported to {output_path}")
            return True

        except Exception as e:
            print(f"Error exporting attendance: {e}")
            return False

    def close(self):
        """Close database connection."""
        if self.conn:
            self.conn.close()
            print("Database connection closed")

    def __del__(self):
        """Destructor to ensure connection is closed."""
        self.close()
