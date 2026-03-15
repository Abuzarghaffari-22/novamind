from __future__ import annotations

import json
from typing import TYPE_CHECKING

from langchain.tools import tool

if TYPE_CHECKING:
    from services.knowledge_base import KnowledgeBaseService

_kb_service: "KnowledgeBaseService | None" = None


def set_kb_service(kb: "KnowledgeBaseService") -> None:
    """Wire the KB service into all tools. Called once at startup."""
    global _kb_service
    _kb_service = kb


@tool
def search_knowledge_base(query: str) -> str:
    """
    Search the enterprise knowledge base for relevant information.
    Use this when the user asks about documents, uploaded files, or
    any information that may be in the knowledge base.
    Input: a natural language search query string.
    Output: JSON with ranked document chunks and similarity scores.
    """
    if _kb_service is None:
        return json.dumps({"error": "Knowledge base not initialised"})
    try:
        results = _kb_service._vs.search(
            _kb_service._embed.embed_text(query), k=4
        )
        if not results:
            return json.dumps({
                "results": [],
                "message": "No relevant documents found for this query.",
            })
        return json.dumps({
            "results": [
                {
                    "rank":     r.rank,
                    "score":    round(r.score, 4),
                    "source":   r.doc.source,
                    "doc_type": r.doc.doc_type,
                    "content":  r.doc.content[:800],
                }
                for r in results
            ]
        })
    except Exception as exc:
        return json.dumps({"error": str(exc)})


@tool
def get_knowledge_base_stats() -> str:
    """
    Get statistics about the current knowledge base.
    Returns total documents, unique sources, and breakdown by file type.
    Use this when the user asks what documents are available.
    """
    if _kb_service is None:
        return json.dumps({"error": "Knowledge base not initialised"})
    try:
        return json.dumps(_kb_service.get_stats())
    except Exception as exc:
        return json.dumps({"error": str(exc)})


@tool
def summarize_topic(topic: str) -> str:
    """
    Retrieve and synthesise all knowledge base content about a specific topic.
    Use for: 'summarise everything about X', 'give me an overview of Y',
    or when the user wants a comprehensive answer drawn from multiple documents.
    Input: topic or subject string.
    """
    if _kb_service is None:
        return json.dumps({"error": "Knowledge base not initialised"})
    try:
        results = _kb_service._vs.search(
            _kb_service._embed.embed_text(topic), k=8
        )
        if not results:
            return json.dumps({"message": f"No content found about: {topic}"})
        context = "\n\n---\n\n".join(
            f"[{r.doc.source}]\n{r.doc.content}" for r in results
        )
        return json.dumps({
            "topic":   topic,
            "sources": list({r.doc.source for r in results}),
            "context": context[:4000],
        })
    except Exception as exc:
        return json.dumps({"error": str(exc)})


@tool
def calculate(expression: str) -> str:
    """
    Evaluate a mathematical expression safely.
    Supports: +, -, *, /, **, %, abs(), round(), min(), max(), sqrt(), log(), pi, e.
    Input: a math expression string, e.g. '(25 * 4) / 100' or 'sqrt(144)'.
    Output: JSON with the expression and numeric result.
    """
    import ast
    import math

    SAFE_NAMES = {
        "abs":   abs,      "round": round,    "min":   min,
        "max":   max,      "sum":   sum,       "pow":   pow,
        "int":   int,      "float": float,     "sqrt":  math.sqrt,
        "log":   math.log, "log10": math.log10,"pi":    math.pi,
        "e":     math.e,   "ceil":  math.ceil, "floor": math.floor,
    }

    SAFE_NODES = (
        ast.Expression, ast.BinOp, ast.UnaryOp, ast.Constant,
        ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Mod, ast.Pow,
        ast.FloorDiv, ast.USub, ast.UAdd, ast.Call, ast.Name, ast.Load,
    )

    try:
        tree = ast.parse(expression.strip(), mode="eval")
        for node in ast.walk(tree):
            if not isinstance(node, SAFE_NODES):
                raise ValueError(f"Unsafe node in expression: {type(node).__name__}")
        result = eval(
            compile(tree, "<string>", "eval"),
            {"__builtins__": {}},
            SAFE_NAMES,
        )
        return json.dumps({"expression": expression, "result": result})
    except Exception as exc:
        return json.dumps({"error": f"Calculation failed: {str(exc)}"})


NOVAMIND_TOOLS = [
    search_knowledge_base,
    get_knowledge_base_stats,
    summarize_topic,
    calculate,
]