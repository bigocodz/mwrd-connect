from contextvars import ContextVar

current_org_id: ContextVar[int | None] = ContextVar("current_org_id", default=None)
current_user_id: ContextVar[int | None] = ContextVar("current_user_id", default=None)
current_request_id: ContextVar[str | None] = ContextVar("current_request_id", default=None)
# 'customer' | 'staff' | None — read by the anonymity layer.
current_scope: ContextVar[str | None] = ContextVar("current_scope", default=None)
