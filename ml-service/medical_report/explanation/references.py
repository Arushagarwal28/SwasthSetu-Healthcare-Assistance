"""Public sources used to build the patient-facing terminology dictionary.

Every entry in :mod:`medical_report.explanation.terminology` points at one or
more ids from :data:`REFERENCES`. The dictionary only restates widely published,
non-diagnostic descriptions of *what a test measures*; it never copies a
reference range, because this system only ever uses the range printed on the
patient's own laboratory report.

These are educational, patient-facing sources. They are not used to decide
whether a result is high or low - that is done solely from the report.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Tuple


@dataclass(frozen=True, slots=True)
class Reference:
    id: str
    title: str
    publisher: str
    url: str
    used_for: str


REFERENCES: Tuple[Reference, ...] = (
    Reference(
        id="medlineplus-lab-tests",
        title="Medical Tests (laboratory test library)",
        publisher="U.S. National Library of Medicine — MedlinePlus",
        url="https://medlineplus.gov/lab-tests/",
        used_for=(
            "Plain-language descriptions of what each test measures and the role of "
            "the substance or cells being measured."
        ),
    ),
    Reference(
        id="medlineplus-lab-results",
        title="How to Understand Your Lab Results",
        publisher="U.S. National Library of Medicine — MedlinePlus",
        url="https://medlineplus.gov/lab-tests/how-to-understand-your-lab-results/",
        used_for=(
            "The explanation of what a reference range is, why laboratories report "
            "ranges rather than single values, and why results must be discussed with "
            "a clinician."
        ),
    ),
    Reference(
        id="labtestsonline",
        title="Lab Tests Online — patient education on laboratory testing",
        publisher="Association for Diagnostics & Laboratory Medicine (ADLM/AACC)",
        url="https://labtestsonline.org/",
        used_for=(
            "Cross-checking the short descriptions of test purpose for haematology, "
            "biochemistry, thyroid and urinalysis tests."
        ),
    ),
    Reference(
        id="clsi-ep28",
        title=(
            "Defining, Establishing, and Verifying Reference Intervals in the Clinical "
            "Laboratory (CLSI EP28-A3c) — provider summary"
        ),
        publisher="Clinical and Laboratory Standards Institute / ASCLS",
        url="https://ascls.org/wp-content/uploads/2012/11/Brochure_Laboratory_Reference_Intervals_Providers_2019.pdf",
        used_for=(
            "The principle that reference intervals are method- and population-specific, "
            "which is why this system never substitutes its own range for the one printed "
            "on the report."
        ),
    ),
    Reference(
        id="icmr-gclp",
        title="ICMR Guidelines for Good Clinical Laboratory Practices (GCLP) 2021",
        publisher="Indian Council of Medical Research",
        url="https://ethics.ncdirindia.org/asset/pdf/GCLP_Guidelines_2020_Final.pdf",
        used_for=(
            "Indian laboratory reporting expectations: the report must print its own "
            "biological reference range, clinical significance and limitations, and "
            "critical alert values are communicated by the laboratory, not by this tool."
        ),
    ),
)

BY_ID: Dict[str, Reference] = {reference.id: reference for reference in REFERENCES}


def get_reference(reference_id: str) -> Reference:
    try:
        return BY_ID[reference_id]
    except KeyError:  # pragma: no cover - guarded by tests
        raise KeyError(f"unknown reference id: {reference_id!r}") from None


def describe(reference_ids: Iterable[str]) -> List[Dict[str, str]]:
    """Machine-readable citation records for the given ids (order preserved)."""

    seen: List[str] = []
    for reference_id in reference_ids:
        if reference_id not in seen:
            seen.append(reference_id)
    return [
        {
            "id": BY_ID[item].id,
            "title": BY_ID[item].title,
            "publisher": BY_ID[item].publisher,
            "url": BY_ID[item].url,
        }
        for item in seen
        if item in BY_ID
    ]
