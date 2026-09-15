"""Redis-backed cache for read-heavy board/tracker queries (columns, tasks,
progress projects) - these get re-read on every page load. A miss warms the
cache from Postgres for 5 minutes; any write flushes it so the next read
doesn't serve stale board state. Falls back to "no cache" (every read hits
Postgres directly) if Redis is unreachable, so a down cache never takes the
app down with it."""

import json
import os

import redis

TTL_SECONDS = 5 * 60

_client = redis.Redis.from_url(os.environ.get("REDIS_URL", "redis://localhost:6379/0"), decode_responses=True)


def get_or_set(key: str, loader):
    """Returns the cached value for `key`; on a miss (including TTL expiry)
    calls `loader()`, caches the result, and returns it."""
    try:
        cached = _client.get(key)
        if cached is not None:
            return json.loads(cached)
    except redis.RedisError:
        return loader()

    value = loader()
    try:
        _client.set(key, json.dumps(value), ex=TTL_SECONDS)
    except redis.RedisError:
        pass
    return value


def invalidate_all() -> None:
    """Flushes every cached key. Called after any write."""
    try:
        _client.flushdb()
    except redis.RedisError:
        pass
