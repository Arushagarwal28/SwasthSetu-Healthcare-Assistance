"""Bilingual wording for explanations.

Every sentence here is non-diagnostic. The templates describe only:

* what the report itself says (the value, the printed range, the printed flag),
* that the deterministic status was computed from that printed range,
* that a clinician must interpret the result.

They never state a cause, a disease, a medicine or a treatment change, and they
never turn an unverified (``NEEDS_REVIEW``) number into a finding.
"""

from __future__ import annotations

from typing import Dict, List, Optional

from ..parsing.types import (
    STATUS_ABNORMAL,
    STATUS_HIGH,
    STATUS_LOW,
    STATUS_NEEDS_REVIEW,
    STATUS_UNKNOWN,
    STATUS_WITHIN_RANGE,
)
from .types import LANGUAGE_ENGLISH, LANGUAGE_HINDI

#: Short human label for each deterministic status.
STATUS_LABELS: Dict[str, Dict[str, str]] = {
    STATUS_WITHIN_RANGE: {
        "en": "Within the report's range",
        "hi": "रिपोर्ट की सीमा के भीतर",
    },
    STATUS_HIGH: {
        "en": "Above the report's range",
        "hi": "रिपोर्ट की सीमा से अधिक",
    },
    STATUS_LOW: {
        "en": "Below the report's range",
        "hi": "रिपोर्ट की सीमा से कम",
    },
    STATUS_ABNORMAL: {
        "en": "Marked abnormal on the report",
        "hi": "रिपोर्ट में असामान्य चिह्नित",
    },
    STATUS_UNKNOWN: {
        "en": "Not classified",
        "hi": "वर्गीकृत नहीं",
    },
    STATUS_NEEDS_REVIEW: {
        "en": "Needs manual verification",
        "hi": "मैन्युअल जाँच आवश्यक",
    },
}

#: Localised panel names for mixed reports.
CATEGORY_LABELS: Dict[str, Dict[str, str]] = {
    "cbc": {"en": "Complete Blood Count", "hi": "संपूर्ण रक्त गणना"},
    "glucose": {"en": "Blood Glucose", "hi": "रक्त शर्करा"},
    "hba1c": {"en": "HbA1c", "hi": "HbA1c"},
    "lipid": {"en": "Lipid Profile", "hi": "लिपिड प्रोफ़ाइल"},
    "lft": {"en": "Liver Function Test", "hi": "यकृत कार्य परीक्षण"},
    "kft": {"en": "Kidney Function Test", "hi": "गुर्दा कार्य परीक्षण"},
    "thyroid": {"en": "Thyroid Profile", "hi": "थायरॉइड प्रोफ़ाइल"},
    "urine": {"en": "Urine Routine Examination", "hi": "मूत्र परीक्षण"},
    "other": {"en": "Other tests", "hi": "अन्य जाँचें"},
}

TITLES = {
    "en": "Simplified summary of your laboratory report",
    "hi": "आपकी प्रयोगशाला रिपोर्ट का सरल सारांश",
}

MIXED_LABELS = {
    "en": "This report combines results from more than one panel",
    "hi": "इस रिपोर्ट में एक से अधिक पैनल के परिणाम शामिल हैं",
}

REPORT_KIND_LABELS = {
    "en": "Report type",
    "hi": "रिपोर्ट का प्रकार",
}

REVIEW_HEADING = {
    "en": "Needs manual verification",
    "hi": "मैन्युअल जाँच आवश्यक",
}

NOTE_LABEL = {
    "en": "Good to know",
    "hi": "जानने योग्य",
}

CORRECTION_NOTE = {
    "en": (
        "A human corrected the {field} of this result while checking the original report "
        "(recorded as {old!r} -> {new!r}). The explanation uses the corrected {field}; the "
        "value originally read by the software is still kept in the report data."
    ),
    "hi": (
        "मूल रिपोर्ट जाँचते समय किसी व्यक्ति ने इस परिणाम का {field} सुधारा है "
        "({old!r} -> {new!r})। व्याख्या में सुधारा गया {field} इस्तेमाल हुआ है; सॉफ़्टवेयर द्वारा "
        "पढ़ा गया मूल मान रिपोर्ट के डेटा में सुरक्षित रखा गया है।"
    ),
}

