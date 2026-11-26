"""Glucose, HbA1c, lipid, liver, kidney and thyroid terminology (English + Hindi)."""

from __future__ import annotations

from .types import TerminologyEntry

GLUCOSE_TERMS = (
    TerminologyEntry(
        test_id="fasting_glucose",
        name_en="Fasting Blood Glucose",
        name_hi="उपवास रक्त शर्करा",
        measures_en=(
            "This test measures the sugar (glucose) in your blood after you have not eaten "
            "for about 8 hours."
        ),
        measures_hi=(
            "यह जाँच लगभग 8 घंटे कुछ न खाने के बाद आपके रक्त में शर्करा (ग्लूकोज़) की मात्रा "
            "मापती है।"
        ),
    ),
    TerminologyEntry(
        test_id="postprandial_glucose",
        name_en="Postprandial Blood Glucose",
        name_hi="भोजन के बाद रक्त शर्करा",
        measures_en=(
            "This test measures the sugar (glucose) in your blood about 2 hours after a meal."
        ),
        measures_hi=(
            "यह जाँच भोजन के लगभग 2 घंटे बाद आपके रक्त में शर्करा (ग्लूकोज़) की मात्रा मापती है।"
        ),
    ),
    TerminologyEntry(
        test_id="random_glucose",
        name_en="Random Blood Glucose",
        name_hi="किसी भी समय की रक्त शर्करा",
        measures_en=(
            "This test measures the sugar (glucose) in your blood at any time of day, "
            "without any fasting."
        ),
        measures_hi=(
            "यह जाँच दिन में किसी भी समय, बिना उपवास के, आपके रक्त में शर्करा (ग्लूकोज़) की "
            "मात्रा मापती है।"
        ),
    ),
    TerminologyEntry(
        test_id="hba1c",
        name_en="HbA1c (Glycated Hemoglobin)",
        name_hi="HbA1c (ग्लाइकेटेड हीमोग्लोबिन)",
        measures_en=(
            "HbA1c reflects your average blood sugar over the past two to three months and "
            "is usually reported as a percentage."
        ),
        measures_hi=(
            "HbA1c पिछले दो से तीन महीनों की औसत रक्त शर्करा दर्शाता है और सामान्यतः प्रतिशत "
            "में लिखा जाता है।"
        ),
    ),
)

LIPID_TERMS = (
    TerminologyEntry(
        test_id="total_cholesterol",
        name_en="Total Cholesterol",
        name_hi="कुल कोलेस्ट्रॉल",
        measures_en=(
            "Total cholesterol is the combined amount of cholesterol carried in your blood."
        ),
        measures_hi=(
            "कुल कोलेस्ट्रॉल आपके रक्त में मौजूद सभी प्रकार के कोलेस्ट्रॉल की कुल मात्रा "
            "बताता है।"
        ),
    ),
    TerminologyEntry(
        test_id="triglycerides",
        name_en="Triglycerides",
        name_hi="ट्राइग्लिसराइड",
        measures_en="Triglycerides are a form of fat that travels in the blood.",
        measures_hi="ट्राइग्लिसराइड एक प्रकार की वसा है जो रक्त में बहती है।",
    ),
    TerminologyEntry(
        test_id="hdl",
        name_en="HDL Cholesterol",
        name_hi="HDL कोलेस्ट्रॉल",
        measures_en=(
            "HDL is often called 'good' cholesterol because it carries cholesterol away "
            "from blood vessels towards the liver."
        ),
        measures_hi=(
            "HDL को अक्सर 'अच्छा' कोलेस्ट्रॉल कहा जाता है क्योंकि यह रक्त वाहिकाओं से "
            "कोलेस्ट्रॉल हटाकर यकृत की ओर ले जाता है।"
        ),
    ),
    TerminologyEntry(
        test_id="ldl",
        name_en="LDL Cholesterol",
        name_hi="LDL कोलेस्ट्रॉल",
        measures_en=(
            "LDL is often called 'bad' cholesterol because, when present in higher amounts, "
            "it can deposit cholesterol in blood vessels."
        ),
        measures_hi=(
            "LDL को अक्सर 'खराब' कोलेस्ट्रॉल कहा जाता है क्योंकि अधिक मात्रा में यह रक्त "
            "वाहिकाओं में कोलेस्ट्रॉल जमा कर सकता है।"
        ),
    ),
    TerminologyEntry(
        test_id="vldl",
        name_en="VLDL Cholesterol",
        name_hi="VLDL कोलेस्ट्रॉल",
        measures_en=(
            "VLDL is a particle that carries triglycerides from the liver to other parts of "
            "the body."
        ),
        measures_hi=(
            "VLDL एक कण है जो ट्राइग्लिसराइड को यकृत से शरीर के अन्य हिस्सों तक पहुँचाता है।"
        ),
    ),
    TerminologyEntry(
        test_id="non_hdl",
        name_en="Non-HDL Cholesterol",
        name_hi="नॉन-HDL कोलेस्ट्रॉल",
        measures_en=(
            "Non-HDL cholesterol is total cholesterol minus HDL, so it covers the "
            "cholesterol carried by all the other particles."
        ),
        measures_hi=(
            "नॉन-HDL कोलेस्ट्रॉल कुल कोलेस्ट्रॉल में से HDL घटाकर निकलता है, इसलिए इसमें बाकी "
            "सभी कणों का कोलेस्ट्रॉल शामिल होता है।"
        ),
    ),
    TerminologyEntry(
        test_id="chol_hdl_ratio",
        name_en="Cholesterol / HDL Ratio",
        name_hi="कोलेस्ट्रॉल / HDL अनुपात",
        measures_en=(
            "This ratio compares your total cholesterol with your HDL cholesterol."
        ),
        measures_hi="यह अनुपात आपके कुल कोलेस्ट्रॉल की तुलना HDL कोलेस्ट्रॉल से करता है।",
    ),
)

