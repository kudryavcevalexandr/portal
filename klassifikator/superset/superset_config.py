# Анонимный доступ
AUTH_ROLE_PUBLIC = "Public"
PUBLIC_ROLE_LIKE = "Gamma"   # чтобы Public умел смотреть дашборды как Gamma (read-only)

# Разрешаем встраивание в iframe
X_FRAME_OPTIONS = "ALLOWALL"
TALISMAN_ENABLED = False

# Чтобы можно было ограничивать доступ на уровне конкретных дашбордов
FEATURE_FLAGS = {
    "DASHBOARD_RBAC": True,
}
