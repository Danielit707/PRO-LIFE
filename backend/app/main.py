from __future__ import annotations

import os
import re
from datetime import datetime, timezone
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
from .ml.sequence_model import SequenceRejuvenationModel, default_artifact_path, sequence_features
from .models import ModelRun, PdbIndex, Prediction, Structure, TrainingExample

RCSB_PDB_URL = "https://files.rcsb.org/download/{code}.pdb"
PDB_ID_RE = re.compile(r"^[A-Za-z0-9]{4}$")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")


class ProteinCoords(BaseModel):
    coordinates: list[list[float]]
    name: str | None = None
    pdb_id: str | None = None


class GnnInferRequest(BaseModel):
    coordinates: list[list[float]] = Field(min_length=1)


class TrainingExampleInput(BaseModel):
    protein_id: str = Field(min_length=1, max_length=32)
    sequence: str = Field(min_length=1)
    organism: str | None = None
    cell_type: str | None = None
    tissue: str | None = None
    assay: str = Field(min_length=1, max_length=128)
    outcome: float = Field(ge=0.0, le=1.0)
    toxicity: float = Field(default=0.0, ge=0.0, le=1.0)
    evidence_quality: float = Field(default=1.0, ge=0.0, le=1.0)
    source: str = Field(min_length=1, max_length=255)


class TrainingExamplesRequest(BaseModel):
    examples: list[TrainingExampleInput] = Field(min_length=1)


class CandidateInput(BaseModel):
    protein_id: str = Field(min_length=1, max_length=32)
    sequence: str = Field(min_length=1)


class CandidateRankRequest(BaseModel):
    candidates: list[CandidateInput] = Field(min_length=1)


def _model_data(model: BaseModel) -> dict[str, Any]:
    dump = getattr(model, "model_dump", None)
    return dump() if dump else model.dict()


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


@app.post("/api/v1/training/examples")
def add_training_examples(payload: TrainingExamplesRequest) -> dict[str, Any]:
    session = SessionLocal()
    try:
        for example in payload.examples:
            sequence_features(example.sequence)
        rows = [
            TrainingExample(**_model_data(example))
            for example in payload.examples
        ]
        session.add_all(rows)
        session.commit()
        return {"added": len(rows)}
    except ValueError as exc:
        session.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail=f"Training examples were not saved: {exc}") from exc
    finally:
        session.close()


@app.post("/api/v1/training/run")
def run_training() -> dict[str, Any]:
    session = SessionLocal()
    try:
        rows = session.query(TrainingExample).order_by(TrainingExample.id.asc()).all()
        artifact_path = default_artifact_path()
        version = datetime.now(timezone.utc).strftime("baseline-%Y%m%d%H%M%S%f")
        model = SequenceRejuvenationModel()
        metrics = model.fit(
            [
                {
                    "sequence": row.sequence,
                    "outcome": row.outcome,
                    "toxicity": row.toxicity,
                    "evidence_quality": row.evidence_quality,
                }
                for row in rows
            ],
            version,
        )
        model.save(artifact_path)
        run = ModelRun(
            version=version,
            example_count=len(rows),
            metrics=metrics,
            artifact_path=str(artifact_path),
        )
        session.add(run)
        session.commit()
        return {
            "version": version,
            "example_count": len(rows),
            "metrics": metrics,
            "artifact_path": str(artifact_path),
        }
    except ValueError as exc:
        session.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Training failed: {exc}") from exc
    finally:
        session.close()


@app.post("/api/v1/candidates/rank")
def rank_candidates(payload: CandidateRankRequest) -> dict[str, Any]:
    model = SequenceRejuvenationModel(str(default_artifact_path()))
    try:
        ranked = [
            {"protein_id": candidate.protein_id, **model.predict(candidate.sequence)}
            for candidate in payload.candidates
        ]
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    ranked.sort(key=lambda candidate: float(candidate["ranking_score"]), reverse=True)
    return {"model_version": model.version, "candidates": ranked}


@app.post("/api/v1/feedback")
def add_experiment_feedback(payload: TrainingExampleInput) -> dict[str, Any]:
    """Record a reviewed experimental result for the next training run."""
    session = SessionLocal()
    try:
        sequence_features(payload.sequence)
        row = TrainingExample(**_model_data(payload))
        session.add(row)
        session.commit()
        return {"accepted": True, "training_example_id": row.id}
    except ValueError as exc:
        session.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail=f"Feedback was not saved: {exc}") from exc
    finally:
        session.close()


@app.get("/api/v1/training/runs")
def list_training_runs(limit: int = 20) -> dict[str, Any]:
    session = SessionLocal()
    try:
        rows = session.query(ModelRun).order_by(ModelRun.created_at.desc()).limit(min(limit, 100)).all()
        return {
            "runs": [
                {
                    "version": row.version,
                    "exampleCount": row.example_count,
                    "metrics": row.metrics,
                    "artifactPath": row.artifact_path,
                    "createdAt": row.created_at.isoformat() if row.created_at else None,
                }
                for row in rows
            ]
        }
    finally:
        session.close()
