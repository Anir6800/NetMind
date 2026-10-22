from alembic.config import Config
from sqlalchemy import create_engine, inspect

from alembic import command


def test_migrations_upgrade_empty_database(tmp_path) -> None:
    database = tmp_path / "netmind.db"
    config = Config("alembic.ini")
    config.set_main_option("sqlalchemy.url", f"sqlite:///{database}")
    command.upgrade(config, "head")
    tables = set(inspect(create_engine(f"sqlite:///{database}")).get_table_names())
    assert {"networks", "devices", "incidents", "recovery_plans", "approvals", "audit_events"} <= tables
