from __future__ import annotations

import os
import re
from contextlib import asynccontextmanager
from typing import Any

import httpx
import prolife_engine
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .db import SessionLocal, init_db, ping_db, upsert_pdb_index, upsert_structure
from .ml.pipeline import gnn_pipeline
from .models import PdbIndex, Structure

RCSB_PDB_URL = "https://files.rcsb.org/download/{code}.pdb"
PDB_ID_RE = re.compile(r"^[A-Za-z0-9]{4}$")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")


class ProteinCoords(BaseModel):
    coordinates: list[list[float]]
    name: str | None = None
    pdb_id: str | None = None


class GnnInferRequest(BaseModel):
    coordinates: list[list[float]] = Field(min_length=1)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        init_db()
    except Exception as exc:
        print(f"[pro-life] database init skipped: {exc}")
    yield


app = FastAPI(title="PRO-LIFE Engine API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _analysis_or_400(coordinates: list[list[float]]) -> dict[str, Any]:
    try:
        return prolife_engine.compute_analysis(coordinates)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _safe_db(fn) -> None:
    session: Session | None = None
    try:
        session = SessionLocal()
        fn(session)
    except Exception as exc:
        print(f"[pro-life] database write skipped: {exc}")
        if session is not None:
            session.rollback()
    finally:
        if session is not None:
            session.close()


@app.get("/api/v1/health")
def health() -> dict[str, Any]:
    engine_ok = True
    try:
        prolife_engine.compute_centroid([[0.0, 0.0, 0.0]])
    except Exception:
        engine_ok = False
    db_ok = ping_db()
    if engine_ok and db_ok:
        status = "ok"
    elif engine_ok:
        status = "degraded"
    else:
        status = "error"
    return {
        "status": status,
        "engine": engine_ok,
        "database": db_ok,
        "version": "0.1.0",
    }


@app.post("/api/v1/geometry/centroid")
def calculate_centroid(payload: ProteinCoords) -> dict[str, Any]:
    analysis = _analysis_or_400(payload.coordinates)
    return {"centroid": analysis["centroid"]}


@app.post("/api/v1/geometry/analysis")
def geometry_analysis(payload: ProteinCoords) -> dict[str, Any]:
    analysis = _analysis_or_400(payload.coordinates)
    name = payload.name or payload.pdb_id or f"structure-{analysis['count']}-atoms"

    def persist(session: Session) -> None:
        upsert_structure(
            session,
            name=name,
            atom_count=int(analysis["count"]),
            centroid=list(analysis["centroid"]),
            radius_of_gyration=float(analysis["radiusOfGyration"]),
            pdb_id=payload.pdb_id.upper() if payload.pdb_id else None,
        )

    _safe_db(persist)
    return analysis


@app.get("/api/v1/pdb/{code}")
async def fetch_pdb(code: str):
    if not PDB_ID_RE.match(code):
        raise HTTPException(status_code=400, detail="PDB code must be 4 alphanumeric characters.")
    pdb_id = code.upper()
    url = RCSB_PDB_URL.format(code=pdb_id)
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(url)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to reach RCSB: {exc}") from exc

    if response.status_code == 404:
        raise HTTPException(status_code=404, detail=f"PDB {pdb_id} not found at RCSB.")
    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"RCSB returned HTTP {response.status_code} for {pdb_id}.",
        )

    pdb_text = response.text
    atoms = list(prolife_engine.parse_pdb(pdb_text))
    if not atoms:
        raise HTTPException(status_code=422, detail=f"No ATOM/HETATM records parsed in {pdb_id}.")

    def persist(session: Session) -> None:
        upsert_pdb_index(session, pdb_id=pdb_id, atom_count=len(atoms), source="rcsb")

    _safe_db(persist)
    return PlainTextResponse(content=pdb_text, media_type="chemical/x-pdb")


@app.exception_handler(HTTPException)
async def http_exception_handler(_request, exc: HTTPException):
    detail = exc.detail
    if isinstance(detail, str):
        return JSONResponse(status_code=exc.status_code, content={"error": detail, "detail": detail})
    return JSONResponse(status_code=exc.status_code, content={"detail": detail, "error": str(detail)})


@app.get("/api/v1/structures")
def list_structures(limit: int = 50) -> dict[str, Any]:
    session = SessionLocal()
    try:
        rows = (
            session.query(Structure)
            .order_by(Structure.created_at.desc())
            .limit(min(limit, 200))
            .all()
        )
        index_rows = session.query(PdbIndex).order_by(PdbIndex.fetched_at.desc()).limit(50).all()
        return {
            "structures": [
                {
                    "id": row.id,
                    "pdbId": row.pdb_id,
                    "name": row.name,
                    "atomCount": row.atom_count,
                    "centroid": row.centroid,
                    "radiusOfGyration": row.radius_of_gyration,
                    "createdAt": row.created_at.isoformat() if row.created_at else None,
                }
                for row in rows
            ],
            "pdbIndex": [
                {
                    "pdbId": row.pdb_id,
                    "source": row.source,
                    "atomCount": row.atom_count,
                    "fetchedAt": row.fetched_at.isoformat() if row.fetched_at else None,
                }
                for row in index_rows
            ],
        }
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc
    finally:
        session.close()


@app.post("/api/v1/gnn/infer")
def gnn_infer(payload: GnnInferRequest) -> dict[str, Any]:
    return gnn_pipeline.infer(payload.coordinates)
