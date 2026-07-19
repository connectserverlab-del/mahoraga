"""
Allow running build package as module: python -m bos_build
"""
from .mahoraga import app

if __name__ == "__main__":
    app()
