import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import importlib.util
spec=importlib.util.spec_from_file_location("first_demo",str(Path(__file__).resolve().parents[1]/"00_offline_demo.py"))
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class BeginnerTests(unittest.TestCase):
    def setUp(self):
        self.segments=[{"id":"one","start":0,"end":3,"text":"Could you call me tomorrow?"}]
    def test_callback_detected(self):
        self.assertEqual(mod.analyze_fictional(self.segments)["disposition"],"CALLBACK")
    def test_fictional_result_needs_review(self):
        result=mod.analyze_fictional(self.segments)
        self.assertTrue(result["review_required"])
        self.assertFalse(result["crm_write_performed"])
    def test_unsupported_quote_rejected(self):
        result=mod.analyze_fictional(self.segments)
        result["evidence"][0]["quote"]="Customer paid premium"
        with self.assertRaises(ValueError):mod.validate_evidence(result,self.segments)
    def test_nonexistent_segment_rejected(self):
        result=mod.analyze_fictional(self.segments)
        result["evidence"][0]["segment_id"]="invented"
        with self.assertRaises(ValueError):mod.validate_evidence(result,self.segments)
    def test_empty_transcript_rejected(self):
        with self.assertRaises(ValueError):mod.analyze_fictional([])
    def test_duplicate_ids_rejected(self):
        with self.assertRaises(ValueError):mod.analyze_fictional(self.segments+self.segments)

if __name__=="__main__":unittest.main()
