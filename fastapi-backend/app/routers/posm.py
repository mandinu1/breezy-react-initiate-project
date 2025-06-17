
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any, Tuple
import pandas as pd
import random
import numpy as np
from app.models import (
    FetchPosmGeneralResponse, PosmGeneralFiltersState, PosmData, ProviderMetric,
    PosmComparisonData, PosmBatchDetails, PosmBatchShare, FilterOption, Retailer
)

from app.dependencies import get_posm_df, get_boards_df
from app.data_loader import filter_by_max_capture_phase

from .options import get_provider_name_from_value_options

router = APIRouter()


PROVIDERS_CONFIG_API_POSM_ROUTER = [
    {"value": "all", "label": "All Providers", "name": "All", "key": "all"},
    {"value": "dialog", "label": "Dialog", "name": "Dialog", "key": "dialog"},
    {"value": "mobitel", "label": "Mobitel", "name": "Mobitel", "key": "mobitel"},
    {"value": "airtel", "label": "Airtel", "name": "Airtel", "key": "airtel"},
    {"value": "hutch", "label": "Hutch", "name": "Hutch", "key": "hutch"},
]

PROVIDER_NAMES_FOR_COMPARISON = [p["name"] for p in PROVIDERS_CONFIG_API_POSM_ROUTER if p["name"] != "All"]




def get_provider_name_map_posm_router():
    """Creates a quick lookup map from a provider's value (e.g., "dialog") to its name ("Dialog")."""
    return {p["value"]: p["name"] for p in PROVIDERS_CONFIG_API_POSM_ROUTER}

def to_numeric_or_default(value, default=0.0):
    """Safely tries to convert a value to a number, returning a default if it fails."""
    num = pd.to_numeric(value, errors='coerce') # 'coerce' turns failures into Not-a-Number (NaN)
    return default if pd.isna(num) else num

def safe_str_convert_posm_router(value) -> Optional[str]:
    """Safely converts a value to a string, returning None if the value is missing."""
    if pd.isna(value) or value is None:
        return None
    return str(value)

# --- API Endpoints ---

