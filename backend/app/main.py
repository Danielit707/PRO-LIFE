from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import prolife_engine  # Compiled C++ extension module

app = FastAPI(title="PRO-LIFE Engine API", version="0.1.0")

class ProteinCoords(BaseModel):
    coordinates: list[list[float]]

@app.post("/api/v1/geometry/centroid")
async def calculate_centroid(payload: ProteinCoords):
    if not payload.coordinates:
        raise HTTPException(status_code=400, detail="Coordinate list cannot be empty.")
    
    # Direct execution in C++
    result = prolife_engine.compute_centroid(payload.coordinates)
    return {"centroid": result}