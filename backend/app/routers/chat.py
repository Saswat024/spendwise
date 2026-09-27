import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from ..db import chat_sessions
from ..llm import chat_stream
from ..models import ChatIn
from ..security import get_current_user_id

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("")
async def chat(body: ChatIn, user_id: str = Depends(get_current_user_id)):
    session = await chat_sessions.find_one({"user_id": user_id, "session_id": body.session_id})
    history = (session or {}).get("messages", [])[-20:]
    history.append({"role": "user", "content": body.message})

    async def event_stream():
        full_reply = ""
        try:
            async for event, payload in chat_stream(user_id, history):
                if event == "done":
                    break
                if event == "token":
                    full_reply += payload["text"]
                yield f"event: {event}\ndata: {json.dumps(payload)}\n\n"
        except Exception as exc:  # surface a safe error to the client
            yield f"event: error\ndata: {json.dumps({'message': 'The assistant is unavailable right now. Please try again.'})}\n\n"
        finally:
            await chat_sessions.update_one(
                {"user_id": user_id, "session_id": body.session_id},
                {
                    "$set": {"user_id": user_id, "session_id": body.session_id},
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
