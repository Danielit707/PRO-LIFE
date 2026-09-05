from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, UniqueConstraint, func
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
