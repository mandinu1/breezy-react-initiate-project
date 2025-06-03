from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.models import ImageInfo
from app.s3_utils import generate_presigned_url

router = APIRouter()

@router.get("/image-info/{image_identifier}", response_model=ImageInfo)
async def fetch_image_info_api(image_identifier: str):
    """
    Frontend's api.ts directly uses picsum. This endpoint can be a proxy 
    or modified if imageIdentifier is actually an S3 ARN or an ID that maps to one.
    Assuming image_identifier could be a simple seed for picsum as in api.ts,
    OR it could be an S3 ARN.
    """
    if "arn:aws:s3:::" in image_identifier: # If it looks like an S3 ARN
        url = generate_presigned_url(image_identifier)
        if not url:
            raise HTTPException(status_code=404, detail="Could not generate URL for S3 ARN")
        return ImageInfo(id=image_identifier, url=url, type="s3_presigned")
    else: # Treat as a seed for picsum, matching frontend
        url = f"https://picsum.photos/seed/{image_identifier}/400/300"
        return ImageInfo(id=image_identifier, url=url, type="original_mock")

# Endpoint to specifically get S3 presigned URLs if ARNs are passed
@router.get("/image-s3-url", response_model=ImageInfo)
async def get_s3_image_url(s3_arn: str = Query(...)):
    url = generate_presigned_url(s3_arn)
    if not url:
        raise HTTPException(status_code=404, detail="Image not found or URL generation failed.")
    return ImageInfo(id=s3_arn, url=url, type="s3_presigned")