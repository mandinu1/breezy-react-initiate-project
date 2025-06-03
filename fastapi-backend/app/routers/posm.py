from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any
import pandas as pd

# Ensure your PosmData model here matches the one in app.models.py
from app.models import (
    FetchPosmGeneralResponse, PosmGeneralFiltersState, PosmData, ProviderMetric,
    PosmComparisonData, PosmBatchDetails, PosmBatchShare, FilterOption # Added models used by other endpoints
)
from app.dependencies import get_posm_df
from app.data_loader import filter_by_max_capture_phase
# from app.s3_utils import generate_presigned_url # If needed for image URLs in comparison
import random # For mock data in comparison (if still partially mocked)

router = APIRouter()

PROVIDERS_CONFIG_API = [
    {"value": "all", "label": "All Providers", "name": "All", "key": "all"},
    {"value": "dialog", "label": "Dialog", "name": "Dialog", "key": "dialog"},
    {"value": "mobitel", "label": "Mobitel", "name": "Mobitel", "key": "mobitel"},
    {"value": "airtel", "label": "Airtel", "name": "Airtel", "key": "airtel"},
    {"value": "hutch", "label": "Hutch", "name": "Hutch", "key": "hutch"},
]

def get_provider_name_map():
    return {p["value"]: p["name"] for p in PROVIDERS_CONFIG_API}

def safe_float_convert(value, default=0.0) -> Optional[float]:
    if pd.isna(value):
        return None # Pydantic Optional[float] handles None
    try:
        return float(value)
    except (ValueError, TypeError):
        return default # Or None if that's preferred for conversion errors

