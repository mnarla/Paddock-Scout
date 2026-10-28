import unittest
from datetime import datetime, timezone

from paddock_intelligence import classify_story, news_for_team, eligible_upgrade_score, parse_fia_pages


class PaddockIntelligenceTests(unittest.TestCase):
    def test_news_excludes_undated_future_and_unrelated_items(self):
        now = datetime(2026, 10, 28, tzinfo=timezone.utc)
        articles = [
            {"title": "Ferrari reveals floor upgrade", "link": "https://example.com/a", "pubdate": "Tue, 27 Oct 2026 12:00:00 GMT"},
            {"title": "Ferrari test", "link": "https://example.com/b", "pubdate": ""},
            {"title": "Ferrari future", "link": "https://example.com/c", "pubdate": "Fri, 30 Oct 2026 12:00:00 GMT"},
            {"title": "Red Bull wing", "link": "https://example.com/d", "pubdate": "Tue, 27 Oct 2026 12:00:00 GMT"},
        ]
        stories = news_for_team("Ferrari", articles, now)
        self.assertEqual([s["url"] for s in stories], ["https://example.com/a"])
        self.assertEqual(stories[0]["kind"], "Technical report")

    def test_news_never_becomes_an_fia_declaration(self):
        self.assertEqual(classify_story("Ferrari confirms floor upgrade"), "Technical report")

    def test_merchandise_and_duplicate_syndicated_titles_are_excluded(self):
        common = {"pubdate": "Tue, 27 Oct 2026 12:00:00 GMT"}
        items = [
            {**common, "title": "Williams Team Cap - F1 Store", "link": "https://example.com/shop"},
            {**common, "title": "Williams reveals upgrade - RaceFans", "link": "https://example.com/a"},
            {**common, "title": "Williams reveals upgrade | Formula 1", "link": "https://example.com/b"},
        ]
        stories = news_for_team("Williams", items, datetime(2026, 10, 28, tzinfo=timezone.utc))
        self.assertEqual(len(stories), 1)

    def test_unverified_or_unlinked_upgrades_do_not_influence_model(self):
        self.assertEqual(eligible_upgrade_score({"Upgrade_Score": .15, "Certainty": "confirmed"}), 0)
        self.assertEqual(eligible_upgrade_score({"Upgrade_Score": .15, "Upgrade_Validation": "VALID", "URL": "https://example.com", "Status": "STABLE_SPEC"}), 0)
        self.assertEqual(eligible_upgrade_score({"Upgrade_Score": .05, "Upgrade_Validation": "VALID", "Certainty": "confirmed", "URL": "https://example.com", "Status": "ACTIVE_SPEC"}), .05)

    def test_fia_pages_assign_components_to_the_correct_team(self):
        pages = ["2026 UNITED STATES GRAND PRIX\nCar Presentation Submissions", "Scuderia Ferrari\nFloor Body\nPerformance - Local Load\nRevised floor geometry", "McLaren Formula 1 Team\nNo updates submitted for this event"]
        result = parse_fia_pages(pages)
        self.assertTrue(result["Ferrari"]["hasChanges"])
        self.assertIn("Floor Body", result["Ferrari"]["components"])
        self.assertFalse(result["McLaren"]["hasChanges"])
        self.assertNotIn("Mercedes", result)


if __name__ == "__main__":
    unittest.main()
