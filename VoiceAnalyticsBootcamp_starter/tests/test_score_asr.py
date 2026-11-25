import importlib.util
from pathlib import Path
import pytest
path = Path(__file__).resolve().parents[1] / 'tools' / 'score_asr.py'
spec=importlib.util.spec_from_file_location('score_asr',path)
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
def test_perfect():
    assert mod.score('Call me tomorrow','call me tomorrow')['wer'] == 0

def test_deletion():
    assert mod.score('do not renew', 'do renew')['wer'] == pytest.approx(1/3, abs=1e-5)

def test_empty_reference():
    with pytest.raises(ValueError):mod.score('', 'fake words')
