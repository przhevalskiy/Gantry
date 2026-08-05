from fastapi import APIRouter, Depends

from api.deps import require_scope
from api.repositories import usage as usage_repo

router = APIRouter(prefix="/v1/usage", tags=["Usage"])


@router.get("")
async def get_usage(key: dict = Depends(require_scope("admin"))):
    return await usage_repo.get_usage(org_id=key["org_id"])
