from __future__ import annotations

import json

from langchain.agents import AgentExecutor, create_react_agent
from langchain.memory import ConversationBufferWindowMemory
from langchain.prompts import PromptTemplate
from langchain_aws import ChatBedrockConverse

from agents.tools import NOVAMIND_TOOLS
from config import get_settings
from utils.logging import get_logger

settings = get_settings()
log      = get_logger(__name__)


_REACT_PROMPT = """You are NovaMind, an intelligent AI assistant with access to an enterprise knowledge base and tools.

You have access to the following tools:
{tools}

Use this EXACT format when using tools:

Thought: [your reasoning about what to do]
Action: [must be EXACTLY one of: {tool_names}]
Action Input: [plain string input to the tool — no JSON, no brackets]
Observation: [result returned by the tool]
... (repeat Thought/Action/Action Input/Observation as needed)
Thought: I now know the final answer
Final Answer: [your complete, well-formatted answer]

RULES:
- Action must be EXACTLY one of [{tool_names}] — copy it character-for-character
- Action Input must be a plain string — never JSON, never code syntax
- Every tool-using response must end with "Final Answer:" on its own line
- For greetings and conversational messages (hi, hello, thanks, how are you, etc.),
  respond DIRECTLY: "Final Answer: [your reply]" — do NOT call any tools
- Only call tools when the question requires documents, facts, or calculations
- If a tool returns no results, say so clearly in your Final Answer
- Cite document sources in your Final Answer when KB results are used

Previous conversation:
{chat_history}

Question: {input}
{agent_scratchpad}"""


class NovaMindAgent:
    """ReAct agent bound to a single session."""

    def __init__(self, session_id: str) -> None:
        self.session_id = session_id
        self._llm       = self._build_llm()
        self._memory    = ConversationBufferWindowMemory(
            k=settings.conversation_memory_k,
            memory_key="chat_history",
            return_messages=False,
        )
        self._executor  = self._build_executor()
        log.info("agent_created", session_id=session_id)

    def _build_llm(self) -> ChatBedrockConverse:
        kwargs: dict = {
            "model":       settings.nova_lite_model_id,
            "region_name": settings.aws_region,
            "max_tokens":  settings.nova_lite_max_tokens,
            "temperature": 0.1,
        }
        if settings.aws_access_key_id:
            kwargs["aws_access_key_id"]     = settings.aws_access_key_id
            kwargs["aws_secret_access_key"] = settings.aws_secret_access_key
        if settings.aws_session_token:
            kwargs["aws_session_token"] = settings.aws_session_token
        return ChatBedrockConverse(**kwargs)

    def _build_executor(self) -> AgentExecutor:
        prompt = PromptTemplate(
            input_variables=[
                "tools",
                "tool_names",
                "input",
                "chat_history",
                "agent_scratchpad",
            ],
            template=_REACT_PROMPT,
        )
        agent = create_react_agent(self._llm, NOVAMIND_TOOLS, prompt)
        return AgentExecutor(
            agent=agent,
            tools=NOVAMIND_TOOLS,
            memory=self._memory,
            max_iterations=settings.agent_max_iterations,
            verbose=settings.agent_verbose,
            handle_parsing_errors=True,
            return_intermediate_steps=True,
        )

    def invoke(self, user_message: str) -> dict:
        """
        Run the agent on a user message.

        Returns:
            {
                "answer":     str,
                "steps":      list[dict],
                "session_id": str,
            }
        """
        try:
            result = self._executor.invoke({"input": user_message})
            steps  = self._format_steps(result.get("intermediate_steps", []))
            output = result.get("output", "")

            if "Agent stopped due to iteration limit" in output:
                log.warning(
                    "agent_iteration_limit",
                    session_id=self.session_id,
                    steps=len(steps),
                )
                partial = self._salvage_partial_answer(steps)
                output = partial or (
                    "I couldn't complete my research within the allowed steps. "
                    "Try rephrasing your question or uploading relevant documents first."
                )

            log.info(
                "agent_invoked",
                session_id=self.session_id,
                tool_calls=len(steps),
                output_len=len(output),
            )
            return {"answer": output, "steps": steps, "session_id": self.session_id}

        except Exception as exc:
            log.error("agent_invoke_failed", session_id=self.session_id, error=str(exc))
            return {
                "answer": (
                    "I encountered an error while processing your request. "
                    f"Details: {str(exc)[:300]}"
                ),
                "steps":      [],
                "session_id": self.session_id,
            }

    def clear_memory(self) -> None:
        self._memory.clear()
        log.info("agent_memory_cleared", session_id=self.session_id)

    @staticmethod
    def _format_steps(steps: list) -> list[dict]:
        return [
            {
                "tool":        getattr(action, "tool", "unknown"),
                "tool_input":  str(getattr(action, "tool_input", ""))[:200],
                "observation": str(observation)[:500],
            }
            for action, observation in steps
        ]

    @staticmethod
    def _salvage_partial_answer(steps: list[dict]) -> str | None:
        """Surface something useful from the last tool observation when the agent hits its iteration cap."""
        if not steps:
            return None
        last_obs = steps[-1].get("observation", "")
        try:
            data    = json.loads(last_obs)
            results = data.get("results", [])
            if results:
                top     = results[0]
                source  = top.get("source", "knowledge base")
                content = top.get("content", "")[:600]
                return f"Based on '{source}':\n\n{content}"
        except Exception:
            pass
        if len(last_obs) > 50:
            return f"Partial result:\n\n{last_obs[:600]}"
        return None


class AgentRegistry:
    """LRU pool of NovaMindAgent instances, one per session."""

    MAX_SESSIONS = 50

    def __init__(self) -> None:
        self._agents: dict[str, NovaMindAgent] = {}

    def get_or_create(self, session_id: str) -> NovaMindAgent:
        if session_id not in self._agents:
            if len(self._agents) >= self.MAX_SESSIONS:
                oldest = next(iter(self._agents))
                del self._agents[oldest]
                log.warning("agent_evicted", evicted=oldest)
            self._agents[session_id] = NovaMindAgent(session_id)
        return self._agents[session_id]

    def remove(self, session_id: str) -> None:
        self._agents.pop(session_id, None)

    @property
    def active_sessions(self) -> int:
        return len(self._agents)


agent_registry = AgentRegistry()