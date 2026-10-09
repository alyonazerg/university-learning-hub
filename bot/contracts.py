"""Offline Telegram/backend boundary. No polling, API calls or token handling here."""
from dataclasses import dataclass
from urllib.parse import urlsplit


@dataclass(frozen=True)
class StudentBinding:
    public_id: str
    telegram_user_id: int
    group_id: int
    notifications_enabled: bool = False


@dataclass(frozen=True)
class TaskAudience:
    public_id: str
    group_ids: frozenset[int]


class InvalidSubmission(ValueError):
    pass


def homework_envelope(message: dict, binding: StudentBinding, task: TaskAudience) -> dict:
    """Bindings/tasks must come from trusted backend lookup, never the update payload.

    Caller accepts updates only via authenticated Telegram polling or a validated
    webhook secret, then resolves a student's selected task on the server.
    Media IDs stay private; the backend downloads, validates and stores media
    before acknowledging or consuming an attempt. This is not a saved submission.
    """
    if message.get('chat', {}).get('type') != 'private':
        raise InvalidSubmission('Private chat required')
    if message.get('from', {}).get('id') != binding.telegram_user_id or message.get('chat', {}).get('id') != binding.telegram_user_id:
        raise InvalidSubmission('Registered account required')
    if binding.group_id not in task.group_ids:
        raise InvalidSubmission('Task not available')
    text = message.get('text', message.get('caption', ''))
    if not isinstance(text, str) or len(text) > 6000:
        raise InvalidSubmission('Invalid text')
    photo = None
    sizes = message.get('photo', [])
    if sizes:
        if not isinstance(sizes, list) or any(not isinstance(size, dict) for size in sizes):
            raise InvalidSubmission('Invalid photo')
        # Telegram sizes are thumbnail variants of one photo, not multiple attachments.
        candidate = max(sizes, key=lambda size: size.get('width', 0) * size.get('height', 0))
        file_id = candidate.get('file_id')
        if not isinstance(file_id, str) or not file_id or len(file_id) > 512:
            raise InvalidSubmission('Invalid file reference')
        if candidate.get('file_size', 0) > 5 * 1024 * 1024:
            raise InvalidSubmission('Photo too large')
        photo = {'telegram_file_id': file_id}
    if message.get('document'):
        raise InvalidSubmission('Use text or a photo; arbitrary documents are not accepted yet')
    message_id = message.get('message_id')
    if not isinstance(message_id, int) or isinstance(message_id, bool) or not text.strip() and not photo:
        raise InvalidSubmission('Empty or invalid submission')
    return {
        'student_public_id': binding.public_id,
        'task_public_id': task.public_id,
        'text': text.strip(),
        'private_media': [photo] if photo else [],
        'source_key': f'telegram:{binding.public_id}:{message_id}',
    }


def notification_payload(binding: StudentBinding, audience: frozenset[int], authenticated_page_url: str) -> dict | None:
    """Build generic sendMessage args, without work, grades or student identifiers in text."""
    url = urlsplit(authenticated_page_url)
    if url.scheme != 'https' or not url.hostname or url.username or url.password:
        raise ValueError('Configured HTTPS application URL required')
    if binding.group_id not in audience or not binding.notifications_enabled:
        return None
    return {
        'chat_id': binding.telegram_user_id,
        'text': 'В Moon Campus новое объявление для твоей группы.',
        'reply_markup': {'inline_keyboard': [[{'text': 'Открыть учебное пространство', 'url': authenticated_page_url}]]},
        'link_preview_options': {'is_disabled': True},
    }
