import sqlalchemy as sa

from alembic import op

revision = "0004_approval_transactions"
down_revision = "0003_hash_chain_audit"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("approvals", sa.Column("proposer_uid", sa.String(length=128), nullable=True))
    op.add_column("approvals", sa.Column("plan_hash", sa.String(length=64), nullable=True))
    op.add_column("approvals", sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("approvals", sa.Column("nonce", sa.String(length=128), nullable=True))
    op.add_column("approvals", sa.Column("signature", sa.String(length=64), nullable=True))
    op.add_column("approvals", sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True))
    with op.batch_alter_table("approvals") as batch:
        batch.alter_column("proposer_uid", nullable=False)
        batch.alter_column("plan_hash", nullable=False)
        batch.alter_column("expires_at", nullable=False)
        batch.alter_column("nonce", nullable=False)
        batch.alter_column("signature", nullable=False)
        batch.create_unique_constraint("uq_approvals_nonce", ["nonce"])


def downgrade():
    with op.batch_alter_table("approvals") as batch:
        batch.drop_constraint("uq_approvals_nonce", type_="unique")
        for column in ("consumed_at", "signature", "nonce", "expires_at", "plan_hash", "proposer_uid"):
            batch.drop_column(column)
