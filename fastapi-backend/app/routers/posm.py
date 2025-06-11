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
    return {p["value"]: p["name"] for p in PROVIDERS_CONFIG_API_POSM_ROUTER}

def to_numeric_or_default(value, default=0.0):
    num = pd.to_numeric(value, errors='coerce')
    return default if pd.isna(num) else num

def safe_str_convert_posm_router(value) -> Optional[str]:
    if pd.isna(value) or value is None:
        return None
    return str(value)

@router.get("/posm/general", response_model=FetchPosmGeneralResponse)
async def fetch_posm_general_api(
    filters: PosmGeneralFiltersState = Depends(),
    posm_df_raw: pd.DataFrame = Depends(get_posm_df)
):
    if posm_df_raw.empty:
        return FetchPosmGeneralResponse(data=[], count=0, providerMetrics=[])

    df = filter_by_max_capture_phase(posm_df_raw, "posm_data_for_api")
    if df.empty:
       return FetchPosmGeneralResponse(data=[], count=0, providerMetrics=[])

    provider_name_map_local = get_provider_name_map_posm_router()

    if filters.retailerId and filters.retailerId != 'all' and 'PROFILE_ID' in df.columns:
        df['PROFILE_ID_STR'] = df['PROFILE_ID'].astype(str)
        df = df[df['PROFILE_ID_STR'] == filters.retailerId]
        if df.empty: return FetchPosmGeneralResponse(data=[], count=0, providerMetrics=[])

    geo_col_map = {
        'province': ['PROVINCE', 'SALES_REGION'],
        'district': ['DISTRICT', 'SALES_DISTRICT'],
        'dsDivision': ['DS_DIVISION']
    }
    for filter_key, df_cols_options in geo_col_map.items():
        filter_val = getattr(filters, filter_key, 'all')
        if filter_val and filter_val != 'all':
            applied_geo_filter = False
            for df_col in df_cols_options:
                if df_col in df.columns:
                    df[f"{df_col}_LOWER_UNDERSCORE"] = df[df_col].astype(str).str.lower().str.replace(' ', '_', regex=False)
                    df = df[df[f"{df_col}_LOWER_UNDERSCORE"] == filter_val.lower()]
                    applied_geo_filter = True
                    break
            if not df.empty and not applied_geo_filter and df_cols_options:
                 df = pd.DataFrame(columns=df.columns)
        if df.empty: return FetchPosmGeneralResponse(data=[], count=0, providerMetrics=[])

    selected_provider_name_filter: Optional[str] = None
    if filters.provider and filters.provider != 'all':
        selected_provider_name_filter = provider_name_map_local.get(filters.provider)
        if not selected_provider_name_filter:
            return FetchPosmGeneralResponse(data=[], count=0, providerMetrics=[])

        provider_col_filter = f"{selected_provider_name_filter.upper()}_AREA_PERCENTAGE"
        if provider_col_filter in df.columns:
            df = df[pd.to_numeric(df[provider_col_filter], errors='coerce').fillna(0) > 0]
        else:
            df = pd.DataFrame(columns=df.columns)
        if df.empty: return FetchPosmGeneralResponse(data=[], count=0, providerMetrics=[])

        if filters.visibilityRange and isinstance(filters.visibilityRange, str):
            try:
                min_val_str, max_val_str = filters.visibilityRange.split(',')
                min_vis = float(min_val_str)
                max_vis = float(max_val_str)

                if provider_col_filter in df.columns:
                    provider_percentages = pd.to_numeric(df[provider_col_filter], errors='coerce').fillna(0)
                    df = df[
                        (provider_percentages >= min_vis) &
                        (provider_percentages <= max_vis)
                    ]
            except (ValueError, IndexError):
                pass
        if df.empty: return FetchPosmGeneralResponse(data=[], count=0, providerMetrics=[])
        
        if filters.posmStatus and filters.posmStatus != 'all':
            percentage_cols = [f"{p_name.upper()}_AREA_PERCENTAGE" for p_name in PROVIDER_NAMES_FOR_COMPARISON]
            
            for col in percentage_cols:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
                else:
                    df[col] = 0

            df['max_provider_col'] = df[percentage_cols].idxmax(axis=1)

            if filters.posmStatus == 'increase':
                df = df[df['max_provider_col'] == provider_col_filter]
            elif filters.posmStatus == 'decrease':
                df = df[df['max_provider_col'] != provider_col_filter]

            if df.empty: return FetchPosmGeneralResponse(data=[], count=0, providerMetrics=[])

    posm_data_list: List[PosmData] = []
    for rowIndex, row_series in df.iterrows():
        row = row_series.to_dict()
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
        
        item = PosmData(
            id=safe_str_convert_posm_router(row.get('IMAGE_REF_ID', f"posm_{rowIndex}_{row.get('PROFILE_ID', '')}")),
            retailerId=safe_str_convert_posm_router(row.get('PROFILE_ID')),
            provider=main_provider_for_row_display,
            visibilityPercentage=round(to_numeric_or_default(visibility_perc_for_row_display), 1),
            PROFILE_NAME=safe_str_convert_posm_router(row.get('PROFILE_NAME')),
            PROVINCE=safe_str_convert_posm_router(row.get('PROVINCE')),
            DISTRICT=safe_str_convert_posm_router(row.get('DISTRICT')),
            DS_DIVISION=safe_str_convert_posm_router(row.get('DS_DIVISION')),
            GN_DIVISION=safe_str_convert_posm_router(row.get('GN_DIVISION')),
            SALES_REGION=safe_str_convert_posm_router(row.get('SALES_REGION')),
            SALES_DISTRICT=safe_str_convert_posm_router(row.get('SALES_DISTRICT')),
            SALES_AREA=safe_str_convert_posm_router(row.get('SALES_AREA')),
            DIALOG_AREA_PERCENTAGE=round(to_numeric_or_default(row.get('DIALOG_AREA_PERCENTAGE')), 1),
            AIRTEL_AREA_PERCENTAGE=round(to_numeric_or_default(row.get('AIRTEL_AREA_PERCENTAGE')), 1),
            MOBITEL_AREA_PERCENTAGE=round(to_numeric_or_default(row.get('MOBITEL_AREA_PERCENTAGE')), 1),
            HUTCH_AREA_PERCENTAGE=round(to_numeric_or_default(row.get('HUTCH_AREA_PERCENTAGE')), 1),
            originalPosmImageIdentifier=safe_str_convert_posm_router(row.get('S3_ARN')),
            detectedPosmImageIdentifier=safe_str_convert_posm_router(row.get('INF_S3_ARN'))
        )
        posm_data_list.append(item)

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
                    percentage=round(float(avg_perc), 1) if pd.notna(avg_perc) else 0.0
                ))
            
    return FetchPosmGeneralResponse(
        data=posm_data_list,
        count=len(posm_data_list),
        providerMetrics=provider_metrics_list
    )

