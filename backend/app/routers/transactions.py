from datetime import date, datetime
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query

from ..db import transactions
from ..models import TransactionIn, TransactionOut, TransactionPage, TxType
from ..security import get_current_user_id

router = APIRouter(prefix="/transactions", tags=["transactions"])


def tx_out(doc: dict) -> TransactionOut:
    return TransactionOut(
        id=str(doc["_id"]),
        amount=doc["amount"],
        type=doc["type"],
        category=doc["category"],
        merchant=doc.get("merchant"),
        note=doc.get("note"),
        date=doc["date"].date() if isinstance(doc["date"], datetime) else doc["date"],
    )


def month_range(month: str) -> tuple[datetime, datetime]:
    start = datetime.strptime(month, "%Y-%m")
    end = datetime(start.year + (start.month == 12), start.month % 12 + 1, 1)
    return start, end


@router.get("", response_model=TransactionPage)
async def list_transactions(
    user_id: str = Depends(get_current_user_id),
    category: Optional[str] = None,
    type: Optional[TxType] = None,
    start: Optional[date] = None,
    end: Optional[date] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    q: dict = {"user_id": user_id}
    if category:
        q["category"] = category
    if type:
        q["type"] = type
    if start or end:
        q["date"] = {}
        if start:
            q["date"]["$gte"] = datetime.combine(start, datetime.min.time())
        if end:
            q["date"]["$lte"] = datetime.combine(end, datetime.max.time())
    if search:
        q["$or"] = [
            {"merchant": {"$regex": search, "$options": "i"}},
            {"note": {"$regex": search, "$options": "i"}},
            {"category": {"$regex": search, "$options": "i"}},
        ]
    total = await transactions.count_documents(q)
    cursor = (
        transactions.find(q)
        .sort("date", -1)
        .skip((page - 1) * page_size)
        .limit(page_size)
    )
    items = [tx_out(doc) async for doc in cursor]
    return TransactionPage(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=TransactionOut, status_code=201)
async def create_transaction(body: TransactionIn, user_id: str = Depends(get_current_user_id)):
    doc = body.model_dump()
    doc["date"] = datetime.combine(body.date, datetime.min.time())
    doc["user_id"] = user_id
    result = await transactions.insert_one(doc)
    doc["_id"] = result.inserted_id
    return tx_out(doc)


@router.put("/{tx_id}", response_model=TransactionOut)
async def update_transaction(
    tx_id: str, body: TransactionIn, user_id: str = Depends(get_current_user_id)
):
    doc = body.model_dump()
    doc["date"] = datetime.combine(body.date, datetime.min.time())
    result = await transactions.find_one_and_update(
        {"_id": ObjectId(tx_id), "user_id": user_id},
        {"$set": doc},
        return_document=True,
    )
    if not result:
        raise HTTPException(404, "Transaction not found")
    return tx_out(result)


@router.delete("/{tx_id}", status_code=204)
async def delete_transaction(tx_id: str, user_id: str = Depends(get_current_user_id)):
    result = await transactions.delete_one({"_id": ObjectId(tx_id), "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Transaction not found")


@router.get("/summary")
async def summary(month: str = Query(..., pattern=r"^\d{4}-\d{2}$"), user_id: str = Depends(get_current_user_id)):
    start, end = month_range(month)
    pipeline = [
        {"$match": {"user_id": user_id, "date": {"$gte": start, "$lt": end}}},
        {"$group": {"_id": {"type": "$type", "category": "$category"}, "total": {"$sum": "$amount"}}},
    ]
    income = 0.0
    expense = 0.0
    by_category: dict[str, float] = {}
    async for row in transactions.aggregate(pipeline):
        if row["_id"]["type"] == "income":
            income += row["total"]
        else:
            expense += row["total"]
            by_category[row["_id"]["category"]] = by_category.get(row["_id"]["category"], 0) + row["total"]
    return {
        "month": month,
        "income": income,
        "expense": expense,
        "net": income - expense,
        "by_category": [{"category": k, "total": v} for k, v in sorted(by_category.items(), key=lambda kv: -kv[1])],
    }


@router.get("/trend")
async def trend(months: int = Query(6, ge=2, le=24), user_id: str = Depends(get_current_user_id)):
    now = datetime.utcnow().replace(day=1)
    start = datetime(now.year, now.month, 1)
    for _ in range(months - 1):
        start = datetime(start.year - (start.month == 1), 12 if start.month == 1 else start.month - 1, 1)
    pipeline = [
        {"$match": {"user_id": user_id, "date": {"$gte": start}}},
        {
            "$group": {
                "_id": {"y": {"$year": "$date"}, "m": {"$month": "$date"}, "type": "$type"},
                "total": {"$sum": "$amount"},
            }
        },
        {"$sort": {"_id.y": 1, "_id.m": 1}},
    ]
    buckets: dict[str, dict] = {}
    async for row in transactions.aggregate(pipeline):
        key = f"{row['_id']['y']:04d}-{row['_id']['m']:02d}"
        buckets.setdefault(key, {"month": key, "income": 0.0, "expense": 0.0})
        buckets[key][row["_id"]["type"]] = row["total"]
    return list(buckets.values())
