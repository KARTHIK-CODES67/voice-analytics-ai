import pytest
from voiceanalytics.schema import validate_analytics
from voiceanalytics.analytics import mock_analytics

SEGMENTS = [{"id": "s1", "start": 0.0, "end": 3.0, "text": "Please call me tomorrow."}]

def test_mock_passes_contract():
    result = mock_analytics(SEGMENTS)
    assert result["review_required"] is True
    assert result["callback_requested"] is True

def test_missing_quote_is_rejected():
    value = mock_analytics(SEGMENTS)
    value["evidence"][0]["quote"] = "please pay now"
    with pytest.raises(ValueError):
        validate_analytics(value, SEGMENTS)

def test_missing_evidence_segment_is_rejected():
    value = mock_analytics(SEGMENTS)
    value["evidence"][0]["segment_id"] = "madeup"
    with pytest.raises(ValueError):
        validate_analytics(value, SEGMENTS)
