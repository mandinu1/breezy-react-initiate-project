import pandas as pd
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parent / "data"
BOARD_CSV = DATA_PATH / "board.csv"
POSM_CSV = DATA_PATH / "posm.csv"

# Store data in memory (simple cache)
_board_df = None
_posm_df = None

def load_dataframes():
    global _board_df, _posm_df
    if _board_df is None:
        try:
            _board_df = pd.read_csv(BOARD_CSV)
            # Basic preprocessing similar to host (4).py if needed
            # e.g., convert date columns, handle NaNs for key columns
            _board_df['FETCHED_DATE'] = pd.to_datetime(_board_df['FETCHED_DATE'], errors='coerce')
            _board_df['RECEIVED_DATE'] = pd.to_datetime(_board_df['RECEIVED_DATE'], errors='coerce')
        except FileNotFoundError:
            print(f"Error: {BOARD_CSV} not found.")
            _board_df = pd.DataFrame()
    
    if _posm_df is None:
        try:
            if _posm_df is None:
                _posm_df = pd.read_csv(POSM_CSV)
                _posm_df.columns = _posm_df.columns.str.strip()
                
                # --- FIX: Specify the exact format for the date/time columns ---
                # This format string tells pandas to expect Minutes:Seconds.Microseconds
                time_format = "%M:%S.%f"

                # Apply the conversion with the specified format
                _posm_df['FETCHED_DATE'] = pd.to_datetime(_posm_df['FETCHED_DATE'], format=time_format, errors='coerce')
                _posm_df['RECEIVED_DATE'] = pd.to_datetime(_posm_df['RECEIVED_DATE'], format=time_format, errors='coerce')
            
        except FileNotFoundError:
            print(f"Error: {POSM_CSV} not found.")
            _posm_df = pd.DataFrame()
            
    return _board_df.copy() if _board_df is not None else pd.DataFrame(), \
           _posm_df.copy() if _posm_df is not None else pd.DataFrame()

def get_board_data():
    df, _ = load_dataframes()
    return df

def get_posm_data():
    _, df = load_dataframes()
    return df




def filter_by_max_capture_phase(df: pd.DataFrame, df_name_for_log=""):
    if df is None or df.empty:
        return pd.DataFrame()
    
    df_copy = df.copy()
    if 'CAPTURE_PHASE' not in df_copy.columns:
        return df_copy

    max_capture_phase_val = df_copy['CAPTURE_PHASE'].dropna().max()
    if pd.isna(max_capture_phase_val):
        return df_copy 
    
    df_copy['CAPTURE_PHASE'] = df_copy['CAPTURE_PHASE'].fillna(max_capture_phase_val)
    filtered_df = df_copy[df_copy['CAPTURE_PHASE'] == max_capture_phase_val]
    return filtered_df