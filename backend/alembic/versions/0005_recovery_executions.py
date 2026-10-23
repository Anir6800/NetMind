import sqlalchemy as sa

from alembic import op

revision = "0005_recovery_executions"
down_revision = "0004_approval_transactions"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("recovery_executions", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("network_id", sa.Integer(), sa.ForeignKey("networks.id", ondelete="CASCADE"), nullable=False), sa.Column("plan_id", sa.Integer(), sa.ForeignKey("recovery_plans.id", ondelete="CASCADE"), nullable=False), sa.Column("idempotency_key", sa.String(length=128), nullable=False, unique=True), sa.Column("state", sa.String(length=20), nullable=False), sa.Column("action", sa.String(), nullable=False), sa.Column("rollback", sa.String(), nullable=False), sa.Column("deadline", sa.DateTime(timezone=True), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("completed_at", sa.DateTime(timezone=True)))
    op.create_index("ix_recovery_executions_network_state", "recovery_executions", ["network_id", "state"])


def downgrade():
    op.drop_index("ix_recovery_executions_network_state", table_name="recovery_executions")
    op.drop_table("recovery_executions")
