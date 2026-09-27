from motor.motor_asyncio import AsyncIOMotorClient

from .config import settings

client = AsyncIOMotorClient(settings.mongodb_uri)
db = client.get_default_database("spendwise")

users = db["users"]
transactions = db["transactions"]
budgets = db["budgets"]
chat_sessions = db["chat_sessions"]


async def ensure_indexes() -> None:
    await users.create_index("email", unique=True)
    await transactions.create_index([("user_id", 1), ("date", -1)])
    await transactions.create_index([("user_id", 1), ("category", 1)])
    await budgets.create_index([("user_id", 1), ("category", 1)], unique=True)
    await chat_sessions.create_index([("user_id", 1), ("session_id", 1)], unique=True)