@router.get("/posm/general", response_model=FetchPosmGeneralResponse)
async def fetch_posm_general_api(
   
    filters: PosmGeneralFiltersState = Depends(),
    
    posm_df_raw: pd.DataFrame = Depends(get_posm_df)
):
    """
    This is the main endpoint for the POSM dashboard. It fetches and filters all POSM data
    based on the user's selections on the frontend.
    """

    if posm_df_raw.empty:
        return FetchPosmGeneralResponse(data=[], count=0, providerMetrics=[])

    # Get only the data from the latest "capture phase" (the most recent set of photos).
    df = filter_by_max_capture_phase(posm_df_raw, "posm_data_for_api")
    if df.empty:
       return FetchPosmGeneralResponse(data=[], count=0, providerMetrics=[])

    provider_name_map_local = get_provider_name_map_posm_router()

    # 2. --- Apply Filters from User Selections ---

    # Filter by a specific Retailer ID if one is provided.
    if filters.retailerId and filters.retailerId != 'all' and 'PROFILE_ID' in df.columns:
        df['PROFILE_ID_STR'] = df['PROFILE_ID'].astype(str)
        df = df[df['PROFILE_ID_STR'] == filters.retailerId]
        if df.empty: return FetchPosmGeneralResponse(data=[], count=0, providerMetrics=[])

    
    geo_col_map = {'province': ['PROVINCE', 'SALES_REGION'], 'district': ['DISTRICT', 'SALES_DISTRICT'], 'dsDivision': ['DS_DIVISION']}
    for filter_key, df_cols_options in geo_col_map.items():
        filter_val = getattr(filters, filter_key, 'all') # Get the filter value, e.g., filters.province
        if filter_val and filter_val != 'all':
            # This logic tries the main column first (e.g., 'PROVINCE') and then a fallback ('SALES_REGION').
            for df_col in df_cols_options:
                if df_col in df.columns:
                    # Create a temporary column for case-insensitive matching.
                    df[f"{df_col}_LOWER_UNDERSCORE"] = df[df_col].astype(str).str.lower().str.replace(' ', '_', regex=False)
                    df = df[df[f"{df_col}_LOWER_UNDERSCORE"] == filter_val.lower()]
                    break # Stop after the first successful filter.
    if df.empty: return FetchPosmGeneralResponse(data=[], count=0, providerMetrics=[])

    # Filter by a specific Provider if one is selected.
    selected_provider_name_filter: Optional[str] = None
    if filters.provider and filters.provider != 'all':
        selected_provider_name_filter = provider_name_map_local.get(filters.provider)
        if selected_provider_name_filter:
            # For POSM, provider presence is measured by their area percentage.
            provider_col_filter = f"{selected_provider_name_filter.upper()}_AREA_PERCENTAGE"
            if provider_col_filter in df.columns:
                # Keep only rows where the selected provider has more than 0% visibility.
                df = df[pd.to_numeric(df[provider_col_filter], errors='coerce').fillna(0) > 0]
            else:
                df = pd.DataFrame(columns=df.columns) # If the column doesn't exist, return no results.
    if df.empty: return FetchPosmGeneralResponse(data=[], count=0, providerMetrics=[])

    # Filter by the Visibility Percentage range slider.
    if filters.visibilityRange and isinstance(filters.visibilityRange, str) and selected_provider_name_filter:
        try:
            min_val_str, max_val_str = filters.visibilityRange.split(',')
            min_vis, max_vis = float(min_val_str), float(max_val_str)
            
            provider_col_filter = f"{selected_provider_name_filter.upper()}_AREA_PERCENTAGE"
            if provider_col_filter in df.columns:
                provider_percentages = pd.to_numeric(df[provider_col_filter], errors='coerce').fillna(0)
                # Keep rows where the percentage is between the min and max slider values.
                df = df[(provider_percentages >= min_vis) & (provider_percentages <= max_vis)]
        except (ValueError, IndexError):
            pass # Ignore if the range is not formatted correctly.
    if df.empty: return FetchPosmGeneralResponse(data=[], count=0, providerMetrics=[])
            
    # Filter by POSM status ('increase' or 'decrease').
    if filters.posmStatus and filters.posmStatus != 'all' and selected_provider_name_filter:
        provider_col_filter = f"{selected_provider_name_filter.upper()}_AREA_PERCENTAGE"
        percentage_cols = [f"{p_name.upper()}_AREA_PERCENTAGE" for p_name in PROVIDER_NAMES_FOR_COMPARISON]
        
        # Find out which provider has the highest visibility in each row.
        df['max_provider_col'] = df[percentage_cols].idxmax(axis=1)

        if filters.posmStatus == 'increase':
            # 'Increase' means we only want to see retailers where our selected provider is dominant.
            df = df[df['max_provider_col'] == provider_col_filter]
        elif filters.posmStatus == 'decrease':
            # 'Decrease' means we want to see retailers where some OTHER provider is dominant.
            df = df[df['max_provider_col'] != provider_col_filter]
    if df.empty: return FetchPosmGeneralResponse(data=[], count=0, providerMetrics=[])

   
    posm_data_list: List[PosmData] = []
  
    for rowIndex, row_series in df.iterrows():
        row = row_series.to_dict()
        
        # For each row, determine the main provider (the one with the highest visibility).
        main_provider_for_row_display = "Unknown"
        visibility_perc_for_row_display = 0.0
        max_share = -1.0
        for p_config_iter in PROVIDERS_CONFIG_API_POSM_ROUTER:
            if p_config_iter['name'] == "All": continue
            col_name_iter = f"{p_config_iter['name'].upper()}_AREA_PERCENTAGE"
            current_share = to_numeric_or_default(row.get(col_name_iter))
            if current_share > max_share:
                max_share = current_share
                main_provider_for_row_display = p_config_iter['name']
                visibility_perc_for_row_display = max_share
        
        # Create a clean data object for the frontend using our Pydantic model.
        item = PosmData(
            id=safe_str_convert_posm_router(row.get('IMAGE_REF_ID')),
            retailerId=safe_str_convert_posm_router(row.get('PROFILE_ID')),
            provider=main_provider_for_row_display,
            visibilityPercentage=round(visibility_perc_for_row_display, 1),
            PROFILE_NAME=safe_str_convert_posm_router(row.get('PROFILE_NAME')),
            # ... and all other fields ...
            originalPosmImageIdentifier=safe_str_convert_posm_router(row.get('S3_ARN')),
            detectedPosmImageIdentifier=safe_str_convert_posm_router(row.get('INF_S3_ARN'))
        )
        posm_data_list.append(item)

 
    # Calculate the average visibility for each provider across all the filtered data.
    provider_metrics_list: List[ProviderMetric] = []
    if not df.empty:
        for p_config_metric in PROVIDERS_CONFIG_API_POSM_ROUTER:
            if p_config_metric['name'] == "All": continue
            col_name_metric = f"{p_config_metric['name'].upper()}_AREA_PERCENTAGE"
            if col_name_metric in df.columns:
                valid_shares = pd.to_numeric(df[col_name_metric], errors='coerce').dropna()
                avg_perc = valid_shares.mean() if not valid_shares.empty else 0.0
                provider_metrics_list.append(ProviderMetric(
                    provider=p_config_metric['name'],
                    percentage=round(float(avg_perc), 1)
                ))

    return FetchPosmGeneralResponse(
        data=posm_data_list,
        count=len(posm_data_list),
        providerMetrics=provider_metrics_list
    )


