from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Network(Base):
    __tablename__ = "networks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    topology_version: Mapped[str] = mapped_column(String(20), nullable=False)
    devices: Mapped[list["Device"]] = relationship(back_populates="network")


class Device(Base):
    __tablename__ = "devices"
    __table_args__ = (UniqueConstraint("network_id", "name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    network_id: Mapped[int] = mapped_column(ForeignKey("networks.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    device_type: Mapped[str] = mapped_column(String(20), nullable=False)
    network: Mapped[Network] = relationship(back_populates="devices")


class Incident(Base):
    __tablename__ = "incidents"
    __table_args__ = (CheckConstraint("state IN ('open', 'acknowledged', 'resolved')"), Index("ix_incidents_network_created", "network_id", "created_at"))

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    network_id: Mapped[int] = mapped_column(ForeignKey("networks.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    state: Mapped[str] = mapped_column(String(20), default="open", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class RecoveryPlan(Base):
    __tablename__ = "recovery_plans"
    __table_args__ = (CheckConstraint("state IN ('draft', 'pending', 'approved', 'executed', 'failed')"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False)
    summary: Mapped[str] = mapped_column(String(500), nullable=False)
    state: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)


class Approval(Base):
    __tablename__ = "approvals"
    __table_args__ = (CheckConstraint("state IN ('pending', 'approved', 'rejected')"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("recovery_plans.id", ondelete="CASCADE"), nullable=False)
    approver_uid: Mapped[str] = mapped_column(String(128), nullable=False)
    proposer_uid: Mapped[str] = mapped_column(String(128), nullable=False, default="system")
    plan_hash: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    nonce: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    signature: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    state: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class RecoveryExecution(Base):
    __tablename__ = "recovery_executions"
    __table_args__ = (UniqueConstraint("idempotency_key"), Index("ix_recovery_executions_network_state", "network_id", "state"))

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    network_id: Mapped[int] = mapped_column(ForeignKey("networks.id", ondelete="CASCADE"), nullable=False)
    plan_id: Mapped[int] = mapped_column(ForeignKey("recovery_plans.id", ondelete="CASCADE"), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False)
    state: Mapped[str] = mapped_column(String(20), nullable=False, default="executing")
    action: Mapped[str] = mapped_column(String, nullable=False)
    rollback: Mapped[str] = mapped_column(String, nullable=False)
    deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    payload: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    prev_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    record_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
