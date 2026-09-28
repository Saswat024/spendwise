from datetime import datetime, timezone
import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from ..db import chat_sessions
from ..llm import chat_stream
from ..models import ChatIn
from ..security import get_current_user_id

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/sessions")
async def list_sessions(user_id: str = Depends(get_current_user_id)):
    """List all previous conversations for the user ordered by recent activity."""
    cursor = chat_sessions.find(
        {"user_id": user_id},
        {"session_id": 1, "title": 1, "updated_at": 1, "created_at": 1, "messages": {"$slice": 1}, "_id": 0},
    ).sort("updated_at", -1)

    sessions = []
    async for doc in cursor:
        title = doc.get("title")
        if not title:
            first_msg = (doc.get("messages") or [{}])[0]
            title = (first_msg.get("content") or "New conversation")[:45].strip()
        sessions.append({
            "session_id": doc["session_id"],
            "title": title,
            "updated_at": doc.get("updated_at") or doc.get("created_at"),
        })
    return {"sessions": sessions}


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, user_id: str = Depends(get_current_user_id)):
    """Delete a conversation session."""
    await chat_sessions.delete_one({"user_id": user_id, "session_id": session_id})
    return {"status": "ok"}


@router.post("")
async def chat(body: ChatIn, user_id: str = Depends(get_current_user_id)):
    session = await chat_sessions.find_one({"user_id": user_id, "session_id": body.session_id})
    history = (session or {}).get("messages", [])[-20:]
    history.append({"role": "user", "content": body.message})

    async def event_stream():
        full_reply = ""
        now_iso = datetime.now(timezone.utc).isoformat()
        title = (session or {}).get("title")
        if not title:
            title = body.message[:50].strip()

        try:
            async for event, payload in chat_stream(user_id, history):
                if event == "done":
                    break
                if event == "token":
                    full_reply += payload["text"]
                yield f"event: {event}\ndata: {json.dumps(payload)}\n\n"
        except Exception:  # surface a safe error to the client
            yield f"event: error\ndata: {json.dumps({'message': 'The assistant is unavailable right now. Please try again.'})}\n\n"
        finally:
            await chat_sessions.update_one(
                {"user_id": user_id, "session_id": body.session_id},
                {
                    "$set": {
                        "user_id": user_id,
                        "session_id": body.session_id,
                        "title": title,
                        "updated_at": now_iso,
                    },
                    "$setOnInsert": {
                        "created_at": now_iso,
                    },
                    "$push": {
                        "messages": {
                            "$each": [
                                {"role": "user", "content": body.message},
                                {"role": "assistant", "content": full_reply},
                            ],
                            "$slice": -40,
                        }
                    },
                },
                upsert=True,
            )
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/history")
async def chat_history(session_id: str, user_id: str = Depends(get_current_user_id)):
    session = await chat_sessions.find_one(
        {"user_id": user_id, "session_id": session_id}, {"messages": 1, "_id": 0}
    )
    return {"messages": (session or {}).get("messages", [])}
