"""Seed local Firebase Auth emulator users with the NetMind demo roles."""
from __future__ import annotations

import os

import firebase_admin
from firebase_admin import auth

PROJECT_ID = "demo-netmind"
PASSWORD = "NetMindDemo!2026"
ROLES = ("viewer", "operator", "approver", "admin")


def main() -> None:
    os.environ.setdefault("GCLOUD_PROJECT", PROJECT_ID)
    firebase_admin.initialize_app(options={"projectId": PROJECT_ID})
    for role in ROLES:
        email = f"{role}@netmind.local"
        try:
            user = auth.get_user_by_email(email)
        except auth.UserNotFoundError:
            user = auth.create_user(email=email, password=PASSWORD)
        auth.set_custom_user_claims(user.uid, {"role": role})
    print("Demo accounts: viewer@netmind.local, operator@netmind.local, approver@netmind.local, admin@netmind.local")
    print(f"Demo password: {PASSWORD}")


if __name__ == "__main__":
    main()