@router.get("/posm/retailers-by-change", response_model=List[Retailer])
async def get_retailers_by_posm_change():
    provider: str = Query(...),
    change_status: str = Query(..., alias="changeStatus"),
    posm_df: pd.DataFrame = Depends(get_posm_df),
    board_df: pd.DataFrame = Depends(get_boards_df)
    """
    Finds retailers whose POSM visibility for a specific provider has increased or decreased
    between their two most recent photo capture batches.
    """
    if posm_df.empty or provider == 'all' or change_status not in ['increase', 'decrease']:
        return []

    provider_name = get_provider_name_from_value_options(provider)
    if not provider_name: return []
    
    provider_col = f"{provider_name.upper()}_AREA_PERCENTAGE"
    if provider_col not in posm_df.columns: return []

    # 1. Prepare a smaller, cleaner dataframe for this specific task.
    df = posm_df[['PROFILE_ID', 'CAPTURE_PHASE', provider_col]].copy()
    df['PROFILE_ID'] = df['PROFILE_ID'].astype(str)
    df[provider_col] = pd.to_numeric(df[provider_col], errors='coerce').fillna(0)
    df['CAPTURE_PHASE'] = pd.to_numeric(df['CAPTURE_PHASE'], errors='coerce')
    df.dropna(subset=['CAPTURE_PHASE'], inplace=True)
    df.sort_values(by=['PROFILE_ID', 'CAPTURE_PHASE'], ascending=[True, False], inplace=True)
    
    # 2. Find only the retailers that have data from at least 2 different batches.
    retailer_batch_counts = df.groupby('PROFILE_ID')['CAPTURE_PHASE'].nunique()
    retailers_with_multiple_batches = retailer_batch_counts[retailer_batch_counts >= 2].index
    
    df_multi_batch = df[df['PROFILE_ID'].isin(retailers_with_multiple_batches)]
    if df_multi_batch.empty: return []

    # 3. For each retailer, get their latest two batches.
    latest_two_batches = df_multi_batch.groupby('PROFILE_ID').head(2)
    latest_batch = latest_two_batches.groupby('PROFILE_ID').first() 
    previous_batch = latest_two_batches.groupby('PROFILE_ID').last() 

    # 4. Compare the latest and previous batches to find the change.
    comparison_df = pd.merge(latest_batch, previous_batch, on='PROFILE_ID', suffixes=('_latest', '_previous'))
    comparison_df['change'] = comparison_df[f"{provider_col}_latest"] - comparison_df[f"{provider_col}_previous"]

    # 5. Select the retailers based on whether their visibility increased or decreased.
    if change_status == 'increase':
        changed_retailer_ids = comparison_df[comparison_df['change'] > 0].index.tolist()
    else: # 'decrease'
        changed_retailer_ids = comparison_df[comparison_df['change'] < 0].index.tolist()

    if not changed_retailer_ids: return []

    # 6. Get the full retailer info (name, location) for the ones that changed.
    retailer_info_df = board_df[board_df['PROFILE_ID'].astype(str).isin(changed_retailer_ids)].drop_duplicates(subset=['PROFILE_ID'])
    if retailer_info_df.empty: return []

    return [
        Retailer(
            id=str(row['PROFILE_ID']),
            name=str(row.get('PROFILE_NAME', 'N/A')),
            latitude=float(row['LATITUDE']),
            longitude=float(row['LONGITUDE']),
        ) for _, row in retailer_info_df.iterrows()
    ]


