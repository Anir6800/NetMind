"""Persist student-created topology documents."""

import sqlalchemy as sa

from alembic import op

revision = "0008_saved_topologies"
down_revision = "0007_grant_app_permissions"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("networks", sa.Column("topology_data", sa.String(), nullable=False, server_default=""))


def downgrade():
    op.drop_column("networks", "topology_data")