#: Printed value / range wording, kept short so it reads well in both languages.
RESULT_LINE = {
    "en": "{name}: {value} (range printed on the report: {range})",
    "hi": "{name}: {value} (रिपोर्ट में छपी सीमा: {range})",
}
RESULT_LINE_NO_RANGE = {
    "en": "{name}: {value} (no range printed on this report)",
    "hi": "{name}: {value} (इस रिपोर्ट में कोई सीमा नहीं छपी है)",
}
RESULT_LINE_NO_VALUE = {
    "en": "{name}: no value readable on this report",
    "hi": "{name}: इस रिपोर्ट में कोई मान पढ़ा नहीं जा सका",
}

UNKNOWN_TEST_NOTE = {
    "en": (
        "This test is not in our dictionary yet, so only its printed result is shown. "
        "Please ask your doctor what it measures."
    ),
    "hi": (
        "यह जाँच अभी हमारे शब्दकोश में नहीं है, इसलिए केवल रिपोर्ट में छपा परिणाम दिखाया गया है। "
        "कृपया अपने डॉक्टर से पूछें कि यह क्या मापती है।"
    ),
}


def status_label(status: str, language: str) -> str:
    labels = STATUS_LABELS.get(status, STATUS_LABELS[STATUS_UNKNOWN])
    return labels.get(language, labels[LANGUAGE_ENGLISH])


def category_label(category: str, language: str) -> str:
    labels = CATEGORY_LABELS.get(category, CATEGORY_LABELS["other"])
    return labels.get(language, labels[LANGUAGE_ENGLISH])


def _hi(language: str) -> bool:
    return language == LANGUAGE_HINDI


def status_text(
    status: str,
    language: str,
    *,
    range_text: Optional[str] = None,
    expected: Optional[str] = None,
    value_text: Optional[str] = None,
) -> str:
    """The main sentence explaining a status, using only report-derived text."""

    hindi = _hi(language)

    if status == STATUS_WITHIN_RANGE:
        if hindi:
            return (
                f"यह परिणाम आपकी रिपोर्ट में छपी संदर्भ सीमा ({range_text}) के भीतर है। "
                "प्रयोगशाला ने इसे अपनी सीमा से बाहर नहीं माना है।"
            )
        return (
            f"This result is within the reference range printed on your report "
            f"({range_text}). The laboratory did not mark it as outside its own range."
        )

    if status == STATUS_HIGH:
        if hindi:
            return (
                f"यह परिणाम आपकी रिपोर्ट में छपी संदर्भ सीमा ({range_text}) से अधिक है। "
                "सीमा से अधिक परिणाम को रिपोर्ट पर सामान्यतः HIGH लिखा जाता है।"
            )
        return (
            f"This result is above the reference range printed on your report "
            f"({range_text}). A result above the range is usually marked HIGH on the report."
        )

    if status == STATUS_LOW:
        if hindi:
            return (
                f"यह परिणाम आपकी रिपोर्ट में छपी संदर्भ सीमा ({range_text}) से कम है। "
                "सीमा से कम परिणाम को रिपोर्ट पर सामान्यतः LOW लिखा जाता है।"
            )
        return (
            f"This result is below the reference range printed on your report "
            f"({range_text}). A result below the range is usually marked LOW on the report."
        )

    if status == STATUS_ABNORMAL:
        if hindi:
            return (
                f"इस जाँच के लिए रिपोर्ट में संख्यात्मक सीमा नहीं छपी है; रिपोर्ट में "
                f"'{expected}' को अपेक्षित परिणाम बताया गया है। यह परिणाम उससे भिन्न है और "
                "रिपोर्ट में असामान्य चिह्नित है।"
            )
        return (
            f"The report does not print a numeric range for this test; it lists "
            f"'{expected}' as the expected result. This result differs from that expected "
            f"value and is marked abnormal on the report."
        )

    if status == STATUS_NEEDS_REVIEW:
        if hindi:
            return (
                "यह परिणाम स्वचालित रूप से पुष्ट नहीं हो सका, इसलिए इसे किसी निष्कर्ष के रूप में "
                "नहीं बताया गया है। कृपया मूल रिपोर्ट में यह पंक्ति देखें और इस पर भरोसा करने से "
                "पहले प्रयोगशाला या अपने डॉक्टर से पूछें।"
            )
        return (
            "This result could not be confirmed automatically, so it is not being "
            "interpreted as a finding. Please check this line on the original report and "
            "ask the laboratory or your doctor before relying on it."
        )

    # STATUS_UNKNOWN -------------------------------------------------------
    if value_text is None:
        if hindi:
            return (
                "इस जाँच का कोई परिणाम मान इस रिपोर्ट से पढ़ा नहीं जा सका, इसलिए इसकी व्याख्या "
                "नहीं की जा सकती। कृपया मूल रिपोर्ट देखें।"
            )
        return (
            "No result value could be read for this test on this report, so it cannot be "
            "explained. Please check the original report."
        )

    if hindi:
        return (
            f"मान {value_text} पढ़ा गया, लेकिन इस रिपोर्ट में इस जाँच के लिए संदर्भ सीमा नहीं "
            "छपी है। प्रयोगशाला की अपनी सीमा के बिना यह सेवा यह नहीं बताती कि परिणाम अधिक है या कम।"
        )
    return (
        f"A value of {value_text} was read, but this report does not print a reference "
        f"range for this test. Without the laboratory's own range, this service does not "
        f"say whether the result is high or low."
    )


