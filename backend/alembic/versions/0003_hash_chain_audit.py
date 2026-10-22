import hashlib
import json
from datetime import UTC

import sqlalchemy as sa

from alembic import op

revision = "0003_hash_chain_audit"
down_revision = "0002_networks_incidents"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("audit_events", sa.Column("prev_hash", sa.String(length=64), nullable=True))
    op.add_column("audit_events", sa.Column("record_hash", sa.String(length=64), nullable=True))
    audit_events = sa.table(
        "audit_events",
        sa.column("id", sa.Integer()),
        sa.column("event_type", sa.String()),
        sa.column("payload", sa.String()),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("prev_hash", sa.String()),
        sa.column("record_hash", sa.String()),
    )
    previous = "0" * 64
    for event in op.get_bind().execute(sa.select(audit_events).order_by(audit_events.c.id)).mappings():
        timestamp = event["created_at"].replace(tzinfo=event["created_at"].tzinfo or UTC).isoformat()
        record = json.dumps({"created_at": timestamp, "event_type": event["event_type"], "payload": json.loads(event["payload"])}, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
        record_hash = hashlib.sha256((previous + record).encode()).hexdigest()
        op.get_bind().execute(audit_events.update().where(audit_events.c.id == event["id"]).values(prev_hash=previous, record_hash=record_hash))
        previous = record_hash
    with op.batch_alter_table("audit_events") as batch:
        batch.alter_column("prev_hash", nullable=False)
        batch.alter_column("record_hash", nullable=False)
        batch.create_unique_constraint("uq_audit_events_record_hash", ["record_hash"])


def downgrade():
    with op.batch_alter_table("audit_events") as batch:
        batch.drop_constraint("uq_audit_events_record_hash", type_="unique")
        batch.drop_column("record_hash")
        batch.drop_column("prev_hash")
