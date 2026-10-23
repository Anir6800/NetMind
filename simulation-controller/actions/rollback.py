"""Bounded rollback helper used by commit-confirmed execution."""
from topology.controller import Controller


def rollback(controller: Controller, verb: str, params: dict) -> dict:
    if verb != "set_link_state" or params.get("state") != "down":
        raise ValueError("rollback is not an approved bounded controller operation")
    return controller.execute(verb, params)