def safe_str_convert_posm(value) -> Optional[str]: # Renamed to avoid conflict if imported elsewhere
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

    df = filter_by_max_capture_phase(posm_df_raw, "posm_data")
    if df.empty:
        return FetchPosmGeneralResponse(data=[], count=0, providerMetrics=[])
        
    provider_name_map = get_provider_name_map()

    # Apply provider filter
    if filters.provider and filters.provider != 'all':
        provider_name_filter = provider_name_map.get(filters.provider)
        if provider_name_filter and f"{provider_name_filter.upper()}_AREA_PERCENTAGE" in df.columns:
            # This filter means we only want rows where this specific provider has *some* presence
            df = df[df[f"{provider_name_filter.upper()}_AREA_PERCENTAGE"].fillna(0) > 0]
    
    # Geographic filters (ensure columns exist)
    if filters.province and filters.province != 'all' and 'PROVINCE' in df.columns:
        df = df[df['PROVINCE'].astype(str).str.lower() == filters.province.lower()]
    if filters.district and filters.district != 'all' and 'DISTRICT' in df.columns:
        df = df[df['DISTRICT'].astype(str).str.lower() == filters.district.lower()]
    if filters.dsDivision and filters.dsDivision != 'all' and 'DS_DIVISION' in df.columns:
        df = df[df['DS_DIVISION'].astype(str).str.lower() == filters.dsDivision.lower()]
    if filters.retailerId and filters.retailerId != 'all' and 'PROFILE_ID' in df.columns:
        df = df[df['PROFILE_ID'].astype(str) == filters.retailerId]

    # Visibility Range filtering (applies to the selected provider if one is chosen)
    if filters.provider and filters.provider != 'all' and filters.visibilityRange:
        provider_name_filter = provider_name_map.get(filters.provider)
        if provider_name_filter and f"{provider_name_filter.upper()}_AREA_PERCENTAGE" in df.columns:
            min_vis, max_vis = filters.visibilityRange
            df = df[
                (df[f"{provider_name_filter.upper()}_AREA_PERCENTAGE"].fillna(0) >= min_vis) &
                (df[f"{provider_name_filter.upper()}_AREA_PERCENTAGE"].fillna(0) <= max_vis)
            ]
    
    # POSM Status filter (increase/decrease) - This is complex as it often implies comparison to a previous state or other providers.
    # The frontend mock had this. For a live backend, this needs clear definition.
    # If 'posmStatus' refers to change over time, you'd need data from multiple batches.
    # If it refers to dominance of one provider, the logic would be:
    #   - E.g., if filters.provider is 'Dialog' and filters.posmStatus is 'Increase',
    #     find rows where Dialog's share is highest or significantly higher than others.
    # This part is currently a placeholder for that complex logic.
    # For now, the filter for posmStatus is not applied beyond the provider filter.

    posm_data_list: List[PosmData] = []
    for rowIndex, row in df.iterrows():
        main_provider_for_row = "Unknown"
        visibility_perc_for_row = 0.0
        
        # Determine main provider and its visibility for the row
        # This could be the provider with max area percentage, or based on the filter.
        if filters.provider and filters.provider != 'all':
            provider_name = provider_name_map.get(filters.provider)
            if provider_name and f"{provider_name.upper()}_AREA_PERCENTAGE" in row:
                main_provider_for_row = provider_name
                visibility_perc_for_row = float(row.get(f"{provider_name.upper()}_AREA_PERCENTAGE", 0.0))
        else: # Infer provider if filter is 'all' - e.g., one with max share
            max_share = -1.0
            for p_config in PROVIDERS_CONFIG_API:
                if p_config['name'] == "All": continue
                col_name = f"{p_config['name'].upper()}_AREA_PERCENTAGE"
                current_share = float(row.get(col_name, 0.0))
                if current_share > max_share:
                    max_share = current_share
                    main_provider_for_row = p_config['name']
                    visibility_perc_for_row = max_share
        
        # If still unknown and no specific provider was filtered, it remains "Unknown"
        # or you could assign a default based on any presence.
        if main_provider_for_row == "Unknown": # Check if any provider has presence
            for p_config in PROVIDERS_CONFIG_API:
                 if p_config['name'] == "All": continue
                 col_name = f"{p_config['name'].upper()}_AREA_PERCENTAGE"
                 if float(row.get(col_name, 0.0)) > 0:
                    main_provider_for_row = p_config['name'] # Assign first one found
                    visibility_perc_for_row = float(row.get(col_name, 0.0))
                    break


        item = PosmData(
            id=str(row.get('IMAGE_REF_ID', f"posm_{rowIndex}_{row.get('PROFILE_ID', '')}")),
            retailerId=safe_str_convert_posm(row.get('PROFILE_ID')),
            provider=main_provider_for_row,
            visibilityPercentage=safe_float_convert(visibility_perc_for_row, 0.0) or 0.0,
            DIALOG_AREA_PERCENTAGE=safe_float_convert(row.get('DIALOG_AREA_PERCENTAGE')),
            AIRTEL_AREA_PERCENTAGE=safe_float_convert(row.get('AIRTEL_AREA_PERCENTAGE')),
            MOBITEL_AREA_PERCENTAGE=safe_float_convert(row.get('MOBITEL_AREA_PERCENTAGE')),
            HUTCH_AREA_PERCENTAGE=safe_float_convert(row.get('HUTCH_AREA_PERCENTAGE')),
            PROFILE_NAME=safe_str_convert_posm(row.get('PROFILE_NAME')),
            PROVINCE=safe_str_convert_posm(row.get('PROVINCE')),
            DISTRICT=safe_str_convert_posm(row.get('DISTRICT')),
            originalPosmImageIdentifier=safe_str_convert_posm(row.get('S3_ARN')),
            detectedPosmImageIdentifier=safe_str_convert_posm(row.get('INF_S3_ARN'))
        )
        posm_data_list.append(item)

    # Provider Metrics (Average Visibility Percentage for each provider across filtered data)
    provider_metrics_list: List[ProviderMetric] = []
    # 'df' is already filtered by geo, retailerId etc.
    # If a specific provider was filtered, metrics might be skewed or only for that provider.
    # The frontend expects metrics for all providers. So calculate on 'df' before provider-specific item filtering.
    # However, if 'filters.provider' selected one, then metrics should probably be about that one.
    # The original api.ts mock calculated average percentage for EACH provider from the filtered data.
    
    source_for_metrics = df # Use the dataframe filtered by geo, retailer, and possibly visibility range for a specific provider.

    for p_config in PROVIDERS_CONFIG_API:
        if p_config['name'] == "All":
            continue
        col_name = f"{p_config['name'].upper()}_AREA_PERCENTAGE"
        if col_name in source_for_metrics.columns:
            # Calculate average only from rows where this provider has some presence or from all rows in filtered set
            # Let's consider all rows in the 'source_for_metrics' for calculating average share
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

