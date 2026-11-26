"""Curated test catalog: canonical names, abbreviations and category mapping.

The catalog deliberately contains **no reference ranges**. Ranges are only ever
taken from the report itself; a missing range must stay missing.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence, Tuple


@dataclass(frozen=True, slots=True)
class TestDefinition:
    id: str
    name: str
    category: str
    aliases: Tuple[str, ...] = ()
    units: Tuple[str, ...] = ()
    numeric: bool = True
    #: Value the laboratory prints when the result is normal (e.g. "Negative").
    qualitative_expected: Optional[str] = None
    hindi_aliases: Tuple[str, ...] = ()


def _def(
    test_id: str,
    name: str,
    category: str,
    aliases: Sequence[str],
    units: Sequence[str] = (),
    *,
    numeric: bool = True,
    expected: Optional[str] = None,
    hindi: Sequence[str] = (),
) -> TestDefinition:
    return TestDefinition(
        id=test_id,
        name=name,
        category=category,
        aliases=tuple(aliases),
        units=tuple(units),
        numeric=numeric,
        qualitative_expected=expected,
        hindi_aliases=tuple(hindi),
    )


TESTS: Tuple[TestDefinition, ...] = (
    # ------------------------------------------------------------------ CBC
    _def("hemoglobin", "Hemoglobin", "cbc", ("hemoglobin", "haemoglobin", "hb", "hgb", "hb conc"), ("g/dL",), hindi=("हीमोग्लोबिन", "हिमोग्लोबिन")),
    _def("rbc_count", "RBC Count", "cbc", ("rbc", "rbc count", "red blood cell count", "erythrocyte count", "total rbc"), ("million/µL",)),
    _def("wbc_count", "WBC Count", "cbc", ("wbc", "wbc count", "total leucocyte count", "total leukocyte count", "tlc", "total wbc count", "leucocyte count", "leukocyte count"), ("/µL",)),
    _def("platelet_count", "Platelet Count", "cbc", ("platelet count", "platelets", "plt", "platelet"), ("/µL", "lakh/µL")),
    _def("hematocrit", "Hematocrit", "cbc", ("hematocrit", "haematocrit", "pcv", "packed cell volume", "hct"), ("%",)),
    _def("mcv", "MCV", "cbc", ("mcv", "mean corpuscular volume"), ("fL",)),
    _def("mch", "MCH", "cbc", ("mch", "mean corpuscular hemoglobin"), ("pg",)),
    _def("mchc", "MCHC", "cbc", ("mchc", "mean corpuscular hemoglobin concentration"), ("g/dL",)),
    _def("rdw", "RDW", "cbc", ("rdw", "rdw cv", "red cell distribution width"), ("%",)),
    _def("neutrophil", "Neutrophils", "cbc", ("neutrophils", "neutrophil", "polymorphs"), ("%",)),
    _def("lymphocyte", "Lymphocytes", "cbc", ("lymphocytes", "lymphocyte"), ("%",)),
    _def("monocyte", "Monocytes", "cbc", ("monocytes", "monocyte"), ("%",)),
    _def("eosinophil", "Eosinophils", "cbc", ("eosinophils", "eosinophil"), ("%",)),
    _def("basophil", "Basophils", "cbc", ("basophils", "basophil"), ("%",)),
    _def("esr", "ESR", "cbc", ("esr", "erythrocyte sedimentation rate"), ("mm/hr",)),
    _def("anc", "Absolute Neutrophil Count", "cbc", ("anc", "absolute neutrophil count"), ("/µL",)),
    _def("alc", "Absolute Lymphocyte Count", "cbc", ("alc", "absolute lymphocyte count"), ("/µL",)),
    _def("mpv", "MPV", "cbc", ("mpv", "mean platelet volume"), ("fL",)),
    _def("reticulocyte", "Reticulocyte Count", "cbc", ("reticulocyte count", "reticulocytes", "retic count"), ("%",)),

    # -------------------------------------------------------------- Glucose
    _def("fasting_glucose", "Fasting Blood Sugar", "glucose", ("fasting blood sugar", "fbs", "fasting glucose", "blood sugar fasting", "glucose fasting", "fasting plasma glucose", "fpg"), ("mg/dL",), hindi=("शर्करा",)),
    _def("postprandial_glucose", "Postprandial Blood Sugar", "glucose", ("postprandial blood sugar", "ppbs", "pp blood sugar", "blood sugar post prandial", "2 hour post prandial", "post prandial glucose", "plbs"), ("mg/dL",)),
    _def("random_glucose", "Random Blood Sugar", "glucose", ("random blood sugar", "rbs", "random glucose", "blood sugar random"), ("mg/dL",)),
    _def("hba1c", "HbA1c", "hba1c", ("hba1c", "hb a1c", "glycated hemoglobin", "glycosylated hemoglobin", "a1c"), ("%",)),

    # ---------------------------------------------------------------- Lipid
    _def("total_cholesterol", "Total Cholesterol", "lipid", ("total cholesterol", "cholesterol total", "cholesterol", "serum cholesterol"), ("mg/dL",)),
    _def("triglycerides", "Triglycerides", "lipid", ("triglycerides", "triglyceride", "tg"), ("mg/dL",)),
    _def("hdl", "HDL Cholesterol", "lipid", ("hdl", "hdl cholesterol", "hdl c", "high density lipoprotein"), ("mg/dL",)),
    _def("ldl", "LDL Cholesterol", "lipid", ("ldl", "ldl cholesterol", "ldl c", "low density lipoprotein"), ("mg/dL",)),
    _def("vldl", "VLDL Cholesterol", "lipid", ("vldl", "vldl cholesterol", "vldl c"), ("mg/dL",)),
    _def("non_hdl", "Non-HDL Cholesterol", "lipid", ("non hdl cholesterol", "non hdl"), ("mg/dL",)),
    _def("chol_hdl_ratio", "Total Cholesterol / HDL Ratio", "lipid", ("total cholesterol hdl ratio", "cholesterol hdl ratio", "tc hdl ratio"), ("ratio",), numeric=True),

    # ------------------------------------------------------------------ LFT
    _def("total_bilirubin", "Total Bilirubin", "lft", ("total bilirubin", "bilirubin total", "bilirubin t", "t bilirubin", "bilirubin"), ("mg/dL",)),
    _def("direct_bilirubin", "Direct Bilirubin", "lft", ("direct bilirubin", "bilirubin direct", "bilirubin d", "d bilirubin", "conjugated bilirubin"), ("mg/dL",)),
    _def("indirect_bilirubin", "Indirect Bilirubin", "lft", ("indirect bilirubin", "bilirubin indirect", "unconjugated bilirubin"), ("mg/dL",)),
    _def("alt", "SGPT (ALT)", "lft", ("sgpt", "alt", "sgpt alt", "alanine aminotransferase"), ("U/L",)),
    _def("ast", "SGOT (AST)", "lft", ("sgot", "ast", "sgot ast", "aspartate aminotransferase"), ("U/L",)),
    _def("alp", "Alkaline Phosphatase", "lft", ("alkaline phosphatase", "alp", "sap", "alk phos"), ("U/L",)),
    _def("ggt", "GGT", "lft", ("ggt", "ggtp", "gamma gt", "gamma glutamyl transferase"), ("U/L",)),
    _def("total_protein", "Total Protein", "lft", ("total protein", "protein total", "serum total protein"), ("g/dL",)),
    _def("albumin", "Albumin", "lft", ("albumin", "serum albumin", "alb"), ("g/dL",)),
    _def("globulin", "Globulin", "lft", ("globulin", "serum globulin"), ("g/dL",)),
    _def("ag_ratio", "A/G Ratio", "lft", ("a g ratio", "ag ratio", "albumin globulin ratio"), ("ratio",)),

    # ------------------------------------------------------------------ KFT
    _def("blood_urea", "Blood Urea", "kft", ("blood urea", "urea", "serum urea", "urea serum"), ("mg/dL",)),
    _def("bun", "Blood Urea Nitrogen", "kft", ("bun", "blood urea nitrogen", "urea nitrogen"), ("mg/dL",)),
    _def("creatinine", "Serum Creatinine", "kft", ("creatinine", "serum creatinine", "s creatinine", "creat"), ("mg/dL",)),
    _def("uric_acid", "Uric Acid", "kft", ("uric acid", "serum uric acid"), ("mg/dL",)),
    _def("sodium", "Sodium", "kft", ("sodium", "serum sodium", "na"), ("mEq/L",)),
    _def("potassium", "Potassium", "kft", ("potassium", "serum potassium"), ("mEq/L",)),
    _def("chloride", "Chloride", "kft", ("chloride", "serum chloride"), ("mEq/L",)),
    _def("calcium", "Calcium", "kft", ("calcium", "serum calcium"), ("mg/dL",)),
    _def("phosphorus", "Phosphorus", "kft", ("phosphorus", "inorganic phosphorus", "phosphate", "serum phosphorus"), ("mg/dL",)),
    _def("egfr", "eGFR", "kft", ("egfr", "estimated gfr", "gfr"), ("mL/min/1.73m²",)),
    _def("urea_creatinine_ratio", "Urea / Creatinine Ratio", "kft", ("urea creatinine ratio", "bun creatinine ratio"), ("ratio",)),

    # -------------------------------------------------------------- Thyroid
    _def("tsh", "TSH", "thyroid", ("tsh", "thyroid stimulating hormone", "serum tsh"), ("µIU/mL",)),
    _def("total_t3", "Total T3", "thyroid", ("t3", "total t3", "triiodothyronine", "serum t3"), ("ng/dL",)),
    _def("total_t4", "Total T4", "thyroid", ("t4", "total t4", "thyroxine", "serum t4"), ("µg/dL",)),
    _def("free_t3", "Free T3", "thyroid", ("ft3", "free t3", "free triiodothyronine"), ("pg/mL",)),
    _def("free_t4", "Free T4", "thyroid", ("ft4", "free t4", "free thyroxine"), ("ng/dL",)),
    _def("anti_tpo", "Anti-TPO Antibodies", "thyroid", ("anti tpo", "antitpo", "anti thyroid peroxidase", "tpo antibody"), ("IU/mL",)),

    # ---------------------------------------------------------------- Urine
    _def("urine_colour", "Colour", "urine", ("colour", "color", "urine colour", "urine color"), (), numeric=False),
    _def("urine_appearance", "Appearance", "urine", ("appearance", "urine appearance", "clarity", "urine clarity"), (), numeric=False),
    _def("urine_ph", "pH", "urine", ("ph", "urine ph", "reaction"), (), expected=None),
    _def("urine_specific_gravity", "Specific Gravity", "urine", ("specific gravity", "sp gr", "sp gravity", "urine specific gravity"), ()),
    _def("urine_protein", "Protein", "urine", ("protein", "urine protein", "proteinuria", "albumin urine"), (), numeric=False, expected="negative"),
    _def("urine_glucose", "Glucose", "urine", ("glucose", "sugar", "urine glucose", "urine sugar"), (), numeric=False, expected="negative"),
    _def("urine_ketones", "Ketones", "urine", ("ketones", "ketone bodies", "ketone", "acetone"), (), numeric=False, expected="negative"),
    _def("urine_blood", "Blood", "urine", ("blood", "occult blood", "urine blood"), (), numeric=False, expected="negative"),
    _def("urine_bilirubin", "Bilirubin", "urine", ("bilirubin", "urine bilirubin"), (), numeric=False, expected="negative"),
    _def("urine_urobilinogen", "Urobilinogen", "urine", ("urobilinogen", "urine urobilinogen"), (), numeric=False),
    _def("urine_nitrite", "Nitrite", "urine", ("nitrite", "urine nitrite"), (), numeric=False, expected="negative"),
    _def("urine_leukocyte_esterase", "Leukocyte Esterase", "urine", ("leukocyte esterase", "leucocyte esterase"), (), numeric=False, expected="negative"),
    _def("urine_pus_cells", "Pus Cells", "urine", ("pus cells", "pus cell", "pus cells hpf", "wbc hpf"), (), numeric=False),
    _def("urine_rbc", "RBC (Urine)", "urine", ("rbc", "rbc urine", "red blood cells", "red blood cells urine", "rbc hpf"), (), numeric=False, expected="negative"),
    _def("urine_epithelial_cells", "Epithelial Cells", "urine", ("epithelial cells", "epithelial cell", "epithelial"), (), numeric=False),
    _def("urine_casts", "Casts", "urine", ("casts", "cast", "hyaline casts"), (), numeric=False, expected="negative"),
    _def("urine_crystals", "Crystals", "urine", ("crystals", "crystal", "calcium oxalate crystals"), (), numeric=False, expected="negative"),
    _def("urine_bacteria", "Bacteria", "urine", ("bacteria", "bacilli", "organisms seen"), (), numeric=False),
)

BY_ID: Dict[str, TestDefinition] = {test.id: test for test in TESTS}


def get(test_id: str) -> Optional[TestDefinition]:
    return BY_ID.get(test_id)
