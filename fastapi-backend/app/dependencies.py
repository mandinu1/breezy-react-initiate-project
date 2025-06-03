from .data_loader import get_board_data, get_posm_data

def get_boards_df():
    return get_board_data()

def get_posm_df():
    return get_posm_data()