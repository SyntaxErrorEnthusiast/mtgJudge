# tests/test_rules_api.py
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_get_rules_returns_list():
    response = client.get("/rules")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0


def test_get_rules_items_have_required_fields():
    response = client.get("/rules")
    data = response.json()
    first = data[0]
    assert "rule_number" in first
    assert "text" in first


def test_get_rules_sorted_naturally():
    response = client.get("/rules")
    data = response.json()
    numbers = [r["rule_number"] for r in data]
    # 100. should appear before 100.1, which appears before 100.2, which before 100.10
    if "100." in numbers and "100.1" in numbers:
        assert numbers.index("100.") < numbers.index("100.1")
