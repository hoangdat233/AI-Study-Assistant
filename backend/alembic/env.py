from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# ---------------------------------------------------------------------------
# Import the app's Settings object so we can read DATABASE_URL from .env
# (never hardcoded here or in alembic.ini).
# ---------------------------------------------------------------------------
from app.core.config import settings  # noqa: E402

# ---------------------------------------------------------------------------
# Import ALL models so that Alembic autogenerate can detect every table.
# The noqa comment suppresses "imported but unused" linting warnings — these
# imports are intentional side-effects that register models with Base.metadata.
# ---------------------------------------------------------------------------
from app.db.base import Base  # noqa: E402
from app.models import (  # noqa: F401, E402
    Chat,
    Document,
    DocumentChunk,
    Flashcard,
    Message,
    Question,
    Quiz,
    StudyProgress,
    User,
)

# Alembic Config object — provides access to alembic.ini values.
config = context.config

# Set up Python logging from alembic.ini.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override sqlalchemy.url with the value from our Settings object.
# This means DATABASE_URL in .env is the single source of truth.
config.set_main_option("sqlalchemy.url", settings.database_url)

# Point autogenerate at the declarative Base so it can detect all tables.
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    Produces a SQL script without connecting to the database.
    Useful for reviewing SQL before applying it.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    Creates an engine, connects to the database, and runs pending migrations.
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

