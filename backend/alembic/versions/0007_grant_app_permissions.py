"""Grant the restricted runtime role access to migrated tables."""

from alembic import op
from sqlalchemy import text

revision = "0007_grant_app_permissions"
down_revision = "0006_recovery_verification"
branch_labels = None
depends_on = None


def has_local_role():
    return op.get_bind().dialect.name == "postgresql" and op.get_bind().execute(
        text("SELECT 1 FROM pg_roles WHERE rolname = 'netmind_app'")
    ).scalar()


def upgrade():
    if has_local_role():
        op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO netmind_app")
        op.execute("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO netmind_app")
        op.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO netmind_app")
        op.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO netmind_app")


def downgrade():
    if has_local_role():
        op.execute("REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM netmind_app")
        op.execute("REVOKE USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public FROM netmind_app")