@router.get("/posm/retailers-by-change", response_model=List[Retailer])
async def get_retailers_by_posm_change(
    provider: str = Query(...),
    change_status: str = Query(..., alias="changeStatus"),
    posm_df: pd.DataFrame = Depends(get_posm_df),
    board_df: pd.DataFrame = Depends(get_boards_df)
):
    if posm_df.empty or provider == 'all' or change_status not in ['increase', 'decrease']:
        return []

    provider_name = get_provider_name_from_value_options(provider)
    if not provider_name:
        return []
    
    provider_col = f"{provider_name.upper()}_AREA_PERCENTAGE"
    if provider_col not in posm_df.columns:
        return []

    df = posm_df[['PROFILE_ID', 'CAPTURE_PHASE', provider_col]].copy()
    df['PROFILE_ID'] = df['PROFILE_ID'].astype(str)
    df[provider_col] = pd.to_numeric(df[provider_col], errors='coerce').fillna(0)
    df['CAPTURE_PHASE'] = pd.to_numeric(df['CAPTURE_PHASE'], errors='coerce')
    df.dropna(subset=['CAPTURE_PHASE'], inplace=True)
    df.sort_values(by=['PROFILE_ID', 'CAPTURE_PHASE'], ascending=[True, False], inplace=True)
    
    retailer_batch_counts = df.groupby('PROFILE_ID')['CAPTURE_PHASE'].nunique()
    retailers_with_multiple_batches = retailer_batch_counts[retailer_batch_counts >= 2].index
    
    df_multi_batch = df[df['PROFILE_ID'].isin(retailers_with_multiple_batches)]
    if df_multi_batch.empty:
        return []

    latest_two_batches = df_multi_batch.groupby('PROFILE_ID').head(2)
    latest_batch = latest_two_batches.groupby('PROFILE_ID').first()
    previous_batch = latest_two_batches.groupby('PROFILE_ID').last()

    comparison_df = pd.merge(latest_batch, previous_batch, on='PROFILE_ID', suffixes=('_latest', '_previous'))
    comparison_df = comparison_df[comparison_df['CAPTURE_PHASE_latest'] != comparison_df['CAPTURE_PHASE_previous']]
    if comparison_df.empty:
        return []

    comparison_df['change'] = comparison_df[f"{provider_col}_latest"] - comparison_df[f"{provider_col}_previous"]

    if change_status == 'increase':
        changed_retailer_ids = comparison_df[comparison_df['change'] > 0].index.tolist()
    elif change_status == 'decrease':
        changed_retailer_ids = comparison_df[comparison_df['change'] < 0].index.tolist()
    else:
        changed_retailer_ids = []

    if not changed_retailer_ids:
        return []

    retailer_info_df = board_df[board_df['PROFILE_ID'].astype(str).isin(changed_retailer_ids)].drop_duplicates(subset=['PROFILE_ID'])
    if retailer_info_df.empty:
        return []

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
    if posm_df_raw.empty:
        raise HTTPException(status_code=404, detail="POSM data not available")

    df_profile = posm_df_raw[posm_df_raw['PROFILE_ID'].astype(str) == profileId].copy()
    if df_profile.empty:
        raise HTTPException(status_code=404, detail=f"Retailer with PROFILE_ID {profileId} not found")

    def get_batch_details(batch_id: str) -> PosmBatchDetails:
        batch_df = df_profile[df_profile['CAPTURE_PHASE'].astype(str) == batch_id]
        if batch_df.empty:
            return PosmBatchDetails(image="/assets/sample-retailer-placeholder.png", shares=[], maxCapturePhase=batch_id)

        batch_entry = batch_df.iloc[0]
        shares = []
        for provider_name in PROVIDER_NAMES_FOR_COMPARISON:
            col = f"{provider_name.upper()}_AREA_PERCENTAGE"
            percentage = to_numeric_or_default(batch_entry.get(col))
            shares.append(PosmBatchShare(provider=provider_name, percentage=round(percentage, 1)))
        
        image_arn = safe_str_convert_posm_router(batch_entry.get('INF_S3_ARN') or batch_entry.get('S3_ARN'))
        
        return PosmBatchDetails(
            image=image_arn if image_arn else "/assets/sample-retailer-placeholder.png",
            shares=shares,
            maxCapturePhase=safe_str_convert_posm_router(batch_entry.get('CAPTURE_PHASE'))
        )

    batch1_details = get_batch_details(batch1Id)
    batch2_details = get_batch_details(batch2Id)
    
    diffs = []
    for provider_name in PROVIDER_NAMES_FOR_COMPARISON:
        share1 = next((s.percentage for s in batch1_details.shares if s.provider == provider_name), 0)
        share2 = next((s.percentage for s in batch2_details.shares if s.provider == provider_name), 0)
        diffs.append({"provider": provider_name, "diff": round(share2 - share1, 1)})

    return PosmComparisonData(
        batch1=batch1_details,
        batch2=batch2_details,
        differences=diffs
    )


@router.get("/posm/available-batches/{profile_id}", response_model=List[FilterOption])
async def fetch_available_batches_for_profile(profile_id: str, posm_df: pd.DataFrame = Depends(get_posm_df)):
    if posm_df.empty or 'PROFILE_ID' not in posm_df.columns:
        return []
    
    df_profile = posm_df[posm_df['PROFILE_ID'].astype(str) == profile_id]
    if df_profile.empty:
        return []
        
    unique_phases = df_profile['CAPTURE_PHASE'].dropna().unique()
    
    try:
        sorted_phases = sorted(unique_phases, key=lambda x: int(float(x)))
    except (ValueError, TypeError):
        sorted_phases = sorted(unique_phases, key=lambda x: str(x))
    
    return [FilterOption(value=str(phase), label=f"Batch {phase}") for phase in sorted_phases]