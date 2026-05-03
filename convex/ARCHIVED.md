# ARCHIVED

This Convex backend is **archived** as of the Phase 9 cutover.

The replacement Django + Postgres backend lives in `../backend/`. Every
Convex table and function in this directory has a corresponding Django
app or service. See `../backend/README.md` and `../docs/PHASES.md` for the
mapping.

**Do not modify files here.** They are kept for two reasons:

1. **Reference** — when porting any remaining edge case (auto-quote rules,
   Wafeq webhook handlers, etc.) we may need to re-read the original logic.
2. **Safety window** — keeping them in-tree until the new backend has run
   in production for ≥ 2 weeks gives us a known-good rollback target.

After the safety window passes, delete this directory in a single PR
titled `chore: remove archived Convex backend`. Do not amend other work
into that PR — keep the deletion auditable.

Until then, the dev `docker-compose up` and `python manage.py runserver`
flows for the new stack are the only supported development paths.
