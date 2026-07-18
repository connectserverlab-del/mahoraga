"""Product registry — one package per product.

Adding a product: create products/<id>/product.py with a
ProductDescriptor.define() call (plus its ServerBundle definitions),
import it below, and run `mahoraga product doctor` until green.
"""

from typing import Dict

from ..core.products import ProductDescriptor
from .mahoraga.product import MAHORAGA_PRODUCT, MAHORAGA_SERVER_BUNDLE
from .browserclaw.product import (
    BROWSERCLAW_PRODUCT,
    BROWSERCLAW_RUST_SERVER_BUNDLE,
    BROWSERCLAW_SERVER_BUNDLE,
)

DEFAULT_PRODUCT_ID = MAHORAGA_PRODUCT.id

PRODUCTS: Dict[str, ProductDescriptor] = {}
for _product in (MAHORAGA_PRODUCT, BROWSERCLAW_PRODUCT):
    if _product.id in PRODUCTS:
        raise ValueError(f"Duplicate product id: {_product.id}")
    PRODUCTS[_product.id] = _product

SERVER_BUNDLES = (MAHORAGA_SERVER_BUNDLE, BROWSERCLAW_SERVER_BUNDLE)

__all__ = [
    "DEFAULT_PRODUCT_ID",
    "PRODUCTS",
    "SERVER_BUNDLES",
    "MAHORAGA_PRODUCT",
    "BROWSERCLAW_PRODUCT",
    "BROWSERCLAW_RUST_SERVER_BUNDLE",
]
