from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any
import pandas as pd
import random

from app.models import (
    FetchPosmGeneralResponse, PosmGeneralFiltersState, PosmData, ProviderMetric,
    PosmComparisonData, PosmBatchDetails, PosmBatchShare, FilterOption
)
from app.dependencies import get_posm_df
from app.data_loader import filter_by_max_capture_phase
# from app.s3_utils import generate_presigned_url # If used in comparison

router = APIRouter()

PROVIDERS_CONFIG_API = [
    {"value": "all", "label": "All Providers", "name": "All", "key": "all"},
    {"value": "dialog", "label": "Dialog", "name": "Dialog", "key": "dialog"},
    {"value": "mobitel", "label": "Mobitel", "name": "Mobitel", "key": "mobitel"},
    {"value": "airtel", "label": "Airtel", "name": "Airtel", "key": "airtel"},
    {"value": "hutch", "label": "Hutch", "name": "Hutch", "key": "hutch"},
]

def get_provider_name_map(): # Used locally
    return {p["value"]: p["name"] for p in PROVIDERS_CONFIG_API}

def safe_float_convert(value, default_value: Optional[float] = 0.0) -> Optional[float]:
    if pd.isna(value):
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return default_value

def safe_str_convert_posm(value) -> Optional[str]:
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
        
    provider_name_map_local = get_provider_name_map() # Use local helper

    # Apply provider filter first as it might affect visibility/status interpretation
    if filters.provider and filters.provider != 'all':
        provider_name_filter = provider_name_map_local.get(filters.provider)
        if provider_name_filter and f"{provider_name_filter.upper()}_AREA_PERCENTAGE" in df.columns:
            df = df[df[f"{provider_name_filter.upper()}_AREA_PERCENTAGE"].fillna(0) > 0]
    
    # Geographic filters
    geo_col_map = {
        'province': ['PROVINCE', 'SALES_REGION'],
        'district': ['DISTRICT', 'SALES_DISTRICT'],
        'dsDivision': ['DS_DIVISION']
    }
    for filter_key, df_cols in geo_col_map.items():
        filter_val = getattr(filters, filter_key)
        if filter_val and filter_val != 'all':
            for df_col in df_cols:
                if df_col in df.columns:
                    df = df[df[df_col].astype(str).str.lower() == filter_val.lower()]
                    break # Found and applied, move to next filter_key
    
    if filters.retailerId and filters.retailerId != 'all' and 'PROFILE_ID' in df.columns:
        df = df[df['PROFILE_ID'].astype(str) == filters.retailerId]

    # Visibility Range and POSM Status filtering
    if filters.provider and filters.provider != 'all' and filters.visibilityRange:
        provider_name_filter = provider_name_map_local.get(filters.provider)
        if provider_name_filter and f"{provider_name_filter.upper()}_AREA_PERCENTAGE" in df.columns:
            min_vis, max_vis = filters.visibilityRange
            df = df[
                (df[f"{provider_name_filter.upper()}_AREA_PERCENTAGE"].fillna(0) >= min_vis) &
                (df[f"{provider_name_filter.upper()}_AREA_PERCENTAGE"].fillna(0) <= max_vis)
            ]
    
    # Note: POSM Status filter (increase/decrease) is complex and not fully implemented here.
    # It would typically require comparing data across different time periods (batches/capture phases)
    # or comparing a provider's share against others within the same record.

    posm_data_list: List[PosmData] = []
    for rowIndex, row in df.iterrows():
        # Determine main provider and its visibility for the row
        main_provider_for_row = "Unknown"
        visibility_perc_for_row = 0.0
        
        if filters.provider and filters.provider != 'all':
            p_name = provider_name_map_local.get(filters.provider)
            if p_name and f"{p_name.upper()}_AREA_PERCENTAGE" in row:
                main_provider_for_row = p_name
                visibility_perc_for_row = float(row.get(f"{p_name.upper()}_AREA_PERCENTAGE", 0.0))
        else: 
            max_share = -1.0
            for p_config in PROVIDERS_CONFIG_API: # Use PROVIDERS_CONFIG_API here
                if p_config['name'] == "All": continue
                col_name = f"{p_config['name'].upper()}_AREA_PERCENTAGE"
                current_share = float(row.get(col_name, 0.0))
                if current_share > max_share:
                    max_share = current_share
                    main_provider_for_row = p_config['name']
                    visibility_perc_for_row = max_share
        
        item = PosmData(
            id=safe_str_convert_posm(row.get('IMAGE_REF_ID', f"posm_{rowIndex}_{row.get('PROFILE_ID', '')}")),
            retailerId=safe_str_convert_posm(row.get('PROFILE_ID')),
            provider=main_provider_for_row,
            visibilityPercentage=safe_float_convert(visibility_perc_for_row, 0.0) or 0.0,
            
            PROFILE_NAME=safe_str_convert_posm(row.get('PROFILE_NAME')),
            PROVINCE=safe_str_convert_posm(row.get('PROVINCE')),
            DISTRICT=safe_str_convert_posm(row.get('DISTRICT')),
            DS_DIVISION=safe_str_convert_posm(row.get('DS_DIVISION')),
            GN_DIVISION=safe_str_convert_posm(row.get('GN_DIVISION')),
            SALES_REGION=safe_str_convert_posm(row.get('SALES_REGION')),
            SALES_DISTRICT=safe_str_convert_posm(row.get('SALES_DISTRICT')),
            SALES_AREA=safe_str_convert_posm(row.get('SALES_AREA')),
            
            DIALOG_AREA_PERCENTAGE=safe_float_convert(row.get('DIALOG_AREA_PERCENTAGE')),
            AIRTEL_AREA_PERCENTAGE=safe_float_convert(row.get('AIRTEL_AREA_PERCENTAGE')),
            MOBITEL_AREA_PERCENTAGE=safe_float_convert(row.get('MOBITEL_AREA_PERCENTAGE')),
            HUTCH_AREA_PERCENTAGE=safe_float_convert(row.get('HUTCH_AREA_PERCENTAGE')),

            originalPosmImageIdentifier=safe_str_convert_posm(row.get('S3_ARN')),
            detectedPosmImageIdentifier=safe_str_convert_posm(row.get('INF_S3_ARN'))
        )
        posm_data_list.append(item)

    provider_metrics_list: List[ProviderMetric] = []
    source_for_metrics = df 

    for p_config in PROVIDERS_CONFIG_API:
        if p_config['name'] == "All": continue
        col_name = f"{p_config['name'].upper()}_AREA_PERCENTAGE"
        if col_name in source_for_metrics.columns:
            avg_perc = source_for_metrics[col_name].fillna(0).mean()
            provider_metrics_list.append(ProviderMetric(
                provider=p_config['name'],
                percentage=round(float(avg_perc), 1)
            ))
            
    return FetchPosmGeneralResponse(
        data=posm_data_list,
        count=len(posm_data_list),
        providerMetrics=provider_metrics_list
    )