LFT_TERMS = (
    TerminologyEntry(
        test_id="total_bilirubin",
        name_en="Total Bilirubin",
        name_hi="कुल बिलीरुबिन",
        measures_en=(
            "Bilirubin is a yellow substance produced when old red blood cells are broken "
            "down, and the liver processes it."
        ),
        measures_hi=(
            "बिलीरुबिन एक पीला पदार्थ है जो पुरानी लाल रक्त कोशिकाओं के टूटने पर बनता है और "
            "यकृत उसे संसाधित करता है।"
        ),
    ),
    TerminologyEntry(
        test_id="direct_bilirubin",
        name_en="Direct Bilirubin",
        name_hi="डायरेक्ट बिलीरुबिन",
        measures_en=(
            "Direct, or conjugated, bilirubin is the part that the liver has already "
            "processed."
        ),
        measures_hi=(
            "डायरेक्ट (कंजुगेटेड) बिलीरुबिन वह हिस्सा है जिसे यकृत पहले ही संसाधित कर चुका है।"
        ),
    ),
    TerminologyEntry(
        test_id="indirect_bilirubin",
        name_en="Indirect Bilirubin",
        name_hi="इनडायरेक्ट बिलीरुबिन",
        measures_en=(
            "Indirect, or unconjugated, bilirubin is the part that the liver has not yet "
            "processed."
        ),
        measures_hi=(
            "इनडायरेक्ट (अनकंजुगेटेड) बिलीरुबिन वह हिस्सा है जिसे यकृत ने अभी संसाधित नहीं "
            "किया है।"
        ),
    ),
    TerminologyEntry(
        test_id="alt",
        name_en="ALT (SGPT)",
        name_hi="ALT (SGPT)",
        measures_en=(
            "ALT is an enzyme found mainly inside liver cells."
        ),
        measures_hi="ALT एक एंज़ाइम है जो मुख्य रूप से यकृत की कोशिकाओं के भीतर पाया जाता है।",
    ),
    TerminologyEntry(
        test_id="ast",
        name_en="AST (SGOT)",
        name_hi="AST (SGOT)",
        measures_en=(
            "AST is an enzyme found in the liver, heart and muscles."
        ),
        measures_hi="AST एक एंज़ाइम है जो यकृत, हृदय और मांसपेशियों में पाया जाता है।",
    ),
    TerminologyEntry(
        test_id="alp",
        name_en="Alkaline Phosphatase (ALP)",
        name_hi="अल्कलाइन फॉस्फेटेज़ (ALP)",
        measures_en=(
            "Alkaline phosphatase is an enzyme found mainly in the liver and bones."
        ),
        measures_hi=(
            "अल्कलाइन फॉस्फेटेज़ एक एंज़ाइम है जो मुख्य रूप से यकृत और हड्डियों में पाया जाता है।"
        ),
    ),
    TerminologyEntry(
        test_id="ggt",
        name_en="Gamma GT (GGT)",
        name_hi="गामा GT (GGT)",
        measures_en="GGT is an enzyme found in the liver and bile ducts.",
        measures_hi="GGT एक एंज़ाइम है जो यकृत और पित्त नलिकाओं में पाया जाता है।",
    ),
    TerminologyEntry(
        test_id="total_protein",
        name_en="Total Protein",
        name_hi="कुल प्रोटीन",
        measures_en=(
            "Total protein measures the protein in your blood, which is mainly albumin and "
            "globulins."
        ),
        measures_hi=(
            "कुल प्रोटीन आपके रक्त में मौजूद प्रोटीन की कुल मात्रा बताता है, जिसमें मुख्य रूप "
            "से एल्ब्यूमिन और ग्लोब्युलिन होते हैं।"
        ),
    ),
    TerminologyEntry(
        test_id="albumin",
        name_en="Albumin",
        name_hi="एल्ब्यूमिन",
        measures_en=(
            "Albumin is the main protein made by the liver; it helps keep fluid inside blood "
            "vessels."
        ),
        measures_hi=(
            "एल्ब्यूमिन यकृत द्वारा बनाया जाने वाला मुख्य प्रोटीन है; यह तरल को रक्त वाहिकाओं "
            "के भीतर बनाए रखने में मदद करता है।"
        ),
    ),
    TerminologyEntry(
        test_id="globulin",
        name_en="Globulin",
        name_hi="ग्लोब्युलिन",
        measures_en=(
            "Globulins are a group of blood proteins that include antibodies."
        ),
        measures_hi=(
            "ग्लोब्युलिन रक्त के प्रोटीनों का एक समूह है जिसमें एंटीबॉडी भी शामिल होती हैं।"
        ),
    ),
    TerminologyEntry(
        test_id="ag_ratio",
        name_en="Albumin / Globulin Ratio",
        name_hi="एल्ब्यूमिन / ग्लोब्युलिन अनुपात",
        measures_en="This ratio compares albumin with globulin in your blood.",
        measures_hi="यह अनुपात आपके रक्त में एल्ब्यूमिन की तुलना ग्लोब्युलिन से करता है।",
    ),
)

