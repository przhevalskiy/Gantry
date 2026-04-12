"""
Decomposer activity — wraps query decomposition as a Temporal activity.
All LLM I/O must happen in activities, not workflows. (I1)
"""
from temporalio import activity

from project.decomposer import decompose


@activity.defn(name="decompose_query")
async def decompose_query(query: str, n: int = 3) -> list[str]:
    """
    Break a research query into n focused sub-queries.
    Returns a list of strings, one per parallel research thread.
    """
    return await decompose(query, n)