# --- Other POSM endpoints like /available-batches and /comparison ---
# (Using the versions from previous response as they were more developed)
@router.get("/posm/available-batches/{profile_id}", response_model=List[FilterOption])
async def fetch_available_batches_api(profile_id: str, posm_df_all_phases: pd.DataFrame = Depends(get_posm_df)):
    if posm_df_all_phases.empty or 'PROFILE_ID' not in posm_df_all_phases.columns or 'CAPTURE_PHASE' not in posm_df_all_phases.columns:
        return []
    profile_data = posm_df_all_phases[posm_df_all_phases['PROFILE_ID'].astype(str) == profile_id]
    if profile_data.empty:
        return []
    
    unique_capture_phases = sorted(profile_data['CAPTURE_PHASE'].dropna().unique())
    
    base_batches = [
        {"value": 'batch1_2023_q1', "label": '2023 Q1', "phase_num": 1.0},
        {"value": 'batch2_2023_q2', "label": '2023 Q2', "phase_num": 2.0},
        {"value": 'batch3_2023_q3', "label": '2023 Q3', "phase_num": 3.0},
        {"value": 'batch4_2023_q4', "label": '2023 Q4', "phase_num": 4.0},
        {"value": 'batch5_2024_q1', "label": '2024 Q1', "phase_num": 5.0},
    ]
    available_options: List[FilterOption] = []
    for cp_float in unique_capture_phases:
        cp = float(cp_float)
        matched_batch = next((b for b in base_batches if b["phase_num"] == cp), None)
        if matched_batch:
            available_options.append(FilterOption(value=matched_batch["value"], label=matched_batch["label"]))
        else:
            available_options.append(FilterOption(value=f"capture_phase_{int(cp)}", label=f"Capture Phase {int(cp)}"))
    return available_options