#: One short sentence per machine review reason, so a patient sees why a line
#: needs checking. ``{...}`` placeholders are filled from the parsed result.
REASON_TEXT: Dict[str, Dict[str, str]] = {
    "value_missing": {
        "en": "The report does not show a value for this test.",
        "hi": "रिपोर्ट में इस जाँच का मान नहीं दिखता।",
    },
    "value_unreadable": {
        "en": "A value is printed but it could not be read reliably.",
        "hi": "मान छपा है, लेकिन उसे भरोसेमंद तरीके से पढ़ा नहीं जा सका।",
    },
    "value_not_cleanly_numeric": {
        "en": "The printed value is not a clean number, so it was not converted to a figure.",
        "hi": "छपा हुआ मान स्पष्ट संख्या नहीं है, इसलिए उसे अंक में नहीं बदला गया।",
    },
    "value_looks_like_a_range": {
        "en": "The printed value looks like a range rather than a single result.",
        "hi": "छपा हुआ मान एक परिणाम के बजाय सीमा जैसा दिखता है।",
    },
    "comparator_prevents_comparison": {
        "en": (
            "The result is printed with a '<' or '>' sign, so it cannot be compared "
            "directly with the range."
        ),
        "hi": (
            "परिणाम '<' या '>' चिह्न के साथ छपा है, इसलिए इसकी सीधी तुलना सीमा से नहीं की जा सकती।"
        ),
    },
    "lab_flag_conflicts_with_reference_range": {
        "en": "The flag printed by the laboratory does not match its own printed range.",
        "hi": "प्रयोगशाला ने जो चिह्न छापा है वह उसकी अपनी छपी सीमा से मेल नहीं खाता।",
    },
    "qualitative_value_not_interpretable": {
        "en": (
            "The qualitative result could not be matched to a standard word such as "
            "Negative, Trace or Positive."
        ),
        "hi": (
            "गुणात्मक परिणाम को Negative, Trace या Positive जैसे मानक शब्द से नहीं मिलाया जा सका।"
        ),
    },
    "english_ocr_disagrees": {
        "en": (
            "The number was read twice and the two readings did not agree "
            "({primary} and {secondary})."
        ),
        "hi": (
            "संख्या दो बार पढ़ी गई और दोनों बार अलग मान मिले ({primary} और {secondary})।"
        ),
    },
    "ambiguous_test_name": {
        "en": "The test name could match more than one test in the dictionary.",
        "hi": "जाँच का नाम शब्दकोश में एक से अधिक जाँचों से मेल खा सकता है।",
    },
    "unknown_test_name": {
        "en": "This test is not in our dictionary, so its name was kept exactly as printed.",
        "hi": "यह जाँच हमारे शब्दकोश में नहीं है, इसलिए इसका नाम वैसा ही रखा गया है जैसा छपा है।",
    },
    "unrecognized_unit": {
        "en": "The unit printed ('{unit}') is not one this tool recognises.",
        "hi": "छपी हुई इकाई ('{unit}') इस टूल के लिए पहचानी हुई नहीं है।",
    },
    "classification_requires_review": {
        "en": "The status could not be decided from the printed range alone.",
        "hi": "केवल छपी हुई सीमा से स्थिति तय नहीं की जा सकी।",
    },
}

REASON_FALLBACK = {
    "en": "This line was flagged for manual checking ({reason}).",
    "hi": "इस पंक्ति को मैन्युअल जाँच के लिए चिह्नित किया गया है ({reason})।",
}

