from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass


@dataclass(frozen=True)
class StreamEvent:
    event: str
    data: dict


class AgentProvider(ABC):
    @abstractmethod
    async def stream_message(self, conversation_id: str, message: str, run_id: str) -> AsyncIterator[StreamEvent]:
        raise NotImplementedError

    @abstractmethod
    async def stop_generation(self, run_id: str) -> None:
        raise NotImplementedError

    @abstractmethod
    async def get_available_models(self) -> list[dict]:
        raise NotImplementedError

    @abstractmethod
    async def get_available_tools(self) -> list[dict]:
        raise NotImplementedError