KFT_TERMS = (
    TerminologyEntry(
        test_id="blood_urea",
        name_en="Blood Urea",
        name_hi="रक्त यूरिया",
        measures_en=(
            "Urea is a waste product made when the body breaks down protein, and the "
            "kidneys remove it from the blood."
        ),
        measures_hi=(
            "यूरिया एक अपशिष्ट पदार्थ है जो शरीर में प्रोटीन टूटने पर बनता है और गुर्दे इसे "
            "रक्त से बाहर निकालते हैं।"
        ),
    ),
    TerminologyEntry(
        test_id="bun",
        name_en="Blood Urea Nitrogen (BUN)",
        name_hi="रक्त यूरिया नाइट्रोजन (BUN)",
        measures_en="BUN measures the nitrogen part of urea in your blood.",
        measures_hi="BUN आपके रक्त में यूरिया के नाइट्रोजन वाले हिस्से की मात्रा मापता है।",
    ),
    TerminologyEntry(
        test_id="creatinine",
        name_en="Creatinine",
        name_hi="क्रिएटिनिन",
        measures_en=(
            "Creatinine is a waste product from normal muscle activity that the kidneys "
            "filter out of the blood."
        ),
        measures_hi=(
            "क्रिएटिनिन एक अपशिष्ट पदार्थ है जो मांसपेशियों की सामान्य गतिविधि से बनता है और "
            "गुर्दे इसे रक्त से छानकर बाहर निकालते हैं।"
        ),
    ),
    TerminologyEntry(
        test_id="uric_acid",
        name_en="Uric Acid",
        name_hi="यूरिक एसिड",
        measures_en=(
            "Uric acid is a waste product formed when the body breaks down substances called "
            "purines."
        ),
        measures_hi=(
            "यूरिक एसिड एक अपशिष्ट पदार्थ है जो शरीर में प्यूरीन नामक पदार्थ टूटने पर बनता है।"
        ),
    ),
    TerminologyEntry(
        test_id="sodium",
        name_en="Sodium",
        name_hi="सोडियम",
        measures_en=(
            "Sodium is a mineral that helps control the amount of water in your body."
        ),
        measures_hi=(
            "सोडियम एक खनिज है जो आपके शरीर में पानी की मात्रा नियंत्रित करने में मदद करता है।"
        ),
    ),
    TerminologyEntry(
        test_id="potassium",
        name_en="Potassium",
        name_hi="पोटैशियम",
        measures_en=(
            "Potassium is a mineral that helps nerves and muscles, including the heart, to "
            "work properly."
        ),
        measures_hi=(
            "पोटैशियम एक खनिज है जो नसों और मांसपेशियों, विशेष रूप से हृदय, के ठीक से काम करने "
            "में मदद करता है।"
        ),
    ),
    TerminologyEntry(
        test_id="chloride",
        name_en="Chloride",
        name_hi="क्लोराइड",
        measures_en=(
            "Chloride is a mineral that helps keep the body's fluid and acid balance."
        ),
        measures_hi=(
            "क्लोराइड एक खनिज है जो शरीर में तरल और अम्ल-क्षार संतुलन बनाए रखने में मदद करता है।"
        ),
    ),
    TerminologyEntry(
        test_id="calcium",
        name_en="Calcium",
        name_hi="कैल्शियम",
        measures_en=(
            "Calcium is a mineral stored mainly in the bones, with a small amount "
            "circulating in the blood."
        ),
        measures_hi=(
            "कैल्शियम एक खनिज है जो मुख्य रूप से हड्डियों में जमा रहता है और इसका थोड़ा हिस्सा "
            "रक्त में घूमता है।"
        ),
    ),
    TerminologyEntry(
        test_id="phosphorus",
        name_en="Phosphorus",
        name_hi="फॉस्फोरस",
        measures_en=(
            "Phosphorus is a mineral that works with calcium and is filtered by the kidneys."
        ),
        measures_hi=(
            "फॉस्फोरस एक खनिज है जो कैल्शियम के साथ काम करता है और गुर्दे इसे छानते हैं।"
        ),
    ),
    TerminologyEntry(
        test_id="egfr",
        name_en="eGFR (Estimated Glomerular Filtration Rate)",
        name_hi="eGFR (अनुमानित ग्लोमेरुलर फ़िल्ट्रेशन दर)",
        measures_en=(
            "eGFR is a calculated estimate of how well your kidneys are filtering blood."
        ),
        measures_hi=(
            "eGFR एक गणना से निकला अनुमान है कि आपके गुर्दे रक्त को कितनी अच्छी तरह छान रहे हैं।"
        ),
    ),
    TerminologyEntry(
        test_id="urea_creatinine_ratio",
        name_en="Urea / Creatinine Ratio",
        name_hi="यूरिया / क्रिएटिनिन अनुपात",
        measures_en="This ratio compares urea with creatinine in your blood.",
        measures_hi="यह अनुपात आपके रक्त में यूरिया की तुलना क्रिएटिनिन से करता है।",
    ),
)

