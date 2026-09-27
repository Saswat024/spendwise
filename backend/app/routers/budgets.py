from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from ..db import budgets, transactions
from ..models import BudgetIn, BudgetOut
from ..security import get_current_user_id

router = APIRouter(prefix="/budgets", tags=["budgets"])


async def spent_this_month(user_id: str, category: str) -> float:
    now = datetime.utcnow()
    start = datetime(now.year, now.month, 1)
    end = datetime(now.year + (now.month == 12), now.month % 12 + 1, 1)
    pipeline = [
        {
            "$match": {
                "user_id": user_id,
                "category": category,
                "type": "expense",
                "date": {"$gte": start, "$lt": end},
            }
        },
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]
    rows = [r async for r in transactions.aggregate(pipeline)]
    return rows[0]["total"] if rows else 0.0


async def budget_out(doc: dict) -> BudgetOut:
    spent = await spent_this_month(doc["user_id"], doc["category"])
    return BudgetOut(
        id=str(doc["_id"]),
        category=doc["category"],
        limit=doc["limit"],
        spent=spent,
        over_budget=spent > doc["limit"],
    )


@router.get("", response_model=list[BudgetOut])
async def list_budgets(user_id: str = Depends(get_current_user_id)):
    return [await budget_out(doc) async for doc in budgets.find({"user_id": user_id})]


@router.post("", response_model=BudgetOut, status_code=201)
async def upsert_budget(body: BudgetIn, user_id: str = Depends(get_current_user_id)):
    doc = await budgets.find_one_and_update(
        {"user_id": user_id, "category": body.category},
        {"$set": {"limit": body.limit}},
        upsert=True,
        return_document=True,
    )
    return await budget_out(doc)


@router.delete("/{budget_id}", status_code=204)
async def delete_budget(budget_id: str, user_id: str = Depends(get_current_user_id)):
    result = await budgets.delete_one({"_id": ObjectId(budget_id), "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Budget not found")
