"""Keep generated network IDs after the seeded student lab."""

from alembic import op

revision = "0009_repair_network_sequence"
down_revision = "0008_saved_topologies"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute(
        "SELECT setval(pg_get_serial_sequence('networks', 'id'), "
        "COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM networks"
    )


def downgrade() -> None:
    pass