THYROID_TERMS = (
    TerminologyEntry(
        test_id="tsh",
        name_en="TSH (Thyroid Stimulating Hormone)",
        name_hi="TSH (थायरॉइड उत्तेजक हार्मोन)",
        measures_en=(
            "TSH is a hormone from the pituitary gland that signals the thyroid gland to "
            "produce its hormones."
        ),
        measures_hi=(
            "TSH पिट्यूटरी ग्रंथि से बनने वाला हार्मोन है जो थायरॉइड ग्रंथि को संकेत देता है कि "
            "कितना हार्मोन बनाना है।"
        ),
    ),
    TerminologyEntry(
        test_id="total_t3",
        name_en="Total T3",
        name_hi="कुल T3",
        measures_en=(
            "T3 is a thyroid hormone that influences how the body uses energy."
        ),
        measures_hi="T3 थायरॉइड हार्मोन है जो शरीर में ऊर्जा के उपयोग को प्रभावित करता है।",
    ),
    TerminologyEntry(
        test_id="total_t4",
        name_en="Total T4",
        name_hi="कुल T4",
        measures_en="T4 is the main hormone produced by the thyroid gland.",
        measures_hi="T4 थायरॉइड ग्रंथि द्वारा बनाया जाने वाला मुख्य हार्मोन है।",
    ),
    TerminologyEntry(
        test_id="free_t3",
        name_en="Free T3",
        name_hi="फ्री T3",
        measures_en=(
            "Free T3 is the small part of T3 that is not attached to carrier proteins and "
            "is available to the body."
        ),
        measures_hi=(
            "फ्री T3, T3 का वह छोटा हिस्सा है जो प्रोटीन से बंधा नहीं होता और शरीर के लिए "
            "उपलब्ध रहता है।"
        ),
    ),
    TerminologyEntry(
        test_id="free_t4",
        name_en="Free T4",
        name_hi="फ्री T4",
        measures_en=(
            "Free T4 is the small part of T4 that is not attached to carrier proteins and "
            "is available to the body."
        ),
        measures_hi=(
            "फ्री T4, T4 का वह छोटा हिस्सा है जो प्रोटीन से बंधा नहीं होता और शरीर के लिए "
            "उपलब्ध रहता है।"
        ),
    ),
    TerminologyEntry(
        test_id="anti_tpo",
        name_en="Anti-TPO Antibodies",
        name_hi="एंटी-TPO एंटीबॉडी",
        measures_en=(
            "Anti-TPO antibodies are proteins made by the immune system that target an "
            "enzyme found in the thyroid gland."
        ),
        measures_hi=(
            "एंटी-TPO एंटीबॉडी प्रोटीन हैं जो प्रतिरक्षा तंत्र बनाता है और जो थायरॉइड ग्रंथि "
            "में मौजूद एक एंज़ाइम पर काम करते हैं।"
        ),
    ),
)

PANEL_TERMS = GLUCOSE_TERMS + LIPID_TERMS + LFT_TERMS + KFT_TERMS + THYROID_TERMS
