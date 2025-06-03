from .config import settings
# import boto3 # Uncomment for real S3
# from botocore.exceptions import ClientError # Uncomment for real S3

def generate_presigned_url(s3_arn: str, expiration: int = 3600) -> Optional[str]:
    """
    Generate a presigned URL for an S3 object.
    Mocked for now. Replace with actual Boto3 logic.
    """
    if not s3_arn or not isinstance(s3_arn, str) or "arn:aws:s3:::" not in s3_arn:
        # If ARN is invalid or placeholder, return a generic placeholder
        object_key_part = s3_arn.split('/')[-1] if s3_arn else "placeholder_image"
        return f"https://picsum.photos/seed/{object_key_part}/400/300"

    try:
        # --- Real Boto3 Logic (Example) ---
        # s3_client = boto3.client(
        #     's3',
        #     aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        #     aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        #     region_name=settings.AWS_REGION
        # )
        # arn_parts = s3_arn.split(":::")
        # bucket_name_key = arn_parts[1]
        # bucket_name = bucket_name_key.split('/')[0]
        # object_key = '/'.join(bucket_name_key.split('/')[1:])

        # response = s3_client.generate_presigned_url(
        #     'get_object',
        #     Params={'Bucket': bucket_name, 'Key': object_key},
        #     ExpiresIn=expiration
        # )
        # return response
        # --- End Real Boto3 Logic ---
        
        # Mock implementation:
        # Extract a unique part from ARN for picsum seed
        unique_part = s3_arn.split('/')[-1] if '/' in s3_arn else "image"
        return f"https://picsum.photos/seed/{unique_part.replace('.jpeg','').replace('.png','')}/400/300"

    except Exception as e:
        print(f"Error generating presigned URL for {s3_arn}: {e}")
        # Fallback for any error during S3 interaction, or if it's not a valid S3 ARN
        object_key_part = s3_arn.split('/')[-1] if s3_arn else "error_image"
        return f"https://picsum.photos/seed/{object_key_part}/400/300"