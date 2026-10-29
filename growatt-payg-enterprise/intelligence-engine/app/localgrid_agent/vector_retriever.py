"""
vector_retriever.py
Semantic Vector & Fault-Code Retriever for LocalGridAgent.
"""

from __future__ import annotations

from typing import List, Tuple
from .ingest_manuals import GrowattKnowledgeIngestor, KnowledgeChunk


class GrowattVectorRetriever:
    """
    Retrieves the top-K most relevant Growatt manual, fault code, and financing policy
    chunks using cosine similarity over 1536-dimensional embeddings plus exact fault code boost.
    """

    def __init__(self) -> None:
        self.chunks: List[KnowledgeChunk] = GrowattKnowledgeIngestor.build_knowledge_chunks()

    def retrieve_top_k(
        self,
        query: str,
        model_sku: str = "GROWATT_SPF_5000ES",
        top_k: int = 3,
        active_fault_code: int = 0,
    ) -> List[KnowledgeChunk]:
        """
        Computes cosine similarity between the user query (plus any active hardware fault code
        from VFS `state.json`) and the indexed Growatt knowledge vectors.
        """
        augmented_query = query
        if active_fault_code > 0:
            augmented_query += f" fault {active_fault_code:02d} warning {active_fault_code:02d}"

        query_vec = GrowattKnowledgeIngestor.compute_deterministic_embedding(augmented_query)
        q_lower = augmented_query.lower()

        scored: List[Tuple[float, KnowledgeChunk]] = []
        for chunk in self.chunks:
            # Filter out chunks belonging to a different inverter SKU unless marked ALL
            if chunk.model_sku not in ("ALL", model_sku):
                continue

            # Dot product of normalized unit vectors == Cosine Similarity
            cosine_sim = sum(a * b for a, b in zip(query_vec, chunk.embedding))

            # Boost exact keyword / fault code hits
            keyword_boost = sum(0.25 for kw in chunk.keywords if kw in q_lower)
            total_score = cosine_sim + keyword_boost
            scored.append((total_score, chunk))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [item[1] for item in scored[:top_k]]