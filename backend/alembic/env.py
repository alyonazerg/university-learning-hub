from alembic import context
from sqlalchemy import create_engine, pool
from app.db import Base
from app import models
from app.settings import settings

config = context.config
target_metadata = Base.metadata


def run_migrations_online():
    url = settings.database_url or config.get_main_option('sqlalchemy.url')
    connectable = create_engine(url, poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=url.startswith('sqlite'))
        with context.begin_transaction():
            context.run_migrations()

run_migrations_online()
