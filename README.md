# PRO-LIFE

PRO-LIFE is a research-oriented protein analysis platform. Its long-term purpose
is to analyze protein structures and sequences, estimate their potential
relationship to rejuvenation-related outcomes, and eventually suggest promising
proteins or candidates from known biological information and learned patterns.

The project is an exploratory decision-support system, not a medical device and
not evidence that a protein can rejuvenate an organism. Model scores are
hypotheses that require expert review, controlled experiments, safety assessment,
and reproducible evidence.

## Current capabilities

The current application provides:

- 3D protein coordinate input through built-in samples, raw coordinates, PDB IDs,
  and uploaded files.
- PDB retrieval through the RCSB Protein Data Bank.
- High-performance centroid, radius-of-gyration, maximum-distance, and bounding-box
  calculations through a C++ extension.
- Interactive 3D visualization with Three.js.
- A FastAPI backend with PostgreSQL persistence.
- A transparent baseline sequence model that estimates:
  - `benefit_score`: estimated rejuvenation-related outcome.
  - `toxicity_risk`: estimated toxicity-related risk.
  - `uncertainty`: an estimate of model uncertainty.
  - `ranking_score`: a combined ranking value.
- An initial feedback/training workflow for adding reviewed experimental results,
  retraining the baseline, and ranking supplied candidate sequences.

The current sequence model is intentionally simple. It uses amino-acid
composition, sequence length, hydrophobic fraction, and charged-residue fraction.
It is designed to make the training process inspectable and replaceable, not to
serve as a validated biological predictor.

## Architecture

```text
Browser
  |
  | Next.js, React, TypeScript, Tailwind CSS, Three.js
  v
Frontend container (:3000)
  |
  | /api/* rewrite
  v
Backend container (:8000)
  |
  +-- FastAPI routes and Pydantic validation
  +-- SQLAlchemy/PostgreSQL persistence
  +-- HTTPX requests to RCSB PDB
  +-- Python binding to the C++ engine
  |
  v
C++/pybind11 geometry and PDB engine

PostgreSQL container (:5432)
```

## Repository layout

```text
backend/
  app/
    api/                 Future API modules
    ml/                  Sequence model and graph pipeline
    models/              Future model-specific modules
    pipelines/           Future data/training pipelines
    db.py                SQLAlchemy engine and persistence helpers
    main.py              FastAPI application and routes
  csrc/                  Future backend-native source files
  Dockerfile
  pyproject.toml
  requirements.txt
  requirements-ml.txt
  setup.py

database/                Future database migrations/seeds

engine_cpp/
  include/
  src/
    geometry.cpp         pybind11 geometry/PDB extension
  tests/                 Future C++ tests
  CMakeLists.txt

frontend/
  src/
    components/          React UI components
    data/                Built-in sample structures
    pages/               Next.js Pages Router
    services/             Future frontend API/service modules
    styles/               Global Tailwind stylesheet
    utils/                PDB and coordinate parsers
    types.ts             Shared frontend types
  Dockerfile
  package.json
  tsconfig.json

docker-compose.yml
docs/
```

## Frontend

The frontend is a Next.js 14 application using the Pages Router.

Important files:

- `frontend/src/pages/index.tsx`: main PRO-LIFE interface.
- `frontend/src/pages/_app.tsx`: imports global CSS.
- `frontend/src/components/viewport3D.tsx`: Three.js molecular viewport.
- `frontend/src/components/coordinateInput.tsx`: sample, PDB, raw-coordinate,
  and file-upload input.
- `frontend/src/components/metricsOverview.tsx`: displays analysis metrics.
- `frontend/src/components/apiInspector.tsx`: displays the geometry API payload.
- `frontend/src/styles/globals.css`: Tailwind base, components, and utilities.

The frontend dependencies include:

- React and React DOM for UI rendering.
- Next.js for routing and bundling.
- TypeScript for static typing.
- Tailwind CSS and PostCSS for styling.
- Three.js for WebGL-based 3D rendering.
- `lucide-react` for interface icons.
- `pdbe-molstar`/Mol* dependencies for future molecular visualization work.

Next.js rewrites browser requests such as:

```text
/api/v1/geometry/analysis
```

to the backend service:

```text
http://backend:8000/api/v1/geometry/analysis
```

## Backend API

The backend is a FastAPI application in `backend/app/main.py`.

### Structure and geometry

```text
GET  /api/v1/health
POST /api/v1/geometry/centroid
POST /api/v1/geometry/analysis
GET  /api/v1/pdb/{code}
GET  /api/v1/structures
```

`POST /api/v1/geometry/analysis` accepts:

```json
{
  "coordinates": [
    [0.0, 0.0, 0.0],
    [1.3, 1.1, 1.5]
  ],
  "name": "optional structure name",
  "pdb_id": "optional PDB ID"
}
```

It returns the centroid, atom count, radius of gyration, maximum distance from
the centroid, and bounding-box dimensions.

`GET /api/v1/pdb/{code}` validates a four-character PDB code, downloads the PDB
file from RCSB, parses its `ATOM`/`HETATM` records through the native engine,
and returns the PDB text.

