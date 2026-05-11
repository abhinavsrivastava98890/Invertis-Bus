#!/usr/bin/env python3
"""
Bus Management - Face Recognition Attendance System
Main entry point for the application.

A complete, local face-recognition attendance system for Linux desktop.
Uses MediaPipe for face detection and face_recognition for embeddings.
Everything runs offline - no cloud APIs or external services.

Usage:
    python3 main.py              # Start GUI
    python3 main.py --register   # Registration mode
    python3 main.py --recognize  # Recognition mode
    python3 main.py --cli        # CLI mode
"""

import sys
import argparse
from modules.utils import create_directories, log_message
from modules.database import AttendanceDatabase


def main_gui():
    """Start the Tkinter GUI."""
    try:
        from ui.main_ui import AttendanceSystemGUI
        import tkinter as tk

        root = tk.Tk()
        app = AttendanceSystemGUI(root)
        root.mainloop()

    except ImportError as e:
        print(f"Error importing GUI components: {e}")
        print("Make sure all dependencies are installed: pip install -r requirements.txt")
        sys.exit(1)

    except Exception as e:
        log_message(f"GUI Error: {e}")
        print(f"Error: {e}")
        sys.exit(1)


def main_registration():
    """Start registration in CLI mode."""
    try:
        from modules.registration import LiveRegistration
        from modules.database import AttendanceDatabase

        db = AttendanceDatabase(db_path="data/attendance.db")
        registration = LiveRegistration(num_captures=5)

        print("\n" + "="*50)
        print("LIVE FACE REGISTRATION (CLI MODE)")
        print("="*50 + "\n")

        success = registration.register_student_interactive(db)

        if success:
            print("✓ Registration completed successfully!")
        else:
            print("✗ Registration failed")

        db.close()
        registration.release()

    except Exception as e:
        log_message(f"Registration Error: {e}")
        print(f"Error: {e}")
        sys.exit(1)


def main_recognition():
    """Start recognition in CLI mode."""
    try:
        from modules.attendance import RealtimeAttendance
        from modules.database import AttendanceDatabase

        db = AttendanceDatabase(db_path="data/attendance.db")
        attendance = RealtimeAttendance(confidence_threshold=0.45)

        print("\n" + "="*50)
        print("REAL-TIME FACE RECOGNITION (CLI MODE)")
        print("="*50 + "\n")

        attendance.start_recognition(db, camera_id=0, timeout_seconds=600)

        db.close()
        attendance.release()

    except Exception as e:
        log_message(f"Recognition Error: {e}")
        print(f"Error: {e}")
        sys.exit(1)


def main_cli():
    """Start interactive CLI menu."""
    from modules.database import AttendanceDatabase
    from modules.utils import format_attendance_report

    db = AttendanceDatabase(db_path="data/attendance.db")

    while True:
        print("\n" + "="*50)
        print("FACE RECOGNITION ATTENDANCE SYSTEM - CLI")
        print("="*50)
        print("\n1. Register Student")
        print("2. Start Recognition")
        print("3. View Attendance")
        print("4. View Today's Attendance")
        print("5. View Student")
        print("6. Update Fee Status")
        print("7. System Statistics")
        print("8. Delete Student")
        print("9. Exit")
        print("\n" + "-"*50)

        choice = input("Enter choice (1-9): ").strip()

        if choice == '1':
            from modules.registration import LiveRegistration
            registration = LiveRegistration(num_captures=5)
            success = registration.register_student_interactive(db)
            registration.release()

        elif choice == '2':
            from modules.attendance import RealtimeAttendance
            threshold = input("Enter confidence threshold (default 0.45): ").strip()
            try:
                threshold = float(threshold) if threshold else 0.45
            except ValueError:
                threshold = 0.45
            attendance = RealtimeAttendance(confidence_threshold=threshold)
            attendance.start_recognition(db, camera_id=0, timeout_seconds=600)
            attendance.release()

        elif choice == '3':
            records = db.get_attendance_records(limit=50)
            print(format_attendance_report(records))

        elif choice == '4':
            records = db.get_today_attendance()
            print(format_attendance_report(records))

        elif choice == '5':
            student_id = input("Enter student ID: ").strip()
            student = db.get_student(student_id)
            if student:
                print(f"\nStudent Information:")
                print(f"  Name: {student['name']}")
                print(f"  ID: {student['student_id']}")
                print(f"  Fee Status: {student['fee_status']}")
                print(f"  Registered: {student['registration_date']}")
            else:
                print("Student not found")

        elif choice == '6':
            student_id = input("Enter student ID: ").strip()
            fee_status = input("Enter fee status (paid/unpaid): ").strip().lower()
            if fee_status in ['paid', 'unpaid']:
                if db.update_fee_status(student_id, fee_status):
                    print(f"✓ Fee status updated to {fee_status}")
                else:
                    print("✗ Failed to update fee status")
            else:
                print("Invalid fee status")

        elif choice == '7':
            stats = db.get_statistics()
            print(f"\nSystem Statistics:")
            print(f"  Total Students: {stats.get('total_students', 0)}")
            print(f"  Total Embeddings: {stats.get('total_embeddings', 0)}")
            print(f"  Total Attendance Records: {stats.get('total_attendance', 0)}")
            print(f"  Today's Attendance: {stats.get('today_attendance', 0)}")

        elif choice == '8':
            student_id = input("Enter student ID to delete: ").strip()
            confirm = input(f"Are you sure you want to delete student {student_id} and all their face data? (y/n): ").strip().lower()
            if confirm == 'y':
                if db.delete_student(student_id):
                    print(f"✓ Student {student_id} face data and records removed")
                else:
                    print("✗ Failed to remove student")
            else:
                print("Deletion cancelled")

        elif choice == '9':
            print("Exiting...")
            break

        else:
            print("Invalid choice")

    db.close()


def main():
    """Main entry point with CLI argument parsing."""
    parser = argparse.ArgumentParser(
        description="Face Recognition Attendance System",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 main.py              # Start GUI (default)
  python3 main.py --gui        # Start GUI
  python3 main.py --register   # CLI registration mode
  python3 main.py --recognize  # CLI recognition mode
  python3 main.py --cli        # Interactive CLI menu
  python3 main.py --setup      # Initialize system
        """
    )

    parser.add_argument(
        '--gui',
        action='store_true',
        help='Start GUI (default if no args)'
    )
    parser.add_argument(
        '--register',
        action='store_true',
        help='Start registration mode (CLI)'
    )
    parser.add_argument(
        '--recognize',
        action='store_true',
        help='Start recognition mode (CLI)'
    )
    parser.add_argument(
        '--cli',
        action='store_true',
        help='Interactive CLI menu'
    )
    parser.add_argument(
        '--setup',
        action='store_true',
        help='Initialize system and database'
    )
    parser.add_argument(
        '--version',
        action='version',
        version='%(prog)s 1.0.0'
    )

    args = parser.parse_args()

    # Create required directories
    create_directories()

    # Log startup
    log_message("Application started")

    # Handle arguments
    if args.setup:
        print("Setting up system...")
        db = AttendanceDatabase(db_path="data/attendance.db")
        stats = db.get_statistics()
        print(f"✓ Database initialized")
        print(f"✓ Tables created")
        print(f"✓ Directories created")
        db.close()

    elif args.register:
        main_registration()

    elif args.recognize:
        main_recognition()

    elif args.cli:
        main_cli()

    elif args.gui or len(sys.argv) == 1:
        # Default to GUI if no arguments provided
        main_gui()

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
