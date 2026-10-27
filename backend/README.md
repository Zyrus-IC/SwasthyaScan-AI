"""
SwasthyaScan AI ”” FastAPI Backend
================================
Stage 5: Backend Foundation

Endpoints
---------
GET  /health                    ”” service & model status
GET  /api/model-status          ”” model availability detail
POST /api/screening/analyze     ”” submit X-ray + symptoms for analysis

Architecture
------------
app/
  main.py          ”” FastAPI app, CORS, router registration
  core/
    config.py      ”” settings via pydantic-settings
    logging.py     ”” safe structured logging
  schemas/
    health.py      ”” health-response models
    screening.py   ”” request / response models
  api/
    health.py      ”” health & model-status routes
    screening.py   ”” screening-analysis route
  services/
    image_service.py   ”” image validation and decoding
    reliability.py     ”” reliability-engine (Stage 8 placeholder)
"""

