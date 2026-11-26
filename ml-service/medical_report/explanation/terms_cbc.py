"""Complete blood count terminology (English + Hindi).

Descriptions say what the test measures. They never state a range, a threshold
or a diagnosis.
"""

from __future__ import annotations

from .types import TerminologyEntry

CBC_TERMS = (
    TerminologyEntry(
        test_id="hemoglobin",
        name_en="Hemoglobin",
        name_hi="हीमोग्लोबिन",
        measures_en=(
            "Hemoglobin is the protein inside red blood cells that carries oxygen from "
            "the lungs to the rest of the body."
        ),
        measures_hi=(
            "हीमोग्लोबिन लाल रक्त कोशिकाओं में मौजूद प्रोटीन है जो फेफड़ों से शरीर के बाकी "
            "हिस्सों तक ऑक्सीजन पहुँचाता है।"
        ),
        note_en="It is one of the first tests in a complete blood count.",
        note_hi="यह संपूर्ण रक्त गणना की सबसे पहली जाँचों में से एक है।",
    ),
    TerminologyEntry(
        test_id="rbc_count",
        name_en="Red Blood Cell Count",
        name_hi="लाल रक्त कोशिका संख्या",
        measures_en=(
            "Red blood cells carry oxygen. This count is the number of red blood cells "
            "in a measured volume of blood."
        ),
        measures_hi=(
            "लाल रक्त कोशिकाएँ ऑक्सीजन ले जाती हैं। यह जाँच रक्त के एक निश्चित आयतन में "
            "इनकी संख्या बताती है।"
        ),
    ),
    TerminologyEntry(
        test_id="wbc_count",
        name_en="White Blood Cell Count",
        name_hi="श्वेत रक्त कोशिका संख्या",
        measures_en=(
            "White blood cells are part of the body's immune defence. This count is their "
            "number in a measured volume of blood."
        ),
        measures_hi=(
            "श्वेत रक्त कोशिकाएँ शरीर की रोग-प्रतिरोधक क्षमता का हिस्सा हैं। यह जाँच रक्त के "
            "एक निश्चित आयतन में इनकी संख्या बताती है।"
        ),
    ),
    TerminologyEntry(
        test_id="platelet_count",
        name_en="Platelet Count",
        name_hi="प्लेटलेट संख्या",
        measures_en=(
            "Platelets are small particles in the blood that help it to clot and stop "
            "bleeding."
        ),
        measures_hi=(
            "प्लेटलेट्स रक्त में मौजूद छोटे कण हैं जो खून को जमने और रक्तस्राव रोकने में "
            "मदद करते हैं।"
        ),
    ),
    TerminologyEntry(
        test_id="hematocrit",
        name_en="Hematocrit (PCV)",
        name_hi="हीमेटोक्रिट (PCV)",
        measures_en=(
            "Hematocrit, also called packed cell volume, is the share of your blood volume "
            "that is made up of red blood cells."
        ),
        measures_hi=(
            "हीमेटोक्रिट, जिसे पैक्ड सेल वॉल्यूम भी कहा जाता है, बताता है कि आपके रक्त के कुल "
            "आयतन का कितना हिस्सा लाल रक्त कोशिकाओं का है।"
        ),
    ),
    TerminologyEntry(
        test_id="mcv",
        name_en="MCV (Mean Corpuscular Volume)",
        name_hi="MCV (औसत लाल कोशिका आयतन)",
        measures_en="MCV is the average size of your red blood cells.",
        measures_hi="MCV आपकी लाल रक्त कोशिकाओं का औसत आकार बताता है।",
    ),
    TerminologyEntry(
        test_id="mch",
        name_en="MCH (Mean Corpuscular Hemoglobin)",
        name_hi="MCH (औसत कोशिका हीमोग्लोबिन)",
        measures_en=(
            "MCH is the average amount of hemoglobin contained in one red blood cell."
        ),
        measures_hi="MCH बताता है कि एक लाल रक्त कोशिका में औसतन कितना हीमोग्लोबिन है।",
    ),
    TerminologyEntry(
        test_id="mchc",
        name_en="MCHC (Mean Corpuscular Hemoglobin Concentration)",
        name_hi="MCHC (औसत कोशिका हीमोग्लोबिन सांद्रता)",
        measures_en=(
            "MCHC is the average concentration of hemoglobin inside your red blood cells."
        ),
        measures_hi=(
            "MCHC लाल रक्त कोशिकाओं के भीतर हीमोग्लोबिन की औसत सांद्रता बताता है।"
        ),
    ),
    TerminologyEntry(
        test_id="rdw",
        name_en="RDW (Red Cell Distribution Width)",
        name_hi="RDW (लाल कोशिका वितरण चौड़ाई)",
        measures_en=(
            "RDW shows how much the sizes of your red blood cells differ from each other."
        ),
        measures_hi=(
            "RDW बताता है कि आपकी लाल रक्त कोशिकाओं के आकार में आपस में कितना अंतर है।"
        ),
    ),
    TerminologyEntry(
        test_id="neutrophil",
        name_en="Neutrophils",
        name_hi="न्यूट्रोफिल",
        measures_en=(
            "Neutrophils are one type of white blood cell. This result shows what share of "
            "your white blood cells are neutrophils."
        ),
        measures_hi=(
            "न्यूट्रोफिल एक प्रकार की श्वेत रक्त कोशिका है। यह परिणाम बताता है कि आपकी श्वेत "
            "रक्त कोशिकाओं में न्यूट्रोफिल का कितना हिस्सा है।"
        ),
    ),
    TerminologyEntry(
        test_id="lymphocyte",
        name_en="Lymphocytes",
        name_hi="लिम्फोसाइट",
        measures_en=(
            "Lymphocytes are one type of white blood cell. This result shows what share of "
            "your white blood cells are lymphocytes."
        ),
        measures_hi=(
            "लिम्फोसाइट एक प्रकार की श्वेत रक्त कोशिका है। यह परिणाम बताता है कि आपकी श्वेत "
            "रक्त कोशिकाओं में लिम्फोसाइट का कितना हिस्सा है।"
        ),
    ),
    TerminologyEntry(
        test_id="monocyte",
        name_en="Monocytes",
        name_hi="मोनोसाइट",
        measures_en=(
            "Monocytes are one type of white blood cell. This result shows what share of "
            "your white blood cells are monocytes."
        ),
        measures_hi=(
            "मोनोसाइट एक प्रकार की श्वेत रक्त कोशिका है। यह परिणाम बताता है कि आपकी श्वेत "
            "रक्त कोशिकाओं में मोनोसाइट का कितना हिस्सा है।"
        ),
    ),
    TerminologyEntry(
        test_id="eosinophil",
        name_en="Eosinophils",
        name_hi="इओसिनोफिल",
        measures_en=(
            "Eosinophils are one type of white blood cell. This result shows what share of "
            "your white blood cells are eosinophils."
        ),
        measures_hi=(
            "इओसिनोफिल एक प्रकार की श्वेत रक्त कोशिका है। यह परिणाम बताता है कि आपकी श्वेत "
            "रक्त कोशिकाओं में इओसिनोफिल का कितना हिस्सा है।"
        ),
    ),
    TerminologyEntry(
        test_id="basophil",
        name_en="Basophils",
        name_hi="बेसोफिल",
        measures_en=(
            "Basophils are one type of white blood cell. This result shows what share of "
            "your white blood cells are basophils."
        ),
        measures_hi=(
            "बेसोफिल एक प्रकार की श्वेत रक्त कोशिका है। यह परिणाम बताता है कि आपकी श्वेत रक्त "
            "कोशिकाओं में बेसोफिल का कितना हिस्सा है।"
        ),
    ),
    TerminologyEntry(
        test_id="esr",
        name_en="ESR (Erythrocyte Sedimentation Rate)",
        name_hi="ESR (लाल कोशिका अवसादन दर)",
        measures_en=(
            "ESR measures how quickly red blood cells settle to the bottom of a tube in one "
            "hour, a rate that can change when there is inflammation in the body."
        ),
        measures_hi=(
            "ESR मापता है कि एक घंटे में लाल रक्त कोशिकाएँ एक ट्यूब में कितनी तेज़ी से नीचे "
            "बैठती हैं; शरीर में सूजन होने पर यह दर बदल सकती है।"
        ),
    ),
    TerminologyEntry(
        test_id="anc",
        name_en="Absolute Neutrophil Count",
        name_hi="न्यूट्रोफिल की पूर्ण संख्या",
        measures_en=(
            "ANC is the actual number of neutrophils in a measured volume of blood, rather "
            "than their percentage of all white cells."
        ),
        measures_hi=(
            "ANC रक्त के एक निश्चित आयतन में न्यूट्रोफिल की वास्तविक संख्या बताता है, न कि "
            "सभी श्वेत कोशिकाओं में उनका प्रतिशत।"
        ),
    ),
    TerminologyEntry(
        test_id="alc",
        name_en="Absolute Lymphocyte Count",
        name_hi="लिम्फोसाइट की पूर्ण संख्या",
        measures_en=(
            "ALC is the actual number of lymphocytes in a measured volume of blood, rather "
            "than their percentage of all white cells."
        ),
        measures_hi=(
            "ALC रक्त के एक निश्चित आयतन में लिम्फोसाइट की वास्तविक संख्या बताता है, न कि सभी "
            "श्वेत कोशिकाओं में उनका प्रतिशत।"
        ),
    ),
    TerminologyEntry(
        test_id="mpv",
        name_en="MPV (Mean Platelet Volume)",
        name_hi="MPV (औसत प्लेटलेट आयतन)",
        measures_en="MPV is the average size of your platelets.",
        measures_hi="MPV आपके प्लेटलेट्स का औसत आकार बताता है।",
    ),
    TerminologyEntry(
        test_id="reticulocyte",
        name_en="Reticulocyte Count",
        name_hi="रेटिकुलोसाइट संख्या",
        measures_en=(
            "Reticulocytes are young red blood cells. This count shows how many new red "
            "blood cells your body is making."
        ),
        measures_hi=(
            "रेटिकुलोसाइट नई (युवा) लाल रक्त कोशिकाएँ हैं। यह जाँच बताती है कि आपका शरीर "
            "कितनी नई लाल रक्त कोशिकाएँ बना रहा है।"
        ),
    ),
)
