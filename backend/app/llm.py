"""Groq (openai/gpt-oss-120b) chat with tool-calling over MongoDB aggregations.

Uses Groq's OpenAI-compatible chat completions endpoint. The final answer is
streamed to the client as Server-Sent Events.
"""

import json
from datetime import datetime
from typing import Any, AsyncGenerator

import httpx

from .config import settings
from .db import budgets, transactions

CHAT_URL = f"{settings.llm_base_url}/chat/completions"

SYSTEM_PROMPT = (
    "You are SpendWise, a concise personal-finance assistant. Answer questions "
    "about the user's spending using the provided tools. Today's date is {today}. "
    "The user's currency is Indian Rupees (INR / ₹). Format currency amounts using the ₹ symbol (e.g. ₹500, ₹1,200). "
    "When a tool returns chart data, keep it and reference it in your reply. "
    "Be brief, use the user's currency amounts as-is, and never invent numbers."
)

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_spending_by_category",
            "description": "Total spending per expense category for a given month (YYYY-MM).",
            "parameters": {
                "type": "object",
                "properties": {"month": {"type": "string", "description": "YYYY-MM"}},
                "required": ["month"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_top_merchants",
            "description": "Top merchants by total spend for a given month (YYYY-MM).",
            "parameters": {
                "type": "object",
                "properties": {
                    "month": {"type": "string"},
                    "limit": {"type": "integer", "default": 5},
                },
                "required": ["month"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compare_months",
            "description": "Compare total income and expense between two months (YYYY-MM).",
            "parameters": {
                "type": "object",
                "properties": {"month_a": {"type": "string"}, "month_b": {"type": "string"}},
                "required": ["month_a", "month_b"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_budget",
            "description": "Set a monthly spending limit for a category.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {"type": "string"},
                    "limit": {"type": "number"},
                },
                "required": ["category", "limit"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "forecast_next_month",
            "description": "Forecast next month's expense from the average of recent months.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]


def _month_bounds(month: str) -> tuple[datetime, datetime]:
    start = datetime.strptime(month, "%Y-%m")
    end = datetime(start.year + (start.month == 12), start.month % 12 + 1, 1)
    return start, end


async def _sum_by_type(user_id: str, start: datetime, end: datetime) -> dict[str, float]:
    pipeline = [
        {"$match": {"user_id": user_id, "date": {"$gte": start, "$lt": end}}},
        {"$group": {"_id": "$type", "total": {"$sum": "$amount"}}},
    ]
    out = {"income": 0.0, "expense": 0.0}
    async for row in transactions.aggregate(pipeline):
        out[row["_id"]] = row["total"]
    return out


async def run_tool(user_id: str, name: str, args: dict[str, Any]) -> dict[str, Any]:
    if name == "get_spending_by_category":
        start, end = _month_bounds(args["month"])
        pipeline = [
            {"$match": {"user_id": user_id, "type": "expense", "date": {"$gte": start, "$lt": end}}},
            {"$group": {"_id": "$category", "total": {"$sum": "$amount"}}},
            {"$sort": {"total": -1}},
        ]
        data = [
            {"category": r["_id"], "total": r["total"]}
            async for r in transactions.aggregate(pipeline)
        ]
        return {"month": args["month"], "data": data, "chart": {"type": "bar", "data": data}}

    if name == "get_top_merchants":
        start, end = _month_bounds(args["month"])
        pipeline = [
            {
                "$match": {
                    "user_id": user_id,
                    "type": "expense",
                    "merchant": {"$ne": None},
                    "date": {"$gte": start, "$lt": end},
                }
            },
            {"$group": {"_id": "$merchant", "total": {"$sum": "$amount"}}},
            {"$sort": {"total": -1}},
            {"$limit": int(args.get("limit", 5))},
        ]
        data = [
            {"merchant": r["_id"], "total": r["total"]}
            async for r in transactions.aggregate(pipeline)
        ]
        return {"month": args["month"], "data": data, "chart": {"type": "bar", "data": data}}

    if name == "compare_months":
        a_start, a_end = _month_bounds(args["month_a"])
        b_start, b_end = _month_bounds(args["month_b"])
        a = await _sum_by_type(user_id, a_start, a_end)
        b = await _sum_by_type(user_id, b_start, b_end)
        return {
            "month_a": {"month": args["month_a"], **a},
            "month_b": {"month": args["month_b"], **b},
            "expense_change": b["expense"] - a["expense"],
        }

    if name == "set_budget":
        await budgets.update_one(
            {"user_id": user_id, "category": args["category"]},
            {"$set": {"limit": float(args["limit"])}},
            upsert=True,
        )
        return {"ok": True, "category": args["category"], "limit": float(args["limit"])}

    if name == "forecast_next_month":
        now = datetime.utcnow().replace(day=1)
        totals = []
        for i in range(1, 4):
            m = now.month - i
            y = now.year
            while m <= 0:
                m += 12
                y -= 1
            start, end = _month_bounds(f"{y:04d}-{m:02d}")
            sums = await _sum_by_type(user_id, start, end)
            totals.append(sums["expense"])
        forecast = sum(totals) / len(totals) if totals else 0.0
        return {"recent_months_expense": totals, "forecast_next_month_expense": round(forecast, 2)}

    return {"error": f"unknown tool {name}"}


async def _complete(messages: list[dict], stream: bool = False):
    headers = {"Authorization": f"Bearer {settings.llm_api_key}"}
    payload = {
        "model": settings.llm_model,
        "messages": messages,
        "tools": TOOLS,
        "tool_choice": "auto",
        "stream": stream,
    }
    client = httpx.AsyncClient(timeout=httpx.Timeout(120.0))
    if stream:
        req = client.build_request("POST", CHAT_URL, json=payload, headers=headers)
        resp = await client.send(req, stream=True)
        return client, resp
    resp = await client.post(CHAT_URL, json=payload, headers=headers)
    resp.raise_for_status()
    await client.aclose()
    return resp.json()


async def chat_stream(
    user_id: str, history: list[dict]
) -> AsyncGenerator[tuple[str, dict | None], None]:
    """Yields (sse_event_name, payload) tuples. Payload None means done."""
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT.format(today=datetime.utcnow().date().isoformat())},
        *history,
    ]

    # Tool-calling loop (non-streaming until the model is ready to answer).
    charts: list[dict] = []
    for _ in range(6):
        data = await _complete(messages)
        choice = data["choices"][0]
        msg = choice["message"]
        messages.append(msg)
        tool_calls = msg.get("tool_calls") or []
        if not tool_calls:
            # Model answered without streaming; emit it as one chunk.
            content = msg.get("content") or ""
            yield ("token", {"text": content})
            for chart in charts:
                yield ("chart", chart)
            yield ("done", None)
            return
        for call in tool_calls:
            args = json.loads(call["function"]["arguments"] or "{}")
            result = await run_tool(user_id, call["function"]["name"], args)
            if isinstance(result, dict) and result.get("chart"):
                charts.append(result["chart"])
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call["id"],
                    "content": json.dumps(result),
                }
            )

    # Fallback: stream the final answer.
    client, resp = await _complete(messages, stream=True)
    try:
        resp.raise_for_status()
        async for line in resp.aiter_lines():
            if not line.startswith("data:"):
                continue
            data = line[5:].strip()
            if data == "[DONE]":
                break
            try:
                delta = json.loads(data)["choices"][0].get("delta", {})
            except (json.JSONDecodeError, KeyError, IndexError):
                continue
            text = delta.get("content")
            if text:
                yield ("token", {"text": text})
        for chart in charts:
            yield ("chart", chart)
        yield ("done", None)
    finally:
        await resp.aclose()
        await client.aclose()
