import os
import boto3
from botocore.exceptions import NoCredentialsError, ClientError
from dotenv import load_dotenv
import uuid

load_dotenv()

AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")

# Initialize S3 Client
s3_client = boto3.client(
    "s3",
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION
)

async def upload_image_to_s3(file_bytes: bytes, original_filename: str) -> str:
    """
    Uploads an image byte stream to AWS S3 and returns the public URL.
    """
    if not S3_BUCKET_NAME or S3_BUCKET_NAME == "your-s3-bucket-name":
        # Return a dummy URL if AWS is not configured yet, to not block development
        return f"https://dummy-s3-bucket.s3.amazonaws.com/mock_{original_filename}"

    # Generate a unique filename to prevent collisions
    file_extension = original_filename.split(".")[-1] if "." in original_filename else "jpg"
    unique_filename = f"incidents/{uuid.uuid4().hex}.{file_extension}"

    try:
        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=unique_filename,
            Body=file_bytes,
            ContentType=f"image/{file_extension}"
        )
        
        # Construct the URL
        url = f"https://{S3_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{unique_filename}"
        return url
        
    except NoCredentialsError:
        print("AWS credentials not available.")
        return None
    except ClientError as e:
        print(f"Failed to upload to S3: {e}")
        return None
