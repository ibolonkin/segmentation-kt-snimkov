from fastapi import APIRouter

from . import routers

router = APIRouter(prefix="/v1")

router.include_router(routers.files)
router.include_router(routers.auth)