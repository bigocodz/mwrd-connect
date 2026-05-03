"""Structured JSON logging that automatically tags every record with
request_id, user_id, and org_id from the request-scoped ContextVars."""
import json
import logging
from datetime import UTC, datetime

from .context import current_org_id, current_request_id, current_user_id

_RESERVED = {
    "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
    "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
    "created", "msecs", "relativeCreated", "thread", "threadName",
    "processName", "process", "message", "taskName", "asctime",
}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "ts": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "request_id": current_request_id.get(),
            "user_id": current_user_id.get(),
            "org_id": current_org_id.get(),
        }
        for key, value in record.__dict__.items():
            if key in _RESERVED or key in payload:
                continue
            try:
                json.dumps(value)
                payload[key] = value
            except (TypeError, ValueError):
                payload[key] = repr(value)
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)
