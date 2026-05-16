import os
import boto3
from dotenv import load_dotenv
from botocore.exceptions import ClientError

load_dotenv()

AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")

print("Key length:", len(AWS_ACCESS_KEY_ID) if AWS_ACCESS_KEY_ID else 0)

s3_client = boto3.client(
    "s3",
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION
)

try:
    s3_client.put_object(
        Bucket=S3_BUCKET_NAME,
        Key="test.txt",
        Body=b"hello",
        ContentType="text/plain"
    )
    print("S3 Upload SUCCESS!")
except Exception as e:
    print("S3 Upload FAILED:", e)
