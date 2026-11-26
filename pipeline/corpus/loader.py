"""Loads the whole HYPE RIOT corpus (validated) in one call."""
from .cards import load_claims, load_clashes, load_list, load_templates, load_verbs
from .prompts import load_prompts
from .zoom import load_zoom


def load_corpus():
    """Returns (corpus dict, warnings list). Raises CorpusError on bad data."""
    warnings = []
    corpus = {
        "prompts": load_prompts(warnings),
        "claims": load_claims(),
        "clashes": load_clashes(),
        "zoom": load_zoom(),
        "wildcards": load_list("wildcards.txt"),
        "templates": load_templates(),
        "verbs": load_verbs(),
    }
    return corpus, warnings
