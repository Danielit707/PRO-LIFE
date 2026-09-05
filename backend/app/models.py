from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Structure(Base):
    __tablename__ = "structures"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pdb_id: Mapped[str | None] = mapped_column(String(8), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    atom_count: Mapped[int] = mapped_column(Integer, nullable=False)
    centroid: Mapped[list] = mapped_column(JSONB, nullable=False)
    radius_of_gyration: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PdbIndex(Base):
    __tablename__ = "pdb_index"
    __table_args__ = (UniqueConstraint("pdb_id", name="uq_pdb_index_pdb_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pdb_id: Mapped[str] = mapped_column(String(8), nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(64), nullable=False, default="rcsb")
    atom_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TrainingExample(Base):
    __tablename__ = "training_examples"
    __table_args__ = (
        UniqueConstraint("protein_id", "assay", "source", name="uq_training_example_source"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    protein_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    sequence: Mapped[str] = mapped_column(Text, nullable=False)
    organism: Mapped[str | None] = mapped_column(String(128), nullable=True)
    cell_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    tissue: Mapped[str | None] = mapped_column(String(128), nullable=True)
    assay: Mapped[str] = mapped_column(String(128), nullable=False)
    outcome: Mapped[float] = mapped_column(Float, nullable=False)
    toxicity: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    evidence_quality: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    source: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ModelRun(Base):
    __tablename__ = "model_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    version: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    example_count: Mapped[int] = mapped_column(Integer, nullable=False)
    metrics: Mapped[dict] = mapped_column(JSONB, nullable=False)
    artifact_path: Mapped[str] = mapped_column(String(512), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    model_version: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    protein_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    benefit_score: Mapped[float] = mapped_column(Float, nullable=False)
    toxicity_risk: Mapped[float] = mapped_column(Float, nullable=False)
    uncertainty: Mapped[float] = mapped_column(Float, nullable=False)
    ranking_score: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
