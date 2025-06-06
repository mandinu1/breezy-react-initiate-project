from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any, Tuple
import pandas as pd
import random
import numpy as np


from app.models import (
    FetchPosmGeneralResponse, PosmGeneralFiltersState, PosmData, ProviderMetric,
    PosmComparisonData, PosmBatchDetails, PosmBatchShare, FilterOption
)
from app.dependencies import get_posm_df
from app.data_loader import filter_by_max_capture_phase

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
    if pd.isna(value):
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

        # --- CORRECTED LOGIC ---
        # First, apply the visibility range filter if it's not the default [0, 100]
        if filters.visibilityRange and isinstance(filters.visibilityRange, list) and len(filters.visibilityRange) == 2:
            min_vis, max_vis = filters.visibilityRange
            if min_vis > 0 or max_vis < 100:
                if provider_col_filter in df.columns:
                    df = df[
                        (pd.to_numeric(df[provider_col_filter], errors='coerce').fillna(0) >= min_vis) &
                        (pd.to_numeric(df[provider_col_filter], errors='coerce').fillna(0) <= max_vis)
                    ]
        if df.empty: return FetchPosmGeneralResponse(data=[], count=0, providerMetrics=[])

        # Second, apply the status filter (Dominant/Not Dominant)
        if filters.posmStatus and filters.posmStatus != 'all':
            percentage_cols = [f"{p_name.upper()}_AREA_PERCENTAGE" for p_name in PROVIDER_NAMES_FOR_COMPARISON]
            
            for col in percentage_cols:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
                else:
                    df[col] = 0

            df['max_provider_col'] = df[percentage_cols].idxmax(axis=1)

            if filters.posmStatus == 'increase': # Dominant
                df = df[df['max_provider_col'] == provider_col_filter]
            elif filters.posmStatus == 'decrease': # Not Dominant
                df = df[df['max_provider_col'] != provider_col_filter]

            if df.empty: return FetchPosmGeneralResponse(data=[], count=0, providerMetrics=[])
        # --- END OF CORRECTION ---

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