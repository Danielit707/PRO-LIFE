import os
from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from .models import Base, PdbIndex, Structure

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://prolife:prolife@localhost:5432/pro_life",
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def ping_db() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def get_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def upsert_structure(
    session: Session,
    *,
    name: str,
    atom_count: int,
    centroid: list,
    radius_of_gyration: float | None,
    pdb_id: str | None = None,
) -> Structure:
    row = Structure(
        pdb_id=pdb_id,
        name=name,
        atom_count=atom_count,
        centroid=centroid,
        radius_of_gyration=radius_of_gyration,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def upsert_pdb_index(session: Session, pdb_id: str, atom_count: int, source: str = "rcsb") -> PdbIndex:
    existing = session.query(PdbIndex).filter(PdbIndex.pdb_id == pdb_id).one_or_none()
    if existing:
        existing.atom_count = atom_count
        existing.source = source
        session.commit()
        session.refresh(existing)
        return existing
    row = PdbIndex(pdb_id=pdb_id, atom_count=atom_count, source=source)
    session.add(row)
    session.commit()
    session.refresh(row)
    return row
