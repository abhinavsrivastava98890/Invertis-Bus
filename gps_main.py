import time
import math
import sqlite3
import serial
import pynmea2
from smbus2 import SMBus
import os

# ==================== CONFIGURATION ====================
DB_PATH = "data/gps_server.db"
SERIAL_PORT = "/dev/serial0"  # Default hardware serial port on Raspberry Pi
BAUD_RATE = 9600

# I2C Addresses
MPU6050_ADDR = 0x68
HMC5883L_ADDR = 0x1E

# ==================== I2C HELPERS ====================

def read_i2c_word(bus, addr, reg):
    """Read a 16-bit word from an I2C device and handle 2's complement."""
    high = bus.read_byte_data(addr, reg)
    low = bus.read_byte_data(addr, reg+1)
    value = (high << 8) + low
    if value >= 0x8000:
        return -((65535 - value) + 1)
    return value

# ==================== SENSOR INITIALIZATION ====================

def init_mpu6050(bus):
    """Wake up the MPU6050."""
    try:
        # Write 0 to power management register to wake up
        bus.write_byte_data(MPU6050_ADDR, 0x6B, 0x00)
        print("MPU6050 Initialized.")
        return True
    except Exception as e:
        print(f"Failed to initialize MPU6050: {e}")
        return False

def init_hmc5883l(bus):
    """Initialize the HMC5883L Magnetometer."""
    try:
        # Write to Configuration Register A (8-average, 15 Hz default, normal measurement)
        bus.write_byte_data(HMC5883L_ADDR, 0x00, 0x70)
        # Write to Configuration Register B (Gain)
        bus.write_byte_data(HMC5883L_ADDR, 0x01, 0xA0)
        # Write to Mode Register (Continuous measurement mode)
        bus.write_byte_data(HMC5883L_ADDR, 0x02, 0x00)
        print("HMC5883L Initialized.")
        return True
    except Exception as e:
        print(f"Failed to initialize HMC5883L: {e}")
        return False

# ==================== DATABASE SETUP ====================

def init_database():
    """Create the SQLite database and tables."""
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sensor_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            latitude REAL,
            longitude REAL,
            gps_speed_knots REAL,
            accel_x REAL,
            accel_y REAL,
            accel_z REAL,
            heading_deg REAL
        )
    """)
    conn.commit()
    print(f"Database initialized at {DB_PATH}")
    return conn

# ==================== MAIN LOOP ====================

def main():
    print("Starting Sensor Tracking System...")
    
    # 1. Initialize DB
    conn = init_database()
    cursor = conn.cursor()

    # 2. Initialize I2C Bus (Usually bus 1 on Raspberry Pi)
    try:
        bus = SMBus(1)
        mpu_ready = init_mpu6050(bus)
        hmc_ready = init_hmc5883l(bus)
    except Exception as e:
        print(f"Critical I2C Bus Error: {e}. Check your wiring!")
        bus = None
        mpu_ready = False
        hmc_ready = False

    # 3. Initialize UART (GPS)
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        print(f"Listening for GPS on {SERIAL_PORT}...")
    except Exception as e:
        print(f"Failed to open Serial Port {SERIAL_PORT}: {e}")
        ser = None

    print("\n--- ENTERING MAIN LOOP ---")
    print("Press Ctrl+C to exit.\n")
    
    try:
        while True:
            # Variables for this polling cycle
            lat = None
            lon = None
            gps_speed = None
            accel_x = None
            accel_y = None
            accel_z = None
            heading = None

            # --- READ GPS ---
            if ser and ser.in_waiting > 0:
                try:
                    line = ser.readline().decode('ascii', errors='replace')
                    if line.startswith('$GPRMC') or line.startswith('$GPGGA'):
                        msg = pynmea2.parse(line)
                        if hasattr(msg, 'latitude') and msg.latitude != 0.0:
                            lat = msg.latitude
                            lon = msg.longitude
                        if hasattr(msg, 'spd_over_grnd'):
                            gps_speed = msg.spd_over_grnd
                except Exception as e:
                    # Ignore parsing errors from corrupted serial lines
                    pass

            # --- READ MPU6050 ---
            if mpu_ready:
                try:
                    # Raw accelerometer values
                    accel_x = read_i2c_word(bus, MPU6050_ADDR, 0x3B) / 16384.0 # Scale to Gs
                    accel_y = read_i2c_word(bus, MPU6050_ADDR, 0x3D) / 16384.0
                    accel_z = read_i2c_word(bus, MPU6050_ADDR, 0x3F) / 16384.0
                except Exception as e:
                    print(f"MPU6050 Read Error: {e}")

            # --- READ HMC5883L ---
            if hmc_ready:
                try:
                    # Raw magnetic values
                    x = read_i2c_word(bus, HMC5883L_ADDR, 0x03)
                    z = read_i2c_word(bus, HMC5883L_ADDR, 0x05)
                    y = read_i2c_word(bus, HMC5883L_ADDR, 0x07)
                    
                    # Calculate Heading in degrees
                    heading_rad = math.atan2(y, x)
                    heading = math.degrees(heading_rad)
                    if heading < 0:
                        heading += 360
                except Exception as e:
                    print(f"HMC5883L Read Error: {e}")

            # --- SAVE TO DATABASE ---
            cursor.execute("""
                INSERT INTO sensor_data 
                (latitude, longitude, gps_speed_knots, accel_x, accel_y, accel_z, heading_deg)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (lat, lon, gps_speed, accel_x, accel_y, accel_z, heading))
            conn.commit()

            # Print output for debugging
            print(f"Lat: {lat or 'N/A'}, Lon: {lon or 'N/A'} | "
                  f"Accel X: {accel_x or 0:.2f}g | "
                  f"Heading: {heading or 0:.0f}°")

            # Sleep to prevent spamming the database
            time.sleep(1)

    except KeyboardInterrupt:
        print("\nExiting nicely...")
    finally:
        if ser:
            ser.close()
        if bus:
            bus.close()
        conn.close()

if __name__ == "__main__":
    main()
