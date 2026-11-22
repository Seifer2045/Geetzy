"""Payments: unlock the HD video."""
from fastapi import APIRouter, Depends, HTTPException

from .. import pipeline
from ..auth import AuthUser, current_user
from ..config import get_settings
from ..db import db
from ..schemas import Gift, VerifyPaymentInput
from .common import ensure_active, own_gift, to_gift

router = APIRouter()


@router.post("/payments/verify", response_model=Gift, response_model_by_alias=True)
def verify_payment(body: VerifyPaymentInput, user: AuthUser = Depends(current_user)):
    row = own_gift(body.gift_id, user)
    if row["status"] == "paid":
        return to_gift(row)
    if row["status"] != "preview_ready":
        raise HTTPException(409, "The video is not ready yet.")
    ensure_active(user)
    # Admin-granted free videos / unlimited plan: skip payment.
    used = db().rpc("consume_credit", {"p_user_id": user.id}).execute().data
    if used in ("credit", "unlimited"):
        pipeline.mark_paid(row, provider="credit", purchase_token=None, amount_inr=0)
        return to_gift(own_gift(body.gift_id, user))
    if not get_settings().allow_fake_payments:
        # TODO: verify body.purchase_token with the Google Play Developer API.
        raise HTTPException(501, "Payments are not set up yet.")
    pipeline.mark_paid(row, provider="fake", purchase_token=body.purchase_token)
    return to_gift(own_gift(body.gift_id, user))
