# Retailer Brand Presence Dashboard

This project is a full-stack application designed to display and analyze retailer brand presence data. It consists of a FastAPI backend and a React frontend.

## Project Structure

- `fastapi-backend/`: The Python backend built with FastAPI.
- `frontend-retail-dashboard/`: The React frontend built with Vite.

## Getting Started

### Prerequisites

- Python 3.8+
- Node.js 18+

### Backend Setup (fastapi-backend)

1.  **Navigate to the backend directory:**
    ```bash
    cd fastapi-backend
    ```
2.  **Create a virtual environment:**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
    ```
3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
4.  **Create a `.env` file** in the `fastapi-backend/app` directory for your environment variables. This is where you will store your AWS credentials.
    ```
    AWS_ACCESS_KEY_ID="YOUR_AWS_ACCESS_KEY_ID"
    AWS_SECRET_ACCESS_KEY="YOUR_AWS_SECRET_ACCESS_KEY"
    ```
5.  **Run the backend server:**
    ```bash
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    ```
    The backend will be available at `http://localhost:8000`.

### Frontend Setup (frontend-retail-dashboard)

1.  **Navigate to the frontend directory:**
    ```bash
    cd frontend-retail-dashboard
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Run the frontend development server:**
    ```bash
    npm run dev
    ```
    The frontend will be available at `http://localhost:5173`.

## Code Overview

### Backend

-   **`main.py`**: The main entry point for the FastAPI application.
-   **`routers/`**: Contains the API endpoints for different resources.
-   **`models.py`**: Defines the Pydantic models for data validation.
-   **`data_loader.py`**: Handles loading data from the CSV files in the `data/` directory.

### Frontend

-   **`App.tsx`**: The main React component, handling routing and layout.
-   **`pages/`**: Contains the main views of the dashboard.
-   **`components/`**: Reusable React components.
-   **`services/api.ts`**: Functions for making API calls to the backend.
-   **`types.ts`**: TypeScript type definitions.