def mock_random_provider_shares() -> List[PosmBatchShare]: # Helper for mock comparison
    actual_providers = [p for p in PROVIDERS_CONFIG_API if p["key"] != "all"]
    if not actual_providers: return [PosmBatchShare(provider="Default", percentage=100.0)]
    num_providers_to_select = random.randint(1, min(len(actual_providers), 4))
    selected_providers = random.sample(actual_providers, num_providers_to_select)
    
    shares_val = [random.random() + 0.01 for _ in selected_providers] 
    total_share = sum(shares_val)
    if total_share == 0: total_share = 1 
        
    normalized_shares = [round((s / total_share) * 100, 1) for s in shares_val]
    sum_normalized = sum(normalized_shares)
    if sum_normalized != 100.0 and normalized_shares:
        diff = 100.0 - sum_normalized
        normalized_shares[0] = round(normalized_shares[0] + diff, 1)
        if normalized_shares[0] < 0:
            current_sum = sum(s for i,s in enumerate(normalized_shares) if i != 0 and s > 0)
            normalized_shares[0] = max(0, 100.0 - current_sum)
            # Re-normalize if necessary to ensure sum is 100 and no negatives
            if sum(s for s in normalized_shares if s >0) == 0 and normalized_shares: # if all became zero
                normalized_shares[0] = 100.0
            else: # general re-distribution of error
                err = 100.0 - sum(s for s in normalized_shares if s > 0)
                for i in range(len(normalized_shares)):
                    if normalized_shares[i]>0:
                        normalized_shares[i] += err
                        break


    return [
        PosmBatchShare(provider=sp["name"], percentage=ns)
        for sp, ns in zip(selected_providers, normalized_shares) if ns >= 0
    ]


