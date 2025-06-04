from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any, Tuple
import pandas as pd
import numpy as np # For np.nan comparison if needed

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

def safe_float_convert_posm_router(value, default_value: Optional[float] = 0.0) -> Optional[float]:
    if pd.isna(value) or value == '':
        return None # Pydantic will handle None for Optional fields
    try:
        return float(value)
    except (ValueError, TypeError):
        return default_value # Or None if preferred for conversion errors

def safe_str_convert_posm_router(value) -> Optional[str]:
    if pd.isna(value):
        return None
    return str(value)

@router.get("/posm/general", response_model=FetchPosmGeneralResponse)
async def fetch_posm_general_api(
    filters: PosmGeneralFiltersState = Depends(), # Automatically uses the validator for visibilityRange
    posm_df_raw: pd.DataFrame = Depends(get_posm_df)
):
    if posm_df_raw.empty:
        return FetchPosmGeneralResponse(data=[], count=0, providerMetrics=[])

    df = filter_by_max_capture_phase(posm_df_raw, "posm_data_for_api")
    if df.empty:
       return FetchPosmGeneralResponse(data=[], count=0, providerMetrics=[])
        
    provider_name_map_local = get_provider_name_map_posm_router()

    # Apply Retailer ID filter first
    if filters.retailerId and filters.retailerId != 'all' and 'PROFILE_ID' in df.columns:
        df['PROFILE_ID_STR'] = df['PROFILE_ID'].astype(str) # Ensure consistent type for comparison
        df = df[df['PROFILE_ID_STR'] == filters.retailerId]
        if df.empty: return FetchPosmGeneralResponse(data=[], count=0, providerMetrics=[])
    
    # Geographic filters
    geo_col_map = {
        'province': ['PROVINCE', 'SALES_REGION'],
        'district': ['DISTRICT', 'SALES_DISTRICT'],
        'dsDivision': ['DS_DIVISION']
    }
    for filter_key, df_cols_options in geo_col_map.items():
        filter_val = getattr(filters, filter_key, 'all') # Default to 'all' if not present
        if filter_val and filter_val != 'all':
            applied_geo_filter = False
            for df_col in df_cols_options:
                if df_col in df.columns:
                    # Ensure comparison is robust (case-insensitive, handle spaces)
                    df[f"{df_col}_LOWER_UNDERSCORE"] = df[df_col].astype(str).str.lower().str.replace(' ', '_', regex=False)
                    df = df[df[f"{df_col}_LOWER_UNDERSCORE"] == filter_val.lower()]
                    applied_geo_filter = True
                    break 
            if not df.empty and not applied_geo_filter and df_cols_options:
                 df = pd.DataFrame(columns=df.columns) 
        if df.empty: return FetchPosmGeneralResponse(data=[], count=0, providerMetrics=[])

    # Provider specific filters
    selected_provider_name_filter: Optional[str] = None
    if filters.provider and filters.provider != 'all':
        selected_provider_name_filter = provider_name_map_local.get(filters.provider)
        if not selected_provider_name_filter:
            return FetchPosmGeneralResponse(data=[], count=0, providerMetrics=[])
        
        provider_col_filter = f"{selected_provider_name_filter.upper()}_AREA_PERCENTAGE"
        if provider_col_filter in df.columns:
            df = df[pd.to_numeric(df[provider_col_filter], errors='coerce').fillna(0) > 0]
        else:
            df = pd.DataFrame(columns=df.columns) # Provider column doesn't exist
        if df.empty: return FetchPosmGeneralResponse(data=[], count=0, providerMetrics=[])

        # POSM Status Filter (Dominant/Not Dominant)
        if filters.posmStatus and filters.posmStatus != 'all':
            if filters.posmStatus == 'increase': # Dominant
                def is_dominant(row):
                    selected_share = pd.to_numeric(row.get(provider_col_filter), errors='coerce').fillna(0)
                    if selected_share == 0: return False # Cannot be dominant if share is 0
                    for other_p_name in PROVIDER_NAMES_FOR_COMPARISON:
                        if other_p_name == selected_provider_name_filter: continue
                        other_col = f"{other_p_name.upper()}_AREA_PERCENTAGE"
                        other_share = pd.to_numeric(row.get(other_col), errors='coerce').fillna(0)
                        if selected_share <= other_share: # Not strictly highest
                            return False
                    return True 
                df = df[df.apply(is_dominant, axis=1)]

            elif filters.posmStatus == 'decrease': # Not Dominant
                def is_not_dominant(row):
                    selected_share = pd.to_numeric(row.get(provider_col_filter), errors='coerce').fillna(0)
                    # Must have some share to be "not dominant" but present
                    if selected_share == 0: return False

                    is_highest = True # Assume it's highest initially
                    has_competitor_with_higher_or_equal_share = False
                    for other_p_name in PROVIDER_NAMES_FOR_COMPARISON:
                        if other_p_name == selected_provider_name_filter: continue
                        other_col = f"{other_p_name.upper()}_AREA_PERCENTAGE"
                        other_share = pd.to_numeric(row.get(other_col), errors='coerce').fillna(0)
                        if selected_share <= other_share and other_share > 0 : # Another provider is equal or higher (and present)
                            has_competitor_with_higher_or_equal_share = True
                            break 
                    # "Not dominant" means it's present (checked by initial provider filter) AND it's not the uniquely highest.
                    # Or, if another definition: it is present AND some OTHER provider has a higher share.
                    # Let's go with: present, but not strictly highest among those present.
                    return has_competitor_with_higher_or_equal_share

                df = df[df.apply(is_not_dominant, axis=1)]
            if df.empty: return FetchPosmGeneralResponse(data=[], count=0, providerMetrics=[])

        # Visibility Range Filter (only if status is 'all' and a specific provider is selected)
        # The validator in PosmGeneralFiltersState ensures visibilityRange is List[float, float] or None
        if filters.posmStatus == 'all' and filters.visibilityRange and isinstance(filters.visibilityRange, list) and len(filters.visibilityRange) == 2:
            min_vis, max_vis = filters.visibilityRange
            if provider_col_filter in df.columns:
                df = df[
                    (pd.to_numeric(df[provider_col_filter], errors='coerce').fillna(0) >= min_vis) &
                    (pd.to_numeric(df[provider_col_filter], errors='coerce').fillna(0) <= max_vis)
                ]
            if df.empty: return FetchPosmGeneralResponse(data=[], count=0, providerMetrics=[])

    posm_data_list: List[PosmData] = []
    for rowIndex, row_series in df.iterrows(): # row is a Pandas Series
        row = row_series.to_dict() # Convert to dict for easier .get() with default
        main_provider_for_row_display = "Unknown"
        visibility_perc_for_row_display = 0.0
        
        if selected_provider_name_filter:
            main_provider_for_row_display = selected_provider_name_filter
            provider_col_disp = f"{selected_provider_name_filter.upper()}_AREA_PERCENTAGE"
            visibility_perc_for_row_display = pd.to_numeric(row.get(provider_col_disp), errors='coerce').fillna(0)
        else:
            max_share = -1.0
            for p_config_iter in PROVIDERS_CONFIG_API_POSM_ROUTER:
                if p_config_iter['name'] == "All": continue
                col_name_iter = f"{p_config_iter['name'].upper()}_AREA_PERCENTAGE"
                current_share = pd.to_numeric(row.get(col_name_iter), errors='coerce').fillna(0)
                if current_share > max_share:
                    max_share = current_share
                    main_provider_for_row_display = p_config_iter['name']
                    visibility_perc_for_row_display = max_share
        
        item = PosmData(
            id=safe_str_convert_posm_router(row.get('IMAGE_REF_ID', f"posm_{rowIndex}_{row.get('PROFILE_ID', '')}")),
            retailerId=safe_str_convert_posm_router(row.get('PROFILE_ID')),
            provider=main_provider_for_row_display,
            visibilityPercentage=round(safe_float_convert_posm_router(visibility_perc_for_row_display, 0.0) or 0.0, 1),
            PROFILE_NAME=safe_str_convert_posm_router(row.get('PROFILE_NAME')),
            PROVINCE=safe_str_convert_posm_router(row.get('PROVINCE')),
            DISTRICT=safe_str_convert_posm_router(row.get('DISTRICT')),
            DS_DIVISION=safe_str_convert_posm_router(row.get('DS_DIVISION')),
            GN_DIVISION=safe_str_convert_posm_router(row.get('GN_DIVISION')),
            SALES_REGION=safe_str_convert_posm_router(row.get('SALES_REGION')),
            SALES_DISTRICT=safe_str_convert_posm_router(row.get('SALES_DISTRICT')),
            SALES_AREA=safe_str_convert_posm_router(row.get('SALES_AREA')),
            DIALOG_AREA_PERCENTAGE=round(safe_float_convert_posm_router(row.get('DIALOG_AREA_PERCENTAGE')) or 0.0, 1),
            AIRTEL_AREA_PERCENTAGE=round(safe_float_convert_posm_router(row.get('AIRTEL_AREA_PERCENTAGE')) or 0.0, 1),
            MOBITEL_AREA_PERCENTAGE=round(safe_float_convert_posm_router(row.get('MOBITEL_AREA_PERCENTAGE')) or 0.0, 1),
            HUTCH_AREA_PERCENTAGE=round(safe_float_convert_posm_router(row.get('HUTCH_AREA_PERCENTAGE')) or 0.0, 1),
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
                avg_perc = pd.to_numeric(df[col_name_metric], errors='coerce').fillna(0).mean()
                provider_metrics_list.append(ProviderMetric(
                    provider=p_config_metric['name'],
                    percentage=round(float(avg_perc), 1) if pd.notna(avg_perc) else 0.0
                ))
            
    return FetchPosmGeneralResponse(
        data=posm_data_list,
        count=len(posm_data_list),
        providerMetrics=provider_metrics_list
    )

# ... (Keep existing /posm/available-batches and /posm/comparison as they were, they seem okay)
@router.get("/posm/available-batches/{profile_id}", response_model=List[FilterOption])
async def fetch_available_batches_api(profile_id: str, posm_df_all_phases: pd.DataFrame = Depends(get_posm_df)):
    if posm_df_all_phases.empty or 'PROFILE_ID' not in posm_df_all_phases.columns or 'CAPTURE_PHASE' not in posm_df_all_phases.columns:
        return []
    posm_df_all_phases['PROFILE_ID'] = posm_df_all_phases['PROFILE_ID'].astype(str)
    posm_df_all_phases['CAPTURE_PHASE'] = pd.to_numeric(posm_df_all_phases['CAPTURE_PHASE'], errors='coerce')
    profile_data = posm_df_all_phases[posm_df_all_phases['PROFILE_ID'] == profile_id]
    if profile_data.empty: return []
    unique_capture_phases = sorted(profile_data['CAPTURE_PHASE'].dropna().unique())
    base_batches_map = {
        1.0: {"value": 'batch1_2023_q1', "label": '2023 Q1'}, 2.0: {"value": 'batch2_2023_q2', "label": '2023 Q2'},
        3.0: {"value": 'batch3_2023_q3', "label": '2023 Q3'}, 4.0: {"value": 'batch4_2023_q4', "label": '2023 Q4'},
        5.0: {"value": 'batch5_2024_q1', "label": '2024 Q1'},
    }
    available_options: List[FilterOption] = []
    for cp_float in unique_capture_phases:
        matched_batch = base_batches_map.get(float(cp_float))
        if matched_batch: available_options.append(FilterOption(value=matched_batch["value"], label=matched_batch["label"]))
        else: available_options.append(FilterOption(value=f"capture_phase_{int(cp_float)}", label=f"Capture Phase {int(cp_float)}"))
    return available_options

def mock_random_provider_shares_posm_router() -> List[PosmBatchShare]: # Renamed to avoid conflict
    actual_providers = [p for p in PROVIDERS_CONFIG_API_POSM_ROUTER if p["key"] != "all"]
    if not actual_providers: return [PosmBatchShare(provider="Default", percentage=100.0)]
    num_to_select = random.randint(1, min(len(actual_providers), 4))
    selected = random.sample(actual_providers, num_to_select)
    shares_vals = [random.uniform(0.1, 100.0) for _ in selected]
    total = sum(shares_vals) if sum(shares_vals) > 0 else 1
    norm_shares = [round((s / total) * 100, 1) for s in shares_vals]
    current_sum = sum(norm_shares)
    if norm_shares and abs(current_sum - 100.0) > 0.1: norm_shares[0] = round(norm_shares[0] + (100.0 - current_sum), 1)
    return [PosmBatchShare(provider=sp["name"], percentage=ns) for sp, ns in zip(selected, norm_shares) if ns >=0]


@router.get("/posm/comparison", response_model=PosmComparisonData)
async def fetch_posm_comparison_data_api(
    profileId: str, batch1Id: str, batch2Id: str,
    posm_df_all_phases: pd.DataFrame = Depends(get_posm_df)
):
    if posm_df_all_phases.empty: raise HTTPException(status_code=404, detail="POSM data not available")
    posm_df_all_phases['PROFILE_ID'] = posm_df_all_phases['PROFILE_ID'].astype(str)
    posm_df_all_phases['CAPTURE_PHASE'] = pd.to_numeric(posm_df_all_phases['CAPTURE_PHASE'], errors='coerce')

    capture_phase_map = {
        'batch1_2023_q1': 1.0, 'batch2_2023_q2': 2.0, 'batch3_2023_q3': 3.0,
        'batch4_2023_q4': 4.0, 'batch5_2024_q1': 5.0
    }
    
    available_batch_options = await fetch_available_batches_api(profileId, posm_df_all_phases)
    batch_labels_map = {opt.value: opt.label for opt in available_batch_options}


    def get_shares_for_batch_comp(df: pd.DataFrame, current_profile_id: str, batch_id_str: str) -> Tuple[List[PosmBatchShare], Optional[str], Optional[str]]:
        target_phase = capture_phase_map.get(batch_id_str)
        phase_label_disp = batch_labels_map.get(batch_id_str, batch_id_str)

        batch_data = pd.DataFrame()
        if target_phase is not None:
            batch_data = df[(df['PROFILE_ID'] == current_profile_id) & (df['CAPTURE_PHASE'] == target_phase)]

        if batch_data.empty:
            img_seed = f"{current_profile_id}_{batch_id_str.replace('_','').replace('-','')}"
            return mock_random_provider_shares_posm_router(), f"https://picsum.photos/seed/{img_seed}/300/200", phase_label_disp

        row = batch_data.iloc[0].to_dict()
        shares_list = []
        row_total_perc = 0
        for p_conf in PROVIDER_NAMES_FOR_COMPARISON:
            share_val = pd.to_numeric(row.get(f"{p_conf.upper()}_AREA_PERCENTAGE"), errors='coerce').fillna(0)
            if share_val > 0:
                shares_list.append(PosmBatchShare(provider=p_conf, percentage=round(share_val, 1)))
                row_total_perc += share_val
        
        if row_total_perc > 0 and (row_total_perc < 99.0 or row_total_perc > 101.0) and shares_list:
            shares_list = [PosmBatchShare(provider=s.provider, percentage=round((s.percentage / row_total_perc) * 100, 1)) for s in shares_list]
            current_sum_norm = sum(s.percentage for s in shares_list)
            if shares_list and abs(current_sum_norm - 100.0) > 0.1: shares_list[0].percentage = round(shares_list[0].percentage + (100.0 - current_sum_norm),1)

        img_s3 = safe_str_convert_posm_router(row.get('S3_ARN'))
        img_seed_data = f"{current_profile_id}_{target_phase}_{img_s3.split('/')[-1] if img_s3 else batch_id_str}"
        img_url = f"https://picsum.photos/seed/{img_seed_data.replace('.jpeg','').replace('.png','')}/300/200"
        
        return shares_list if shares_list else mock_random_provider_shares_posm_router(), img_url, phase_label_disp

    b1_shares, b1_img, _ = await get_shares_for_batch_comp(posm_df_all_phases, profileId, batch1Id) # await here
    b2_shares, b2_img, b2_phase_label_disp = await get_shares_for_batch_comp(posm_df_all_phases, profileId, batch2Id) # await here
    
    diffs: List[Dict[str, Any]] = []
    all_providers_comp = set(s.provider for s in b1_shares) | set(s.provider for s in b2_shares)
    if not all_providers_comp: all_providers_comp = set(PROVIDER_NAMES_FOR_COMPARISON)

    for p_name_c in all_providers_comp:
        s1 = next((s.percentage for s in b1_shares if s.provider == p_name_c), 0.0)
        s2 = next((s.percentage for s in b2_shares if s.provider == p_name_c), 0.0)
        diffs.append({"provider": p_name_c, "diff": round(s2 - s1, 1)})

    return PosmComparisonData(
        batch1=PosmBatchDetails(image=b1_img, shares=b1_shares),
        batch2=PosmBatchDetails(image=b2_img, shares=b2_shares, maxCapturePhase=b2_phase_label_disp),
        differences=diffs
    )