### Baseline learning and feedback

The current learning workflow is:

```text
1. Add reviewed examples or experimental feedback.
2. Train a new model version.
3. Rank explicitly supplied candidate sequences.
4. Review results and perform experiments.
5. Add the new results as feedback.
6. Train again.
```

Current endpoints:

```text
POST /api/v1/training/examples
POST /api/v1/training/run
POST /api/v1/candidates/rank
POST /api/v1/feedback
GET  /api/v1/training/runs
```

Training examples contain:

- Protein identifier
- Amino-acid sequence
- Organism, cell type, and tissue context
- Assay name
- Outcome score
- Toxicity score
- Evidence quality
- Source

The model does not silently update after a prediction. New evidence is stored,
and a separate training run creates a new versioned artifact. This is safer and
more reproducible than changing production weights immediately after one report.

The current model artifact is written under `backend/models/`, or under the
directory configured by `MODEL_DIR`.

### Current limitations of the learning API

The feedback and training endpoints are an early baseline and should not yet be
exposed to the public internet. Before production use, they need:

- Authentication and authorization.
- Researcher roles and explicit permissions.
- Audit logs recording who submitted or approved evidence.
- Dataset versioning and provenance checks.
- Duplicate and conflict handling for contradictory results.
- Review or approval workflows before data enters a training run.
- Rate limiting and input-size limits.
- Secure secret and database configuration.
- Model rollback and promotion controls.

In particular, a user should not be able to submit arbitrary feedback and
immediately influence a production model. A safer workflow is:

```text
Researcher submits result
        |
        v
Evidence is stored as pending
        |
        v
Authorized reviewer verifies source, assay, and result
        |
        v
Evidence is marked approved
        |
        v
A controlled training job creates a candidate model
        |
        v
Metrics and review approve or reject promotion
```

## Future protein suggestion system

The long-term goal is to suggest proteins or sequences based on known information
and learned patterns. The intended workflow is:

```text
Known literature, curated databases, and approved experiments
        |
        v
Normalized evidence and provenance
        |
        v
Sequence and structure features
        |
        v
Candidate generation
        |
        v
Benefit, toxicity, uncertainty, and novelty scoring
        |
        v
Human review and experimental prioritization
```

Candidate suggestions should include explanations such as:

- Which training examples or sources influenced the ranking.
- Which sequence or structural features were important.
- How similar the candidate is to known proteins.
- Expected benefit and toxicity risk.
- Uncertainty and out-of-distribution warnings.
- The model and dataset versions used.

The current `/api/v1/candidates/rank` endpoint only ranks candidates supplied by
the caller. It does not yet discover new proteins automatically. Candidate
generation, external database ingestion, embeddings, structure-aware learning,
and human approval are future work.

The repository also contains a graph pipeline stub at
`backend/app/ml/pipeline.py`. It can construct a distance graph from coordinates,
but it does not currently load trained PyTorch Geometric weights.

## Native engine

The C++ engine in `engine_cpp/src/geometry.cpp` is compiled as the
`prolife_engine` Python extension using pybind11 and C++17.

It exposes:

```text
compute_centroid()
compute_analysis()
parse_pdb()
```

`compute_analysis()` calculates:

- Centroid
- Coordinate count
- Radius of gyration
- Maximum distance from centroid
- Bounding-box minimum and maximum
- Bounding-box dimensions

Keeping these operations in C++ provides a fast native implementation while
allowing the FastAPI application to call them as ordinary Python functions.

## Running with Docker

Requirements:

- Docker Desktop with the Linux engine running.

Start the complete stack:

```powershell
cd D:\proyects2\pro-life
docker compose up --build
```

Services:

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- FastAPI documentation: http://localhost:8000/docs
- Health endpoint: http://localhost:8000/api/v1/health
- PostgreSQL: localhost:5432

Useful commands:

```powershell
docker compose ps
docker compose logs -f frontend
docker compose logs -f backend
docker compose build --no-cache frontend
docker compose up -d --force-recreate frontend
docker compose exec frontend npm ls three
```

## Safety and scientific use

PRO-LIFE is intended to organize hypotheses and prioritize research, not to
replace biological validation. A high score is not proof of efficacy, and a low
score is not proof of safety or ineffectiveness.

Any real-world use should include qualified scientific review, appropriate
biosafety and ethics procedures, controlled experiments, negative results, and
complete provenance for every training example. Experimental feedback should be
reviewed before it is allowed to influence a future model version.

## Development roadmap

1. Add authentication, researcher roles, reviewer approval, and audit logging.
2. Add a pending/approved/rejected evidence lifecycle.
3. Add dataset and model version management with rollback.
4. Add tests for geometry, PDB parsing, training, ranking, and feedback.
5. Replace the baseline sequence features with validated sequence embeddings.
6. Add structure-aware models using the coordinate graph pipeline.
7. Add curated literature and biological database ingestion.
8. Implement explainable candidate generation and suggestion.
9. Add uncertainty, out-of-distribution, toxicity, and novelty safeguards.
10. Add a human-reviewed experiment planning workflow.
