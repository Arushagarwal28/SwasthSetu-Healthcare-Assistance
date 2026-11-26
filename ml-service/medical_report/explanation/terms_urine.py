"""Urine routine examination terminology (English + Hindi)."""

from __future__ import annotations

from .types import TerminologyEntry

URINE_TERMS = (
    TerminologyEntry(
        test_id="urine_colour",
        name_en="Urine Colour",
        name_hi="मूत्र का रंग",
        measures_en=(
            "Urine colour is checked as a general observation; it can vary with how much "
            "water you drink and with other factors."
        ),
        measures_hi=(
            "मूत्र का रंग सामान्य जानकारी के लिए देखा जाता है; यह पीने वाले पानी की मात्रा और "
            "अन्य कारणों से बदल सकता है।"
        ),
    ),
    TerminologyEntry(
        test_id="urine_appearance",
        name_en="Urine Appearance",
        name_hi="मूत्र की दिखावट",
        measures_en="Appearance describes whether the urine sample looks clear or cloudy.",
        measures_hi="दिखावट बताती है कि मूत्र का नमूना साफ़ दिखता है या धुंधला।",
    ),
    TerminologyEntry(
        test_id="urine_ph",
        name_en="Urine pH",
        name_hi="मूत्र pH",
        measures_en="Urine pH shows how acidic or alkaline the urine is.",
        measures_hi="मूत्र pH बताता है कि मूत्र कितना अम्लीय या क्षारीय है।",
    ),
    TerminologyEntry(
        test_id="urine_specific_gravity",
        name_en="Urine Specific Gravity",
        name_hi="मूत्र विशिष्ट गुरुत्व",
        measures_en=(
            "Specific gravity shows how concentrated the urine is, which relates to how "
            "much water the body is passing."
        ),
        measures_hi=(
            "विशिष्ट गुरुत्व बताता है कि मूत्र कितना गाढ़ा है, जिसका संबंध शरीर से निकलने वाले "
            "पानी की मात्रा से है।"
        ),
    ),
    TerminologyEntry(
        test_id="urine_protein",
        name_en="Urine Protein",
        name_hi="मूत्र प्रोटीन",
        measures_en="This test checks whether protein is present in the urine sample.",
        measures_hi="यह जाँच देखती है कि मूत्र के नमूने में प्रोटीन है या नहीं।",
    ),
    TerminologyEntry(
        test_id="urine_glucose",
        name_en="Urine Glucose",
        name_hi="मूत्र शर्करा",
        measures_en="This test checks whether sugar (glucose) is present in the urine.",
        measures_hi="यह जाँच देखती है कि मूत्र में शर्करा (ग्लूकोज़) है या नहीं।",
    ),
    TerminologyEntry(
        test_id="urine_ketones",
        name_en="Urine Ketones",
        name_hi="मूत्र कीटोन",
        measures_en=(
            "This test checks for ketones, substances the body makes when it breaks down "
            "fat for energy."
        ),
        measures_hi=(
            "यह जाँच कीटोन देखती है, जो ऐसे पदार्थ हैं जो शरीर में ऊर्जा के लिए वसा टूटने पर "
            "बनते हैं।"
        ),
    ),
    TerminologyEntry(
        test_id="urine_blood",
        name_en="Urine Blood",
        name_hi="मूत्र में रक्त",
        measures_en=(
            "This test looks for blood or blood pigment (hemoglobin) in the urine sample."
        ),
        measures_hi=(
            "यह जाँच मूत्र के नमूने में रक्त या रक्त के रंजक (हीमोग्लोबिन) की उपस्थिति देखती है।"
        ),
    ),
    TerminologyEntry(
        test_id="urine_bilirubin",
        name_en="Urine Bilirubin",
        name_hi="मूत्र बिलीरुबिन",
        measures_en="This test checks for bilirubin in the urine.",
        measures_hi="यह जाँच मूत्र में बिलीरुबिन की उपस्थिति देखती है।",
    ),
    TerminologyEntry(
        test_id="urine_urobilinogen",
        name_en="Urine Urobilinogen",
        name_hi="मूत्र यूरोबिलिनोजन",
        measures_en=(
            "This test checks the level of urobilinogen, a substance formed from bilirubin, "
            "in the urine."
        ),
        measures_hi=(
            "यह जाँच मूत्र में यूरोबिलिनोजन की मात्रा देखती है, जो बिलीरुबिन से बनता है।"
        ),
    ),
    TerminologyEntry(
        test_id="urine_nitrite",
        name_en="Urine Nitrite",
        name_hi="मूत्र नाइट्राइट",
        measures_en=(
            "This test checks for nitrite, a substance that some bacteria produce in urine."
        ),
        measures_hi=(
            "यह जाँच नाइट्राइट देखती है, जो कुछ बैक्टीरिया मूत्र में बनाते हैं।"
        ),
    ),
    TerminologyEntry(
        test_id="urine_leukocyte_esterase",
        name_en="Urine Leukocyte Esterase",
        name_hi="मूत्र ल्यूकोसाइट एस्टरेज़",
        measures_en=(
            "This test looks for an enzyme released by white blood cells, which can be "
            "present in the urine."
        ),
        measures_hi=(
            "यह जाँच उस एंज़ाइम को देखती है जो श्वेत रक्त कोशिकाओं से निकलता है और मूत्र में "
            "मौजूद हो सकता है।"
        ),
    ),
    TerminologyEntry(
        test_id="urine_pus_cells",
        name_en="Pus Cells (Urine WBC)",
        name_hi="पस कोशिकाएँ (मूत्र WBC)",
        measures_en=(
            "Pus cells, which are white blood cells, are counted in the urine under a "
            "microscope."
        ),
        measures_hi=(
            "पस कोशिकाएँ, जो श्वेत रक्त कोशिकाएँ हैं, माइक्रोस्कोप के नीचे मूत्र में गिनी जाती हैं।"
        ),
    ),
    TerminologyEntry(
        test_id="urine_rbc",
        name_en="Urine Red Blood Cells",
        name_hi="मूत्र में लाल रक्त कोशिकाएँ",
        measures_en="Red blood cells in the urine are counted under a microscope.",
        measures_hi="मूत्र में लाल रक्त कोशिकाएँ माइक्रोस्कोप के नीचे गिनी जाती हैं।",
    ),
    TerminologyEntry(
        test_id="urine_epithelial_cells",
        name_en="Urine Epithelial Cells",
        name_hi="मूत्र एपिथीलियल कोशिकाएँ",
        measures_en=(
            "Epithelial cells are cells shed from the lining of the urinary tract and are "
            "counted under a microscope."
        ),
        measures_hi=(
            "एपिथीलियल कोशिकाएँ मूत्र मार्ग की परत से निकलने वाली कोशिकाएँ हैं और इन्हें "
            "माइक्रोस्कोप के नीचे गिना जाता है।"
        ),
    ),
    TerminologyEntry(
        test_id="urine_casts",
        name_en="Urine Casts",
        name_hi="मूत्र कास्ट",
        measures_en=(
            "Casts are tube-shaped particles that can form in the small tubes of the kidney "
            "and are seen under a microscope."
        ),
        measures_hi=(
            "कास्ट नली जैसे कण हैं जो गुर्दे की छोटी नलियों में बन सकते हैं और माइक्रोस्कोप के "
            "नीचे दिखाई देते हैं।"
        ),
    ),
    TerminologyEntry(
        test_id="urine_crystals",
        name_en="Urine Crystals",
        name_hi="मूत्र क्रिस्टल",
        measures_en=(
            "Crystals are solid particles that can form in urine and are seen under a "
            "microscope."
        ),
        measures_hi=(
            "क्रिस्टल ठोस कण हैं जो मूत्र में बन सकते हैं और माइक्रोस्कोप के नीचे दिखाई देते हैं।"
        ),
    ),
    TerminologyEntry(
        test_id="urine_bacteria",
        name_en="Urine Bacteria",
        name_hi="मूत्र में बैक्टीरिया",
        measures_en="This test checks whether bacteria are visible in the urine sample.",
        measures_hi="यह जाँच देखती है कि मूत्र के नमूने में बैक्टीरिया दिखाई दे रहे हैं या नहीं।",
    ),
)
