"""
Agentex ACP entrypoint — Swarm Factory.
Task routing to SwarmOrchestrator is handled automatically by the Temporal ACP integration.
"""
import os

from agentex.lib.sdk.fastacp.fastacp import FastACP
from agentex.lib.types.fastacp import TemporalACPConfig

acp = FastACP.create(
    acp_type="agentic",
    config=TemporalACPConfig(
        type="temporal",
        temporal_address=os.getenv("TEMPORAL_ADDRESS", "localhost:7233"),
    ),
)