@router.get("/posm/comparison", response_model=PosmComparisonData)
async def fetch_posm_comparison_data_api(
    profileId: str = Query(...),
    batch1Id: str = Query(...),
    batch2Id: str = Query(...),
    posm_df_raw: pd.DataFrame = Depends(get_posm_df)
):
    """
    Gets all the data needed for the side-by-side comparison modal, showing two
    specific batches for a single retailer.
    """
    if posm_df_raw.empty:
        raise HTTPException(status_code=404, detail="POSM data not available")

    # Filter the main dataframe to just the selected retailer.
    df_profile = posm_df_raw[posm_df_raw['PROFILE_ID'].astype(str) == profileId].copy()
    if df_profile.empty:
        raise HTTPException(status_code=404, detail=f"Retailer with PROFILE_ID {profileId} not found")

    # This is a small helper function defined inside the endpoint.
    def get_batch_details(batch_id: str) -> PosmBatchDetails:
        """Finds one specific batch and extracts its details (image and provider shares)."""
        batch_df = df_profile[df_profile['CAPTURE_PHASE'].astype(str) == batch_id]
        if batch_df.empty:
            # Return placeholder data if the batch isn't found.
            return PosmBatchDetails(image="/assets/sample-retailer-placeholder.png", shares=[], maxCapturePhase=batch_id)

        batch_entry = batch_df.iloc[0]
        shares = []
        for provider_name in PROVIDER_NAMES_FOR_COMPARISON:
            col = f"{provider_name.upper()}_AREA_PERCENTAGE"
            percentage = to_numeric_or_default(batch_entry.get(col))
            shares.append(PosmBatchShare(provider=provider_name, percentage=round(percentage, 1)))
        
        # Get the URL for the image associated with this batch.
        image_arn = safe_str_convert_posm_router(batch_entry.get('INF_S3_ARN') or batch_entry.get('S3_ARN'))
        
        return PosmBatchDetails(
            image=image_arn if image_arn else "/assets/sample-retailer-placeholder.png",
            shares=shares,
            maxCapturePhase=safe_str_convert_posm_router(batch_entry.get('CAPTURE_PHASE'))
        )

    # Get the details for both batches.
    batch1_details = get_batch_details(batch1Id)
    batch2_details = get_batch_details(batch2Id)
    
    # Calculate the difference in visibility for each provider between the two batches.
    diffs = []
    for provider_name in PROVIDER_NAMES_FOR_COMPARISON:
        share1 = next((s.percentage for s in batch1_details.shares if s.provider == provider_name), 0)
        share2 = next((s.percentage for s in batch2_details.shares if s.provider == provider_name), 0)
        diffs.append({"provider": provider_name, "diff": round(share2 - share1, 1)})

    # Return the final, structured data for the comparison view.
    return PosmComparisonData(
        batch1=batch1_details,
        batch2=batch2_details,
        differences=diffs
    )


@router.get("/posm/available-batches/{profile_id}", response_model=List[FilterOption])
async def fetch_available_batches_for_profile(profile_id: str, posm_df: pd.DataFrame = Depends(get_posm_df)):
    """
    A simple endpoint that finds all the unique capture phases (batches) available
    for a single retailer, used to populate the batch selection dropdowns.
    """
    if posm_df.empty: return []
    
    # Find all rows for the given retailer ID.
    df_profile = posm_df[posm_df['PROFILE_ID'].astype(str) == profile_id]
    if df_profile.empty: return []
        
    # Get the unique, non-empty phase numbers.
    unique_phases = df_profile['CAPTURE_PHASE'].dropna().unique()
    
    # Try to sort them numerically, but fall back to string sorting if they aren't all numbers.
    try:
        sorted_phases = sorted(unique_phases, key=lambda x: int(float(x)))
    except (ValueError, TypeError):
        sorted_phases = sorted(unique_phases, key=lambda x: str(x))
    
    # Format them for the frontend dropdown.
    return [FilterOption(value=str(phase), label=f"Batch {phase}") for phase in sorted_phases]