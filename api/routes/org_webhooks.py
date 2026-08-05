from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.deps import require_scope
from api.repositories import usage as usage_repo
from api.repositories import webhooks as webhooks_repo

router = APIRouter(prefix="/v1/webhooks", tags=["Webhooks"])


class RegisterWebhookRequest(BaseModel):
    url: str
    events: list[str] = Field(
        default_factory=lambda: [
            "task.queued",
            "task.started",
            "task.waiting_approval",
            "task.completed",
            "task.failed",
        ],
        description="Events to subscribe to",
    )


class TestWebhookRequest(BaseModel):
    url: str


@router.post("", status_code=201)
async def register_webhook(body: RegisterWebhookRequest, key: dict = Depends(require_scope("admin"))):
    hook = await webhooks_repo.register_webhook(
        org_id=key["org_id"],
        url=body.url,
        events=body.events,
    )
    return {"webhook": hook}


@router.get("")
async def list_webhooks(key: dict = Depends(require_scope("admin"))):
    hooks = await webhooks_repo.list_webhooks(org_id=key["org_id"])
    return {"webhooks": hooks}


@router.delete("/{webhook_id}", status_code=204)
async def revoke_webhook(webhook_id: str, key: dict = Depends(require_scope("admin"))):
    if not await webhooks_repo.revoke_webhook(webhook_id, org_id=key["org_id"]):
        raise HTTPException(status_code=404, detail="webhook not found")


@router.post("/test")
async def test_webhook(body: TestWebhookRequest, _key: dict = Depends(require_scope("admin"))):
    from api.services import webhooks as webhook_service

    success = await webhook_service.fire_webhook(
        url=body.url,
        event="webhook.test",
        payload={"message": "Gantry webhook test — if you see this, delivery works."},
    )
    return {"delivered": success, "url": body.url}
