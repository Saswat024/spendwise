from datetime import date, datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class SignupIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str = Field(min_length=1, max_length=80)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str


TxType = Literal["income", "expense"]


class TransactionIn(BaseModel):
    amount: float = Field(gt=0)
    type: TxType
    category: str = Field(min_length=1, max_length=60)
    merchant: Optional[str] = Field(default=None, max_length=120)
    note: Optional[str] = Field(default=None, max_length=500)
    date: date

    @field_validator("date", mode="before")
    @classmethod
    def parse_flexible_date(cls, v: Any) -> Any:
        if isinstance(v, str):
            v = v.strip()
            for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d", "%Y/%m/%d"):
                try:
                    return datetime.strptime(v, fmt).date()
                except ValueError:
                    pass
        return v


class TransactionOut(TransactionIn):
    id: str


class TransactionPage(BaseModel):
    items: list[TransactionOut]
    total: int
    page: int
    page_size: int


class BudgetIn(BaseModel):
    category: str = Field(min_length=1, max_length=60)
    limit: float = Field(gt=0)


class BudgetOut(BaseModel):
    id: str
    category: str
    limit: float
    spent: float
    over_budget: bool


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    session_id: str = Field(min_length=1, max_length=80)