DISCLAIMERS: Dict[str, List[str]] = {
    "en": [
        (
            "This is general information about laboratory tests, not a medical diagnosis, "
            "and it does not replace advice from a doctor."
        ),
        (
            "Do not start, stop or change any medicine based on this summary. Only a "
            "qualified doctor can interpret these results for you."
        ),
        (
            "If you have severe or worsening symptoms, seek medical care immediately."
        ),
    ],
    "hi": [
        (
            "यह प्रयोगशाला जाँचों के बारे में सामान्य जानकारी है, कोई चिकित्सकीय निदान नहीं, और "
            "यह डॉक्टर की सलाह का विकल्प नहीं है।"
        ),
        (
            "इस सारांश के आधार पर कोई दवा शुरू, बंद या बदलें नहीं। इन परिणामों का अर्थ केवल एक "
            "योग्य डॉक्टर ही आपके लिए समझा सकते हैं।"
        ),
        (
            "यदि आपको गंभीर या बढ़ते लक्षण हैं, तो तुरंत चिकित्सकीय सहायता लें।"
        ),
    ],
}

NEXT_STEPS: Dict[str, List[str]] = {
    "en": [
        "Show this summary together with the original laboratory report to a doctor.",
        "Ask your doctor about any result the report places outside its own range.",
        "Where a result needs verification, check that number on the original report first.",
        "Keep the original laboratory report; this summary does not replace it.",
    ],
    "hi": [
        "यह सारांश मूल प्रयोगशाला रिपोर्ट के साथ डॉक्टर को दिखाएँ।",
        "जो परिणाम रिपोर्ट की अपनी सीमा से बाहर हैं, उनके बारे में अपने डॉक्टर से पूछें।",
        "जिन परिणामों की पुष्टि आवश्यक है, पहले मूल रिपोर्ट में वह संख्या देखें।",
        "मूल प्रयोगशाला रिपोर्ट सुरक्षित रखें; यह सारांश उसका विकल्प नहीं है।",
    ],
}

SUMMARY_COUNTS = {
    "en": (
        "This report contains {total} readable test results: {within} within the range "
        "printed on the report, {outside} outside it, {unknown} that could not be "
        "classified, and {review} awaiting manual verification."
    ),
    "hi": (
        "इस रिपोर्ट में {total} पढ़े गए परिणाम हैं: {within} रिपोर्ट में छपी सीमा के भीतर, "
        "{outside} उस सीमा से बाहर, {unknown} ऐसे परिणाम जिन्हें वर्गीकृत नहीं किया जा सका, "
        "और {review} ऐसे परिणाम जिनके लिए मैन्युअल जाँच आवश्यक है।"
    ),
}

SUMMARY_NO_TESTS = {
    "en": (
        "No test results could be read from this report, so no explanation is available. "
        "Please check that the uploaded file is the laboratory report itself."
    ),
    "hi": (
        "इस रिपोर्ट से कोई परिणाम नहीं पढ़ा जा सका, इसलिए कोई व्याख्या उपलब्ध नहीं है। कृपया "
        "जाँचें कि अपलोड की गई फ़ाइल वास्तव में प्रयोगशाला रिपोर्ट है।"
    ),
}

KEY_POINT_ALL_WITHIN = {
    "en": "Every readable result is within the range printed on this report.",
    "hi": "हर पढ़ा गया परिणाम इस रिपोर्ट में छपी सीमा के भीतर है।",
}

KEY_POINT_OUTSIDE = {
    "en": (
        "{count} result(s) are outside the range printed on this report. Being outside a "
        "laboratory range is not by itself a diagnosis; only a doctor can interpret it."
    ),
    "hi": (
        "{count} परिणाम इस रिपोर्ट में छपी सीमा से बाहर हैं। किसी प्रयोगशाला सीमा से बाहर होना "
        "अपने आप में कोई निदान नहीं है; इसका अर्थ केवल डॉक्टर ही बता सकते हैं।"
    ),
}

KEY_POINT_UNKNOWN = {
    "en": (
        "{count} result(s) could not be classified because a value or a printed range was "
        "missing."
    ),
    "hi": (
        "{count} परिणाम के लिए वर्गीकरण संभव नहीं था क्योंकि मान या छपी हुई सीमा उपलब्ध नहीं थी।"
    ),
}

KEY_POINT_REVIEW = {
    "en": (
        "Manual verification is needed for {count} result(s) before they should be relied "
        "on; the reason for each one is listed below."
    ),
    "hi": (
        "{count} परिणाम के लिए मैन्युअल जाँच आवश्यक है, इससे पहले कि उन पर भरोसा किया जाए; "
        "हर परिणाम का कारण नीचे दिया गया है।"
    ),
}