# --- Other POSM endpoints (fetchPosmComparisonData, fetchAvailableBatches) would go here ---
# These were simplified/mocked previously. You'd need to implement their full logic
# using posm_df_raw (which contains all capture phases).

# Example for fetchAvailableBatches (conceptual, needs posm_df_raw and proper batch mapping)
@router.get("/posm/available-batches/{profile_id}", response_model=List[FilterOption])
async def fetch_available_batches_api(profile_id: str, posm_df_all_phases: pd.DataFrame = Depends(get_posm_df)):
    if posm_df_all_phases.empty or 'PROFILE_ID' not in posm_df_all_phases.columns or 'CAPTURE_PHASE' not in posm_df_all_phases.columns:
        return []
    # Use posm_df_all_phases which is essentially posm_df_raw here
    profile_data = posm_df_all_phases[posm_df_all_phases['PROFILE_ID'].astype(str) == profile_id]
    if profile_data.empty:
        return []
    
    unique_capture_phases = sorted(profile_data['CAPTURE_PHASE'].dropna().unique())
    
    # Mocking batch labels (same as in frontend services/api.ts)
    base_batches = [
        {"value": 'batch1_2023_q1', "label": '2023 Q1', "phase_num": 1.0}, # Assuming phase_num can be float
        {"value": 'batch2_2023_q2', "label": '2023 Q2', "phase_num": 2.0},
        {"value": 'batch3_2023_q3', "label": '2023 Q3', "phase_num": 3.0},
        {"value": 'batch4_2023_q4', "label": '2023 Q4', "phase_num": 4.0},
        {"value": 'batch5_2024_q1', "label": '2024 Q1', "phase_num": 5.0},
    ]
    available_options: List[FilterOption] = []
    for cp_float in unique_capture_phases:
        cp = float(cp_float) # Ensure it's float for comparison
        matched_batch = next((b for b in base_batches if b["phase_num"] == cp), None)
        if matched_batch:
            available_options.append(FilterOption(value=matched_batch["value"], label=matched_batch["label"]))
        else:
            available_options.append(FilterOption(value=f"capture_phase_{int(cp)}", label=f"Capture Phase {int(cp)}"))
    return available_options


