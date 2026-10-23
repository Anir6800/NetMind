import sqlalchemy as sa

from alembic import op

revision = "0002_networks_incidents"
down_revision = "0001_initial_audit"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("networks", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.String(100), unique=True, nullable=False), sa.Column("topology_version", sa.String(20), nullable=False))
    op.create_table("devices", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("network_id", sa.Integer(), sa.ForeignKey("networks.id", ondelete="CASCADE"), nullable=False), sa.Column("name", sa.String(100), nullable=False), sa.Column("device_type", sa.String(20), nullable=False), sa.UniqueConstraint("network_id", "name"))
    op.create_table("incidents", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("network_id", sa.Integer(), sa.ForeignKey("networks.id", ondelete="CASCADE"), nullable=False), sa.Column("title", sa.String(200), nullable=False), sa.Column("severity", sa.String(20), nullable=False), sa.Column("state", sa.String(20), nullable=False, server_default="open"), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.CheckConstraint("state IN ('open', 'acknowledged', 'resolved')"))
    op.create_index("ix_incidents_network_created", "incidents", ["network_id", "created_at"])
    op.create_table("recovery_plans", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("incident_id", sa.Integer(), sa.ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False), sa.Column("summary", sa.String(500), nullable=False), sa.Column("state", sa.String(20), nullable=False, server_default="draft"), sa.CheckConstraint("state IN ('draft', 'pending', 'approved', 'executed', 'failed')"))
    op.create_table("approvals", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("plan_id", sa.Integer(), sa.ForeignKey("recovery_plans.id", ondelete="CASCADE"), nullable=False), sa.Column("approver_uid", sa.String(128), nullable=False), sa.Column("state", sa.String(20), nullable=False, server_default="pending"), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.CheckConstraint("state IN ('pending', 'approved', 'rejected')"))


def downgrade():
    op.drop_table("approvals")
    op.drop_table("recovery_plans")
    op.drop_index("ix_incidents_network_created", table_name="incidents")
    op.drop_table("incidents")
    op.drop_table("devices")
    op.drop_table("networks")
