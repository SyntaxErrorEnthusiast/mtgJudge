# tests/test_rules_url.py
from unittest.mock import patch, MagicMock
import pytest
from agent.knowledge_base.rules_url import get_rules_txt_url


_FAKE_HTML_WITH_LINK = """
<html>
<body>
<a href="https://media.wizards.com/2026/downloads/MagicCompRules%2020260227.docx">DOCX</a>
<a href="https://media.wizards.com/2026/downloads/MagicCompRules%2020260227.txt">TXT</a>
</body>
</html>
"""

_FAKE_HTML_NO_LINK = """
<html><body><p>No rules here.</p></body></html>
"""


def _mock_response(text: str) -> MagicMock:
    mock = MagicMock()
    mock.text = text
    mock.raise_for_status = MagicMock()
    return mock


def test_get_rules_txt_url_returns_txt_link():
    with patch("agent.knowledge_base.rules_url.httpx.get") as mock_get:
        mock_get.return_value = _mock_response(_FAKE_HTML_WITH_LINK)
        url = get_rules_txt_url()
    assert url == "https://media.wizards.com/2026/downloads/MagicCompRules%2020260227.txt"


def test_get_rules_txt_url_raises_when_no_link_found():
    with patch("agent.knowledge_base.rules_url.httpx.get") as mock_get:
        mock_get.return_value = _mock_response(_FAKE_HTML_NO_LINK)
        with pytest.raises(RuntimeError, match="Could not find"):
            get_rules_txt_url()


def test_get_rules_txt_url_fetches_correct_page():
    with patch("agent.knowledge_base.rules_url.httpx.get") as mock_get:
        mock_get.return_value = _mock_response(_FAKE_HTML_WITH_LINK)
        get_rules_txt_url()
    mock_get.assert_called_once_with(
        "https://magic.wizards.com/en/rules",
        follow_redirects=True,
        timeout=30,
    )
