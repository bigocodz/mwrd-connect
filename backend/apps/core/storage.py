"""Thin wrapper around the storage backend so swapping S3 → R2 → MinIO is a
config-only change. All file access in domain code should go through these
helpers, never through raw boto3."""
from django.core.files.storage import default_storage


def signed_upload_url(key: str, content_type: str, *, expires: int = 600) -> dict:
    """Presigned PUT URL for direct browser uploads."""
    storage = default_storage
    client = storage.connection.meta.client
    url = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": storage.bucket_name,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=expires,
    )
    return {"url": url, "method": "PUT", "headers": {"Content-Type": content_type}}


def signed_download_url(key: str, *, expires: int = 600) -> str:
    """Presigned GET URL. Default 10-minute TTL."""
    storage = default_storage
    client = storage.connection.meta.client
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": storage.bucket_name, "Key": key},
        ExpiresIn=expires,
    )


def delete_object(key: str) -> None:
    storage = default_storage
    storage.connection.meta.client.delete_object(
        Bucket=storage.bucket_name, Key=key,
    )