# Mocked fetchPosmComparisonData - Requires careful implementation with full dataset
@router.get("/posm/comparison", response_model=PosmComparisonData)
async def fetch_posm_comparison_data_api(
    profileId: str, batch1Id: str, batch2Id: str,
    posm_df_all_phases: pd.DataFrame = Depends(get_posm_df)
):
    # This is a simplified mock. Real implementation would filter posm_df_all_phases
    # by profileId and the two batchIds (mapping batchId string to CAPTURE_PHASE number).
    # Then calculate shares for each batch and differences.
    
    def get_shares_for_batch(df: pd.DataFrame, profile_id: str, batch_value_str: str) -> List[PosmBatchShare]:
        # Find CAPTURE_PHASE matching batch_value_str (e.g. 'batch1_2023_q1' -> 1.0)
        # This mapping needs to be robust.
        # For mock, let's assume phase_num is extractable or hardcoded for mapping
        capture_phase_map_mock = {'batch1_2023_q1': 1.0, 'batch2_2023_q2': 2.0, 'batch3_2023_q3': 3.0, 'batch4_2023_q4': 4.0, 'batch5_2024_q1': 5.0} # expand this
        
        # Find a capture_phase that might correspond to batch_value_str
        # This is a very simplified way to get a phase number for the mock.
        # A real app would have a more direct mapping from batchId to CAPTURE_PHASE.
        target_phase = None
        for k,v in capture_phase_map_mock.items():
            if k.startswith(batch_value_str.split('_')[0]): # e.g. batch1_2023_q1 starts with batch1
                 # Try to find if the key *is* the batchId
                 if k == batch_value_str:
                    target_phase = v
                    break
        # If not found directly, try to guess from a list of known phases
        if target_phase is None and df['CAPTURE_PHASE'].notna().any():
            available_phases = sorted(df['CAPTURE_PHASE'].dropna().unique())
            if batch_value_str == 'batch1_2023_q1' and available_phases: target_phase = available_phases[0]
            elif batch_value_str == 'batch2_2023_q2' and len(available_phases) > 1: target_phase = available_phases[1]
            # etc. This is still very brittle.
            
        if target_phase is None: # Fallback to random shares if no phase found
             return mock_random_provider_shares()


        batch_data = df[(df['PROFILE_ID'].astype(str) == profile_id) & (df['CAPTURE_PHASE'] == target_phase)]
        if batch_data.empty:
            return mock_random_provider_shares() # Mock if no data for that batch

        shares = []
        for p_config in PROVIDERS_CONFIG_API:
            if p_config['name'] == "All": continue
            col_name = f"{p_config['name'].upper()}_AREA_PERCENTAGE"
            if col_name in batch_data.columns:
                # Assuming single row for profile & batch after filtering, or take mean
                share_val = batch_data[col_name].fillna(0).mean()
                if share_val > 0:
                     shares.append(PosmBatchShare(provider=p_config['name'], percentage=round(float(share_val),1)))
        if not shares: return mock_random_provider_shares() # If all shares are 0
        return shares


    batch1_shares = get_shares_for_batch(posm_df_all_phases, profileId, batch1Id)
    batch2_shares = get_shares_for_batch(posm_df_all_phases, profileId, batch2Id)
    
    # For mock image and maxCapturePhase:
    img_base_url = f"https://picsum.photos/seed/{profileId}" # Replace with actual image logic using S3_ARN if available
    # This needs actual S3 ARNs from the specific batch data
    # original_s3_arn_b1 = posm_df_all_phases[...] S3_ARN for batch 1
    # original_s3_arn_b2 = posm_df_all_phases[...] S3_ARN for batch 2
    # batch1_image = generate_presigned_url(original_s3_arn_b1) or f"{img_base_url}_{batch1Id}/300/200"
    # batch2_image = generate_presigned_url(original_s3_arn_b2) or f"{img_base_url}_{batch2Id}/300/200"
    batch1_image = f"{img_base_url}_{batch1Id.replace('_','')}/300/200"
    batch2_image = f"{img_base_url}_{batch2Id.replace('_','')}/300/200"
    
    mock_capture_phases_display = ["Initial Survey", "Data Verification", "Final Review", "Analysis Complete"]


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
            maxCapturePhase=random.choice(mock_capture_phases_display) # This should be specific to batch2Id actual data
        ),
        differences=differences
    )

# (Helper for mock data if needed by comparison if real data isn't found)
def mock_random_provider_shares() -> List[PosmBatchShare]:
    actual_providers = [p for p in PROVIDERS_CONFIG_API if p["key"] != "all"]
    num_providers_to_select = random.randint(1, min(len(actual_providers), 4))
    selected_providers = random.sample(actual_providers, num_providers_to_select)
    
    shares_val = [random.random() + 0.01 for _ in selected_providers] # ensure not all zero
    total_share = sum(shares_val)
    if total_share == 0: total_share = 1 # Avoid division by zero
        
    normalized_shares = [round((s / total_share) * 100, 1) for s in shares_val]

    sum_normalized = sum(normalized_shares)
    if sum_normalized != 100.0 and normalized_shares:
        diff = 100.0 - sum_normalized
        normalized_shares[0] = round(normalized_shares[0] + diff, 1)
        if normalized_shares[0] < 0: # basic clamp
            # This simple adjustment might make other shares invalid, for mock this might be okay
            others_sum = sum(normalized_shares[1:])
            normalized_shares[0] = max(0, 100 - others_sum)


    return [
        PosmBatchShare(provider=sp["name"], percentage=ns)
        for sp, ns in zip(selected_providers, normalized_shares) if ns >= 0 # ensure positive
    ]