@router.get("/posm/comparison", response_model=PosmComparisonData)
async def fetch_posm_comparison_data_api(
    profileId: str, batch1Id: str, batch2Id: str,
    posm_df_all_phases: pd.DataFrame = Depends(get_posm_df) # This df contains all capture phases
):
    # This function should ideally use actual data from different capture phases.
    # The mapping from batch1Id/batch2Id (e.g., "batch1_2023_q1") to CAPTURE_PHASE (e.g., 1.0, 2.0) is key.
    # We'll use a simplified share calculation for this example.
    
    def get_shares_for_batch(df: pd.DataFrame, current_profile_id: str, batch_id_str: str) -> Tuple[List[PosmBatchShare], Optional[str], Optional[str]]:
        # Attempt to map batch_id_str to a CAPTURE_PHASE
        # This mapping needs to be robust based on your actual data.
        # Example: batch1_2023_q1 -> 1.0, batch5_2024_q1 -> 5.0
        # For this example, we'll try to extract a phase number if present or use a mock.
        
        capture_phase_map_mock = {
            'batch1_2023_q1': 1.0, 'batch2_2023_q2': 2.0, 'batch3_2023_q3': 3.0, 
            'batch4_2023_q4': 4.0, 'batch5_2024_q1': 5.0
        } # Add more if needed
        target_phase = capture_phase_map_mock.get(batch_id_str)

        batch_data_for_profile = pd.DataFrame()
        if target_phase is not None and 'CAPTURE_PHASE' in df.columns:
            batch_data_for_profile = df[
                (df['PROFILE_ID'].astype(str) == current_profile_id) & 
                (df['CAPTURE_PHASE'] == target_phase)
            ]

        if batch_data_for_profile.empty: # Fallback to mock shares if no data for this batch/profile
            return mock_random_provider_shares(), f"https://picsum.photos/seed/{current_profile_id}_{batch_id_str.replace('_','')}/300/200", "Mock Phase"

        # Assuming one row per profile_id and capture_phase after filtering
        row = batch_data_for_profile.iloc[0]
        shares = []
        total_percentage = 0
        for p_config in PROVIDERS_CONFIG_API:
            if p_config['name'] == "All": continue
            col_name = f"{p_config['name'].upper()}_AREA_PERCENTAGE"
            share_val = float(row.get(col_name, 0.0))
            if pd.notna(share_val) and share_val > 0:
                shares.append(PosmBatchShare(provider=p_config['name'], percentage=round(share_val,1)))
                total_percentage += share_val
        
        # Normalize if total_percentage is not 0 and not 100 (can happen if source data isn't normalized per row)
        if total_percentage > 0 and (total_percentage < 99.0 or total_percentage > 101.0) : # Allow some leeway
            shares = [PosmBatchShare(provider=s.provider, percentage=round((s.percentage / total_percentage) * 100, 1)) for s in shares]
            # Adjust to sum to 100
            current_sum = sum(s.percentage for s in shares)
            if shares and current_sum != 100.0:
                shares[0].percentage = round(shares[0].percentage + (100.0 - current_sum),1)


        image_s3_arn = safe_str_convert_posm(row.get('S3_ARN')) # Original image for that batch capture
        # image_url = generate_presigned_url(image_s3_arn) if image_s3_arn else f"https://picsum.photos/seed/{current_profile_id}_{batch_id_str.replace('_','')}/300/200"
        image_url = f"https://picsum.photos/seed/{current_profile_id}_{batch_id_str.replace('_','')}/300/200" # Simplified for now
        
        # Get maxCapturePhase text if available (this is just a display string from the frontend mock)
        # In real data, 'CAPTURE_PHASE' from the row is the numeric phase.
        # We can try to map it back to a label for display.
        phase_label = batch_id_str # Default to batch_id_str
        for b_val, b_label, b_phase_num in [ (b['value'], b['label'], b['phase_num']) for b in [
            {"value": 'batch1_2023_q1', "label": '2023 Q1', "phase_num": 1.0},
            {"value": 'batch2_2023_q2', "label": '2023 Q2', "phase_num": 2.0},
            # ... add all your batch mappings
        ]]:
            if target_phase == b_phase_num:
                phase_label = b_label
                break
        
        return shares if shares else mock_random_provider_shares(), image_url, phase_label


    batch1_shares, batch1_image, _ = get_shares_for_batch(posm_df_all_phases, profileId, batch1Id)
    batch2_shares, batch2_image, batch2_phase_label = get_shares_for_batch(posm_df_all_phases, profileId, batch2Id)
    
    differences: List[Dict[str, Any]] = []
    all_providers_in_comparison = set(s.provider for s in batch1_shares) | set(s.provider for s in batch2_shares)

    for provider_name in all_providers_in_comparison:
        b1_share = next((s.percentage for s in batch1_shares if s.provider == provider_name), 0.0)
        b2_share = next((s.percentage for s in batch2_shares if s.provider == provider_name), 0.0)
        differences.append({"provider": provider_name, "diff": round(b2_share - b1_share, 1)})

    return PosmComparisonData(
        batch1=PosmBatchDetails(image=batch1_image, shares=batch1_shares),
        batch2=PosmBatchDetails(
            image=batch2_image, 
            shares=batch2_shares,
            maxCapturePhase= batch2_phase_label # Use the determined label
        ),
        differences=differences
    )