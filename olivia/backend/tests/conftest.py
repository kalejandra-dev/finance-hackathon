"""Configuración común de los tests.

Se ejecuta antes de importar la app: apunta OLIVIA_DB a una base de datos temporal
para que los tests NUNCA escriban en backend/olivia.db (el historial real de compras).
"""
import os
import tempfile
from pathlib import Path

_TEST_DB = Path(tempfile.gettempdir()) / f"olivia_test_{os.getpid()}.db"
_TEST_DB.unlink(missing_ok=True)
os.environ["OLIVIA_DB"] = str(_TEST_DB)
