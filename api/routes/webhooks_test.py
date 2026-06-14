from fastapi import APIRouter, Depends
from pydantic import BaseModel

from api.deps import require_api_key
from api.services import webhooks

router = APIRouter(prefix="/v1/webhooks", tags=["Webhooks"])


class TestWebhookRequest(BaseModel):
    url: str


@router.post("/test")
async def test_webhook(body: TestWebhookRequest, _key: dict = Depends(require_api_key)):
    """Fire a test ping to verify a webhook endpoint is reachable."""
    success = await webhooks.fire_webhook(
        url=body.url,
        event="webhook.test",
        payload={"message": "Gantry webhook test — if you see this, delivery works."},
    )
    return {"delivered": success, "url": body.url}
