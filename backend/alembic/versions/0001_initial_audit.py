import sqlalchemy as sa

from alembic import op

revision = "0001_initial_audit"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "audit_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("payload", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    if (op.get_bind().dialect.name == "postgresql" and op.get_bind().execute(
        sa.text("SELECT 1 FROM pg_roles WHERE rolname = 'netmind_app'")
    ).scalar()):
        op.execute("GRANT SELECT, INSERT ON TABLE audit_events TO netmind_app")
        op.execute("GRANT USAGE, SELECT ON SEQUENCE audit_events_id_seq TO netmind_app")


def downgrade():
    op.drop_table("audit_events")
