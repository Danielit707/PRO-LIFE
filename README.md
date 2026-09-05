## Automatic protein-learning loop

The backend now provides a transparent baseline active-learning loop:

1. Submit reviewed evidence to `POST /api/v1/training/examples`.
2. Train from all stored evidence with `POST /api/v1/training/run`.
3. Rank candidate sequences with `POST /api/v1/candidates/rank`.
4. Submit validated experimental results to `POST /api/v1/feedback`.
5. Retrain after new feedback arrives.

The baseline uses amino-acid composition features and a dependency-free linear
model. Its scores are hypotheses, not evidence of rejuvenation. Include failed
experiments and review candidates before any biological work. The model artifact
is written to `backend/models/` (or `MODEL_DIR` when configured).