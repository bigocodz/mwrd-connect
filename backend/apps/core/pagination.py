from rest_framework.pagination import CursorPagination as BaseCursorPagination


class CursorPagination(BaseCursorPagination):
    page_size = 50
    max_page_size = 200
    ordering = "-created_at"
