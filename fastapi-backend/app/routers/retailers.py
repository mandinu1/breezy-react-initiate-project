from fastapi import APIRouter, HTTPException, Query, Depends 
from typing import List, Optional
import pandas as pd

from app.models import Retailer
from app.dependencies import get_posm_df, get_boards_df # Assuming retailers can be derived from posm or board data

router = APIRouter()

@router.get("/retailers", response_model=List[Retailer])
async def fetch_retailers_api(
    province: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    dsDivision: Optional[str] = Query(None), # Note: Your CSVs don't have DS_DIVISION for retailer master consistently
    retailerId: Optional[str] = Query(None),
    # salesRegion and salesDistrict are aliases often used for province and district
    salesRegion: Optional[str] = Query(None, alias="salesRegion"),
    salesDistrict: Optional[str] = Query(None, alias="salesDistrict"),
    board_df: pd.DataFrame = Depends(get_boards_df) # Or combine board and posm data for a full retailer list
):
    # Consolidate province/salesRegion and district/salesDistrict
    effective_province = province or salesRegion
    effective_district = district or salesDistrict

    # In a real scenario, you might have a dedicated retailer master table.
    # Here, we derive it from board data, which has PROFILE_ID, PROFILE_NAME, LATITUDE, LONGITUDE, etc.
    if board_df.empty:
        return []

    # Select relevant columns and drop duplicates to get unique retailers
    retailer_cols = ['PROFILE_ID', 'PROFILE_NAME', 'LATITUDE', 'LONGITUDE', 'PROVINCE', 'DISTRICT', 'S3_ARN'] # Using S3_ARN as imageIdentifier proxy
    
    # Ensure columns exist before trying to use them
    existing_cols = [col for col in retailer_cols if col in board_df.columns]
    if 'PROFILE_ID' not in existing_cols or 'PROFILE_NAME' not in existing_cols:
        raise HTTPException(status_code=500, detail="Retailer identifier columns missing in data")

    retailers_df = board_df[existing_cols].copy()
    retailers_df.dropna(subset=['PROFILE_ID', 'LATITUDE', 'LONGITUDE'], inplace=True)
    retailers_df.drop_duplicates(subset=['PROFILE_ID'], inplace=True)

    # Apply filters
    if effective_province and effective_province != 'all' and 'PROVINCE' in retailers_df.columns:
        retailers_df = retailers_df[retailers_df['PROVINCE'].str.lower() == effective_province.lower()]
    
    if effective_district and effective_district != 'all' and 'DISTRICT' in retailers_df.columns:
        retailers_df = retailers_df[retailers_df['DISTRICT'].str.lower() == effective_district.lower()]
        
    # DS Division filter - Mocked as DS_DIVISION might not be in board.csv directly for retailers
    # if dsDivision and dsDivision != 'all' and 'DS_DIVISION' in retailers_df.columns:
    #     retailers_df = retailers_df[retailers_df['DS_DIVISION'].str.lower() == dsDivision.lower()]

    if retailerId and retailerId != 'all':
        retailers_df = retailers_df[retailers_df['PROFILE_ID'].astype(str) == retailerId]

    output_retailers = []
    for _, row in retailers_df.iterrows():
        # Handle potential NaN values for optional string fields
        province_val = row.get('PROVINCE')
        district_val = row.get('DISTRICT')
        s3_arn_val = row.get('S3_ARN')

        output_retailers.append(Retailer(
            id=str(row['PROFILE_ID']),
            name=str(row.get('PROFILE_NAME', 'N/A')),
            latitude=float(row['LATITUDE']),
            longitude=float(row['LONGITUDE']),
            imageIdentifier=None if pd.isna(s3_arn_val) else str(s3_arn_val),
            province=None if pd.isna(province_val) else str(province_val),
            district=None if pd.isna(district_val) else str(district_val)
        ))
    return output_retailers