import sqlalchemy as sa

from alembic import op

revision = "0006_recovery_verification"
down_revision = "0005_recovery_executions"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("recovery_executions", sa.Column("mttd_ms", sa.Integer(), nullable=True))
    op.add_column("recovery_executions", sa.Column("mttr_ms", sa.Integer(), nullable=True))
    op.add_column("recovery_executions", sa.Column("verification", sa.String(), nullable=True))


def downgrade():
    op.drop_column("recovery_executions", "verification")
    op.drop_column("recovery_executions", "mttr_ms")
    op.drop_column("recovery_executions", "mttd_ms")
